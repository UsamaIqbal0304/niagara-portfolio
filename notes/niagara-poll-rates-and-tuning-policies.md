# Why a station polls too slowly

> Slow, Normal and Fast are three numbers you choose, and one default tuning policy applied to every point is the usual reason a station feels sluggish.

Source: https://plantroomlabs.com/notes/niagara-poll-rates-and-tuning-policies/  
Published: 2026-09-23 (23 September 2026) · Plantroom Labs  
Topics: Station engineering, Performance, BACnet

Nobody ships a station that is deliberately slow. It gets slow because every proxy point was created against one default tuning policy, and nothing ever asked which of them needed to be fast.

## Where the speed is actually set

Each field-bus driver network carries a polling service — named `Poll Service` or `Poll Scheduler` depending on the driver — and it samples values at exactly three rates. The shipped intervals are:

| Rate | Default interval | What belongs here |
|---|---|---|
| Fast | 1 second | Points a control loop or an operator is watching change in real time. Very few of them. |
| Normal | 5 seconds | The working majority: temperatures, set points, status, anything on a graphic. |
| Slow | 30 seconds | Values that physically cannot move quickly, and anything only a history needs. |

> **These names mean nothing to the framework.** Slow, Normal and Fast are labels on three configurable intervals, and no logic enforces any relationship between them. A station where Slow has been set faster than Normal is misconfigured and will not complain.

There is a fourth group that is easy to miss: `Dibs Stack`, which handles pollables that transition into a subscribed state — the temporary subscription created when somebody opens a graphic, for instance. It is why a station can look responsive while an operator is watching and still be logging stale data the rest of the day.

## Which point gets which rate

This differs by driver, and it is the part that catches people moving between them.

- Under a **BacnetNetwork**, the poll frequency is a property of the *tuning policy*, and each proxy point is assigned a tuning policy. You do not set a rate on the point.
- Under **most other drivers**, `Poll Frequency` is a property of the point's own proxy extension, and of the device object where a device is pollable. It sits just below the address properties.
- The **NiagaraNetwork does not poll points at all**. Station-to-station values arrive by subscription, so a slow Niagara Network is a different investigation entirely — look at its tuning policy's update times instead.

## How a point ends up in a bucket

The rate on the drop-down is not the whole story, because the scheduler does not poll from a fixed list. Every ten seconds it rebuilds the list of objects assigned to each rate, and that has two consequences worth knowing before you decide a change did nothing.

- A rate change takes **up to ten seconds** to take effect. Watching for an instant difference will mislead you.
- The `Dibs Stack` is polled first, last-in first-out, and while anything is in it the scheduler polls as fast as it can with no inter-message delay at all. Only once it empties does the rate algorithm run.
A pollable enters the dibs stack whenever it transitions into a subscribed state. That is either a temporary subscription — somebody opening a view on a proxy point that has no links, no history extension and no alarm extension — or the first poll of a permanently subscribed point, after which it is never dibs-polled again.

So subscription decides the bucket, not the property on its own. A point that exists only to be looked at in Workbench is served by the dibs mechanism at full speed, and its configured poll frequency barely describes what you see on screen. A point with a wiresheet link, a history extension or an alarm extension is permanently subscribed and rides its rate group all day. The gap between those two is the usual reason a value looks live on a graphic and arrives stale in a history.

## The single-policy trap

A driver's Tuning Policy Map ships with one default policy, and a station built without touching it has every point in the building on that one policy. Tridium's own documentation is unusually blunt about this: using only the single default policy, particularly with all property values at defaults, can lead to problems in many scenarios.

The fix is not clever. Duplicate the default policy three or four times, name the copies after what they are for, set their poll frequency, and assign points to them as the points are created. Done at engineering time it costs nothing. Done afterwards it is a bulk re-assignment across several thousand points, which is a different note.

## The write side of the same policy

A tuning policy is not only about reads. The same component decides when a writable proxy point actually sends a value, and its defaults are the ones that catch people out.

| Property | Default | What it does |
|---|---|---|
| Min Write Time | 0, disabled | The minimum time allowed between writes. Throttles a point whose linked input changes rapidly so that only the last value goes out. At the default, every value change attempts a write. |
| Max Write Time | 0, disabled | How long to wait before rewriting the value when nothing else has triggered a write; any write resets the timer. At the default there are no timed rewrites, so a device that quietly drops a value never gets it back. |
| Write On Start | true | Writes when the station first reaches a steady state. |
| Write On Up | true | Writes when the point and its parent device transition from down to up. |
| Write On Enabled | true | Writes when the point's status transitions from disabled to normal. |
| Stale Time | 0, disabled | How long without a successful read before a value is marked stale. At the default the stale timer is off and points instead go stale the moment they are unsubscribed. |

> **Tridium's own advice on Write On Start runs against its default.** The documentation says to consider setting it to false except for critical proxy points, because large networks otherwise risk write-queue-overflow exceptions. On plant that should not be commanded by a station restart, it is the property to look at before any poll rate.

## Measure before changing anything

The polling service publishes its own statistics, and they answer the question directly rather than by feel:

- **Busy Time** — the percentage of the time the station spent polling. This is the number that tells you whether the bus is saturated or the problem is somewhere else entirely. Near 100% is not automatically a fault: it means the calculated inter-message delay has reached zero, so the poll thread never gets to sleep.
- **Average Poll** — the average time spent in each poll.
- **Total Polls**, against the elapsed milliseconds.
Right-click the poll service and use `Actions > Reset Statistics` to start a clean window before and after a change, so the comparison is between two measurements rather than between a measurement and a memory.

The fast, slow and normal **cycle times** need reading carefully. Each is the average time to complete one poll cycle, and the scheduler deliberately spreads its messages evenly across the configured interval. Five points on Normal will report a normal cycle time near 10,000 ms; that is the spacing, not ten seconds of work. Reading cycle time as effort is how a healthy bus gets blamed.

One caveat on reading them: the BACnet driver polls on multiple threads — two per network port — and the statistics are the sum across all of them. There is no per-thread breakdown, so a busy figure on a station with several trunks tells you the station is busy, not which trunk is.

## The order to work in

1. **Reset the statistics and watch Busy Time.** If it is low, the polling is not your problem and re-rating points will not help.
2. **Count what is on Fast.** Points that nobody reads at one second each are the usual cause, and moving them costs nothing.
3. **Build the policies, then re-assign.** Three or four named policies covering fast, normal, slow and write-on-start behaviour.
4. **Re-measure.** Same statistics, same reset, same window. A tuning change you did not measure is a preference.
