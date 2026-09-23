# Tags, dictionaries and the licence you need

> Tagging is how a station describes itself to software that did not engineer it. Three kinds of tag, one namespace, and a licence feature that gates it.

Source: https://plantroomlabs.com/notes/niagara-tag-dictionaries/  
Published: 2026-09-23 (23 September 2026) · Plantroom Labs  
Topics: Tagging, Data modelling, Haystack

Tagging is sold as tidiness. It is not: it is the difference between a station another tool can read and one it can only display.

> **Check the licence first.** The `tags` licence feature is required to use the `TagDictionaryService` and tag dictionaries on a station. A tagging scope agreed against a licence that does not carry it is a conversation nobody enjoys having in week three.

## What a tag is made of

A tag has an id, and the id is two parts separated by a colon: `namespace:name`. The namespace names the dictionary the tag came from and is normally one or two characters — `n` for Niagara, `hs` for Haystack. A tag may also carry a value, which is where the building name, the equipment reference or the location goes.

Mechanically, a direct tag on a component is a property holding a non-component value with the metaData flag set. That is worth knowing because it explains both why tagging is cheap and why an untidy tagging job is as durable as any other untidy property.

## Three kinds, and only two of them scale

| Kind | Where it comes from | Use it when |
|---|---|---|
| Direct | Added deliberately from an installed dictionary, and stored on the component. | The normal case. Shared vocabulary, visible in the Direct Tags tab. |
| Implied | Not stored at all — produced by tag rules in a Smart Tag Dictionary, typically remapping properties the component already has onto the dictionary's naming. | Wherever the information is already in the station. Nothing to maintain and nothing to get out of step. |
| Ad hoc | Typed in the Add Tag dialog. A direct tag belonging to no dictionary. | Rarely. This is how a tagging project quietly turns into a second naming convention with no validation behind it. |

## What a dictionary actually contains

A tag dictionary is more than a word list. It carries a unique namespace, tag definitions with their default values and validation rules, optional tag group definitions — standard groupings you can apply in one action — optional relation definitions, and, in a smart dictionary, the tag rules that generate implied tags.

Niagara 4.15 ships a **Brick** tag dictionary in the `brick` palette, dropped into the `TagDictionaryService` over a Fox connection, with two narrower alternates — `BrickHasTagsOnly` and `BrickSubclassesOnly`. Brick models a building as a class hierarchy, so which of the three you install decides how much of that ontology lands in the station. Pick deliberately; retagging afterwards is the expensive direction.

## Doing it to a whole station

Tagging point by point is how tagging projects die. The Batch Editor under `Program Service` is the tool: **Find Objects** opens the BQL Query Builder, you narrow the result set, remove what should not be there, and **Add Tag** applies a tag — or a whole tag group — to everything selected at once.

Do it at discovery time where you can. Associations are typically established when a device is discovered, registered and subscribed, and a tag added then costs nothing compared with a tag added to four thousand existing points.

## What it buys

One thing, and it is worth the effort by itself: another piece of software can discover what is in the station without knowing the naming convention the installer used. Hierarchies, search, analytics and any external consumer stop depending on whether somebody wrote `SpaceTemp` or `ZnT` in 2019.
