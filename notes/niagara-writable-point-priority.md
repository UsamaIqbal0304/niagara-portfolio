# Why a writable point ignores the value you set

> Sixteen priority inputs, two of them reserved for right-click actions, a fallback underneath, and a BACnet scheme wired to none of it.

Source: https://plantroomlabs.com/notes/niagara-writable-point-priority/  
Published: 2026-09-23 (23 September 2026) · Plantroom Labs  
Topics: Station engineering, BACnet, Commissioning

A writable point does not have a value. It has sixteen inputs, two actions and a fallback, and what appears on Out is whichever of those won. Almost every &ldquo;it will not hold&rdquo; call is a fight between two of them.

## The sixteen inputs and who owns them

Every `BooleanWritable`, `NumericWritable`, `EnumWritable` and `StringWritable` carries inputs `In1` to `In16`, level 1 highest and level 16 lowest, plus a `Fallback` property below all of them. The level names are borrowed from BACnet convention, and knowing them is the difference between picking a level and guessing one:

| Level | Convention | Notes |
|---|---|---|
| 1 | Emergency, manual life safety | Not linkable. Issued as an action. |
| 2 | Automatic life safety |  |
| 3, 4 | User defined |  |
| 5 | Critical equipment control |  |
| 6 | Minimum on/off | Reserved on a BooleanWritable for its built-in timers. |
| 7 | User defined |  |
| 8 | Override, manual operator | Not linkable. Issued as an action. |
| 9 | Demand limiting |  |
| 10 | User defined |  |
| 11 | Temperature override |  |
| 12, 13 | Stop and start optimisation |  |
| 14 | Duty cycling |  |
| 15 | Outside air optimisation |  |
| 16 | Schedule | Where a schedule normally lands, and the reason it loses to everything. |

## How the scan resolves

The priority scan runs on any input change, not on a timer. It looks for a non-auto action at level 1, then takes the value of the highest valid input from level 2 downwards, treating a non-auto action at level 8 as valid when it reaches it. If nothing qualifies, `Out` takes `Fallback`.

The word doing the work there is **valid**. An input is valid only if none of these status bits are set:

- `down` — the device behind it is not answering.
- `fault` — the value arrived, but the source says it is wrong.
- `disabled` — somebody disabled the point or its parent.
- `null` — nothing has ever been written here.
- `stale` — no successful read inside the tuning policy's stale time.
That list is the whole diagnosis for most cases. A value sitting on `In10` that never reaches `Out` is not a priority problem; it is a status problem at `In10`, or something valid above it.

> **Read the status, not the value.** A point showing the wrong number with `{ok}` is being beaten by a higher level. The same point showing the wrong number in override colour is being held by an action, and no amount of re-linking will move it.

## The linking rules

- **One link per level.** A second link to the same input is refused.
- **Levels 1 and 8 cannot be linked at all**, because they belong to the emergency and override actions.
- **Level 6 cannot be linked on a BooleanWritable**, because the minimum on/off timers own it.
Both of those last two are a change from the AX-era scheme, where a writable object took a single `priorityArray` input that several outputs could be linked into, including at duplicate levels and at levels also used by commands. Logic carried across from an AX station will not link the way it used to, and the usual workaround is a free user-defined level — 3, 4, 7 or 10 — rather than trying to reproduce the old arrangement.

## Fallback is a value an operator can change

Fallback is not a safety constant. Every writable point ships with a `Set` action that writes directly to it, and that action is available to an operator-level user by default. A setpoint that drifts overnight with nobody admitting to it is usually this.

Two things follow. If the point should fall back to nothing rather than to a number, set `Fallback` to null — which the property sheet accepts and the Set action does not — and then set the `Hidden` config flag on the Set slot from the slot sheet, or the next user puts a number back.

The other direction is the useful one. Proxy points are always read-only points, but they inherit the actions of the source point, so a NumericWritable exported over a NiagaraNetwork gives an operator a working setpoint through a `SetPoint` widget on a graphic without a second writable point being created anywhere. The kitControl constants behave the same way, except that they have no priority inputs at all and Set simply writes their output.

## The two overrides behave differently

They look like a pair in the right-click menu and they are not.

- A **manual override at level 8** prompts for a duration. Permanent is first in the list, so it is what gets clicked; the timed options and a custom hours/minutes/seconds entry are underneath it. When a timed override expires the scan returns to automatic control on its own. A maximum duration can be imposed through the point's facets.
- An **emergency override at level 1** has no duration at all. It holds until somebody right-clicks the point and chooses `Auto`. There is no expiry to wait for, and nothing in the station will clear it.
Both show override status, violet by default. On handover, the emergency level is worth restricting: by default every action except the emergency ones is available to an operator-level user, and that split is set with config flags on the action slots — editable across many points at once in the batch editor.

## BACnet priority is a different scheme

This is the one that costs a day. Niagara's sixteen levels are *patterned on* BACnet's, but there is no linkage between them. The station's priority scheme is station-centric, and writing to `In8` of a BACnet proxy point is not the same act as writing at BACnet priority 8 in the device.

When a write does not arrive, the proxy extension says so and people do not look. `Write Status` reports `read only`, `writable` or the failure text, and the classic failure is making a NumericWritable for the `presentValue` of an Analog_Input, which comes back as `Property: Write Access Denied`. A genuine BACnet error arrives in the device's own words, as error class and error code separated by a colon.

To see what the device thinks its priority array holds, add a boolean facet named `priorityArray` to the *point's* facets — not the device facets on the proxy extension. The status then carries `bac=X`, with X the level in the device that is currently winning. The same mechanism polls `statusFlags`, which merge into the point's status, plus `eventState` and `reliability`, which report as `state=` and `reliability=`. Without them the driver polls one property and an object in alarm looks perfectly healthy.

Note also `Property Array Index`. It is `-1` for any property that is not an array, which includes `presentValue`. Set it to a number only when you genuinely mean one element — proxying level 7 of a binary output's priority array, for instance.

## Exposing a writable the other way

When the station is the server rather than the client, the failure moves to permissions. The BACnet driver serves every exported object read-only through a station user called `BACnet`, which it creates itself at startup with **no permissions at all**. An external system writing to an exported NumericWritable, or invoking an action on an exported BooleanWritable, needs that user given write permission on the category the points live in — and a non-blank password, since it now holds write rights. The same permissions govern writes to exported files and histories.

## The order to work in

1. **Open the property sheet, not the graphic.** All sixteen inputs, their statuses and the fallback are on one page, and the answer is normally visible without changing anything.
2. **Find the winner.** Highest valid input, or an action at 1 or 8, or fallback. If it is an action, nothing else matters until it is auto'ed.
3. **Check the loser's status.** If your value is not winning and nothing above it is valid, it is one of the five bits — most often `null` on a link that was never made.
4. **Only then look at BACnet.** Write Status names the failure, and a `priorityArray` facet shows whose value the device is actually holding.
