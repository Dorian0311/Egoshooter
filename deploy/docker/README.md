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

## Checks

The GitHub Actions workflow builds the actual containers on Linux, waits for
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
