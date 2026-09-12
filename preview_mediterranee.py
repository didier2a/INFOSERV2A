"""Local design preview; no credentials, outbound calls, mail or live avatar.

Run: python preview_mediterranee.py 8016
The production Worker and its bindings remain unchanged.
"""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit, unquote
import json
import re
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
CLAIRE_OFFER_ROUTES = {
    '/claire-pour-votre-site',
    '/claire-pour-votre-site.html',
}

# This offer exists only in this local response-time preview. This Python file
# is excluded by .assetsignore, and no static production HTML route is created.
CLAIRE_OFFER_STYLE = """
<style id="med-claire-offer-preview">
.med-claire-offer-hero{grid-template-columns:1.05fr .95fr;padding-block:28px 34px}
.med-claire-stage{min-height:440px;margin:0;padding:28px;display:grid;place-items:center;overflow:hidden;border-radius:18px;background:linear-gradient(145deg,#dcebe4,var(--med-blue))}
.med-claire-phone{width:min(260px,70%);aspect-ratio:9/16;position:relative;overflow:hidden;border:3px solid rgba(255,255,255,.55);border-radius:28px;background:#0b1216;box-shadow:0 24px 60px rgba(0,0,0,.28)}
.med-claire-phone img{width:100%;height:100%;object-fit:cover;object-position:center top}
.med-claire-phone figcaption{position:absolute;inset:auto 0 0;padding:42px 14px 22px;color:#fff;background:linear-gradient(transparent,rgba(0,0,0,.78));font-size:14px;font-weight:650;text-align:center}
.med-claire-demo-link{display:inline-flex;gap:7px;margin-top:14px;color:var(--med-blue);font-weight:650;text-decoration:underline;text-underline-offset:4px}
.med-offer-cards .med-card{display:flex;flex-direction:column;background:#fffdf9}
.med-offer-cards .med-card>p:not(.med-price){color:var(--med-muted)}
.med-price{margin-top:auto!important;padding-top:18px;color:var(--med-ink);font-size:28px!important;font-weight:750;letter-spacing:-.04em}
.med-price small{display:block;margin-top:4px;color:var(--med-muted);font-size:14px;font-weight:500;letter-spacing:0}
.med-offer-process{padding-top:0}
@container (max-width:740px){.med-claire-offer-hero{grid-template-columns:1fr}.med-claire-stage{min-height:400px;margin-top:18px}}
@container (max-width:450px){.med-claire-stage{min-height:370px;padding:20px}.med-claire-phone{width:min(220px,76%)}}
</style>
"""

