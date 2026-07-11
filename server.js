/**
 * Vinci Vault Inspector — Local API Proxy
 * Bridges the browser game to the Renaiss CLI.
 * Run: node server.js  (serves on http://localhost:3000)
 */

const http  = require("http");
const { execFile } = require("child_process");
const url   = require("url");
const fs    = require("fs");
const path  = require("path");

const MIME = {
    ".html": "text/html",
    ".js":   "application/javascript",
    ".css":  "text/css",
    ".png":  "image/png",
    ".gif":  "image/gif",
    ".jpg":  "image/jpeg",
    ".svg":  "image/svg+xml",
};

const PORT = 3000;

// ── Helper: run `npx renaiss <args>` and return parsed JSON ────────
function renaiss(args) {
    return new Promise((resolve, reject) => {
        execFile("npx", ["renaiss", ...args, "--json"], { timeout: 20000 }, (err, stdout) => {
            if (err && !stdout) return reject(err);
            try   { resolve(JSON.parse(stdout)); }
            catch { reject(new Error("Failed to parse Renaiss CLI output")); }
        });
    });
}

// ── Routes ─────────────────────────────────────────────────────────
const ROUTES = {

    // GET /api/marketplace?limit=4&category=POKEMON&listed=true
    "/api/marketplace": async (query) => {
        const args = ["marketplace"];
        if (query.category) args.push("--category", query.category);
        if (query.listed)   args.push("--listed");
        if (query.limit)    args.push("--limit",  query.limit);
        if (query.search)   args.push("--search", query.search);
        if (query.grading)  args.push("--grading", query.grading);
        if (query.grade)    args.push("--grade",  query.grade);
        return renaiss(args);
    },

    // GET /api/card/:tokenId          → detail
    // GET /api/card/:tokenId?price=1  → + pricing
    // GET /api/card/:tokenId?activities=1 → + activity
    "/api/card": async (query) => {
        const { tokenId, price, activities, verbose } = query;
        if (!tokenId) throw new Error("tokenId required");
        const args = ["card", tokenId];
        if (price)      args.push("--price");
        if (verbose)    args.push("--verbose");
        if (activities) args.push("--activities");
        return renaiss(args);
    },

    // GET /api/packs?slug=some-pack
    "/api/packs": async (query) => {
        const args = ["packs"];
        if (query.slug) args.push(query.slug);
        return renaiss(args);
    },
};

// ── Server ─────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
    // CORS — allow the game (any localhost port) to call this
    res.setHeader("Access-Control-Allow-Origin",  "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Content-Type", "application/json");

    if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }

    const parsed   = url.parse(req.url, true);
    const pathname = parsed.pathname;
    const query    = parsed.query;

    // ── Serve static files for non-API routes ──────────────────────
    if (!pathname.startsWith("/api/")) {
        const filePath = path.join(__dirname, pathname === "/" ? "index.html" : pathname);
        const ext = path.extname(filePath);
        const mime = MIME[ext] || "application/octet-stream";
        fs.readFile(filePath, (err, data) => {
            if (err) { res.writeHead(404); return res.end("Not found"); }
            res.setHeader("Content-Type", mime);
            res.writeHead(200);
            res.end(data);
        });
        return;
    }

    // Match /api/card/<tokenId> → extract tokenId into query
    const cardMatch = pathname.match(/^\/api\/card\/(.+)$/);
    if (cardMatch) {
        query.tokenId = cardMatch[1];
        try {
            const data = await ROUTES["/api/card"](query);
            res.writeHead(200);
            return res.end(JSON.stringify(data));
        } catch (e) {
            res.writeHead(500);
            return res.end(JSON.stringify({ error: e.message }));
        }
    }

    const handler = ROUTES[pathname];
    if (!handler) {
        res.writeHead(404);
        return res.end(JSON.stringify({ error: `Unknown route: ${pathname}` }));
    }

    try {
        const data = await handler(query);
        res.writeHead(200);
        res.end(JSON.stringify(data));
    } catch (e) {
        console.error("[API Error]", e.message);
        res.writeHead(500);
        res.end(JSON.stringify({ error: e.message }));
    }
});

server.listen(PORT, () => {
    console.log(`\n  Vinci Vault Inspector — API Proxy`);
    console.log(`  Listening on http://localhost:${PORT}`);
    console.log(`  Routes:`);
    console.log(`    GET /api/marketplace?category=POKEMON&listed=true&limit=4`);
    console.log(`    GET /api/card/<tokenId>?price=1&verbose=1`);
    console.log(`    GET /api/packs\n`);
});
