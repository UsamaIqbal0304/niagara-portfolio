# Commissioning a JACE-8000 without locking yourself out

> The factory address, the passphrase and the account you are made to delete — the commissioning steps that strand a new controller.

Source: https://plantroomlabs.com/notes/commissioning-a-jace-8000/  
Published: 2026-09-23 (23 September 2026) · Plantroom Labs  
Topics: JACE, Commissioning, Deployment

Most of the Commissioning Wizard is a checklist you click through once. Three of its steps are one-way doors, and the route back from any of them is a factory recovery over a serial cable.

## What a factory-shipped controller is

Out of the box a JACE-8000 answers on `192.168.1.140` with a `255.255.255.0` mask, on the primary LAN1 port only — LAN2 ships disabled, with no address at all. The platform daemon listens on HTTPS port 5011, and there is a documented default platform user name and password. All three are temporary by design, and the wizard exists mostly to replace them.

So the first obstacle is arithmetic rather than Niagara: your laptop has to be on that subnet to open the platform connection, on any address except .140 itself. Re-addressing the laptop's NIC is the usual answer. The two alternatives are a USB-to-Ethernet adapter as a second NIC with a crossover cable, which saves disturbing the machine's real network settings, or the debug port — a micro-USB serial shell, needing a VCP driver and a terminal emulator, from which you can reassign the controller's address and reboot before going anywhere near Workbench.

## The steps the wizard will not let you skip

Right-click the connected platform in the Nav tree for **Commissioning Wizard**. Steps run in the order listed, and on a new unit everything is preselected except lexicon installation. Some of those ticks cannot be cleared.

| Step | On a new unit | What it actually decides |
|---|---|---|
| Request or install licences | preselected | fetched from the licence server if the laptop has internet; otherwise drop the .lar or .license file into `!security/licenses/inbox` and restart Workbench *first* |
| Set enabled runtime profiles | preselected, read-only | which module JARs get installed, and therefore how much flash they use |
| Install a station | optional, recommended | can be done later from the Station Copier |
| Install lexicons | cleared | file-based lexicon sets; leave it cleared, N4 wants lexicon modules |
| Install/upgrade modules | always preselected | the module selection list, filtered by the profiles above |
| Install/upgrade core software | preselected, read-only | the distribution files — the reboot at the end of the run |
| Sync date and time | preselected | a new controller's clock is usually wrong by years |
| Configure TCP/IP | optional, recommended | the address you will spend the rest of the job using |
| Remove default platform user | preselected, read-only | you cannot commission a unit that keeps the factory account |
| Additional platform daemon users | optional | up to 20 accounts, every one of them a full administrator |

Back and Next retrace or skip freely, Cancel performs nothing, and the last screen is a summary of every change before any of it is committed. Up to that review nothing has been written, which makes the wizard much safer to explore than its reputation suggests.

## Runtime profiles decide whether a browser can see the station

A profile is a class of module JAR. RUNTIME (`-rt`) is always selected and cannot be cleared. UX (`-ux`) is what serves HTML5 clients, and without it the WebService will not give a browser anything — the station is reachable from Workbench over Fox and nowhere else. WB (`-wb`) adds browser-hosted Workbench for Java-enabled clients on top of UX. SE is not available on the QNX JACEs at all, which run a Java 8 compact 3 VM. DOC can be selected and should not be: it is documentation, on the most limited flash in the building.

None of this is permanent — profiles can be changed afterwards from Platform Administration — but changing them means reinstalling modules, so it is cheaper to get right during the one run that was going to reboot anyway.

## Two Ethernet ports, two subnets

LAN2 is there to keep a driver's Ethernet traffic off the customer's network, to hang a private chain of IP devices off the controller, or to give a visiting engineer a fixed address to plug into without touching the corporate LAN. Whatever it is for, **each enabled interface must be on a different subnet**. Setting LAN1 to 192.168.1.99 and LAN2 to 192.168.1.188 under a /24 mask is not a redundant pair, it is a broken configuration, and the symptom is ports that simply do not work.

