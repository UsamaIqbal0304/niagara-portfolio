# What the Niagara MQTT driver will and will not do

> It is licensed, it is capped below your licence, it is a client only, and its Discover button never contacts the broker.

Source: https://plantroomlabs.com/notes/niagara-mqtt-driver/  
Published: 2026-09-23 (23 September 2026) · Plantroom Labs  
Topics: Integration, MQTT, Drivers

MQTT is the protocol people reach for when a vendor has a cloud and no driver. Niagara ships one, and it does less and more than the name suggests — the surprises are all in the first afternoon.

## Licensed, and capped below the licence

The `abstractMqttDriver` module is a licensed feature. Open License Manager and look for the feature by name: if it is absent, the palette will still open and the network will still install, and nothing will work. That is worth confirming before a design depends on it.

There is a second ceiling underneath the licence. Since 4.10u10 and 4.14u1 the driver applies a default device connection limit of **25 on a JACE and 50 on a Supervisor**, regardless of what the GlobalCapacity licence allows. The limit exists to protect driver performance, and only the Supervisor's is configurable — to a maximum of 500. A design that assumed one MQTT device per tenant meter is the design that discovers this.

> **Niagara configures the client, never the broker.** There is no broker in the station and none is going to appear. Somebody has to own a broker before any of this is testable, and on most projects working out who is the longest part of the job.

## What it can carry

Four data types, and no others: Boolean, numeric, string and enum. Anything structured — a JSON document with six fields in it, which is what most vendor cloud topics actually publish — has to be taken apart somewhere. The driver will not do it, so either the publisher changes shape or a module does the parsing, and that decision belongs at design time rather than on site.

The device component comes in four kinds. `DefaultMqttDevice` is the generic client for any broker and is the one to use; `AwsMqttDevice` and `GcpMqttDevice` are shaped for AWS IoT and Google Cloud, with their own certificate and RSA-key authenticators, and Azure IoT Hub is reached through a SAS token authenticator on the default device. From 4.14 the default device and authenticator also support client certificate authentication.

`AbstractMqttDevice` is the fourth, and it is the one to be careful about: it differs from the others only in that it has **no authenticator at all**, and therefore no communication security. It is a testing component that survives into production because it connects first time.

## Discover does not contact the broker

This is the one that wastes an afternoon. The Mqtt Client Driver Point Manager has a Discover button, and pressing it opens the **BQL Query Builder**. It runs a query against points in your own station and lists what it finds, so that you can publish them. It does not enumerate topics, it does not ask the broker anything, and no amount of fixing the connection will make it behave like BACnet discovery.

Anything arriving *from* the broker is added by hand, from the `abstractMqttDriver` palette or the point manager's New button, with the topic typed in. That is not a defect — it follows from MQTT itself, where a broker has no obligation to tell a client what exists — but it does mean a hundred-point integration is a hundred rows of typing, which is what a spreadsheet and the batch editor are for.

## Publish and subscribe are different components

Each data type has a publish extension and a subscribe extension, and they are not interchangeable. Publishing is a wire-sheet act: drop a publish point under the device's `Points` folder and link the source point's output into it.

| Property | Publish | Subscribe |
|---|---|---|
| Topic | Yes | Yes |
| QoS | Yes | Yes |
| Retained | Yes, default true | — |
| Publish Message on Change | Yes, default true | — |

A topic is levels separated by forward slashes, and it is typed, not chosen — a typo is a point that never updates and never faults. QoS is per message: `0` fire and forget, `1` at least once with confirmation, `2` exactly once through a four-step handshake. A publisher and a subscriber may use different levels on the same topic.

`Retained` defaults to true on publish, which means the broker keeps the last message and hands it to anyone who subscribes later. For plant status that is what you want. For a command topic it is not — a retained command is redelivered to every client that connects, including after a restart.

## The device settings that decide whether it survives the night

- **Clean Session**, default false, so the session is persistent and the broker delivers queued messages when the client returns. Setting it true throws away everything on every disconnect.
- **Keep Alive** is the longest the client may stay silent. It sends a PINGREQ inside that window and the broker must disconnect it if nothing arrives. It exists specifically to deal with half-open connections — the failure where both ends believe they are connected and nothing is moving.
- **Connection Timeout** caps how long the client waits on a request to the broker.
- **Enable LWT** is **false by default**, so out of the box nothing tells the broker this station has dropped. Turn it on and the last will and testament is published on the client's behalf; Retained for LWT defaults to true, so a late subscriber still learns the station is gone.
- **Send Enum As** chooses between the tag and the ordinal. TAG is the default and is what a human reading the topic wants; an ordinal is what a downstream system expecting a number wants. Changing it later changes every payload.

> **Connect does nothing until the address is filled in.** The Connect and Disconnect actions need the broker IP address, the port and a Client ID present on the device first. An action that appears to do nothing is usually a blank field, not a broker problem.

## The order to work in

1. **Confirm the licence feature, then the connection count.** Both are cheaper to find now than after the point schedule is agreed.
2. **Settle the payload shape with whoever owns the broker.** Four scalar types is the whole vocabulary; if the topics carry JSON objects, decide then who unpacks them.
3. **Bring one point up in each direction.** One publish, one subscribe, on a real broker. Everything after that is repetition.
4. **Set Keep Alive and LWT before handover**, not after the first silent disconnection.
