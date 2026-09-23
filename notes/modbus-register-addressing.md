# Why a Modbus point reads the wrong register

> Modbus decimal addressing is zero-based, vendor documentation is not, and the Address Format property decides which of the two you are typing.

Source: https://plantroomlabs.com/notes/modbus-register-addressing/  
Published: 2026-09-23 (23 September 2026) · Plantroom Labs  
Topics: Modbus, Integration, Station engineering

A Modbus point that is off by one, or reads half a number, is almost never a protocol problem. It is an addressing convention and a data type, and both are choices made at point creation.

## Four groups, and the address that identifies them

Everything a Modbus device exposes falls into one of four groups, and the leading digit of the address the vendor publishes is what tells them apart.

| Group | Address convention | Access |
|---|---|---|
| Coils | 00000 – 0nnnn, or 0x | Single-bit digital outputs. Read and write. |
| Inputs (status) | 10000 – 1nnnn, or 1x | Single-bit digital inputs. Read only. |
| Input registers | 30000 – 3nnnn, or 3x | 16-bit values the device collects from the field. Read only. |
| Holding registers | 40000 – 4nnnn, or 4x | 16-bit general-purpose values. Read and write. |

A device is under no obligation to implement all four. A meter may have holding registers and nothing else.

## The off-by-one

Decimal and hex addressing on the wire is **zero-based**: the first item in a group is item 0. So holding register 108 is addressed as 107 decimal, or 006B hex. Vendor documentation, meanwhile, almost always lists a five-digit Modbus address starting at 40001 — which is **one-based**.

Those two conventions differ by exactly one, which is why the symptom is a point that reads a plausible but wrong value rather than a fault. Coil Modbus 109 is decimal 108 and hex 6D. Read the neighbouring register of a meter and you get a number, just not the one on the label.

> **Set Address Format to Modbus and the problem disappears.** You then type the vendor's address exactly as printed, with no arithmetic. On read-only client points it also saves setting `Reg Type` at all — the leading numeral does it, 3 for input registers and 4 for holding registers. For coils the driver ignores leading zeros, so 00109 and 109 are the same address.

## The data type is a second, separate decision

Modbus does not describe its own payloads. The protocol moves 16-bit registers; what those registers mean is entirely the vendor's choice, and the only place it is written down is their documentation. Get it wrong and the point still polls happily.

| Data Type | Registers | Range |
|---|---|---|
| Integer | 1 | Unsigned 16-bit, 0 – 65,535. The default on a newly created point, and the usual reason a negative temperature reads as 65,000-something. |
| Signed Integer | 1 | −32,768 – 32,767. Sometimes called a short. |
| Float | 2 consecutive | 32-bit single precision, with two byte-order schemes to choose from (3-2-1-0 or 1-0-3-2). |
| Long | 2 consecutive | Signed 32-bit. Same byte-order choice as float. |
| Double | 4 consecutive | 64-bit double precision. Available from Niagara 4.15. |
| Long 64-bit | 4 consecutive | Signed 64-bit, with eight byte-order options. Also from 4.15. |

Two things follow from the multi-register types. The first is that byte order is configured at the device, or globally at the network — so one wrong setting scrambles every float on that device at once, which at least makes it obvious. The second is that a float consumes the register you addressed *and the next one*, so point counts and address planning have to allow for it.

Writes round before they go out. Integer and Signed Integer round to the nearest whole number and clamp to their range; Long and Long 64-bit round; Float and Double do not round at all. A write of 20.6 to an integer holding register arrives as 21, and nothing reports that it was changed.

## Bit-packed registers

Vendors routinely pack several unrelated values into one 16-bit register. The driver handles this with bit-level proxy extensions — `NumericBits` and `EnumBits` variants — where several points share the same Data Address and differ only in **Beginning Bit** and **Number Bits**.

A meter's tariff configuration is the classic case: one holding register where bits 8–15 hold the tariff number, bits 2–7 the start hour and bits 0–1 the start quarter-hour. Three points, one address, three bit windows. Reading that register as a plain integer produces a large meaningless number, which is what usually gets reported as "the meter is sending rubbish".

## There is no discovery

Unlike most drivers, the Modbus point manager has no learn mode: no Discover button, no Discovered and Database panes. The protocol carries no self-description, so there is nothing to discover. Every point is created by hand from the vendor's register map.

What the New Points window does give you is **Number To Add**, which creates consecutively addressed points from a starting address in one go. Since devices normally address related data consecutively, that covers most of a register map in a handful of operations.

> **A gap in the map is a fault, not a null.** Requesting a range that includes an unimplemented address makes the device return an illegal-data-address exception for the whole request. If holding registers stop at 40015, a read of 40003–40015 is fine and a read of 40003–40017 fails entirely — so one over-reaching point can take out a block of good ones.

## When a point goes to fault

Open the point and read `ProxyExt > Fault Cause`. It normally contains the Modbus exception verbatim, such as *Read fault: illegal data address*. That string distinguishes the three failures people conflate: the address does not exist, the device is not answering at all, and the address exists but the data type is wrong — only the first two produce a fault.

## Serving data as a slave

Running the station as a Modbus server is the mirror image, and adds one rule worth knowing before you start: **every server point must fall inside a declared register range or it sits in fault**.

The four range tables — coils, status, holding registers, input registers — each arrive from the palette enabled, with a starting address offset of 1 and a size of 64. A holding-register range with starting address 250 and size 75 covers Modbus 40250 to 40325. You can add further ranges, or disable one entirely so that a master querying it gets an exception response, which is occasionally the honest answer.

> **Do not overlap ranges.** Any given address should appear in exactly one range entry. Overlapping entries are accepted at configuration time and misbehave later.

## The order that avoids all of this

1. **Get the vendor's register map first**, with data types and byte order. Without it you are guessing, and Modbus rewards guessing with plausible numbers.
2. **Set Address Format to Modbus** before creating a single point, so the documented addresses go in unmodified.
3. **Create one point of each data type and prove it** against a known value on the device display before bulk-adding the rest.
4. **Set byte order at the device once**, and check a float reads sensibly, rather than discovering it on commissioning day.
5. **Group consecutive points deliberately**, so device polls can fetch them in single messages instead of one request per point.
