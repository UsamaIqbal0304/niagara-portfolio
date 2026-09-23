# Doing one thing to fifty stations at once

> Provisioning runs platform tasks across a whole NiagaraNetwork from one Supervisor connection — and the obvious backup action is the wrong one.

Source: https://plantroomlabs.com/notes/niagara-provisioning-jobs/  
Published: 2026-09-23 (23 September 2026) · Plantroom Labs  
Topics: Provisioning, Estate management, Supervisor

Fifty controllers means fifty platform connections, or one provisioning job. The job is repeatable, schedulable and logged; the fifty connections are an afternoon nobody records.

## What it replaces

Provisioning is a licensed feature of a station running on a Supervisor. It automates tasks on the remote hosts in that station's NiagaraNetwork — and these are mostly *platform* tasks, the kind that would otherwise mean opening a platform connection to each host in turn, or tunnelling to it.

Two consequences follow, and the second one is easy to miss.

- You need **one station connection to the Supervisor** and nothing else. The job runs from wherever you can reach that station.
- That includes a web browser. Ordinary platform tasks cannot be done from Web Workbench at all — provisioning is the exception, because the Supervisor is doing the platform work, not your client.

## Two kinds of job

The distinction matters because only one of them is suitable for anything recurring.

- A **one-shot job**, built in the Niagara Network Job Builder — the default view of the `ProvisioningNwExt` under the NiagaraNetwork. Right for a software rollout you are performing once, now.
- A **prototype job**, a `NiagaraNetworkJobPrototype` from the palette, which is reusable and can be linked to a trigger schedule. Right for anything periodic, and it can still be run on demand.
Adding the network extension also creates a set of provisioning device extensions under every Niagara station in the network automatically, including stations added later.

## What actually happens when a job runs

Reading the execution order once saves a lot of confusion later, because the step count on the progress bar moves while you watch it.

- Adjacent software-install, file-copy and upgrade steps are **combined before execution**, to avoid repeating dependency checks and to minimise reboots.
- If the job includes a licence update it runs **first and once**, as a single silent enquiry to the licensing server covering every host in the job.
- The remaining steps then run **sequentially per station**, working down the station list. A station reports Running, then Success or Failed.
- A failed step **ends that station** — no further steps run on it — and the job moves to the next one. The job as a whole reports Failed if even one step failed anywhere.
- Cancelling marks the current station and every station after it as Canceled.
The total step count changes mid-run because of that step combination, the licence step being created automatically, and the steps skipped after a failure. It is not a bug and it is not a progress bar worth staring at.

From Niagara 4.7 jobs can run in parallel across stations. The maximum is ten; the practical minimum follows the Supervisor's core count, and the ceiling is set by `Max Provisioning Threads` on the batch job service.

## The backup action almost everybody uses first

The NiagaraNetwork has a Start Backup action that backs up every station. On a site with four controllers it is fine. Tridium's own documentation recommends against it as soon as the estate grows, for three reasons.

- It builds **one enormous job** that can take a very long time.
- It loads the whole system at whatever moment somebody happened to click it, which is usually during the working day.
- **The files it leaves behind are not governed by any retention policy.** They accumulate on the Supervisor until a human deletes them, and the eventual symptom is a full disk.

> **The recommended shape instead.** Several job prototypes, each covering a subset of stations, each linked to its own trigger schedule, staggered — ten minutes apart is the documented example — and run out of hours. Each prototype then has its own retention policy, which is the part the action cannot give you.

## Retention, because jobs keep files

Provisioning persists everything by default: who submitted the job, when it started and ended, the detail of each step and its log output. For backup jobs the saved distribution file is kept too, and can be restored straight from the step log, which launches another provisioning job to do it.

That persistence is the feature and the risk. Each job prototype carries a retention policy with three shapes:

| Policy | Behaviour |
|---|---|
| Retain permanently | Nothing is ever deleted automatically. Appropriate for a one-off migration record, wrong for a nightly backup. |
| Dispose after a period | Deleted relative to the job's end time. Defaults to seven days. |
| Keep a number of executions | Keeps the most recent *n*. By default it counts only successful runs — clear the checkbox and failures count too, which changes how far back your retained history actually reaches. |

A separate enforcement frequency, one hour by default, decides how often the policy is applied, and there is an action to enforce it immediately. Disposing of a job deletes its files as well as its record — including the backup distribution file, so "tidying up the job list" is not a cosmetic operation.

## Two things to check before relying on it

Jobs can raise an alarm on failure, on success, or both. Configure failure alarms at minimum, or an unattended nightly job is only as reliable as somebody's habit of looking at a list.

And mixed estates need care: where AX-3.8 hosts share a network with Niagara 4 ones, limitations apply, largely from the security changes in N4, and job steps introduced in later versions are not always backward compatible. A provisioning job that works across the new half of the estate is not evidence that it works across the old half.

## What to set up on a Supervisor

1. **The network extension**, so every station gets its provisioning extensions without anyone remembering to add them.
2. **Backup prototypes in groups**, staggered, out of hours, each with a retention policy that matches the disk you actually have.
3. **Failure alarms** routed to somebody who reads them.
4. **One restore, proved**, from a job step log onto spare hardware — the only evidence that any of this worked.
5. **A note of the parallel thread count** you settled on, and why, so the next person does not raise it to ten on a small Supervisor.
