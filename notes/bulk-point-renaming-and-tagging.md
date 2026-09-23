# Renaming and tagging points in bulk

> Point names arrive from the field device and there is no standard. What to use to select, rename and tag in bulk — and what a rename quietly breaks.

Source: https://plantroomlabs.com/notes/bulk-point-renaming-and-tagging/  
Published: 2026-09-22 (22 September 2026) · Plantroom Labs  
Topics: Bulk engineering, Tagging, Workbench

Every integrator renames points by hand because the names arrive from somebody else's controller. It is the most repetitive work in Niagara engineering and almost all of it is mechanical.

## Why the problem exists at all

Points are discovered from field devices, and their names are whatever the device vendor chose — abbreviations, instance numbers, a naming scheme that made sense inside that product and nowhere else. Niagara does not impose a convention, and neither does the industry, so every integrator applies their own. On a large job that is thousands of manual edits, done under time pressure, by whoever is available.

The result is predictable: names that are nearly consistent. Nearly is the expensive part, because it defeats every query written against them afterwards.

## Renaming and tagging are different jobs

Conflating them is the root mistake. A name is a label for a human reading a tree. A tag is machine-readable meaning attached to a point — this is a zone temperature, this belongs to that AHU, this is a setpoint. Graphics, queries, analytics and navigation should lean on tags; only people should lean on names.

Estates that tag well can afford imperfect names. Estates that only rename have to get the names perfect, forever, because every downstream thing is parsing them.

> If you are about to rename four thousand points so a graphic can find them, tag them instead. The graphic binds to the tag, and the next engineer's naming preference stops being a breaking change.

## What a rename can break

Renaming is not free, and the damage is usually discovered later by somebody else. Three things to check before a bulk pass:

- **Bindings that address by path.** An ORD written as a slot path names the component by name. Rename the component and the path no longer resolves. Bindings written to resolve by handle are unaffected. Which style your graphics use decides how dangerous a rename is.
- **History already collected.** Existing history records keep the identity they were created under. Renaming the point does not retroactively rename its history, so a careless pass can orphan trend data from the point that produced it.
- **Anything outside the station.** Reports, exports, dashboards and integrations that were written against the old names, which nobody in the room remembers exist.

## The tooling that makes it repeatable

| Step | What does the work |
|---|---|
| Select | A query, not a person scrolling. Niagara's own query language can express "every writable point under this device whose name starts with that" far more reliably than a multi-select, and it produces the same set twice. |
| Act | A batch job, so the operation is recorded, resumable and reviewable, rather than a sequence of edits with no log. On a Supervisor, provisioning applies the same idea across every station in the network at once. |
| Mean | A tag dictionary, so the vocabulary is defined once and applied, instead of each engineer inventing tags as they go. |
| Verify | Re-run the selecting query afterwards and check the count is what you intended. A bulk operation without an after-count is a hope. |

## Do it once, keep the recipe

The value is not in the single pass. It is that the selection query and the job definition survive, so the next building, the next phase and the next contractor's handover get the same treatment in minutes. Bulk work done by hand produces a tidy station; bulk work done as a recorded job produces a tidy station and a standard.
