import os
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from binascii import unhexlify
from dotenv import load_dotenv

load_dotenv()

def decrypt_key(stored_text: str) -> str:
    """
    Decrypts a key from the format: iv:authTag:encrypted
    Matching the AES-256-GCM logic in backend/utils/crypto.js
    """
    if not stored_text:
        return ""
        
    try:
        parts = stored_text.split(':')
        if len(parts) != 3:
            return ""
            
        iv_hex, auth_tag_hex, encrypted_hex = parts
        
        # Convert hex to bytes
        iv = unhexlify(iv_hex)
        auth_tag = unhexlify(auth_tag_hex)
        encrypted = unhexlify(encrypted_hex)
        
        # Get encryption key from env (hex string)
        encryption_key_hex = os.getenv("ENCRYPTION_KEY")
        if not encryption_key_hex:
            raise ValueError("ENCRYPTION_KEY not found in environment variables.")
            
        key = unhexlify(encryption_key_hex)
        
        # AES-256-GCM in cryptography library expects (ciphertext + auth_tag)
        aesgcm = AESGCM(key)
        decrypted_bytes = aesgcm.decrypt(iv, encrypted + auth_tag, None)
        
        return decrypted_bytes.decode('utf-8')
        
    except Exception as e:
        print(f"Decryption error: {e}")
        return ""
