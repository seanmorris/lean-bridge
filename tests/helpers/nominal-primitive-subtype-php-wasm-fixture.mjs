/**
 * Explicit PHP-Wasm selections and independent nineteen-base nominal caller.
 *
 * @file
 */
import assert from "node:assert/strict";
import { basename } from "node:path";
import { reviewedContractDifference } from "../../src/analyze/reviewed-source.mjs";
import {
	nominalPrimitiveSubtypeConfiguration
	, nominalPrimitiveSubtypeReview
} from "./nominal-primitive-subtype-fixture.mjs";
import {
	nominalPrimitiveSubtypePhpCaller
	, nominalPrimitiveSubtypePhpCounts
} from "./nominal-primitive-subtype-php-fixture.mjs";
import { phpWasmExecutionTuples } from "./php-wasm-fin-fixtures.mjs";

export const nominalPrimitiveSubtypePhpWasmRoutes = Object.freeze(["ordinary", "reviewed"]);
export const nominalPrimitiveSubtypePhpWasmModes = Object.freeze(["full", "result-only"]);
export const nominalPrimitiveSubtypePhpWasmSettings = Object.freeze({
	npm: Object.freeze({ name: "lean-bridge-nominalprimitivesubtypes-wasm", version: "1.0.0" })
	, composer: Object.freeze({ name: "lean-bridge-nominalprimitivesubtypes/wasm", version: "1.0.0" })
});

/**
 * Require an explicit installed gate before accepting narrowed producer work.
 *
 * @param environment - Explicit producer environment.
 */
export const nominalPrimitiveSubtypePhpWasmSelection = environment => {
	const prefix = "LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_PHP_WASM_";
	const flag = environment[prefix + "TEST"];
	assert.ok(flag === undefined || flag === "0" || flag === "1", "Invalid primitive-base nominal PHP-Wasm TEST");
	const select = (name, allowed) => {
		const raw = environment[prefix + name];
		if(raw !== undefined)
		{
			assert.equal(typeof raw, "string", `Invalid primitive-base nominal PHP-Wasm ${name}`);
			assert.equal(flag, "1", `Explicit primitive-base nominal PHP-Wasm ${name} requires TEST=1`);
		}
		const selected = raw === undefined ? [...allowed] : raw.split(",");
		assert.ok(selected.length && selected.every(value => allowed.includes(value)), `Invalid primitive-base nominal PHP-Wasm ${name}`);
		assert.equal(new Set(selected).size, selected.length, `Duplicate primitive-base nominal PHP-Wasm ${name}`);
		return selected;
	};
	for(const name of ["OUTPUT", "MAX_LOAD"])
		if(environment[prefix + name] !== undefined)
			assert.equal(flag, "1", `Explicit primitive-base nominal PHP-Wasm ${name} requires TEST=1`);
	return { enabled: flag === "1"
		, routes: select("ROUTES", nominalPrimitiveSubtypePhpWasmRoutes)
		, modes: select("MODES", nominalPrimitiveSubtypePhpWasmModes) };
};

/**
 * Select only PHP-Wasm delivery while preserving the shared author contract.
 *
 * @param route - Ordinary source or independently reviewed IR.
 * @param mode - Full or constructor-free result-only API.
 */
export const nominalPrimitiveSubtypePhpWasmConfiguration = (route, mode) => {
	assert.ok(nominalPrimitiveSubtypePhpWasmRoutes.includes(route));
	assert.ok(nominalPrimitiveSubtypePhpWasmModes.includes(mode));
	return {
		...nominalPrimitiveSubtypeConfiguration(route, ["c"], mode === "result-only")
		, targets: { "php-wasm": nominalPrimitiveSubtypePhpWasmSettings }
	};
};

/**
 * Preserve the shared independently authored contract.
 *
 * @param mode - Full or constructor-free result-only API.
 */
export const nominalPrimitiveSubtypePhpWasmReview = mode => {
	assert.ok(nominalPrimitiveSubtypePhpWasmModes.includes(mode));
	return nominalPrimitiveSubtypeReview(mode === "result-only");
};

/**
 * Require both the compiled word result and the actual Zend host width.
 *
 * @param mode - Full or constructor-free result-only API.
 */
