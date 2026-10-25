/**
 * Serve the exact static artifact with nested paths, correct MIME types, and real 404s.
 *
 * @file
 */

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { normalizeBase } from "./paths.mjs";

const contentTypes = {
	".html": "text/html; charset=utf-8", ".js": "text/javascript"
	, ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json"
	, ".wasm": "application/wasm", ".lean": "text/plain; charset=utf-8"
	, ".svg": "image/svg+xml", ".data": "text/x-script"
};

/**
 * Start a loopback-only preview of one assembled deployment directory.
 *
 * @param {object} options Server paths.
 * @param {string} options.root Artifact root directory.
 * @param {string} options.base Deployment path prefix.
 */
export const startSiteServer = async ({ root, base }) => {
	root = resolve(root);
	base = normalizeBase(base);
	const server = createServer(async (request, response) => {
		try
		{
			const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
			if(!pathname.startsWith(base)) throw new Error("Outside deployment prefix");
			let target = resolve(root, pathname.slice(base.length));
			if(target !== root && !target.startsWith(root + sep)) throw new Error("Outside artifact");
			if((await stat(target)).isDirectory()) target = resolve(target, "index.html");
			response.writeHead(200, { "Content-Type": contentTypes[extname(target)] || "application/octet-stream" });
			response.end(await readFile(target));
		}
		catch
		{
			response.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
			try
			{ response.end(await readFile(resolve(root, "404.html"))); }
			catch
			{ response.end("Page not found"); }
		}
	});
	await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
	return {
		url: `http://127.0.0.1:${server.address().port}${base}`
		, close: () => new Promise(resolve => server.close(resolve))
	};
};
