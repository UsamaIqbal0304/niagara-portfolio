# One PX sheet for every AHU

> The Px editor binds absolutely by default, which is why a graphic works for AHU-01 and nothing else. Relativised, one sheet serves the whole plant.

Source: https://plantroomlabs.com/notes/px-relative-ords/  
Published: 2026-09-23 (23 September 2026) · Plantroom Labs  
Topics: PX graphics, Standard sheets, Reuse

A graphic drawn for one air handler and copied twenty times is twenty graphics to maintain. The difference between that and one sheet is how its ORDs were bound.

## Why the copies happen

When you bind a widget with the Px Editor tools, the ORD you get is absolute by default. It looks like this:

`station:|slot:/Logic/HousingUnit/AirHandler/DamperPosition`

That path resolves to one unique component, always, wherever the sheet is used from. Attach the same sheet to a different air handler and every widget on it still points at the first one. The graphic is not broken — it is doing exactly what it was told — so the usual response is to copy the file, re-point every binding, and do it again for the next unit.

## What relative binding changes

A relative ORD resolves against the *parent ORD of the view it is in*. The same sheet, opened as the view of AHU-02, resolves its bindings under AHU-02. One file serves every identically shaped piece of plant on the site.

You do not have to retype anything to get there. In Edit mode, the Bound Ords area of the Px Editor lists the sheet's bindings and has a **Relativize Ords** button; it opens a window listing every ORD that can be relativised, and the paths in the Bound Ords area shorten when you accept.

> **The catch, and it is the whole job.** Relative binding works only where the child slot names match. `DamperPosition` has to be called `DamperPosition` under every air handler, not `Damper Pos` under one and `DmpPos` under the next. The reusable graphic is a consequence of a naming standard, not a substitute for one.

## When one sheet is not quite enough: ORD variables

Relativising handles "the same sheet against different equipment". The other case is a sheet that embeds a smaller sheet several times over, each instance pointed at something different — a plant overview holding four identical pump panels. That is what ORD variables are for.

Inside the child sheet, the variable part of a binding is written `$(name)` — for example `$(Child1)/Variable1`. The parent embeds the child with a **PxInclude** widget and supplies a value for each variable, so the same child file renders against a different branch of the tree in each instance.

## What this is worth

The saving is not in drawing time; drawing the second copy is quick. It is in everything afterwards. A relatively-bound standard sheet means a change to how an AHU is presented — a new alarm indicator, a corrected unit, a different colour rule — is made once and appears on every AHU on the site. Twenty copies mean twenty edits and, in practice, nineteen: one always gets missed, and the one that got missed is the one the client opens.

## Retrofitting an estate that was built the other way

1. **Pick the best existing sheet** rather than starting again. Whichever copy has had the most correction applied to it is the one closest to what everybody actually wanted.
2. **Fix the naming first.** Relativising against inconsistent slot names produces a sheet that works on some units and shows nulls on others, which is worse than the copies because it looks finished.
3. **Relativise, then test against the odd one out** — the unit with the extra sensor or the missing valve, not the one the sheet was drawn from.
4. **Repoint the navigation, then delete the copies.** Leaving them in place guarantees somebody edits one in two years' time and cannot work out why nothing changed on screen.
