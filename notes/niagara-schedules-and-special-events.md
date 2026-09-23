# Niagara schedules: special events and master copies

> Special event priority is list order, a partly-filled special event falls back to the weekly schedule, and an imported schedule cannot be edited locally.

Source: https://plantroomlabs.com/notes/niagara-schedules-and-special-events/  
Published: 2026-09-23 (23 September 2026) · Plantroom Labs  
Topics: Scheduling, Station engineering, Commissioning

Two things about Niagara scheduling surprise people on site: priority is the order of a list, and a holiday that only half covers a day quietly hands the rest back to the weekly schedule.

## Set the facets before the events

Weekly schedules come in boolean, numeric, enum and string flavours. For an enum schedule there is an ordering constraint that is easy to hit: define the range in the schedule's facets *first*, on its property sheet, before adding any events. Add events against an undefined range and you get to do them again.

## Special events belong to one schedule

Special events are exceptions to the normal week — holidays, one-off closures, a plant shutdown. They apply to weekly schedules only, and **each weekly schedule has its own**, configured on the Special Events tab of its scheduler view. The tab sits bottom-left in Workbench and top-left in a browser, which is enough of a difference to lose a few minutes the first time.

The consequence of "its own" is the part that matters on a real site: adding a bank holiday to one schedule does nothing to the other forty. That is why a building runs normally on Christmas Day in the three zones somebody missed.

## Priority is the order of the list

Every special event outranks every regular weekly event. Among special events themselves, priority is simply position in the table: top of the list wins, bottom of the list only applies where nothing above it is active during the same period. Arrow buttons move an event up or down, and that is the whole priority mechanism.

There is no numeric priority field to inspect, so a schedule that behaves oddly on one day of the year is diagnosed by reading the list in order, not by hunting for a setting.

> **An empty period is a handback, not an override.** Where a special event has no event defined, it relinquishes control to the next lower-priority special event and finally to the weekly schedule. To take a day out completely you must configure the special event for the *entire* day. A holiday defined as 08:00–18:00 off leaves the weekly schedule running either side of it.

## One calendar, many schedules

A special event can be a reference type, pointing at a calendar schedule that owns the days of occurrence. Edit that one calendar and every weekly schedule referencing it changes together.

This is the answer to the bank-holiday problem above, and it is worth setting up on day one rather than after the first missed holiday: one calendar schedule per class of non-working day, referenced by every weekly schedule, so the annual update is one edit rather than forty.

## Week 1 is not the first calendar week

When defining a recurring special event by week and day, two similar-looking options mean different things.

| Option | How the month is divided |
|---|---|
| Week 1 – Week 5 | Seven-day blocks counted from the 1st of the month, regardless of weekday. In a month starting on a Thursday, Week 1 is the 1st to the 7th. Week 5 can be shorter than seven days. |
| Calendar Week 1 – 6 | Conventional weeks ending on Saturday. If the month starts mid-week, Calendar Week 1 is only the remaining days of that week — possibly one or two. |

"First Monday of the month" is a calendar-week idea. Pick the wrong one and the event lands a week out in roughly half the months of the year, which is exactly the kind of fault that gets reported months later as intermittent.

## Master and slave schedules

Scheduling uses the driver architecture to share configuration. You import a schedule component from another station — normally the Supervisor — and the import creates a local copy you can link into control logic but **cannot edit**. Events change in the master and propagate.

On the sending side, importing creates a schedule export descriptor under the component representing the receiving station, which is where synchronisation is managed and where you look when a site is not picking up a change.

> **The read-only copy is the feature.** Somebody will eventually ask why they cannot edit the schedule on the controller. The answer is that it is a slave copy, and the alternative — forty independently editable copies of the same occupancy times — is the situation master/slave exists to prevent.

## Crossing into BACnet

The same architecture reaches BACnet devices, in both directions.

- **Import** BACnet Schedule and Calendar objects from a device and model them as schedule components in the station.
- **Export** a station schedule to existing Schedule or Calendar objects in a BACnet device, with the station acting as master.
- **Expose** station schedules as BACnet Schedule or Calendar objects for any device on the network, through the export table under the BACnet network's local device.
Third-party plant with its own scheduling therefore does not have to be scheduled twice. Deciding which side owns the times, once, is most of the integration work.

## What to settle before the schedules are built

1. **Who owns occupancy times** — the Supervisor, each controller, or a BACnet device. One answer, written down.
2. **Calendar schedules for holidays**, referenced by every weekly schedule, before the first holiday rather than after it.
3. **Full-day special events** wherever the intent is a full-day override, so nothing falls back to the weekly schedule.
4. **Permissions on special events**, which can differ from the rest of the schedule — useful when site staff may add a closure but not rewrite the week.
5. **One year rolled forward on paper.** Read the special events list top to bottom and check the priority order produces what the client described.
