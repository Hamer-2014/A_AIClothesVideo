import { createServer } from "node:http";

import { readWorkerConfig } from "./config.js";
import { handleRequest } from "./http.js";
import { runStitchJob } from "./stitch.js";

const config = readWorkerConfig();
const port = Number(process.env.PORT ?? 8080);

const server = createServer(async (incoming, outgoing) => {
  const request = new Request(`http://localhost${incoming.url ?? "/"}`, {
    method: incoming.method,
    headers: incoming.headers as HeadersInit,
    body:
      incoming.method === "GET" || incoming.method === "HEAD"
        ? undefined
        : (incoming as unknown as BodyInit),
    duplex: "half",
  } as RequestInit);

  const response = await handleRequest(request, {
    config,
    stitch: (payload) => runStitchJob({ payload, config }),
  });

  outgoing.statusCode = response.status;
  response.headers.forEach((value, key) => outgoing.setHeader(key, value));
  outgoing.end(Buffer.from(await response.arrayBuffer()));
});

server.listen(port, "0.0.0.0", () => {
  console.log(`stitch-worker listening on port ${port}`);
});
