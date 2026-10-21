/**
 * PHP-Wasm source contract for proof-erased checked records with closed value
 * indices. Installed evidence is deliberately separate.
 *
 * @file
 */
import assert from "node:assert/strict";
import { reviewedContractDifference } from "../../src/analyze/reviewed-source.mjs";
import {
	zeroPayloadPhpCaller, zeroPayloadPhpExpected, zeroPayloadPhpRoutes, zeroPayloadPhpSelection
} from "./zero-payload-checked-record-php-fixture.mjs";
import { phpWasmExecutionTuples } from "./php-wasm-fin-fixtures.mjs";

export const zeroPayloadPhpWasmSettings = Object.freeze({
	npm: Object.freeze({ name: "lean-bridge-zeropayloadcheckedrecords-wasm", version: "1.0.0" })
	, composer: Object.freeze({ name: "lean-bridge-zeropayloadcheckedrecords/wasm", version: "1.0.0" })
});

/**
 * Keep the independently authored four-route contract while selecting PHP-Wasm only.
 *
 * @param route - Closed ordinary/reviewed and full/result-only route.
 */
export const zeroPayloadPhpWasmSelection = route => {
	assert.ok(zeroPayloadPhpRoutes.includes(route));
	const selected = zeroPayloadPhpSelection(route);
	return { ...selected, configuration: { ...selected.configuration
		, targets: { "php-wasm": zeroPayloadPhpWasmSettings } } };
};

/**
 * Record the actual wasm32 host rather than silently assuming native-PHP facts.
 *
 * @param route - Closed ordinary/reviewed and full/result-only route.
 */
export const zeroPayloadPhpWasmExpected = route => ({
	...zeroPayloadPhpExpected(route), word_bits: 32, php: "8.4.1"
});

const loader = "if (!class_exists('LeanZeropayloadcheckedrecords\\\\Witness')) {\n"
	+ "    require __DIR__ . '/vendor/autoload.php';\n}\n\n";
const entry = "if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) {\n"
	+ "    $resultOnly = in_array('--result-only', $argv, true);\n"
	+ "    $reviewed = in_array('--reviewed', $argv, true);\n"
	+ "    echo json_encode(check_zero_payload_records($resultOnly, $reviewed ? 'value' : 'arg'), JSON_THROW_ON_ERROR) . \"\\n\";\n}\n";

/**
 * Let the shared PHP-Wasm driver load the selected public autoloader, then
 * execute exactly the native caller's assertions under the requested lexical
 * strictness. The route is explicit: the driver supplies no CLI arguments.
 *
 * @param source - Complete immutable native-PHP caller source.
 * @param route - Closed ordinary/reviewed and full/result-only route.
 * @param strictness - Weak or strict lexical PHP caller mode.
 */
