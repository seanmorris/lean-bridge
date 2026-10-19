/**
 * Explicit PHP-Wasm selections and the independent recursive checked-record caller.
 * The caller is the unchanged native-PHP corpus; only host entry and observation adapt.
 *
 * @file
 */
import assert from "node:assert/strict";
import { basename } from "node:path";
import { readFile } from "node:fs/promises";
import { reviewedContractDifference } from "../../src/analyze/reviewed-source.mjs";
import {
	mutualCheckedRecordConfiguration, mutualCheckedRecordFixtureRoot
	, mutualCheckedRecordModule, mutualCheckedRecordRefinements, mutualCheckedRecordReview
} from "./mutual-checked-record-fixture.mjs";
import {
	recursiveCheckedRecordConfiguration, recursiveCheckedRecordFixtureRoot
	, recursiveCheckedRecordModule, recursiveCheckedRecordRefinements, recursiveCheckedRecordReview
} from "./recursive-checked-record-fixture.mjs";
import { phpWasmExecutionTuples } from "./php-wasm-fin-fixtures.mjs";

export const recursiveCheckedRecordPhpWasmRoutes = Object.freeze(["ordinary", "reviewed"]);
export const recursiveCheckedRecordPhpWasmFixtures = Object.freeze(["recursive", "mutual"]);
/** Exclusive producer host-load ceilings a run may record; the default stays 8. */
export const recursiveCheckedRecordPhpWasmLoadCeilings = Object.freeze([8, 12, 16, 20]);
/** The shared native-PHP caller; PHP-Wasm carries the identical blob and never forks it. */
export const recursiveCheckedRecordPhpWasmCaller = "tests/fixtures/recursive-checked-record-consumers/php-native.php";
export const recursiveCheckedRecordPhpWasmCallerBlob = "dfaf8e4953fedaf3a2686d1af46e473d2d5787a3";
const fixtures = {
	recursive: {
		root: recursiveCheckedRecordFixtureRoot
		, module: recursiveCheckedRecordModule
		, review: recursiveCheckedRecordReview
		, configuration: recursiveCheckedRecordConfiguration
		, refinements: recursiveCheckedRecordRefinements
	}
	, mutual: {
		root: mutualCheckedRecordFixtureRoot
		, module: mutualCheckedRecordModule
		, review: mutualCheckedRecordReview
		, configuration: mutualCheckedRecordConfiguration
		, refinements: mutualCheckedRecordRefinements
	}
};
/** Independent caller totals per execution, identical to native PHP because the surface is. */
export const recursiveCheckedRecordPhpWasmCounts = Object.freeze({
	recursive: Object.freeze({
		checks: 1097, hostRejections: 82, module: "recursive", recoveries: 64
		, rejections: 144, rounds: 64, snapshotControls: 9, snapshots: 499
	})
	, mutual: Object.freeze({
		checks: 1114, hostRejections: 84, module: "mutual", recoveries: 64
		, rejections: 144, rounds: 64, snapshotControls: 12, snapshots: 505
	})
});

/**
 * Exact npm and Composer coordinates and the public namespace for one module.
 *
 * @param fixture - Selected module.
 */
export const recursiveCheckedRecordPhpWasmPackage = fixture => {
	assert.ok(recursiveCheckedRecordPhpWasmFixtures.includes(fixture));
	const name = `${fixture}checkedrecords`;
	return Object.freeze({
		settings: Object.freeze({
			npm: Object.freeze({ name: `lean-bridge-${name}-wasm`, version: "1.0.0" })
			, composer: Object.freeze({ name: `lean-bridge-${name}/wasm`, version: "1.0.0" })
		})
		, namespace: `Lean${name[0].toUpperCase()}${name.slice(1)}`
		, root: fixtures[fixture].root, leanModule: fixtures[fixture].module
	});
};

/**
 * Require an explicit installed gate before accepting narrowed producer work.
 *
 * @param environment - Explicit producer environment.
 */
