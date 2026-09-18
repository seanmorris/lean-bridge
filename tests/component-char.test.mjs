/**
 * Build and install ordinary and reviewed Char APIs from fresh Lean source.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, lstat, mkdir, mkdtemp, readFile, realpath, rename, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { build as viteBuild } from "vite";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { processBuildRunner } from "../src/build/process-runner.mjs";
import { prepareLakeEntryIntent, writeLakeEntryInputs } from "../src/build/lake-entry-intent.mjs";
import { writeEngineExecutionRequest } from "../src/build/engine-execution-request.mjs";
import { executeComponentEngineRequest } from "../src/build/component-engine.mjs";
import { buildComponentNpmPackages } from "../src/release/component-npm-package.mjs";
import { verifyComponentPackageReceipt } from "../src/release/component-package-receipt.mjs";
import { startSiteServer } from "../site/serve.mjs";
import { browserFrameworkArchives } from "./helpers/type-corpus-browser.mjs";
import { charPoints, charReviewedIr, charSignatures, invalidCharPoints } from "./helpers/char-fixture.mjs";

const repository = resolve(import.meta.dirname, "..");
const json = async path => JSON.parse(await readFile(path, "utf8"));
const run = (command, args, cwd, env) => processBuildRunner.capture({ command, args, cwd, env, timeoutMs: 180_000 });
const leanPrefix = resolve(process.env.LEAN_BRIDGE_LEAN_PREFIX ?? ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2");
const runtimeRoot = resolve(process.env.LEAN_BRIDGE_LAKE_RUNTIME_ROOT ?? "build/lean-link-spike/lazy");
const clean = { PATH: "/unavailable", CC: "/unavailable", CXX: "/unavailable", NODE_PATH: "", LEAN_BRIDGE_LEAN: "/unavailable" };
const browserNames = process.env.LEAN_BRIDGE_TYPE_CORPUS_BROWSERS?.split(",") ?? [];
assert.equal(new Set(browserNames).size, browserNames.length);
assert.ok(browserNames.every(name => ["chromium", "firefox", "webkit"].includes(name)));

const compile = async (projectRoot, root, local = false) => {
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
	assert.deepEqual(ir.declarations.map(d => ({ name: d.source.declaration, parameters: d.parameters.map(p => p.type.name), result: d.result.type.name })).sort((a, b) => a.name.localeCompare(b.name)), [...charSignatures].sort((a, b) => a.name.localeCompare(b.name)));
	const release = await buildComponentNpmPackages({ bundleRoot, runtimeRoot, outputRoot: join(root, "npm") });
	await verifyComponentPackageReceipt({ receiptPath: join(release.output, "component-package-receipt.json") });
	return release;
};

const browserChecks = async (root, expected) => {
	if(!browserNames.length) return [];
	await writeFile(join(root, "worker.mjs"), 'import * as api from "onboarding-characters";\nimport { checkCharacters } from "./checks.mjs";\npostMessage(checkCharacters(api));\n');
	await writeFile(join(root, "page.mjs"), `import * as api from "onboarding-characters";
import { checkCharacters } from "./checks.mjs";
import { createElement, StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
const page = checkCharacters(api);
const worker = new Promise((accept, reject) => {
  const task = new Worker(new URL("./worker.mjs", import.meta.url), { type: "module" });
  task.onmessage = event => { task.terminate(); accept(event.data); };
  task.onerror = error => { task.terminate(); reject(error); };
});
const react = new Promise(accept => {
  function App() { useEffect(() => { accept(checkCharacters(api)); }, []); return createElement("p", null, "Char checked"); }
  createRoot(document.getElementById("app")).render(createElement(StrictMode, null, createElement(App)));
});
Promise.all([worker, react]).then(([worker, react]) => { globalThis.charResult = { page, worker, react }; }).catch(error => { globalThis.charError = String(error); });
`);
	await writeFile(join(root, "index.html"), '<!doctype html><html><body><div id="app"></div><script type="module" src="./page.mjs"></script></body></html>');
	await viteBuild({ root
		, base: "/characters/"
		, configFile: false
		, envDir: false
		, logLevel: "silent"
		, define: { "process.env.NODE_ENV": '"development"' }
		, build: { outDir: "web", target: "esnext", assetsInlineLimit: 0 }
		, worker: { format: "es" } });
	const server = await startSiteServer({ root: join(root, "web"), base: "/characters/" });
	const engines = await import("playwright"), reports = [];
	try
	{
		for(const name of browserNames)
		{
			const browser = await engines[name].launch({ headless: true });
			try
			{
				const context = await browser.newContext({ serviceWorkers: "block" }), errors = [];
				await context.route("**/*", route => route.request().url().startsWith(server.url) ? route.continue() : route.abort());
				const page = await context.newPage();
				page.on("pageerror", error => errors.push(error.message));
				await page.goto(server.url);
				await page.waitForFunction(() => globalThis.charResult || globalThis.charError, undefined, { timeout: 30_000 });
				assert.equal(await page.evaluate(() => globalThis.charError), undefined);
				const result = await page.evaluate(() => globalThis.charResult);
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

