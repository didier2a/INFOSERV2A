#!/usr/bin/env python3
"""Rebuild header/footer from partials, cache-bust assets, wrap brand name."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
ASSET_V = "20260901-mobile2"
BRAND = '<span class="brand-name">INFOSERV2A</span>'
HEADER_MARK_START = "<!-- chrome:header -->"
HEADER_MARK_END = "<!-- /chrome:header -->"
FOOTER_MARK_START = "<!-- chrome:footer -->"
FOOTER_MARK_END = "<!-- /chrome:footer -->"
STANDALONE_PAGES = {"claire-lab.html", "claire-aidant-figma.html"}

CURRENT = {
    "index.html": {"/"},
    "contact.html": {"contact.html"},
    "devis.html": {"devis.html"},
    "realisations.html": {"realisations.html"},
    "a-propos.html": {"a-propos.html"},
    "videosurveillance.html": {"videosurveillance.html"},
    "creation-site-web.html": {"creation-site-web.html"},
    "maintenance-distance.html": {"maintenance-distance.html"},
    "configuration-domicile.html": {"configuration-domicile.html"},
    "cybersecurite-ia.html": {"cybersecurite-ia.html"},
    "recuperation-donnees.html": {"recuperation-donnees.html"},
    "mentions-legales.html": {"mentions-legales.html"},
    "politique-confidentialite.html": {"politique-confidentialite.html"},
    "404.html": set(),
}

OFFRES = {
    "videosurveillance.html",
    "creation-site-web.html",
    "maintenance-distance.html",
    "configuration-domicile.html",
    "cybersecurite-ia.html",
    "recuperation-donnees.html",
}

SEO = {
    "contact.html": {
        "title": "Contact InfoServ2A — Porto-Vecchio, téléphone et WhatsApp",
        "description": "Contactez InfoServ2A à Porto-Vecchio : 07 45 15 60 76, contact@infoserv2a.pro, WhatsApp. Lundi au samedi, 9h-17h.",
    },
    "configuration-domicile.html": {
        "title": "Configuration à domicile — Porto-Vecchio | InfoServ2A",
        "description": "Configuration PC, Mac, Wi-Fi, box et objets connectés à domicile à Porto-Vecchio, de Solenzara à Bonifacio.",
    },
    "a-propos.html": {
        "title": "À propos d'InfoServ2A — Porto-Vecchio depuis 2010",
        "description": "Prestataire numérique à Porto-Vecchio depuis 2010 : vidéosurveillance, sites web, cybersécurité et IA en Corse-du-Sud.",
    },
    "devis.html": {
        "title": "Devis gratuit InfoServ2A — Porto-Vecchio",
        "description": "Devis gratuit à Porto-Vecchio : vidéosurveillance, site web, maintenance, cybersécurité ou récupération de données.",
    },
    "recuperation-donnees.html": {
        "title": "Récupération de données à Porto-Vecchio — InfoServ2A",
        "description": "Récupération de données à Porto-Vecchio : disque dur, SSD, clé USB, PC et Mac. Diagnostic avant intervention.",
    },
    "maintenance-distance.html": {
        "title": "Maintenance à distance — Corse-du-Sud | InfoServ2A",
        "description": "Dépannage à distance à Porto-Vecchio : Windows, Mac, Linux, Android et Apple. Intervention ponctuelle sur devis.",
    },
}


def patch_viewport(html: str) -> str:
    html = re.sub(
        r'<meta name="viewport" content="[^"]*">',
        '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">',
        html,
        count=1,
    )
    if 'name="mobile-web-app-capable"' not in html:
        html = html.replace(
            '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">',
            '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
            '  <meta name="mobile-web-app-capable" content="yes">\n'
            '  <meta name="apple-mobile-web-app-capable" content="yes">\n'
            '  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">',
            1,
        )
    return html


def apply_current(html: str, page: str) -> str:
    targets = CURRENT.get(page, set())

    def repl(match: re.Match[str]) -> str:
        tag = match.group(0)
        href = match.group(1)
        if 'class="brand"' in tag or "brand__logo" in tag:
            return re.sub(r'\saria-current="page"', "", tag)
        if href not in targets:
            return re.sub(r'\saria-current="page"', "", tag)
        if "aria-current=" in tag:
            return tag
        return tag[:-1] + ' aria-current="page">'

    html = re.sub(r'<a\s[^>]*href="([^"]+)"[^>]*>', repl, html)
    if page in OFFRES:
        html = html.replace(
            'class="nav-sub-toggle"',
            'class="nav-sub-toggle" aria-current="true"',
            1,
        )
    return html


def wrap_brand_text(html: str) -> str:
    html = re.sub(
        r'<span class="brand-name">INFOSERV2A</span>',
        "InfoServ2A",
        html,
    )
    html = re.sub(
        r'<strong class="brand-name">INFOSERV2A</strong>',
        "<strong>InfoServ2A</strong>",
        html,
    )
    out: list[str] = []
    i = 0
    in_tag = False
    while i < len(html):
        ch = html[i]
        if not in_tag:
            if ch == "<":
                in_tag = True
                out.append(ch)
                i += 1
                continue
            if html.startswith("InfoServ2A", i) or html.startswith("INFOSERV2A", i):
                token = "InfoServ2A" if html.startswith("InfoServ2A", i) else "INFOSERV2A"
                out.append(BRAND)
                i += len(token)
                continue
            out.append(ch)
            i += 1
            continue
        out.append(ch)
        if ch == ">":
            in_tag = False
        i += 1
    return "".join(out)


def cache_bust(html: str) -> str:
    html = re.sub(
        r'href="(assets/css/[^"]+\.css)(?:\?v=[^"]*)?"',
        rf'href="\1?v={ASSET_V}"',
        html,
    )
    html = re.sub(
        r'src="(assets/js/[^"]+\.js)(?:\?v=[^"]*)?"',
        rf'src="\1?v={ASSET_V}"',
        html,
    )
    return html


def ensure_companion_assets(html: str) -> str:
    css_path = "assets/css/claire-companion.css"
    js_path = "assets/js/claire-companion.js"
    if css_path not in html:
        responsive = re.compile(
            r'(<link rel="stylesheet" href="assets/css/responsive\.css(?:\?v=[^"]*)?">)'
        )
        if not responsive.search(html):
            raise SystemExit("responsive stylesheet link not found")
        html = responsive.sub(
            rf'\1\n  <link rel="stylesheet" href="{css_path}">',
            html,
            count=1,
        )
    if js_path not in html:
        if "</body>" not in html:
            raise SystemExit("body closing tag not found")
        html = html.replace(
            "</body>",
            f'  <script type="module" src="{js_path}"></script>\n</body>',
            1,
        )
    if "vendor/liveavatar/events-browser.mjs" not in html:
        if "</head>" not in html:
            raise SystemExit("head closing tag not found")
        html = html.replace(
            "</head>",
            '  <script type="importmap">{"imports":{"events":"./vendor/liveavatar/events-browser.mjs"}}</script>\n</head>',
            1,
        )
    return html


def patch_seo(html: str, page: str) -> str:
    data = SEO.get(page)
    if not data:
        return html
    html = re.sub(r"<title>.*?</title>", f"<title>{data['title']}</title>", html, count=1)
    html = re.sub(
        r'<meta name="description" content="[^"]*">',
        f'<meta name="description" content="{data["description"]}">',
        html,
        count=1,
    )
    html = re.sub(
        r'<meta property="og:title" content="[^"]*">',
        f'<meta property="og:title" content="{data["title"]}">',
        html,
        count=1,
    )
    html = re.sub(
        r'<meta property="og:description" content="[^"]*">',
        f'<meta property="og:description" content="{data["description"]}">',
        html,
        count=1,
    )
    html = re.sub(
        r'<meta name="twitter:title" content="[^"]*">',
        f'<meta name="twitter:title" content="{data["title"]}">',
        html,
        count=1,
    )
    html = re.sub(
        r'<meta name="twitter:description" content="[^"]*">',
        f'<meta name="twitter:description" content="{data["description"]}">',
        html,
        count=1,
    )
    return html


def replace_marked(html: str, start: str, end: str, inner: str) -> str | None:
    if start in html and end in html:
        pattern = re.compile(re.escape(start) + r".*?" + re.escape(end), re.S)
        block = start + "\n" + inner.rstrip() + "\n" + end + "\n"
        return pattern.sub(block, html, count=1)
    return None


def inject_header(html: str, header: str) -> str:
    updated = replace_marked(html, HEADER_MARK_START, HEADER_MARK_END, header)
    if updated is not None:
        return updated
    pattern = re.compile(r"<header class=\"site-header\">.*?</aside>\s*", re.S)
    block = HEADER_MARK_START + "\n" + header.rstrip() + "\n" + HEADER_MARK_END + "\n"
    if not pattern.search(html):
        raise SystemExit("header block not found")
    return pattern.sub(block, html, count=1)


def inject_footer(html: str, footer: str) -> str:
    updated = replace_marked(html, FOOTER_MARK_START, FOOTER_MARK_END, footer)
    if updated is not None:
        return updated
    pattern = re.compile(r"<div class=\"values-bar\">.*?</footer>\s*", re.S)
    block = FOOTER_MARK_START + "\n" + footer.rstrip() + "\n" + FOOTER_MARK_END + "\n"
    if not pattern.search(html):
        raise SystemExit("footer block not found")
    return pattern.sub(block, html, count=1)


def wrap_main(html: str) -> str:
    match = re.search(r"(<main\b[^>]*>)(.*?)(</main>)", html, re.S)
    if not match:
        return html
    return html[: match.start(2)] + wrap_brand_text(match.group(2)) + html[match.end(2) :]


def main() -> None:
    header_src = (ROOT / "partials" / "header.html").read_text(encoding="utf-8")
    footer_src = (ROOT / "partials" / "footer.html").read_text(encoding="utf-8")
    for path in sorted(ROOT.glob("*.html")):
        page = path.name
        html = path.read_text(encoding="utf-8")
        if page in STANDALONE_PAGES:
            html = patch_viewport(html)
            html = cache_bust(html)
            path.write_text(html, encoding="utf-8", newline="\n")
            print("updated", page)
            continue
        html = inject_header(html, apply_current(header_src, page))
        html = inject_footer(html, apply_current(footer_src, page))
        html = wrap_main(html)
        html = ensure_companion_assets(html)
        html = patch_viewport(html)
        html = cache_bust(html)
        html = patch_seo(html, page)
        path.write_text(html, encoding="utf-8", newline="\n")
        print("updated", page)


if __name__ == "__main__":
    main()
