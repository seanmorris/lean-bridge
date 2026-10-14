/**
 * Exercise the recurring browser checker against original installed evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { nativeArtifactPaths } from "../../src/build/native-artifacts.mjs";
import { parseNominalSubtypeBrowserCiArgs, checkNominalSubtypeBrowserCiRecords } from "./nominal-subtype-browser-ci-report.mjs";
import { assertNominalSubtypeBrowserTap } from "./nominal-subtype-browser-provenance.mjs";

const root = "docs/evidence/nominal-subtype-browser-20261014";
const argsOf = options => Object.entries(options).flatMap(([key, value]) => ["--" + key, value]);
const originalIndex = async () => {
	const bytes = await readFile(`${root}/index.json`);
	assert.equal(sha256(bytes), "bc4f0403b5ab7faa2fe6ad0a3df7755bba4e24bbf0127fd95df1ce66348b6c4a");
	return JSON.parse(bytes);
};

test("nominal browser CI refuses incomplete, repeated and unknown options before reading records", () => {
	const options = { route: "ordinary", mode: "full", producer: "a".repeat(40), directory: "records", tap: "run.tap", runtime: "runtime.json" };
	const args = argsOf(options); assert.deepEqual(parseNominalSubtypeBrowserCiArgs(args), options);
	for(const key of Object.keys(options))
	{
		assert.throws(() => parseNominalSubtypeBrowserCiArgs(argsOf(Object.fromEntries(Object.entries(options).filter(([name]) => name !== key)))));
		assert.throws(() => parseNominalSubtypeBrowserCiArgs([...args, "--" + key, options[key]]));
		for(const value of ["", "--other", "bad\0value", "bad\nvalue", "bad\rvalue"])
			assert.throws(() => parseNominalSubtypeBrowserCiArgs(argsOf({ ...options, [key]: value })));
	}
	for(const changes of [{ route: "unknown" }, { route: "ordinary,reviewed" }, { mode: "unknown" }, { mode: "full,result-only" }, { producer: "HEAD" }, { producer: "g".repeat(40) }, { extra: "yes" }])
		assert.throws(() => parseNominalSubtypeBrowserCiArgs(argsOf({ ...options, ...changes })));
	for(const value of [undefined, {}, [], args.slice(0, -1), ["route", ...args.slice(1)]])
		assert.throws(() => parseNominalSubtypeBrowserCiArgs(value));
});

test("nominal browser CI requires exact terminal TAP without hidden failures or skipped selections", async t => {
	const index = await originalIndex(); let controls = 0;
	for(const run of index.runs)
	{
		const tap = await readFile(`${root}/${run.label}/run.tap`, "utf8"); assertNominalSubtypeBrowserTap(tap, run.route, run.mode);
		const changes = [tap.slice(1), tap.replace("1..1\n", "")
			, tap.replace("1..1\n", "1..2\n")
			, tap.replace("ok 1 -", "not ok 1 -"), tap.replace("# Subtest:", "# Wrong:")
			, tap + "Bail out! incomplete\n", tap + "# SKIP disabled\n"
			, tap + "# TODO later\n"
			, tap + tap, tap + "ok 2 - extra\n", tap + "incomplete\n"
			, tap.replace(/^# duration_ms [^\n]+\n$/mu, "")
			, ...["not ok 1 - hidden failure", "ok 1 - hidden pass", "# Subtest: hidden", "Bail out! stopped"].map(line => tap.replace("\n1..1\n", `\n    ${line}\n1..1\n`))
			, ...["tests", "suites", "pass", "fail", "cancelled", "skipped", "todo"].flatMap(key => [
				tap.replace(new RegExp(`^# ${key} \\d+\\n`, "mu"), "")
				, tap.replace(new RegExp(`^# ${key} \\d+$`, "mu"), `# ${key} 7`)
				, tap + `# ${key} 0\n`
			])
		];
		for(const source of changes)
		{ assert.notEqual(source, tap); assert.throws(() => assertNominalSubtypeBrowserTap(source, run.route, run.mode)); controls++; }
		assert.throws(() => assertNominalSubtypeBrowserTap(tap, run.route === "ordinary" ? "reviewed" : "ordinary", run.mode));
		assert.throws(() => assertNominalSubtypeBrowserTap(tap, run.route, run.mode === "full" ? "result-only" : "full")); controls += 2;
	}
	assert.equal(controls, 156); t.diagnostic(`${controls} incomplete, substituted, skipped and failed TAP controls`);
});

test("nominal browser CI and CLI authenticate all four originals with independent runtime and complete archive closure", async t => {
	const index = await originalIndex(), temporary = await mkdtemp(join(tmpdir(), "lean-bridge-nominal-browser-ci-checker-"));
	t.after(() => rm(temporary, { recursive: true }));
	const runtimePath = join(temporary, "runtime.json");
	for(const run of index.runs)
	{
		const options = { route: run.route, mode: run.mode
			, producer: run.producerCommit
			, directory: `${root}/${run.label}/records`
			, tap: `${root}/${run.label}/run.tap`, runtime: runtimePath };
		assert.deepEqual(parseNominalSubtypeBrowserCiArgs(argsOf(options)), options);
		const start = JSON.parse(await readFile(`${root}/${run.label}/start.json`));
		await writeFile(runtimePath, canonicalJson(start.runtime));
		const original = { tap: await readFile(options.tap, "utf8")
			, runtime: start.runtime
			, paths: await nativeArtifactPaths(options.directory)
			, read: path => readFile(join(options.directory, path)) };
		const checked = await checkNominalSubtypeBrowserCiRecords(options, original);
		assert.equal(checked.route, run.route); assert.equal(checked.mode, run.mode); assert.equal(checked.producerCommit, run.producerCommit);
		const result = spawnSync(process.execPath, ["scripts/check-nominal-subtype-browser-ci.mjs", ...argsOf(options)], { encoding: "utf8" });
		assert.equal(result.error, undefined); assert.equal(result.signal, null); assert.equal(result.status, 0, result.stderr);
		assert.equal(result.stderr, ""); assert.deepEqual(JSON.parse(result.stdout), checked);
		for(const changes of [{ producer: "0".repeat(40) }, { route: run.route === "ordinary" ? "reviewed" : "ordinary" }, { mode: run.mode === "full" ? "result-only" : "full" }])
			await assert.rejects(checkNominalSubtypeBrowserCiRecords({ ...options, ...changes }, original));
		for(const runtime of [{ ...start.runtime, node: "v0.0.0" }, { ...start.runtime, platform: "win32" }, { ...start.runtime, arch: "arm64" }])
			await assert.rejects(checkNominalSubtypeBrowserCiRecords(options, { ...original, runtime }));
		for(const paths of [original.paths.slice(1), [...original.paths, "invented.json"], [...original.paths, original.paths[0]]])
			await assert.rejects(checkNominalSubtypeBrowserCiRecords(options, { ...original, paths }));
		for(const missing of ["report.json", "browser.json", "build-0/locks/compiler-adapters.json", "build-1/NominalSubtypes.lean", "browser-worker/observations.json", ...run.records.filter(path => path.startsWith("handoff/"))])
			await assert.rejects(checkNominalSubtypeBrowserCiRecords(options, { ...original, read: async path => { assert.notEqual(path, missing); return original.read(path); } }));
	}
});
