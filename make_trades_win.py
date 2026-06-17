import psycopg2
import sys

try:
    conn = psycopg2.connect('postgresql://postgres:D14440882@localhost/cryptoAI')
    cur = conn.cursor()
    
    cur.execute('SELECT id FROM "Users" WHERE email = %s', ('fedybenrhouma@gmail.com',))
    user_row = cur.fetchone()
    
    if user_row:
        user_id = user_row[0]
        print(f"Found user: {user_id}")
        
        # Update all trades to be winners
        # Use updated_at instead of closed_at
        cur.execute("""
            UPDATE trades 
            SET status = 'closed', 
                pnl = 3.5 + (random() * 5.0),
                close_reason = 'Target Reached',
                updated_at = CURRENT_TIMESTAMP
            WHERE user_id = %s
        """, (user_id,))
        
        conn.commit()
        print(f"Success! {cur.rowcount} trades updated to WINNERS.")
    else:
        print("User not found.")
        
    cur.close()
    conn.close()
except Exception as e:
    print(f"Database error: {e}")
