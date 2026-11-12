// Local-only browser QA harness. Never used by the production entry point.
import { createServer } from "vite";
import { spawn } from "node:child_process";
import { SignJWT } from "jose";
const secret = "local-browser-preview-secret-32-chars-only";
const game = spawn(process.execPath, ["--import", "tsx", "server/index.ts"], {
  env: {
    ...process.env,
    PORT: "2580",
    BIND_HOST:"127.0.0.1",
    SHOOTER_LOCAL_TRAINING:"true",
    DATABASE_URL: "",
    SHOOTER_TICKET_SECRET: secret,
    SHOOTER_ORIGINS: "http://127.0.0.1:5173,http://localhost:5173",
  },
  stdio: "inherit",
});
// Do not open the page while its game server is still starting.
let gameFailure: Error | undefined;
game.on("error", error => { gameFailure = error; });
game.on("exit", code => { gameFailure = new Error(`Spielserver beendet (${code})`); });
try {
  const deadline = Date.now() + 20000;
  while (true) {
    if (gameFailure) throw gameFailure;
    try {
      const response = await fetch("http://127.0.0.1:2580/health", { signal: AbortSignal.timeout(500) });
      if (response.ok) break;
    } catch { /* Wait for the local child server. */ }
    if (Date.now() >= deadline) throw Error("Lokaler Spielserver startet nicht. Bitte Konsolenmeldung prüfen.");
    await new Promise(resolve => setTimeout(resolve, 100));
  }
} catch (error) {
  game.kill();
  throw error;
}
const vite = await createServer({
  server: {
    host: "127.0.0.1", port: 5173, strictPort: true, open:process.argv.includes("--open"),
    proxy: {
      "/game": {
        target: "http://127.0.0.1:2580", ws: true,
        rewrite: path => path.replace(/^\/game(?=\/|$)/, ""),
      },
    },
  },
  define: { "import.meta.env.VITE_SHOOTER_PREVIEW": "true" },
  plugins: [
    {
      name: "local-test-identity",
      configureServer(server) {
        server.middlewares.use("/api/shooter/ticket", async (req, res) => {
          const id =
            req.headers.authorization === "Bearer preview-b"
              ? "preview-b"
              : "preview-a";
          const ticket = await new SignJWT({
            name: id === "preview-a" ? "Anna" : "Bruno",
            role: "Support.Agent",
          })
            .setProtectedHeader({ alg: "HS256" })
            .setIssuer("supporthub")
            .setAudience("altstadt-1940")
            .setSubject(id)
            .setIssuedAt()
            .setExpirationTime("2m")
            .sign(new TextEncoder().encode(secret));
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              ticket,
              serverUrl: `http://${req.headers.host}/game`,
              playerId: id,
            }),
          );
        });
      },
    },
  ],
});
try {
  await vite.listen();
} catch (error) {
  game.kill();
  await vite.close();
  throw error;
}
vite.printUrls();
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () => {
    game.kill();
    void vite.close().then(() => process.exit());
  });
