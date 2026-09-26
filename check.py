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

# A page that moved leaves a stub behind: a zero-delay meta refresh and a
# canonical at the destination. It is a real file and a real link target, but
# it is not a page — no sitemap entry, no analytics beacon, and its canonical
# points somewhere else on purpose.
redirects = {rel: re.search(r'<link rel="canonical" href="([^"]+)"', src).group(1)
             for rel, src in docs
             if 'http-equiv="refresh"' in src and 'canonical' in src}
check(all('http-equiv="refresh"' not in src or rel in redirects for rel, src in docs),
      "a meta refresh page with no canonical — a redirect to nowhere Google can follow")

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

    # A redirect stub is checked for the one thing that matters: that it
    # actually lands somewhere, and not on itself.
    if rel in redirects:
        dest = redirects[rel]
        check(dest.startswith(ORIGIN), f"{rel}: redirect canonical is not absolute")
        path = dest[len(ORIGIN):]
        check(path in known, f"{rel}: redirects to {path}, which this build does not produce")
        check(path != "/" + rel[: -len("index.html")], f"{rel}: redirects to itself")
        m2 = re.search(r'<meta http-equiv="refresh" content="0; url=([^"]+)"', src)
        check(bool(m2) and m2.group(1) == path,
              f"{rel}: refresh target and canonical disagree")
        continue

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

# Every nav item carries the viewport width it is hidden below, and the rule
# that hides it lives in the stylesheet. A threshold set in build.py with no
# matching media query is a link that never drops and pushes the bar off the
# right edge — invisible until someone opens the site on a phone.
css = open(os.path.join(ROOT, "assets", "css", "plantroom.css"), encoding="utf-8").read()
styled = set(re.findall(r"\.pl-nav__item--drop-(\d+)", css))
for rel, src_html in docs:
    for w in set(re.findall(r"pl-nav__item--drop-(\d+)", src_html)):
        check(w in styled, f"{rel}: nav drop width {w} has no CSS rule")

