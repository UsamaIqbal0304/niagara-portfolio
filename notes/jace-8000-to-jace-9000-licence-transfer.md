# JACE-8000 to JACE-9000: what the licence transfer does and does not do

> The JACE 8000 to 9000 licence transfer, step by step: what it requires, what it does not include, and which parts cannot be undone.

Source: https://plantroomlabs.com/notes/jace-8000-to-jace-9000-licence-transfer/  
Published: 2026-09-25 (25 September 2026) · Plantroom Labs  
Topics: JACE, Migration, Licensing

Six steps, two separate purchases, and a 45-day clock most people do not know is running. What the transfer actually requires, and what it quietly does not include.

## What the promotion actually discounts

The JACE 8000-to-9000 licence transfer is priced two ways. With an active SMA, the transfer is a fixed fee under the line item `LIC-CHG-UPG`. Miss the promotional window and the same transfer is priced as a new licence instead. That window closes 31 October 2026. Nothing about a running JACE-8000 changes on that date — it is a pricing cut-off on the transfer, not a support cut-off on the hardware.

## What has to be true before you start

Two preconditions matter, and both are easy to miss. First, the station has to be upgraded to Niagara 4.15 — the LTS release — before the N4-to-N5 migrator will accept it; anything older is refused at that step. Second, the licence needs an active SMA. An expired SMA does not just block the migration, it blocks ordinary software updates as well, so it is worth checking independently of any migration plan.

## The steps, in order

### Upgrade to 4.15 LTS

The station has to be on the last Niagara 4 release before the migrator will touch it.

1.

### Buy the JACE-9000 hardware and SD card

The replacement controller ships unlicensed; it takes its identity from the licence transfer, not from the box.

2.

### Pay the transfer fee against an active SMA

This is the `LIC-CHG-UPG` line item. An expired SMA stops here.

3.

### Return the old JACE-8000 SD card within 45 days

Miss the window and Tridium bills for the software that was on it.

4.

### Run the N4-to-N5 station migrator

This is the step that can refuse to proceed over an unsupported third-party module.

5.

### Buy the N4-to-N5 software upgrade separately

The licence transfer makes the licence N5-*compatible*. It does not include N5 itself, and an additional migration fee can apply on top.

6.

## What is reversible, and what is not

The migration itself is not reversible once run. The old JACE-8000 SD card is left in a “Traded” state specifically so it cannot be reused elsewhere. The JACE-8000 board is treated differently from its SD card, though: once the licence has moved off it, the board reverts to Unlicensed and can be redeployed — as a spare, or relicensed for a different station — rather than being scrapped. Plan the hardware side around that distinction: the card goes back, the board does not have to.

## Ordering windows, by region

JACE-8000 hardware is not disappearing from price lists on the same schedule everywhere. It remains orderable in North America, the Middle East and Africa, and Asia-Pacific through 31 December 2026. In Europe, ordering closed at the end of 2025. Neither date affects a JACE-8000 already in service — Niagara 4 itself is supported through Q3 2028, with 4.15 as the long-term-support release covering that whole period on both JACE-8000 and JACE-9000.

## Why this is worth planning without an urgent reason

None of the above is a reason to migrate this quarter. It is a reason to know, station by station, what the transfer actually requires before a customer or a project manager asks for a date. SMA status is checkable today. The 4.15 upgrade is a normal maintenance task that can happen independently of any N5 decision. Knowing which modules would block the migrator — see the companion note on third-party modules — is the one piece of this that takes real lead time, and it is the piece worth starting first.

For a systems integrator managing several sites, the practical unit of work is not any single fee line, it is the SMA and 4.15 audit run across the whole estate before an individual JACE gets scheduled for transfer. An expired SMA is not something that surfaces cleanly at the point of migration; it is state that has usually been drifting quietly for months, unnoticed because nobody was trying to update that station anyway. Finding it during a pre-migration audit costs an email to the licence holder. Finding it mid-transfer costs a stalled project.

One more distinction worth holding onto, because it gets flattened in casual conversation: the licence transfer and the N5 upgrade are two separate purchases with two separate fees, even though they usually happen in the same project. A site can complete the JACE-8000-to-9000 hardware and licence transfer and still be running Niagara 4 on the new box, deliberately, if there is no pressing reason yet to take the N5 upgrade at the same time. Nothing about the transfer forces that second purchase.

For the audit and the transfer work itself, see [Niagara 5 migration](https://plantroomlabs.com/services/niagara-5-migration/).
