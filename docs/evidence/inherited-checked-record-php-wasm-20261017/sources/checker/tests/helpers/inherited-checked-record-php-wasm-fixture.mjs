/**
 * Explicit PHP-Wasm selections and the independent inherited checked-record caller.
 *
 * @file
 */
import assert from "node:assert/strict";
import { basename } from "node:path";
import { reviewedContractDifference } from "../../src/analyze/reviewed-source.mjs";
import {
	inheritedCheckedRecordNpmSelection
} from "./inherited-checked-record-npm-fixture.mjs";
import {
	inheritedCheckedRecordPhpCaller
	, inheritedCheckedRecordPhpCounts
} from "./inherited-checked-record-php-fixture.mjs";
import { phpWasmExecutionTuples } from "./php-wasm-fin-fixtures.mjs";

export const inheritedCheckedRecordPhpWasmRoutes = Object.freeze(["ordinary", "reviewed"]);
export const inheritedCheckedRecordPhpWasmModes = Object.freeze(["full", "result-only"]);
/** Exclusive producer host-load ceilings; the default remains eight. */
export const inheritedCheckedRecordPhpWasmLoadCeilings = Object.freeze([8, 12, 16, 20]);
export const inheritedCheckedRecordPhpWasmSettings = Object.freeze({
	npm: Object.freeze({ name: "lean-bridge-inheritedcheckedrecords-wasm", version: "1.0.0" })
	, composer: Object.freeze({ name: "lean-bridge-inheritedcheckedrecords/wasm", version: "1.0.0" })
});

/**
 * Require an explicit installed gate before accepting narrowed producer work.
 *
 * @param environment - Explicit producer environment.
 */
export const inheritedCheckedRecordPhpWasmSelection = environment => {
	const prefix = "LEAN_BRIDGE_INHERITED_CHECKED_RECORD_PHP_WASM_";
	const flag = environment[prefix + "TEST"];
	assert.ok(flag === undefined || ["0", "1"].includes(flag)
		, "Invalid inherited checked-record PHP-Wasm TEST");
	const select = (name, allowed) => {
		const raw = environment[prefix + name];
		if(raw !== undefined)
		{
			assert.equal(typeof raw, "string"
				, `Invalid inherited checked-record PHP-Wasm ${name}`);
			assert.equal(flag, "1"
				, `Explicit inherited checked-record PHP-Wasm ${name} requires TEST=1`);
		}
		const selected = raw === undefined ? [...allowed] : raw.split(",");
		assert.ok(selected.length && selected.every(value => allowed.includes(value))
			, `Invalid inherited checked-record PHP-Wasm ${name}`);
		assert.equal(new Set(selected).size, selected.length
			, `Duplicate inherited checked-record PHP-Wasm ${name}`);
		return selected;
	};
	for(const name of ["OUTPUT", "MAX_LOAD"])
		if(environment[prefix + name] !== undefined)
			assert.equal(flag, "1"
				, `Explicit inherited checked-record PHP-Wasm ${name} requires TEST=1`);
	const rawLoad = environment[prefix + "MAX_LOAD"];
	if(rawLoad !== undefined)
		assert.equal(typeof rawLoad, "string"
			, "Invalid inherited checked-record PHP-Wasm MAX_LOAD");
	const maxLoad = rawLoad === undefined ? 8 : Number(rawLoad);
	assert.ok(inheritedCheckedRecordPhpWasmLoadCeilings.includes(maxLoad)
		, `Inherited checked-record PHP-Wasm max load must be one of ${inheritedCheckedRecordPhpWasmLoadCeilings.join(", ")}`);
	return {
		enabled: flag === "1"
		, routes: select("ROUTES", inheritedCheckedRecordPhpWasmRoutes)
		, modes: select("MODES", inheritedCheckedRecordPhpWasmModes)
		, maxLoad
	};
};

const selected = (route, mode) => {
	assert.ok(inheritedCheckedRecordPhpWasmRoutes.includes(route));
	assert.ok(inheritedCheckedRecordPhpWasmModes.includes(mode));
	return inheritedCheckedRecordNpmSelection(`${route}-${mode}`);
};

