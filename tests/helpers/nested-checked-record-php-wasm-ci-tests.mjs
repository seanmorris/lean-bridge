/**
 * Exercise the recurring nested checked-record PHP-Wasm checker against retained originals.
 *
 * @file
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { nativeArtifactPaths } from "../../src/build/native-artifacts.mjs";
import {
	checkNestedCheckedRecordPhpWasmCiRecords
	, parseNestedCheckedRecordPhpWasmCiArgs
} from "./nested-checked-record-php-wasm-ci-report.mjs";
import { assertNestedCheckedRecordPhpWasmTap, nestedCheckedRecordPhpWasmSelections } from "./nested-checked-record-php-wasm-selections.mjs";

const root = "docs/evidence/nested-checked-record-php-wasm-20261016";
// Pinned when the original nested records are archived; until then the retained-record test skips.
const indexSha256 = null;
const archived = indexSha256 !== null && existsSync(`${root}/index.json`);
const argsOf = options => Object.entries(options).flatMap(([key, value]) => ["--" + key, value]);
const originalIndex = async () => {
	const bytes = await readFile(`${root}/index.json`); assert.equal(sha256(bytes), indexSha256);
	return JSON.parse(bytes);
};

test("nested checked-record PHP-Wasm CI refuses incomplete, repeated and unknown options", () => {
	const options = { route: "ordinary", mode: "full", producer: "a".repeat(40), directory: "records", tap: "run.tap", runtime: "runtime.json" };
	const args = argsOf(options); assert.deepEqual(parseNestedCheckedRecordPhpWasmCiArgs(args), options);
	for(const key of Object.keys(options))
	{
		assert.throws(() => parseNestedCheckedRecordPhpWasmCiArgs(argsOf(Object.fromEntries(Object.entries(options).filter(([name]) => name !== key)))));
		assert.throws(() => parseNestedCheckedRecordPhpWasmCiArgs([...args, "--" + key, options[key]]));
		for(const value of ["", "--other", "bad\0value", "bad\nvalue", "bad\rvalue"])
			assert.throws(() => parseNestedCheckedRecordPhpWasmCiArgs(argsOf({ ...options, [key]: value })));
	}
	for(const changes of [{ route: "unknown" }, { mode: "unknown" }, { producer: "HEAD" }, { extra: "yes" }])
		assert.throws(() => parseNestedCheckedRecordPhpWasmCiArgs(argsOf({ ...options, ...changes })));
	for(const value of [undefined, {}, [], args.slice(0, -1), ["route", ...args.slice(1)]])
		assert.throws(() => parseNestedCheckedRecordPhpWasmCiArgs(value));
});

test("nested checked-record PHP-Wasm CI requires exact terminal TAP", t => {
	let controls = 0;
	for(const [route, mode] of nestedCheckedRecordPhpWasmSelections)
	{
		// Synthetic transcripts in Node's reporter format; retained TAP is checked by the closure test below.
		const name = `installed nested checked-record PHP-Wasm packages reproduce and relocate ${route} ${mode}`;
		const tap = `TAP version 13\n# Subtest: ${name}\nok 1 - ${name}\n  ---\n  duration_ms: 1.5\n  type: 'test'\n  ...\n`
			+ "1..1\n# tests 1\n# suites 0\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n# duration_ms 2.5\n";
		const run = { route, mode };
		assertNestedCheckedRecordPhpWasmTap(tap, run.route, run.mode);
		for(const changed of [
			tap.slice(1), tap.replace("1..1\n", "")
			, tap.replace("ok 1 -", "not ok 1 -")
			, tap + "Bail out! incomplete\n", tap + "# SKIP disabled\n"
			, tap + "ok 2 - extra\n"
		]) {
			assert.notEqual(changed, tap);
			assert.throws(() => assertNestedCheckedRecordPhpWasmTap(changed, run.route, run.mode)); controls++;
		}
		assert.throws(() => assertNestedCheckedRecordPhpWasmTap(tap, run.route === "ordinary" ? "reviewed" : "ordinary", run.mode));
		assert.throws(() => assertNestedCheckedRecordPhpWasmTap(tap, run.route, run.mode === "full" ? "result-only" : "full")); controls += 2;
	}
	assert.equal(controls, 32); t.diagnostic(`${controls} incomplete, substituted, skipped and failed TAP controls`);
});

test("nested checked-record PHP-Wasm CI and CLI authenticate all four package closures", {
	skip: !archived && "Runs against the original nested records once they are archived and pinned"
}, async t => {
	const index = await originalIndex(), temporary = await mkdtemp(join(tmpdir(), "lean-bridge-nested-php-wasm-ci-checker-"));
	t.after(() => rm(temporary, { recursive: true }));
	const runtimePath = join(temporary, "runtime.json");
	for(const run of index.runs)
	{
		const directory = `${root}/${run.label}/records`, report = JSON.parse(await readFile(`${directory}/report.json`));
		const runtime = {
			schemaVersion: 1, producerCommit: run.producerCommit
			, host: {
				schemaVersion: 1, node: report.phpWasm.nodeVersion
				, platform: "linux", arch: "x64"
				, nodeSha256: report.phpWasm.nodeSha256
				, phpSha256: report.phpWasm.composer.hostSha256
				, composerSha256: report.phpWasm.composer.composerSha256
				, chromiumSha256: report.phpWasm.browserSha256
			}
			, runtime: {
				identity: sha256(canonicalJson(report.phpWasm.runtime))
				, manifest: report.phpWasm.runtime
			}
		};
		await writeFile(runtimePath, canonicalJson(runtime));
		const options = {
			route: run.route, mode: run.mode, producer: run.producerCommit
			, directory, tap: `${root}/${run.label}/run.tap`, runtime: runtimePath };
		const original = {
			tap: await readFile(options.tap, "utf8"), runtime
			, paths: await nativeArtifactPaths(directory)
			, read: path => readFile(join(directory, path))
		};
		const checked = await checkNestedCheckedRecordPhpWasmCiRecords(options, original);
		assert.deepEqual([checked.route, checked.mode, checked.executions], [run.route, run.mode, 12]);
		const result = spawnSync(process.execPath, ["scripts/check-nested-checked-record-php-wasm-ci.mjs", ...argsOf(options)], { encoding: "utf8" });
		assert.equal(result.status, 0, result.stderr); assert.equal(result.signal, null); assert.equal(result.stderr, "");
		assert.deepEqual(JSON.parse(result.stdout), checked);
		for(const changes of [
			{ producer: "0".repeat(40) }
			, { route: run.route === "ordinary" ? "reviewed" : "ordinary" }
			, { mode: run.mode === "full" ? "result-only" : "full" }
		]) await assert.rejects(checkNestedCheckedRecordPhpWasmCiRecords({ ...options, ...changes }, original));
		for(const mutate of [
			value => { value.producerCommit = "0".repeat(40); }
			, value => { value.host.nodeSha256 = "0".repeat(64); }
			, value => { value.runtime.identity = "0".repeat(64); }
			, value => { value.runtime.manifest.pointerBits = 64; value.runtime.identity = sha256(canonicalJson(value.runtime.manifest)); }
		]) {
			const changed = structuredClone(runtime); mutate(changed);
			await assert.rejects(checkNestedCheckedRecordPhpWasmCiRecords(options, { ...original, runtime: changed }));
		}
		for(const paths of [original.paths.slice(1), [...original.paths, "invented.json"], [...original.paths, original.paths[0]]])
			await assert.rejects(checkNestedCheckedRecordPhpWasmCiRecords(options, { ...original, paths }));
	}
});
