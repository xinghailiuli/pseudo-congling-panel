# Artwork sources

Character source and mandatory attribution: [PC2005-cloud/dsh-pet](https://github.com/PC2005-cloud/dsh-pet).

`room-pet/` contains the original character frames needed by this panel. The source commit and conversion metadata are in `room-pet/manifest.json`; the upstream repository MIT text is retained in `room-pet/LICENSE.txt`. The upstream README separately restricts artwork to noncommercial use with attribution. See `room-pet/ASSET-LICENSE.md` and the root `THIRD_PARTY_NOTICES.md`.

`room-actions/` and `room-house/` contain the panel's AI-assisted 2D room/action artwork, including character derivatives. They retain the noncommercial and attribution terms described in `THIRD_PARTY_NOTICES.md`. `room-actions/manifest.json` holds the frame, hotspot and contact coordinates. Runtime movement and masking are implemented in `src/room-*.mjs`.

The current scene uses floor-one-v6, floor-two-v7, normal walk-v3 frames, upstairs-garden-v7 and the v4/v5 contact layers. Older artwork still referenced by the renderer's compatibility routes or tests is retained. Private source-image paths and generation receipts are excluded from this distribution.

`asset-integrity.json` lists SHA-256 hashes of the distributed PNG and WebP files. Bundled pictures are byte-for-byte copies; no substitute resident is used.
