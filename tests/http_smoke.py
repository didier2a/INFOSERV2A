from __future__ import annotations

import contextlib
import http.server
import json
import threading
import unittest
import urllib.request
from urllib.error import HTTPError
from pathlib import Path

from preview_mediterranee import PreviewHandler


ROOT = Path(__file__).resolve().parent.parent


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format: str, *args: object) -> None:
        pass


class LocalServer(http.server.ThreadingHTTPServer):
    allow_reuse_address = True


class QuietPreviewHandler(PreviewHandler):
    def log_message(self, format: str, *args: object) -> None:
        pass


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
            "/assets/images/logo/infoserv2a-logo-light.png": "image/png",
        }
        for path, expected_type in cases.items():
            with self.subTest(path=path):
                status, content_type, body = self.fetch(path)
                self.assertEqual(status, 200)
                self.assertEqual(content_type, expected_type)
                self.assertGreater(len(body), 100)

    def test_production_sources_do_not_expose_claire_offer(self) -> None:
        with self.assertRaises(HTTPError) as error:
            self.fetch("/claire-pour-votre-site.html")
        self.assertEqual(error.exception.code, 404)
        production_files = [
            "index.html",
            "partials/header.html",
            "partials/footer.html",
            "data/site-knowledge.json",
            "sitemap.xml",
        ]
        for relative in production_files:
            with self.subTest(relative=relative):
                source = (ROOT / relative).read_text(encoding="utf-8")
                self.assertNotIn("claire-pour-votre-site", source)
        assetsignore = (ROOT / ".assetsignore").read_text(encoding="utf-8")
        self.assertIn("preview_mediterranee.py", assetsignore.splitlines())


class MediterraneePreviewTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.server = LocalServer(("127.0.0.1", 0), QuietPreviewHandler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.base = f"http://127.0.0.1:{cls.server.server_port}"

    @classmethod
    def tearDownClass(cls) -> None:
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join(timeout=2)

    def fetch(self, path: str) -> tuple[int, str, bytes, str | None]:
        with contextlib.closing(
            urllib.request.urlopen(f"{self.base}{path}", timeout=3)
        ) as response:
            return (
                response.status,
                response.headers.get_content_type(),
                response.read(),
                response.headers.get("X-InfoServ2A-Preview-Only"),
            )

    def test_preview_serves_integrated_claire_offer(self) -> None:
        status, content_type, body, preview_header = self.fetch(
            "/claire-pour-votre-site.html"
        )
        html = body.decode("utf-8")
        self.assertEqual(status, 200)
        self.assertEqual(content_type, "text/html")
        self.assertEqual(preview_header, "mediterranee")
        self.assertIn(
            'href="claire-pour-votre-site.html" aria-current="page"',
            html,
        )
        self.assertIn("assets/images/logo/infoserv2a-logo-light.png", html)
        self.assertIn("690 € setup", html)
        self.assertIn("1 190 € setup", html)
        self.assertIn("Sur-mesure", html)
        self.assertIn('id="parcours"', html)
        self.assertIn('id="demo"', html)
        self.assertNotIn("mock-banner", html)
        self.assertNotIn(">MAQUETTE<", html)

    def test_preview_injects_tab_and_catalog_entry(self) -> None:
        _, _, home_body, _ = self.fetch("/")
        self.assertIn(
            'href="claire-pour-votre-site.html">Claire pour votre site</a>',
            home_body.decode("utf-8"),
        )
        _, content_type, knowledge_body, preview_header = self.fetch(
            "/data/site-knowledge.json"
        )
        knowledge = json.loads(knowledge_body)
        self.assertEqual(content_type, "application/json")
        self.assertEqual(preview_header, "mediterranee")
        self.assertEqual(len(knowledge["pages"]), 16)
        self.assertEqual(knowledge["pages"][-1]["id"], "claire-offer-preview")


if __name__ == "__main__":
    unittest.main()