# The sitemap has to list exactly the indexable pages: a page missing from it
# is a page nobody crawls, and a noindex page in it is a contradiction.
sitemap = open(os.path.join(ROOT, "sitemap.xml"), encoding="utf-8").read()
listed = set(re.findall(r"<loc>([^<]+)</loc>", sitemap))
indexable = {
    ORIGIN + "/" + (rel[: -len("index.html")] if rel.endswith("index.html") else rel)
    for rel, src in docs
    if 'content="noindex' not in src and rel != "404.html" and rel not in redirects
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

# The one measured exhibit on the site quotes a real scan of a real vendor's
# published catalogue. Three things have to stay true together or it stops
# being an honest exhibit: the vendor stays unnamed, the reader is told they
# are not a client, and the counts still add up to the set that was scanned.
for rel, src in docs:
    body = text_of(src)
    if "18 third-party jars" not in body:
        continue
    check("not a client" in body,
          f"{rel}: scan exhibit dropped the 'not a client' disclaimer")
    check("10 of 18" in body and "8 of 18" in body,
          f"{rel}: scan exhibit counts no longer say 10 of 18 and 8 of 18")
    check("OneSightSolutions" not in body and "ossRestApiServer" not in body,
          f"{rel}: scan exhibit names the vendor it says it does not name")

# Third-party requests. The only one this site is allowed to make is the
# cookieless analytics beacon — anything else appearing here means a script
# got pasted in that puts a visitor's browser in touch with someone we have
# not told them about, which on a site with no consent banner is a promise
# broken rather than a tidiness problem.
ALLOWED_THIRD_PARTY = {"static.cloudflareinsights.com", ORIGIN.split("//", 1)[1]}
beaconed, unbeaconed = [], []
for rel, src in docs:
    for host in set(re.findall(r'<(?:script|link|img)[^>]+(?:src|href)="https?://([^/"]+)', src)):
        check(host in ALLOWED_THIRD_PARTY,
              f"{rel}: loads a third-party resource from {host}")
    beacon = 'data-cf-beacon' in src
    if beacon:
        check('src="https://static.cloudflareinsights.com/beacon.min.js" defer' in src
              or 'defer src="https://static.cloudflareinsights.com/beacon.min.js"' in src,
              f"{rel}: analytics beacon is not deferred")
    # The demo frames are iframed by /work/, so a beacon in them would count
    # one visit twice. Every page a visitor can land on is either counted or
    # none of them are — a half-instrumented site produces numbers nobody can
    # act on.
    if 'content="noindex' in src or rel in redirects:
        continue
    (beaconed if beacon else unbeaconed).append(rel)
check(not beaconed or not unbeaconed,
      f"analytics beacon on some indexable pages but not others: missing from {unbeaconed[:3]}")

# IndexNow key files. The protocol validates the key by fetching /<key>.txt and
# reading it back, so a key renamed in build.py without its file republished is
# a 403 and a whole batch dropped with no error anywhere we would see it. Every
# *.txt at the root that is named like a key has to contain its own name.
keyfiles = [f for f in glob.glob(os.path.join(ROOT, "*.txt"))
            if re.fullmatch(r"[0-9a-f]{8,128}", os.path.basename(f)[:-4] or "")]
check(bool(keyfiles), "no IndexNow key file at the site root")
for f in keyfiles:
    key = os.path.basename(f)[:-4]
    check(open(f, encoding="utf-8").read().strip() == key,
          f"{os.path.basename(f)}: does not contain its own key")

# The machine-readable layer: llms.txt, llms-full.txt and a markdown twin per
# note. An answer engine that fetches the markdown instead of the HTML has to
# get the same page, and a link into this layer that 404s is worse than not
# publishing it at all.
check(os.path.exists(os.path.join(ROOT, ".nojekyll")),
      ".nojekyll missing — GitHub Pages would run Jekyll and swallow the note .md files")

llms = open(os.path.join(ROOT, "llms.txt"), encoding="utf-8").read()
llms_full = open(os.path.join(ROOT, "llms-full.txt"), encoding="utf-8").read()
robots = open(os.path.join(ROOT, "robots.txt"), encoding="utf-8").read()

# "## Optional" is the one heading llmstxt.org gives a defined meaning to
# (skippable when the context window is short), so it has to stay spelled
# exactly that way to mean anything.
check("\n## Optional\n" in llms, "llms.txt: no '## Optional' section")
for f in ("llms.txt", "llms-full.txt"):
    check(ORIGIN + "/" + f in robots, f"robots.txt does not point at {f}")

note_pages = [(rel, src) for rel, src in docs if rel.startswith("notes/") and rel != "notes/index.html"]
check(len(note_pages) >= 6, f"expected at least 6 notes, found {len(note_pages)}")

for rel, src in note_pages:
    slug = rel[: -len("/index.html")]
    md_path = os.path.join(ROOT, slug + ".md")
    check(os.path.exists(md_path), f"{rel}: no markdown twin at /{slug}.md")
    if not os.path.exists(md_path):
        continue
    md = open(md_path, encoding="utf-8").read()
    h1 = text_of(re.search(r"<h1[^>]*>(.*?)</h1>", src, re.S).group(1))

    # The head advertises it, so an agent finds the markdown without having to
    # know the convention.
    check(f'<link rel="alternate" type="text/markdown" href="/{slug}.md"' in src,
          f"{rel}: head does not advertise its markdown twin")

    check(md.startswith("# " + h1 + "\n"), f"{slug}.md: first line is not the page H1")
    check(f"Source: {ORIGIN}/{slug}/" in md, f"{slug}.md: no Source line back to the HTML")
    # Every H2 in the note body has to survive the conversion, or the markdown
    # is a different, shorter document wearing the same title. Everything from
    # the "Related" block down is page furniture, not the note.
    body = src.split('<p class="pl-eyebrow">Related</p>')[0]
    heads = [text_of(h) for h in re.findall(r"<h2[^>]*>(.*?)</h2>", body, re.S)]
    check(len(heads) >= 2, f"{slug}: note body has {len(heads)} H2s, expected at least 2")
    for h2 in heads:
        check("\n## " + h2 + "\n" in md, f"{slug}.md: missing section '{h2}'")
    leftover = re.search(r"</(p|li|h2|h3|div|table)>|<(div|p|h2|h3|ul|table)\b", md)
    check(not leftover, f"{slug}.md: unconverted HTML — {leftover.group(0) if leftover else ''}")

    # Every section is addressable, and the contents list at the top points at
    # ids that exist. A contents entry aimed at a missing id is a dead link
    # that nothing else on the page would reveal.
    ids = re.findall(r'<h2 id="([^"]+)"', body)
    check(len(ids) == len(heads), f"{slug}: {len(heads) - len(ids)} section heading(s) with no id")
    check(len(set(ids)) == len(ids), f"{slug}: duplicate section ids")
    for target in re.findall(r'<nav class="pl-toc".*?</nav>', src, re.S):
        for want in re.findall(r'href="#([^"]+)"', target):
            check(want in ids, f"{slug}: contents links to #{want}, which is not a section")

    check("# " + h1 + "\n" in llms_full, f"llms-full.txt: does not contain '{h1}'")
    check(f"{ORIGIN}/{slug}.md" in llms, f"llms.txt: no markdown URL for {slug}")

# Nothing in either file may point at a URL this build did not produce.
for name, text in (("llms.txt", llms), ("llms-full.txt", llms_full)):
    for u in sorted(set(re.findall(r"https://plantroomlabs\.com(/[^\s)>,;]*)", text))):
        u = u.rstrip(".")
        ok = u in known or os.path.exists(os.path.join(ROOT, u.lstrip("/")))
        check(ok, f"{name}: links to {u}, which this build does not produce")

print(f"{checks - len(failures)} passed, {len(failures)} failed, {len(docs)} pages")
for f in failures:
    print("  FAIL", f)
sys.exit(1 if failures else 0)