/**
 * Select only PHP-Wasm delivery while preserving the shared author contract.
 *
 * @param route - Ordinary source or independently reviewed IR.
 * @param mode - Full or constructor-free result-only API.
 */
export const inheritedCheckedRecordPhpWasmConfiguration = (route, mode) => {
	const { configuration } = selected(route, mode);
	return {
		...configuration
		, targets: { "php-wasm": inheritedCheckedRecordPhpWasmSettings }
	};
};

/**
 * Preserve the independently authored full or result-only contract.
 *
 * @param mode - Full or constructor-free result-only API.
 */
export const inheritedCheckedRecordPhpWasmReview = mode => {
	assert.ok(inheritedCheckedRecordPhpWasmModes.includes(mode));
	return inheritedCheckedRecordNpmSelection(`ordinary-${mode}`).expected;
};

/**
 * Require the complete caller counters and the actual Zend host width.
 *
 * @param mode - Full or constructor-free result-only API.
 */
export const inheritedCheckedRecordPhpWasmExpected = mode => {
	assert.ok(inheritedCheckedRecordPhpWasmModes.includes(mode));
	return { ...inheritedCheckedRecordPhpCounts[mode], word_bits: 32, php: "8.4.1" };
};

const replaceExact = (source, before, after) => {
	assert.equal(source.split(before).length - 1, 1, before);
	return source.replace(before, after);
};

/**
 * Retarget only host loading, lexical strictness and the final observation.
 * Every semantic assertion remains in the independent native-PHP caller.
 *
 * @param source - Complete independent native-PHP caller.
 * @param strictness - Weak or strict lexical caller mode.
 */
export const adaptInheritedCheckedRecordPhpWasm = (source, strictness) => {
	assert.ok(["weak", "strict"].includes(strictness));
	assert.ok(source.startsWith("<?php\ndeclare(strict_types=0);\n"));
	const entry = "if (realpath($_SERVER['SCRIPT_FILENAME']) === __FILE__) {\n"
		+ "    require 'vendor/autoload.php';\n";
	const call = "check_inherited_checked_records_php(\n"
		+ "        $api,\n"
		+ "        INHERITED_CHECKED_RECORD_RESULT_ONLY,\n"
		+ "        INHERITED_PARAMETER_PREFIX\n"
		+ "    )";
	const output = `    echo json_encode(${call}, JSON_THROW_ON_ERROR) . "\\n";\n}\n`;
	const observed = `    $observed = ${call};\n`
		+ "    echo json_encode([...$observed, 'word_bits' => PHP_INT_SIZE * 8, 'php' => PHP_VERSION], JSON_THROW_ON_ERROR) . \"\\n\";\n";
	assert.ok(source.endsWith(output));
	let adapted = replaceExact(source, entry, "");
	adapted = replaceExact(adapted, output, observed);
	return replaceExact(adapted, "declare(strict_types=0);"
		, `declare(strict_types=${strictness === "strict" ? 1 : 0});`);
};

/**
 * Adapt the same independent caller for every source route and API mode.
 *
 * @param route - Ordinary or independently reviewed source route.
 * @param mode - Full or constructor-free result-only API.
 * @param strictness - Weak or strict lexical caller mode.
 */
export const inheritedCheckedRecordPhpWasmCaller = async (route, mode, strictness) =>
	adaptInheritedCheckedRecordPhpWasm(
		await inheritedCheckedRecordPhpCaller(route, mode), strictness
	);

/**
 * Probe one selected function before lazy component loading.
 *
 * @param mode - Full or constructor-free result-only API.
 * @param arrangement - Embedded npm assets or Composer autoloading.
 */
export const inheritedCheckedRecordPhpWasmRequest = (mode, arrangement) => {
	assert.ok(inheritedCheckedRecordPhpWasmModes.includes(mode));
	assert.ok(["embedded", "composer"].includes(arrangement));
	return JSON.stringify({
		module: "LeanInheritedcheckedrecords"
		, operations: { probe: mode === "full" ? "first" : "produce" }
		, autoload: arrangement === "composer" ? "vendor/autoload.php"
			: `vendor/${inheritedCheckedRecordPhpWasmSettings.composer.name}/bootstrap.php`
	}) + "\n";
};

