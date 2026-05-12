import os
import psycopg2
from dotenv import load_dotenv

load_dotenv('backend/.env')
if not os.getenv("POSTGRES_URL"):
    load_dotenv('agents/.env')

POSTGRES_URL = os.getenv("POSTGRES_URL")

def check_db():
    try:
        conn = psycopg2.connect(POSTGRES_URL)
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM crypto_news_embeddings")
            count = cur.fetchone()[0]
            print(f"Total rows: {count}")
            
            cur.execute("SELECT asset, COUNT(*) FROM crypto_news_embeddings GROUP BY asset")
            print("Rows per asset:")
            for row in cur.fetchall():
                print(f"  {row[0]}: {row[1]}")
                
            cur.execute("SELECT title, created_at FROM crypto_news_embeddings ORDER BY created_at DESC LIMIT 5")
            print("Latest 5 articles:")
            for row in cur.fetchall():
                print(f"  {row[1]} - {row[0]}")
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_db()