Two more constraints follow from the same place. The controller supports exactly one gateway across all adapters, WiFi included, so only one interface can reach anything off-subnet. And it does no routing or bridging between interfaces — a device on LAN2 is not visible from LAN1, which is the entire point but catches people who expected a switch.

> **Do not enable DHCP unless you know a DHCP server exists.** If none answers, the controller comes back at an address nobody can predict and the next step is the serial cable. Static addressing is the recommendation regardless; if the site insists on DHCP, insist back on a reservation, because a controller whose address moves takes every Niagara Network connection to it along.

## The passphrase, and the account you are made to replace

Both replacements demand a strong password: at least ten characters with an uppercase, a lowercase and a digit, and both are case sensitive. The platform account is straightforward — pick a name that is not the factory one. Every platform user has identical full administrative access and can create more, so there is no such thing as a read-only platform login to hand out.

The system passphrase is the one that matters later. It protects sensitive data at rest, and it doubles as the *file* passphrase on everything portable the station produces: backups, station copies, anything encrypted on its way out. Move one of those to a system whose passphrase differs and you will be asked for the original before the restore proceeds. Lose it and the encrypted data is gone — there is no recovery path, only the factory wipe below.

Since 4.4 Workbench will not finish a platform connection to a host still holding either default, and launches the Change Platform Defaults Wizard instead. That behaviour is two options under **Tools → Options → Platform Connections**, both true out of the box; turning them off only suppresses the prompt where another workflow already covers it.

> **If you are changing the address in the same run, write the new credentials down.** Keep the address and Workbench remembers the replacement platform user for the session, which makes the post-reboot reconnect painless. Change the address and it does not — you reconnect to somewhere new, as somebody new, with nothing cached.

## The SD card carries the encryption

On a JACE-8000 the microSD card is the primary storage for the whole software installation, and because a card can be pocketed, the sensitive parts of it are encrypted at rest and decoded as they are read: WiFi credentials, Niagara key material, private key files, OS account credentials.

The consequence shows up on the day a controller dies. Moving the card into a replacement chassis does carry the configuration across, but the card is encrypted under the *old* unit's passphrase, so the new one fails to boot — the Stat LED flashing at a 50% duty cycle on a one-second period is that failure and not a hardware fault. Connect to the debug shell, log in with platform credentials, and the System Decrypt Failure menu offers exactly two ways forward: supply the original passphrase, or delete all the encrypted data. Only the first keeps the site's keys and certificates.

Which makes the pre-emptive version worth knowing: set the replacement unit's passphrase to the original's over serial *before* inserting the card, and commissioning finds a match and never asks.

## Factory recovery, and the buttons behind the door

Two mistakes strand a brand-new controller: mistyping the default platform credentials or the default passphrase often enough to be locked out of the platform connection you need in order to fix it. There is no back door. The same procedure is also the correct way to decommission a controller, because it wipes platform and station data together.

1. Remove any USB device from the backup/restore port. Since 4.7U1 the presence of a stick — any stick — makes the controller skip recovery, which is a guard against wiping a unit you meant to restore.
2. Power the controller off.
3. Hold the BACKUP button down and power up, keeping it held until the banner confirms the press. Holding well past that prints a warning about a possible short; it is not a fault, but start again.
4. Release the button. A ten-second countdown starts. **Any keypress during it switches to restore-from-USB instead** — say nothing and recovery begins when it reaches zero.
5. Wait. The Backup LED goes to a slow one-second blink while the factory image is written. Interrupting here can leave the controller unusable.
6. When the LED stops, power-cycle. The first boot after a recovery takes noticeably longer than normal.
The other recessed button, SHT/DWN, is the controlled shutdown, and it reports back through the same LED: a fast alert flash while the press is registered, a one-second work pattern while the software reaches a safe state, then dark, which is the only signal that means power can be pulled. A distinctive on-off-on-then-three-seconds-dark pattern means the software could *not* reach a safe state — worth knowing before assuming a station shut down cleanly.