export const nominalPrimitiveSubtypePhpWasmExpected = mode => {
	assert.ok(nominalPrimitiveSubtypePhpWasmModes.includes(mode));
	return { ...nominalPrimitiveSubtypePhpCounts[mode], wordBits: 32, word_bits: 32, php: "8.4.1" };
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
export const adaptNominalPrimitiveSubtypePhpWasm = (source, strictness) => {
	assert.ok(["weak", "strict"].includes(strictness));
	assert.ok(source.startsWith("<?php\ndeclare(strict_types=0);\n"));
	const entry = "if (realpath($_SERVER['SCRIPT_FILENAME']) === __FILE__) {\n    require 'vendor/autoload.php';\n";
	const output = '    echo json_encode(check_nominal_primitive_subtypes_php($api, NOMINAL_PRIMITIVE_RESULT_ONLY), JSON_THROW_ON_ERROR) . "\\n";\n}\n';
	const observed = '    $observed = check_nominal_primitive_subtypes_php($api, NOMINAL_PRIMITIVE_RESULT_ONLY);\n'
		+ '    echo json_encode([...$observed, \'word_bits\' => PHP_INT_SIZE * 8, \'php\' => PHP_VERSION], JSON_THROW_ON_ERROR) . "\\n";\n';
	assert.ok(source.endsWith(output));
	let adapted = source;
	const keyedBigInteger = name => {
		const pattern = new RegExp(`('${name}' => )(-?[0-9]+)`, "gu");
		const matches = [...adapted.matchAll(pattern)];
		assert.ok(matches.length >= 4, `Missing ${name} scalar cases`);
		adapted = adapted.replace(pattern, "$1$n($2)");
	};
	keyedBigInteger("uint32Value"); keyedBigInteger("int64Value");
	adapted = replaceExact(adapted, "$call('word_bits', [], 64);", "$call('word_bits', [], $n(32));");
	adapted = replaceExact(adapted, "['uint32Value', 4294967294, 0]", "['uint32Value', $n('4294967294'), $n(0)]");
	adapted = replaceExact(adapted, "['int64Value', PHP_INT_MAX - 1, PHP_INT_MIN]", "['int64Value', $n('9223372036854775806'), $n('-9223372036854775808')]");
	adapted = replaceExact(adapted, "['int32Value', 2147483646, -2147483648]", "['int32Value', 2147483646, PHP_INT_MIN]");
	adapted = replaceExact(adapted, "['usizeValue', $n('18446744073709551614'), $n(0)]", "['usizeValue', $n('4294967294'), $n(0)]");
	adapted = replaceExact(adapted, "['isizeValue', PHP_INT_MAX - 1, PHP_INT_MIN]", "['isizeValue', 2147483646, PHP_INT_MIN]");
	adapted = replaceExact(adapted, "+ ['wordBits' => 64]", "+ ['wordBits' => 32]", 2);
	adapted = replaceExact(adapted, entry, "");
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
export const nominalPrimitiveSubtypePhpWasmCaller = async (route, mode, strictness) =>
	adaptNominalPrimitiveSubtypePhpWasm(await nominalPrimitiveSubtypePhpCaller(route, mode), strictness);

/**
 * Probe a selected public function before lazy component loading.
 *
 * @param mode - Full or constructor-free result-only API.
 * @param arrangement - Embedded npm assets or Composer autoloading.
 */
export const nominalPrimitiveSubtypePhpWasmRequest = (mode, arrangement) => {
	assert.ok(nominalPrimitiveSubtypePhpWasmModes.includes(mode));
	assert.ok(["embedded", "composer"].includes(arrangement));
	return JSON.stringify({
		module: "LeanNominalprimitivesubtypes"
		, operations: { probe: mode === "full" ? "echo_a" : "produce" }
		, autoload: arrangement === "composer" ? "vendor/autoload.php" : `vendor/${nominalPrimitiveSubtypePhpWasmSettings.composer.name}/bootstrap.php`
	}) + "\n";
};

const mirroredTree = tree => {
	if(tree === null || ["fin", "subtype"].includes(tree.kind)) return tree;
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
 * Require actual wasm32 compiler metadata for every nominal refinement site.
 *
 * @param model - Fresh PHP-Wasm compiler model.
 * @param route - Ordinary source or independently reviewed IR.
 * @param mode - Full or constructor-free result-only API.
 */
export const checkNominalPrimitiveSubtypePhpWasmModel = (model, route, mode) => {
	const expected = nominalPrimitiveSubtypePhpWasmReview(mode);
	assert.ok(nominalPrimitiveSubtypePhpWasmRoutes.includes(route));
	assert.equal(model.profile, "php-wasm-copied-v1");
	assert.equal(model.pointerBits, 32); assert.equal(model.byteOrder, "little");
	assert.equal(model.schemaVersion, route === "reviewed" ? 3 : 2);
	assert.equal(reviewedContractDifference(expected, model.bindingIr), null);
	assert.deepEqual(model.exports.map(item => item.name).sort(), expected.declarations.map(item => item.id.slice(5)).sort());
	for(const declaration of expected.declarations)
	{
		const actual = model.exports.find(item => item.name === declaration.id.slice(5));
		const trees = declaration.source.extensions["lean-lang.org/refinements"];
		if(trees === undefined)
		{
			assert.equal(declaration.id, "lean:NominalPrimitiveSubtypes.wordBits");
			assert.equal(actual.refinements, undefined);
		}
		else assert.deepEqual(actual.refinements, {
			parameters: trees.parameters.map(mirroredTree)
			, result: mirroredTree(trees.result)
		}, declaration.id);
	}
};

/**
 * Require all twelve actual Node/Chromium, package, loading and strictness contexts.
 *
 * @param evidence - Original installed PHP-Wasm observation.
 * @param mode - Full or constructor-free result-only API.
 */
export const checkNominalPrimitiveSubtypePhpWasmExecutions = (evidence, mode) => {
	assert.deepEqual(evidence.executions.map(item => `${item.realm}/${item.arrangement}/${item.loading}/${item.mode}`).sort(), phpWasmExecutionTuples);
	assert.equal(evidence.component.pointerBits, 32); assert.equal(evidence.runtime.pointerBits, 32);
	const libraries = [basename(evidence.component.library), basename(evidence.runtime.library)].sort();
	assert.equal(new Set(libraries).size, 2);
	for(const execution of evidence.executions)
	{
		assert.deepEqual(execution.observation, nominalPrimitiveSubtypePhpWasmExpected(mode));
		assert.deepEqual(execution.phases.map(item => ({ ...item, libraries: [...item.libraries].sort() })),
			["ready", "autoload", "invalid", "complete"].map(stage => ({
				stage
				, libraries: execution.loading === "startup" || stage === "complete" ? libraries : []
			}))
		);
	}
};
