/**
 * Explicit PHP-Wasm selections and the independent nested checked-record caller.
 *
 * @file
 */
import assert from "node:assert/strict";
import { basename } from "node:path";
import { reviewedContractDifference } from "../../src/analyze/reviewed-source.mjs";
import { nestedCheckedRecordConfiguration, nestedCheckedRecordReview } from "./nested-checked-record-fixture.mjs";
import {
	nestedCheckedRecordPhpCaller
	, nestedCheckedRecordPhpCounts
} from "./nested-checked-record-php-fixture.mjs";
import { phpWasmExecutionTuples } from "./php-wasm-fin-fixtures.mjs";

export const nestedCheckedRecordPhpWasmRoutes = Object.freeze(["ordinary", "reviewed"]);
export const nestedCheckedRecordPhpWasmModes = Object.freeze(["full", "result-only"]);
export const nestedCheckedRecordPhpWasmSettings = Object.freeze({
	npm: Object.freeze({ name: "lean-bridge-nestedcheckedrecords-wasm", version: "1.0.0" })
	, composer: Object.freeze({ name: "lean-bridge-nestedcheckedrecords/wasm", version: "1.0.0" })
});

/**
 * Require an explicit installed gate before accepting narrowed producer work.
 *
 * @param environment - Explicit producer environment.
 */
export const nestedCheckedRecordPhpWasmSelection = environment => {
	const prefix = "LEAN_BRIDGE_NESTED_CHECKED_RECORD_PHP_WASM_";
	const flag = environment[prefix + "TEST"];
	assert.ok(flag === undefined || flag === "0" || flag === "1", "Invalid nested checked-record PHP-Wasm TEST");
	const select = (name, allowed) => {
		const raw = environment[prefix + name];
		if(raw !== undefined)
		{
			assert.equal(typeof raw, "string", `Invalid nested checked-record PHP-Wasm ${name}`);
			assert.equal(flag, "1", `Explicit nested checked-record PHP-Wasm ${name} requires TEST=1`);
		}
		const selected = raw === undefined ? [...allowed] : raw.split(",");
		assert.ok(selected.length && selected.every(value => allowed.includes(value)), `Invalid nested checked-record PHP-Wasm ${name}`);
		assert.equal(new Set(selected).size, selected.length, `Duplicate nested checked-record PHP-Wasm ${name}`);
		return selected;
	};
	for(const name of ["OUTPUT", "MAX_LOAD"])
		if(environment[prefix + name] !== undefined)
			assert.equal(flag, "1", `Explicit nested checked-record PHP-Wasm ${name} requires TEST=1`);
	return { enabled: flag === "1"
		, routes: select("ROUTES", nestedCheckedRecordPhpWasmRoutes)
		, modes: select("MODES", nestedCheckedRecordPhpWasmModes) };
};

/**
 * Select only PHP-Wasm delivery while preserving the shared author contract.
 *
 * @param route - Ordinary source or independently reviewed IR.
 * @param mode - Full or constructor-free result-only API.
 */
export const nestedCheckedRecordPhpWasmConfiguration = (route, mode) => {
	assert.ok(nestedCheckedRecordPhpWasmRoutes.includes(route));
	assert.ok(nestedCheckedRecordPhpWasmModes.includes(mode));
	return {
		...nestedCheckedRecordConfiguration(route, ["c"], mode)
		, targets: { "php-wasm": nestedCheckedRecordPhpWasmSettings }
	};
};

/**
 * Preserve the shared independently authored contract.
 *
 * @param mode - Full or constructor-free result-only API.
 */
export const nestedCheckedRecordPhpWasmReview = mode => {
	assert.ok(nestedCheckedRecordPhpWasmModes.includes(mode));
	return nestedCheckedRecordReview(mode);
};

/**
 * Require both the compiled word result and the actual Zend host width.
 *
 * @param mode - Full or constructor-free result-only API.
 */
export const nestedCheckedRecordPhpWasmExpected = mode => {
	assert.ok(nestedCheckedRecordPhpWasmModes.includes(mode));
	return { ...nestedCheckedRecordPhpCounts[mode], word_bits: 32, php: "8.4.1" };
};

const replaceExact = (source, before, after, count = 1) => {
	assert.equal(source.split(before).length - 1, count, before);
	return source.replaceAll(before, after);
};

/**
 * Retarget only host-width representations, loading and the final observation.
 * Every semantic assertion remains the independently authored native-PHP corpus.
 *
 * @param source - Complete independent native-PHP caller.
 * @param strictness - Weak or strict lexical caller mode.
 */
export const adaptNestedCheckedRecordPhpWasm = (source, strictness) => {
	assert.ok(["weak", "strict"].includes(strictness));
	assert.ok(source.startsWith("<?php\ndeclare(strict_types=0);\n"));
	const entry = "if (realpath($_SERVER['SCRIPT_FILENAME']) === __FILE__) {\n    require 'vendor/autoload.php';\n";
	const call = "check_nested_checked_records_php($api, NESTED_CHECKED_RECORD_RESULT_ONLY, NESTED_PARAMETER_PREFIX)";
	const output = `    echo json_encode(${call}, JSON_THROW_ON_ERROR) . "\\n";\n}\n`;
	const observed = `    $observed = ${call};\n`
		+ '    echo json_encode([...$observed, \'word_bits\' => PHP_INT_SIZE * 8, \'php\' => PHP_VERSION], JSON_THROW_ON_ERROR) . "\\n";\n';
	assert.ok(source.endsWith(output));
	// Every nested Nat is a BigInteger, so no word-width scalar needs adapting.
	let adapted = replaceExact(source, entry, "");
	adapted = replaceExact(adapted, output, observed);
	adapted = replaceExact(adapted, "declare(strict_types=0);", `declare(strict_types=${strictness === "strict" ? 1 : 0});`);
	return adapted;
};

