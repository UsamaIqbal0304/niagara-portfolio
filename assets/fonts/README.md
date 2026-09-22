# Fonts

Self-hosted, not loaded from `fonts.googleapis.com`. The Google stylesheet is
a render-blocking request to a third party before any text can paint, and it
hands every visitor's IP address to Google on every page load.

Both files are the **variable** font, subset to the characters this site
actually uses:

| File | Source | Size |
|---|---|---|
| `inter-var.woff2` | Inter v4 `InterVariable.ttf` (859 KB) | 62 KB |
| `jetbrains-mono-var.woff2` | JetBrains Mono v2.304 `JetBrainsMono[wght].ttf` (296 KB) | 39 KB |

One file per family covers every weight, because they are variable — asking
for 400 and 700 costs nothing extra.

The subset is latin-1 (`U+0000-00FF`, so accented names in an enquiry render)
plus the punctuation the copy relies on: curly quotes, en and em dashes, the
middot, arrows, the degree sign, and the sub/superscripts in `m³` and `CO₂`.
If you add a character outside that range it will render in the fallback face
— check before shipping copy with unusual glyphs.

Rebuild with `fonttools` (needs `brotli` for woff2):

```sh
pyftsubset InterVariable.ttf --unicodes=U+0000-00FF,U+2000-206F,... \
  --flavor=woff2 --output-file=inter-var.woff2 \
  --layout-features=kern,liga,calt,ccmp,locl --no-hinting --desubroutinize
```

Licences: Inter is SIL OFL 1.1, JetBrains Mono is SIL OFL 1.1. Both permit
self-hosting and redistribution; the licence files are kept alongside.
