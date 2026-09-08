/**
 * Serve reviewed demo assets during development without exposing repository directories.
 *
 * @file
 */

import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { extname, resolve } from "node:path";
import type { Plugin } from "vite";
import { normalizeBase } from "./paths.mjs";
import { demos } from "./registry.mjs";
import { allowedDemoPath } from "../scripts/build-demos-site.mjs";

const contentTypes: Record<string, string> = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".mjs": "text/javascript", ".wasm": "application/wasm", ".json": "application/json", ".lean": "text/plain; charset=utf-8" };

/** Keep the dev server's adapter paths identical to the static artifact layout. */
export const demoAssets = (repository: string): Plugin => ({
	name: "lean-bridge-demo-assets"
	, configureServer(server) {
		const base = normalizeBase(process.env.LEAN_BRIDGE_SITE_BASE);
		server.middlewares.use(async (request, response, next) => {
			const pathname = new URL(request.url || "/", "http://localhost").pathname;
			if(!pathname.startsWith(base)) return next();
			let path = pathname.slice(base.length);
			const demo = demos.find(entry => path === entry.slug || path.startsWith(entry.entrypoint));
			if(demo && path === demo.slug)
			{
				response.writeHead(302, { Location: base + demo.entrypoint }).end();
				return;
			}
			if(demo && (path === demo.entrypoint || path === demo.entrypoint + "index.html"))
			{
				if(demo.renderingMode === "react")
				{
					response.writeHead(302, { Location: base + demo.canonicalPage.slice(1) }).end();
					return;
				}
				path = demo.entrypoint + "index.html";
			}
			let target: string | undefined;
			if(allowedDemoPath(path)) target = resolve(repository, "demos", path);
			if(path === "search-index.json") target = resolve(repository, "build/site-content/search-index.json");
			if(path === "build-identity.json") target = resolve(repository, "build/github-pages/build-identity.json");
			if(!target) return next();
			try
			{
				if(!(await stat(target)).isFile()) return next();
				response.setHeader("Content-Type", contentTypes[extname(target)] || "application/octet-stream");
				if(extname(target) === ".html")
				{
					response.end((await readFile(target, "utf8")).replace("<html ", `<html data-site-base="${base}" `));
					return;
				}
				createReadStream(target).on("error", () => response.destroy()).pipe(response);
			}
			catch
			{ response.writeHead(404).end("Build the demo artifacts before starting this example."); }
		});
	}
});
