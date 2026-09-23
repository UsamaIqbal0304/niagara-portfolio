# Platform or station: two connections, two sets of logins

> Two processes, two Java VMs, two logins and two file trees — and most “it works in Workbench but not the browser” starts here.

Source: https://plantroomlabs.com/notes/platform-versus-station/  
Published: 2026-09-23 (23 September 2026) · Plantroom Labs  
Topics: Platform, Station engineering, Workbench

Half the confusion in a first Niagara job comes from one fact nobody says out loud: the platform and the station are separate programs, and almost nothing crosses between them.

## Two processes, two virtual machines

The platform daemon, `niagarad`, is pre-installed on every controller from the factory and starts whenever the hardware boots. It is Java, running in its own Hotspot VM, and it runs whether or not there is a station — a brand-new controller with no station installed is still fully manageable. The station, when one exists, runs in a *second and separate* VM that the daemon starts and stops.

Which is why there are two kinds of connection. A platform connection is Workbench talking to the daemon, on HTTPS 5011 where TLS is available and 3011 where it is not. A station connection is Workbench, or another station, talking to the station over Fox. They authenticate differently, they show different views, and one being up tells you nothing about the other.

> **A platform connection needs Workbench.** There is no browser equivalent — no amount of WebService configuration will expose Software Manager or the Station Copier to a browser. The one indirect route is a Supervisor station reaching a remote platform through its `ProvisioningService`, which is exactly why provisioning exists.

## Two sets of credentials, and neither manages the other

Platform users live in the daemon. There can be up to twenty, every one of them a full administrator able to create more, and there is no way to hand out a restricted one. Station users live in the station database, with roles, categories and permissions, and can be as narrow as you like.

Deleting a station user does not affect platform access. Losing the platform password does not lock you out of the station, and vice versa. On a site where somebody has left, both lists need checking, and the platform list is the one that usually gets forgotten because it is only visible over a platform connection in the first place.

## PlatformServices: the station's window onto the platform

There is one deliberate hole in the wall. Every running station has a `PlatformServices` container under Config → Services, reachable over an ordinary Fox connection by any station user with admin permission on Services — no platform connection involved. It exposes a subset of the platform views, and a few settings that exist *nowhere else*.

| Service | Where | What it gives you |
|---|---|---|
| TcpIpPlatformService | PC and controller | the same addressing as the platform's TCP/IP view |
| LicensePlatformService | PC and controller | the same licences as License Manager |
| CertManagerService | PC and controller | key store, trust store and allowed-host exceptions |
| SyslogPlatformService | PC and controller | ships Niagara log messages to a remote syslog server |
| SerialPortService | controller only | which serial ports the host actually has |
| NtpPlatformService | controller only | the QNX NTP daemon and its list of time servers |
| DataRecoveryService | controller only | the static RAM buffers behind battery-less operation |
| HardwareScanService | controller only | a labelled diagram of the ports on this model, if `platHwScan` is installed |

Two things about this container catch people out. It is built dynamically when the station starts, so it does not exist in an offline station — open the .bog in Workbench and there is nothing to look at. And its settings are *not* stored in the station database: they go to `platform.bog` or to the operating system, which means they survive the station being replaced, and a station backup does not carry them.

> **Be careful who gets admin on Services.** This is the part of the station that holds host licences and IP settings, and the right-click menu on PlatformServices includes Restart Station. A permission model that is careful about setpoints and casual about Services has the wrong shape.

## Where the files actually live

A controller has exactly two homes, and both are visible under Platform → Remote File System.

| Home | Alias | ORD | Path | Contents |
|---|---|---|---|---|
| System Home | `niagara_home` | `!` | `/opt/niagara` | the installed software; read-only |
| daemon User Home | `niagara_user_home` | `~` | `/home/niagara` | configuration and the installed station |

Inside the station folder there is a second split, and this one changed at N4. The station root is the **protected station home**, which only core Niagara modules may touch: `config.bog` and its timestamped backups sit there, along with `alarm`, `history`, `dataRecovery`, `provisioningNiagara` and the virtual driver folder. The `shared` sub-folder is the ordinary one, writable by any module, and it holds `px`, `images`, `nav` and everything else a graphic refers to.

The consequence for anyone writing a module: the `^` ORD, which in AX pointed at the station root, now points at `shared`. The Java Security Manager enforces it, so a module that writes to the station root does not misbehave quietly — it fails. On the other hand N4 no longer needs the file blacklists AX relied on, because the boundary is structural.

## The Application Director is the platform's view of the station

One platform view is worth learning properly. On a controller the Application Director lists exactly one station — a Windows host may list several — and its Details column is the fastest answer to "why can I not reach it": `fox=` and `foxs=` for Workbench, `http=` and `https=` for browsers, `foxwss=` for Fox over WebSocket. Each reads `n/a` when that protocol is disabled or the station is not running, and a station with `http=n/a` is not a network problem.

Two properties decide what happens without you. **Auto-Start** starts the station after the daemon does, which covers every reboot, every dist file installation, every TCP/IP change and every module upgrade — all of which restart the station whether you asked or not. **Restart on Failure** has the daemon restart a station that exits with an error, such as one the engine watchdog killed for a deadlock. It gives up after three automatic restarts in ten minutes, leaving the station failed rather than flapping; the count is the `Failure Reboot Limit` property on the station's PlatformService.

Note that this view does not behave like the rest of Workbench: there is no Save button, and every checkbox and button applies the moment you click it. Stop shuts the station down cleanly, saving `config.bog` and history. Kill does not — it terminates the process, and whatever was unsaved is gone. Between the two, Verify Software is the quiet one worth using: it parses `config.bog` and `platform.bog` and tells you which modules the station references but the host does not have.

## Move stations with the Station Copier, not the file system

It is tempting to drag a station folder across with the file transfer client, and it produces a station nobody can log into. The Station Copier transcodes user passwords for the target host as part of the copy; a raw file copy does not, so the users arrive unusable. It also checks the target for the modules the station depends on before it starts, and refuses rather than installing something that cannot run.

Module signatures are checked on the way in too. Warnings on a dependency raise a Signature Warning window you can accept; a signature *error* fails the copy outright. That is the same gate a module faces at install time, arriving at the least convenient moment — which is an argument for getting signing right long before the station moves.
