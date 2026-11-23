/** @file Verify a handoff and make downstream calls from one offline npm installation. */
import test from "node:test";
import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { copyFile, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { promisify } from "node:util";
import { readVerifiedPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";

const fromRelease = process.env.LEAN_BRIDGE_JS_IO_RELEASE;
const run = promisify(execFile);

const serve = async (consumer, coordinate) => {
	const packages = await realpath(join(consumer, "node_modules"));
	const importMap = {imports: {[coordinate]: "/installed/" + coordinate + "/index.mjs"
		, "@lean-bridge/runtime": "/installed/@lean-bridge/runtime/index.mjs"}};
	const server = createServer(async (request, response) => {
		try
		{
			if(request.url === "/")
{ response.writeHead(200, {"Content-Type": "text/html"}); response.end('<script type="importmap">' + JSON.stringify(importMap) + '</script>'); return; }
			let file;
			if(request.url === "/calls.mjs") file = join(consumer, "calls.mjs");
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

const testChromium = async (root, consumer, coordinate) => {
	const {chromium} = await import("playwright");
	const site = await serve(consumer, coordinate);
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
		await page.route("**/*", route => new URL(route.request().url()).origin === site.origin ? route.continue() : route.abort());
		await page.goto(site.origin);
		return await page.evaluate(async name => {
			const {exercise} = await import("/calls.mjs"); return exercise(await import(name));
		}, coordinate);
	}
	finally
	{
		await browser?.close().catch(() => {});
		if(proc.exitCode === null && proc.signalCode === null) proc.kill("SIGTERM");
		await exited.catch(() => {}); await site.close();
	}
};

test("install exact npm archives offline and use the same public package in Node and Chromium", {skip: !fromRelease}, async t => {
	const root = await mkdtemp(join(tmpdir(), "js-io-consumer-"));
	const archiveRoot = fromRelease;
	t.after(() => rm(root, {recursive: true, force: true}));
	const {receipt} = await readVerifiedPackageSetReceipt({receiptPath: join(archiveRoot, "package-set-receipt.json")});
	const pkg = receipt.packages.find(p => p.role === "component"), provider = receipt.packages.find(p => p.role === "runtime");
	assert.equal(pkg.profile, "javascript-wasm-sync-io-v1"); assert.equal(pkg.requires[0].version, provider.version);
	const consumer = join(root, "consumer"); await mkdir(consumer);
	await writeFile(join(consumer, "package.json"), '{"private":true,"type":"module"}');
	const archives = receipt.packages.map(p => join(archiveRoot, p.artifacts[0].path));
	await run("npm", ["install", "--offline", "--ignore-scripts", "--no-audit", "--no-fund", "--cache", join(root, "cache"), ...archives], {cwd: consumer});
	await copyFile(new URL("./javascript-wasm-io-calls.mjs", import.meta.url), join(consumer, "calls.mjs"));
	const source = `import * as api from ${JSON.stringify(pkg.name)};\nimport {exercise} from "./calls.mjs";\nconsole.log(JSON.stringify(exercise(api)));\n`;
	await writeFile(join(consumer, "consume.mjs"), source);
	const node = JSON.parse((await run(process.execPath, ["consume.mjs"], {cwd: consumer})).stdout);
	assert.equal(node.scalarKinds, 19); assert.ok(node.checks >= 40); assert.equal(node.counter, 3);
	const types = `import { add, nested, choose, EIO_RubyIO_nested } from ${JSON.stringify(pkg.name)};
const counter: number = add(2);
const decision = choose(false, true, "x");
const either: string | number = "ok" in decision ? decision.ok : decision.error;
try { nested(true, 2, 123n, "x", new Uint8Array()); }
catch (e) {
  if (!(e instanceof EIO_RubyIO_nested)) throw e;
  const payload = e.payload;
  const leaf: string | bigint | Uint8Array = "ok" in payload ? payload.ok :
    "ok" in payload.error ? payload.error.ok : payload.error.error;
}
// @ts-expect-error -- USize is a wasm32 number, not a bigint.
add(2n);
// @ts-expect-error -- synchronous IO does not promise its answer.
const pending: Promise<number> = add(1);
`;
	await writeFile(join(consumer, "consume.mts"), types);
	await writeFile(join(consumer, "tsconfig.json"), JSON.stringify({compilerOptions: {target: "es2022", module: "nodenext", types: [], strict: true, noEmit: true}, files: ["consume.mts"]}));
	const tsc = createRequire(import.meta.url).resolve("typescript/bin/tsc");
	await run(process.execPath, [tsc, "-p", "tsconfig.json"], {cwd: consumer});
	const chromium = await testChromium(root, consumer, pkg.name);
	assert.deepEqual(chromium, node);
	t.diagnostic(JSON.stringify({node, chromium, archives: receipt.packages.map(p => p.artifacts[0]), root}));
});
