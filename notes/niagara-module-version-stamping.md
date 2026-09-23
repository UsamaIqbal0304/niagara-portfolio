# Which Niagara version to stamp a module for

> A module's declared dependency version is a floor, not a pin. Build against the newest SDK you have and stamp for the oldest station it has to load on.

Source: https://plantroomlabs.com/notes/niagara-module-version-stamping/  
Published: 2026-09-22 (22 September 2026) · Plantroom Labs  
Topics: Module development, Mixed estates, Build tooling

A module that refuses to install with a dependency error is usually not incompatible. It is stamped too high — and the fix is a build flag, not a port.

## The failure this prevents

You build a module on a development machine, sign it, push it to a controller, and the Software Manager refuses it with a dependency error naming a Niagara version higher than the one the controller runs. Nothing is wrong with the code. The module has simply declared that it needs a newer framework than it actually needs.

This is the single most common reason a perfectly good module will not install on an estate that was not all commissioned in the same year — and most estates were not.

## What the declared version actually means

A module declares what it needs in `module.xml`, as a set of dependencies each carrying a vendor version. That version is a **minimum**. It says "do not load me on anything older than this". It does not say "load me only on this".

So a module stamped at the version of the SDK that happened to be installed on the build machine will install on that version and everything newer, and be refused everywhere older. Stamp the same module at the oldest version in the estate and it installs across the whole estate, including everything newer.

> **The rule.** Compile against the newest SDK you have. Stamp for the oldest station the module has to run on. These are two separate decisions and the build should let you make them separately.

## Why compiling on a newer SDK is usually safe

The instinct is that building on a newer framework must produce something the older one cannot load. Within a single Niagara generation that is rarely true, for two reasons.

The first is the Java level: it is constant across the generation, so the bytecode a newer SDK emits is bytecode an older station's JVM already understands. The second is that most module code touches a small, old, stable part of the API — component and property declarations, ORD resolution, BQL, the driver framework. That surface has barely moved.

The claim is checkable rather than hopeful. Walk the constant pool of the built jar, list every framework class and method it references, and compare that against the API present in the oldest target. If the list contains nothing introduced after the floor version, the module will load. If it does contain something newer, you have found the real incompatibility instead of guessing at one.

## Where it does bite

Two places, in practice.

| Area | What to watch |
|---|---|
| Browser CSS | Workbench embeds a browser engine, and an older Workbench embeds an older one. A `ux` widget using recent CSS — container queries, modern selector features — can look correct in a current browser and broken inside an older Workbench. The station is not the constraint here; the viewing engine is. |
| New API | If the code genuinely calls something that did not exist at the floor version, no stamp will save it. Either guard the call and degrade, or ship two builds. Knowing which of the two you are in is the point of checking the jar's API surface. |

## How to make this routine

Make the target version an argument to the build rather than something inherited from whatever is installed. A build that defaults to the developer's own installation will quietly produce a module that only works on the developer's own installation, and nobody finds out until it is in front of a customer.

Then record the floor version in the delivery note, so that when the estate gains a controller two generations older than anything else on site, the question "will this load" has a written answer.
