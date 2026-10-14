/**
 * Preserve the complete nominal PHP contract and caller on the wasm32 host.
 *
 * @file
 */
import assert from "node:assert/strict";
import { basename } from "node:path";
import { reviewedContractDifference } from "../../src/analyze/reviewed-source.mjs";
import { nominalSubtypePhpRoutes, nominalSubtypePhpModes, nominalSubtypePhpCounts, nominalSubtypePhpConfiguration, nominalSubtypePhpReview, nominalSubtypePhpCaller } from "./nominal-subtype-php-fixture.mjs";
import { phpWasmExecutionTuples } from "./php-wasm-fin-fixtures.mjs";

export const nominalSubtypePhpWasmSettings = Object.freeze({
	npm: Object.freeze({ name: "lean-bridge-nominalsubtypes-wasm", version: "1.0.0" })
	, composer: Object.freeze({ name: "lean-bridge-nominalsubtypes/wasm", version: "1.0.0" })
});

/**
 * Require explicit enabled, nonempty and nonduplicated installed selections.
 *
 * @param environment - Explicit producer environment.
 */
export const nominalSubtypePhpWasmSelection = environment => {
	const prefix = "LEAN_BRIDGE_NOMINAL_SUBTYPE_PHP_WASM_", flag = environment[prefix + "TEST"];
	assert.ok(flag === undefined || flag === "0" || flag === "1");
	const enabled = flag === "1";
	const select = (name, allowed) => {
		const raw = environment[prefix + name];
		if(raw === undefined) return [...allowed];
		assert.ok(enabled, "Explicit PHP-Wasm selection requires the installed gate");
		assert.equal(typeof raw, "string");
		const selected = raw.split(",");
		assert.ok(selected.length && selected.every(item => allowed.includes(item)));
		assert.equal(new Set(selected).size, selected.length);
		return selected;
	};
	if(environment[prefix + "OUTPUT"] !== undefined)
	{
		assert.ok(enabled, "Explicit PHP-Wasm output requires the installed gate");
		assert.equal(typeof environment[prefix + "OUTPUT"], "string");
		assert.ok(environment[prefix + "OUTPUT"].length > 0);
	}
	return { enabled, routes: select("ROUTES", nominalSubtypePhpRoutes)
		, modes: select("MODES", nominalSubtypePhpModes) };
};

/**
 * Change only package targets in the independently authored PHP contract.
 *
 * @param route - Ordinary source or independent review.
 * @param mode - Full API or standalone constructor-free results.
 */
export const nominalSubtypePhpWasmConfiguration = (route, mode) => ({
	...nominalSubtypePhpConfiguration(route, mode)
	, targets: { "php-wasm": nominalSubtypePhpWasmSettings }
});

/**
 * Retain every native caller assertion and observe the actual PHP word size.
 *
 * @param mode - Full API or standalone constructor-free results.
 */
export const nominalSubtypePhpWasmExpected = mode => {
	assert.ok(nominalSubtypePhpModes.includes(mode));
	return { ...nominalSubtypePhpCounts[mode], word_bits: 32, php: "8.4.1" };
};

const entry = "if (realpath($_SERVER['SCRIPT_FILENAME']) === __FILE__) {\n    require 'vendor/autoload.php';\n";
const output = '    echo json_encode(check_nominal_subtypes($api, NOMINAL_RESULT_ONLY), JSON_THROW_ON_ERROR) . "\\n";\n}\n';
const observed = '    $observed = check_nominal_subtypes($api, NOMINAL_RESULT_ONLY);\n'
	+ '    echo json_encode([...$observed, \'word_bits\' => PHP_INT_SIZE * 8, \'php\' => PHP_VERSION], JSON_THROW_ON_ERROR) . "\\n";\n';

/**
 * Adapt only loading, lexical strictness and the final observation, never the corpus.
 * The shared Wasm driver loads the installed autoloader before including this file.
 *
 * @param source - Complete native PHP caller, including its public entry.
 * @param strictness - Weak or strict lexical caller mode.
 */
export const adaptNominalSubtypePhpWasm = (source, strictness) => {
	assert.ok(["weak", "strict"].includes(strictness));
	assert.ok(source.startsWith("<?php\ndeclare(strict_types=0);\n"));
	for(const marker of [entry, output])
		assert.ok(source.includes(marker) && source.indexOf(marker) === source.lastIndexOf(marker), marker);
	assert.ok(source.endsWith(output));
	return source.replace("declare(strict_types=0);", `declare(strict_types=${strictness === "strict" ? 1 : 0});`)
		.replace(entry, "").replace(output, observed);
};

