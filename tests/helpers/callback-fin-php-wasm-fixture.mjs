/**
 * Complete checked-Fin callback and returned-closure corpus for PHP-Wasm.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { componentStructuredCallbackDirection } from "../../src/abi/component-structured-callables.mjs";
import { reviewedContractDifference } from "../../src/analyze/reviewed-source.mjs";
import {
	reviewedCallbackFinArities, reviewedCallbackFinExports, reviewedCallbackFinReview
} from "./reviewed-callback-fin-fixture.mjs";
import { phpWasmExecutionTuples } from "./php-wasm-fin-fixtures.mjs";

export const callbackFinPhpWasmFixture = "tests/fixtures/onboarding/reviewed-callback-fin";
export const callbackFinPhpWasmSettings = Object.freeze({
	npm: { name: "lean-bridge-reviewedcallbacks-wasm", version: "1.0.0" }
	, composer: { name: "lean-bridge-reviewedcallbacks/wasm", version: "1.0.0" }
});
export const callbackFinPhpWasmExports = Object.freeze([
	...reviewedCallbackFinExports, "ReviewedCallbacks.three"
]);
export const callbackFinPhpWasmExpected = Object.freeze({
	checks: 25, rejections: 8, callback_calls: 7, word_bits: 32, php: "8.4.1"
});

/**
 * Select ordinary compiler extraction or the independent reviewed contract.
 *
 * @param route - Ordinary source or independently reviewed Binding IR.
 */
export const callbackFinPhpWasmConfiguration = route => {
	assert.ok(["ordinary", "reviewed"].includes(route));
	const base = { schemaVersion: 1, modules: ["ReviewedCallbacks"]
		, targets: { "php-wasm": callbackFinPhpWasmSettings } };
	return route === "reviewed" ? base : { ...base
		, exports: [...callbackFinPhpWasmExports]
		, arities: { ...reviewedCallbackFinArities } };
};

/** Independent review including the host-produced Fin reply. */
export const callbackFinPhpWasmReview = () => reviewedCallbackFinReview({ hostReply: true });

/**
 * Bind only caller lexical strictness; the driver owns package loading.
 *
 * @param source - Complete immutable PHP caller source.
 * @param mode - Weak or strict PHP caller mode.
 */
export const adaptCallbackFinPhpWasm = (source, mode) => {
	assert.ok(["weak", "strict"].includes(mode));
	const declaration = "declare(strict_types=0);";
	assert.equal(source.split(declaration).length, 2);
	assert.equal(source.includes("vendor/autoload.php"), false);
	return source.replace(declaration, `declare(strict_types=${mode === "strict" ? 1 : 0});`);
};

/**
 * Read the complete public caller and bind its lexical strictness.
 *
 * @param mode - Weak or strict PHP caller mode.
 */
export const callbackFinPhpWasmCaller = async mode => adaptCallbackFinPhpWasm(
	await readFile("tests/fixtures/reviewed-callback-fin-consumers/php-wasm.php", "utf8"), mode
);

/**
 * Probe a host callback before lazy component initialization.
 *
 * @param arrangement - Embedded or Composer installation.
 */
export const callbackFinPhpWasmRequest = arrangement => {
	assert.ok(["embedded", "composer"].includes(arrangement));
	const autoload = arrangement === "composer" ? "vendor/autoload.php"
		: `vendor/${callbackFinPhpWasmSettings.composer.name}/bootstrap.php`;
	return JSON.stringify({ module: "LeanReviewedcallbacks"
		, operations: { probe: "visit" }, autoload }) + "\n";
};

/**
 * Authenticate the complete Fin callback model and its compiler-known roles.
 *
 * @param model - Compiler-produced PHP-Wasm model.
 * @param review - Independent Binding IR review.
 * @param route - Ordinary or reviewed author route.
 */
export const checkCallbackFinPhpWasmModel = (model, review, route) => {
	assert.ok(["ordinary", "reviewed"].includes(route));
	assert.equal(model.profile, "php-wasm-copied-v1");
	assert.equal(model.pointerBits, 32);
	assert.equal(model.schemaVersion, route === "reviewed" ? 5 : 4);
	assert.ok(model.copiedGraph?.callbacks);
	assert.equal(reviewedContractDifference(review, model.bindingIr), null);
	assert.deepEqual(model.exports.map(item => item.name).sort()
		, callbackFinPhpWasmExports.toSorted());
	const abi = model.copiedGraph;
	const callbacks = new Map(abi.callbacks.map(item => [item.id, item]));
	const roles = model.bindingIr.declarations.flatMap(item => [
		...item.parameters.filter(site => callbacks.has(site.type.id))
			.map(site => componentStructuredCallbackDirection(abi, callbacks.get(site.type.id), true))
		, ...callbacks.has(item.result.type.id)
			? [componentStructuredCallbackDirection(abi, callbacks.get(item.result.type.id), true)] : []
	]);
	assert.ok(roles.includes("host"));
	assert.ok(roles.includes("closure"));
	assert.deepEqual(model.bindingIr.component, review.component);
};

/**
 * Require every installed Node/browser arrangement and exact observations.
 *
 * @param evidence - Installed corpus execution evidence.
 */
export const checkCallbackFinPhpWasmExecutions = evidence => {
	assert.deepEqual(evidence.executions
		.map(item => `${item.realm}/${item.arrangement}/${item.loading}/${item.mode}`).sort()
	, phpWasmExecutionTuples);
	const libraries = [basename(evidence.component.library), basename(evidence.runtime.library)].sort();
	assert.equal(new Set(libraries).size, 2);
	for(const execution of evidence.executions)
	{
		assert.deepEqual(execution.observation, callbackFinPhpWasmExpected);
		assert.deepEqual(execution.phases.map(item => ({ ...item, libraries: [...item.libraries].sort() }))
			, ["ready", "autoload", "invalid", "complete"].map(stage => ({ stage
				, libraries: execution.loading === "startup" || stage === "complete" ? libraries : [] })));
	}
};
