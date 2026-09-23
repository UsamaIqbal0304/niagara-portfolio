# A JACE-8000 has no onboard I/O: using the Nrio driver

> Remote IO-R modules on RS-485, one network per port, and the conversion list Workbench will happily let you get wrong.

Source: https://plantroomlabs.com/notes/nrio-io-on-a-jace-8000/  
Published: 2026-09-23 (23 September 2026) · Plantroom Labs  
Topics: JACE, Drivers, Commissioning

Anyone arriving from a JACE-6 or -7 expects terminals on the controller. On a JACE-8000 there are none — the I/O is remote modules on an RS-485 trunk, and the driver is engineered accordingly.

## What actually connects

The Nrio driver started life serving integral I/O on an M2M JACE, and grew remote modules later; from 4.3 it supports IO-R-16 and IO-R-34 modules wired to a JACE-8000. There is no onboard-I/O case for this controller, only remote modules on RS-485, so every point comes in over a trunk.

Architecturally it is a normal driver: network → module → points extension → proxy points, under Drivers, with Learn Mode discovery in the manager views. The one structural difference is that `points` is the *only* device extension an NrioModule has. There is no alarm or history extension at device level, no virtual component space — configuring and proxying hardware terminals is all the driver is for.

The `nrio` module has to be installed on the controller. If it is not, adding the network fails with an explicit missing-module error rather than anything subtle, so it is a five-second thing to rule out.

## Port Name and Trunk decide which wires you are talking to

Two properties on the network do the real work, and both are on the property sheet rather than anywhere obvious. **Port Name** names the physical port, and the legal value depends on the controller.

| Controller | Onboard I/O | Onboard RS-485 | RS-485 option card, ports A & B |
|---|---|---|---|
| JACE-8000 | — | COM1, COM2 | — |
| JACE-7 series | — | COM2 | COM3, COM4 |
| M2M JACE | COM3 | COM2 | COM7, COM8 |

**Trunk** is a number, unique per network, starting at 1. It selects the low-level access-control daemon that does the actual polling, which is why two networks sharing a trunk value do not merely look untidy — they fight. Both properties are writable on an `NrioNetwork`; on the older `M2mIoNetwork` they are fixed at COM3 and 1.

Each separate access path needs its own network. Two ports with modules on them is two NrioNetworks, not one network with more devices under it.

## Sixteen addresses, and a board that uses two of them

Every module on a network holds an Address from 1 to 16. An IO-R-34 takes *two* of those slots, because it is physically two controllers on one board: the Nrio Device Manager shows the primary in the Address column and the second in SecAddr. Plan the trunk with that in mind — three 34-point modules is six addresses, not three.

Address is not something you type. It is derived during an online Discover, along with the module's Uid, a six-byte identifier burned in at manufacture, and both are read-only afterwards. The practical consequence is that the station cannot be finished without the hardware present — which is what the next section is about.

## Universal inputs are configured in software

No jumpers, no DIP switches: a UI terminal becomes an input type when you pick the type in the Add dialog of the Nrio Point Manager. Five choices, and the one you pick determines the proxy extension.

| Type | Reads | Produces |
|---|---|---|
| VoltageInputPoint | 0–10 Vdc | volts, or scaled units — also the choice for 4–20 mA |
| ResistiveInputPoint | 0–100 kΩ | ohms, or scaled units |
| ThermistorInputPoint | a thermistor | temperature, through a response curve |
| CounterInputPoint | contact closures | a running total or a calculated rate |
| BooleanInputPoint | a contact | two boolean states |

Outputs get no such choice: a discovered relay terminal becomes a RelayOutputWritable and an analogue terminal a VoltageOutputWritable, both preselected, both with the ordinary writable priority array behind them.

> **The type cannot be changed after the point is added.** Name, address, conversion and facets are all editable; type is not. Getting it wrong means deleting the point and adding it again, which takes the alarm extensions, history extensions and links with it. The single exception is resistive versus thermistor — those are the same point with a different conversion, so that one is recoverable.

## Conversions, and the list that does not filter itself

Workbench offers the full Conversion drop-down on every Nrio point regardless of type, so a relay output will cheerfully offer you Thermistor Type 3. Only a few combinations mean anything.

**Linear** takes a Scale and an Offset and is what most 0–10 V and resistive sensors want. **Thermistor Type 3** is the built-in resistance-to-temperature curve. **Generic Tabular** takes a custom source-and-result curve as an XML file, for a sensor that is not linear and not a standard thermistor.

**500 Ohm Shunt** is the interesting one. A 4–20 mA sensor is read on a UI with a 500 Ω resistor across the terminals, making the signal 2–10 V, and this conversion exists because the input circuit clamps protectively above 3.9 V — a plain Linear conversion loses resolution at the top of the range where the clamping happens. Selecting it produces a *second* conversion drop-down, again showing everything, of which exactly two entries are valid: Linear for the usual linear sensor, Generic Tabular for a non-linear one. If you feed the tabular route a curve, the source values run 0 to 10, each milliamp figure multiplied by 500.

> **Leave a counter's conversion on Default.** Anything else interferes with the rate calculation. To scale the count, add a LinearCalibrationExt to the point instead and put the quantity-per-pulse in its Scale.

The rate itself is worth setting up rather than computing downstream. A counter outputs either Count or Rate, chosen with Output Select, and the rate Scale folds the time unit and the pulse weight together: a meter at 0.15 kWh per pulse reporting kW is 3600 × 0.15 = 54; a flow meter at 0.375 litres per pulse reporting litres per minute is 60 × 0.375 = 22.5. Three calculators are available — fixed window (the default), sliding window, and trigger — with an Interval property on the first two and a Windows count on the sliding one.

## Engineering before the hardware exists

Because addresses come from Discover, a station cannot be fully built from a desk — but it can be built almost all the way. The Nrio Device Manager has an **Add Offline Hardware** button (you still need a station connection, just not the I/O) that creates a module with Address and Uid both zero and a fault reading "Invalid UID: Do Discover and Match." Under it you can still discover and add points, add history and alarm extensions, and link the lot into control logic. Everything sits in fault until the hardware turns up.

1. On site, connect and open the Nrio Device Manager in Learn mode. The real modules appear in the discovered pane.
2. Right-click a discovered module and **Wink** it. It cycles its first relay output on and off for ten seconds, which is how you tell which panel you are looking at.
3. **Match** the winked module to the offline one you created. It takes the real Uid and address, the fault clears, and the discovered entry greys out so it cannot be matched twice.
4. Repeat for each module, then hide the `winkDevice` slot from the module's slot sheet. Wink drives a real output, and there is no reason to leave that one right-click away for the next three years.

## What the outputs do when the JACE stops talking

Remote I/O introduces a failure mode onboard terminals do not have: the trunk can go quiet while the plant carries on. From 4.3 the network carries an Output Failsafe Config with two timers that every child module inherits.

| Property | Range and default | What it governs |
|---|---|---|
| Comm Loss Timeout | 8–900 s, default 8 | how long silence lasts before the module declares comm loss and applies its default output values |
| Startup Timeout | 8–900 s, default 600 | how long a module waits after power-up for the station to take control before it does the same |

The ten-minute startup default is deliberate: it is long enough for a controller to boot and a station to start after a site power cut, so the plant does not snap to failsafe values in the gap. Either timer can be disabled per module in its OutputDefaultValues component — which is occasionally right and usually worth arguing about, because the defaults it disables are the only thing deciding whether a valve sits open or shut when the trunk fails.
