#!/usr/bin/env python3
"""Local static server: real HTTP 404 for unknown paths, WebP MIME."""
from __future__ import annotations

import os
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__))


class InfoServHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def guess_type(self, path):
        lower = str(path).lower()
        if lower.endswith(".webp"):
            return "image/webp"
        if lower.endswith(".woff2"):
            return "font/woff2"
        if lower.endswith(".woff"):
            return "font/woff"
        return super().guess_type(path)

    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path == "/index.html":
            self.send_response(301)
            self.send_header("Location", "/")
            self.end_headers()
            return
        return super().do_GET()

    def do_HEAD(self):
        path = self.path.split("?", 1)[0]
        if path == "/index.html":
            self.send_response(301)
            self.send_header("Location", "/")
            self.end_headers()
            return
        return super().do_HEAD()

    def send_head(self):
        path = self.translate_path(self.path.split("?", 1)[0])
        if os.path.isdir(path):
            return super().send_head()
        if os.path.isfile(path):
            return super().send_head()
        return self._send_404()

    def _send_404(self):
        not_found = os.path.join(ROOT, "404.html")
        try:
            f = open(not_found, "rb")
        except OSError:
            self.send_error(404, "File not found")
            return None
        self.send_response(404)
        self.send_header("Content-type", "text/html; charset=utf-8")
        fs = os.fstat(f.fileno())
        self.send_header("Content-Length", str(fs.st_size))
        self.end_headers()
        return f


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    httpd = ThreadingHTTPServer(("0.0.0.0", port), InfoServHandler)
    print(f"Serving {ROOT} on http://127.0.0.1:{port}/")
    print(f"Sur le téléphone (même Wi-Fi) : http://<IP-du-PC>:{port}/")
    print("Relancer avec : python serve.py 8000")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")


if __name__ == "__main__":
    main()
