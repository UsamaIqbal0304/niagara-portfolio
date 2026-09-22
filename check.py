#!/usr/bin/env python3
"""check.py — verify the built site. Run after build.py, before committing.

Everything here is a check that has caught a real mistake on this site at
least once: a link to a page that was renamed, a title that Google would cut
in half, a page that lost its H1 when its body was rewritten, JSON-LD broken
by an unescaped quote. It reads the generated HTML only — it never imports
build.py, so it checks the output rather than agreeing with the generator.

Exits non-zero on any failure, so it can gate a commit.
"""
import glob
import html
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
ORIGIN = "https://plantroomlabs.com"

# Google renders roughly this much of each. Past it is not an error on the
# page, it is text nobody will ever see in a result.
TITLE_MAX = 60
DESC_MAX = 155

failures = []
checks = 0


def check(ok, label):
    global checks
    checks += 1
    if not ok:
        failures.append(label)


def pages():
    """Every generated HTML file, as (site path, source)."""
    for path in sorted(glob.glob(os.path.join(ROOT, "**", "*.html"), recursive=True)):
        rel = os.path.relpath(path, ROOT)
        if rel.startswith(("assets/", "brand/")):
            continue
        yield rel, open(path, encoding="utf-8").read()


def text_of(match):
    return html.unescape(re.sub(r"<[^>]+>", "", match)).strip()


docs = list(pages())
check(len(docs) >= 16, f"expected at least 16 pages, found {len(docs)}")

# Which paths exist, for link checking. A directory page is reachable both as
# "services/" and "services/index.html".
known = set()
for rel, _ in docs:
    known.add("/" + rel)
    if rel.endswith("index.html"):
        known.add("/" + rel[: -len("index.html")])

for rel, src in docs:
    demo = rel.startswith("demos/")
    noindex = 'name="robots" content="noindex' in src

    m = re.search(r"<title>(.*?)</title>", src, re.S)
    check(bool(m), f"{rel}: no <title>")
    if m:
        title = html.unescape(m.group(1))
        check(len(title) <= TITLE_MAX, f"{rel}: title {len(title)} chars > {TITLE_MAX}")
        check(title.strip() == title, f"{rel}: title has edge whitespace")

    m = re.search(r'<meta name="description" content="(.*?)">', src, re.S)
    check(bool(m), f"{rel}: no meta description")
    if m:
        desc = html.unescape(m.group(1))
        check(len(desc) <= DESC_MAX, f"{rel}: description {len(desc)} chars > {DESC_MAX}")

    # Demo pages are widget hosts inside an iframe: no H1, and noindex on
    # purpose, so the marketing page owns the ranking rather than its frame.
    if demo:
        check(noindex, f"{rel}: demo page is not noindex")
    else:
        h1 = re.findall(r"<h1[^>]*>(.*?)</h1>", src, re.S)
        check(len(h1) == 1, f"{rel}: {len(h1)} H1s, expected 1")
        # 404 is noindex on purpose: it is a response, not a page to rank.
        check(noindex == (rel == "404.html"), f"{rel}: wrong robots directive")
        canon = re.search(r'<link rel="canonical" href="([^"]+)"', src)
        check(bool(canon), f"{rel}: no canonical")
        if canon:
            check(canon.group(1).startswith(ORIGIN), f"{rel}: canonical is not absolute")

    check(bool(re.search(r'<html lang="en"[ >]', src)), f"{rel}: no lang on <html>")
    check('name="viewport"' in src, f"{rel}: no viewport meta")

    for block in re.findall(r'<script type="application/ld\+json">(.*?)</script>', src, re.S):
        try:
            json.loads(block)
        except json.JSONDecodeError as exc:
            check(False, f"{rel}: invalid JSON-LD ({exc})")
        else:
            checks += 1

    for href in re.findall(r'href="(/[^"#?]*)', src):
        check(href in known or os.path.exists(os.path.join(ROOT, href.lstrip("/"))),
              f"{rel}: broken internal link {href}")

    for img in re.findall(r"<img\b[^>]*>", src):
        check("alt=" in img, f"{rel}: <img> without alt: {img[:60]}")

# The sitemap has to list exactly the indexable pages: a page missing from it
# is a page nobody crawls, and a noindex page in it is a contradiction.
sitemap = open(os.path.join(ROOT, "sitemap.xml"), encoding="utf-8").read()
listed = set(re.findall(r"<loc>([^<]+)</loc>", sitemap))
indexable = {
    ORIGIN + "/" + (rel[: -len("index.html")] if rel.endswith("index.html") else rel)
    for rel, src in docs
    if 'content="noindex' not in src and rel != "404.html"
}
check(listed == indexable, f"sitemap mismatch: only in sitemap {sorted(listed - indexable)}, "
                           f"missing from sitemap {sorted(indexable - listed)}")

# Honesty constraints. These are claims the site must never make, and they
# are easier to re-introduce by accident than anyone expects.
banned = [
    (r"\bTridium (partner|certified|approved)\b", "implies Tridium affiliation"),
    # The site says out loud that there is no Marketplace listing, so the
    # phrase itself is fine; only an affirmative claim is not.
    (r"(listed|available|published|for sale) on (the )?Niagara Marketplace",
     "claims a Marketplace listing"),
    (r"\b(ISO ?9001|certified engineers?)\b", "no certifications held"),
    (r"\b4\.\d{1,2}\.\d", "pinned point version"),
]
for rel, src in docs:
    body = text_of(src)
    for pattern, why in banned:
        hit = re.search(pattern, body, re.I)
        check(not hit, f"{rel}: {why} — {hit.group(0) if hit else ''}")

print(f"{checks - len(failures)} passed, {len(failures)} failed, {len(docs)} pages")
for f in failures:
    print("  FAIL", f)
sys.exit(1 if failures else 0)