CLAIRE_OFFER_MAIN = """
<main id="contenu" class="site-main med-main" tabindex="-1">
<nav class="med-breadcrumb" aria-label="Fil d’Ariane"><a href="/">Accueil</a> / Claire pour votre site</nav>
<section class="med-hero med-claire-offer-hero">
  <div class="med-hero__copy">
    <p class="med-eyebrow">Nouvelle offre · B2B local</p>
    <h1>Claire sur votre site.<br><em>Plein écran. En direct.</em></h1>
    <p class="med-intro">Une conseillère vidéo HD en 9:16 sur smartphone : elle répond à vos clients et vous envoie les demandes de contact. InfoServ2A l’installe pour vous — sans refaire tout votre site.</p>
    <div class="med-actions">
      <a class="med-button" href="#offres">Voir les formules <span aria-hidden="true">↗</span></a>
      <a class="med-button med-button--outline" href="https://claire-platform-dev.infoserv2a.workers.dev/demo-boulangerie.html" target="_blank" rel="noopener noreferrer">Voir la démo live</a>
    </div>
    <p class="med-audience">Commerces · artisans · PME · Sud Corse d’abord · ouverture nationale ensuite</p>
    <a class="med-claire-demo-link" href="https://claire-platform-dev.infoserv2a.workers.dev/embed/?tenant=boulangerie-soleil" target="_blank" rel="noopener noreferrer">Ouvrir Claire en plein écran (dogfood) <span aria-hidden="true">↗</span></a>
  </div>
  <figure class="med-claire-stage">
    <div class="med-claire-phone">
      <img src="assets/images/companion/claire-liveavatar-1080x1920.jpg" alt="Claire, conseillère vidéo, dans un aperçu mobile vertical 9:16" width="1080" height="1920" fetchpriority="high">
      <figcaption>Claire · plein écran 9:16</figcaption>
    </div>
  </figure>
</section>
<div class="med-values" aria-label="Avantages de l’offre">
  <p>Greffe sur votre site existant</p>
  <p>Expérience mobile native 9:16</p>
  <p>Leads envoyés chez vous</p>
</div>
<section class="med-section" id="offres">
  <div class="med-section-heading">
    <div><p class="med-eyebrow">Formules</p><h2>Simple à comprendre,<br><em>maîtrisable en minutes.</em></h2></div>
    <p>Tarifs indicatifs, à ajuster ensemble selon vos besoins et votre volume d’utilisation.</p>
  </div>
  <div class="med-cards med-offer-cards">
    <article class="med-card"><h3>Essentiel</h3><p>1 domaine, persona Claire, plein écran, prise de contact, support mail.</p><p class="med-price">690 € setup<small>129 € / mois · 60 min voix</small></p></article>
    <article class="med-card"><h3>Pro</h3><p>Plus de minutes, webhook / e-mail prioritaire, réglages persona avancés.</p><p class="med-price">1 190 € setup<small>249 € / mois · 180 min voix</small></p></article>
    <article class="med-card"><h3>Sur-mesure</h3><p>WebView app, multi-sites, intégration CRM, volume minutes dédié.</p><p class="med-price">Sur devis<small>Selon usage réel</small></p></article>
  </div>
</section>
<section class="med-section med-offer-process" id="parcours">
  <div class="med-section-heading">
    <div><p class="med-eyebrow">Comment ça se passe</p><h2>Installée par InfoServ2A,<br><em>pas un téléchargement.</em></h2></div>
    <p>Une offre relationnelle d’abord : on greffe, on teste, on livre.</p>
  </div>
  <ol class="med-method">
    <li><b>1</b><div><strong>Démo 15 min</strong><p>Vous voyez Claire en conditions réelles sur mobile.</p></div></li>
    <li><b>2</b><div><strong>Greffe sur votre domaine</strong><p>Snippet + configuration tenant. Votre site reste le vôtre.</p></div></li>
    <li><b>3</b><div><strong>Mise en service</strong><p>Abonnement + minutes incluses. Au-delà : facturation au forfait minutes.</p></div></li>
  </ol>
</section>
<section class="med-cta" id="demo">
  <div><h2>Prêt à greffer Claire ?</h2><p>Demandez une démo — installation par InfoServ2A, Sud Corse et au-delà.</p></div>
  <div class="med-actions"><a class="med-button" href="mailto:contact@infoserv2a.pro?subject=D%C3%A9mo%20Claire%20pour%20mon%20site">Demander une démo</a><a class="med-button med-button--outline" href="tel:+33745156076">Appeler</a></div>
</section>
</main>
"""

CLAIRE_OFFER_KNOWLEDGE = {
    "id": "claire-offer-preview",
    "href": "claire-pour-votre-site.html",
    "title": "Claire pour votre site",
    "summary": "Aperçu Méditerranée uniquement : InfoServ2A installe Claire sur les sites de commerces, artisans et PME.",
    "keywords": [
        "claire pour votre site",
        "claire sur mon site",
        "assistante vidéo",
        "conseillère vidéo",
        "offre claire",
    ],
    "anchors": [
        {"id": "offres", "label": "Formules Claire", "keywords": ["formules", "tarifs"]},
        {"id": "parcours", "label": "Installation de Claire", "keywords": ["installation", "greffe"]},
        {"id": "demo", "label": "Demander une démo", "keywords": ["démo", "démonstration"]},
    ],
}


def public_target(target):
    relative = target.relative_to(ROOT)
    name = relative.as_posix()
    return (name in PUBLIC_PAGES or name in PUBLIC_FILES
            or (relative.parts[0] == 'assets' and target.suffix in ASSET_SUFFIXES)
            or (relative.parent.as_posix() == 'docs/validation-mediterranee/captures'
                and target.suffix == '.png'))


