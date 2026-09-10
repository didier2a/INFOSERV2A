"""Local design preview; no credentials, outbound calls, mail or live avatar.

Run: python preview_mediterranee.py 8016
The production Worker and its bindings remain unchanged.
"""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit, unquote
import json
import sys

ROOT = Path(__file__).resolve().parent
PUBLIC_PAGES = {
    'index.html', 'maintenance-distance.html', 'reseaux-wifi.html',
    'videosurveillance.html', 'creation-site-web.html', 'claire.html',
    'a-propos.html', 'contact.html', 'devis.html', 'configuration-domicile.html',
    'cybersecurite-ia.html', 'recuperation-donnees.html', 'realisations.html',
    'mentions-legales.html', 'politique-confidentialite.html', '404.html',
}
PUBLIC_FILES = {
    'favicon.ico', 'apple-touch-icon.png', 'site.webmanifest',
    'data/site-knowledge.json', 'data/claire-capabilities.json',
    'vendor/liveavatar/events-browser.mjs',
    'docs/validation-mediterranee/galerie.html',
}
ASSET_SUFFIXES = {'.css', '.js', '.mjs', '.svg', '.png', '.jpg', '.jpeg',
                  '.webp', '.ico', '.woff', '.woff2'}


def public_target(target):
    relative = target.relative_to(ROOT)
    name = relative.as_posix()
    return (name in PUBLIC_PAGES or name in PUBLIC_FILES
            or (relative.parts[0] == 'assets' and target.suffix in ASSET_SUFFIXES)
            or (relative.parent.as_posix() == 'docs/validation-mediterranee/captures'
                and target.suffix == '.png'))


PREVIEW_SCRIPT = b'''(() => {
  const originalFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input.url, location.href);
    if (url.origin !== location.origin && url.pathname.startsWith('/api/liveavatar-')) {
      return Promise.resolve(new Response(JSON.stringify({configured:false, preview:true}), {status:200,headers:{'Content-Type':'application/json'}}));
    }
    return originalFetch(input, init);
  };
  try {
    if (!sessionStorage.getItem('infoserv2a.claire.mode')) {
      sessionStorage.setItem('infoserv2a.claire.mode','manual');
      sessionStorage.setItem('infoserv2a.claire.seen','1');
    }
  } catch {}
  document.addEventListener('DOMContentLoaded', () => {
    const note = document.createElement('p');
    note.id = 'med-local-preview';
    note.textContent = 'Apercu local : formulaires simules, aucun e-mail envoye. Claire en mode local, sans voix ni video en direct.';
    note.style.cssText = 'margin:0;padding:7px 4%;font:13px/1.4 Segoe UI,sans-serif;background:#e6efec;color:#13333d';
    document.querySelector('.site-footer')?.append(note);
  });
})();'''

class PreviewHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        self.send_header('X-Robots-Tag', 'noindex, nofollow, noarchive')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Referrer-Policy', 'no-referrer')
        self.send_header('Permissions-Policy', 'microphone=(), camera=()')
        self.send_header('Content-Security-Policy',
                         "default-src 'self'; connect-src 'self'; "
                         "script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; "
                         "img-src 'self' data:; font-src 'self'; media-src 'self' blob:; "
                         "object-src 'none'; base-uri 'self'; form-action 'self'")
        super().end_headers()

    def reply(self, body, content_type='application/json; charset=utf-8', status=200, head=False):
        self.send_response(status)
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        if not head:
            self.wfile.write(body)

    def do_GET(self):
        self.serve_preview()

    def do_HEAD(self):
        self.serve_preview(head=True)

    def serve_preview(self, head=False):
        route = unquote(urlsplit(self.path).path)
        if route == '/__preview.js':
            return self.reply(PREVIEW_SCRIPT, 'text/javascript; charset=utf-8', head=head)
        if route.startswith('/api/liveavatar-'):
            return self.reply(b'{"configured":false,"preview":true}', head=head)
        target = (ROOT / route.lstrip('/')).resolve()
        if not target.is_relative_to(ROOT) or any(part.startswith('.') or part == '_references' for part in target.relative_to(ROOT).parts):
            return self.send_error(404)
        if target == ROOT:
            target = ROOT / 'index.html'
        elif not target.suffix and target.with_suffix('.html').is_file():
            target = target.with_suffix('.html')
        if not target.is_file() or not public_target(target):
            return self.send_error(404)
        if target.suffix == '.html' and target.is_file():
            html = target.read_text(encoding='utf-8').replace('<head>', '<head>\n<script src="/__preview.js"></script>', 1)
            return self.reply(html.encode('utf-8'), 'text/html; charset=utf-8', head=head)
        return self.reply(target.read_bytes(), self.guess_type(str(target)), head=head)

    def do_POST(self):
        if urlsplit(self.path).path != '/api/send-email':
            return self.reply(b'{"sent":false,"configured":false,"preview":true}', status=503)
        try:
            size = int(self.headers.get('Content-Length', '0'))
            if size < 0 or size > 65536:
                return self.send_error(413)
            payload = json.loads(self.rfile.read(size))
            if not isinstance(payload, dict):
                return self.send_error(400)
        except (ValueError, UnicodeDecodeError):
            return self.send_error(400)
        result = {'sent': False, 'simulated': True, 'configured': False,
                  'inbox': payload.get('email', ''), 'replyTo': 'contact@infoserv2a.pro',
                  'message': 'Simulation locale. Aucun e-mail envoye.'}
        self.reply(json.dumps(result).encode('utf-8'))

if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8016
    server = ThreadingHTTPServer(('127.0.0.1', port), PreviewHandler)
    print(f'Preview: http://127.0.0.1:{port}', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.server_close()
