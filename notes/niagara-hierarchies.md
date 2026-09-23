# A navigation tree that builds itself

> Hierarchies generate the nav tree from tags and NEQL queries instead of hand-placed nodes — and the cache hides your edits until you rebuild it.

Source: https://plantroomlabs.com/notes/niagara-hierarchies/  
Published: 2026-09-23 (23 September 2026) · Plantroom Labs  
Topics: Hierarchies, Tagging, Station engineering

A hand-built nav file is a second copy of the building, maintained by hand, that drifts the moment anything changes. A hierarchy is a set of rules that regenerates the tree from what the station already knows.

## The problem with a hand-built tree

Every station needs a navigation structure that matches how people think about the building — site, then building, then floor, then plant — rather than how the drivers happened to be laid out. The obvious way to get one is to place every node by hand.

That works exactly once. Add twenty points, rename a plant item, commission a second floor, and the tree and the station disagree. Nobody notices until an operator cannot find a point that has existed for a month.

The `HierarchyService`, installed by default under Services and supplied by the `hierarchy` module, takes the other approach: you describe the levels, and the station generates the tree by querying itself.

## Level definitions: two families

A hierarchy is a tree of level definitions, one per node level. They come in two kinds, and mixing them up is the usual first mistake.

| Level definition | Family | What it does |
|---|---|---|
| GroupLevelDef | Group | Creates a node per distinct *value* of a tag. One node per building, one per floor. Marker tags do not belong here — they have no values to group by. |
| ListLevelDef | Group | Creates nodes from one or more named group definitions, each carrying its own query. Here both marker and value tags are fair game. A list level with no named group inside it produces nothing. |
| QueryLevelDef | Entity | The level that actually shows data. An NEQL query over tags, returning the components that match. |
| RelationLevelDef | Entity | Also shows data, but follows a *relation* from the parent node rather than querying tags in isolation. This is how "the AHUs that serve this floor" becomes a tree level. |

> **Group levels are scaffolding; entity levels are content.** A hierarchy made only of group levels produces a tidy set of empty folders. Nothing appears under them until a query or relation level is added at the bottom.

## NEQL, briefly

The queries are written in NEQL, the same language the Search bar uses, so anything you can find by searching you can turn into a tree level. A few forms cover most real hierarchies:

| Query | Matches |
|---|---|
| `n:device` | Everything carrying the device marker tag. |
| `n:type = "baja:Folder"` | Entities of a given Niagara type. |
| `n:name like ".*Switch.*"` | Name matching a regular expression. Useful for estates that never got a naming standard. |
| `t:foo and not t:herp` | Boolean combinations, including negation. |
| `n:parent->hs:floor = 2` | Relation traversal — children of entities whose floor tag is 2. |

> **Tags are case sensitive.** A query with the wrong case returns nothing at all, silently, and looks identical to a query against a tag nobody applied. This is the single most common reason a level comes back empty.

Two extras are worth knowing. A BQL query can be appended to an NEQL query with a pipe, which is handy for building report tables — the documentation warns plainly that it can be expensive, so it belongs in a report rather than in a tree level somebody expands fifty times a day. And from Niagara 4.6 the `sys` ORD scheme redirects a query at the System Database, so a hierarchy can span an estate rather than a station.

## Scope

Each hierarchy has a scope container. The default is the whole station, and the scope ORD narrows it to a branch — pointing it at a model folder for one building, for instance. The alternative is to narrow with extra level definitions instead. Scoping is usually cheaper, because the query never visits the rest of the station.

## Who sees which tree

Visibility is granted role by role: the Role Manager has a **Viewable Hierarchies** field, and a role may be given more than one. Because a station can hold several hierarchies, a facilities manager and a plant operator can navigate the same station through completely different structures.

> **Assigning a hierarchy to a role only exposes the top of it.** Everything below is still filtered by that role's category permissions. Handing somebody a hierarchy does not hand them the points in it, which is the correct behaviour but surprises people who expect one setting to do both jobs.

## The cache, and the trap inside it

From Niagara 4.4 a hierarchy can be cached on the station side, which makes expanding a large tree in Workbench or a browser dramatically faster. The cost is station heap, and it is applied per hierarchy, by hand, through an action on the hierarchy's right-click menu. The cache lives in memory only, so it is rebuilt at every station start unless `Cache On Station Started` is set.

> **A cached hierarchy does not notice changes — including permission changes.** Edit the definition, or revoke a user's access to part of the tree, and the cache serves the old answer until somebody clears and rebuilds it. A user you have just locked out can keep browsing. Whoever makes the change owns rebuilding the cache, and that needs to be written down rather than assumed.

Separately, and much less alarmingly: editing a hierarchy definition does not refresh a tree that is already open. Right-click the hierarchy node and refresh it, or spend ten minutes convinced your edit did nothing.

## Doing it in the right order

1. **Draw the tree on paper first.** The level definitions follow from the structure; deriving the structure from the level definitions goes badly.
2. **List the tags it will need** and check they exist, with consistent naming and consistent case. Tags may come from any dictionary or be ad hoc; what they cannot be is improvised per building.
3. **Add the relations** the tree depends on — a floor to its air handlers, say — before writing the relation level that walks them.
4. **Build it iteratively.** Save, evaluate, look at the tree, add the next level. Copy and paste level definitions between hierarchies rather than retyping them.
5. **Set the timeout deliberately.** Hierarchy query processing defaults to a 45-second ceiling; a level that regularly hits it is a level that needs scoping, not a bigger number.
6. **Decide the cache policy before handover**, including who rebuilds it after a permissions change.
