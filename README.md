# Egoshooter · Altstadt 1945

Server-authoritative multiplayer browser shooter. React / Three.js client, Colyseus 0.18 server, PostgreSQL results, Microsoft Entra integration through SupportHub. Work in progress: procedural graphics are a playable prototype, not finished historical art.

## Lokal spielen

Voraussetzung: Node.js 22 oder neuer. Nach dem Klonen:

```sh
npm ci
npm run preview:solo
```

Im Browser `http://127.0.0.1:5173/` öffnen und **Alleine testen** wählen.
Unter Windows funktioniert danach auch `Start-Spiel.cmd`. Die lokale Vorschau
verwendet Testidentitäten und benötigt weder Entra-Zugang noch PostgreSQL.
Sie bindet ausschließlich an Loopback und ist kein öffentlicher Spielserver.

WASD: Bewegung · Maus: Blickrichtung · rechte Maustaste: Zielen · R: Nachladen ·
1/2/3/4: Waffen (4 = modernes G36) · Umschalt: Sprint · C: Ducken · Esc: Maus freigeben.

Unter **Startfigur / Uniform** stehen zusätzlich Deadpool, Harley Quinn, Rocket
und Homer zur Auswahl. Diese Bonus-Skins werden bei Bedarf geladen und behalten
dieselben Spielwerte und Trefferzonen; Rocket ist dafür auf Spielerhöhe skaliert.
Die Herkunft der vom Nutzer gelieferten Modelle ist in
[PROVENANCE.md](public/shooter/characters/bonus/PROVENANCE.md) dokumentiert.

## Grafik und flüssiges Spielen

**Auto · Ziel 60 FPS** ist die Voreinstellung. Oberfläche und HUD können in
1920 × 1080 dargestellt werden; das 3D-Bild startet mit maximal 1280 × 720
internen Pixeln. Unter dauerhafter Last reduziert die Automatik die Auflösung
bis auf 540 Bildzeilen. Die festen Stufen Flüssig, Hoch und Ultra bleiben verfügbar.
Auto verwendet SMAA, aktualisiert Schatten mit bis zu 30 Hz und lässt die teuren
AO-/Bloom-Pässe aus. Höhere feste Stufen priorisieren Bildqualität.

Die Überarbeitung umfasst PBR-Putz-/Felsmaterialien, vertiefte Fensterrahmen,
Sockelmauerwerk, Schornsteine, unregelmäßige Felsformen mit identischer Client-/
Server-Kollision, animiertes Wasser, anatomische Waffenhände und geglättete
Ziel-, Lauf-, Rückstoß- und Nachladebewegungen. Statische Waffen- und Weltteile
werden gebündelt; Kistenstapel sind instanziert.

Die reproduzierbare Grafikprüfung liegt unter
`http://127.0.0.1:5173/tests/graphics-preview.html` und bietet feste Kameras,
Waffenwechsel, Nachladen und acht Figuren (historisch oder Bonus-Mix). Die Anzeige misst 120 Bildintervalle
nach fünf Sekunden Anlaufzeit. 60 FPS sind ein Ziel, keine Hardwaregarantie.

Aktueller Veröffentlichungsumfang: **lokaler Betrieb und GitHub-Quellstand**.
Es wird keine Live-Umgebung automatisch veröffentlicht.

## Local checks

```
npm ci
npm test
npm run build
npm run test:network
```

The network test starts its own local server and eight real WebSocket clients, verifies admission, room lookup, countdown, inputs and reconnect. A WebSocket proxy applies 25–75 ms delay in each direction (50–150 ms RTT); it does not emulate packet loss. Unit tests cover combat, spawn, timing and collision. Browser QA uses `node --import tsx tests/preview.ts`: open `http://127.0.0.1:5173/` and `http://127.0.0.1:5173/?player=b`. This isolated loopback harness has two dummy identities and is never a production authentication mechanism.

## SupportHub integration

`python integration/install.py <absolute-Ticketsystem_Support-path>` installs shooter-owned files and adds the lazy gate and ticket router without replacing existing CasinoShell behavior. Run `npm install` in SupportHub afterward. In the casino module, Ctrl+Alt+G opens/closes the game. The game has its own database and never calls Jira mutation APIs.

The new `POST /api/shooter/ticket` requires the existing Entra bearer token, the `Support.Agent` role and `SHOOTER_ENABLED=true`. It returns a 120-second signed game admission token, server URL and stable player ID. No game secret is sent to the browser. `GET /rooms/:code` and `GET /stats` on the game host also require a game ticket. Existing rooms use SDK reconnection credentials for the ten-second reconnect window.

## Deployment

1. Verify the actual app release/host and free CPU/RAM before deploying. The repository contains both Azure and Komodo configurations; no live host is assumed.
2. Set unique secrets using `.env.example`; use hexadecimal database passwords to avoid URL escaping issues. Keep the same `SHOOTER_TICKET_SECRET` on game and existing backend.
3. Deploy this directory as a separate Komodo stack using `compose.yml`. Configure TLS and WebSocket forwarding with `deploy/nginx.conf`, including external network connectivity if the reverse proxy is containerized. The published port is intentionally loopback only.
4. Add `deploy/supporthub-shooter.override.yml` to the existing app stack's Compose files. Set `SHOOTER_PUBLIC_URL` and exact allowed browser origin. Leave `SHOOTER_ENABLED=false` until the closed test passes.
5. Test `/health`, existing Entra login, two browsers, eight clients, reconnect, result persistence and restore from backup. Run `deploy/backup.ps1` from this repository for a binary PostgreSQL dump; schedule it on the host and copy backups independently. Restore with `pg_restore` into an isolated test database first.
6. Enable the feature. To roll back, set `SHOOTER_ENABLED=false` and stop the game stack; normal app routes continue to operate. Existing matches are lost on game-server restart and never counted.

## Verification limits

No production deployment, physical-PC FPS measurement, historical asset review, PostgreSQL restore or real Entra browser login is implied by automated checks. Both maps have six open buildings and three upstairs routes. Audio remains synthesized; historical detailing, full motion-captured animation and broad hardware testing remain open. See THIRD_PARTY_NOTICES.md and per-asset provenance before distributing.

## Earlier integration verification (12 November 2026)

- 8 game/protocol tests passed; 2 backend ticket tests passed.
- Eight actual WebSocket clients completed an accelerated 15-second match and rematch behind an ordered 50–150ms RTT proxy; admission, room lookup, countdown, invalid input and reconnect checks passed.
- Two separate browser tabs joined one room with distinct local test identities and reached the running 3D view. No browser errors were recorded at that stage. This was not a complete ten-minute manual combat session.
- Shooter production build and the integrated SupportHub production build passed; SupportHub module boundaries and isolated-checkout TypeScript checks passed.
- The normal SDK installation hit filesystem errors in the original OneDrive folder. The SDK and its private dependencies were copied from the successfully installed isolated checkout; the npm-generated lockfile was copied back. No existing dependency package was overwritten.
- Not verified: live deployment/host capacity, real Entra login end-to-end, PostgreSQL persistence/restore, physical hardware FPS, complete manual inspection of all upstairs routes, or final historical fidelity.

The direct TypeScript rerun in the original OneDrive tree was stopped after several minutes without completion; the same integrated source passed TypeScript and production build in the isolated checkout. No passing result is claimed for that stalled rerun. Local QA servers were stopped after testing.
