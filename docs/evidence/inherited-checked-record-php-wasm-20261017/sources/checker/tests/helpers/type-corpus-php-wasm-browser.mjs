/**
 * Network-isolated Chromium runs of the installed, bundled PHP-Wasm corpus.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile, realpath, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";
import { chromium } from "playwright";
import { sha256 } from "../../src/capsule/node.mjs";

/**
 * Exercise a nested deployment URL twice per lexical caller and loading mode.
 *
 * @param options - Relocated installed app, explicit browser and test context.
 */
export const browserPhpWasmCorpus = async options => {
	const { t, library, deployment, environment } = options;
	const root = await realpath(deployment), prefix = "/nested/app/";
	let requests = [], errors = [];
	const server = createServer(async (request, response) => {
		try
		{
			const path = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
			assert.ok(path.startsWith(prefix));
			const relative = path.slice(prefix.length) || "index.html";
			const file = await realpath(resolve(root, relative));
			assert.ok(file.startsWith(root + sep) && (await stat(file)).isFile());
			const bytes = await readFile(file);
			requests.push({ path: file.slice(root.length + 1), bytes: bytes.length, sha256: sha256(bytes) });
			const type = { ".html": "text/html", ".mjs": "text/javascript", ".js": "text/javascript", ".wasm": "application/wasm", ".json": "application/json" }[extname(file)] ?? "application/octet-stream";
			response.writeHead(200, { "Content-Type": type, "Content-Length": bytes.length, "Cache-Control": "no-store" });
			response.end(bytes);
		}
		catch(error)
		{
			errors.push(error.message); response.writeHead(404); response.end("Not found");
		}
	});
	await new Promise(accept => server.listen(0, "127.0.0.1", accept));
	const origin = "http://127.0.0.1:" + server.address().port;
	const executablePath = environment.CHROMIUM_PATH ?? (existsSync("/usr/lib/chromium/chromium") ? "/usr/lib/chromium/chromium" : chromium.executablePath());
	let browser;
	try
	{
		browser = await chromium.launch({ executablePath, headless: true, args: ["--no-sandbox"] });
		const executions = [];
		for(const loading of ["startup", "lazy"])
		for(const mode of ["weak", "strict"])
		{
			t.diagnostic(library.id + ": PHP-Wasm Chromium bundled/" + loading + "/" + mode);
			const observe = async () => {
				requests = []; errors = [];
				const context = await browser.newContext({ serviceWorkers: "block" });
				const page = await context.newPage(), violations = [];
				try
				{
					await page.route("**/*", async route => {
						if(new URL(route.request().url()).origin !== origin)
						{
							violations.push(route.request().url()); await route.abort();
						}
						else await route.continue();
					});
					page.on("pageerror", error => violations.push(error.message));
					page.on("requestfailed", request => violations.push(request.url() + ": " + request.failure()?.errorText));
					await page.goto(origin + prefix + "?loading=" + loading + "&mode=" + mode);
					await page.waitForFunction(() => globalThis.phpCorpus !== undefined, null, { timeout: 180_000 });
					const result = await page.evaluate(() => globalThis.phpCorpus);
					assert.equal(result.error, undefined, JSON.stringify(result));
					assert.deepEqual(violations, []); assert.deepEqual(errors, []);
					return { ...result, requests: requests.sort((a, b) => a.path.localeCompare(b.path)) };
				}
				finally
				{
					await context.close();
				}
			};
			const observed = await observe();
			assert.deepEqual(await observe(), observed);
			executions.push({ realm: "chromium", arrangement: "bundled", loading, mode, ...observed });
		}
		return { version: browser.version(), executableSha256: sha256(await readFile(executablePath)), executions };
	}
	finally
	{
		await browser?.close();
		server.closeAllConnections(); await new Promise(accept => server.close(accept));
	}
};
