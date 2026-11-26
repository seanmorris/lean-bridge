/** @file Serve only installed package assets and execute the real PHP-Web VM in Chromium. */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, realpath } from "node:fs/promises";
import { extname, join, resolve, sep } from "node:path";
import { launchInstalledChromium } from "./javascript-wasm-installed-browser.mjs";
import { nativeArtifactPaths } from "../../src/build/native-artifacts.mjs";

/**
 * Use an import map for the installed npm packages and mount the installed
 * Composer vendor tree in the extension-only modes.
 *
 * @param options - Relocated consumer, pinned PHP distribution and Node test diagnostics.
 */
export const exerciseInstalledIOBrowser = async options => {
	const { app, host, t, callbacks, immediate = false } = options;
	const roots = { "/component/": await realpath(join(app,"node_modules/php-wasm-ledger"))
		, "/runtime/": await realpath(join(app,"node_modules/@lean-bridge/php-wasm-copied-runtime"))
		, "/host/": await realpath(host) };
	const vendorRoot = join(app,"vendor"), vendor = [];
	for(const path of await nativeArtifactPaths(vendorRoot)) vendor.push([path,(await readFile(join(vendorRoot,path))).toString("base64")]);
	const program = await readFile(join(app,"consumer.php"),"utf8");
	const assets = new Map([["/installed.mjs",await readFile(join(app,"installed.mjs"))]]);
	const imports = { "php-wasm-ledger": "/component/index.mjs", "@lean-bridge/php-wasm-copied-runtime": "/runtime/index.mjs" };
	if(callbacks)
	{
		imports["php-wasm-switchboard"] = "/switchboard/index.mjs";
		roots["/switchboard/"] = await realpath(join(app,"node_modules/php-wasm-switchboard"));
		for(const p of ["callback-host.mjs","snapshot.so"]) assets.set("/"+p,await readFile(join(app,p)));
	}
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
			if(assets.has(path))
			{ res.writeHead(200,{"Content-Type": path.endsWith(".mjs") ? "text/javascript" : "application/octet-stream"}); res.end(assets.get(path)); return; }
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
	const observations = [];
	let session;
	try
	{
		session = await launchInstalledChromium(app,process.env.CHROMIUM_PATH);
		const {browser} = session;
		if(callbacks) for(const fault of ["pending","sum","padding"])
		{
			const page = await browser.newPage();
			try
			{
				await page.route("**/*", r => new URL(r.request().url()).origin === origin ? r.continue() : r.abort());
				await page.goto(origin);
				const options = { fault, slots: JSON.parse(await readFile(join(app,"slots.json"))), program: await readFile(join(app,"callbacks.php"),"utf8") };
				const result = await page.evaluate(async options=>{
					const { PhpWeb: Host } = await import("/host/PhpWeb.mjs");
					const { runCallbackHost } = await import("/callback-host.mjs");
					return runCallbackHost({ ...options, Host, probe: new URL("/snapshot.so",globalThis.location.href).href });
				},options);
				assert.equal(result,"callbacks:"+fault+":retired:0"); t.diagnostic("Chromium/"+result);
			} finally
			{ await page.close(); }
		}
		for(const mode of ["embedded","composer"])
		for(const loading of ["startup","lazy"])
		{
			const page = await browser.newPage();
			try
			{
				await page.route("**/*", r => new URL(r.request().url()).origin === origin ? r.continue() : r.abort());
				await page.goto(origin);
				const result = await page.evaluate(async ({ loading, program, files, immediate })=>{
					const { PhpWeb: Host } = await import("/host/PhpWeb.mjs");
					const { runInstalled } = await import("/installed.mjs");
					const vendor = files?.map(([p,b])=>[p,Uint8Array.from(atob(b),c=>c.charCodeAt(0))]);
					return runInstalled({Host,loading,program,vendor,immediate});
				},{loading,program,files: mode === "composer" ? vendor : null,immediate});
				assert.equal(result,immediate ? "pulls:12;closes:7;shutdown:1209" : "php-api:30"); t.diagnostic("Chromium/"+mode+"/"+loading+": "+result);
				observations.push({host: "Chromium", mode, loading, result});
			} finally
			{ await page.close(); }
		}
	} finally
	{
		try
		{ await session?.close(); }
		finally
		{ await new Promise(yes=>{server.close(yes); server.closeAllConnections();}); }
	}
	return observations;
};
