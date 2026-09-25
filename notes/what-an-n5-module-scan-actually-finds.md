# What a static Niagara 5 module scan actually finds

> Reading a module's bytecode against Java 25 gives a per-module answer. What it finds, what it cannot tell you, and the false alarms it avoids.

Source: https://plantroomlabs.com/notes/what-an-n5-module-scan-actually-finds/  
Published: 2026-09-26 (26 September 2026) · Plantroom Labs  
Topics: Migration, Module development, Estate management

Every removed API leaves a fingerprint in the bytecode of the class that calls it, and the jars are already on your disk. So &ldquo;which of my modules does this break&rdquo; is a measurement, not an opinion &mdash; within limits worth being honest about.

## What the scan reads, and what it needs

A Java class file records every type and every member it links against, in a table near the front of the file. That table is not optional and it is not stripped: it is how the JVM resolves anything at all. So for a given jar you can list, exactly, which APIs its code references — without running it, without source, and without the vendor's cooperation.

Three things make that useful rather than merely true for Niagara modules.

**It recurses into nested jars.** Niagara modules routinely embed third-party libraries as jars inside the module jar. Across the stock 4.15 module set there are several hundred of them. They run on the same JVM, so a scan that stops at the outer jar misses most of what there is to find, and attributes nothing to the module that ships it.

**It subtracts what the jar provides itself.** A fat jar that bundles a removed API and then references it is self-satisfied — the reference resolves inside the jar and is not a finding. Without that subtraction the loudest findings on any real module set are false.

**It reports the class-file version per jar.** Cheap to read, and it answers a different question from the API scan. More on that below.

No licence is involved. A licence gates running Workbench and a station; reading a jar already on disk does not.

## The rule categories

The rules sort into three severities, and the severities mean something specific about JVM behaviour rather than something vague about risk.

| Severity | Means | Families |
|---|---|---|
| blocker | The call throws unconditionally, or the class no longer exists. | Installing a security manager; reading the subject off the access control context; stopping, suspending or resuming a thread; the Java EE and CORBA packages; the old JavaScript engine; RMI activation; the old ACL package; anything under the JDK's internal packages. |
| high | It still links and still runs, but the meaning changed silently. | Privileged blocks that no longer elevate; any branch guarded by “is there a security manager”, which is now always false; JDK-internal `sun.*` and `com.sun.*` packages that load by name but are not accessible; native library loading; the deprecated subject-scoping call. |
| medium | Works today, on notice, or depends on the target. | Reflective access that opens a member — fine on your own classes, an exception into a closed module; finalizers; script engines with no engine left in the JDK; the unsupported-but-exported internal helpers. |

The distinction that earns its keep is the middle one. A blocker is loud. A silently changed semantic is a module that installs, starts, and does the wrong thing — and those are all in the *high* row.

## Three findings the release notes would have produced, that are not real

The rule table above was not written from release notes. It was written from a Java 25 JDK sitting on the same machine as the jars, being asked what still exists and what each survivor actually does. That mattered more than expected: **three rules were wrong on the first pass and were corrected from what the JVM did.**

| Assumed from the notes | What the JDK does |
|---|---|
| The XA transaction package was removed with Java EE | **Present.** It survived in a module of its own. This alone had condemned three perfectly healthy database modules. |
| The applet package is gone | **Present**, deprecated for removal since Java 9. Worth a note, not a blocker. |
| The old certificate package was removed | **Present.** The rule was deleted outright. |

Every one of those would have produced a confident, wrong, published verdict against somebody's module. A scan's credibility is entirely in how its rules were obtained. Ask that question of any readiness report, including this one: was the rule run, or was it read?

## A reference is not a call

The second class of false positive is subtler, and no JDK can settle it: a symbol in the constant pool means the class is *linked against* it, not that the code path is ever reached. Three real examples from the stock module set, each of which looked like a blocker and is not.

A bundled graphics library shipped a helper for its own standalone desktop viewer, which installs a security manager. Nothing in the module references that class. It is dead weight in the jar and never loads.

A bundled cloud SDK reaches a removed API through a reflective lookup wrapped in a try/catch, with a working pure-Java fallback and a warning log. It degrades. It does not break.

A module contains a nested jar that is a browser-side download — served to a client, never loaded by the station JVM at all. Its bytecode is irrelevant to the station and its findings are noise.

So a scan's output is a **must-review list, not a failure list**, except where the JDK now throws unconditionally. Turning a review item into a verdict takes a decompiler at the call site, and that step is where a first pass of five blockers became two.

## Why bundled libraries dominate the findings

Run this across a real set of commercial third-party modules and the shape of the output is consistent: the findings are overwhelmingly in the libraries the module bundles, not in the code the vendor wrote.

