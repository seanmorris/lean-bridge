/**
 * Complete directional callback Subtype corpus adapted to installed PHP-Wasm.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { callbackSubtypeDirection } from "../../src/abi/refinements.mjs";
import { reviewedContractDifference } from "../../src/analyze/reviewed-source.mjs";
import {
	callbackSubtypeConfiguration, callbackSubtypeContracts
} from "./callback-subtype-fixture.mjs";
import { phpWasmExecutionTuples } from "./php-wasm-fin-fixtures.mjs";

export const callbackSubtypePhpWasmSettings = Object.freeze({
	npm: { name: "lean-bridge-callbacksubtypes-wasm", version: "1.0.0" }
	, composer: { name: "lean-bridge-callbacksubtypes/wasm", version: "1.0.0" }
});
export const callbackSubtypePhpWasmExpected = Object.freeze({
	checks: 28, rejections: 9, callback_calls: 8, word_bits: 32, php: "8.4.1"
});

/**
 * Select one author route without changing the shared callback contract.
 *
 * @param route - Ordinary or reviewed author route.
 */
export const callbackSubtypePhpWasmConfiguration = route => ({
	...callbackSubtypeConfiguration(route)
	, targets: { "php-wasm": callbackSubtypePhpWasmSettings }
});

/**
 * Bind only caller lexical strictness; package loading remains the driver's job.
 *
 * @param source - Generated PHP caller source.
 * @param mode - Weak or strict PHP caller mode.
 */
export const adaptCallbackSubtypePhpWasm = (source, mode) => {
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
export const callbackSubtypePhpWasmCaller = async mode => adaptCallbackSubtypePhpWasm(
	await readFile("tests/fixtures/callback-subtype-consumers/php-wasm.php", "utf8"), mode
);

/**
 * Probe a callable parameter before a lazy component is initialized.
 *
 * @param arrangement - Embedded or Composer package arrangement.
 */
export const callbackSubtypePhpWasmRequest = arrangement => {
	assert.ok(["embedded", "composer"].includes(arrangement));
	const autoload = arrangement === "composer" ? "vendor/autoload.php"
		: `vendor/${callbackSubtypePhpWasmSettings.composer.name}/bootstrap.php`;
	return JSON.stringify({ module: "LeanCallbacksubtypes"
		, operations: { probe: "call_host" }, autoload }) + "\n";
};

/**
 * Require exact compiler/review reconciliation and both callback directions.
 *
 * @param model - Generated PHP-Wasm component model.
 * @param review - Reviewed binding contract.
 * @param route - Ordinary or reviewed author route.
 */
export const checkCallbackSubtypePhpWasmModel = (model, review, route) => {
	assert.ok(["ordinary", "reviewed"].includes(route));
	assert.equal(model.profile, "php-wasm-copied-v1");
	assert.equal(model.pointerBits, 32);
	assert.equal(model.schemaVersion, route === "reviewed" ? 5 : 4);
	assert.ok(model.copiedGraph?.callbacks);
	assert.equal(reviewedContractDifference(review, model.bindingIr), null);
	assert.equal(model.exports.length, Object.keys(callbackSubtypeContracts).length);
	assert.deepEqual(model.exports.map(item => item.name).sort(), Object.keys(callbackSubtypeContracts).sort());
	const callbacks = model.bindingIr.types.filter(type => type.kind === "callback");
	assert.equal(callbacks.length, 6);
	assert.deepEqual(callbacks.map(type => callbackSubtypeDirection({
		parameters: type.callable.parameters.map(parameter => parameter.type)
		, result: type.callable.result.type
	}, type.source.extensions["lean-lang.org/refinements"], model.bindingIr.types)).sort()
	, ["closure", "closure", "closure", "host", "host", "host"]);
	assert.deepEqual(model.bindingIr.component, review.component);
};

/**
 * Reject a missing host context, changed result or eager lazy-load boundary.
 *
 * @param evidence - Installed execution evidence to authenticate.
 */
export const checkCallbackSubtypePhpWasmExecutions = evidence => {
	assert.deepEqual(evidence.executions
		.map(item => `${item.realm}/${item.arrangement}/${item.loading}/${item.mode}`).sort()
	, phpWasmExecutionTuples);
	const libraries = [basename(evidence.component.library), basename(evidence.runtime.library)].sort();
	assert.equal(new Set(libraries).size, 2);
	for(const execution of evidence.executions)
	{
		assert.deepEqual(execution.observation, callbackSubtypePhpWasmExpected);
		assert.deepEqual(execution.phases.map(item => ({ ...item, libraries: [...item.libraries].sort() }))
			, ["ready", "autoload", "invalid", "complete"].map(stage => ({ stage
				, libraries: execution.loading === "startup" || stage === "complete" ? libraries : [] })));
	}
};
