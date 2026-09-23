# Pure Java, or it will not run on a JACE

> A controller is an ARM host with a fraction of a server's memory. Native libraries, JNI and heavyweight dependencies do not survive the move from a PC.

Source: https://plantroomlabs.com/notes/what-runs-on-a-jace/  
Published: 2026-09-22 (22 September 2026) · Plantroom Labs  
Topics: JACE, Controllers, Module development

A module that works beautifully on a Supervisor can be structurally incapable of running on a controller. The reasons are architecture and budget, and neither is negotiable at install time.

## A controller is not a small Supervisor

It is tempting to treat a JACE as a Supervisor with less of everything. It is not: it is a different processor architecture running a different operating system, with a memory and flash budget measured in a way a server's never is. Code that assumes otherwise does not run slowly. It does not run.

## Native code is the hard stop

Controllers are ARM hosts. A development machine almost certainly is not. Any dependency that carries a compiled binary — a bundled shared library, a JNI layer, a library that unpacks a platform-specific native blob at runtime — was compiled for the wrong architecture and the wrong operating system, and will fail on the controller however cleanly it behaved in testing.

This rules out a surprising amount of ordinary Java library choice: some compression, imaging, cryptography and database libraries ship native fast paths. The test is not "does it work on my machine"; it is "does this jar, or anything it drags in, contain anything that is not bytecode".

> **The rule.** Modules for a controller are pure Java plus resources — JavaScript, CSS, images, lexicons. If a dependency cannot meet that, the dependency is out, not the platform.

## The budget is real, and it is shared

The second constraint is quieter and does more damage over time, because nothing fails outright. Every module installed occupies flash and heap whether or not it is doing anything, and the station is sharing that headroom with drivers, histories, alarms and the actual control logic that justifies the panel existing.

Consequences worth designing for:

- **Few modules, small jars.** One utility method is not worth hauling in a framework. Prefer a hundred lines of your own to a megabyte of somebody else's.
- **Watch the file count in a view.** A browser-facing widget that serves twenty unbundled scripts makes the controller answer twenty requests to draw one page, and it does that for every operator who opens it.
- **Assume concurrent operators.** A dashboard that is comfortable with one session open can be the reason a controller struggles with six.

## Who renders what

One clarification that saves a lot of misplaced optimisation: the browser rendering a graphic is the *operator's*, not the controller's. Client-side rendering cost is the operator's laptop problem, and the compatibility target is whatever browsers the site actually uses. The exception is viewing inside Workbench, which renders in its own embedded engine, typically older than the browsers on the same desks.

What the controller pays for is serving the files and answering the data subscriptions behind them. Optimise those.

## Checking before you ship

1. **Inventory the jar.** Anything in the archive that is not a class, a resource or metadata deserves an explanation.
2. **Inventory the dependencies.** Transitive dependencies are where native code hides, because nobody chose them deliberately.
3. **Measure the installed size** and compare it against what the target has free, before the commissioning visit rather than during it.
