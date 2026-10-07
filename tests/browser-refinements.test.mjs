/**
 * Fin and Subtype checks of installed npm packages in browser pages, React effects and workers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { executeComponentEngineRequest } from "../src/build/component-engine.mjs";
import { canonicalJson } from "../src/capsule/node.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { browserRefinementExpected, browserRefinementProfiles, checkBrowserRefinementPackages } from "./helpers/browser-refinement-packages.mjs";
import { executeCorpus } from "./fixtures/browser-refinements/javascript.mjs";

const enabled = process.env.LEAN_BRIDGE_LAKE_WASM_TEST === "1";
const engineRoot = process.cwd();
const runtimeRoot = resolve(process.env.LEAN_BRIDGE_LAKE_RUNTIME_ROOT ?? "build/lean-link-spike/lazy");
const environment = { ...process.env, LEAN_BRIDGE_BUILD_BACKEND: "nix", LEAN_BRIDGE_RUNTIME_ROOT: runtimeRoot };
const fixture = async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-browser-refinements-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const root = join(directory, "project");
	await cp("tests/fixtures/documentation/lean-author", root, { recursive: true });
	return { directory, root };
};
// Only the Nix command transport is substituted; the pinned engine executes in-process.
const transport = () => ({ capture: async command => {
	if(command.command === "docker") throw new Error("Docker is absent in the injected transport");
	if(command.args[0] === "--version") return { stdout: "nix (Nix) 2.24.11", stderr: "", code: 0 };
	const arg = flag => command.args[command.args.indexOf(flag) + 1];
	await executeComponentEngineRequest({ requestPath: arg("--request"), inputRoot: arg("--component"), outputRoot: arg("--output"), engineRoot: arg("--engine"), backend: "native-nix" });
	return { stdout: "", stderr: "", code: 0 };
} });
const build = (root, outputRoot) => buildCanonicalProject({ projectRoot: root, outputRoot, engineRoot, environment, targets: ["npm"], runner: transport() });

test("the shared browser checks reject every invalid refinement through the package, never the harness", () => {
	// A fake API that accepts everything makes the harness itself fail: every rejection must come from the package.
	const permissive = new Proxy({}, { get: () => () => 0n });
	assert.throws(() => executeCorpus({ module: "onboarding-small" }, permissive), /failed: mirror endpoints/);
	const bounded = value => { if(typeof value !== "bigint" || value < 0n || value > 9n) throw new TypeError("bound"); return 9n - value; };
	const unchecked = { mirror: bounded, rows: value => [...value].reverse(), raw: () => 0n };
	assert.throws(() => executeCorpus({ module: "onboarding-small" }, unchecked), /accepted: rows \[\["10n"\]\]/);
	// A faithful public API with an unchecked runtime path fails on the first direct call, so the raw cases cannot be skipped either.
	const fin = bound => value => { if(typeof value !== "bigint" || value < 0n || value >= bound) throw new RangeError("bound"); return value; };
	const list = item => value => { if(!Array.isArray(value)) throw new TypeError("list"); return value.map(item); };
	const text = value => { if(typeof value !== "string" || !value.length) throw new RangeError("empty"); return value; };
	const option = item => {
		if(item.tag === "none") return item;
		fin(3n)(item.value[0]);
		if("ok" in item.value[1]) fin(5n)(item.value[1].ok); else fin(2n)(item.value[1].error);
		return item;
	};
	const small = value => { if(!Number.isInteger(value) || value < 0 || value >= 10) throw new RangeError("small"); return value; };
	const faithful = { mirror: value => 9n - fin(10n)(value), rows: value => list(list(fin(10n)))(value).reverse(), empty: list(fin(0n)) };
	Object.assign(faithful, { huge: list(fin(184467440737095516170n)), nested: value => list(option)(value).reverse(), echo: text });
	faithful.use = (value, digit, suffix) => `${text(value)}${small(digit)}${suffix}`;
	const lenient = (name, args) => {
		try
		{ return faithful[name](...args); }
		catch
		{ return 0n; }
	};
	assert.throws(() => executeCorpus({ module: "onboarding-small" }, { ...faithful, raw: lenient }), /accepted: raw mirror/);
	assert.throws(() => executeCorpus({ module: "onboarding-small" }, { ...faithful, raw: (name, args) => name === "mirror" ? faithful.mirror(...args) : lenient(name, args) }), /accepted: raw rows/);
	assert.equal(executeCorpus({ module: "onboarding-small" }, { ...faithful, raw: (name, args) => faithful[name](...args) }).checks, browserRefinementExpected.checks);
	assert.deepEqual(browserRefinementProfiles, ["browser-javascript", "browser-react", "browser-worker"]);
	assert.ok(browserRefinementExpected.checks > 50 && browserRefinementExpected.rejections > 100);
});

test("installed npm refinements run in browser pages, React effects and dedicated workers", { skip: !enabled, timeout: 3_600_000 }, async t => {
	const observation = await checkBrowserRefinementPackages(t, { fixture, build, runtimeRoot });
	for(const profile of browserRefinementProfiles)
		for(const engine of observation.requestedEngines)
			assert.ok(observation.executions.some(item => item.profile === profile && item.engine === engine), `${profile} ${engine}`);
	const reportPath = resolve(process.env.LEAN_BRIDGE_BROWSER_REFINEMENT_REPORT ?? "build/browser-refinements/report.json");
	await saveLakeFile(dirname(reportPath), reportPath.split("/").at(-1), canonicalJson({ schemaVersion: 1, ...observation }));
	assert.ok(JSON.parse(await readFile(reportPath, "utf8")).executions.some(item => item.profile === "browser-worker" && item.result));
});