/**
 * Adapt the same independent caller for both source routes.
 *
 * @param route - Ordinary source or independently reviewed IR.
 * @param mode - Full or constructor-free result-only API.
 * @param strictness - Weak or strict lexical caller mode.
 */
export const nestedCheckedRecordPhpWasmCaller = async (route, mode, strictness) =>
	adaptNestedCheckedRecordPhpWasm(await nestedCheckedRecordPhpCaller(route, mode), strictness);

/**
 * Probe a selected public function before lazy component loading.
 *
 * @param mode - Full or constructor-free result-only API.
 * @param arrangement - Embedded npm assets or Composer autoloading.
 */
export const nestedCheckedRecordPhpWasmRequest = (mode, arrangement) => {
	assert.ok(nestedCheckedRecordPhpWasmModes.includes(mode));
	assert.ok(["embedded", "composer"].includes(arrangement));
	return JSON.stringify({
		module: "LeanNestedcheckedrecords"
		, operations: { probe: mode === "full" ? "first" : "produce_option" }
		, autoload: arrangement === "composer" ? "vendor/autoload.php" : `vendor/${nestedCheckedRecordPhpWasmSettings.composer.name}/bootstrap.php`
	}) + "\n";
};

const mirroredTree = tree => {
	if(tree === null || ["fin", "subtype"].includes(tree.kind)) return tree;
	if(tree.kind === "checked-record") return {
		kind: "checked-record", definition: tree.name, constructor: tree.constructor
		, fields: tree.fields.map(field => field.name)
		, arguments: tree.fields.map(field => mirroredTree(field.refinement))
	};
	if(tree.kind === "record") return {
		kind: "record", definition: tree.name
		, fields: tree.fields.map(field => field.name)
		, arguments: tree.fields.map(field => mirroredTree(field.refinement))
	};
	if(tree.kind === "variant") return {
		kind: "variant", definition: tree.name
		, cases: tree.cases.map(branch => ({
			name: branch.name
			, fields: branch.fields.map(field => field.name)
			, arguments: branch.fields.map(field => mirroredTree(field.refinement))
		}))
	};
	return { kind: tree.kind, arguments: tree.arguments.map(mirroredTree) };
};

/**
 * Require actual wasm32 compiler metadata for every nested refinement site.
 *
 * @param model - Fresh PHP-Wasm compiler model.
 * @param route - Ordinary source or independently reviewed IR.
 * @param mode - Full or constructor-free result-only API.
 */
export const checkNestedCheckedRecordPhpWasmModel = (model, route, mode) => {
	const expected = nestedCheckedRecordPhpWasmReview(mode);
	assert.ok(nestedCheckedRecordPhpWasmRoutes.includes(route));
	assert.equal(model.profile, "php-wasm-copied-v1");
	assert.equal(model.pointerBits, 32); assert.equal(model.byteOrder, "little");
	assert.equal(model.schemaVersion, route === "reviewed" ? 3 : 2);
	assert.equal(reviewedContractDifference(expected, model.bindingIr), null);
	assert.equal(model.exports.length, mode === "full" ? 13 : 2);
	assert.deepEqual(model.exports.map(item => item.name).sort(), expected.declarations.map(item => item.id.slice(5)).sort());
	for(const declaration of expected.declarations)
	{
		const actual = model.exports.find(item => item.name === declaration.id.slice(5));
		// Every nested export carries a refinement tree, including constructor-free results.
		const trees = declaration.source.extensions["lean-lang.org/refinements"]; assert.ok(trees, declaration.id);
		assert.deepEqual(actual.refinements, {
			parameters: trees.parameters.map(mirroredTree)
			, result: mirroredTree(trees.result)
		}, declaration.id);
		assert.doesNotMatch(JSON.stringify(actual.refinements.result), /NestedCheckedRecords\.(?:mk|normalize)(?:Packet|Word)"/u);
	}
};

/**
 * Require all twelve actual Node/Chromium, package, loading and strictness contexts.
 *
 * @param evidence - Original installed PHP-Wasm observation.
 * @param mode - Full or constructor-free result-only API.
 */
export const checkNestedCheckedRecordPhpWasmExecutions = (evidence, mode) => {
	assert.deepEqual(evidence.executions.map(item => `${item.realm}/${item.arrangement}/${item.loading}/${item.mode}`).sort(), phpWasmExecutionTuples);
	assert.equal(evidence.component.pointerBits, 32); assert.equal(evidence.runtime.pointerBits, 32);
	const libraries = [basename(evidence.component.library), basename(evidence.runtime.library)].sort();
	assert.equal(new Set(libraries).size, 2);
	for(const execution of evidence.executions)
	{
		assert.deepEqual(execution.observation, nestedCheckedRecordPhpWasmExpected(mode));
		assert.deepEqual(execution.phases.map(item => ({ ...item, libraries: [...item.libraries].sort() })),
			["ready", "autoload", "invalid", "complete"].map(stage => ({
				stage
				, libraries: execution.loading === "startup" || stage === "complete" ? libraries : []
			}))
		);
	}
};
