import { createServer } from "node:http";
import { createApp } from "./app";

const port = Number(process.env.SERVER_PORT ?? 3001);
const app = createApp();
const server = createServer(app);

server.listen(port, () => {
  console.log(`[server] listening on http://localhost:${port}`);
});
