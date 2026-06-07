import { createServer } from "node:http";
import { createApp } from "./app";
import { env } from "./config/env";
import { prisma } from "./lib/prisma";

async function startServer() {
  await prisma.$connect();

  const app = createApp();
  const server = createServer(app);

  server.listen(env.serverPort, () => {
    console.log(`[server] listening on http://localhost:${env.serverPort}`);
  });

  const shutdown = async (signal: string) => {
    console.log(`[server] received ${signal}, disconnecting prisma...`);
    await prisma.$disconnect();
    server.close(() => {
      process.exit(0);
    });
  };

  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });

  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
}

startServer().catch(async (error) => {
  console.error("[server] failed to start", error);
  await prisma.$disconnect();
  process.exit(1);
});
