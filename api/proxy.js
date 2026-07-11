/**
 * Vercel Serverless Function — Renaiss API Proxy
 * Proxies marketplace requests to the Renaiss CLI or falls back to mock data.
 * Route: /api/proxy?route=marketplace&category=POKEMON&listed=true&limit=12
 */

const { execFile } = require("child_process");

function renaiss(args) {
    return new Promise((resolve, reject) => {
        execFile("npx", ["renaiss", ...args, "--json"], { timeout: 15000 }, (err, stdout) => {
            if (err && !stdout) return reject(err);
            try { resolve(JSON.parse(stdout)); }
            catch { reject(new Error("Failed to parse Renaiss CLI output")); }
        });
    });
}

module.exports = async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    if (req.method === "OPTIONS") return res.status(204).end();

    const { route, category, listed, limit, search, tokenId, price, verbose } = req.query;

    try {
        if (route === "marketplace" || !route) {
            const args = ["marketplace"];
            if (category) args.push("--category", category);
            if (listed) args.push("--listed");
            if (limit) args.push("--limit", limit);
            if (search) args.push("--search", search);
            const data = await renaiss(args);
            return res.status(200).json(data);
        }

        if (route === "card" && tokenId) {
            const args = ["card", tokenId];
            if (price) args.push("--price");
            if (verbose) args.push("--verbose");
            const data = await renaiss(args);
            return res.status(200).json(data);
        }

        return res.status(400).json({ error: "Unknown route. Use ?route=marketplace or ?route=card&tokenId=..." });
    } catch (err) {
        // If Renaiss CLI isn't available on Vercel, return empty so game uses mock data
        return res.status(200).json({ collection: [] });
    }
};
