# DNS for plantroomlabs.com

Everything that has to exist in the domain's DNS zone, in one place. Add these
at the **registrar** — the company that sold the domain — not in this repo.
Nothing here can be done from the repo; GitHub only serves the files.

Status, re-checked 2026-09-22: **the domain is registered and live.** It
answers on Squarespace nameservers (`nse1`–`nse4.squarespacedns.com`) and
currently serves Squarespace's "Coming Soon" parking page from
`198.49.23.144/145` and `198.185.159.144/145`.

So the DNS panel to use is **Squarespace's**, reached through the Google
Workspace / Google Domains account that sold the domain — Squarespace bought
Google Domains in 2023 and inherited the zone. Every record below goes there.

An earlier note in this file said the domain was unregistered, based on a
Verisign whois that returned `No match`. That was the registration not having
propagated to the registry's whois yet; it was wrong within the hour. Re-check
with a resolver rather than whois:

```sh
dig +short plantroomlabs.com NS A
```

Nameservers plus addresses means the zone exists and the panel is ready.

## 0 — ICANN registrant verification (do this first, it has a deadline)

Separate from, and prior to, everything below. Squarespace emails a "verify
your contact information or the domain will be suspended" notice on every new
`.com` registration; it is ICANN's Registrar Accreditation Agreement, clause
3.7.7.2, not a Squarespace upsell and not phishing. Click the link in the
email, or verify from the domain's panel.

The window is **15 days from registration**. RDAP puts creation at
2026-09-21T19:17:15Z, so the deadline is around **2026-10-06**. Missing it
suspends the domain: the site stops resolving and mail stops being delivered.

Domain-verification phishing is common and looks exactly like the real thing,
so confirm the current state from the registrar rather than from an email. The
registry's own view:

```sh
curl -s -H 'Accept: application/rdap+json' \
  https://rdap.verisign.com/com/v1/domain/plantroomlabs.com | python3 -m json.tool | grep -A6 status
```

A `client hold` or `server hold` in `status` means it has already been
suspended. As of 2026-09-22 the status is `client delete prohibited` and
`client transfer prohibited` — both normal registrar locks, nothing wrong.

## 1 — Google Workspace domain verification

One TXT record. Google also offers a CNAME as an alternative; do **not** add
both, the TXT is the normal route.

| Type | Name | Value | TTL |
|---|---|---|---|
| TXT | *(leave empty — means `@`)* | `google-site-verification=iFhnvrjJm4ege5QJLDBRCzRueYKiDzqLv-55NdPhE20` | lowest offered |

Copy the value with the copy button in the Workspace screen rather than
retyping it. It contains `I`, `l`, `O` and `0`, and one wrong character fails
verification with no useful error.

If Google reissues the code (it does if you restart setup), the string above
is stale — take the current one from the console.

## 2 — Gmail

Take the MX records from the Workspace setup screen itself, at the step after
verification. Current Workspace tenants get a single record; older
instructions list five. Use what the console shows you, not a remembered set.

## 3 — The website, on GitHub Pages

Squarespace's DNS page shows a banner: *"This domain is managed by Google
Workspace. Any changes to the settings could impact its functionality."*

**Proceed anyway.** It is a blanket caution shown on every Workspace-linked
domain, not a lock, and the records it is protecting are not the ones being
changed here. Mail and web live in different record *types* and cannot affect
each other:

| Record type | What it controls | Touch it? |
|---|---|---|
| `MX` → `smtp.google.com` | where mail is delivered | **no** |
| `TXT` → `v=spf1 include:_spf.google.com ~all` | which servers may send as you | **no** |
| `TXT` at `google._domainkey` | DKIM signing key | **no** |
| `A` at `@` | which server answers the website | **yes — replace** |
| `CNAME` at `www` | same, for the www host | **yes — replace** |

Deleting an `A` record cannot break Gmail; resolvers ask for `MX` when routing
mail and never look at `A`. The four `198.x` addresses currently at the apex
are Squarespace's parking page ("Coming Soon"), which came with the domain.
They are not Google's and nothing depends on them.

Confirmed present and correct as of 2026-09-22 — leave all three alone:

```sh
dig +short plantroomlabs.com MX                      # 1 smtp.google.com.
dig +short plantroomlabs.com TXT                     # v=spf1 include:_spf.google.com ~all
dig +short google._domainkey.plantroomlabs.com TXT   # v=DKIM1; k=rsa; p=...
```

(The zone is Google Cloud DNS behind Squarespace-branded nameservers — the
`SOA` hostmaster is `cloud-dns-hostmaster.google.com`. Squarespace's panel is
still the place to edit it.)

If the parking `A` records are not listed as editable rows, they are
Squarespace's implicit default rather than real records: adding the four
GitHub `A` records below is enough, and the default stops being served.

### The records to set

| Type | Name | Value |
|---|---|---|
| A | *(empty / `@`)* | 185.199.108.153 |
| A | *(empty / `@`)* | 185.199.109.153 |
| A | *(empty / `@`)* | 185.199.110.153 |
| A | *(empty / `@`)* | 185.199.111.153 |
| CNAME | `www` | `usamaiqbal0304.github.io.` |