test("real wasm32 scalar validation rejects surrogate, oversized and noncanonical Char slots", async () => {
	const { default: createMain } = await import(pathToFileURL(join(runtimeRoot, "main.mjs")));
	const module = await createMain({ locateFile: path => join(runtimeRoot, path) });
	assert.equal(module._bridge_lean_runtime_init(), 1);
	const slot = module._malloc(16);
	try
	{
		const validate = (point, flags = 0, kind = 16) => {
			const view = new DataView(module.HEAP8.buffer);
			view.setUint32(slot, kind, true); view.setUint32(slot + 4, flags, true); view.setBigUint64(slot + 8, point, true);
			return module._bridge_scalar_slot_validate(slot, 16);
		};
		for(const point of charPoints) assert.equal(validate(BigInt(point)), 0);
		for(const point of invalidCharPoints) assert.equal(validate(point), 3);
		for(let point = 0; point <= 0x110000; point++)
			assert.equal(validate(BigInt(point)), point < 0xd800 || (point > 0xdfff && point < 0x110000) ? 0 : 3);
		for(const flags of [1, 2, 0xffffffff]) assert.equal(validate(65n, flags), 3);
		assert.equal(validate(65n, 0, 4), 3);
	} finally
{ module._free(slot); }
});

test("installed ordinary and reviewed Char APIs preserve Unicode in Node, strict TypeScript and browsers", { timeout: 600_000 }, async t => {
	const scratch = await mkdtemp(join(tmpdir(), "lean-bridge-char-"));
	t.after(() => rm(scratch, { recursive: true, force: true }));
	const source = join(scratch, "source");
	await cp(join(repository, "tests/fixtures/onboarding/characters"), source, { recursive: true });
	const save = (name, value) => writeFile(join(source, name), canonicalJson(value));
	await save("lean-bridge.exports.json", { schemaVersion: 1, modules: ["Characters"] });
	const builds = [];
	for(const path of ["ordinary-source", "reviewed-ir"])
	{
		if(path === "reviewed-ir") await save("reviewed.binding-ir.json", charReviewedIr());
		t.diagnostic(`Compiling ${path} Char release`);
		const release = await compile(source, join(scratch, path));
		builds.push({ path, release });
	}
	const mismatched = charReviewedIr();
	mismatched.declarations[0].parameters[0].type.name = "uint32";
	await save("reviewed.binding-ir.json", mismatched);
	await assert.rejects(() => compile(source, join(scratch, "mismatch"), true), { code: "reviewed-ir-source-mismatch" });
	await assert.rejects(lstat(join(scratch, "mismatch/output")), { code: "ENOENT" });
	await rename(source, join(scratch, "source-hidden"));
	const runs = [];
	for(const { path, release } of builds)
	{
		const root = join(scratch, `consumer-${path}`), bin = join(root, "bin");
		await mkdir(bin, { recursive: true });
		await symlink(process.execPath, join(bin, "node"));
		await writeFile(join(root, "package.json"), '{"private":true,"type":"module"}');
		await cp(join(repository, "tests/fixtures/characters/consumer.mjs"), join(root, "checks.mjs"));
		await writeFile(join(root, "run.mjs"), 'import * as api from "onboarding-characters";\nimport { checkCharacters } from "./checks.mjs";\nconsole.log(JSON.stringify(checkCharacters(api)));\n');
		const framework = browserNames.length ? await browserFrameworkArchives(root) : [];
		const npm = await realpath(join(process.execPath, "../../bin/npm"));
		await run(process.execPath, [npm, "install", "--offline", "--ignore-scripts", "--no-audit", "--no-fund", "--cache", join(root, "empty-cache"), release.runtimeArchive, release.componentArchive, ...framework.map(item => join(root, item.archive))], root, { ...clean, PATH: bin });
		const result = JSON.parse((await run(process.execPath, ["run.mjs"], root, clean)).stdout);
		assert.deepEqual(result.values, charPoints);
		assert.equal(result.checks, 1126);
		await writeFile(join(root, "index.ts"), `import * as api from "onboarding-characters";
const echo: (value: string) => string = api.echo;
const point: (value: string) => number = api.codePoint;
const text: (value: string) => string = api.text;
const sprout: () => string = api.sprout;
const choose: (condition: boolean, left: string, right: string) => string = api.choose;
// @ts-expect-error Char does not accept a numeric code point.
const bad: (value: number) => string = api.echo;
if (echo("🌱") !== "🌱" || point("🌱") !== 0x1f331 || text("\\0") !== "\\0" || sprout() !== "🌱" || choose(false, "a", "🌱") !== "🌱") throw new Error("TypeScript Char result mismatch");
`);
		await run(process.execPath, [join(repository, "node_modules/typescript/lib/tsc.js"), "--strict", "--skipLibCheck", "false", "--target", "ES2022", "--module", "NodeNext", "--lib", "ES2022,DOM,ESNext.Disposable", "index.ts"], root, clean);
		await run(process.execPath, ["index.js"], root, clean);
		const browsers = await browserChecks(root, result);
		const out = join(repository, "build/char-npm", path);
		await mkdir(out, { recursive: true });
		for(const file of [release.report.runtime.archive, release.report.package.archive, "component-package-receipt.json", "verify-component-package-receipt.mjs"])
			await cp(join(release.output, file), join(out, file));
		runs.push({ path
			, node: process.version
			, typescript: { strict: true, executed: true }
			, result
			, browsers
			, receipt: release.report
			, sourceSha256: sha256(await readFile(join(repository, "tests/fixtures/onboarding/characters/Characters.lean"))) });
	}
	await writeFile(join(repository, "build/char-npm/report.json"), canonicalJson({ schemaVersion: 1, runs }));
});
