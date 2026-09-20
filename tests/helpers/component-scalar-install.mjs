/**
 * Install independently specified scalar fixtures in Node, strict TypeScript and browser contexts.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, lstat, mkdir, mkdtemp, readFile, realpath, rename, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { build as viteBuild } from "vite";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { processBuildRunner } from "../../src/build/process-runner.mjs";
import { prepareLakeEntryIntent, writeLakeEntryInputs } from "../../src/build/lake-entry-intent.mjs";
import { writeEngineExecutionRequest } from "../../src/build/engine-execution-request.mjs";
import { executeComponentEngineRequest } from "../../src/build/component-engine.mjs";
import { buildComponentNpmPackages } from "../../src/release/component-npm-package.mjs";
import { verifyComponentPackageReceipt } from "../../src/release/component-package-receipt.mjs";
import { startSiteServer } from "../../site/serve.mjs";
import { browserFrameworkArchives } from "./type-corpus-browser.mjs";

const repository = resolve(import.meta.dirname, "../..");
const json = async path => JSON.parse(await readFile(path, "utf8"));
const run = (command, args, cwd, env) => processBuildRunner.capture({ command, args, cwd, env, timeoutMs: 180_000 }).catch(error => {
	error.message += `: ${JSON.stringify(error.details)}`;
	throw error;
});
const leanPrefix = resolve(process.env.LEAN_BRIDGE_LEAN_PREFIX ?? ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2");
const runtimeRoot = resolve(process.env.LEAN_BRIDGE_LAKE_RUNTIME_ROOT ?? "build/lean-link-spike/lazy");
const clean = { PATH: "/unavailable", CC: "/unavailable", CXX: "/unavailable", NODE_PATH: "", LEAN_BRIDGE_LEAN: "/unavailable" };
const browserNames = process.env.LEAN_BRIDGE_TYPE_CORPUS_BROWSERS?.split(",") ?? [];
assert.equal(new Set(browserNames).size, browserNames.length);
assert.ok(browserNames.every(name => ["chromium", "firefox", "webkit"].includes(name)));

const compile = async (fixture, projectRoot, root, local = false) => {
	const entryIntent = await prepareLakeEntryIntent({ projectRoot });
	const inputRoot = join(root, "inputs"), requestPath = join(root, "request.json"), outputRoot = join(root, "output");
	await writeLakeEntryInputs({ intent: entryIntent, outputRoot: inputRoot });
	await writeEngineExecutionRequest({ output: requestPath, engineRoot: repository, inputRoot, entryIntent, targets: ["npm"], cachePolicy: "off" });
	const environment = { ...process.env, LEAN_BRIDGE_LEAN: join(leanPrefix, "bin/lean") };
	if(!local && process.env.LEAN_BRIDGE_LAKE_ENGINE)
		await run(resolve(process.env.LEAN_BRIDGE_LAKE_ENGINE), ["--request", requestPath, "--component", inputRoot, "--output", outputRoot, "--backend", "offline-acceptance"], repository, environment);
	else await executeComponentEngineRequest({ inputRoot, requestPath, outputRoot, engineRoot: repository, environment, backend: "offline-acceptance" }).catch(error => {
		error.message += `: ${JSON.stringify(error.details)}`;
		throw error;
	});
	const bundleRoot = join(outputRoot, "bundle");
	const ir = await json(join(bundleRoot, "binding/binding-ir.json"));
	if(fixture.assertIr) fixture.assertIr(ir);
	else assert.deepEqual(ir.declarations.map(d => ({ name: d.source.declaration, parameters: d.parameters.map(p => p.type.name), result: d.result.type.name })).sort((a, b) => a.name.localeCompare(b.name)), [...fixture.signatures].sort((a, b) => a.name.localeCompare(b.name)));
	const release = await buildComponentNpmPackages({ bundleRoot, runtimeRoot, outputRoot: join(root, "npm") });
	await verifyComponentPackageReceipt({ receiptPath: join(release.output, "component-package-receipt.json") });
	if(fixture.requiredRuntimeSymbol)
	{
		const oldRuntime = join(root, "unsupported-runtime"); await mkdir(oldRuntime);
		await cp(join(runtimeRoot, "main.mjs"), join(oldRuntime, "main.mjs"));
		const wasm = await readFile(join(runtimeRoot, "main.wasm")), marker = Buffer.from(fixture.requiredRuntimeSymbol);
		const at = wasm.indexOf(marker); assert.ok(at > 0);
		// Rename the export without changing the module's binary section lengths.
		wasm[at] = "x".charCodeAt(0);
		await writeFile(join(oldRuntime, "main.wasm"), wasm);
		await assert.rejects(() => buildComponentNpmPackages({ bundleRoot, runtimeRoot: oldRuntime, outputRoot: join(root, "rejected-npm") }), /cannot resolve component import|lacks the component copied ABI/);
	}
	return release;
};

const browserChecks = async (fixture, root, expected) => {
	if(!browserNames.length) return [];
	const trace = fixture.trace ? 'globalThis.callableProgress = stage => console.debug("callable check: " + stage);' : "";
	await writeFile(join(root, "worker.mjs"), `import * as api from ${JSON.stringify(fixture.name)};\nimport { ${fixture.check} } from "./checks.mjs";\n${trace}\npostMessage(${fixture.check}(api));\n`);
	await writeFile(join(root, "page.mjs"), `import * as api from ${JSON.stringify(fixture.name)};
import { ${fixture.check} } from "./checks.mjs";
import { createElement, StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
${trace}
const page = ${fixture.check}(api);
const worker = new Promise((accept, reject) => {
  const task = new Worker(new URL("./worker.mjs", import.meta.url), { type: "module" });
  task.onmessage = event => { task.terminate(); accept(event.data); };
  task.onerror = error => { task.terminate(); reject(error); };
});
const react = new Promise(accept => {
  function App() { useEffect(() => { accept(${fixture.check}(api)); }, []); return createElement("p", null, "Scalar checked"); }
  createRoot(document.getElementById("app")).render(createElement(StrictMode, null, createElement(App)));
});
Promise.all([worker, react]).then(([worker, react]) => { globalThis.scalarResult = { page, worker, react }; }).catch(error => { globalThis.scalarError = String(error); });
`);
	await writeFile(join(root, "index.html"), '<!doctype html><html><body><div id="app"></div><script type="module" src="./page.mjs"></script></body></html>');
	await viteBuild({ root
		, base: "/scalars/"
		, configFile: false
		, envDir: false
		, logLevel: "silent"
		, define: { "process.env.NODE_ENV": '"development"' }
		, build: { outDir: "web", target: "esnext", assetsInlineLimit: 0 }
		, worker: { format: "es" } });
	const server = await startSiteServer({ root: join(root, "web"), base: "/scalars/" });
	const engines = await import("playwright"), reports = [];
	try
	{
		for(const name of browserNames)
		{
			const browser = await engines[name].launch({ headless: true });
			try
			{
				const context = await browser.newContext({ serviceWorkers: "block" }), errors = [], traces = [];
				await context.route("**/*", route => route.request().url().startsWith(server.url) ? route.continue() : route.abort());
				const page = await context.newPage();
				page.on("pageerror", error => errors.push(error.message));
				if(fixture.trace) page.on("console", message => { traces.push(message.text()); if(traces.length > 30) traces.shift(); });
				await page.goto(server.url);
				try
				{ await page.waitForFunction(() => globalThis.scalarResult || globalThis.scalarError, undefined, { timeout: fixture.browserTimeout ?? 30_000 }); }
				catch(error)
				{ error.message += `; page errors: ${JSON.stringify(errors)}; progress: ${JSON.stringify(traces)}`; throw error; }
				assert.equal(await page.evaluate(() => globalThis.scalarError), undefined);
				const result = await page.evaluate(() => globalThis.scalarResult);
				assert.deepEqual(result, { page: expected, worker: expected, react: expected });
				assert.deepEqual(errors, []);
				reports.push({ engine: name, version: browser.version(), result });
			} finally
			{ await browser.close(); }
		}
	} finally
	{ await server.close(); }
	return reports;
};

