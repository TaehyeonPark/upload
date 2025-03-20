import logging
from logging.handlers import RotatingFileHandler
import sys
import os
from typing import List
from pathlib import Path as PyPath
import time
import threading
import dotenv
import uuid
import shutil
from io import BytesIO
import hashlib
import json
from urllib.parse import quote

from fastapi import *
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from utils import *

sys.path.append(str(PyPath(__file__).resolve().parent))

dotenv.load_dotenv('.env')

root_dir = PyPath(os.getcwd())
static_dir = root_dir / 'static'
index_file = static_dir / "index.html"

# PHYSICALDISK_DIR = "/mnt/physicaldisk"
PHYSICALDISK_DIR: str = PyPath(os.getenv("PHYSICALDISK_DIR")
                               ) if os.getenv("PHYSICALDISK_DIR") else ""
# PHYSICALDISK_MAX_UTIL = 1 * 1024 * 1024 * 1024   # 1GB
MAX_FILE_REQUEST = 1 * 1024 * 1024 * 1024   # 1GB
PHYSICALDISK_MAX_UTIL = 200 * 1024 * 1024   # 200MB
MAX_FILE_SIZE = 100 * 1024 * 1024  # 100MB
MAX_FILE_COUNT = 20
FILE_LIFESPAN = 3600  # 1H
TIMEOUT_SECONDS = 5


LOG_DIR = "./log"
LOG_FILE = os.path.join(LOG_DIR, "access.log")

# 디렉터리가 없으면 생성
os.makedirs(LOG_DIR, exist_ok=True)


app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
enforce_physicaldisk_limit(PHYSICALDISK_DIR, PHYSICALDISK_MAX_UTIL)

app.mount("/static", StaticFiles(directory=static_dir), name="static")


@app.get("/")
async def read_root():
    return FileResponse(index_file)


@app.post("/upload")
async def upload_files(files: List[UploadFile] = File(...)):
    if not files or len(files) == 0:
        raise HTTPException(status_code=400, detail="No files uploaded")

    if len(files) < 1:
        raise HTTPException(
            status_code=400, detail=f"Too few files uploaded. Minimum allowed is 1.")

    if len(files) > MAX_FILE_COUNT:
        raise HTTPException(
            status_code=400, detail=f"Too many files uploaded. Maximum allowed is {MAX_FILE_COUNT}.")

    total_size = 0
    for file in files:
        file_size = file.size
        total_size += file_size

    if total_size > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400, detail=f"Total file size exceeds the maximum allowed size of {MAX_FILE_SIZE // (1024 * 1024)}MB.")

    try:
        enforce_physicaldisk_limit(root_dir / PHYSICALDISK_DIR,
                                   PHYSICALDISK_MAX_UTIL)
    except TimeoutError as e:
        raise HTTPException(status_code=500, detail=str(e))

    file_dict = {}
    for file in files:
        unique_filename = hashlib.sha256(
            f"{uuid.uuid4().hex[:8]}-{time.time()}".encode()).hexdigest()[:6]
        physical_filename = f"{unique_filename}-{file.filename}.upload"
        out_file = root_dir / PHYSICALDISK_DIR / physical_filename
        file_dict[file.filename] = unique_filename
        with open(out_file, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        threading.Thread(target=schedule_file_deletion, args=(
            PHYSICALDISK_DIR, physical_filename, FILE_LIFESPAN)).start()

    return {"message": f"{len(files)} file(s) successfully merged", "file": json.dumps(file_dict)}


@app.get("/download/{file_name}")
async def download_file(file_name: str):
    file_path = PHYSICALDISK_DIR / file_name

    try:
        if not file_path.resolve().is_relative_to(PHYSICALDISK_DIR.resolve()):
            raise HTTPException(status_code=400, detail="Invalid file path")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid file path")

    physical_file_name = get_physicaldisk_file_name(
        PHYSICALDISK_DIR, file_name)
    physical_file_path = PHYSICALDISK_DIR / physical_file_name

    if physical_file_name is not None and physical_file_path.exists() and physical_file_path.is_file():
        download_name = physical_file_name.replace(
            f"{file_name}-", "").replace(".upload", "")
        return FileResponse(physical_file_path, media_type="application/octet-stream", filename=download_name)
    raise HTTPException(status_code=404, detail="File not found")

if __name__ == "__main__":
    import uvicorn

    log_config = {
        "version": 1,
        "disable_existing_loggers": False,
        "formatters": {
            "default": {
                "format": "%(asctime)s - %(levelname)s - %(message)s",
            },
        },
        "handlers": {
            "default": {
                "class": "logging.StreamHandler",
                "level": "INFO",
                "formatter": "default",
            },
            "compressed_file": {
                "()": CompressedRotatingFileHandler,  # 사용자 정의 핸들러 사용
                "level": "INFO",
                "formatter": "default",
                "filename": LOG_FILE,
                "maxBytes": 10_000_000,  # 10MB
                "backupCount": 5,  # 백업본 최대 5개
            },
        },
        "loggers": {
            "uvicorn": {
                "handlers": ["default", "compressed_file"],
                "level": "INFO",
                "propagate": False,
            },
            "uvicorn.access": {
                "handlers": ["default", "compressed_file"],
                "level": "INFO",
                "propagate": False,
            },
        },
    }

    uvicorn.run("app:app", host="0.0.0.0", port=50002,
                reload=True, log_config=log_config)
