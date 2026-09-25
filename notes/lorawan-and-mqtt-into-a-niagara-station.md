# Bringing LoRaWAN and MQTT data into a Niagara station

> Where abstractMqttDriver and jsonToolkit stop, and what LoRaWAN decoding, topic design, and store-and-forward buffering add on top.

Source: https://plantroomlabs.com/notes/lorawan-and-mqtt-into-a-niagara-station/  
Published: 2026-09-26 (26 September 2026) · Plantroom Labs  
Topics: Integration, LoRaWAN, MQTT

A LoRaWAN sensor and an MQTT broker are not the same problem, and neither one ends at the point most guides stop — decoding, staleness, and what happens when the link drops.

## Where the stock driver and jsonToolkit stop

The abstractMqttDriver module gets a working MQTT client: publish and subscribe points, four scalar data types, TLS on the connection. What it does and does not do is covered in a separate note, worth reading first if the driver itself is the question. jsonToolkit, in the box since 4.8, gets the other half: a JSON document can be picked apart into a Niagara point tree without writing Java for it, as long as its shape is known and stable.

Both stop at the edge of what a specification can predict. A LoRaWAN payload is not JSON: it usually arrives as bytes packed to save airtime, decoded against a per-device or per-product codec living outside Niagara entirely. A cloud platform's schema is not fixed by Niagara either; it is whatever the consumer has agreed to accept, and that changes over the life of a project. The custom work below starts at that edge, not before it.

## What arrives from a LoRaWAN network server

A LoRaWAN sensor does not talk to Niagara. It talks to a gateway, the gateway talks to a network server, and the network server is the thing with the MQTT or webhook output: separate software, running separately, with its own account and format. What lands on that output per message is a device EUI, a frame counter, radio metadata, and a payload of raw bytes, usually base64 or hex encoded — none of it an engineering value yet.

Getting from there to a Niagara point means two decisions made once, at design time: which network server's uplink shape to build against, since they are not identical, and whether the decoder that turns bytes into a temperature or a battery percentage runs on the network-server side, as a per-device codec, or on the Niagara side, as part of the driver logic. Both are workable; picking one late, after devices are already in the field, is the expensive version of this decision.

## A battery sensor is not a normal point

A BACnet AI updates on its own schedule, and its absence is a fault the driver reports. A LoRaWAN sensor reporting every 15 minutes on a battery does not work that way: an uplink that does not arrive is not a fault signal, it is silence, and silence over a duty-cycled radio link is normal often enough that treating every missed interval as an alarm produces a point that is never not in alarm.

What the point needs instead is a staleness window wider than the reporting interval — three to five missed intervals before anything is flagged — plus a last-seen timestamp kept separate from the value, so a graphic shows a reading and how long ago it arrived. A frame-counter gap is the more useful signal for a lost uplink than a timeout on its own, since it says how many messages were missed.

## Where the payload decoder lives

jsonToolkit unpacks a document once its shape is known; it does not write the codec that turns packed bytes into sensor readings and a battery voltage in the first place. That codec is manufacturer-specific: most LoRaWAN device vendors publish one, in JavaScript or as a bit-field spec, and it has to be implemented once for whichever side of the link runs it.

Running it on the network server, where most support an uploaded codec per device profile, keeps Niagara talking to fully-decoded JSON, which jsonToolkit picks up in the pattern the stock driver already supports. Running it on the Niagara side instead, as a component doing the byte-unpacking itself, is the right call when the network server cannot host custom codecs, or the decoded shape needs to change without touching that configuration. Either is buildable; the network-server side is usually cheaper unless there is a reason it cannot be used.

## Topic and payload design that survives a firmware change

A sensor firmware update changing the payload byte layout is routine, not exceptional, over a multi-year deployment. Two habits keep that from becoming a breaking change: carry a version or profile field in the decoded payload so the decoder can branch on it instead of silently misreading bytes that are no longer what they were; and separate the raw-uplink topic from the decoded-value topic, so a decoder change touches one component rather than everything already subscribing to the decoded topic.

Topic structure itself should follow the same rule as any other MQTT design on Niagara: derive it from tags, not a point name or a device model string that will not survive a hardware swap.

## When the uplink drops

A cellular backhaul on a gateway, or the WAN link out of a JACE, does not stay up indefinitely, and MQTT's own QoS levels only guarantee delivery to whatever is currently connected; they do not record what happened while nobody was connected. Store-and-forward is a design choice layered on top: a local queue that holds readings written during an outage and drains them in order once the link returns, sized to plausible outage lengths, with an explicit answer for what happens if the queue itself fills first — drop oldest, drop newest, or block upstream — as a decision, not a default nobody chose.

What that queue is built from depends on where it has to live: a persistent local store on the JACE if the controller itself is intermittently reachable, or equivalent buffering on the network-server or gateway side if the break is further upstream, closer to the sensors than to Niagara.

## TLS and per-device credentials

The default MQTT device component ships with no authenticator at all: fine for proving a connection works on a bench, dangerous left on a live broker, since anything that can reach the port can publish or subscribe as that device. TLS on the connection, and per-device credentials rather than one shared secret, are worth settling before a station goes live rather than after — a compromised or stolen sensor can then be revoked on its own instead of forcing a broker-wide rotation.

## What runs on the JACE, what needs a Supervisor or the cloud

A JACE is a controller with a fraction of a Supervisor's memory and CPU, and that budget applies to integration work the same way it applies to graphics and history: a JACE can run the MQTT client, a small store-and-forward queue, and a lightweight decoder, but it is the wrong place to aggregate readings from many controllers, or hold a queue sized for a multi-day outage. That belongs on a Supervisor, publishing once for the whole site rather than every controller holding its own broker connection — the same reason the driver's own connection limits push toward one MQTT device per site rather than one per controller.

Past the broker, the cloud-side schema — what the consumer's platform actually expects a payload to look like — is not a Niagara decision at all; it is agreed with whoever owns that platform, and the Niagara side is built to produce exactly that shape rather than something close to it that needs a translation layer on the other end. Decoders, network-server integration, topic and schema design, and store-and-forward buffering of this kind are scoped as part of [custom module and driver development](https://plantroomlabs.com/services/niagara-modules/).
