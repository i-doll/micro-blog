import path from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || "3007", 10);
const API_URL = process.env.API_URL || "";

const staticRoot = path.resolve(__dirname, "..", "static");

// Read and optionally patch index.html at startup
const rawHtml = readFileSync(path.join(staticRoot, "index.html"), "utf-8");
const indexHtml = API_URL
  ? rawHtml.replace(
      "const API = window.location.origin",
      `const API = '${API_URL}'`,
    )
  : rawHtml;

const app = Fastify({ logger: true });

// Serve static files under /static
await app.register(fastifyStatic, {
  root: staticRoot,
  prefix: "/static/",
});

// Health check
app.get("/health", async () => {
  return { status: "ok", service: "frontend" };
});

// Serve index.html at root
app.get("/", async (_request, reply) => {
  reply.type("text/html").send(indexHtml);
});

await app.listen({ port: PORT, host: "0.0.0.0" });
console.log(`Frontend service listening on port ${PORT}`);
