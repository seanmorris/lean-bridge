/**
 * Require exact installed records, terminal TAP and independently verified runtime inputs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { nominalSubtypePhpRoutes, nominalSubtypePhpModes } from "./nominal-subtype-php-fixture.mjs";
import { checkNominalSubtypePhpWasmReport } from "./nominal-subtype-php-wasm-report.mjs";
import { assertNominalSubtypePhpWasmTap } from "./nominal-subtype-php-wasm-provenance.mjs";

/**
 * Refuse missing, duplicated and unknown options before reading records.
 *
 * @param args - CLI arguments following the executable script name.
 */
export const parseNominalSubtypePhpWasmCiArgs = args => {
	const usage = "Usage: check-nominal-subtype-php-wasm-ci.mjs --route <ordinary|reviewed> --mode <full|result-only> --producer <commit> --directory <records> --tap <original-tap> --runtime <independent-runtime-json>";
	const allowed = ["route", "mode", "producer", "directory", "tap", "runtime"], selected = {};
	assert.ok(Array.isArray(args) && args.length === 2 * allowed.length, usage);
	for(let index = 0; index < args.length; index += 2)
	{
		const flag = args[index], value = args[index + 1];
		assert.ok(typeof flag === "string" && flag.startsWith("--") && allowed.includes(flag.slice(2)), usage);
		const key = flag.slice(2);
		assert.ok(!Object.hasOwn(selected, key) && typeof value === "string" && value.length > 0 && !value.startsWith("--") && !/[\0\r\n]/u.test(value), usage);
		selected[key] = value;
	}
	assert.ok(nominalSubtypePhpRoutes.includes(selected.route), usage);
	assert.ok(nominalSubtypePhpModes.includes(selected.mode), usage);
	assert.match(selected.producer, /^[a-f0-9]{40}$/u);
	return selected;
};

/**
 * Match compiler, caller, package and host records against an explicit CI selection.
 *
 * @param options - Required selection and original-record paths.
 * @param original - Independently captured inputs and closed retained output.
 * @param original.tap - Complete producer stdout and stderr.
 * @param original.runtime - Independently captured host and verified shared runtime.
 * @param original.paths - Exact regular-file inventory of the retained selection.
 * @param original.read - Relative original-record reader; no historical paths are opened.
 */
export const checkNominalSubtypePhpWasmCiRecords = async (options, { tap, runtime: input, paths, read }) => {
	const selected = parseNominalSubtypePhpWasmCiArgs(Object.entries(options).flatMap(([key, value]) => ["--" + key, value]));
	assertNominalSubtypePhpWasmTap(tap, selected.route, selected.mode);
	assert.deepEqual(Object.keys(input).sort(), ["host", "producerCommit", "runtime", "schemaVersion"]);
	assert.equal(input.schemaVersion, 1); assert.equal(input.producerCommit, selected.producer);
	const { host, runtime } = input;
	assert.deepEqual(Object.keys(host).sort(), ["arch", "chromiumSha256", "composerSha256", "node", "nodeSha256", "phpSha256", "platform", "schemaVersion"]);
	assert.equal(host.schemaVersion, 1); assert.equal(host.platform, "linux"); assert.equal(host.arch, "x64");
	assert.match(host.node, /^v[0-9]+\.[0-9]+\.[0-9]+$/u);
	for(const key of ["nodeSha256", "phpSha256", "composerSha256", "chromiumSha256"]) assert.match(host[key], /^[a-f0-9]{64}$/u);
	assert.deepEqual(Object.keys(runtime).sort(), ["identity", "manifest"]);
	assert.equal(runtime.identity, sha256(canonicalJson(runtime.manifest)));
	const report = JSON.parse(await read("report.json"));
	assert.equal(report.phpWasm.nodeVersion, host.node); assert.equal(report.phpWasm.nodeSha256, host.nodeSha256);
	assert.equal(report.phpWasm.composer.hostSha256, host.phpSha256);
	assert.equal(report.phpWasm.composer.composerSha256, host.composerSha256);
	assert.equal(report.phpWasm.browserSha256, host.chromiumSha256);
	assert.deepEqual(report.phpWasm.runtime, runtime.manifest);
	const checked = await checkNominalSubtypePhpWasmReport(read, { route: selected.route, mode: selected.mode, producerCommit: selected.producer });
	assert.deepEqual(paths, checked.records);
	return checked;
};
