/** @file Serve offline-installed packages to a CPU-group-bound Chromium process. */
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:http";
import { mkdtemp, readFile, realpath } from "node:fs/promises";
import { join, resolve, sep } from "node:path";

const serve = async (consumer, names, isolated) => {
	const packages = await realpath(join(consumer, "node_modules"));
	const imports = Object.fromEntries([...names, "@lean-bridge/runtime"].map(name => [name, "/installed/" + name + "/index.mjs"]));
	const importMap = {imports};
	const server = createServer(async (request, response) => {
		if(isolated)
		{
			response.setHeader("Cross-Origin-Opener-Policy", "same-origin");
			response.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
		}
		try
		{
			if(request.url === "/")
{ response.writeHead(200, {"Content-Type": "text/html"}); response.end('<script type="importmap">' + JSON.stringify(importMap) + '</script>'); return; }
			let file;
			if(["/calls.mjs", "/fault.wasm"].includes(request.url)) file = join(consumer, request.url.slice(1));
			else
			{
				if(!request.url.startsWith("/installed/")) throw new Error("Not installed");
				file = await realpath(resolve(packages, "." + request.url.slice("/installed".length)));
				if(!file.startsWith(packages + sep) || !/\.(?:mjs|wasm)$/u.test(file)) throw new Error("Not a package asset");
			}
			const bytes = await readFile(file);
			response.writeHead(200, {"Content-Type": file.endsWith(".wasm") ? "application/wasm" : "text/javascript"});
			response.end(bytes);
		} catch
{ response.writeHead(404); response.end(); }
	});
	server.listen(0, "127.0.0.1"); await once(server, "listening");
	return {origin: "http://127.0.0.1:" + server.address().port, close: () => new Promise(done => { server.close(done); server.closeAllConnections(); })};
};

/**
 * Execute an installed consumer in a fresh JS realm, allowing only loopback package assets.
 *
 * @param options - Scratch directory, consumer root, package coordinates and page entry point.
 */
export const runInstalledChromium = async options => {
	const {root, consumer, names, evaluate, argument, isolated = false} = options;
	const {chromium} = await import("playwright");
	const site = options.assembledDirectory
		? await (await import("../../site/serve.mjs")).startSiteServer({root: options.assembledDirectory, base: "/"})
		: await serve(consumer, names, isolated);
	const address = site.url ?? site.origin, origin = new URL(address).origin;
	// Keep Chromium in the test's CPU-limited process group, not a detached job.
	const userData = await mkdtemp(join(root, "chromium-"));
	const proc = spawn(process.env.LEAN_BRIDGE_CHROMIUM ?? chromium.executablePath()
		, ["--headless"
			, "--remote-debugging-port=0"
			, "--no-sandbox"
			, "--no-first-run"
			, "--disable-background-networking"
			, "--disable-dev-shm-usage"
			, "--disable-gpu"
			, "--renderer-process-limit=1"
			, "--user-data-dir=" + userData
			, "about:blank"],
		{stdio: ["ignore", "ignore", "pipe"]});
	const exited = once(proc, "exit");
	let browser;
	try
	{
		const endpoint = await new Promise((res, rej) => {
			const timer = setTimeout(() => rej(new Error("Chromium launch timed out")), 60000);
			proc.once("error", error => { clearTimeout(timer); rej(error); });
			proc.once("exit", code => { clearTimeout(timer); rej(new Error("Chromium exited: " + code)); });
			let tail = "";
			proc.stderr.on("data", chunk => {
				tail = (tail + chunk).slice(-2048);
				const match = /DevTools listening on (ws:\/\/[^\s]+)\s/u.exec(tail);
				if(match)
{ clearTimeout(timer); res(match[1]); }
			});
		});
		browser = await chromium.connectOverCDP(endpoint);
		const page = await browser.contexts()[0].newPage();
		await page.route("**/*", route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
		await page.goto(address);
		const result = page.evaluate(evaluate, argument);
		if(!options.timeoutMs) return await result;
		let timer;
		try
		{
			const deadline = new Promise((_, reject) => {
				timer = setTimeout(() => reject(new Error("Installed Chromium consumer timed out")), options.timeoutMs);
			});
			return await Promise.race([result, deadline]);
		} finally
		{ clearTimeout(timer); }
	}
	finally
	{
		await browser?.close().catch(() => {});
		if(proc.exitCode === null && proc.signalCode === null) proc.kill("SIGTERM");
		await exited.catch(() => {}); await site.close();
	}
};
