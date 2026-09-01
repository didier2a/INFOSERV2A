from __future__ import annotations

import contextlib
import http.server
import threading
import unittest
import urllib.request
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format: str, *args: object) -> None:
        pass


class LocalServer(http.server.ThreadingHTTPServer):
    allow_reuse_address = True


class HttpSmokeTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        handler = lambda *args, **kwargs: QuietHandler(  # noqa: E731
            *args, directory=str(ROOT), **kwargs
        )
        cls.server = LocalServer(("127.0.0.1", 0), handler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.base = f"http://127.0.0.1:{cls.server.server_port}"

    @classmethod
    def tearDownClass(cls) -> None:
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join(timeout=2)

    def fetch(self, path: str) -> tuple[int, str, bytes]:
        with contextlib.closing(urllib.request.urlopen(f"{self.base}{path}", timeout=3)) as response:
            return response.status, response.headers.get_content_type(), response.read()

    def test_home_and_companion_assets_are_served(self) -> None:
        cases = {
            "/?claire=1": "text/html",
            "/claire-lab.html": "text/html",
            "/claire-aidant-figma.html": "text/html",
            "/assets/js/claire-companion.js?v=20260830-live3": "text/javascript",
            "/assets/js/claire-runtime-v2.mjs": "text/javascript",
            "/assets/js/claire-site-adapter.mjs": "text/javascript",
            "/assets/js/claire-lab.js": "text/javascript",
            "/assets/css/claire-companion.css?v=20260830-live3": "text/css",
            "/assets/css/claire-lab.css": "text/css",
            "/data/site-knowledge.json?v=20260830-live3": "application/json",
            "/data/claire-capabilities.json": "application/json",
            "/assets/images/companion/claire-liveavatar-1080x1920.jpg": "image/jpeg",
        }
        for path, expected_type in cases.items():
            with self.subTest(path=path):
                status, content_type, body = self.fetch(path)
                self.assertEqual(status, 200)
                self.assertEqual(content_type, expected_type)
                self.assertGreater(len(body), 100)


if __name__ == "__main__":
    unittest.main()
