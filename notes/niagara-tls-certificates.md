# The certificate on a new JACE

> Every station starts with a self-signed certificate it generated itself. What that is good for, what it is not, and what breaks on the day it expires.

Source: https://plantroomlabs.com/notes/niagara-tls-certificates/  
Published: 2026-09-23 (23 September 2026) · Plantroom Labs  
Topics: TLS, Certificates, Commissioning

A controller is secure out of the box in the narrow sense that the traffic is encrypted. It is not authenticated, and the difference only becomes visible later.

## Where the first certificate comes from

The first time a Workbench installation, a platform or a station starts after commissioning, the system generates a default self-signed server certificate with the alias `tridium`, using its own 2048-bit private key. Nobody asked for it and nothing prompts you about it.

It is self-signed in the literal sense: open it and the Issuer DN and the Subject DN are the same name. There is no authority above it saying it is what it claims to be.

> **What it is actually for.** Tridium's documentation is clear that the purpose is to allow secure access to a platform or station *before* a trusted certificate tree exists. It is the scaffolding for commissioning, not the finished security posture, and because a client cannot validate it, it is explicitly not recommended for robust long-term use.

## Three things about the default certificate that surprise people

- **It cannot be deleted.** From Niagara 4.13 the default certificate created on first platform access is also the recovery certificate, protected by the global certificate password. On a host upgraded from before 4.13, an existing `tridium` certificate carries on being used but does *not* serve as the recovery certificate — worth knowing before an upgrade, not after.
- **Do not export it to another host.** Copying one platform's self-signed certificate into another platform's store is possible and is a downgrade in security every time.
- **Accepting one is a commitment.** Once you approve a self-signed certificate you are not asked again — and if its public key later changes, the green shield in Certificate Management becomes a yellow warning and access is denied until somebody accepts the new key. That is the correct behaviour and it looks exactly like a fault.

## The platform settings worth checking on every commission

Right-click Platform, open `Views > Platform Administration`, then **Change TLS Settings**:

| Setting | Default | Worth changing? |
|---|---|---|
| State | TLS only | No. Anything else on a controller reachable by more than one person is a decision to justify in writing. |
| Port | 5011 | Only if the site's firewall policy says so. |
| Certificate Alias | the default self-signed certificate | Yes, eventually — this is where a signed server certificate gets selected once one exists. |
| Protocol | TLSv1.2+ | Raise to TLSv1.3 where every client supports it. Never drop to TLSv1.0+ to make an old client work without writing down why. |

## What expiry actually breaks, and what it does not

This is the part that makes certificate expiry dangerous rather than merely annoying: it does not fail all at once.

- Browsers start warning that the certificate is not trusted — *and still connect*.
- Workbench connects.
- FOXS connections between stations that use Allowed Hosts exemptions still connect.
- FOXS connections between stations **without** those exemptions fail to reconnect, and stay failed until the certificates are reissued.
So an estate can pass an expiry date looking fine, and lose exactly the station-to-station links that were set up properly. The sites that did the security work are the ones that break first.

> **Set the alarm now, not the reminder.** An alarm extension can be added to the server certificates under the `SecurityService` to raise an alarm 30 days before expiry. Thirty days matters: if the site uses a third-party CA, the reissue process can take a couple of weeks on its own. From Niagara 4.14 the Signing Service can renew certificates, which shortens the internal case but not the external one.

## A reasonable order of work

1. **Commission on the default certificate.** That is what it is for. Do not spend the first day of a job on PKI.
2. **Decide self-signed-root or third-party CA before handover**, because the lead time is entirely different and only one of them is free.
3. **Issue and install the server certificates**, then point the platform TLS settings and the station's web service at them.
4. **Add the 30-day expiry alarms** and record every expiry date somewhere that outlives the engineer who set it.
