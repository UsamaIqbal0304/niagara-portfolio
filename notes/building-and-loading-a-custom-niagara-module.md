# How to build and load a custom Niagara 4 module

> What a Niagara module actually is on disk, the two ways to build one, and the three Software Manager refusals that actually mean something.

Source: https://plantroomlabs.com/notes/building-and-loading-a-custom-niagara-module/  
Published: 2026-09-26 (26 September 2026) · Plantroom Labs  
Topics: Module development, Build tooling, Deployment

Software Manager will accept a jar built from an empty directory without checking whether it does anything. Whether it installs and whether it works are two separate questions, and almost everything that decides them sits outside the dialog that says “Success.”

## What a module is on disk

A Niagara module is a signed jar with one extra file. Open one up and next to the compiled classes and the usual jarsigner output (`META-INF/MANIFEST.MF`, `META-INF/NIAGARA4.SF`, `META-INF/NIAGARA4.RSA`) there is `META-INF/module.xml` — the one part of the jar that is Niagara-specific, and the file the station reads before it trusts anything else inside. Alongside it: `module.palette` (what Workbench's palette side shows), a `<name>-rt.lexicon` for translatable strings, and, for a browser-facing module, an `rc/` folder holding the `.js`, `.css` and images the browser loads directly. Nothing in the jar is obfuscated — `javap`, `jdeps`, plain `unzip` and any decompiler all work on it directly.

A module also declares a **runtime profile**, both in its own name and in `module.xml`'s `runtimeProfile` attribute: `-rt` runs inside the station itself, `-wb` runs only inside Workbench, `-ux` is the one that reaches an operator's ordinary browser. One piece of functionality is often several jars sharing a logical name — `acmeTools-rt.jar`, `acmeTools-wb.jar`, `acmeTools-ux.jar` — each with its own `module.xml`, targeting a different classpath at a different end of the wire. In a full 4.15 install, of roughly 750 shipped modules a little over half are `-rt`, most of the rest `-wb`, and only a small slice `-ux` — the profile that actually reaches a browser, and the one a typical PX-facing widget module is.

## Two ways to build one

There are two workable routes, and only one needs anything beyond a Niagara install already on disk.

Tridium ships its own Gradle-based build system inside every install, as a flat Maven repository, with worked example projects for a driver, a type-extension module, and a signing pipeline. It needs Gradle 7.6, a full JDK (the one bundled inside a Niagara install is trimmed down and drops the jar-packaging tools, so a separate system JDK 8 has to supply `jar` and `jarsigner`), a Gradle plugin version that actually matches the install you point it at, and — for a `-ux` target only — Node tooling on `PATH` for its grunt/yarn step. Type declarations for each profile live in their own `module-include.xml` — one file per profile subproject sharing a logical module name — folded into that profile's own `module.xml` when the build runs. It is the fuller build: it drives the `@NiagaraType` annotation processor, which reads an annotation on a Java class and generates both the `Type`/`getType()` boilerplate and the matching `<type>` entry, so neither is written by hand. Signing here is automatic too, but by a throwaway self-signed key generated on first use — a development convenience, not a route to a shippable module.

The other route needs no SDK and no licence: a plain `javac` against the jars already in the install's own `modules` directory, followed by a hand-built zip. This works by giving up the annotation processor and writing its output by hand — not much of a loss, since a browser-facing widget is typically a `BSingleton` implementing `BIJavaScript`, and the two methods the processor would otherwise generate are only a few lines:

```
public static final Type TYPE = Sys.loadType(BAcmeWidget.class);
public Type getType() { return TYPE; }

private static final JsInfo jsInfo =
    JsInfo.make(BOrd.make("module://acmeTools/rc/AcmeWidget.js"));
public JsInfo getJsInfo(Context cx) { return jsInfo; }
```

The matching `<type>` entry in `module.xml` is written by hand alongside it, one line per class. Because these classes only touch a handful of 4.0-era API (`javax.baja.sys.BSingleton`, `javax.baja.web.BIFormFactorCompact`/`BIOffline`, `javax.baja.web.js.BIJavaScript`/`JsInfo`), the same source compiles unchanged against whichever install `javac` is pointed at, from a current 4.15 install back to 4.14 — Niagara 4 is Java 8 throughout. What a built jar actually asks the running station for at load time is checkable rather than assumed: walk the constant pool of the compiled classes, list every external framework method referenced, and compare that against the API the oldest target actually has.

## The bare minimum module.xml

Everything the station checks at install time is in one file. A minimal `-ux` example, trimmed to the parts that matter:

```
<module name="acmeTools-ux" moduleName="acmeTools" runtimeProfile="ux"
        vendor="Acme" vendorVersion="1.0.0" bajaVersion="0"
        preferredSymbol="ac" nre="true" autoload="true" installable="true">
  <dependencies>
    <dependency name="baja"   vendor="Tridium" vendorVersion="4.14"/>
    <dependency name="js-ux"  vendor="Tridium" vendorVersion="4.14"/>
  </dependencies>
  <types>
    <type name="AcmeWidget" class="com.example.acmeTools.ux.BAcmeWidget"/>
  </types>
</module>
```

Two details here catch people moving a module between hosts. First, `moduleName` — not the jar's filename — is what an ORD or a PX `<import>` resolves against, and Tridium's own shipped modules aren't consistent about whether `name` or `class` comes first inside a `<type>` element, so parsing the file with a regex instead of a real XML parser eventually gets it wrong. Second, the `vendorVersion` on each `<dependency>` is a floor, not a pin — get that wrong and a module that compiles cleanly is refused outright by an older station. That distinction, and how to make the stamp a build argument instead of an accident of the build machine, is its own note: [which Niagara version to stamp a module for](https://plantroomlabs.com/notes/niagara-module-version-stamping/).

## Signing, briefly

An unsigned jar installs on nothing running the default verification mode — 4.15 documents `medium`, which requires a certificate the target host already trusts. Self-signed is fine, but only once that certificate is imported into that host's trust store; the same jar can install cleanly on one host and be refused on the next with no change to the file at all. What each mode actually checks, and why it cannot be relaxed from a launch argument, is covered elsewhere: [Niagara module signing: what a station checks](https://plantroomlabs.com/notes/niagara-module-signing/). Worth repeating here: sign the version you are actually going to ship, not the throwaway dev-loop key a build tool generates by default.

## Getting it onto a station

For a JACE, there is one supported way in: Platform → Software Manager, pointed at the jar (or a distribution file built from it) over the platform connection — not a jar copied into a directory by hand. A JACE doesn't hand you a filesystem to engineer against the way a PC install's own `modules` directory does during the SDK-less dev loop above; Software Manager is what actually places the file, rebuilds the module registry, and triggers whatever restart is needed. A jar that compiles, is stamped correctly and is signed correctly, but was never pushed through that path, is not installed anywhere — whatever the build log says.

## The three errors that actually mean something

Software Manager's own dialog isn't a diagnostic tool — it reports success or a short failure line, and the same line can cover more than one root cause. In practice, almost everything reduces to three.

| What it says | What it means |
|---|---|
| Dependency error naming a version | The module's declared floor is higher than the station's own version. Nothing in the code is wrong — rebuild with the stamp set to the station's actual version, not whatever version the build machine happens to have installed. |
| Unsigned or untrusted module | The jar's signing certificate is not in *this* host's trust store. The question is never "is it signed" — it's "does this particular host trust this particular certificate." |
| Class not found, after a successful install | The type resolved at install time, but a class it depends on lives in a different runtime profile than the one that tried to load it — a `-ux` view referencing a type that only exists on the `-rt`/`-wb` side, or a type declared in the wrong profile's `module-include.xml`. It installs, then fails the first time something tries to instantiate it. |

None of these three is a reason to start guessing at the code — all three are checkable directly, against the stamp, the host's trust store, and the profile that was supposed to carry the failing class. See [custom Niagara modules & drivers](https://plantroomlabs.com/services/niagara-modules/) for help getting one built and shipped.
