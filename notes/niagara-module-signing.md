# What a station checks before loading a module

> Niagara's three module verification modes, what each one demands of your certificate, and why the setting cannot be relaxed from the command line.

Source: https://plantroomlabs.com/notes/niagara-module-signing/  
Published: 2026-09-22 (22 September 2026) · Plantroom Labs  
Topics: Module signing, Certificates, Deployment

Signing is not a formality bolted on at the end. It is a load-time gate with three settings, and the default one refuses unsigned code.

## The three modes

A Niagara host decides how strict to be about module signatures with a single system property, `niagara.moduleVerificationMode`. It takes three values, and the distinction between them is about the *certificate*, not about whether a signature exists.

| Mode | What the host requires |
|---|---|
| low | Warnings only — an unsigned module still loads. Documented as an option that will be removed in a future release, so anything depending on it has a deadline whether or not anyone has written it down. |
| medium | The current default. Modules must be signed by a **valid, trusted** certificate. Trusted means present in that host's trust store — which is a per-host fact, not a property of your certificate. |
| high | Valid, trusted **and CA-issued**. An internal CA is acceptable, so this does not automatically mean buying a certificate, but it does rule out a bare self-signed key. |

> **Default is medium, and that is the number that matters.** An unsigned module does not install on a stock station or a stock controller. Not "warns", not "logs" — refused.

## Medium became the default in Niagara 4.9

The default moved in two steps, not one. Niagara 4.8 shipped with the verification mode at low; 4.9 raised the shipped default to medium. A host running 4.9 or later gets medium behaviour out of the box. A host still on 4.8 does not — which is why a jar that installed unsigned for years stops installing the moment the host is upgraded, with no change to the jar itself.

## Trusted is a property of the host

The most common surprise is a module that installs on one host and is refused by the next, with the same jar and the same signature. Nothing about the module changed; the second host does not have the signing certificate in its trust store.

This is why "is it signed?" is the wrong question when something will not install. The question is "is this certificate trusted *by this host*, and does this host demand a CA behind it?" The answer is per host, and on an estate assembled over several years the answer varies across the estate.

## You cannot talk a station out of it at the command line

There is a matching property, a command-line property blacklist, whose job is to stop somebody setting the verification mode — among other security-relevant properties — as a launch argument. The intent is plain: the strictness of module verification is a decision made in the host's configuration by whoever administers it, not something a process can lower for itself on the way up.

Treat a plan that involves relaxing verification as a plan that will be rejected during commissioning.

## Program objects are gated separately

Modules are not the only executable thing in a station. Program objects have their own signing requirement, with its own property, defaulting to permissive — unsigned program objects run. A site that has tightened module verification and left program objects alone has a gap it very likely does not know about, and closing it is a one-line configuration change plus the work of signing what is already there.

## Practical consequences

1. **Sign in development, not at the end.** A build that produces unsigned jars for months and signs once before delivery discovers every trust and packaging problem on the day of delivery.
2. **Decide self-signed or CA early.** Self-signed with the certificate distributed to the estate's trust stores is coherent for an internal estate. Anything sold or shipped to third parties needs a CA behind it, and obtaining a code-signing certificate now requires hardware key storage — which takes lead time and money, so it belongs in the plan, not the last week.
3. **Record which certificate signed which release.** When a certificate expires or is replaced, the question "what is out there signed by the old one" needs an answer that is not an estate-wide search.
