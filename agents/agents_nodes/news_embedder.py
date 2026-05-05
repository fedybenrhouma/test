import asyncio
from sentence_transformers import SentenceTransformer

# Load HF model once at module level
model = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")

async def retrieve_relevant_news(conn, query, asset, limit=5, hours_back=24) -> list[tuple]:
    # CPU heavy task run in thread
    query_embedding = await asyncio.to_thread(model.encode, query)
    embedding_list = query_embedding.tolist()

    def fetch_from_db():
        with conn.cursor() as cur:
            # <=> is the pgvector operator for cosine distance. 1 - distance = similarity.
            sql = """
                SELECT title, content, source, created_at, 
                       1 - (embedding <=> %s::vector) AS similarity_score
                FROM crypto_news_embeddings
                WHERE asset = %s 
                  AND created_at >= NOW() - INTERVAL '%s hours'
                ORDER BY embedding <=> %s::vector
                LIMIT %s
            """
            cur.execute(sql, (embedding_list, asset, hours_back, embedding_list, limit))
            return cur.fetchall()

    return await asyncio.to_thread(fetch_from_db)