/**
 * Require one complete installed recursive checked-record PHP-Wasm selection, independent host
 * evidence and every corruption control over the exact retained records.
 *
 * @file
 */
import assert from "node:assert/strict";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { recursiveCheckedRecordPhpWasmFixtures, recursiveCheckedRecordPhpWasmRoutes } from "./recursive-checked-record-php-wasm-fixture.mjs";
import { checkRecursiveCheckedRecordPhpWasmControls } from "./recursive-checked-record-php-wasm-controls.mjs";
import { checkRecursiveCheckedRecordPhpWasmReport } from "./recursive-checked-record-php-wasm-report.mjs";

/**
 * Name one complete, independently installed package selection.
 *
 * @param route - Ordinary or independently reviewed source.
 * @param fixture - Recursive or mutual module.
 */
export const recursiveCheckedRecordPhpWasmCiTestName = (route, fixture) => {
	assert.ok(recursiveCheckedRecordPhpWasmRoutes.includes(route));
	assert.ok(recursiveCheckedRecordPhpWasmFixtures.includes(fixture));
	return `installed recursive checked-record PHP-Wasm packages reproduce and relocate ${route} ${fixture}`;
};

/**
 * Refuse missing, duplicated and unknown options before reading records.
 *
 * @param args - CLI arguments following the executable script name.
 */
export const parseRecursiveCheckedRecordPhpWasmCiArgs = args => {
	const usage = "Usage: check-recursive-checked-record-php-wasm-ci.mjs --route <ordinary|reviewed> --fixture <recursive|mutual> --producer <commit> --directory <records> --tap <original-tap> --runtime <independent-runtime-json>";
	const allowed = ["route", "fixture", "producer", "directory", "tap", "runtime"], selected = {};
	assert.ok(Array.isArray(args) && args.length === 2 * allowed.length, usage);
	for(let index = 0; index < args.length; index += 2)
	{
		const flag = args[index], value = args[index + 1];
		assert.ok(typeof flag === "string" && flag.startsWith("--") && allowed.includes(flag.slice(2)), usage);
		const key = flag.slice(2);
		assert.ok(!Object.hasOwn(selected, key) && typeof value === "string"
			&& value.length > 0 && !value.startsWith("--") && !/[\0\r\n]/u.test(value), usage);
		selected[key] = value;
	}
	assert.ok(recursiveCheckedRecordPhpWasmRoutes.includes(selected.route), usage);
	assert.ok(recursiveCheckedRecordPhpWasmFixtures.includes(selected.fixture), usage);
	assert.match(selected.producer, /^[a-f0-9]{40}$/u, usage);
	return selected;
};

/**
 * Require the exact successful selection, one terminal plan and zero skipped tests.
 * Admission waits are diagnostics, never results.
 *
 * @param source - Original combined producer output.
 * @param route - Expected author route.
 * @param fixture - Expected module.
 */
