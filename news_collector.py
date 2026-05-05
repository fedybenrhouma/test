import os
import asyncio
import httpx
import hashlib
import psycopg2
import feedparser
import re
from bs4 import BeautifulSoup
from psycopg2.extras import execute_values
from sentence_transformers import SentenceTransformer
from dotenv import load_dotenv

# Load environment variables from the correct .env file
load_dotenv('backend/.env')
# Fallback to agents/.env if backend/.env doesn't have it (or vice versa)
if not os.getenv("POSTGRES_URL"):
    load_dotenv('agents/.env')

POSTGRES_URL = os.getenv("POSTGRES_URL")

# Top free crypto RSS feeds that provide full/partial articles
RSS_FEEDS = [
    "https://cointelegraph.com/rss",
    "https://www.newsbtc.com/feed/",
    "https://cryptopotato.com/feed/",
    "https://beincrypto.com/feed/"
]

# Keywords to map articles to our tracked assets
ASSET_KEYWORDS = {
    "BTC": ["BTC", "Bitcoin"],
    "ETH": ["ETH", "Ethereum"],
    "BNB": ["BNB", "Binance Coin", "Binance"],
    "SOL": ["SOL", "Solana"]
}

# Load model once at startup
print("Loading sentence-transformer model...")
model = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")

def get_db_connection():
    return psycopg2.connect(POSTGRES_URL)

def clean_html(raw_html):
    """Strip HTML tags to provide clean text for the LLM."""
    soup = BeautifulSoup(raw_html, "html.parser")
    return soup.get_text(separator=" ", strip=True)

async def fetch_feed(client, url):
    try:
        # Headers help prevent being blocked by basic bot-protection
        headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
        response = await client.get(url, headers=headers, timeout=15.0)
        response.raise_for_status()
        return url, response.text
    except Exception as e:
        print(f"Error fetching {url}: {e}")
        return url, None

def process_and_insert(feed_results):
    articles_to_process = []
    
    for url, xml_content in feed_results:
        if not xml_content:
            continue
            
        feed = feedparser.parse(xml_content)
        source = feed.feed.get("title", "Crypto News")
        
        for entry in feed.entries:
            title = entry.get("title", "")
            link = entry.get("link", "")
            
            # Prefer 'content' if it exists for full text, fallback to 'description'
            content_html = ""
            if "content" in entry and len(entry.content) > 0:
                content_html = entry.content[0].value
            else:
                content_html = entry.get("description", "")
                
            content = clean_html(content_html)
            search_text = f"{title} {content}"
            
            # Map article to assets based on keyword occurrences
            matched_assets = []
            for asset, keywords in ASSET_KEYWORDS.items():
                for kw in keywords:
                    # Use regex boundaries \b so we don't accidentally match 'sold' to 'SOL'
                    if re.search(rf"\b{re.escape(kw)}\b", search_text, re.IGNORECASE):
                        if asset not in matched_assets:
                            matched_assets.append(asset)
            
            for asset in matched_assets:
                # SHA256 for deduplication
                raw_string = f"{title}{source}{asset}"
                content_hash = hashlib.sha256(raw_string.encode('utf-8')).hexdigest()
                
                articles_to_process.append({
                    "title": title, "content": content, "source": source,
                    "asset": asset, "url": link, "content_hash": content_hash
                })

    if not articles_to_process:
        return 0, 0

    print(f"Embedding {len(articles_to_process)} articles...")
    texts_to_embed = [f"{a['title']} - {a['content']}" for a in articles_to_process]
    embeddings = model.encode(texts_to_embed)

    insert_data = [
        (a["title"], a["content"], a["source"], a["asset"], a["url"], a["content_hash"], emb.tolist())
        for a, emb in zip(articles_to_process, embeddings)
    ]

    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            query = """
                INSERT INTO crypto_news_embeddings 
                (title, content, source, asset, url, content_hash, embedding)
                VALUES %s
                ON CONFLICT (content_hash) DO NOTHING
            """
            execute_values(cur, query, insert_data)
            conn.commit()
            
            inserted = cur.rowcount
            skipped = len(insert_data) - inserted
    except Exception as e:
        print(f"Database error: {e}")
        conn.rollback()
        inserted, skipped = 0, len(insert_data)
    finally:
        conn.close()
        
    return inserted, skipped

async def main():
    if not POSTGRES_URL:
        print("Error: POSTGRES_URL is not set. Please set it in your .env file.")
        return

    print(f"Starting news collection from RSS feeds...")
    async with httpx.AsyncClient() as client:
        tasks = [fetch_feed(client, url) for url in RSS_FEEDS]
        results = await asyncio.gather(*tasks)
    
    # Run sync DB & CPU heavy operations in a separate thread
    inserted, skipped = await asyncio.to_thread(process_and_insert, results)
    print(f"Summary: {inserted} inserted, {skipped} skipped (already in DB).")

if __name__ == "__main__":
    asyncio.run(main())