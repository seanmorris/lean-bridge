/**
 * PHP-Wasm source contract for proof-erased dependent checked records. The
 * retained `below : Fin bound` field is checked against the retained `bound`
 * field at every host-to-Lean boundary. Installed evidence is separate.
 *
 * @file
 */
import assert from "node:assert/strict";
import { reviewedContractDifference } from "../../src/analyze/reviewed-source.mjs";
import { dependentCheckedRecordRoutes } from "./dependent-checked-record-browser-fixture.mjs";
import {
	dependentCheckedRecordPhpCaller, dependentCheckedRecordPhpExpected
	, dependentCheckedRecordPhpSelection
} from "./dependent-checked-record-php-fixture.mjs";
import { phpWasmExecutionTuples } from "./php-wasm-fin-fixtures.mjs";

export const dependentCheckedRecordPhpWasmSettings = Object.freeze({
	npm: Object.freeze({ name: "lean-bridge-dependentrecords-wasm", version: "1.0.0" })
	, composer: Object.freeze({ name: "lean-bridge-dependentrecords/wasm", version: "1.0.0" })
});

/**
 * Keep the independently authored four-route contract while selecting PHP-Wasm only.
 *
 * @param route - Closed ordinary/reviewed and full/result-only route.
 */
export const dependentCheckedRecordPhpWasmSelection = route => {
	assert.ok(dependentCheckedRecordRoutes.includes(route));
	const selected = dependentCheckedRecordPhpSelection(route);
	return { ...selected, configuration: { ...selected.configuration
		, targets: { "php-wasm": dependentCheckedRecordPhpWasmSettings } } };
};

/**
 * Record the actual wasm32 host rather than silently assuming native-PHP facts.
 *
 * @param route - Closed ordinary/reviewed and full/result-only route.
 */
export const dependentCheckedRecordPhpWasmExpected = route => ({
	...dependentCheckedRecordPhpExpected(route), word_bits: 32, php: "8.4.1"
});

const loader = "if (!class_exists('LeanDependentrecords\\\\Dependent')) {\n"
	+ "    require __DIR__ . '/vendor/autoload.php';\n}\n\n";
const entry = "if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) {\n"
	+ "    $resultOnly = in_array('--result-only', $argv, true);\n"
	+ "    $reviewed = in_array('--reviewed', $argv, true);\n"
	+ "    echo json_encode(check_dependent_records($resultOnly, $reviewed ? 'value' : 'arg'), JSON_THROW_ON_ERROR) . \"\\n\";\n}\n";

/**
 * Let the shared PHP-Wasm driver load the selected public autoloader, then
 * execute exactly the native caller's assertions under the requested lexical
 * strictness. The route is explicit: the driver supplies no CLI arguments.
 *
 * @param source - Complete immutable native-PHP caller source.
 * @param route - Closed ordinary/reviewed and full/result-only route.
 * @param strictness - Weak or strict lexical PHP caller mode.
 */
export const adaptDependentCheckedRecordPhpWasm = (source, route, strictness) => {
	const { resultOnly, reviewed } = dependentCheckedRecordPhpWasmSelection(route);
	assert.ok(["weak", "strict"].includes(strictness));
	assert.ok(source.startsWith("<?php\ndeclare(strict_types=0);\n"));
	for(const marker of [loader, entry])
		assert.ok(source.includes(marker) && source.indexOf(marker) === source.lastIndexOf(marker), marker);
	assert.ok(source.endsWith(entry));
	const observed = "    $observed = check_dependent_records("
		+ `${resultOnly ? "true" : "false"}, '${reviewed ? "value" : "arg"}');\n`
		+ "    echo json_encode([...$observed, 'word_bits' => PHP_INT_SIZE * 8, 'php' => PHP_VERSION], JSON_THROW_ON_ERROR) . \"\\n\";\n";
	return source.replace("declare(strict_types=0);", `declare(strict_types=${strictness === "strict" ? 1 : 0});`)
		.replace(loader, "").replace(entry, observed);
};

