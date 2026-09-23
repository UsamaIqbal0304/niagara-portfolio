# Templates: build the AHU once, deploy it fifty times

> Component, application and station templates do different jobs — and only one of them supports bulk deployment from a spreadsheet and upgrade in place.

Source: https://plantroomlabs.com/notes/niagara-templates/  
Published: 2026-09-23 (23 September 2026) · Plantroom Labs  
Topics: Templates, Bulk engineering, Station engineering

Copy-and-paste engineering produces fifty air handlers that were identical on the day they were made. A template keeps them identical &mdash; and lets you upgrade all fifty at once.

## Three things called templates

Niagara uses the word for three different mechanisms with different constraints. Picking the wrong one is expensive later, because two of the three cannot be upgraded afterwards.

| Type | Deployed to | Instances | Upgradeable |
|---|---|---|---|
| Station template | Used by Workbench when creating a *new* station. Not installable into a running one. | One, at birth | No |
| Application template | Installed into a running station, at the root of Config, replacing most of the station's contents. | One per station | Yes |
| Component (device) template | Deployed into any suitable container, with a name you choose at deployment. | Many | Yes |

All three can carry graphics and subtemplates, and **subtemplates are always component templates** regardless of what contains them. Only the component template can define inputs, outputs and references, which is what makes it the one you reach for when the repeated thing is a plant item rather than a whole application.

> **Installing an application template deletes what is there.** That is deliberate — it guarantees no fragment of the old application survives and no names collide — but it means an application template is a replacement operation, not an addition. Know which of the two you are doing before you click it.

## Exposed properties are the whole point

A template with no exposed properties is a photocopier. The Configuration tab of the template view lets you pick individual properties from inside the logic and expose them; each exposed property can be renamed to something meaningful and given a default value. At deployment the job prompts for those values.

So the design decision is: what differs between the fifty air handlers? Setpoint limits, addresses, zone names, run-on times. Expose exactly those, and the deployment becomes a form rather than an engineering exercise. Expose too little and people edit inside the deployed instance, which defeats the upgrade path.

## Bulk deployment from a spreadsheet

Component templates can be deployed one at a time, or in bulk from an exported Excel file through the Template Manager. The export contains one worksheet per template, named from the template's vendor and title, with the first two columns identifying the instance — parent path, component name, display name, location — and the remaining columns carrying inputs, outputs, relations, exposed configuration properties and optional string tags. One row is one instance.

> **Worksheet order is not cosmetic.** The deployment job works left to right, creating every template item before it creates any links or relations. If one template needs something another template creates, its worksheet must sit to the *right* of the one that creates it. Reordering tabs is a legitimate part of preparing the file.

Three more things the file will teach you the hard way otherwise. The top six rows are metadata that must not be edited — to change them, edit the template's information properties in Workbench and export again. Header cells carry comments explaining each column, which is faster than guessing. And from Niagara 4.14 each input, output and relation gains an extra column for slot path scope, so an older spreadsheet is not a current one.

If the template holds credentials the export is encrypted and prompts for a password on import. Keep it encrypted; it is a file full of passwords sitting in somebody's downloads folder otherwise.

> **Cancelling a bulk deployment does not undo it.** Cancel stops the job where it is and leaves everything already created in place. On a large sheet, test with two rows before running four hundred.

## Upgrade, downgrade, redeploy — and detach

The reason to accept the discipline of templates is here. Fix a fault in the template, and upgrade propagates the fix to every deployed instance through the same provisioning machinery that runs any other estate-wide job. Downgrade and redeploy use the same process. The Template Manager shows each deployment's status, so "is every AHU on the current version" is a view rather than an investigation.

> **Detach is one-way.** Detaching a deployed template makes it an ordinary set of components again — and it can never be upgraded. It is the right call when you are deliberately abandoning a template line, and a quiet disaster when somebody does it to make one local edit easier.

## Where the effort actually goes

1. **Decide the unit.** One template per plant type, not per variant. Variants are exposed properties.
2. **Expose properties generously** and name them for the engineer filling in the spreadsheet, not for the slot they came from.
3. **Deploy two instances by hand first.** Everything wrong with a template is obvious at two instances and expensive at two hundred.
4. **Order the worksheets by dependency** before the first bulk run.
5. **Never edit inside a deployed instance.** Fix the template and upgrade, or the next upgrade overwrites the local fix and nobody remembers it was there.