export const recursiveCheckedRecordPhpWasmSelection = environment => {
	const prefix = "LEAN_BRIDGE_RECURSIVE_CHECKED_RECORD_PHP_WASM_", flag = environment[prefix + "TEST"];
	assert.ok(flag === undefined || ["0", "1"].includes(flag), "Invalid recursive checked-record PHP-Wasm TEST");
	const select = (name, allowed) => {
		const raw = environment[prefix + name];
		if(raw !== undefined)
		{
			assert.equal(typeof raw, "string", `Invalid recursive checked-record PHP-Wasm ${name}`);
			assert.equal(flag, "1", `Explicit recursive checked-record PHP-Wasm ${name} requires TEST=1`);
		}
		const selected = raw === undefined ? [...allowed] : raw.split(",");
		assert.ok(selected.length && selected.every(value => allowed.includes(value)), `Invalid recursive checked-record PHP-Wasm ${name}`);
		assert.equal(new Set(selected).size, selected.length, `Duplicate recursive checked-record PHP-Wasm ${name}`);
		return selected;
	};
	for(const name of ["OUTPUT", "MAX_LOAD"])
		if(environment[prefix + name] !== undefined)
			assert.equal(flag, "1", `Explicit recursive checked-record PHP-Wasm ${name} requires TEST=1`);
	const rawLoad = environment[prefix + "MAX_LOAD"];
	if(rawLoad !== undefined) assert.equal(typeof rawLoad, "string", "Invalid recursive checked-record PHP-Wasm MAX_LOAD");
	const maxLoad = rawLoad === undefined ? 8 : Number(rawLoad);
	assert.ok(recursiveCheckedRecordPhpWasmLoadCeilings.includes(maxLoad)
		, `Recursive checked-record PHP-Wasm max load must be one of ${recursiveCheckedRecordPhpWasmLoadCeilings.join(", ")}`);
	const routes = select("ROUTES", recursiveCheckedRecordPhpWasmRoutes);
	const selected = select("FIXTURES", recursiveCheckedRecordPhpWasmFixtures);
	return { enabled: flag === "1", routes, fixtures: selected, maxLoad };
};

/**
 * Select only PHP-Wasm delivery while preserving the shared author contract.
 *
 * @param route - Ordinary source or independently reviewed IR.
 * @param fixture - Recursive or mutual module.
 */
export const recursiveCheckedRecordPhpWasmConfiguration = (route, fixture) => {
	assert.ok(recursiveCheckedRecordPhpWasmRoutes.includes(route));
	const { settings } = recursiveCheckedRecordPhpWasmPackage(fixture);
	return { ...fixtures[fixture].configuration(route), targets: { "php-wasm": settings } };
};

/**
 * Preserve the shared independently authored contract.
 *
 * @param fixture - Recursive or mutual module.
 */
export const recursiveCheckedRecordPhpWasmReview = fixture => {
	assert.ok(recursiveCheckedRecordPhpWasmFixtures.includes(fixture));
	return fixtures[fixture].review();
};

/**
 * Require both the compiled word result and the actual Zend host width.
 *
 * @param fixture - Recursive or mutual module.
 */
export const recursiveCheckedRecordPhpWasmExpected = fixture => {
	assert.ok(recursiveCheckedRecordPhpWasmFixtures.includes(fixture));
	return { ...recursiveCheckedRecordPhpWasmCounts[fixture], word_bits: 32, php: "8.4.1" };
};

const replaceExact = (source, before, after) => {
	assert.equal(source.split(before).length - 1, 1, before);
	return source.replace(before, after);
};

/**
 * Retarget only host entry, loading and the final observation. Every semantic
 * assertion remains the independently authored native-PHP corpus.
 *
 * @param source - Complete independent native-PHP caller.
 * @param strictness - Weak or strict lexical caller mode.
 */
export const adaptRecursiveCheckedRecordPhpWasm = (source, strictness) => {
	assert.ok(["weak", "strict"].includes(strictness));
	assert.ok(source.startsWith("<?php\ndeclare(strict_types=0);\n"));
	// The driver autoloads the selected package before running the caller; no CLI entry exists.
	const entry = "if (realpath($_SERVER['SCRIPT_FILENAME']) === __FILE__) {\n"
		+ "    if ($argc !== 1) throw new InvalidArgumentException('The installed package selects the module');\n"
		+ "    require 'vendor/autoload.php';\n";
	const call = "check_recursive_checked_records_php($api, $module)";
	const output = `    echo json_encode(${call}, JSON_THROW_ON_ERROR) . "\\n";\n}\n`;
	const observed = `    $observed = ${call};\n`
		+ '    echo json_encode([...$observed, \'word_bits\' => PHP_INT_SIZE * 8, \'php\' => PHP_VERSION], JSON_THROW_ON_ERROR) . "\\n";\n';
	assert.ok(source.endsWith(output));
	// Every Nat is a BigInteger, so no word-width scalar needs adapting.
	let adapted = replaceExact(source, entry, "");
	adapted = replaceExact(adapted, output, observed);
	return replaceExact(adapted, "declare(strict_types=0);", `declare(strict_types=${strictness === "strict" ? 1 : 0});`);
};

/**
 * Adapt the shared caller once per lexical strictness.
 *
 * @param strictness - Weak or strict lexical caller mode.
 */