/**
 * Load and adapt the immutable native-PHP caller for a selected Wasm route.
 *
 * @param route - Closed ordinary/reviewed and full/result-only route.
 * @param strictness - Weak or strict lexical PHP caller mode.
 */
export const dependentCheckedRecordPhpWasmCaller = async (route, strictness) =>
	adaptDependentCheckedRecordPhpWasm(await dependentCheckedRecordPhpCaller(), route, strictness);

/**
 * Probe an actual selected public export before lazy Lean loading.
 *
 * @param route - Closed ordinary/reviewed and full/result-only route.
 * @param arrangement - Embedded npm or installed Composer autoloading.
 */
export const dependentCheckedRecordPhpWasmRequest = (route, arrangement) => {
	dependentCheckedRecordPhpWasmSelection(route);
	assert.ok(["embedded", "composer"].includes(arrangement));
	const autoload = arrangement === "composer" ? "vendor/autoload.php"
		: `vendor/${dependentCheckedRecordPhpWasmSettings.composer.name}/bootstrap.php`;
	return JSON.stringify({
		module: "LeanDependentrecords"
		, operations: { probe: "dependent_result" }
		, autoload
	}) + "\n";
};

/**
 * Require freshly compiled wasm32 metadata, never a relabelled native model.
 *
 * @param model - Actual generated PHP-Wasm component model.
 * @param route - Closed ordinary/reviewed and full/result-only route.
 */
export const checkDependentCheckedRecordPhpWasmModel = (model, route) => {
	const { expected, reviewed } = dependentCheckedRecordPhpWasmSelection(route);
	assert.equal(model.profile, "php-wasm-copied-v1");
	assert.equal(model.pointerBits, 32); assert.equal(model.byteOrder, "little");
	assert.equal(model.schemaVersion, reviewed ? 3 : 2);
	assert.equal(reviewedContractDifference(expected, model.bindingIr), null);
	assert.equal(model.exports.length, expected.declarations.length);
	const record = (site, constructor) => {
		const definition = expected.types.find(item => item.id === site?.type?.id);
		return definition ? {
			kind: "checked-record", definition: definition.id.slice(5), constructor
			, fields: definition.fields.map(field => field.name)
			, arguments: structuredClone(definition.source.extensions[
				"lean-lang.org/nominal-refinements"
			].fields)
		} : null;
	};
	for(const declaration of expected.declarations)
	{
		const actual = model.exports.find(item => item.name === declaration.source.declaration);
		assert.ok(actual, declaration.id);
		const trees = declaration.source.extensions["lean-lang.org/refinements"];
		assert.deepEqual(actual.refinements, {
			parameters: declaration.parameters.map((site, index) => record(site
				, trees?.parameters[index]?.constructor ?? null))
			, result: record(declaration.result, null)
		});
	}
};

/**
 * Require all Node/Chromium loading and strictness contexts.
 *
 * @param evidence - Installed PHP-Wasm execution evidence.
 * @param route - Closed ordinary/reviewed and full/result-only route.
 */
export const checkDependentCheckedRecordPhpWasmExecutions = (evidence, route) => {
	assert.deepEqual(evidence.executions.map(item => `${item.realm}/${item.arrangement}/${item.loading}/${item.mode}`).sort(), phpWasmExecutionTuples);
	const libraries = [evidence.component.library, evidence.runtime.library].map(path => path.split("/").at(-1)).sort();
	assert.equal(new Set(libraries).size, 2);
	for(const execution of evidence.executions)
	{
		assert.deepEqual(execution.observation, dependentCheckedRecordPhpWasmExpected(route));
		assert.deepEqual(execution.phases.map(item => ({ ...item, libraries: [...item.libraries].sort() }))
			, ["ready", "autoload", "invalid", "complete"].map(stage => ({ stage
				, libraries: execution.loading === "startup" || stage === "complete" ? libraries : [] })));
	}
};
