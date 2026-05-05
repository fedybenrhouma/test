import asyncio
from sentence_transformers import SentenceTransformer

# Load HF model once at module level
model = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")

async def embed_and_store_trade(conn, trade: dict):
    asset = trade.get('asset', 'UNKNOWN')
    direction = trade.get('direction', 'UNKNOWN')
    timeframe = trade.get('timeframe', 'UNKNOWN')
    outcome = trade.get('outcome', 'UNKNOWN')
    pnl = trade.get('pnl', 0.0)
    
    # E.g.: "BNB LONG on 1h | Result: WIN +2.3%"
    summary = f"{asset} {direction} on {timeframe} | Result: {outcome} {pnl:+.2f}%"
    
    embedding = await asyncio.to_thread(model.encode, summary)
    embedding_list = embedding.tolist()

    def insert_db():
        with conn.cursor() as cur:
            sql = """
                INSERT INTO trade_memory 
                (summary, asset, direction, timeframe, outcome, pnl, embedding)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
            """
            cur.execute(sql, (summary, asset, direction, timeframe, outcome, pnl, embedding_list))
            conn.commit()

    await asyncio.to_thread(insert_db)


async def retrieve_similar_trades(conn, query, asset, outcome=None, limit=5) -> list[tuple]:
    query_embedding = await asyncio.to_thread(model.encode, query)
    embedding_list = query_embedding.tolist()

    def fetch_db():
        with conn.cursor() as cur:
            if outcome:
                sql = """
                    SELECT summary, asset, direction, timeframe, outcome, pnl,
                           1 - (embedding <=> %s::vector) AS similarity_score
                    FROM trade_memory
                    WHERE asset = %s AND outcome = %s
                    ORDER BY embedding <=> %s::vector
                    LIMIT %s
                """
                cur.execute(sql, (embedding_list, asset, outcome, embedding_list, limit))
            else:
                sql = """
                    SELECT summary, asset, direction, timeframe, outcome, pnl,
                           1 - (embedding <=> %s::vector) AS similarity_score
                    FROM trade_memory
                    WHERE asset = %s
                    ORDER BY embedding <=> %s::vector
                    LIMIT %s
                """
                cur.execute(sql, (embedding_list, asset, embedding_list, limit))
            return cur.fetchall()

    return await asyncio.to_thread(fetch_db)