# Traffic and ranking for plantroomlabs.com

Two different questions, answered by two different tools, and neither can be
switched on from this repo alone — both need an account in Usama's name. What
the repo already holds is the wiring: fill one string into `build.py`, run
`python3 build.py`, and the site starts reporting.

| Question | Tool | What it needs from you |
|---|---|---|
| How many people came, from where, to which page | Cloudflare Web Analytics | a free Cloudflare account, then one token pasted into `build.py` |
| What searches the site appears in, and at what position | Google Search Console | a Google account, then one token pasted into `build.py` |
| The same, for Bing / DuckDuckGo / ChatGPT search | Bing Webmaster Tools | can be imported from Search Console in two clicks |

Nothing here tracks a person. The beacon is cookieless and stores nothing
about a visitor, which is why the site carries no consent banner — adding a
tool that needs one would mean adding the banner too, and a banner costs more
visitors than the extra data is worth.

## 1 — Cloudflare Web Analytics (the visitor count)

Free, no event cap, and it does **not** require moving the domain's DNS to
Cloudflare. The nameservers stay at Squarespace exactly as `DNS.md` describes.

1. Sign up at <https://dash.cloudflare.com/sign-up>. No card, no domain
   transfer — do not accept any prompt to change nameservers.
2. In the left sidebar: **Analytics & Logs → Web Analytics**.
3. **Add a site**, hostname `plantroomlabs.com`. Choose the **JS beacon**
   option when asked (the alternative, "automatic setup", is the one that
   wants the domain proxied through Cloudflare — that is the one to avoid).
4. It shows a `<script>` snippet containing
   `data-cf-beacon='{"token": "…"}'`. Copy the **token only** — 32 hex
   characters, not the whole snippet.
5. In `build.py`, set:

   ```python
   ANALYTICS_TOKEN = "paste_the_32_characters_here"
   ```

6. `python3 build.py && python3 check.py`, then commit and push. Data starts
   appearing within a few minutes of the first visit; the dashboard is at
   Web Analytics → plantroomlabs.com.

What it reports: visits, page views, top pages, referrers, countries, device
and browser mix, and Core Web Vitals from real visitors.

## 2 — Google Search Console (the ranking data)

This is the only place the useful numbers live: which queries the site was
shown for, how many times, how many clicks, and the average position. It is
also how you tell Google about a new page rather than waiting.

1. Go to <https://search.google.com/search-console> and sign in.
2. **Add property → URL prefix**, and enter `https://plantroomlabs.com/`
   exactly, with the trailing slash. (The "Domain" option verifies by DNS at
   Squarespace and covers subdomains too — either works; URL prefix is the
   one this repo can verify for you.)
3. Choose the **HTML tag** verification method. It shows
   `<meta name="google-site-verification" content="…">`. Copy the **content
   value only**.
4. In `build.py`:

   ```python
   VERIFY = {
       "google-site-verification": "paste_the_content_value_here",
       "msvalidate.01": "",
   }
   ```

5. `python3 build.py && python3 check.py`, commit, push, wait for the Pages
   deploy to finish (a minute or two), then press **Verify**.
6. Once verified: **Sitemaps** in the left sidebar → add `sitemap.xml` →
   Submit. The file already exists and lists every indexable page.
7. **URL Inspection** at the top: paste any page URL and press **Request
   indexing** to push a single page to the front of the queue. Worth doing
   for the home page and `/work/` on the day of a real change; it is rate
   limited, so it is not for every note.

Data takes 2–3 days to start and the **Performance** report is the one to
read: Queries, Pages, Countries, and the position column.

## 3 — Bing Webmaster Tools (and, through it, ChatGPT and DuckDuckGo)

Worth ten minutes because Bing's index is what DuckDuckGo and several AI
answer engines read. Once Search Console is verified, Bing can import the
whole property:

1. <https://www.bing.com/webmasters> → **Import from Google Search Console**.
2. If you would rather not link the accounts, add the site manually and use
   the **Meta tag** option instead, pasting its value into `VERIFY` under
   `msvalidate.01` the same way as above.
3. Submit `https://plantroomlabs.com/sitemap.xml` there too.

Bing also runs **IndexNow**, which this repo is already set up for: the key
file `65d322c488b72b3c8f6fae5c95466836.txt` is published at the site root, and
a push of new or changed URLs looks like this:

```sh
curl -X POST https://api.indexnow.org/indexnow \
  -H 'Content-Type: application/json' \
  -d '{"host":"plantroomlabs.com",
       "key":"65d322c488b72b3c8f6fae5c95466836",
       "keyLocation":"https://plantroomlabs.com/65d322c488b72b3c8f6fae5c95466836.txt",
       "urlList":["https://plantroomlabs.com/","https://plantroomlabs.com/notes/"]}'
```

A `200` means accepted. It reaches Bing, DuckDuckGo, Yandex and Seznam.
Google does not participate — for Google, use Search Console.

## 4 — What actually moves the ranking

Verification and sitemaps get the site indexed. They do not get it ranked.
What ranks a site this size, in this order:

1. **Pages that answer a specific question.** `/notes/` is the whole strategy:
   each note targets one long-tail query a Niagara engineer actually types,
   and nobody else has written the answer down. Six notes is a start, not a
   knowledge base. Twenty is a knowledge base.
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