export const adaptZeroPayloadPhpWasm = (source, route, strictness) => {
	const { resultOnly, reviewed } = zeroPayloadPhpWasmSelection(route);
	assert.ok(["weak", "strict"].includes(strictness));
	assert.ok(source.startsWith("<?php\ndeclare(strict_types=0);\n"));
	for(const marker of [loader, entry])
		assert.ok(source.includes(marker) && source.indexOf(marker) === source.lastIndexOf(marker), marker);
	assert.ok(source.endsWith(entry));
	const observed = "    $observed = check_zero_payload_records("
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
export const zeroPayloadPhpWasmCaller = async (route, strictness) =>
	adaptZeroPayloadPhpWasm(await zeroPayloadPhpCaller(), route, strictness);

/**
 * Probe an actual selected public export before lazy Lean loading.
 *
 * @param route - Closed ordinary/reviewed and full/result-only route.
 * @param arrangement - Embedded npm or installed Composer autoloading.
 */
export const zeroPayloadPhpWasmRequest = (route, arrangement) => {
	const { resultOnly } = zeroPayloadPhpWasmSelection(route);
	assert.ok(["embedded", "composer"].includes(arrangement));
	const autoload = arrangement === "composer" ? "vendor/autoload.php"
		: `vendor/${zeroPayloadPhpWasmSettings.composer.name}/bootstrap.php`;
	return JSON.stringify({
		module: "LeanZeropayloadcheckedrecords"
		, operations: { probe: resultOnly ? "produce_witness" : "witness_count" }
		, autoload
	}) + "\n";
};

const erasedProofsKey = "lean-lang.org/erased-proofs";
const refinementsKey = "lean-lang.org/refinements";

/**
 * Derive the exact compiled refinement tree of one declaration from the
 * independently authored binding IR: checked records name their definition,
 * constructor and fields, nested carriers keep their argument trees, and a
 * declaration without checked sites carries no refinements at all.
 *
 * @param expected - Independently authored binding IR.
 * @param declaration - One exported declaration of that IR.
 */
export const zeroPayloadPhpWasmRefinements = (expected, declaration) => {
	const definition = id => expected.types.find(item => item.id === id);
	const tree = (reference, site, nested) => {
		if(reference.kind === "apply")
		{
			const child = tree(reference.arguments[0], site?.arguments?.[0] ?? null, true);
			return child === null ? null : { kind: reference.constructor, arguments: [child] };
		}
		if(reference.kind !== "named") return null;
		const type = definition(reference.id);
		assert.ok(type, reference.id);
		if(type.kind === "record")
		{
			const args = type.fields.map(field => tree(field.type, null, true));
			const checked = Object.hasOwn(type.source.extensions, erasedProofsKey);
			if(!checked && args.every(child => child === null)) return null;
			const value = {
				kind: checked ? "checked-record" : "record", definition: type.id.slice(5)
				, ...(checked ? { constructor: site?.constructor ?? null } : {})
				, fields: type.fields.map(field => field.name)
			};
			return nested || args.some(child => child !== null) ? { ...value, arguments: args } : value;
		}
		if(type.kind === "variant")
		{
			const cases = type.cases.map((branch, index) => ({
				name: branch.name, fields: branch.fields.map(field => field.name)
				, arguments: branch.fields.map((field, position) => tree(field.type
					, site?.cases?.[index]?.fields?.[position]?.refinement ?? null, true))
			}));
			return cases.flatMap(branch => branch.arguments).every(child => child === null)
				? null : { kind: "variant", definition: type.id.slice(5), cases };
		}
		return null;
	};
	const sites = declaration.source.extensions[refinementsKey];
	const parameters = declaration.parameters.map((site, index) =>
		tree(site.type, sites?.parameters[index] ?? null, false));
	const result = declaration.result ? tree(declaration.result.type, sites?.result ?? null, false) : null;
	return parameters.every(item => item === null) && result === null ? undefined : { parameters, result };
};

/**
 * Require freshly compiled wasm32 metadata, never a relabelled native model.
 *
 * @param model - Actual generated PHP-Wasm component model.
 * @param route - Closed ordinary/reviewed and full/result-only route.
 */
export const checkZeroPayloadPhpWasmModel = (model, route) => {
	const { expected, reviewed } = zeroPayloadPhpWasmSelection(route);
	assert.equal(model.profile, "php-wasm-copied-v1");
	assert.equal(model.pointerBits, 32); assert.equal(model.byteOrder, "little");
	assert.equal(model.schemaVersion, reviewed ? 3 : 2);
	assert.equal(reviewedContractDifference(expected, model.bindingIr), null);
	assert.equal(model.exports.length, expected.declarations.length);
	for(const declaration of expected.declarations)
	{
		const actual = model.exports.find(item => item.name === declaration.source.declaration);
		assert.ok(actual, declaration.id);
		assert.deepEqual(actual.refinements, zeroPayloadPhpWasmRefinements(expected, declaration));
	}
};

/**
 * Require all Node/Chromium loading and strictness contexts.
 *
 * @param evidence - Installed PHP-Wasm execution evidence.
 * @param route - Closed ordinary/reviewed and full/result-only route.
 */
export const checkZeroPayloadPhpWasmExecutions = (evidence, route) => {
	assert.deepEqual(evidence.executions.map(item => `${item.realm}/${item.arrangement}/${item.loading}/${item.mode}`).sort(), phpWasmExecutionTuples);
	const libraries = [evidence.component.library, evidence.runtime.library].map(path => path.split("/").at(-1)).sort();
	assert.equal(new Set(libraries).size, 2);
	for(const execution of evidence.executions)
	{
		assert.deepEqual(execution.observation, zeroPayloadPhpWasmExpected(route));
		assert.deepEqual(execution.phases.map(item => ({ ...item, libraries: [...item.libraries].sort() }))
			, ["ready", "autoload", "invalid", "complete"].map(stage => ({ stage
				, libraries: execution.loading === "startup" || stage === "complete" ? libraries : [] })));
	}
};
