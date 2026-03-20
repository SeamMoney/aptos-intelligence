import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import { initDb, getReports, getReportById, getReportsByCategory, getAllFeatureStatuses } from "./db.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Resolve the frontend dist directory (built Vite app)
const distDir = join(__dirname, "..", "web", "dist");
const legacyHtml = join(__dirname, "public", "index.html");

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
};

function sendJson(res: any, data: any, status = 200) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(JSON.stringify(data));
}

function serveStatic(res: any, filePath: string): boolean {
  if (!existsSync(filePath) || !statSync(filePath).isFile()) return false;
  const ext = extname(filePath);
  const mime = MIME_TYPES[ext] || "application/octet-stream";
  const content = readFileSync(filePath);
  res.writeHead(200, {
    "Content-Type": mime,
    "Cache-Control": ext === ".html" ? "no-cache" : "public, max-age=31536000, immutable",
  });
  res.end(content);
  return true;
}

// Load the index.html (React SPA fallback)
function getIndexHtml(): string {
  // Prefer built React app
  const reactIndex = join(distDir, "index.html");
  if (existsSync(reactIndex)) return readFileSync(reactIndex, "utf-8");
  // Fallback to legacy static HTML
  if (existsSync(legacyHtml)) return readFileSync(legacyHtml, "utf-8");
  return "<h1>Aptos Intelligence</h1><p>Frontend not built. Run: cd web && npm run build</p>";
}

const server = createServer((req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);
  const path = url.pathname;

  // API routes
  if (path === "/api/reports") {
    const category = url.searchParams.get("category");
    const limit = parseInt(url.searchParams.get("limit") || "50");
    const reports = category ? getReportsByCategory(category) : getReports(limit);
    return sendJson(res, reports);
  }

  if (path.startsWith("/api/reports/")) {
    const id = parseInt(path.split("/")[3]);
    if (isNaN(id)) return sendJson(res, { error: "Invalid ID" }, 400);
    const report = getReportById(id);
    if (!report) return sendJson(res, { error: "Not found" }, 404);
    return sendJson(res, report);
  }

  if (path === "/api/features") {
    return sendJson(res, getAllFeatureStatuses());
  }

  // Static files from Vite build
  if (path !== "/" && existsSync(distDir)) {
    const staticPath = join(distDir, path);
    if (serveStatic(res, staticPath)) return;
  }

  // SPA fallback — serve index.html for all non-API, non-asset routes
  const html = getIndexHtml();
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(html);
});

initDb();

server.listen(config.web.port, () => {
  console.log(`Aptos Intelligence: http://localhost:${config.web.port}`);
  if (existsSync(distDir)) {
    console.log("  Serving React dashboard from web/dist/");
  } else {
    console.log("  React app not built. Run: cd web && npm run build");
    console.log("  Falling back to legacy HTML.");
  }
});
