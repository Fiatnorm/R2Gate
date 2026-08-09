import json
import mimetypes
import sys
from pathlib import Path


CONFIG_PATH = Path(__file__).resolve().with_name("config.json")
REQUIRED_CONFIG_KEYS = (
    "R2_ACCOUNT_ID",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_BUCKET_NAME",
    "LOCAL_FILE",
    "R2_OBJECT_KEY",
)

MIME_TYPE_OVERRIDES = {
    ".csv": "text/csv",
    ".xml": "application/xml",
    ".zip": "application/zip",
    ".gz": "application/gzip",
    ".gzip": "application/gzip",
    ".7z": "application/x-7z-compressed",
    ".rar": "application/vnd.rar",
    ".webp": "image/webp",
    ".flac": "audio/flac",
    ".aac": "audio/aac",
    ".avi": "video/x-msvideo",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
    ".otf": "font/otf",
    ".sh": "text/x-sh",
}

def guess_content_type(*file_names):
    for file_name in file_names:
        override = MIME_TYPE_OVERRIDES.get(Path(file_name).suffix.lower())
        if override:
            return override

        guessed_type = mimetypes.guess_type(file_name)[0]
        if guessed_type:
            return guessed_type

    return "application/octet-stream"


def main():
    try:
        config = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    except FileNotFoundError:
        print(f"[ERROR] Config file not found: {CONFIG_PATH}", file=sys.stderr)
        return 1
    except (json.JSONDecodeError, OSError) as error:
        print(f"[ERROR] Failed to read config file: {error}", file=sys.stderr)
        return 1

    if not isinstance(config, dict):
        print("[ERROR] Config file must contain a JSON object", file=sys.stderr)
        return 1

    missing = [
        name
        for name in REQUIRED_CONFIG_KEYS
        if not isinstance(config.get(name), str) or not config[name].strip()
    ]
    if missing:
        print(f"[ERROR] Missing config values: {', '.join(missing)}", file=sys.stderr)
        return 1

    local_file = Path(config["LOCAL_FILE"])
    if not local_file.is_absolute():
        local_file = CONFIG_PATH.parent / local_file
    object_key = config["R2_OBJECT_KEY"]

    if not local_file.is_file():
        print(f"[ERROR] Local file not found: {local_file}", file=sys.stderr)
        return 1

    content_type = guess_content_type(object_key, local_file.name)

    try:
        import boto3
        from botocore.exceptions import ClientError

        client = boto3.client(
            "s3",
            endpoint_url=f"https://{config['R2_ACCOUNT_ID']}.r2.cloudflarestorage.com",
            aws_access_key_id=config["R2_ACCESS_KEY_ID"],
            aws_secret_access_key=config["R2_SECRET_ACCESS_KEY"],
            region_name="auto",
        )
        bucket = config["R2_BUCKET_NAME"]

        try:
            client.head_object(Bucket=bucket, Key=object_key)
            action = "UPDATE"
        except ClientError as error:
            error_code = str(error.response.get("Error", {}).get("Code", ""))
            if error_code not in {"404", "NoSuchKey", "NotFound"}:
                raise
            action = "CREATE"

        client.upload_file(
            str(local_file),
            bucket,
            object_key,
            ExtraArgs={"ContentType": content_type},
        )
        print(f"[{action}] {object_key}")
        print("[SUCCESS] Upload completed")
        return 0
    except ImportError:
        print(
            r"[ERROR] boto3 is not installed; run: .\.venv\Scripts\python.exe -m pip install -r requirements.txt",
            file=sys.stderr,
        )
        return 1
    except Exception as error:
        print(f"[ERROR] Upload failed: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
