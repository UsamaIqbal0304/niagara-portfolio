# BACnet MS/TP on a JACE

> Baud, MAC address, Max Master and Max Info Frames. Four settings on one Link component decide whether an RS-485 trunk works, crawls or drops the token.

Source: https://plantroomlabs.com/notes/bacnet-mstp-on-a-jace/  
Published: 2026-09-23 (23 September 2026) · Plantroom Labs  
Topics: BACnet, MS/TP, Commissioning

An MS/TP trunk that will not come up is rarely a wiring fault by the time anyone calls. It is usually one of four properties on the Link component, or a licence.

## What MS/TP is, in one paragraph

MS/TP — master slave / token passing — is BACnet's link layer for RS-485 multidrop wiring, used by the cheaper end of the device range. A token circulates between master devices and only the holder may transmit. Everything that goes wrong on a trunk is a consequence of that sentence: throughput is shared, one misbehaving device slows every other one, and the network's speed is set by its slowest participant.

> **Check the licence before the wiring.** A QNX-based controller supports direct MS/TP trunks — one per RS-485 port — *if it is licensed for MS/TP*. A port that refuses to come up on a controller that has never run MS/TP before is worth ruling out in thirty seconds, not after half a day with a meter.

## Where the port lives

An `MstpPort` is dragged from the `bacnet` palette's NetworkPorts node into `BacnetNetwork > Bacnet Comm > Network`. Two things get configured, and they are at different levels:

- On the **MstpPort** itself, the `Network Number`. On an existing installation this must match the number already in use for that segment — a duplicate or wrong network number produces symptoms that look like anything except a number.
- On the **Link** component beneath it, everything physical.

## The four properties that decide everything

| Property | Default | What it does to you |
|---|---|---|
| Port Name | none | Which physical RS-485 port. `COM3` for a standard option card; `COM3`, `COM4` or `COM5` with a dual-RS-485 card, to a maximum of three ports on one station. |
| Baud Rate | 9600 | Must match every device on the trunk. 9600 is the shipped value and, on most modern trunks, four times slower than the devices can manage — but one device that cannot go faster sets the ceiling for all of them. |
| Mstp Address | 0 | The station's BACnet MAC on the trunk, 0–127, and it must be unique on the segment. Leaving it at 0 is a deliberate choice, not laziness — see below. |
| Max Master | — | The highest master address the token will be offered to. Set it to the highest address actually in use plus a little room, not to 127. |

Two more are worth knowing about. `Max Info Frames` controls how many messages the station sends before it passes the token on; the documented range is 0 to 100, and raising it towards 50 can improve throughput where the station is the busiest talker on the trunk. `Support Extended Frames` is off by default and enables larger frames, which helps only if the devices on the trunk support them.

## Why Max Master is the one people get wrong

Each master polls for a successor up the address range as far as Max Master before the token comes back round. Leave it at 127 on a trunk with eight devices addressed 1–8 and most of the token loop is spent offering the token to 119 addresses that do not exist. The trunk works. It is simply slower than it needs to be, permanently, and nothing anywhere reports it as a fault.

Set it on *every* master on the segment, not only on the station — the setting is per-device, and one device left at 127 keeps the long loop.

## What address 0 actually buys you

If the token is ever lost, the device with the lowest MAC address regenerates it. Leaving the station at address 0 makes the station that device, which is normally what you want: it is the participant you can see the status of, restart, and take a backup of. Whatever you choose, confirm no other device on the trunk is already using it — a duplicate MAC is the classic cause of a trunk that works, intermittently, in a way that looks like noise.

## Bringing it up

1. **Save the Link changes** before doing anything else; the port does not pick them up otherwise.
2. **Right-click the MstpPort and run Actions > Enable.** Its Status should report `{ok}`. Anything else, and no amount of device discovery will help.
3. **Then discover.** A device that does not appear after the port is healthy is a baud, MAC or Max Master problem on the device, in that order.
4. **Record the trunk.** Addresses, baud, Max Master and which port — on the drawing, not in somebody's head. The next person on site has a meter and no idea what address 12 is.