def inject_claire_offer_tab(html, current=False):
    """Add the commercial tab to preview responses without editing source HTML."""
    if 'href="claire-pour-votre-site.html"' in html:
        return html
    if current:
        html = re.sub(r'\saria-current="page"', '', html)
    current_attr = ' aria-current="page"' if current else ''
    offer_link = (
        f'<a href="claire-pour-votre-site.html"{current_attr}>'
        'Claire pour votre site</a>'
    )
    return re.sub(
        r'(<a href="claire\.html"(?: aria-current="page")?>Claire</a>)',
        rf'\1{offer_link}',
        html,
    )


def add_preview_script(html):
    return html.replace(
        '<head>',
        '<head>\n<script src="/__preview.js"></script>',
        1,
    )


def render_claire_offer_page():
    """Build the preview-only page from the current production sibling chrome."""
    html = (ROOT / 'creation-site-web.html').read_text(encoding='utf-8')
    replacements = {
        r'<title>.*?</title>': '<title>Claire pour votre site — aperçu Méditerranée</title>',
        r'<meta name="description" content="[^"]*">': (
            '<meta name="description" content="Aperçu Méditerranée de '
            'l’offre B2B Claire pour votre site.">'
        ),
        r'<link rel="canonical" href="[^"]*">': (
            '<link rel="canonical" href="http://127.0.0.1:8016/'
            'claire-pour-votre-site.html">'
        ),
        r'<meta property="og:title" content="[^"]*">': (
            '<meta property="og:title" content="Claire pour votre site — '
            'aperçu Méditerranée">'
        ),
        r'<meta property="og:description" content="[^"]*">': (
            '<meta property="og:description" content="Aperçu local uniquement, '
            'non publié sur infoserv2a.pro.">'
        ),
        r'<meta property="og:url" content="[^"]*">': (
            '<meta property="og:url" content="http://127.0.0.1:8016/'
            'claire-pour-votre-site.html">'
        ),
        r'<meta name="twitter:title" content="[^"]*">': (
            '<meta name="twitter:title" content="Claire pour votre site — '
            'aperçu Méditerranée">'
        ),
        r'<meta name="twitter:description" content="[^"]*">': (
            '<meta name="twitter:description" content="Aperçu local uniquement, '
            'non publié sur infoserv2a.pro.">'
        ),
    }
    for pattern, replacement in replacements.items():
        html = re.sub(pattern, replacement, html, count=1, flags=re.S)
    html = re.sub(
        r'<main id="contenu"[^>]*>.*?</main>',
        CLAIRE_OFFER_MAIN.strip(),
        html,
        count=1,
        flags=re.S,
    )
    html = html.replace('</head>', f'{CLAIRE_OFFER_STYLE}</head>', 1)
    return add_preview_script(inject_claire_offer_tab(html, current=True))


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

    def reply(self, body, content_type='application/json; charset=utf-8',
              status=200, head=False, extra_headers=None):
        self.send_response(status)
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        for name, value in (extra_headers or {}).items():
            self.send_header(name, value)
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
        if route in CLAIRE_OFFER_ROUTES:
            body = render_claire_offer_page().encode('utf-8')
            return self.reply(
                body,
                'text/html; charset=utf-8',
                head=head,
                extra_headers={'X-InfoServ2A-Preview-Only': 'mediterranee'},
            )
        if route == '/data/site-knowledge.json':
            knowledge = json.loads(
                (ROOT / 'data/site-knowledge.json').read_text(encoding='utf-8')
            )
            knowledge['pages'].append(CLAIRE_OFFER_KNOWLEDGE)
            body = json.dumps(knowledge, ensure_ascii=False).encode('utf-8')
            return self.reply(
                body,
                head=head,
                extra_headers={'X-InfoServ2A-Preview-Only': 'mediterranee'},
            )
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
            html = add_preview_script(inject_claire_offer_tab(
                target.read_text(encoding='utf-8')
            ))
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
