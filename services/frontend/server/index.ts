import path from "node:path";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || "3007", 10);
const API_URL = process.env.API_URL || "";

const distDir = path.resolve(__dirname, "..", "dist", "client");

const app = Fastify({ logger: true });

// Serve built assets
await app.register(fastifyStatic, {
  root: distDir,
  prefix: "/",
  decorateReply: false,
});

// Health check
app.get("/health", async () => {
  return { status: "ok", service: "frontend" };
});

// Read built HTML and inject runtime config
const indexPath = path.join(distDir, "index.html");
let indexHtml = "";
if (existsSync(indexPath)) {
  indexHtml = readFileSync(indexPath, "utf-8");
  if (API_URL) {
    // Inject window.__CONFIG__ before closing </head>
    const configScript = `<script>window.__CONFIG__=${JSON.stringify({ API_URL })};</script>`;
    indexHtml = indexHtml.replace("</head>", configScript + "</head>");
  }
}

// SPA fallback: serve index.html for all non-file routes
app.setNotFoundHandler(async (_request, reply) => {
  if (indexHtml) {
    reply.type("text/html").send(indexHtml);
  } else {
    reply.code(404).send({ error: "Not found" });
  }
});

await app.listen({ port: PORT, host: "0.0.0.0" });
console.log(`Frontend service listening on port ${PORT}`);
