import os
import psycopg2
from dotenv import load_dotenv

# Load environment variables
load_dotenv('backend/.env')
if not os.getenv("POSTGRES_URL"):
    load_dotenv('agents/.env')

POSTGRES_URL = os.getenv("POSTGRES_URL")

def view_data():
    try:
        conn = psycopg2.connect(POSTGRES_URL)
        with conn.cursor() as cur:
            # Select examples of titles, raw content, and their embeddings
            cur.execute("SELECT title, content, embedding FROM crypto_news_embeddings LIMIT 2")
            rows = cur.fetchall()
            
            print("="*80)
            print("PIPELINE RAG : DE LA NEWS BRUTE AU VECTEUR (EMBEDDING)")
            print("="*80)
            
            for i, row in enumerate(rows):
                title = row[0]
                content = row[1]
                vector = row[2]
                
                print(f"\n--- EXEMPLE {i+1} ---")
                print(f"[TITRE NEWS]   : {title}")
                print(f"[CONTENU BRUT] : {content[:150]}...")
                print(f"\n[TRANSFORMATION EN VECTEUR (Dimension 384)] :")
                
                # Handle vector as string or list
                vector_str = str(vector)
                print(f"Vector: {vector_str[:120]}...")
                print("-" * 80)
                
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    view_data()
