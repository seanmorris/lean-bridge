/**
 * Isolated controls for the npm entry probe's export classification; no build or install runs here.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { classifyNominalSubtypeEntryExports } from "./nominal-subtype-entry-npm.mjs";

test("nominal entry export classification closes the installed linker surface", () => {
	const linkManifest = { exports: {
		directSymbols: ["lean_bridge_b", "lean_bridge_a"]
		, initializer: "initialize_LeanBridgeGenerated"
		, internalInitializer: "lean_bridge_internal_initialize_0123456789abcdef"
	} };
	const names = [
		"__wasm_call_ctors", "initialize_LeanBridgeGenerated"
		, "lean_bridge_a", "lean_bridge_b"
		, "lean_bridge_internal_initialize_0123456789abcdef"
		, "__wasm_apply_data_relocs"
	];
	const exports = names.map(name => ({ name, kind: "function" }));
	const javascript = "const symbols = [\"lean_bridge_a\", \"lean_bridge_b\"];";
	const classified = classifyNominalSubtypeEntryExports(
		exports, javascript, linkManifest);
	assert.deepEqual(classified, {
		exports: 6
		, adapters: { exported: ["lean_bridge_a", "lean_bridge_b"]
			, referencedByPackageJavaScript: ["lean_bridge_a", "lean_bridge_b"] }
		, initializers: ["initialize_LeanBridgeGenerated"
			, "lean_bridge_internal_initialize_0123456789abcdef"]
		, emscriptenInternals: ["__wasm_apply_data_relocs"
			, "__wasm_call_ctors"]
		, validators: { exported: [], referencedByPackageJavaScript: [] }
	});
	assert.throws(() => classifyNominalSubtypeEntryExports(
		[], javascript, linkManifest), /empty/u);
	assert.throws(() => classifyNominalSubtypeEntryExports(
		exports, null, linkManifest));
	assert.throws(() => classifyNominalSubtypeEntryExports(
		exports, javascript, null), /manifest/u);
	assert.throws(() => classifyNominalSubtypeEntryExports(
		exports, "lean_bridge_a", linkManifest), /every direct adapter/u);
	assert.throws(() => classifyNominalSubtypeEntryExports(
		[...exports, { name: "lb_a_refinement_0", kind: "function" }]
		, javascript, linkManifest), /differ/u);
	assert.throws(() => classifyNominalSubtypeEntryExports(
		exports.map(item => item.name === "lean_bridge_a"
			? { ...item, kind: "global" } : item)
		, javascript, linkManifest), /export kind/u);
	assert.throws(() => classifyNominalSubtypeEntryExports(
		exports.slice(1), javascript, linkManifest), /differ/u);
});
