# Authentication schemes: each Niagara user picks one

> A station can run several login mechanisms at once, and the choice is made per user, not per station. What each scheme is actually for.

Source: https://plantroomlabs.com/notes/niagara-authentication-schemes/  
Published: 2026-09-23 (23 September 2026) · Plantroom Labs  
Topics: Station security, Permissions, Station engineering

Every login into a station — engineer, operator, browser, or another station — is resolved by one service against the scheme named on that user's own account. Most estates never change it, which is fine until a device shows up that cannot hold a cookie.

## One service, every login

Workbench opening a station over Fox, an operator on a browser, a Supervisor pulling points off a subordinate, an oBIX client scraping values — all of it arrives at the same place. The **AuthenticationService**, under Config → Services, routes every authentication request and defines which mechanisms the station will accept at all. Every station must have one, and every user must have their Authenticator property set to a scheme the service actually holds.

That second half is the bit that bites. The station supports only the schemes that have been added to the service. Delete one while users still reference it and those users are left pointing at a scheme that no longer exists.

## The two a new station already has

A station off the New Station wizard comes with two schemes installed and DigestScheme assigned to every user, so in the ordinary case there is nothing to set up.

| Scheme | What it is for |
|---|---|
| DigestScheme | The default. Niagara 4 Workbench and Niagara 4 station-to-station. |
| AXDigestScheme | Compatibility, so a Niagara 4 Supervisor can reach a NiagaraAX station. |

Neither one sends the password. Both use SCRAM-SHA — salted challenge response, RFC 5802 — so what crosses the wire is proof the client knows the password rather than the password itself. The two schemes run the same mechanism; they differ only in the order of operations, because AX and N4 need different sequences.

> AXDigestScheme only reaches an AX station that took its security updates. The floors are 3.8, 3.7u1, 3.6u4 and 3.5u4. Older than that and the Supervisor will not connect regardless of credentials.

## Assigned per user, not per station

The scheme is a property of the user account. Right-click UserService → Views → User Manager, select the user, Edit, then expand **Authenticator** and set Authentication Scheme Name from the drop-down. Only schemes already present in the AuthenticationService appear there.

This is deliberate: the appropriate mechanism for an engineer is rarely the appropriate mechanism for a piece of equipment. Human accounts can sit on digest with two-factor on top while a headless client sits on something simpler, in the same station.

Schemes ship in palettes rather than being built in — `baja` for HTTPBasicScheme, `ldap` for LdapScheme and KerberosScheme, `saml`, `clientCertAuth`, `gauth`. Developers can write their own, and third-party schemes exist.

> Not every scheme works over every transport. HTTP-Basic is web only, and intended for clients that cannot use cookies; it does not work over Fox and it does not work through the normal form login. It also sends the user name and password over the connection, so it is a TLS-only proposition.

## Two-factor, without a network dependency

The `gauth` palette's GoogleAuthenticationScheme asks for a password plus a single-use token from an authenticator app, so a compromised password is not on its own enough to get in. It is TOTP: the token is time-based, rotates every 30 seconds, and cannot be replayed.

The useful property of time-based tokens on a plant network is that nothing has to talk to anything. There is no path required between the phone, the station and an external server — both ends independently derive the same number from the clock.

Which is also the failure mode. The station's clock and the phone's clock have to stay roughly together; the app allows plus or minus 1.5 minutes for skew. On a controller whose time source is unreliable, that budget is the thing that will eventually lock people out, not the scheme itself.

## Certificates, and the lobby screen trick

ClientCertAuthScheme, from the `clientCertAuth` palette, binds a public certificate to the user object. At login the user uploads their certificate and private key, and the station checks the private key against the public key stored on that user. The certificate also has to be in the server socket's TrustAnchor list — configuring the user alone is not enough.

Adding the component puts an extra button on the login window. Its caption comes from the **Login Button Text** property and defaults to "Sign in with SSO", which is worth changing to something that describes what the button actually does on your site.

The same feature is how you build a kiosk: a lobby display or a mechanical-room terminal whose browser connects and authenticates with no human touching it. Related, PKI Authentication — client certificate auth with a certificate signed by a trusted CA, effectively mTLS — works on any platform and needs no licence feature.

## Password rules belong to the scheme

Password strength is not a station-wide setting. It hangs off each authentication scheme, under Global Password Configuration → Password Strength on the AuthenticationService property sheet. So you can hold administrators to stricter minimums than operators simply by putting them on different schemes.

Alongside the minimum character requirements sit Expiration Interval, Warning Period and Password History Length. Change any of them and the new minimums apply to the next password change for every user on that scheme, the admin account included. The properties accept zeros, and the documentation is blunt about not doing that.

LDAP is the exception: password strength for the LDAP scheme is the LDAP server's business, not the station's.

Per user, under Authenticator → Password Config, **Force Reset At Next Login defaults to true**. That is the right default for a temporary password you have just issued, and the thing to switch off when you do not want the account prompted.

> If the New button is missing while you are creating users from a browser, it is not a permissions problem. Secure Only Password Set is true and you have connected over plain HTTP. Reconnect over HTTPS and the button returns.

## Machine users are still users

A station-to-station user is the account one station uses to log into another under a NiagaraNetwork. It is a machine identity, and it deserves the same discipline as a human one: give it a role carrying only the permissions the integration needs, and **do not make it a super user**, however convenient that is on the day.

Properties that exist for browser sessions — Facets, Nav File, Web Profile — are inconsequential on this kind of account. Name it something memorable and specific to your company or the site, and never log in as it by hand; it is referenced from the other station, not typed into a login box.

## Who logged in, and when they get thrown out

Since Niagara 4.15 the station keeps visible login history. Right-click a connected station or platform in Workbench and choose Session Info: the current session is at the top, the previous login time at the bottom, and the History link opens **up to the last 20 attempts, successful and unsuccessful**. From a browser it is the user icon, top right, View Login History. With admin read permission on another account you can right-click that user in the User Manager and read theirs.

A run of failures against one account, visible without digging through logs, is the point of the feature.

At the other end of the session, auto logoff is enabled by default. The station warns first with a popup — click OK and you carry on — then logs the session off and shows a notice at the login window. The period comes from Default Auto Logoff Period on UserService, overridable per user. Workbench has its own separate auto-logoff options under Tools → Options, which apply only to the Workbench session.

Also new in 4.15: Absolute Logoff, which ends a session after a fixed time from login *regardless of activity*, defaulting to 7 days. Enable it globally with Absolute Logoff Enabled on UserService and it appears in the User Manager for per-user control. Stations running 4.14 and earlier do not have it, though new stations built from the current templates get it switched on.
