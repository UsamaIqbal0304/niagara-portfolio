# What actually blocks an AX to N4 migration

> A station cannot migrate until every module it uses has been refactored for Niagara 4 — and licences, users and permissions all change shape on the way.

Source: https://plantroomlabs.com/notes/ax-to-n4-migration/  
Published: 2026-09-23 (23 September 2026) · Plantroom Labs  
Topics: Migration, Estate management, Module development

The migration tool is the easy part. What stops a job is one custom module nobody has the source for, found on the day the Supervisor was meant to go live.

## Find the blockers before you plan the dates

Most of the risk in a migration is discovered in the survey, not in the conversion. Four questions decide whether a date is realistic.

- **Is every controller at AX 3.8 or later?** That is the floor for compatibility with Niagara 4.
- **Is every driver and application it runs supported in N4?**
- **What custom or third-party modules are installed?** Connect to the platform, open the Software Manager, and sort by installed version — anything not from Tridium is on the list. Modules that are installed but not used by the running station do not matter.
- **Were any modules built from Program components** with the program module builder? Those need refactoring too, and they are easy to forget because nobody thinks of them as modules.

> **A station cannot be migrated until every module it uses has been refactored for Niagara 4.** Not "should not" — cannot. If a third party wrote it, the refactor is theirs to do, and that is a lead time you do not control. This is the single item most likely to move a migration date, and the only defence is finding it early.

## The direction is not symmetrical

If a controller runs something unsupported in N4 and genuinely cannot change, you can leave it on AX-3.8 and still integrate it with a Niagara 4 Supervisor. The reverse does not work: **an AX-3.8 Supervisor cannot integrate Niagara 4 controllers**.

Which fixes the order of work. The Supervisor migrates first, then controllers follow at whatever pace the estate allows, and the awkward ones can be left behind indefinitely rather than holding up everything else.

## Licences, before anything else

AX licences do not work in Niagara 4. Request N4 licences for every platform being migrated and **confirm they are ready before you start**, because a converted controller without a licence is a controller that is off.

The host ID is almost always unchanged, so the request is straightforward. The exception worth checking: on Windows, moving between a 32-bit and a 64-bit installation changes the host ID. Archive the old AX licence files as well — they are the only record of what was licensed, and they are needed if any part of the estate stays on AX.

## Running the migration tool

The tool takes an AX-3.8 station backup distribution file and writes out an N4-compatible station folder, plus a log, into the Workbench user home. The source file is never modified, and the output always goes somewhere new, so a failed run costs nothing but time. AX does not need to be installed on the machine — only the backup file does.

It asks which migration template to use, controller or Supervisor, and takes the target station name from inside the backup. The result is installed onto the converted platform with the N4 station copier over an ordinary platform connection.

> **Run it in a standalone Niagara console, not the console embedded in Workbench.** The embedded console is not supported and does not handle the interactive input correctly — which matters precisely when the AX station holds encrypted passwords and the tool needs a pass phrase from you.

> **Configure code signing first.** From Niagara 4.3 the migration tool signs every program object it encounters, using the code-signing certificate configured in Workbench, and prompts for that certificate's password the first time. Sorting this out beforehand turns a mid-run surprise into a non-event.

## Users and permissions change shape

Two structural changes happen to security during migration, and both are worth explaining to whoever owns the system before they see them.

**Authentication becomes user-specific.** The password moves inside an Authenticator container alongside its configuration, and each user gains an authentication scheme name — typically a digest scheme by default — backed by a required authentication service. For migrated users this normally needs no attention; it is new users where the flexibility shows up.

**Permissions move from users to roles.** In AX, each user carried a permissions map. In N4 that map lives on a role, and users are assigned roles. To preserve behaviour exactly, the migration creates *one role per user, named identically to the user*, holding that user's old map.

> **That one-to-one mapping is a compatibility shim, not a design.** It leaves you with as many roles as users, which is the situation roles exist to prevent. The cleanup — create duty-specific roles, reassign users to combinations of them, delete the per-user roles — is small, and it is much easier in the weeks after a migration than in the years after.

> One quirk while doing it: the role manager can create, edit and delete roles but cannot assign them to users. Assignment happens in the user manager or on the user's property sheet.

## Two details that bite later

**Environment files.** Anything customised under the framework's lib directory — a modified units file, custom colour coding — is not automatically carried across in a meaningful way. Check whether the values in them need re-applying, because the symptom is not an error; it is a graphic that displays the wrong units a month later.

**User prototypes, if you synchronise users to a station staying on AX.** AX has no equivalent of the HTML5 profile, so the migration assigns the first prototype in the list — which is not the one you want. Enabling the user-defined configuration flag on the web profile config for each user prototype slot in the AX station avoids it.

## After the last controller

1. **Verify platform daemon communications** between the Supervisor and every controller read ok. This is the check that catches a conversion that looked fine.
2. **Revisit provisioning.** A migrated Supervisor with provisioning configured needs post-migration attention, and a mixed estate constrains which job steps are safe to run.
3. **Collapse the per-user roles** into something a new engineer can read.
4. **Re-apply environment customisations** and prove one graphic per unit type displays correctly.
5. **Write down which controllers stayed on AX and why**, with the module and the vendor named. That list is the plan for the next migration, and without it somebody surveys the estate again from scratch.
