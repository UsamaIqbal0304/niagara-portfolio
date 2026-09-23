# Getting data out of a Niagara station

> REST, MQTT, a relational history database, file export or an HTTP client. Which suits which consumer, and what each one costs you to run.

Source: https://plantroomlabs.com/notes/getting-data-out-of-a-niagara-station/  
Published: 2026-09-22 (22 September 2026) · Plantroom Labs  
Topics: Integration, Histories, MQTT

Six separate third-party products exist to push station data somewhere else, which tells you how often this comes up — and that the stock answers are not well known.

## Answer four questions first

Most bad integrations are a good mechanism chosen for the wrong shape of problem. Before picking one, settle: **who consumes it** (a person, a dashboard, a data team, another control system), **push or pull**, **live values or history**, and **how often**. Those four answers usually eliminate three of the five options immediately.

## The five routes

| Route | Suits | Costs you |
|---|---|---|
| REST / oBIX | Another system that wants to *ask* for values, on its own schedule. Standardised, so the consumer may already speak it. | Verbose, and every consumer is one more thing authenticating against the station. Poor fit for high-frequency polling. |
| MQTT | Push to a broker, and from there to anything. The natural fit for cloud platforms and for many consumers of the same data. | A broker to run and secure, and a topic and payload design that you will live with far longer than you expect. |
| History to a database | Reporting and analytics over long periods. A data team that already has SQL tooling wants this and nothing else. | A database to own, and a real decision about retention on both sides so the same trend is not stored twice forever. |
| File / CSV export | One-off extracts, hand-offs, and the finance or operations person who wants a spreadsheet and is right to. | Nothing is live, and files quietly become an interface that somebody starts depending on. |
| Outbound HTTP | Events rather than data: an alarm into a chat channel, a condition into a ticketing system, a webhook into somebody's API. | Retry, failure and back-pressure behaviour are yours to design. A station that blocks on a slow endpoint is a control problem, not an IT one. |

> **Events are not telemetry.** The most common mistake is pushing every point change into a channel built for notifications. Route state changes worth a human's attention over HTTP; route data over MQTT or into a database.

## What to decide before the first message

1. **Naming and topic structure.** Whatever you emit first is what the consumer builds against, and changing it later is a coordinated release across two systems. Derive it from tags rather than point names — see [renaming and tagging in bulk](https://plantroomlabs.com/notes/bulk-point-renaming-and-tagging/).
2. **Units and timestamps.** Send the unit and send time as UTC. Ambiguity here is discovered months later, in a report, by someone who cannot tell whether the building really used that much.
3. **Change-of-value, not polling.** Publishing on change with a heartbeat gives the consumer both liveness and a fraction of the traffic. A timer loop is easier to write and worse at everything else.
4. **What happens when the far end is down.** Queue, drop, or block — pick deliberately. The default is usually the one you would not have chosen.

## On the controller specifically

If the station doing the publishing is a controller rather than a Supervisor, the budget from [what runs on a JACE](https://plantroomlabs.com/notes/what-runs-on-a-jace/) applies to the integration too. Aggregating at a Supervisor and publishing once is usually better than every controller holding its own connection to a broker or a cloud endpoint.