`www` is the literal word, not `www.plantroomlabs.com` — the form appends the
domain itself.

**Delete Squarespace's own A records first.** The zone currently points the
apex at `198.49.23.144/145` and `198.185.159.144/145`, which is the parking
page. Left in place alongside the four GitHub addresses, the domain answers
from whichever of the eight a visitor happens to hit.

Then in the repo: Settings → Pages → custom domain `plantroomlabs.com`, and
tick **Enforce HTTPS** once the certificate has been issued (it can take an
hour). The `CNAME` file in this repo is generated by `build.py` from `SITE`,
so leave it alone.

## 4 — DMARC (do this now)

SPF and DKIM are both live, but without DMARC neither is *enforced*. SPF says
which servers may send as us and DKIM signs what they send; DMARC is the
record that tells a receiving server what to do when a message fails both.
With no DMARC record the answer is "decide for yourself", and most receivers
decide to deliver it. Anyone can send invoices as `info@plantroomlabs.com`
today and they will land in inboxes.

It also gets our own mail treated better: Google and Yahoo have required a
DMARC record from bulk senders since February 2024, and a domain without one
is scored worse even at low volume.

Add one TXT record:

| Type | Name | Value |
|---|---|---|
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:admin@plantroomlabs.com; fo=1` |

`p=none` deliberately. It changes nothing about delivery — it only asks
receivers to send us daily aggregate reports. Run it for two to four weeks,
read the reports, confirm nothing legitimate is failing, then tighten:

```
p=none        → observe only            (start here)
p=quarantine  → failures go to spam     (after the reports look clean)
p=reject      → failures are bounced    (the destination)
```

Going straight to `p=reject` is how people silently lose mail they did not
know they were sending — a mailing list, a CRM, a contact form relaying
through a third party. We have none of those yet, which is exactly why
starting at `p=none` costs nothing and confirms it.

`rua=` points at `admin@` rather than `info@` because the reports are XML
attachments, one per receiving provider per day, and do not belong in the
address printed on the website.

## 5 — CAA (only after HTTPS is working)

A CAA record names the certificate authorities allowed to issue for this
domain. Without one, any public CA may — so a mis-issued certificate is one
social-engineered support ticket away, at any of ~50 CAs.

**Order matters: do not add this until the GitHub Pages certificate has been
issued and the padlock is real.** A CAA record that omits the CA actually
being used blocks issuance outright, and the failure is invisible from our
side — GitHub simply never gets a certificate and reports nothing useful.
Adding it afterwards cannot break the certificate already in hand, and
renewals will pass because the correct CA is named.

GitHub Pages uses Let's Encrypt. Google Workspace does not need a CAA entry —
it does not issue certificates for our domain.

| Type | Name | Value |
|---|---|---|
| CAA | *(empty / `@`)* | `0 issue "letsencrypt.org"` |
| CAA | *(empty / `@`)* | `0 iodef "mailto:admin@plantroomlabs.com"` |

Squarespace's form may split CAA into three fields instead of one string —
flags `0`, tag `issue`, value `letsencrypt.org`. Same record either way.

Deliberately no `issuewild` entry: we use no wildcard certificate, and
omitting the tag means wildcards fall back to the `issue` rule rather than
being separately permitted.

Check it before and after:

```sh
dig +short plantroomlabs.com CAA        # empty today; two rows after
```

## Traps

- If Squarespace offers to "connect this domain to a Squarespace site",
  decline. It rewrites the A records and takes the site down.
- All of the above coexist. Verification TXT, Gmail MX and Pages A records are
  different record types and do not conflict.
- The apex takes A records, never a CNAME. Some panels will accept a CNAME on
  `@` and then break mail.

## Verifying it worked

```sh
dig +short NS   plantroomlabs.com     # registrar's nameservers
dig +short A    plantroomlabs.com     # the four 185.199.x addresses
dig +short TXT  plantroomlabs.com     # the google-site-verification string
dig +short MX   plantroomlabs.com     # Google's mail servers
dig +short TXT  _dmarc.plantroomlabs.com   # v=DMARC1; p=none; rua=...
dig +short CAA  plantroomlabs.com          # 0 issue "letsencrypt.org"
curl -sI https://plantroomlabs.com/ | head -1
```

The certificate is the one thing `dig` cannot tell you. Read it directly —
`CN` must be `plantroomlabs.com`, not `*.github.io`:

```sh
echo | openssl s_client -connect plantroomlabs.com:443 \
  -servername plantroomlabs.com 2>/dev/null | openssl x509 -noout -subject -dates
```

Status as of 2026-09-22: A, CNAME, MX, SPF and DKIM all correct and verified.
DMARC and CAA not yet added. The Pages certificate has not been issued — the
apex still answers with GitHub's `*.github.io` certificate, which is why a
browser calls the site insecure. That is a queue, not a fault: the four A
records were briefly wrong (`185.199.111.15`, a missing `3`), which failed
GitHub's domain check and stopped it requesting a certificate. The records
are right now, and re-saving the custom domain in Settings → Pages re-runs
the check.