/**
 * Load the same independent caller used by installed native PHP acceptance.
 *
 * @param route - Ordinary source or independent review.
 * @param mode - Full API or standalone constructor-free results.
 * @param strictness - Weak or strict lexical caller mode.
 */
export const nominalSubtypePhpWasmCaller = async (route, mode, strictness) => adaptNominalSubtypePhpWasm(await nominalSubtypePhpCaller(route, mode), strictness);

/**
 * Probe a real selected export with an invalid host value before lazy Lean loading.
 *
 * @param mode - Full API or standalone constructor-free results.
 * @param arrangement - Embedded npm assets or installed Composer autoloading.
 */
export const nominalSubtypePhpWasmRequest = (mode, arrangement) => {
	assert.ok(nominalSubtypePhpModes.includes(mode));
	assert.ok(["embedded", "composer"].includes(arrangement));
	const autoload = arrangement === "composer" ? "vendor/autoload.php" : `vendor/${nominalSubtypePhpWasmSettings.composer.name}/bootstrap.php`;
	return JSON.stringify({ module: "LeanNominalsubtypes", operations: { probe: mode === "full" ? "first" : "scalar" }, autoload }) + "\n";
};

// Translate the independently authored named trees, not the compiler's lowering.
const mirroredTree = tree => {
	if(tree === null || ["fin", "subtype"].includes(tree.kind)) return tree;
	if(tree.kind === "record") return { kind: "record", definition: tree.name
		, fields: tree.fields.map(field => field.name)
		, arguments: tree.fields.map(field => mirroredTree(field.refinement)) };
	if(tree.kind === "variant") return { kind: "variant", definition: tree.name
		, cases: tree.cases.map(branch => ({ name: branch.name
			, fields: branch.fields.map(field => field.name)
			, arguments: branch.fields.map(field => mirroredTree(field.refinement)) })) };
	return { kind: tree.kind, arguments: tree.arguments.map(mirroredTree) };
};

/**
 * Require fresh wasm32 compiler metadata to match every reviewed nominal site.
 *
 * @param model - Actual compiled PHP-Wasm model, not a native model relabelled as Wasm.
 * @param route - Ordinary source or independent review.
 * @param mode - Full API or standalone constructor-free results.
 */
export const checkNominalSubtypePhpWasmModel = (model, route, mode) => {
	assert.ok(nominalSubtypePhpRoutes.includes(route));
	const expected = nominalSubtypePhpReview(mode);
	assert.equal(model.profile, "php-wasm-copied-v1");
	assert.equal(model.pointerBits, 32); assert.equal(model.byteOrder, "little");
	assert.equal(model.schemaVersion, route === "reviewed" ? 3 : 2);
	assert.equal(reviewedContractDifference(expected, model.bindingIr), null);
	assert.deepEqual(model.exports.map(item => item.name).sort(), expected.declarations.map(item => item.source.declaration).sort());
	for(const declaration of expected.declarations)
	{
		const actual = model.exports.find(item => item.name === declaration.source.declaration);
		const trees = declaration.source.extensions["lean-lang.org/refinements"];
		assert.deepEqual(actual.refinements, { parameters: trees.parameters.map(mirroredTree), result: mirroredTree(trees.result) }, declaration.id);
	}
};

/**
 * Require all twelve actual host contexts, exact counts and loading phases.
 *
 * @param evidence - Original shared installer observation.
 * @param mode - Full API or standalone constructor-free results.
 */
export const checkNominalSubtypePhpWasmExecutions = (evidence, mode) => {
	assert.deepEqual(evidence.executions.map(item => `${item.realm}/${item.arrangement}/${item.loading}/${item.mode}`).sort(), phpWasmExecutionTuples);
	assert.equal(evidence.component.pointerBits, 32); assert.equal(evidence.runtime.pointerBits, 32);
	const libraries = [basename(evidence.component.library), basename(evidence.runtime.library)].sort();
	assert.equal(new Set(libraries).size, 2);
	for(const execution of evidence.executions)
	{
		assert.deepEqual(execution.observation, nominalSubtypePhpWasmExpected(mode));
		assert.deepEqual(execution.phases.map(item => ({ ...item, libraries: [...item.libraries].sort() })),
			["ready", "autoload", "invalid", "complete"].map(stage => ({ stage, libraries: execution.loading === "startup" || stage === "complete" ? libraries : [] })));
	}
};