/**
 * Install scalar APIs from both author paths and exercise their public host packages.
 *
 * @param t - Test context for diagnostics and scratch cleanup.
 * @param fixture - Independent source contract, consumer checks and output assertions.
 */
export const checkInstalledScalars = async (t, fixture) => {
	const scratch = await mkdtemp(join(tmpdir(), "lean-bridge-scalars-"));
	t.after(() => rm(scratch, { recursive: true, force: true }));
	const source = join(scratch, "source");
	await cp(join(repository, `tests/fixtures/onboarding/${fixture.sourceDir}`), source, { recursive: true });
	if(fixture.extension) await writeFile(join(source, `${fixture.module}.lean`), `${await readFile(join(source, `${fixture.module}.lean`), "utf8")}\n${await readFile(join(repository, fixture.extension), "utf8")}`);
	const sourceSha256 = sha256(await readFile(join(source, `${fixture.module}.lean`)));
	const save = (name, value) => writeFile(join(source, name), canonicalJson(value));
	await save("lean-bridge.exports.json", { schemaVersion: 1, modules: [fixture.module], exports: fixture.signatures.map(item => item.name), ...(fixture.arities ? { arities: fixture.arities } : {}) });
	const builds = [];
	for(const path of ["ordinary-source", "reviewed-ir"])
	{
		if(path === "reviewed-ir")
		{
			await save("lean-bridge.exports.json", { schemaVersion: 1, modules: [fixture.module] });
			await save("reviewed.binding-ir.json", fixture.reviewedIr());
		}
		t.diagnostic(`Compiling ${path} ${fixture.module} release`);
		const release = await compile(fixture, source, join(scratch, path));
		builds.push({ path, release });
	}
	const mismatched = fixture.reviewedIr();
	mismatched.declarations[0].parameters[0].type = { kind: "primitive", name: "uint32" };
	await save("reviewed.binding-ir.json", mismatched);
	await assert.rejects(() => compile(fixture, source, join(scratch, "mismatch"), true), { code: "reviewed-ir-source-mismatch" });
	await assert.rejects(lstat(join(scratch, "mismatch/output")), { code: "ENOENT" });
	await rename(source, join(scratch, "source-hidden"));
	const runs = [];
	for(const { path, release } of builds)
	{
		const root = join(scratch, `consumer-${path}`), bin = join(root, "bin");
		await mkdir(bin, { recursive: true });
		await symlink(process.execPath, join(bin, "node"));
		await writeFile(join(root, "package.json"), '{"private":true,"type":"module"}');
		await cp(join(repository, `tests/fixtures/${fixture.consumer}`), join(root, "checks.mjs"));
		await writeFile(join(root, "run.mjs"), `import * as api from ${JSON.stringify(fixture.name)};\nimport { ${fixture.check} } from "./checks.mjs";\nconsole.log(JSON.stringify(${fixture.check}(api)));\n`);
		const framework = browserNames.length ? await browserFrameworkArchives(root) : [];
		const npm = await realpath(join(process.execPath, "../../bin/npm"));
		await run(process.execPath, [npm, "install", "--offline", "--ignore-scripts", "--no-audit", "--no-fund", "--cache", join(root, "empty-cache"), release.runtimeArchive, release.componentArchive, ...framework.map(item => join(root, item.archive))], root, { ...clean, PATH: bin });
		const result = JSON.parse((await run(process.execPath, ["run.mjs"], root, clean)).stdout);
		fixture.assertResult(result);
		await writeFile(join(root, "index.ts"), fixture.typescript);
		await run(process.execPath, [join(repository, "node_modules/typescript/lib/tsc.js"), "--strict", "--skipLibCheck", "false", "--target", "ES2022", "--module", "NodeNext", "--lib", "ES2022,DOM,ESNext.Disposable", "index.ts"], root, clean);
		await run(process.execPath, ["index.js"], root, clean);
		const browsers = await browserChecks(fixture, root, result);
		const out = join(repository, `build/${fixture.reportDir}`, path);
		await mkdir(out, { recursive: true });
		for(const file of [release.report.runtime.archive, release.report.package.archive, "component-package-receipt.json", "verify-component-package-receipt.mjs"])
			await cp(join(release.output, file), join(out, file));
		runs.push({ path
			, node: process.version
			, consumerSha256: sha256(await readFile(join(root, "checks.mjs")))
			, offlineInstall: true, compilerFreePath: true
			, sourceRelocatedBeforeInstallation: true
			, typescript: { strict: true, executed: true }
			, result
			, browsers
			, receipt: release.report
			, sourceSha256 });
	}
	await writeFile(join(repository, `build/${fixture.reportDir}/report.json`), canonicalJson({ schemaVersion: 1, runs }));
};
