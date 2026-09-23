# Roles, categories and the grid between them

> Niagara permissions are a grid of category against level — which is why a user can log in successfully and still be told they have no access.

Source: https://plantroomlabs.com/notes/niagara-roles-and-permissions/  
Published: 2026-09-23 (23 September 2026) · Plantroom Labs  
Topics: Station security, Permissions, Commissioning

Niagara does not grant permissions to people. It grants a level of access to a category of objects, to a role, which a person then holds. Every confusing symptom comes from one of those four words.

## The four things, in order

Access control in a Niagara station is a chain, and you cannot reason about any one link without the others.

- Every component belongs to at least one **category**.
- Every slot has a **permission level** — operator or admin.
- A **role** holds a permissions map: for each category, what rights it grants at each level.
- A **user** is assigned one or more roles, and their permissions are the union of them.
Rights themselves are three: read, write, and invoke an action. They apply to component slots, folders, files and histories alike.

## Categories cost memory, so keep them few

A new station arrives with two basic categories: **User** (category 1) and **Admin** (category 2). Everything lands in User except three services — the user service, the category service and the program service — and the entire file space, which go to Admin.

Categories can also be inherited from a parent rather than explicitly assigned, and the two mechanisms can be mixed. What cannot happen is a component in no category at all.

> **Every component carries a bitmap of its category membership.** The first eight categories occupy one byte; every additional eight adds another byte to every component record in the station. On a controller that is a real number. Minimise the count, and keep the indexes contiguous rather than leaving gaps where deleted categories used to be.

Beyond that, how you group is a modelling decision: by equipment type — lighting, door access, HVAC — or by geography, floor by floor. Which one is right depends entirely on how the roles will be drawn, so decide the roles first.

## Operator and admin are a property of the slot

This is the part that is genuinely unintuitive. The operator/admin distinction is not a property of the user or the role — it is a **config flag on the slot**. If a slot's Operator flag is set, the slot is at operator level. If it is cleared, the slot is at admin level.

Most slots default to admin level. The notable exception is the `out` slot, which is normally operator level — which is exactly why an operator can watch a value without being able to touch the logic that produces it.

Admin level carries more than write access to values: it lets a user see and change the slot flags themselves on the slot sheet. Granting admin rights broadly hands out the ability to reconfigure the permission model.

## The permissions map

Editing a role opens a grid with one row per category and columns for the operator and admin levels. Rights are written in a shorthand worth reading fluently: lower case for operator level, upper case for admin. `r` is operator read, `rw` operator read and write, `rR` adds admin read, and `rwRW` is full rights at both levels.

A super user sidesteps all of it — every permission, every category, every object — and can create further super users. Ordinary users cannot grant what they do not hold, so a non-super user cannot promote anybody to super user.

## Two symptoms that account for most of the calls

> **"User does not have access to station. Check permissions."** The credentials were correct — that is the point of the message. Either no role is assigned to the user, or the roles they hold grant nothing. A role needs permissions on at least one component before the user can enter the station at all.

The second is users who cannot change their own password, and the fix is specific. The user service has its own permission scheme, unlike every other component:

| Slot level | Role grants | The user can |
|---|---|---|
| Operator | `r` | Read their own account's properties. Other users are hidden. |
| Operator | `rw` | Read and write their own account — **this is the setting that lets somebody change their own password**. Other users still hidden. |
| Admin | `rR` | Read every user's properties. |
| Admin | `rwRW` | Read and write all non-super users, add and delete users, and use the User Manager and Permissions Browser. |

So: leave the Authenticator slot at operator level, which is its default, and give every non-super-user role operator-level write on the category holding the user service. By default the new station wizard puts that service in the Admin category, which is why the permission people want is in a place they do not think to look.

## Ancestors are granted automatically

Giving somebody access to a point buried six levels deep would be useless if they could not see the folders above it. The station handles this: it automatically grants operator-level read on every ancestor of a component a user can reach, so the nav tree is navigable.

It does so periodically rather than instantly, which is why a freshly granted permission sometimes appears not to work. The category service has an **Update** action that forces it.

## Files have their own rules

The whole file space defaults to the Admin category, and file permissions behave mostly at operator level.

- Operator read to view a file; operator write to edit one.
- Operator read on a folder to list it and copy children out; operator write to create or delete children.
- A few views want admin-level write — the nav file editor among them.
- Operators typically need operator-level read on the standard folders: nav, px, images, html.
Some rules are not yours to set. System module files are automatically restricted to operator-level read. Non-super users are denied everything outside the station home directory. A Supervisor's provisioning folder needs admin-level read to be visible at all. And the station's own `config.bog` and its backup are not accessible in the file space to anybody, super user included.

> **Do not solve a file-access problem by granting Admin.** The documented advice, and the right one, is to create a new category containing only what that person needs. Raising somebody to Admin to let them open one folder grants them the three services and the whole file space as well.

## A model that survives handover

1. **Write the roles down first** — duty by duty, not person by person. Categories follow from roles; roles do not follow from categories.
2. **Keep the category count small and contiguous.** Every one of them is bytes on every component.
3. **Give every non-super role operator write on the user service category**, so password changes are self-service on day one.
4. **Log in as each role and try to break it.** The category browser tells you what a role can reach; actually logging in tells you what it feels like.
5. **Count the super users** before handover, and again after. The number should be small and deliberate.
