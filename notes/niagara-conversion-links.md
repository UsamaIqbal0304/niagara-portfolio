# Conversion links: what a mismatched wire really does

> Link a boolean to a numeric and Niagara inserts a converter with its own properties. Here is what each one assumes on your behalf.

Source: https://plantroomlabs.com/notes/niagara-conversion-links/  
Published: 2026-09-23 (23 September 2026) · Plantroom Labs  
Topics: Station engineering, Wire sheet, Workbench

Drag a wire between two slots of different types and it just works, which is the problem: a converter was inserted, it has settings you did not choose, and null does not behave the way you expect.

## The wire that converts itself

Since AX-3.6, linking two slots of dissimilar data types produces a conversion link automatically. Before that the same job needed a Program object, which is why older stations are full of them. The link is not a plain wire: it carries a child Converter component whose type is chosen for you from the pair of types involved, and some of those converters have properties.

To see one, right-click the wire on the wire sheet and choose **Edit Link**. If the link shows as a knob rather than a wire — which is what happens when the other end is off-sheet — open the component's link sheet and double-click the row. The Converter appears as an expandable node inside the Edit dialog.

This is worth doing deliberately rather than never. A conversion link is not wrong, it is just silent, and the defaults are only right some of the time.

## Not every pair is allowed

The conversion matrix is wide but not complete, and the holes are the useful part to remember. A link Niagara will not make is one you have to solve with a component, so knowing the gaps saves a wire-sheet argument.

| Type | What it will not do |
|---|---|
| `frozenEnum` | nothing can convert *into* it — its whole row of the matrix is blank. It converts outwards to everything except ord and the time types |
| `ord` | exchanges only with string and statusString, both directions, and with no validation in either |
| `boolean` | no conversion either way with any time type |
| `statusEnum`, `dynamicEnum` | reachable from booleans, numbers and other enums, but never from a string or a statusString |
| `time` | arrives only from the plain number types and absTime — statusNumeric cannot reach it, though it can reach absTime and relTime |
| `relTime` | arrives from numbers and statusNumeric; leaves as numbers, statusNumeric or a string — never a boolean or an enum |

## Booleans, numbers, and the False Value property

The everyday case is a boolean driving something numeric. A statusBoolean linked to a statusNumeric gives 1 for active and 0 for inactive, and that is usually what you wanted. Where the target is a plain number type, the Converter carries **True Value** and **False Value** properties, defaulting to 1 and 0 — and those exist because the defaults are frequently useless. Driving a MultiVibrator's Duty Cycle, which runs 0 to 100, means editing them to something like 75 and 25 rather than adding arithmetic downstream.

Going the other way, a number linked to a boolean uses a False Value with a default of 0: *anything else* is true. Worth saying out loud that this includes negative numbers, so a sensor reading -4 is true, not false. If the meaningful off-state is some other value, set False Value to it.

Number to number is unremarkable except at the edges, where the result clamps rather than wrapping. A double of 2147484000 into an integer slot lands on 2147483647, the integer maximum, with nothing to indicate it happened.

## Strings are where it goes wrong

String conversions are the ones to be suspicious of, because each failure mode is different and none of them is loud.

| Link | What bad input produces |
|---|---|
| string → double or float | `nan` — anything that is not a plain decimal number, blank included |
| string → long or integer | 0, or the last non-zero value, if there are any extra characters |
| string → statusNumeric | a **fault** on the target, with the value left unchanged |
| string → boolean | true, for everything except the False Value string (default "`false`", case insensitive) — and a blank string is *true* |
| string → absTime | null, unless the string is ISO-formatted (`yyyy-mm-ddThh:mm:ss.mmm±hh:mm`) |
| string → ord | whatever you gave it — there is no ORD validation at all |

The pattern to notice is that the three numeric targets fail three different ways: one gives a not-a-number, one silently holds its last value, one raises a fault. Only the statusNumeric case is visible on a graphic. If a string from a third-party integration is feeding logic, that is the target type to prefer, purely because it tells you when the parse failed.

## Null is not zero

Every status type can be null, and what a conversion does with null is decided per target type rather than uniformly. This is the trap that produces plant running on stale values after a device goes offline.

| Target | On a null source |
|---|---|
| double, float | becomes `nan` |
| long, integer | **unchanged** — keeps the last value |
| string | **unchanged** — keeps the last text |
| boolean | **unchanged** |
| statusBoolean, statusNumeric, statusEnum, statusString | becomes null, so the status propagates |
| absTime | becomes null |
| relTime | **unchanged** |

> **Convert between status types wherever the value matters.** The simple types have nowhere to put a status, so the only honest thing a converter can do is leave the old value in place — which downstream logic cannot distinguish from a live reading. A chain that drops to `boolean` or `integer` halfway along has thrown away the fault flag for good.

## Times are milliseconds, from three different origins

All the time conversions are millisecond arithmetic; what differs is where zero sits. To `relTime`, milliseconds count from 0, so 4800000 is 1h 20m and a negative value is allowed. To `time`, they count from midnight, so 900000 is 00:15. To `absTime`, they count from the Java epoch, so 1296509138929 lands in January 2011.

The reverse directions mirror that: relTime and time to a number give milliseconds from their own origin, absTime gives milliseconds since the epoch. Two special cases are handy — absTime to time keeps the time portion and drops the date, and time to absTime takes today's date, which is the shortest route from a schedule-style time to a real timestamp.

## Formatting on the way to a string

Any conversion whose target is a string or statusString has a `Format` property, and its default depends on the source.

From a number it is blank, meaning every digit, unformatted. Fill it in with `#` for digits, `0` for forced leading or trailing zeros, and comma or period as separators: `###,###.###` turns 123456.789 into 123,456.789, `###,##` turns it into 123456.79, and `00000.000` turns 123.78 into 000123.780.

From a boolean the default is `%.%`, which is BFormat — so static text can be wrapped around the value, and a format of `Enabled: %.%` produces exactly that. From absTime the default is `YYYY-MM-DDTHH:mm:ssZ` and from time it is `HH:mm:ssZ`; both accept the usual patterns, so `HH:mm a` gives 3:31 PM and `MM-DD-YYYY HH:mm` reorders the date.

Enums are the pleasant surprise here. A statusEnum linked to a string gives the tag rather than the ordinal — "Occupied", not "1" — which is usually what a graphic or an alarm message wanted. Link it to a number and you get the ordinal instead.

## The one link you do have to edit by hand

Conversion links are otherwise a leave-alone feature, with one documented exception: linking out of the dynamically created components under a station's PlatformServices. Those components are built at runtime rather than stored, so a link that identifies its source by Handle points at something that will not exist the same way next start. Open the link and change **Source Ord** from Handle to Slot, and it survives.
