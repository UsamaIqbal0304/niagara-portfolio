#!/usr/bin/env python3
"""indexnow.py — tell the participating engines what actually changed.

Run after build.py and check.py, once the change is live. IndexNow is not a
sitemap: it is a "this URL changed" ping, and the protocol answers 429 to
what it reads as spam. Resubmitting all 41 URLs on every deploy is exactly
what that is for, so this submits only the pages whose bytes differ from the
last submission.

State lives in .indexnow-state.json: url -> sha256 of the file that was live
when it was last submitted. Delete it to force a full resubmission.

    python3 indexnow.py           # submit what changed
    python3 indexnow.py --all     # submit everything, ignoring state
    python3 indexnow.py --dry-run # print what would go, submit nothing
    python3 indexnow.py --mark-sent  # record the current build as submitted

One POST reaches every participating engine — Bing, Yandex, Seznam and the
rest agree to share submissions, so there is nothing to do per engine.
Google does not participate at all; it gets the sitemap and nothing else.
"""
import hashlib
import json
import os
import re
import sys
import urllib.error
import urllib.request

ROOT = os.path.dirname(os.path.abspath(__file__))
ORIGIN = "https://plantroomlabs.com"
HOST = ORIGIN.split("//", 1)[1]
STATE = os.path.join(ROOT, ".indexnow-state.json")
ENDPOINT = "https://api.indexnow.org/IndexNow"

# Must match INDEXNOW_KEY in build.py. Read from the published file rather
# than duplicated here, so the two cannot drift apart silently.
def current_key():
    keys = [os.path.basename(f)[:-4] for f in os.listdir(ROOT)
            if f.endswith(".txt") and re.fullmatch(r"[0-9a-zA-Z-]{8,128}", f[:-4])]
    build = open(os.path.join(ROOT, "build.py"), encoding="utf-8").read()
    m = re.search(r'^INDEXNOW_KEY = "([^"]+)"', build, re.M)
    if not m:
        sys.exit("build.py: no INDEXNOW_KEY")
    if m.group(1) not in keys:
        sys.exit(f"{m.group(1)}.txt is not published — submitting would 403")
    return m.group(1)


def live_pages():
    """(url, sha256) for every URL in the sitemap, from the built files."""
    sitemap = open(os.path.join(ROOT, "sitemap.xml"), encoding="utf-8").read()
    for u in re.findall(r"<loc>([^<]+)</loc>", sitemap):
        rel = u[len(ORIGIN):].lstrip("/")
        path = os.path.join(ROOT, rel, "index.html") if rel else os.path.join(ROOT, "index.html")
        if not os.path.exists(path):
            sys.exit(f"sitemap lists {u}, which this build did not produce — run build.py")
        yield u, hashlib.sha256(open(path, "rb").read()).hexdigest()


def main():
    force = "--all" in sys.argv
    dry = "--dry-run" in sys.argv
    key = current_key()

    # For a batch that went out by hand: adopt the current build as the
    # submitted state without posting it again. Submitting the same 41 URLs
    # twice in an hour is what 429 is for.
    if "--mark-sent" in sys.argv:
        json.dump(dict(live_pages()), open(STATE, "w"), indent=1, sort_keys=True)
        print(f"state written without submitting: {STATE}")
        return

    state = {} if force else (json.load(open(STATE)) if os.path.exists(STATE) else {})

    now = dict(live_pages())
    changed = sorted(u for u, h in now.items() if state.get(u) != h)
    gone = sorted(set(state) - set(now))
    for u in gone:
        print(f"  dropped from the sitemap: {u}")

    if not changed:
        print("nothing changed since the last submission")
        return
    print(f"{len(changed)} changed of {len(now)}:")
    for u in changed:
        print("  " + u)
    if dry:
        return

    payload = json.dumps({
        "host": HOST, "key": key, "keyLocation": f"{ORIGIN}/{key}.txt",
        "urlList": changed,
    }).encode()
    req = urllib.request.Request(
        ENDPOINT, data=payload,
        headers={"Content-Type": "application/json; charset=utf-8"})
    try:
        resp = urllib.request.urlopen(req, timeout=60)
    except urllib.error.HTTPError as exc:
        # 403 is the key file; 422 is a URL on the wrong host; 429 is us
        # submitting too often. None of them are retryable by hammering.
        sys.exit(f"IndexNow {exc.code}: {exc.read().decode()[:300]}")
    # 200 means the key was checked and passed. 202 means accepted with the
    # key check still pending — normal the first time a new key is used.
    print(f"IndexNow {resp.status} {resp.reason}")
    if resp.status not in (200, 202):
        sys.exit(1)

    state = dict(now)
    json.dump(state, open(STATE, "w"), indent=1, sort_keys=True)
    print(f"state written: {STATE}")


if __name__ == "__main__":
    main()
