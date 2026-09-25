# What Java 25 does to Niagara's module permission model

> Niagara's module permission model is built on Java's Security Manager. On a Java 25 JVM it cannot be installed, so the checks stop happening.

Source: https://plantroomlabs.com/notes/niagara-module-permissions-on-java-25/  
Published: 2026-09-26 (26 September 2026) · Plantroom Labs  
Topics: Module development, Station security, Migration

A module asks for privilege in its manifest, and the framework grants or refuses it through Java's Policy and SecurityManager. On a Java 25 JVM neither can be installed &mdash; so those checks do not start failing. They stop happening.

## How a module asks for privilege today

Niagara 4 has a real, documented privilege model for module code, and most people who write modules have never had to look at it, because the framework asks for the permissions on their behalf. Tridium's developer documentation describes it plainly: Niagara 4 introduced the use of Java's Security Manager to restrict who may run certain sections of code, and from 4.2 onward the policy is determined by the contents of a module's own manifest, in which a module requests the permissions it needs.

Read off the bytecode, the machinery is a custom `java.security.Policy` subclass installed by the runtime environment, plus a hierarchy of permission-group classes in the core framework jar. There are **26 named permission groups** a module may request, and the list is a reasonable index of what a module can do that matters: authentication, backups and restore, key store access, loading libraries, reflection, network communication, modifying IO streams, modifying session IDs, managing execution, shutdown hooks, setting system time, system properties, signing, reading environment variables, getting the authenticated user, database connections, MBean access, diagnostics, logging, runtime execution.

Two of those groups already require the module to be signed before the request is honoured at all. That detail matters later.

## What a Java 25 JVM does to that machinery

The Security Manager was deprecated for removal, then permanently disabled. On a current JVM the relevant calls behave like this — measured by running them, not read off a release note:

| Call | What it does on Java 25 |
|---|---|
| System.getSecurityManager() | Returns `null`. Always, with no way to change it. |
| System.setSecurityManager(sm) | Throws `UnsupportedOperationException` — including when the argument is `null`, so even code whose only intent is to *disable* the manager now throws. |
| Policy.setPolicy(p) | Throws `UnsupportedOperationException`. A custom `Policy` can be written, compiled and shipped; it can never be installed. |
| AccessController.doPrivileged(a) | Runs the action. It does not elevate anything, because there is no longer anything to elevate past. |
| Subject.getSubject(context) | Throws `UnsupportedOperationException`. |
| Subject.current() | Works. This is the replacement, and it sees a subject established by either the old `doAs` or the new `callAs`. |

So the permission model has no JDK left to stand on. Not "needs porting" — the two entry points it is built on both throw.

## The checks do not fail, they disappear

This is the part worth being precise about, because it is the opposite of what a removal usually does. The framework-wide idiom at a check site is: fetch the security manager, and if it is not null, ask it to check a permission. On Java 8 the manager is there and the check runs. On Java 25 the manager is null, the `if` is false, and execution continues straight past into the guarded work.

Scanning the 4.15 module set on disk, **31 stock modules carry that pattern**, and the list reads like an index of the security surface: the core framework jar, the platform layer, platform crypto, the signing service, client certificate authentication, SAML, the web and servlet layers, fox, tunnelling, backup, the cloud connectors, email, the OPC UA server, the system database, the HTTP client, and Workbench itself. Four representative examples, decompiled, guard platform initialisation, the station's signing password, the signing service, and the station's password-encryption key.

> **The code still runs. The permission layer is simply not there.** A module that would have been refused a permission is not refused; nothing logs, and nothing looks broken.

To be clear about what this is and is not: **this is not a live hole in anything shipping today.** Niagara 4 runs on Java 8, where the layer works exactly as documented. It is a statement about what has to be rebuilt before the framework runs on a modern JVM — and rebuilding it is the framework vendor's work, not a module author's.

## Two places where it is worse than a no-op

A silently-skipped check at least keeps running. Two calls in the framework's own core do not: they throw where they used to return.

Both are the same call — reading the authenticated subject off the access control context. One is in the runtime environment's security utility class. The other is the core framework's session manager, in the method that answers "who is the current user". Its blast radius is the whole web and UI session stack: the web and servlet layers, bajaux, the legacy HX views, the HTTP client, backup views.

