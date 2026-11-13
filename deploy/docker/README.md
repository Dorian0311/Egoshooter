# Docker multiplayer deployment

The root `compose.yml` is the complete deployment: `web` (Caddy + built client),
`game` (Node.js/Colyseus + SQLite profiles) and `db` (PostgreSQL match results).
Build targets in the root Dockerfile are `web` and `game`. The final/default
Dockerfile target remains the game server for existing backend-only builds.
Base images support x86-64 and ARM64; build on the intended host architecture.

## Start

From the repository root, run:

```sh
node scripts/configure-docker.mjs game.example.org
docker compose config --quiet
docker compose up -d --build
docker compose ps
```

Create the domain's A/AAAA records first and allow incoming TCP 80/443. UDP 443
is optional for HTTP/3. Only Caddy publishes ports. Secrets are required: a
missing hostname, origin, JWT secret or database password prevents startup.
The setup script creates `.env` with random hexadecimal secrets, avoids
database-URL escaping problems and refuses to overwrite existing settings.
Node.js on the host is optional if `.env` is created manually from `.env.example`.

Keep the same `.env` and named volumes across updates. Update the code, then run
`docker compose up -d --build`. Existing profiles use the `shooter-users` volume,
results use `shooter-db`, and Caddy certificates use `shooter-caddy-data`.
The project name remains `altstadt1940` to preserve existing root Compose volumes.

## Portainer web editor

Use the root `compose.portainer.yml` when pasting a stack into Portainer's web
editor. Both build contexts point to the public GitHub repository's `main`
branch, so the Dockerfile and application files are available without a local
checkout. Docker on the target host must be able to reach GitHub and the image
registries. `SHOOTER_BUILD_CONTEXT` can optionally pin a full Git commit URL.

In Portainer's **Environment variables** panel outside the editor, set:

| Name | Value |
| --- | --- |
| `GAME_HOST` | Public hostname without `https://`, for example `game.example.org` |
| `SHOOTER_ORIGINS` | `https://game.example.org` |
| `SHOOTER_TICKET_SECRET` | A random hexadecimal secret of at least 32 characters |
| `POSTGRES_PASSWORD` | A different random hexadecimal password |

The configuration helper does not execute automatically in Portainer. Variables
may also be loaded from a private `.env` generated on another trusted machine.
Keep existing port mappings and persistent volume paths when repairing a stack.
If public HTTPS uses a forwarded host port, external port 443 must reach Caddy's
container port 443.

### Existing HTTPS reverse proxy

For Nginx Proxy Manager, Traefik or another proxy that already terminates HTTPS,
paste `compose.portainer.proxy.yml` into Portainer instead. This uses the
`web-proxy` image target, serves plain HTTP on container port 80, and publishes
it as host port 6080. Configure the existing proxy with:

- Public hostname: the same value as `GAME_HOST`.
- Upstream scheme: **HTTP**.
- Upstream address: the Docker host's address reachable from that proxy.
- Upstream port: **6080**.
- WebSocket support enabled; keep the upstream connection timeout long enough
  for persistent game connections.

Keep `SHOOTER_ORIGINS=https://<public-hostname>`: browsers connect to the public
HTTPS site, so session cookies stay Secure and game tickets use the same HTTPS
origin. There is no port 6082/443 listener or second certificate issuer in this
variant. `WEB_PORT` optionally changes 6080; `WEB_BIND_ADDRESS` can restrict the
published address to a private interface or loopback when reachable by the
proxy. Restrict direct access to that HTTP port to the intended proxy network.
For proxies sharing a Docker network, `web:80` can instead be the upstream;
attach the web container to that existing network explicitly.

## Checks

The GitHub Actions workflow builds from GitHub source in both direct-HTTPS and
upstream-proxy configurations on Linux, waits for
PostgreSQL/game readiness, trusts the isolated stack's local certificate only
for its test process and runs:

```sh
npm run test:docker
```

The smoke test checks the HTTPS client, authenticated HTTP routes, WebSocket
proxying with eight players, a synchronized start, movement and PostgreSQL stats.
With `TEST_DOCKER_RESTART=true`, it restarts only a `https://localhost` test stack
and checks that the same login session survives. Do not enable this flag against
a production stack. Tests create `DockerQA_*` profiles in their isolated database.

## Backup and migrate local profiles

Stop the game service before replacing its SQLite database. Back up the PC's
`data/users.sqlite` with SQLite's backup API or while the local game server is
stopped; do not copy a database while it is being written. Restore the backup
into `/app/data/users.sqlite` in the `shooter-users` volume, owned by UID/GID
`1000:1000`, then start `game` again. Never put the database in `public/` or `dist/`.

PostgreSQL backup example from the repository root:

```sh
mkdir -p backups
docker compose exec -T db pg_dump -U shooter -d shooter -Fc > backups/shooter.dump
```

This redirection example is for a POSIX shell. On Windows use the existing
`deploy/backup.ps1`, which preserves binary data via `docker cp`.
`docker compose down -v` permanently removes the stack's data and certificates;
ordinary stop/down commands without `-v` retain them.
