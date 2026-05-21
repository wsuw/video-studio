import os
import sys
import shutil
import uuid
import mimetypes
from typing import Optional
from dotenv import load_dotenv

# Ensure the script directory is in sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Load env variables from root directory
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"))

# ==========================================
# Storage Client Definitions
# ==========================================

class StorageClient:
    def generate_unique_path(self, extension: str) -> str:
        """Generate a unique local temporary path with a given extension."""
        raise NotImplementedError
        
    def upload_file(self, local_path: str, request = None) -> str:
        """Upload a file to the active storage backend and return its public URL."""
        raise NotImplementedError

class LocalStorageClient(StorageClient):
    def generate_unique_path(self, extension: str) -> str:
        if not extension.startswith("."):
            extension = f".{extension}"
        os.makedirs("outputs", exist_ok=True)
        return os.path.join("outputs", f"{uuid.uuid4()}{extension}")

    def upload_file(self, local_path: str, request = None) -> str:
        filename = os.path.basename(local_path)
        dest_path = os.path.join("outputs", filename)
        
        # Ensure the file exists in the outputs directory
        if os.path.abspath(local_path) != os.path.abspath(dest_path):
            os.makedirs("outputs", exist_ok=True)
            shutil.copy2(local_path, dest_path)
            
        if request:
            base_url = str(request.base_url)
            return f"{base_url.rstrip('/')}/outputs/{filename}"
        return f"/outputs/{filename}"

class S3StorageClient(StorageClient):
    def __init__(self):
        import boto3
        from botocore.config import Config
        
        self.endpoint = os.getenv("STORAGE_S3_ENDPOINT", "http://127.0.0.1:9000")
        self.access_key = os.getenv("STORAGE_S3_ACCESS_KEY", "minioadmin")
        self.secret_key = os.getenv("STORAGE_S3_SECRET_KEY", "minioadmin")
        self.bucket_name = os.getenv("STORAGE_S3_BUCKET", "video-studio")
        
        self.s3 = boto3.client(
            "s3",
            endpoint_url=self.endpoint,
            aws_access_key_id=self.access_key,
            aws_secret_access_key=self.secret_key,
            config=Config(
                signature_version="s3v4",
                s3={"addressing_style": "path"}
            ),
            region_name="us-east-1"
        )

    def generate_unique_path(self, extension: str) -> str:
        if not extension.startswith("."):
            extension = f".{extension}"
        os.makedirs("outputs", exist_ok=True)
        return os.path.join("outputs", f"{uuid.uuid4()}{extension}")

    def upload_file(self, local_path: str, request = None) -> str:
        filename = os.path.basename(local_path)
        content_type, _ = mimetypes.guess_type(local_path)
        if not content_type:
            content_type = "application/octet-stream"
            
        with open(local_path, "rb") as f:
            self.s3.put_object(
                Bucket=self.bucket_name,
                Key=filename,
                Body=f,
                ContentType=content_type
            )
            
        # Return direct public access URL from MinIO
        endpoint_clean = self.endpoint.rstrip("/")
        return f"{endpoint_clean}/{self.bucket_name}/{filename}"

def get_storage_client() -> StorageClient:
    backend = os.getenv("STORAGE_BACKEND", "local").lower()
    if backend == "s3":
        return S3StorageClient()
    return LocalStorageClient()
