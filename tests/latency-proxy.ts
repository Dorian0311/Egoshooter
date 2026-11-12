import http from "node:http";
import { WebSocket, WebSocketServer } from "ws";
// Real ordered delay on both WebSocket directions. One fixed one-way delay per client.
export async function latencyProxy(port: number, upstreamPort: number) {
  const pending = new Set<ReturnType<typeof setTimeout>>();
  const sockets = new Set<WebSocket>();
  let count = 0;
  const server = http.createServer((req, res) => {
    const upstream = http.request(
      {
        hostname: "127.0.0.1",
        port: upstreamPort,
        path: req.url,
        method: req.method,
        headers: req.headers,
      },
      (reply) => {
        res.writeHead(reply.statusCode ?? 502, reply.headers);
        reply.pipe(res);
      },
    );
    upstream.on("error", () => {
      res.writeHead(502);
      res.end();
    });
    req.pipe(upstream);
  });
  const wss = new WebSocketServer({ noServer: true });
  function later(fn: () => void, ms: number) {
    const timer = setTimeout(() => {
      pending.delete(timer);
      fn();
    }, ms);
    pending.add(timer);
  }
  server.on("upgrade", (req, socket, head) =>
    wss.handleUpgrade(req, socket, head, (client) => {
      const delay = 25 + (count++ % 3) * 25;
      const upstream = new WebSocket(
        `ws://127.0.0.1:${upstreamPort}${req.url}`,
        { headers: { Origin: "http://127.0.0.1:5173" } },
      );
      sockets.add(client);
      sockets.add(upstream);
      const queue: { data: Buffer; binary: boolean }[] = [];
      const forward = (target: WebSocket, data: Buffer, binary: boolean) =>
        later(() => {
          if (target.readyState === WebSocket.OPEN)
            target.send(data, { binary });
        }, delay);
      client.on("message", (data, binary) => {
        const payload = Buffer.from(data as Buffer);
        if (upstream.readyState === WebSocket.CONNECTING)
          queue.push({ data: payload, binary });
        else forward(upstream, payload, binary);
      });
      upstream.on("open", () =>
        queue.forEach((item) => forward(upstream, item.data, item.binary)),
      );
      upstream.on("message", (data, binary) =>
        forward(client, Buffer.from(data as Buffer), binary),
      );
      client.on("close", (code) => {
        if (upstream.readyState === WebSocket.OPEN)
          upstream.close(code === 1006 ? 4010 : code);
        sockets.delete(client);
      });
      upstream.on("close", (code) => {
        if (client.readyState === WebSocket.OPEN)
          client.close(code === 1006 ? 4010 : code);
        sockets.delete(upstream);
      });
      client.on("error", () => client.terminate());
      upstream.on("error", () => {
        upstream.terminate();
        client.terminate();
      });
    }),
  );
  await new Promise<void>((resolve) =>
    server.listen(port, "127.0.0.1", resolve),
  );
  return async () => {
    pending.forEach(clearTimeout);
    sockets.forEach((s) => s.terminate());
    wss.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  };
}
