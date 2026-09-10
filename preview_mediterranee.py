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
        if target.suffix == '.html' and target.is_file():
            html = target.read_text(encoding='utf-8').replace('<head>', '<head>\n<script src="/__preview.js"></script>', 1)
            return self.reply(html.encode('utf-8'), 'text/html; charset=utf-8', head=head)
        if target.is_dir():
            return self.send_error(404)
        return super().do_HEAD() if head else super().do_GET()

    def do_POST(self):
        if urlsplit(self.path).path != '/api/send-email':
            return self.reply(b'{"sent":false,"configured":false,"preview":true}', status=503)
        size = int(self.headers.get('Content-Length', '0'))
        if size > 65536:
            return self.send_error(413)
        try:
            payload = json.loads(self.rfile.read(size))
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
