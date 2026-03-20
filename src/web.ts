import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import { initDb, getReports, getReportById, getReportsByCategory, getAllFeatureStatuses } from "./db.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function sendJson(res: any, data: any, status = 200) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(JSON.stringify(data));
}

function sendHtml(res: any, html: string) {
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(html);
}

let indexHtml: string;
try {
  indexHtml = readFileSync(join(__dirname, "public", "index.html"), "utf-8");
} catch {
  indexHtml = "<h1>Aptos Intelligence</h1><p>Frontend not found.</p>";
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

  // Serve frontend
  sendHtml(res, indexHtml);
});

initDb();

server.listen(config.web.port, () => {
  console.log(`Aptos Intelligence web UI: http://localhost:${config.web.port}`);
});
