# Traffic and ranking for plantroomlabs.com

Three questions, three tools. All three were switched on between 23 and 25
September 2026; this file records what was done and where the numbers now come
from, so nobody repeats the setup or goes looking for a dashboard that has an
API.

| Question | Tool | State |
|---|---|---|
| How many people came, from where, to which page | Cloudflare Web Analytics | live since 23 Sep — beacon token in `build.py` |
| What searches the site appears in, and its position | Google Search Console | verified 23 Sep by DNS TXT; API access via service account |
| The same, for Bing / DuckDuckGo / ChatGPT search | Bing Webmaster Tools | imported from Search Console 24 Sep; API key issued 25 Sep |

Nothing here tracks a person. The beacon is cookieless and stores nothing about
the visitor, which is why the site carries no consent banner — adding a tool
that needs one would mean adding a banner too, and a banner costs more visitors
than the extra data is worth.

All three are readable without opening a dashboard: the `plantroom-site` MCP
server (`~/mcp-servers/plantroom-site/`, credentials in `~/.secrets/`) exposes
`cf_traffic` / `cf_top`, `gsc_performance` / `gsc_inspect` and `bing_*`.

## 1 — Cloudflare Web Analytics (the visitor count)

Free, no event cap, and it does **not** require moving the domain's DNS to
Cloudflare — the nameservers stay at Squarespace exactly as `DNS.md` describes.
The account holds nothing else: no zone, no R2, no proxying.

Set up 23 Sep: Analytics & Logs → Web Analytics → Add site → JS beacon. The
32-character token from the snippet is `ANALYTICS_TOKEN` in `build.py`;
`check.py` asserts the beacon is `defer`red and present on every indexable
page or none. Reports: visits, page views, top pages, referrers, countries,
device and browser mix, Core Web Vitals from real visitors.

First 48 hours: 145 page views, 47 visits, 110 of them on `/` — nearly all the
owner checking the deploy. Treat the first month's numbers as a noise floor.

## 2 — Google Search Console (the ranking data)

The only place useful numbers live: which queries the site was shown for,
how many times, how many clicks, average position. Also how you tell Google
about a new page rather than waiting.

Verified 23 Sep as a **Domain** property (`sc-domain:plantroomlabs.com`) by a
TXT record at Squarespace, so `VERIFY["google-site-verification"]` in
`build.py` stays empty on purpose — the DNS record is the proof, and it covers
`www` too. `sitemap.xml` was submitted the same day.

API access is a GCP service account (`claude@encoded-yen-509622-n5`, key in
`~/.secrets/gsc-service-account.json`) added as a user on the property, which
needs no OAuth consent flow. Data lags about two days behind the UI.

**URL Inspection → Request indexing** pushes a single page to the front of the
queue. Worth doing for the home page and `/work/` on the day of a real change;
it is rate-limited, so not for every note.

## 3 — Bing Webmaster Tools (and, through it, ChatGPT and DuckDuckGo)

Worth having because Bing's index is what DuckDuckGo and several AI answer
engines read. Imported from Search Console on 24 Sep, which carried the
sitemap across and proved ownership without a meta tag — `VERIFY["msvalidate.01"]`
also stays empty. Site verification completed on 25 Sep. An API key was
issued the same day; it lives in `~/.secrets/bing.env` and is passed as a
query parameter, never in a header.

Bing also runs **IndexNow**. The key Bing issued
(`627f5d4b61ae4766935982388964b259`) is `INDEXNOW_KEY` in `build.py`; the
earlier self-issued key stays published under `INDEXNOW_RETIRED` because key
validation is asynchronous and an unpublished key file silently drops the
batch. `indexnow.py` submits only URLs whose bytes changed since the last
run — resubmitting all 41 on every deploy earned `429 (potential Spam)` on
day two. `200` means accepted and validated, `202` accepted with validation
pending. It reaches Bing, DuckDuckGo, Yandex and Seznam. Google does not
participate — for Google, use Search Console.

## 4 — What actually moves the ranking

Verification and sitemaps get the site indexed. They do not get it ranked.
What ranks a site this size, in this order:

1. **Pages that answer a specific question.** `/notes/` is the whole strategy:
   each note targets one long-tail query a Niagara engineer actually types,
   and nobody else has written the answer down. Thirty notes is a knowledge
   base; the next ones should come from questions real enquiries ask.
2. **Being linked to.** A link from the Niagara Community forum, Reddit
   r/BuildingAutomation, or a LinkedIn post that is worth reading, is worth
   more than any on-page change left to make here. Answer a question in
   public, link the note that expands on it.
3. **Being the same practice everywhere.** The same name, the same one-line
   description and the same URL on LinkedIn, GitHub and any directory listing
   — the consistency is the signal.
4. **Speed and correctness**, which are already done and worth keeping: every
   page is static, self-hosted fonts, no third-party scripts, one 5 KB
   stylesheet, valid JSON-LD on every page, and `check.py` gating all of it.

The one thing that is *not* worth doing is buying links or spinning out
keyword pages. This market is small enough that the buyers are also the
people who would notice.

## 5 — Checking it without any of the above

`check.py` already verifies the parts of SEO that are mechanical: title and
description lengths against what Google renders, canonical URLs, JSON-LD
validity, sitemap completeness, internal links, and the machine-readable
`llms.txt` / `llms-full.txt` / per-note markdown layer. Run it before every
commit. It is not a substitute for the two accounts above — it checks that
the site is legible, not that anyone is reading it.
