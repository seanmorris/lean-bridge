/**
 * Check recursive checked-record PHP-Wasm CI argument, TAP and host-binding gates without
 * original execution records. Retained-record controls join with the archived evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	assertRecursiveCheckedRecordPhpWasmCiHost, assertRecursiveCheckedRecordPhpWasmCiTap
	, checkRecursiveCheckedRecordPhpWasmCiRecords, parseRecursiveCheckedRecordPhpWasmCiArgs
	, recursiveCheckedRecordPhpWasmCiTestName
} from "./recursive-checked-record-php-wasm-ci-report.mjs";

const argsOf = options => Object.entries(options).flatMap(([key, value]) => ["--" + key, value]);
const selections = ["recursive", "mutual"].flatMap(fixture => ["ordinary", "reviewed"].map(route => [route, fixture]));

test("recursive checked-record PHP-Wasm CI refuses incomplete, repeated and unknown options", () => {
	const options = { route: "ordinary", fixture: "recursive"
		, producer: "a".repeat(40)
		, directory: "records", tap: "run.tap", runtime: "runtime.json" };
	const args = argsOf(options); assert.deepEqual(parseRecursiveCheckedRecordPhpWasmCiArgs(args), options);
	for(const key of Object.keys(options))
	{
		assert.throws(() => parseRecursiveCheckedRecordPhpWasmCiArgs(argsOf(Object.fromEntries(Object.entries(options).filter(([name]) => name !== key)))));
		assert.throws(() => parseRecursiveCheckedRecordPhpWasmCiArgs([...args, "--" + key, options[key]]));
		for(const value of ["", "--other", "bad\0value", "bad\nvalue", "bad\rvalue"])
			assert.throws(() => parseRecursiveCheckedRecordPhpWasmCiArgs(argsOf({ ...options, [key]: value })));
	}
	const invalid = [{ route: "unknown" }, { fixture: "nested" }
		, { fixture: "recursive,mutual" }, { producer: "HEAD" }
		, { producer: "a".repeat(39) }, { extra: "yes" }];
	for(const changes of invalid)
		assert.throws(() => parseRecursiveCheckedRecordPhpWasmCiArgs(argsOf({ ...options, ...changes })));
	for(const value of [undefined, {}, [], args.slice(0, -1), ["route", ...args.slice(1)]])
		assert.throws(() => parseRecursiveCheckedRecordPhpWasmCiArgs(value));
});

test("recursive checked-record PHP-Wasm CI requires exact terminal TAP for each selection", t => {
	let controls = 0;
	for(const [route, fixture] of selections)
	{
		const name = recursiveCheckedRecordPhpWasmCiTestName(route, fixture);
		assert.equal(name, `installed recursive checked-record PHP-Wasm packages reproduce and relocate ${route} ${fixture}`);
		const tap = `TAP version 13\n# Subtest: ${name}\nok 1 - ${name}\n  ---\n  duration_ms: 1.5\n  type: 'test'\n  ...\n`
			+ "# Waiting for host load below 8 before the next recursive PHP-Wasm phase: 9.5\n"
			+ "1..1\n# tests 1\n# suites 0\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n# duration_ms 2.5\n";
		assertRecursiveCheckedRecordPhpWasmCiTap(tap, route, fixture);
		for(const changed of [
			tap.slice(1), tap.replace("1..1\n", ""), tap.replace("ok 1 -", "not ok 1 -")
			, tap + "Bail out! incomplete\n", tap + "# SKIP disabled\n"
			, tap + "# TODO later\n"
			, tap + "ok 2 - extra\n", tap.replace("# Subtest:", "# Wrong:")
			, tap.replace("\n1..1\n", "\n    not ok 1 - hidden failure\n1..1\n")
			, tap.replace("recursive PHP-Wasm phase: 9.5", "C# phase: 9.5")
			, tap.replace("# pass 1\n", "# pass 2\n")
			, tap.replace("# skipped 0\n", "# skipped 1\n")
			, tap.replace(/^# duration_ms [^\n]+\n$/mu, "")
		]) {
			assert.notEqual(changed, tap);
			assert.throws(() => assertRecursiveCheckedRecordPhpWasmCiTap(changed, route, fixture)); controls++;
		}
		assert.throws(() => assertRecursiveCheckedRecordPhpWasmCiTap(tap, route === "ordinary" ? "reviewed" : "ordinary", fixture));
		assert.throws(() => assertRecursiveCheckedRecordPhpWasmCiTap(tap, route, fixture === "recursive" ? "mutual" : "recursive")); controls += 2;
	}
	assert.equal(controls, 60); t.diagnostic(`${controls} incomplete, substituted, skipped and failed TAP controls`);
});

test("recursive checked-record PHP-Wasm CI binds the report to the independent host and runtime snapshot", async () => {
	const producer = "a".repeat(40), manifest = { pointerBits: 32, version: 1 };
	const host = { schemaVersion: 1, node: "v22.23.3"
		, platform: "linux", arch: "x64"
		, nodeSha256: "1".repeat(64), phpSha256: "2".repeat(64)
		, composerSha256: "3".repeat(64), chromiumSha256: "4".repeat(64) };
	const runtime = { schemaVersion: 1, producerCommit: producer, host
		, runtime: { identity: sha256(canonicalJson(manifest)), manifest } };
	const composer = { hostSha256: host.phpSha256, composerSha256: host.composerSha256 };
	const phpWasm = { nodeVersion: host.node, nodeSha256: host.nodeSha256
		, browserSha256: host.chromiumSha256, runtime: manifest, composer };
	const report = { producerCommit: producer, phpWasm };
	assertRecursiveCheckedRecordPhpWasmCiHost(report, runtime, producer);
	assert.throws(() => assertRecursiveCheckedRecordPhpWasmCiHost(report, runtime, "b".repeat(40)));
	for(const mutate of [
		value => { value.producerCommit = "0".repeat(40); }
		, value => { value.host.nodeSha256 = "0".repeat(64); }
		, value => { value.host.platform = "darwin"; }
		, value => { value.host.extra = true; }
		, value => { value.runtime.identity = "0".repeat(64); }
		, value => { value.runtime.manifest = { ...manifest, pointerBits: 64 }; value.runtime.identity = sha256(canonicalJson(value.runtime.manifest)); }
		, value => { value.schemaVersion = 2; }
	]) {
		const changed = structuredClone(runtime); mutate(changed);
		assert.throws(() => assertRecursiveCheckedRecordPhpWasmCiHost(report, changed, producer));
	}
	for(const mutate of [
		value => { value.phpWasm.nodeVersion = "v20.0.0"; }
		, value => { value.phpWasm.composer.hostSha256 = "0".repeat(64); }
		, value => { value.phpWasm.composer.composerSha256 = "0".repeat(64); }
		, value => { value.phpWasm.browserSha256 = "0".repeat(64); }
		, value => { value.phpWasm.runtime = { ...manifest, pointerBits: 64 }; }
	]) {
		const changed = structuredClone(report); mutate(changed);
		assert.throws(() => assertRecursiveCheckedRecordPhpWasmCiHost(changed, runtime, producer));
	}
	// Retained-record checks refuse before reading when the inventory or TAP is unusable.
	const name = recursiveCheckedRecordPhpWasmCiTestName("ordinary", "recursive");
	const tap = `TAP version 13\n# Subtest: ${name}\nok 1 - ${name}\n1..1\n# tests 1\n# suites 0\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n# duration_ms 2\n`;
	const options = { route: "ordinary", fixture: "recursive", producer, directory: "records", tap: "run.tap", runtime: "runtime.json" };
	await assert.rejects(checkRecursiveCheckedRecordPhpWasmCiRecords(options, { tap, runtime, records: new Map() }));
	await assert.rejects(checkRecursiveCheckedRecordPhpWasmCiRecords(options, { tap, runtime, records: {} }));
	await assert.rejects(checkRecursiveCheckedRecordPhpWasmCiRecords({ ...options, fixture: "mutual" }
		, { tap, runtime, records: new Map([["report.json", Buffer.from(canonicalJson(report))]]) }));
});
