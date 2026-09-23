# Why an alarm never reached anybody

> Detection, class and recipient are three separate objects in a Niagara station. An alarm goes missing wherever the chain between them is not linked.

Source: https://plantroomlabs.com/notes/niagara-alarm-routing/  
Published: 2026-09-23 (23 September 2026) · Plantroom Labs  
Topics: Alarms, Station engineering, Commissioning

An alarm that nobody received is rarely an alarm that was never raised. It was raised, stored, and routed nowhere &mdash; because routing is a link somebody has to draw.

## Three objects, not one

Niagara splits alarming into three things that are configured independently, and the split is the reason alarms go quiet.

- An **alarm extension** on a point decides *when* a condition is an alarm.
- An **alarm class** groups alarms that share handling — acknowledgement, priority, escalation — and is the thing that routes.
- An **alarm recipient** delivers: to a console, to another station, to email, to an on-call rota.
Break the chain at any point and the station carries on perfectly. The extension still fires, the alarm still lands in the database, the counts on the alarm class still increment. It simply never becomes anybody's problem.

## Choosing the extension that matches the failure

There are more extension types than most stations use, and the common reflex — an out-of-range extension on everything — misses whole categories of fault.

| Extension | What it catches |
|---|---|
| Out Of Range | Numeric high and low limits with a deadband. The default choice, and the right one for a measured value with absolute limits. |
| Float Limit | Limits expressed *relative to a setpoint* rather than as absolutes. This is the one people want when they say "alarm if it cannot hold setpoint" and reach for Out Of Range instead. |
| Status | Fires on any combination of status flags — fault, down, stale, overridden, null. Applies to any point type. This is how you find out a sensor died rather than reading zero degrees forever. |
| Command Failure | Boolean or enum. Compares the commanded value against a linked `feedbackValue` and alarms if they disagree for longer than the time delay. The only honest way to know a damper actually moved. |
| Change Of State / Value | Boolean, enum, numeric and string variants, for conditions defined by a set of values rather than a range. The boolean and enum versions implement the BACnet change-of-state algorithm. |
| Elapsed Active Time Change Of State Count | In the `kitControl` palette. Alarm on accumulated runtime or on accumulated starts — maintenance alarms rather than fault alarms. Both reference a totaliser extension under the same point. |

> **Every extension carries two algorithms.** An offnormal algorithm and a fault algorithm sit inside each one. The fault algorithm's default implementation raises nothing, so a point can be in fault without generating a fault alarm unless you configure it or add a status extension.

## What the alarm class actually controls

The class is where acknowledgement, priority and escalation live. Priority runs 1 to 255 with a default of **255**, which is the lowest — so a station where nobody set priorities has every alarm at the bottom of the queue, and the colour coding operators rely on is meaningless.

The class also carries read-only counters worth looking at during commissioning: total alarm count, open alarm count, in-alarm count, unacknowledged count, and the time of the last alarm. If those numbers are climbing and nobody is receiving anything, the detection half is working and the routing half is not. That single observation cuts the diagnosis in half.

## Escalation, and why it needs somewhere to go

Three escalation levels re-route an alarm that stays unacknowledged. Each has an enable flag, on by default, and a delay measured in hours and minutes with a one-minute minimum. An alarm that survives all three has been offered to as many as four recipients including the original; acknowledgement at any level stops the chain.

Enabled by default, with no recipient linked at any level, means escalation is switched on and pointed at nothing. It costs nothing and does nothing, which is the worst combination because it looks configured.

## Recipients, and one that does not exist on a controller

Recipients are linked from the alarm class's alarm topic to the recipient's Alarm action. Each can be restricted by time of day, by day of week, and to specific transitions — so a recipient that is silent at 3am may be working exactly as configured.

- **Console** moves alarms between the alarm history and the alarm console, and updates the history when they are acknowledged.
- **Station** forwards to a remote station, which is how a controller gets alarms to a Supervisor.
- **Email**, **SMS** and **on-call** deliver to people rather than to software.
- **Printer** and **line printer** require a station running on Windows. On a QNX controller they are not an option, which is worth knowing before it appears in a specification.

> **Tridium's own advice is to use more than one class.** One alarm class routing to a console recipient and a station recipient; a separate class routing to email. Trying to make a single class serve both leaves you filtering at the recipient for something the class should have separated.

## Station to station: the link everybody forgets

Getting alarms from a controller to a Supervisor needs configuration at both ends. In the sending station, an alarm class and a station recipient in the `AlarmService`, linked together. The two stations do not have to use the same class names, though matching them is one legitimate approach; the receiving side can also collapse everything onto one local class, or use a prepend or append naming scheme to map classes by name.

> **In the receiving station, link the alarm class to the alarm console.** Remote alarms arrive, are stored, and do not appear in any console unless the associated alarm class is linked to the console component. This is the single most common reason a Supervisor shows nothing while the controllers are alarming correctly — and because the data is present in the database, it looks like a display bug rather than a missing link.

## Reassigning classes without opening every point

Alarm extensions are scattered across hundreds of points, so changing a class point by point is not viable on a real station. The `AlarmService` has an **Alarm Ext Manager** view that lists every alarm extension in the station; select any number of them, right-click, and set the alarm class in one operation.

For alarms arriving from subsystems with their own class names, alarm class mapping lets you associate imported classes with local definitions so they display, sort and sound consistently instead of forming a separate vocabulary in the console.

## A commissioning check that takes ten minutes

1. **Force one alarm of each class** and confirm it arrives at every recipient that class is meant to reach. Not one alarm — one per class.
2. **Check the class counters afterwards.** Rising counts with no delivery is a routing fault; flat counts is a detection fault.
3. **Leave one unacknowledged past the first escalation delay** and confirm level 1 goes somewhere.
4. **Confirm the Supervisor console shows it**, not just the Supervisor database.
5. **Check who can clear the alarm database.** The maintenance view can delete records outright; operators should have the read-only alarm database view instead.
6. **Write alarm instructions on the points that matter**, so the operator receiving the alarm at 3am is told what to do about it.
