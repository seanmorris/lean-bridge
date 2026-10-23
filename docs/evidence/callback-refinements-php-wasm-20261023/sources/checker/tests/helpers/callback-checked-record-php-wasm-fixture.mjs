/**
 * Directional checked-record callbacks and closures for PHP-Wasm.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { componentStructuredCallbackDirection } from "../../src/abi/component-structured-callables.mjs";
import { reviewedContractDifference } from "../../src/analyze/reviewed-source.mjs";
import {
	callbackCheckedRecordConfiguration, callbackCheckedRecordContracts
} from "./callback-checked-record-fixture.mjs";
import { phpWasmExecutionTuples } from "./php-wasm-fin-fixtures.mjs";

export const callbackCheckedRecordPhpWasmFixture
	= "tests/fixtures/onboarding/callback-checked-records";
export const callbackCheckedRecordPhpWasmSettings = Object.freeze({
	npm: { name: "lean-bridge-callbackcheckedrecords-wasm", version: "1.0.0" }
	, composer: { name: "lean-bridge-callbackcheckedrecords/wasm", version: "1.0.0" }
});
export const callbackCheckedRecordPhpWasmExpected = Object.freeze({
	checks: 30, callback_calls: 6, word_bits: 32, php: "8.4.1"
});

/**
 * Select ordinary constructors or independently reviewed Binding IR.
 *
 * @param route - Ordinary or reviewed author route.
 */
export const callbackCheckedRecordPhpWasmConfiguration = route => ({
	...callbackCheckedRecordConfiguration(route)
	, targets: { "php-wasm": callbackCheckedRecordPhpWasmSettings }
});

/**
 * Reuse every native-PHP assertion while moving loading into the Wasm driver.
 *
 * @param source - Complete immutable native-PHP caller source.
 * @param mode - Weak or strict PHP caller mode.
 */
export const adaptCallbackCheckedRecordPhpWasm = (source, mode) => {
	assert.ok(["weak", "strict"].includes(mode));
	assert.equal(source.split("declare(strict_types=0);").length, 2);
	assert.equal(source.split("require __DIR__ . '/vendor/autoload.php';\n").length, 2);
	assert.equal(source.split('echo "callback-checked-record-remaining-ok:{$checks}\\n";').length, 2);
	source = source.replace("declare(strict_types=0);"
		, `declare(strict_types=${mode === "strict" ? 1 : 0});`)
		.replace("require __DIR__ . '/vendor/autoload.php';\n", "")
		.replace('echo "callback-checked-record-remaining-ok:{$checks}\\n";'
			, `echo json_encode([
    'checks' => $checks,
    'callback_calls' => $calls,
    'word_bits' => PHP_INT_SIZE * 8,
    'php' => PHP_VERSION,
], JSON_THROW_ON_ERROR) . "\\n";`);
	return source;
};

/**
 * Read the complete native-PHP caller and adapt it to PHP-Wasm.
 *
 * @param mode - Weak or strict PHP caller mode.
 */
export const callbackCheckedRecordPhpWasmCaller = async mode => adaptCallbackCheckedRecordPhpWasm(
	await readFile("tests/fixtures/callback-checked-record-consumers/php-native.php", "utf8"), mode
);

/**
 * Probe a checked callback before lazy component initialization.
 *
 * @param arrangement - Embedded or Composer installation.
 */
export const callbackCheckedRecordPhpWasmRequest = arrangement => {
	assert.ok(["embedded", "composer"].includes(arrangement));
	const autoload = arrangement === "composer" ? "vendor/autoload.php"
		: `vendor/${callbackCheckedRecordPhpWasmSettings.composer.name}/bootstrap.php`;
	return JSON.stringify({ module: "LeanCallbackcheckedrecords"
		, operations: { probe: "call_host" }, autoload }) + "\n";
};

/**
 * Authenticate exact constructor direction and proof-free record payloads.
 *
 * @param model - Compiler-produced PHP-Wasm model.
 * @param review - Independently reviewed Binding IR.
 * @param route - Ordinary or reviewed author route.
 */
export const checkCallbackCheckedRecordPhpWasmModel = (model, review, route) => {
	assert.ok(["ordinary", "reviewed"].includes(route));
	assert.equal(model.profile, "php-wasm-copied-v1");
	assert.equal(model.pointerBits, 32);
	assert.equal(model.schemaVersion, route === "reviewed" ? 5 : 4);
	assert.ok(model.copiedGraph?.callbacks);
	assert.equal(reviewedContractDifference(review, model.bindingIr), null);
	assert.deepEqual(model.exports.map(item => item.name).sort()
		, Object.keys(callbackCheckedRecordContracts).sort());
	const abi = model.copiedGraph;
	const directions = abi.callbacks.map(item => componentStructuredCallbackDirection(abi, item));
	assert.ok(directions.includes("host"));
	assert.ok(directions.includes("closure"));
	for(const definition of model.bindingIr.types.filter(type => ["Interval", "Weighted"].includes(type.name)))
		assert.deepEqual(definition.source.extensions["lean-lang.org/erased-proofs"]?.fields
			, [definition.name === "Interval" ? "ordered" : "within"]);
	assert.deepEqual(model.bindingIr.component, review.component);
};

/**
 * Require every installed Node/browser arrangement and exact observations.
 *
 * @param evidence - Installed corpus execution evidence.
 */
export const checkCallbackCheckedRecordPhpWasmExecutions = evidence => {
	assert.deepEqual(evidence.executions
		.map(item => `${item.realm}/${item.arrangement}/${item.loading}/${item.mode}`).sort()
	, phpWasmExecutionTuples);
	const libraries = [basename(evidence.component.library), basename(evidence.runtime.library)].sort();
	assert.equal(new Set(libraries).size, 2);
	for(const execution of evidence.executions)
	{
		assert.deepEqual(execution.observation, callbackCheckedRecordPhpWasmExpected);
		assert.deepEqual(execution.phases.map(item => ({ ...item, libraries: [...item.libraries].sort() }))
			, ["ready", "autoload", "invalid", "complete"].map(stage => ({ stage
				, libraries: execution.loading === "startup" || stage === "complete" ? libraries : [] })));
	}
};
