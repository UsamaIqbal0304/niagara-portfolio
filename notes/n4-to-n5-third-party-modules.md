# What happens to third-party modules moving from N4 to N5

> A module with no Niagara 5 build can stop the migrator outright, and one that has a build can still fail to load. What breaks, and why.

Source: https://plantroomlabs.com/notes/n4-to-n5-third-party-modules/  
Published: 2026-09-25 (25 September 2026) · Plantroom Labs  
Topics: Migration, Estate management, Module development

A migration can be refused before it starts, over one forgotten module — or load a signed module and reject an unsigned one right next to it. What breaks, in the order it breaks, sourced from Tridium's own transfer FAQ and a Platinum distributor's own words.

## The failure that lands with no warning

An N4-to-N5 migration can be refused outright, and the reason is rarely the station itself. It is one module — usually a small one, usually installed years ago by someone who has since left — that the vendor never built for the new runtime. Tridium's own migration tooling checks for this, and can refuse to proceed.

This is worth knowing before a migration date goes on a calendar, not after.

## What the distributor's own FAQ requires

One Sightsolutions, a Tridium Platinum distributor, puts it plainly in their N5 FAQ:

> “Prior to executing the migration, you will need to identify any 3rd party modules (e.g. software not developed by Tridium) installed in the station and confirm whether an N5 version is available. If not, then the process may fail to execute.”

Read that as a prerequisite, not a warning. The inventory has to happen before the migration is attempted, because the migrator's behaviour when it hits an unsupported module is to stop, not to skip it and continue.

## A module with an N5 build is not automatically safe either

Niagara 5 moves the runtime from Java 8 to Java 21, and removes `SecurityManager` entirely. One consequence of that removal is that a valid signature stops being a recommendation and becomes mandatory, with no grace period. An unsigned module, a self-signed one outside your trust store, or one whose signing certificate has lapsed, will not load — independent of whether the code itself has been ported.

So two separate questions need separate answers for every third-party module in a station: does an N5 build exist at all, and if it does, is it validly signed for the host it is going to load on. A module can clear the first test and still fail the second.

## Licences do not travel with the software

Tridium's own JACE 8000-to-9000 licence transfer FAQ states that any third-party software options on JACE 8000 licences are moved to the customer's stock during the migration process. In practice that means the licence is detached from the host during the transfer, not carried forward automatically. Each third-party vendor then has to re-issue against the new Host ID before that feature runs again — a step that depends entirely on the vendor still being reachable and willing to do it.

The same stock-transfer mechanism applies to Tridium's own licensed options that have no JACE-9000 equivalent: the capability is not blocked, it is simply gone, because there is nothing on the new platform to re-attach the licence to.

## Graphics: what actually carries over

The migrator's Px handling is qualified, not blanket. The distributor's FAQ describes it as covering Px “for standard Niagara Px capabilities” — standard sheets and standard bindings move across cleanly. What does not move across is the theme: Niagara 5 ships new navigation, layout and themes, and the N4 Zebra and Lucid themes are not carried forward. Any graphics built or styled against those themes, or any custom bajaux widget skinned to match them, needs a visual review after migration — not an assumption that it will look the same.

## None of this is a 2026 deadline

It is worth being precise about the dates, because the framing around this release tends to compress them. 31 October 2026 is the cut-off for a licence-transfer discount; after it, the JACE 8000-to-9000 transfer costs full price instead of just the transfer fee, and nothing about a running station changes on that date. Niagara 4 itself reaches end of life in Q3 2028, and Niagara 4.15 — the last N4 release — is a long-term-support version supported through that date, on both JACE-8000 and JACE-9000 hardware. There is no cliff in 2026. There is a widening gap between stations that know what will survive the move and stations that do not, and that gap gets more expensive to close the longer it is left.

## What to build before the date gets picked

The useful output is a list, not an impression: every third-party module in the station, its vendor, whether an N5 build exists, and whether its current signature is valid and trusted. For anything without a clear yes on both, decide early whether the vendor is going to do the work, whether the module can be replaced, or whether it needs rebuilding from its observed behaviour because the original vendor is no longer reachable. That last case is more common on older estates than most people expect, and it is the one that turns a software question into a scheduling one.

For the audit and porting work itself, see [Niagara 5 migration](https://plantroomlabs.com/services/niagara-5-migration/).