And it is **documented public API for module developers**. The developer documentation's own guidance on CSRF protection tells you to fetch the current session and read its CSRF token off it. Any third-party module that followed that advice throws on a Java 25 JVM — not because the module is badly written, but because it did what the documentation said.

The fix is mechanical: `Subject.current()` replaces `Subject.getSubject(...)` and works under both the old and the new scoping calls. But it is a one-line fix *inside the framework's own jars*, so no amount of work on a third-party module makes that call site safe. Everybody waits on the same edit.

## What this means if you write modules

Four practical consequences, in the order they are likely to bite.

**The documented way to request privilege has no announced replacement.** The published breaking-change material for the next major version says, on this subject, that the Security Manager is removed. It does not say what a module uses instead to request a permission, or what happens to a manifest that asks for one. That is the single biggest open question for anyone maintaining a module catalogue, and it is not answerable from public material.

**Do not build new work on it.** If a design depends on being granted a permission group, or on `doPrivileged` actually elevating, it depends on a mechanism with no forward path. A module that needs no permission group at all has one fewer unknown in it, and in practice a module that sticks to the old, stable part of the component and driver API needs none.

**Two specific calls to stop writing now.** Reading the subject off the access control context, and the session manager call above. Both have replacements that already work on Java 8, so moving off them costs nothing and removes a guaranteed failure later. Likewise, the old subject-scoping call still works but is deprecated for removal; the newer one is a drop-in.

**A guess, labelled as one.** Two permission groups already require a signed module, and the next major version makes a valid signature mandatory for every module. The most likely shape of the replacement is therefore signature-at-load-time rather than permission-at-call-time. That is inference, not information. The measured part is only that the current mechanism cannot work.

## How this was measured, so you can repeat it

No licence and no pre-release access is involved, which is the point. A Niagara licence gates *running* Workbench and a station. It does not gate reading a jar that is already on your disk, and it does not gate running a JDK.

Three steps.

1. **Put a real Java 25 JDK next to the install.** Not as a runtime for Niagara — nothing runs on it. It is there to be asked questions.
2. **Ask it what each API actually does.** A short program that calls every API in question inside its own try/catch and prints the outcome, plus a second one that simply asks whether each package still resolves. That output is the evidence; the rule table is written from it.
3. **Read the jars' constant pools.** Every class records the types and members it links against. Walk them and you get, per module, the exact list of removed or changed APIs it touches — then confirm each hit at the call site with a decompiler before believing it.

> **Why the third step needs the second.** The first pass of this scan produced five blockers. Three were wrong because the rules came from release notes rather than from the JVM, and two more were wrong because a reference in a constant pool is not a call that ever runs. Running a real JDK and a decompiler removed all five. A finding that has not survived both steps is a guess with a severity label on it.

## What to ask the Developer Program

If you hold a developer membership, these are the questions whose answers are not in public material, and they are worth asking in writing:

- What replaces a module's permission request? Is the manifest element retained, ignored, or an error?
- Are the 26 permission groups enforced by any other mechanism, or is module code now simply trusted once its signature verifies?
- Has the session-manager call that reads the current user been changed to the supported replacement, and in which pre-release build?
- Is there a supported way for a module to learn the authenticated user, given the old route throws?
- Does the documentation that tells module authors to use that call get updated, and when?

## What this does and does not prove

**Measured.** What a Java 25 JVM does to each API, by running it. Which modules in the 4.15 set on disk touch those APIs, by reading their bytecode. That the permission model's two installation points both throw.

**Not measured, and not claimable.** Anything about how the next major version actually behaves. **No Niagara 5 build exists to test against** — pre-release access runs through the vendor's own programme and there is no public download — so every statement here is **static analysis against a Java 25 JDK, not a test on a Niagara 5 build**. It says nothing about API changes, manifest schema changes, or repackaging done for other reasons. A module that passes a scan like this can still fail to compile against a new SDK.

That is a narrower claim than "N5-ready", and it is the one that can be backed up.

The companion note covers what a scan like this finds across a real module set, and what it cannot tell you: [what an N5 module scan actually finds](https://plantroomlabs.com/notes/what-an-n5-module-scan-actually-finds/). For the audit and porting work itself, see [Niagara 5 migration](https://plantroomlabs.com/services/niagara-5-migration/).
