# History capacity on a JACE

> The default capacity is 500 records, the default name collides, and one setting decides whether a full history overwrites data or stops collecting.

Source: https://plantroomlabs.com/notes/niagara-history-capacity/  
Published: 2026-09-23 (23 September 2026) · Plantroom Labs  
Topics: Histories, JACE, Station engineering

Histories are the part of a station nobody checks until somebody asks for last March. By then the answer is already decided by two properties set at engineering time.

## A new history extension collects nothing

Add a history extension to a point and it arrives **disabled**. Setting `Enabled` to true is the whole of what is strictly required to start collecting — which is exactly why the other properties get skipped.

## The name collides by default

`History Name` defaults to `%parent.name%`. Every `SpaceTemp` point under every air handler therefore wants to be the same history. Qualify it with the equipment above:

`%parent.parent.name%_%parent.name%` → `AHU-1_SpaceTemp1`

There is a checkable tell for getting this wrong. Expand `History Config` and read the read-only `Id`: if it shows an error string rather than a name, the History Name property is misconfigured. Check it on the first point of a batch rather than on all of them afterwards.

## Capacity, and the setting that silently stops collecting

| Property | Default | What it means for you |
|---|---|---|
| Capacity | Record Count: 500 | 500 or fewer is generally adequate on a controller *because the records are archived to a Supervisor*. Tridium's stated best practice is to hold about two days of data on a JACE. On a Supervisor a large number such as 250,000 is reasonable. |
| Full Policy | Roll | `Roll` overwrites the oldest record first, so the latest data always exists. `Stop` terminates recording when capacity is reached — the history stays present, stays green, and stops containing anything new. |
| Unlimited | — | Available, and not the wise choice even on a Supervisor. On a controller with a fixed flash budget it is how a station fills its own disk. |

> **Full Policy is the one to audit on an inherited station.** A history set to `Stop` raises nothing and looks identical to a healthy one. The first evidence is a chart that flatlines on a date nobody can explain. Note also that Full Policy does nothing at all when Capacity is Unlimited.

## Changing the interval creates a new history

Histories with different intervals are not compatible, so changing `Interval` splits a new history off from the original rather than editing it. Decide the interval before the data matters. A trend re-rated a year in gives you two datasets and a join, not a better trend.

## Sizing it against the archive

Where records are archived to a relational database and queried back through the Archive History Provider, the local capacity is a cache decision rather than a retention decision. Two things pull in opposite directions: local histories answer a query faster than archived ones, and local storage on a controller is finite. Size the local capacity to cover the time ranges people actually ask for, and to remain useful on the day the archive source is down for maintenance.

`System Tags` on a history extension are worth setting while you are there — they are the metadata that makes a selective import or export possible later without hand-picking histories.

## What to check on a station you did not build

1. **Any history whose Full Policy is Stop.** Then look at when it last recorded.
2. **Duplicate or unqualified history names**, which are the sign that the default name template was never changed.
3. **Capacity against the archive schedule.** A controller holding two days of data and archiving weekly loses five days on every missed archive.
4. **Anything set to Unlimited on a controller**, before the flash answers the question for you.