export const recursiveCheckedRecordPhpWasmCallerSource = async strictness =>
	adaptRecursiveCheckedRecordPhpWasm(await readFile(recursiveCheckedRecordPhpWasmCaller, "utf8"), strictness);

/**
 * Probe a malformed first call before lazy component loading.
 *
 * @param fixture - Recursive or mutual module.
 * @param arrangement - Embedded npm assets or Composer autoloading.
 */
export const recursiveCheckedRecordPhpWasmRequest = (fixture, arrangement) => {
	assert.ok(["embedded", "composer"].includes(arrangement));
	const { namespace, settings } = recursiveCheckedRecordPhpWasmPackage(fixture);
	return JSON.stringify({
		module: namespace, operations: { probe: "first" }
		, autoload: arrangement === "composer" ? "vendor/autoload.php" : `vendor/${settings.composer.name}/bootstrap.php`
	}) + "\n";
};

/**
 * Build the installed-corpus consumer for one module. Exported so source-only tests
 * execute the exact request and source closures the gated producer passes on.
 *
 * @param fixtureName - Recursive or mutual module name, never a consumer object.
 * @param sources - Adapted weak and strict caller sources.
 */
export const recursiveCheckedRecordPhpWasmConsumerFixture = (fixtureName, sources) => {
	assert.ok(recursiveCheckedRecordPhpWasmFixtures.includes(fixtureName), "Select a recursive checked-record module by name");
	assert.deepEqual(Object.keys(sources).sort(), ["strict", "weak"]);
	for(const source of Object.values(sources)) assert.equal(typeof source, "string");
	const { settings } = recursiveCheckedRecordPhpWasmPackage(fixtureName);
	return Object.freeze({
		settings
		, source: strictness => {
			assert.ok(Object.hasOwn(sources, strictness)); return sources[strictness];
		}
		, request: arrangement => recursiveCheckedRecordPhpWasmRequest(fixtureName, arrangement)
		, removeHandoff: true
	});
};

/**
 * Require actual wasm32 compiler metadata and every per-use refinement tree.
 *
 * @param model - Fresh PHP-Wasm compiler model.
 * @param route - Ordinary source or independently reviewed IR.
 * @param fixture - Recursive or mutual module.
 */
export const checkRecursiveCheckedRecordPhpWasmModel = (model, route, fixture) => {
	const expected = recursiveCheckedRecordPhpWasmReview(fixture);
	assert.ok(recursiveCheckedRecordPhpWasmRoutes.includes(route));
	assert.equal(model.profile, "php-wasm-copied-v1");
	assert.equal(model.pointerBits, 32); assert.equal(model.byteOrder, "little");
	assert.equal(reviewedContractDifference(expected, model.bindingIr), null);
	assert.ok(model.copiedGraph && !model.copiedGraph.callbacks, "Recursive checked records use the copied graph transport");
	assert.deepEqual(model.exports.map(item => item.name).sort(), expected.declarations.map(item => item.id.slice(5)).sort());
	for(const item of model.exports)
	{
		// The compiler keeps each export's named refinement tree, including constructor-free results.
		assert.deepEqual(item.refinements, fixtures[fixture].refinements[item.name], item.name);
		assert.doesNotMatch(JSON.stringify(item.refinements.result), /"constructor":"[A-Za-z]+CheckedRecords\./u, `${item.name} result selects no constructor`);
	}
};

/**
 * Require all twelve actual Node/Chromium, package, loading and strictness contexts.
 *
 * @param evidence - Original installed PHP-Wasm observation.
 * @param fixture - Recursive or mutual module.
 */
export const checkRecursiveCheckedRecordPhpWasmExecutions = (evidence, fixture) => {
	assert.deepEqual(evidence.executions.map(item => `${item.realm}/${item.arrangement}/${item.loading}/${item.mode}`).sort(), phpWasmExecutionTuples);
	assert.equal(evidence.component.pointerBits, 32); assert.equal(evidence.runtime.pointerBits, 32);
	const libraries = [basename(evidence.component.library), basename(evidence.runtime.library)].sort();
	assert.equal(new Set(libraries).size, 2);
	for(const execution of evidence.executions)
	{
		assert.deepEqual(execution.observation, recursiveCheckedRecordPhpWasmExpected(fixture));
		const loaded = stage => execution.loading === "startup" || stage === "complete";
		const phases = execution.phases.map(item => ({ ...item, libraries: [...item.libraries].sort() }));
		assert.deepEqual(phases, ["ready", "autoload", "invalid", "complete"]
			.map(stage => ({ stage, libraries: loaded(stage) ? libraries : [] })));
	}
};