export const assertRecursiveCheckedRecordPhpWasmCiTap = (source, route, fixture) => {
	const name = recursiveCheckedRecordPhpWasmCiTestName(route, fixture);
	assert.equal(typeof source, "string"); assert.ok(source.startsWith("TAP version 13\n"));
	assert.doesNotMatch(source, /^not ok |^Bail out!|# SKIP|# TODO/gmu);
	assert.doesNotMatch(source, /^[ \t]+(?:ok |not ok |# Subtest:|Bail out!)/gmu);
	assert.deepEqual([...source.matchAll(/^ok (\d+) - (.+)$/gmu)].map(match => [Number(match[1]), match[2]]), [[1, name]]);
	assert.deepEqual([...source.matchAll(/^# Subtest: (.+)$/gmu)].map(match => match[1]), [name]);
	for(const match of source.matchAll(/^# Waiting for (.+)$/gmu))
		assert.match(match[1], /^host load below [0-9]+ before the next recursive PHP-Wasm phase: [0-9]+(?:\.[0-9]+)?$/u);
	for(const [key, expected] of Object.entries({ tests: 1, suites: 0, pass: 1, fail: 0, cancelled: 0, skipped: 0, todo: 0 }))
	{
		const matches = [...source.matchAll(new RegExp(`^# ${key} (\\d+)$`, "gmu"))];
		assert.equal(matches.length, 1, key); assert.equal(Number(matches[0][1]), expected, key);
	}
	assert.deepEqual([...source.matchAll(/^\d+\.\.\d+.*$/gmu)].map(match => match[0]), ["1..1"]);
	assert.match(source, /\n1\.\.1\n# tests 1\n# suites 0\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n# duration_ms [0-9]+(?:\.[0-9]+)?\n$/u);
};

/**
 * Bind the original report to an independently captured host and verified shared runtime.
 *
 * @param report - Original report.json.
 * @param input - Snapshot written by snapshot-nominal-subtype-php-wasm-ci.mjs before the producer.
 * @param producer - Exact producer revision.
 */
export const assertRecursiveCheckedRecordPhpWasmCiHost = (report, input, producer) => {
	assert.deepEqual(Object.keys(input).sort(), ["host", "producerCommit", "runtime", "schemaVersion"]);
	assert.equal(input.schemaVersion, 1); assert.equal(input.producerCommit, producer);
	const { host, runtime } = input;
	assert.deepEqual(Object.keys(host).sort(), ["arch", "chromiumSha256", "composerSha256", "node", "nodeSha256", "phpSha256", "platform", "schemaVersion"]);
	assert.equal(host.schemaVersion, 1); assert.equal(host.platform, "linux"); assert.equal(host.arch, "x64");
	assert.match(host.node, /^v[0-9]+\.[0-9]+\.[0-9]+$/u);
	for(const key of ["nodeSha256", "phpSha256", "composerSha256", "chromiumSha256"]) assert.match(host[key], /^[a-f0-9]{64}$/u);
	assert.deepEqual(Object.keys(runtime).sort(), ["identity", "manifest"]);
	assert.equal(runtime.identity, sha256(canonicalJson(runtime.manifest)));
	assert.equal(report.producerCommit, producer);
	assert.equal(report.phpWasm.nodeVersion, host.node); assert.equal(report.phpWasm.nodeSha256, host.nodeSha256);
	assert.equal(report.phpWasm.composer.hostSha256, host.phpSha256);
	assert.equal(report.phpWasm.composer.composerSha256, host.composerSha256);
	assert.equal(report.phpWasm.browserSha256, host.chromiumSha256);
	assert.deepEqual(report.phpWasm.runtime, runtime.manifest);
};

/**
 * Match the closed retained inventory, the report and every control against an explicit selection.
 *
 * @param options - Required selection and original-record paths.
 * @param original - Independently captured inputs and the closed retained output.
 * @param original.tap - Complete producer stdout and stderr.
 * @param original.runtime - Independently captured host and verified shared runtime.
 * @param original.records - Map of every retained regular file, relative path to original bytes.
 */
export const checkRecursiveCheckedRecordPhpWasmCiRecords = async (options, { tap, runtime, records }) => {
	const selected = parseRecursiveCheckedRecordPhpWasmCiArgs(Object.entries(options).flatMap(([key, value]) => ["--" + key, value]));
	assertRecursiveCheckedRecordPhpWasmCiTap(tap, selected.route, selected.fixture);
	assert.ok(records instanceof Map && records.has("report.json"), "Retained records must include report.json");
	assertRecursiveCheckedRecordPhpWasmCiHost(JSON.parse(records.get("report.json")), runtime, selected.producer);
	const scope = { route: selected.route, fixture: selected.fixture, producerCommit: selected.producer };
	const read = async path => {
		assert.ok(records.has(path), "Missing " + path); return records.get(path);
	};
	const checked = await checkRecursiveCheckedRecordPhpWasmReport(read, scope);
	assert.deepEqual([...records.keys()].sort(), checked.records, "Retained records differ from the verified set");
	const controls = await checkRecursiveCheckedRecordPhpWasmControls(records, scope);
	return { ...checked, controls, reportSha256: sha256(records.get("report.json")) };
};
