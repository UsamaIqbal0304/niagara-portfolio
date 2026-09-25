#!/usr/bin/env bash
#
# Publish the committed site to Cloudflare Pages (project "plantroomlabs").
#
#   ./deploy-pages.sh            # deploys HEAD of the current branch
#
# Deploys what is committed, never the working tree: `git archive HEAD` is
# unpacked into a scratch directory, the generator and its docs are stripped
# (GitHub Pages serves build.py and README.md at the site root; this host
# should not), and _headers is added. So: build.py, check.py, commit — then
# this. Uncommitted output is invisible to it on purpose.
#
# Credentials: CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID from
# ~/.secrets/cloudflare.env. Nothing here is printed.
#
# Until the domain's nameservers move to Cloudflare this only updates
# https://plantroomlabs.pages.dev — a staging copy. plantroomlabs.com stays
# on GitHub Pages and every canonical URL still says so.
set -euo pipefail
cd "$(dirname "$0")"
. ~/.secrets/cloudflare.env
export CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID

out=$(mktemp -d /tmp/plb-pages.XXXXXX)
trap 'rm -rf "$out"' EXIT
git archive HEAD | tar -x -C "$out"
rm -f "$out"/{build.py,check.py,indexnow.py,deploy-pages.sh,README.md,TRAFFIC.md,DNS.md,.gitignore}
cat > "$out/_headers" <<'HDR'
/*
  X-Content-Type-Options: nosniff
  X-Frame-Options: SAMEORIGIN
  Referrer-Policy: strict-origin-when-cross-origin
/assets/*
  Cache-Control: public, max-age=31536000, immutable
HDR

npx -y wrangler@latest pages deploy "$out" \
  --project-name plantroomlabs --branch main \
  --commit-hash "$(git rev-parse HEAD)" --commit-message "$(git log -1 --format=%s)" \
  2>&1 | grep -E 'Success|Deployment complete|error' || true
