/** @file Serve only installed package assets and execute the real PHP-Web VM in Chromium. */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, realpath } from "node:fs/promises";
import { extname, join, resolve, sep } from "node:path";
import { chromium } from "playwright";
import { nativeArtifactPaths } from "../../src/build/native-artifacts.mjs";

/**
 * Use an import map for the installed npm packages and mount the installed
 * Composer vendor tree in the extension-only modes.
 *
 * @param options - Relocated consumer, pinned PHP distribution and Node test diagnostics.
 */
export const exerciseInstalledIOBrowser = async options => {
	const { app, host, t } = options;
	const roots = { "/component/": await realpath(join(app,"node_modules/php-wasm-ledger"))
		, "/runtime/": await realpath(join(app,"node_modules/@lean-bridge/php-wasm-copied-runtime"))
		, "/host/": await realpath(host) };
	const vendorRoot = join(app,"vendor"), vendor = [];
	for(const path of await nativeArtifactPaths(vendorRoot)) vendor.push([path,(await readFile(join(vendorRoot,path))).toString("base64")]);
	const program = await readFile(join(app,"consumer.php"),"utf8");
	const appCode = await readFile(join(app,"installed.mjs"));
	const imports = { "php-wasm-ledger": "/component/index.mjs", "@lean-bridge/php-wasm-copied-runtime": "/runtime/index.mjs" };
	const server = createServer(async (req,res)=>{
		try
		{
			const path = decodeURIComponent(new URL(req.url,"http://localhost").pathname);
			if(path === "/")
			{
				res.writeHead(200,{"Content-Type": "text/html"});
				res.end(`<!doctype html><link rel="icon" href="data:,"><script type="importmap">${JSON.stringify({imports})}</script>`);
				return;
			}
			if(path === "/installed.mjs")
			{ res.writeHead(200,{"Content-Type": "text/javascript"}); res.end(appCode); return; }
			const [prefix, root] = Object.entries(roots).find(([key])=>path.startsWith(key)) ?? [];
			if(!root) throw new Error("unknown asset");
			const file = await realpath(resolve(root,path.slice(prefix.length)));
			if(!file.startsWith(root+sep)) throw new Error("asset outside installed package");
			const bytes = await readFile(file);
			const type = {".mjs": "text/javascript",".js": "text/javascript",".wasm": "application/wasm"}[extname(file)] ?? "application/octet-stream";
			res.writeHead(200,{"Content-Type": type,"Cache-Control": "no-store"}); res.end(bytes);
		} catch
		{ res.writeHead(404); res.end(); }
	});
	await new Promise((yes,no)=>{ server.once("error",no); server.listen(0,"127.0.0.1",yes); });
	const origin = "http://127.0.0.1:"+server.address().port;
	let browser;
	try
	{
		browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, headless: true, args: ["--no-sandbox","--disable-dev-shm-usage"] });
		for(const mode of ["embedded","composer"])
		for(const loading of ["startup","lazy"])
		{
			const page = await browser.newPage();
			try
			{
				await page.route("**/*", r => new URL(r.request().url()).origin === origin ? r.continue() : r.abort());
				await page.goto(origin);
				const result = await page.evaluate(async ({ loading, program, files })=>{
					const { PhpWeb: Host } = await import("/host/PhpWeb.mjs");
					const { runInstalled } = await import("/installed.mjs");
					const vendor = files?.map(([p,b])=>[p,Uint8Array.from(atob(b),c=>c.charCodeAt(0))]);
					return runInstalled({Host,loading,program,vendor});
				},{loading,program,files: mode === "composer" ? vendor : null});
				assert.equal(result,"php-api:30"); t.diagnostic("Chromium/"+mode+"/"+loading+": "+result);
			} finally
			{ await page.close(); }
		}
	} finally
	{
		await browser?.close();
		await new Promise(yes=>{server.close(yes); server.closeAllConnections();});
	}
};
