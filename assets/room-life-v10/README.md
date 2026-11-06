# Room Life v10 artwork

Local 2D full-character animation for the existing illustrated room. No 3D rig is used. Original character assets, original room art and their existing notices remain unchanged.

- `sofa`, `garden`, `bed`, `desk`, `upper`: 24 full-body frames each.
- `carry`: 16 full-body frames with attached can/hoe and alternating steps.
- `cover`: 12 corrected oblique quilt poses covering torso and legs.
- `greenhouse`: gate/aisle patch; only the greenhouse region is composited.
- `geometry.json`: alpha-derived crop/outline metadata; PNG bytes are unmodified.
- `provenance.json` and `generation-additions.json`: generation prompts and original references.

The existing walk-v3 atlas is reused. Native delivery is through `lib/client.room-life-v10.js`, requested only when opening the room. A failed decode leaves the original contact artwork available. Repeated revision-10 deliveries preserve the active pose and queued exit.

Bench, resting props and writing paper are renderer-only details. The saved inventory stays at 19 objects. All activity effects are local; they do not send QQ messages, write diaries or perform Minecraft actions.

Validation: isolated scene inspection and offline tests. Final native DSH visual acceptance remains with the user.
