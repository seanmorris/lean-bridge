/** @file Consume the staged Lean function contract as JS, strict TS, a page, React and a worker. */
import assert from "node:assert/strict";
import { copyFile, mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { build } from "vite";
import { buildCanonicalProject } from "../../src/build/canonical-build.mjs";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { readVerifiedPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { runInstalledChromium } from "./javascript-wasm-installed-browser.mjs";
import { runNativeTool as run } from "./native-effect-consumers.mjs";
import { copyPackageSetHandoff } from "./package-set.mjs";
import { checkStagedQuoteIdentities,prepareStagedQuoteProject } from "./staged-quote-project.mjs";

const require = createRequire(import.meta.url), name = "@example/tariff-quotes";
const read = async path => JSON.parse(await readFile(path, "utf8"));
const hash = async path => sha256(await readFile(path));
const applicationField = {visits:2,innerCalls:2,first:42,second:42,recovered:42};
const expected = base => ({ keptValue: base + 2, entries: 0, stageCalls: 1, stagedValue: base + 4, nextValue: 42, applicationField });
test("five installed npm clients own callable record fields on both author routes", {timeout: 7_200_000}, async t => {
	const work = await mkdtemp(join(tmpdir(), "npm-tariff-")); t.after(() => rm(work, {recursive: true, force: true}));
	const { LEAN_BRIDGE_NPM_TARIFF_KEEP: keep, LEAN_BRIDGE_NPM_TARIFF_REPLAY: replay } = process.env;
	assert.ok(!(keep && replay));
	const set = replay ? resolve(replay) : keep ? await mkdtemp(join(resolve(keep), "tariff-")) : join(work, "packages");
	if (!keep && !replay) await mkdir(set);
	const routes = ["ordinary", "reviewed"];
	if (!replay) for (const route of routes) {
		const src = join(work, route + "-source"), out = join(work, route + "-producer");
		await prepareStagedQuoteProject(src, route, "npm");
		try { await buildCanonicalProject({ projectRoot: src, outputRoot: out, targets: ["npm"], environment: process.env }); }
		catch (e) { throw new Error(e.message + "\n" + JSON.stringify(e.details), {cause: e}); }
		await copyPackageSetHandoff(join(out, "packages/npm"), join(set, route));
		await rm(src, {recursive: true}); await rm(out, {recursive: true});
	}
	const env = {...process.env, npm_config_offline: "true", npm_config_cache: join(work, "npm-cache")};
	const noTools = {PATH: "/no-author-tools", LANG: "C.UTF-8", TMPDIR: work};
	const frameworks = [];
	for (const pkg of ["react", "react-dom", "scheduler"]) {
		const dir = dirname(require.resolve(pkg + "/package.json"));
		frameworks.push(join(work, await run("npm", ["pack", "--offline", "--silent", "--ignore-scripts", "--pack-destination", work, dir], work, env)));
	}
	const output = resolve(process.env.LEAN_BRIDGE_NPM_TARIFF_OUTPUT ?? "build/npm-function-fields");
	await mkdir(output, {recursive: true});
	const client = resolve("tests/fixtures/structured-types"), ui = resolve("tests/fixtures/javascript-host-record");
	const files = {"calls.mjs": join(client, "tariff-fields.mjs"), "typed.mts": join(client, "tariff-fields.mts"),
		"page.mjs": join(ui, "page.mjs"), "worker.mjs": join(ui, "worker.mjs")};
	files["observer.mjs"] = join(client, "tariff-observer.mjs"); files["observer.d.mts"] = join(client, "tariff-observer.d.mts");
	files["host-field.mjs"] = join(client, "tariff-host-field.mjs"); files["host-field.d.mts"] = join(client, "tariff-host-field.d.mts");
	const check = (actual, expectedCalls) => {
		const {baseline, held, after, ...values} = actual;
		assert.equal(baseline, 0); assert.ok(Number.isInteger(held) && held > baseline);
		assert.equal(after, baseline); assert.deepEqual(values, expectedCalls);
	};
	for (const route of routes) {
		const handoff = join(work, route + "-handoff"), app = join(work, route + "-app"), site = join(work, route + "-site");
		await copyPackageSetHandoff(join(set, route), handoff);
		const {receipt, result} = await readVerifiedPackageSetReceipt({receiptPath: join(handoff, "package-set-receipt.json")});
		assert.equal(receipt.packages.length, 2);
		const pkg = receipt.packages.find(p => p.role === "component"), runtime = receipt.packages.find(p => p.role === "runtime");
		assert.equal(pkg.name, name); assert.equal(runtime.name, "@lean-bridge/runtime");
		await mkdir(app); await writeFile(join(app, "package.json"), '{"type":"module","private":true}');
		await run("npm", ["install", "--offline", "--ignore-scripts", "--no-fund", "--no-audit",
			...[runtime, pkg].map(p => join(handoff, p.artifacts[0].path)), ...frameworks], app, env);
		await rm(handoff, {recursive: true});
		const installed = join(app, "node_modules", name), meta = join(installed, "metadata/compiler");
		const model = await read(join(meta, "model.json")), ir = await read(join(meta, "binding-ir.json"));
		const identity = checkStagedQuoteIdentities(model, ir, receipt.profiles.find(p => p.id === pkg.profile), route);
		const sourceHashes = {};
		for (const [dest, source] of Object.entries(files)) { await copyFile(source, join(app, dest)); sourceHashes[dest] = await hash(source); }
		const node = JSON.parse(await run(process.execPath, ["--input-type=module", "-e", 'import {exercise} from "./calls.mjs"; console.log(JSON.stringify(exercise(false)))'], app, noTools));
		check(node, expected(40));
		await writeFile(join(app, "tsconfig.json"), JSON.stringify({files: ["typed.mts"], compilerOptions: {strict: true, module: "NodeNext", target: "ES2022", types: [], lib: ["ES2024", "DOM"]}}));
		await run(process.execPath, [require.resolve("typescript/bin/tsc"), "-p", "tsconfig.json"], app, noTools);
		const typescript = JSON.parse(await run(process.execPath, ["typed.mjs"], app, noTools)); check(typescript, {value: 42, entries: 0, applicationField});
		await writeFile(join(app, "index.html"), '<main></main><script>globalThis.recordReady=Promise.withResolvers();onerror=e=>recordReady.reject(String(e));onunhandledrejection=e=>recordReady.reject(String(e.reason))</script><script type="module" src="./page.mjs"></script>');
		await build({root: app, configFile: false, envDir: false, publicDir: false, logLevel: "error", worker: {format: "es"}, build: {target: "esnext", assetsInlineLimit: 0, minify: false}});
		const installedBytes = [await hash(join(installed, "internal/component.so.wasm")), await hash(join(app, "node_modules/@lean-bridge/runtime/internal/main.wasm"))].sort();
		await rename(join(app, "dist"), site); await rm(app, {recursive: true});
		const assets = join(site, "assets"), wasm = (await readdir(assets)).filter(f => f.endsWith(".wasm"));
		assert.deepEqual([...new Set(await Promise.all(wasm.map(f => hash(join(assets, f)))))].sort(), installedBytes);
		const browser = await runInstalledChromium({root: work, names: [name], assembledDirectory: site, timeoutMs: 120000, evaluate: async () => (await globalThis.recordReady.promise)()});
		assert.deepEqual(Object.keys(browser).sort(), ["page","react","worker"]);
		check(browser.page, expected(40)); check(browser.react, expected(71)); check(browser.worker, expected(71));
		await writeFile(join(output, route+".json"), canonicalJson({route, receiptSha256: result.receiptSha256, ...identity, archives: receipt.packages.map(p=>p.artifacts[0]), installedBytes, sourceHashes, node, typescript, browser}));
	}
	t.diagnostic("Handoffs: " + set);
});
