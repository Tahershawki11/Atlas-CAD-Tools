# Third-party notices

Atlas Tools reuses selected CAD and CRS source modules and the public synthetic DXF sample from
[Ahshika/FiberLens](https://github.com/Ahshika/FiberLens), commit
`29e931062d706820caa4c1a8078723bd9356777c` (retrieved 2026-11-10).
FiberLens declares ISC in package.json; its root does not include a standalone LICENSE file.
Attribution and source provenance are retained here. Confirm upstream redistribution terms before public distribution.

Adaptations: transparent WebGL/Canvas surfaces, integration and resource cleanup around the renderer,
plus a new independent frontend, storage layer and Leaflet projection adapter. Unused FTTH/platform modules
are not included. acadExport is retained for reproducible test-fixture generation, not exposed as a product feature.

| Dependency | License | Purpose |
|---|---|---|
| @node-projects/acad-ts 3.2.0 (ACadSharp port) | MIT | DWG/DXF parsing and test-fixture writing |
| React, react-dom | MIT | UI |
| Leaflet 1.9.4 | BSD-2-Clause | Map and interactions |
| proj4 | MIT | CRS transformation |
| Dexie | Apache-2.0 | IndexedDB |
| rbush | MIT | Spatial indexes |
| earcut | ISC | Polygon triangulation |
| lucide-react | ISC | UI icons |
| IBM Plex Sans Arabic | SIL Open Font License 1.1 | Locally hosted Arabic UI font |

The font license is included at `public/fonts/OFL.txt`. OpenStreetMap base tiles are online and attributed
in the map. No Autodesk SHX fonts are distributed. DWG is used descriptively; this application does not
claim Autodesk affiliation or TrustedDWG certification.
