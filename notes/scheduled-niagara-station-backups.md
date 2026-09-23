# Scheduled station backups, and the gap

> A Supervisor can back up every station in its Niagara Network on a schedule. The station it does not cover that way is its own.

Source: https://plantroomlabs.com/notes/scheduled-niagara-station-backups/  
Published: 2026-09-22 (22 September 2026) · Plantroom Labs  
Topics: Backups, Provisioning, Supervisor

Niagara ships scheduled backups for the stations a Supervisor watches over. The Supervisor itself is the exception — and it is the host holding the histories, the graphics and the hierarchy.

## "Backup" means three different things

Before scheduling anything, be precise about which of these you mean, because they restore differently and are not interchangeable.

| Kind | Contains | Restores to |
|---|---|---|
| Station copy | The station database, histories and alarms. | Any host, including a different controller model. The portable one. |
| Backup distribution | The above plus references to modules, the runtime and OS version, and platform configuration. | A host you are rebuilding to match. Downgrading needs a clean distribution first. |
| Clone | Everything, including copies of the modules, the runtime, the OS image and the platform configuration. | The same model of controller only. Self-contained, and much larger. |

## What is scheduled out of the box

A Supervisor's Niagara Network carries a provisioning extension, and that extension has a schedule component wired to a start-backup action. Set the schedule and every station in the network is backed up together, without anyone opening Workbench.

Provisioning does considerably more than backups — installing software, updating licences, distributing certificates, changing default credentials, applying templates and running custom jobs — all driven from the Supervisor against the stations beneath it. If you are only using it for backups you are using a small corner of it.

> **The built-in schedule does not scale.** Niagara's own documentation advises against it on a larger enterprise system, because it fires a backup of every subordinate station at the same moment. On a sizeable estate, use job prototypes so the work is batched and staggered instead.

## The gap

All of that provisioning work is performed *by* the Supervisor *against* the stations in its Niagara Network. Its own station is not one of them.

Which is awkward, because the Supervisor is usually the host that matters most: the consolidated histories, the graphics, the hierarchy, the users, the reports. A site can have every controller backed up nightly and the single most valuable station on the estate backed up whenever somebody last remembered.

That gap is why a market exists for third-party scheduled-backup modules, some priced in the thousands. It is a genuine hole, and paying to fill it is a legitimate answer — but it is worth knowing you are paying for one missing schedule rather than for backup as a capability.

## What to put in place

1. **Schedule the subordinates properly** — job prototypes rather than the convenience schedule, staggered, with the results actually reviewed.
2. **Decide explicitly how the Supervisor gets backed up.** A third-party module, a scheduled job that drives the backup, or a documented manual procedure with an owner and a date. Any of the three beats the usual answer, which is silence.
3. **Get the files off the host.** A backup stored only on the machine it protects is not a backup.
4. **Restore one, once.** Onto spare hardware, before you need it. An untested backup is an assumption with a filename.