There is a good reason for it. A driver's own classes mostly talk to the framework's component, device and point API, which is old, stable and uses nothing the JVM has touched. The JSON parser, the logging facade, the crypto provider, the HTTP client and the compression library bundled alongside it are general-purpose code, and general-purpose code is exactly what reflects on itself, probes for optional APIs and interacts with the security manager.

Across eighteen shipping jars from one commercial catalogue: **34 findings and zero blockers**, with almost every row belonging to a bundled library rather than the vendor's own classes. The practical reading is that the work is *recompile, bump the bundled libraries, re-sign* — a release cycle, not a rewrite.

## Why zero blockers is the normal result

It is worth saying plainly, because the framing around a major version change invites the opposite assumption: **a well-built module usually scans clean.** Two modules built in this workshop return no findings on any rule, and that is not cleverness — it is the consequence of a small API surface, pure Java with JavaScript and CSS resources, no native code, no reflection and no security-manager interaction. Most competently built modules look similar.

The blockers that do exist are in the framework's own core, and that is the honest commercial message. Nobody ports around them; everybody waits on the same edit, equally. Which also means the reverse is worth distrusting: a plan that assumes your competitors will fail to port is planning on the wrong thing. They will port.

## The class-file version question, and what it actually means

Separate from the API scan, every jar has a spread of class-file versions, and a very old one is a genuine signal. It is worth being exact about what it signals, because the obvious guess is wrong.

The obvious guess is that a modern JVM refuses old bytecode. Measured on a Java 25 JDK, it does not: class files are accepted from the oldest format the JVM has ever supported upward, including through the old verification path with branching and exception handlers. One format version older than that is rejected with an explicit unsupported-class-version error. So a class from the framework's ancestry era, buried in a bundled library, **loads**.

The real problem is on the build side. A Java 25 compiler **refuses to target Java 6 or 7 at all**, and warns that its support for Java 8 is obsolete and will be removed. So a module carrying a pre-Java-6 class inside a bundled library is not facing a load failure — it is facing a maintenance dead end: no current toolchain can rebuild that library, and if nobody can rebuild it, nobody can fix it. One shipping module in a commercial catalogue carries exactly that, and there is no reason to think its vendor knows, because the class is not theirs. It arrived inside a dependency chosen a long time ago.

> **The check that costs nothing.** List the class-file versions in every jar in a `modules/` folder. Anything well below the framework's own level is a bundled library nobody has revisited in a decade, and it is worth knowing which module ships it before a migration date is agreed.

## What the scan does not tell you

This is the limit, and it is a hard one. The scan measures **one** change: the move off Java 8, and whether a given module's bytecode survives it. It says nothing about framework API changes, manifest schema changes, repackaging, or anything rewritten for reasons unrelated to the JVM. A module that passes every rule can still fail to compile against a new SDK.

And the reason it cannot say more is simple: **there is no Niagara 5 build to test against.** Pre-release access runs through the vendor's own developer programme, there is no public download, and nothing on a bench here runs it. So any statement that a module is N5-ready — ours, a vendor's, or one in a readiness report — is **static analysis against a Java 25 JDK, not a test on a Niagara 5 build**. Treat a supplier who does not draw that distinction with more suspicion than one who does.

## What you can do yourself, and when to send a listing

Most of the first pass is genuinely a do-it-yourself job, and it is better done early by whoever knows the estate than late by somebody who does not.

1. **List the modules folder.** Every jar, every station. This alone surprises people: estates carry modules nobody remembers installing.
2. **Read each jar's manifest.** Vendor, module name, version, and the framework version it is stamped against. That is your inventory, and it is machine-readable rather than remembered.
3. **Check the signature state.** A module that is unsigned, or signed by a certificate the target host does not trust, has a problem independent of anything to do with Java versions — and mandatory signing is one of the announced changes.
4. **Check class-file versions.** Cheap, and it finds the maintenance dead ends described above.
What takes longer than it looks is the rest: recursing into nested jars, telling a live call site from a dead one, and knowing which of twenty rules are real on a current JDK rather than plausible from a changelog. That is the part where a first pass of five blockers turns out to be two.

So: if the estate is a handful of modules, do it yourself with the four steps above and you will have most of the answer. If it is more than that, or you want the verdict written down in a form you can hand to a client or put in a capital plan, send the listing. That scan is free, and what comes back is a table — one row per module, findings by severity, class-file version, signing state, and a plain verdict.

The companion note covers the one break that is not in anybody's published change list: [what Java 25 does to Niagara's module permission model](https://plantroomlabs.com/notes/niagara-module-permissions-on-java-25/). For the audit and porting work itself, see [Niagara 5 migration](https://plantroomlabs.com/services/niagara-5-migration/).