/**
 * Construct the exact installed-corpus consumer from authenticated sources.
 *
 * @param mode - Full or constructor-free result-only API.
 * @param sources - Adapted weak and strict callers.
 */
export const inheritedCheckedRecordPhpWasmConsumerFixture = (mode, sources) => {
	assert.ok(inheritedCheckedRecordPhpWasmModes.includes(mode));
	assert.deepEqual(Object.keys(sources).sort(), ["strict", "weak"]);
	for(const source of Object.values(sources)) assert.equal(typeof source, "string");
	return Object.freeze({
		settings: inheritedCheckedRecordPhpWasmSettings
		, source: strictness => {
			assert.ok(Object.hasOwn(sources, strictness)); return sources[strictness];
		}
		, request: arrangement => inheritedCheckedRecordPhpWasmRequest(mode, arrangement)
		, removeHandoff: true
	});
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
 * Require actual wasm32 metadata for every inherited refinement site.
 *
 * @param model - Fresh PHP-Wasm compiler model.
 * @param route - Ordinary source or independently reviewed IR.
 * @param mode - Full or constructor-free result-only API.
 */
export const checkInheritedCheckedRecordPhpWasmModel = (model, route, mode) => {
	const expected = inheritedCheckedRecordPhpWasmReview(mode);
	assert.ok(inheritedCheckedRecordPhpWasmRoutes.includes(route));
	assert.equal(model.profile, "php-wasm-copied-v1");
	assert.equal(model.pointerBits, 32); assert.equal(model.byteOrder, "little");
	assert.equal(model.schemaVersion, route === "reviewed" ? 3 : 2);
	assert.equal(reviewedContractDifference(expected, model.bindingIr), null);
	assert.equal(model.exports.length, mode === "full" ? 8 : 2);
	assert.deepEqual(model.exports.map(item => item.name).sort()
		, expected.declarations.map(item => item.id.slice(5)).sort());
	for(const declaration of expected.declarations)
	{
		const actual = model.exports.find(item => item.name === declaration.id.slice(5));
		const trees = declaration.source.extensions["lean-lang.org/refinements"];
		assert.ok(trees, declaration.id);
		assert.deepEqual(actual.refinements, {
			parameters: trees.parameters.map(mirroredTree)
			, result: mirroredTree(trees.result)
		}, declaration.id);
		assert.doesNotMatch(JSON.stringify(actual.refinements.result)
			, /InheritedCheckedRecords\.(?:mk|normalize)(?:Span|Ticket|Stamped|Word)"/u);
	}
};

/**
 * Require all twelve Node/Chromium, package, loading and strictness contexts.
 *
 * @param evidence - Original installed PHP-Wasm observation.
 * @param mode - Full or constructor-free result-only API.
 */
export const checkInheritedCheckedRecordPhpWasmExecutions = (evidence, mode) => {
	assert.deepEqual(evidence.executions.map(item =>
		`${item.realm}/${item.arrangement}/${item.loading}/${item.mode}`).sort()
	, phpWasmExecutionTuples);
	assert.equal(evidence.component.pointerBits, 32);
	assert.equal(evidence.runtime.pointerBits, 32);
	const libraries = [basename(evidence.component.library)
		, basename(evidence.runtime.library)].sort();
	assert.equal(new Set(libraries).size, 2);
	for(const execution of evidence.executions)
	{
		assert.deepEqual(execution.observation
			, inheritedCheckedRecordPhpWasmExpected(mode));
		assert.deepEqual(execution.phases.map(item => ({
			...item, libraries: [...item.libraries].sort()
		})), ["ready", "autoload", "invalid", "complete"].map(stage => ({
			stage
			, libraries: execution.loading === "startup" || stage === "complete"
				? libraries : []
		})));
	}
};
