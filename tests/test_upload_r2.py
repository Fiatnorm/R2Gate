import contextlib
import io
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from botocore.exceptions import ClientError

import upload_r2


class FakeClient:
    def __init__(self, exists):
        self.exists = exists
        self.uploaded = None

    def head_object(self, **kwargs):
        if not self.exists:
            raise ClientError({"Error": {"Code": "404"}}, "HeadObject")

    def upload_file(self, *args, **kwargs):
        self.uploaded = (args, kwargs)


class UploadR2Tests(unittest.TestCase):
    def run_upload(self, local_name, object_key, exists=False):
        with tempfile.TemporaryDirectory() as directory:
            directory_path = Path(directory)
            local_file = directory_path / local_name
            local_file.write_bytes(b"test")
            config_path = directory_path / "config.json"
            config_path.write_text(
                json.dumps(
                    {
                        "R2_ACCOUNT_ID": "account-id",
                        "R2_ACCESS_KEY_ID": "access-key-id",
                        "R2_SECRET_ACCESS_KEY": "secret-access-key",
                        "R2_BUCKET_NAME": "bucket-name",
                        "LOCAL_FILE": local_name,
                        "R2_OBJECT_KEY": object_key,
                    }
                ),
                encoding="utf-8",
            )
            client = FakeClient(exists)
            output = io.StringIO()

            with (
                patch.object(upload_r2, "CONFIG_PATH", config_path),
                patch("boto3.client", return_value=client),
                contextlib.redirect_stdout(output),
            ):
                result = upload_r2.main()

            return result, output.getvalue(), client.uploaded

    def test_create_and_update(self):
        for exists, marker in ((False, "[CREATE]"), (True, "[UPDATE]")):
            with self.subTest(exists=exists):
                result, output, uploaded = self.run_upload(
                    "payload.bin", "scripts/run.sh", exists
                )
                self.assertEqual(result, 0)
                self.assertIn(marker, output)
                self.assertIn("[SUCCESS] Upload completed", output)
                args, kwargs = uploaded
                self.assertEqual(args[1:], ("bucket-name", "scripts/run.sh"))
                self.assertEqual(kwargs["ExtraArgs"]["ContentType"], "text/x-sh")

    def test_content_type_priority_and_fallbacks(self):
        cases = (
            ("payload.txt", "files/data.json", "application/json"),
            ("payload.csv", "files/data", "text/csv"),
            ("payload.unknown", "files/data", "application/octet-stream"),
        )

        for local_name, object_key, expected in cases:
            with self.subTest(object_key=object_key, expected=expected):
                result, _, uploaded = self.run_upload(local_name, object_key)
                self.assertEqual(result, 0)
                self.assertEqual(uploaded[1]["ExtraArgs"]["ContentType"], expected)

    def test_common_mime_overrides(self):
        for extension, expected in upload_r2.MIME_TYPE_OVERRIDES.items():
            with self.subTest(extension=extension):
                actual = upload_r2.guess_content_type(f"file{extension}")
                self.assertEqual(actual, expected)

    def test_missing_config_returns_error(self):
        missing_path = Path("missing-config.json").resolve()
        error = io.StringIO()

        with (
            patch.object(upload_r2, "CONFIG_PATH", missing_path),
            contextlib.redirect_stderr(error),
        ):
            result = upload_r2.main()

        self.assertEqual(result, 1)
        self.assertIn("[ERROR] Config file not found", error.getvalue())


if __name__ == "__main__":
    unittest.main()
