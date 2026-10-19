/**
 * Require exact value-index PHP-Wasm compiler and installed-package CI records.
 *
 * @file
 */
import assert from "node:assert/strict";
import { checkedRecordValueIndexBrowserRoutes } from "./checked-record-value-index-browser-fixture.mjs";
import { checkedRecordValueIndexPhpWasmSelection } from "./checked-record-value-index-php-wasm-fixture.mjs";
import { checkCheckedRecordValueIndexPhpWasmReport } from "./checked-record-value-index-php-wasm-report.mjs";

const testSummary = Object.freeze({
	tests: 1, suites: 0, pass: 1, fail: 0, cancelled: 0, skipped: 0, todo: 0
});
const compilerSummary = Object.freeze({
	tests: 4, suites: 0, pass: 4, fail: 0, cancelled: 0, skipped: 0, todo: 0
});
const namedRows = source => [...source.matchAll(/^ok (\d+) - (.+)$/gmu)]
	.map(match => [Number(match[1]), match[2]]);
const subtests = source => [...source.matchAll(/^# Subtest: (.+)$/gmu)].map(match => match[1]);
const summary = (source, values) => {
	for(const [key, expected] of Object.entries(values))
	{
		const matches = [...source.matchAll(new RegExp(`^# ${key} (\\d+)$`, "gmu"))];
		assert.equal(matches.length, 1, key); assert.equal(Number(matches[0][1]), expected, key);
	}
};
const noSkippedOrPartialTap = source => {
	assert.equal(typeof source, "string"); assert.ok(source.startsWith("TAP version 13\n"));
	assert.doesNotMatch(source, /^not ok |^Bail out!|# SKIP|# TODO/gmu);
};

/**
 * Require the four fresh wasm32 compiler controls and their retained diagnostics.
 *
 * @param source - Complete original compiler TAP stream.
 */
export const assertCheckedRecordValueIndexPhpWasmCompilerTap = source => {
	const names = checkedRecordValueIndexBrowserRoutes.map(route =>
		`fresh Lean PHP-Wasm value-index checked-record ${route}`);
	noSkippedOrPartialTap(source);
	assert.deepEqual(namedRows(source), names.map((name, index) => [index + 1, name]));
	assert.deepEqual(subtests(source), names); summary(source, compilerSummary);
	assert.deepEqual([...source.matchAll(/^\d+\.\.\d+.*$/gmu)].map(match => match[0]), ["1..4"]);
	const observations = [...source.matchAll(/^# (\{.*\})$/gmu)].map(match => JSON.parse(match[1]));
	assert.equal(observations.length, 4);
	for(const [index, route] of checkedRecordValueIndexBrowserRoutes.entries())
	{
		const observation = observations[index], selection = checkedRecordValueIndexPhpWasmSelection(route);
		assert.match(observation.generatedCSha256, /^[a-f0-9]{64}$/u);
		assert.deepEqual(observation, {
			sourceCompilationOnly: true, route, module: "CheckedRecordValueIndices"
			, pointerBits: 32, exports: selection.expected.declarations.length
			, generatedCSha256: observation.generatedCSha256, installedAcceptance: false
		});
	}
};

/**
 * Parse the closed option set before opening any installed package record.
 *
 * @param args - Arguments following the executable script name.
 */
export const parseCheckedRecordValueIndexPhpWasmCiArgs = args => {
	const usage = "Usage: check-checked-record-value-index-php-wasm-ci.mjs --route <route> --producer <commit> --directory <records> --tap <original-tap>";
	const allowed = ["route", "producer", "directory", "tap"], selected = {};
	assert.ok(Array.isArray(args) && args.length === 2 * allowed.length, usage);
	for(let index = 0; index < args.length; index += 2)
	{
		const flag = args[index], value = args[index + 1];
		assert.ok(typeof flag === "string" && flag.startsWith("--")
			&& allowed.includes(flag.slice(2)), usage);
		const key = flag.slice(2);
		assert.ok(!Object.hasOwn(selected, key) && typeof value === "string" && value.length > 0
			&& !value.startsWith("--") && !value.includes("\0"), usage);
		selected[key] = value;
	}
	assert.ok(checkedRecordValueIndexBrowserRoutes.includes(selected.route), usage);
	assert.match(selected.producer, /^[a-f0-9]{40}$/u);
	return selected;
};

/**
 * Require the exact one-route zero-skip retained producer stream.
 *
 * @param source - Complete original installed-producer TAP stream.
 * @param route - Exact ordinary/reviewed and full/result-only author route.
 */
export const assertCheckedRecordValueIndexPhpWasmCiTap = (source, route) => {
	assert.ok(checkedRecordValueIndexBrowserRoutes.includes(route));
	const name = `installed value-index checked records PHP-Wasm ${route} reproduce and relocate`;
	noSkippedOrPartialTap(source);
	assert.deepEqual(namedRows(source), [[1, name]]); assert.deepEqual(subtests(source), [name]);
	summary(source, testSummary);
	assert.deepEqual([...source.matchAll(/^\d+\.\.\d+.*$/gmu)].map(match => match[0]), ["1..1"]);
};

/**
 * Authenticate original package bytes after rejecting an incomplete producer TAP stream.
 *
 * @param options - Closed parsed route, original producer, and record paths.
 * @param original - Original TAP plus route-relative byte reader.
 * @param original.tap - Complete original installed-producer TAP stream.
 * @param original.read - Reads one original route-relative record.
 */
export const checkCheckedRecordValueIndexPhpWasmCiRecords = async (options, { tap, read }) => {
	const selected = parseCheckedRecordValueIndexPhpWasmCiArgs(Object.entries(options)
		.flatMap(([key, value]) => ["--" + key, value]));
	assertCheckedRecordValueIndexPhpWasmCiTap(tap, selected.route);
	return checkCheckedRecordValueIndexPhpWasmReport(read, {
		route: selected.route, producerCommit: selected.producer
	});
};
