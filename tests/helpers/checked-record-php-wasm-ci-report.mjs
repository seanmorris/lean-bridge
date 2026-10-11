/**
 * Require an exact installed checked-record php-wasm route and complete original TAP.
 *
 * @file
 */
import assert from "node:assert/strict";
const checkedRecordPhpWasmRoutes = ["ordinary-source", "reviewed-ir", "result-only-ordinary-source", "result-only-reviewed-ir"];
import { checkCheckedRecordPhpWasmReport } from "./checked-record-php-wasm-report.mjs";

/**
 * Require all four fresh wasm32 compilations and all five reviewed reconciliation controls.
 *
 * @param source - Original combined compiler test output.
 */
export const assertCheckedRecordPhpWasmCompilerTap = source => {
	const cases = ["erased-proof-omission", "changed-index", "reordered-payload", "foreign-constructor", "valid-constructor-change"];
	const names = [...checkedRecordPhpWasmRoutes.map(route => `fresh Lean PHP-Wasm checked-record ${route}`)
		, ...cases.map(name => `fresh Lean PHP-Wasm ${name}`)];
	assert.equal(typeof source, "string"); assert.ok(source.startsWith("TAP version 13\n"));
	assert.doesNotMatch(source, /^not ok |^Bail out!|# SKIP|# TODO/gmu);
	assert.deepEqual([...source.matchAll(/^ok (\d+) - (.+)$/gmu)].map(match => [Number(match[1]), match[2]]), names.map((name, index) => [index + 1, name]));
	assert.deepEqual([...source.matchAll(/^# Subtest: (.+)$/gmu)].map(match => match[1]), names);
	for(const [key, expected] of Object.entries({ tests: 9, suites: 0, pass: 9, fail: 0, cancelled: 0, skipped: 0, todo: 0 }))
	{
		const matches = [...source.matchAll(new RegExp(`^# ${key} (\\d+)$`, "gmu"))];
		assert.equal(matches.length, 1, key); assert.equal(Number(matches[0][1]), expected, key);
	}
	assert.deepEqual([...source.matchAll(/^\d+\.\.\d+.*$/gmu)].map(match => match[0]), ["1..9"]);
	const observations = [...source.matchAll(/^# (\{.*\})$/gmu)].map(match => JSON.parse(match[1]));
	assert.equal(observations.length, 9);
	for(const [index, route] of checkedRecordPhpWasmRoutes.entries())
	{
		const observation = observations[index];
		assert.match(observation.generatedCSha256, /^[a-f0-9]{64}$/u);
		assert.deepEqual(observation, {
			sourceCompilationOnly: true, route, pointerBits: 32
			, exports: route.startsWith("result-only-") ? 1 : 8
			, generatedCSha256: observation.generatedCSha256
			, installedAcceptance: false
		});
	}
	for(const [index, name] of cases.entries())
		assert.deepEqual(observations[index + 4], {
			sourceCompilationOnly: true, name
			, compiled: name === "valid-constructor-change"
			, noOutput: true, installedAcceptance: false
		});
};

/**
 * Parse the closed option set before opening any retained records.
 *
 * @param args - Arguments following the executable script name.
 */
export const parseCheckedRecordPhpWasmCiArgs = args => {
	const usage = "Usage: check-checked-record-php-wasm-ci.mjs --route <route> --producer <commit> --directory <records> --tap <original-tap>";
	const allowed = ["route", "producer", "directory", "tap"], selected = {};
	assert.ok(Array.isArray(args) && args.length === 2 * allowed.length, usage);
	for(let index = 0; index < args.length; index += 2)
	{
		const flag = args[index], value = args[index + 1];
		assert.ok(typeof flag === "string" && flag.startsWith("--") && allowed.includes(flag.slice(2)), usage);
		const key = flag.slice(2);
		assert.ok(!Object.hasOwn(selected, key) && typeof value === "string" && value.length > 0 && !value.startsWith("--") && !value.includes("\0"), usage);
		selected[key] = value;
	}
	assert.ok(checkedRecordPhpWasmRoutes.includes(selected.route), usage);
	assert.match(selected.producer, /^[a-f0-9]{40}$/u);
	return selected;
};

/**
 * Refuse partial runs, renamed selections, skips and appended success summaries.
 *
 * @param source - Original combined producer output.
 * @param route - Explicit required author and package selection.
 */
export const assertCheckedRecordPhpWasmCiTap = (source, route) => {
	assert.ok(checkedRecordPhpWasmRoutes.includes(route));
	const name = `installed checked records PHP-Wasm ${route} reproduce and relocate`;
	assert.equal(typeof source, "string"); assert.ok(source.startsWith("TAP version 13\n"));
	assert.doesNotMatch(source, /^not ok |^Bail out!|# SKIP|# TODO/gmu);
	assert.deepEqual([...source.matchAll(/^ok (\d+) - (.+)$/gmu)].map(match => [Number(match[1]), match[2]]), [[1, name]]);
	assert.deepEqual([...source.matchAll(/^# Subtest: (.+)$/gmu)].map(match => match[1]), [name]);
	for(const [key, expected] of Object.entries({ tests: 1, suites: 0, pass: 1, fail: 0, cancelled: 0, skipped: 0, todo: 0 }))
	{
		const matches = [...source.matchAll(new RegExp(`^# ${key} (\\d+)$`, "gmu"))];
		assert.equal(matches.length, 1, key); assert.equal(Number(matches[0][1]), expected, key);
	}
	assert.deepEqual([...source.matchAll(/^\d+\.\.\d+.*$/gmu)].map(match => match[0]), ["1..1"]);
};

/**
 * Authenticate original installed records without following reported producer paths.
 *
 * @param options - Closed parsed route, original producer and input paths.
 * @param original - Original TAP and route-relative retained file reader.
 * @param original.tap - Combined producer stdout and stderr.
 * @param original.read - Reads retained bytes, not historical machine paths.
 */
export const checkCheckedRecordPhpWasmCiRecords = async (options, { tap, read }) => {
	const selected = parseCheckedRecordPhpWasmCiArgs(Object.entries(options).flatMap(([key, value]) => ["--" + key, value]));
	assertCheckedRecordPhpWasmCiTap(tap, selected.route);
	return checkCheckedRecordPhpWasmReport(read, { route: selected.route, producerCommit: selected.producer });
};
