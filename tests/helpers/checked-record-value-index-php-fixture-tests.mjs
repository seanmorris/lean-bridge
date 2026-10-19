/**
 * Source and independent-caller controls for native-PHP value-index records.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import test from "node:test";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { compileCopiedPhpModel } from "../../src/backends/php/copied-model.mjs";
import { renderCopiedPhpPackage } from "../../src/backends/php/copied-values.mjs";
import {
	checkedRecordValueIndexPhpCaller, checkedRecordValueIndexPhpCallerArgs
	, checkedRecordValueIndexPhpExpected, checkedRecordValueIndexPhpNamespace
	, checkedRecordValueIndexPhpRoutes, checkedRecordValueIndexPhpRunSelection
	, checkedRecordValueIndexPhpSelection
	, checkedRecordValueIndexPhpTarget, parseCheckedRecordValueIndexPhpResult
} from "./checked-record-value-index-php-fixture.mjs";

const run = promisify(execFile);
const expectedRecords = Object.freeze({
	On: ["Flagged", "bool", "true"], Off: ["Flagged", "bool", "false"]
	, Ab: ["Labeled", "string", "ab"], EmptyToken: ["Token", "string", ""]
	, UnicodeToken: ["Token", "string", "λ🌱"], EmptySized: ["Sized", "nat", "0"]
	, ZeroToken: ["Token", "nat", "0"]
	, WideToken: ["Token", "nat", "340282366920938463463374607431768211457"]
});

test("value-index native PHP selections preserve all four independent routes", () => {
	assert.deepEqual(checkedRecordValueIndexPhpRoutes, [
		"ordinary-source", "reviewed-ir"
		, "result-only-ordinary-source", "result-only-reviewed-ir"
	]);
	assert.deepEqual(checkedRecordValueIndexPhpTarget, {
		name: "example/checkedrecordvalueindices", version: "1.0.0"
	});
	for(const route of checkedRecordValueIndexPhpRoutes)
	{
		const selection = checkedRecordValueIndexPhpSelection(route);
		assert.deepEqual(selection.configuration.targets, {
			"php-native": checkedRecordValueIndexPhpTarget
		});
		assert.equal(selection.resultOnly, route.startsWith("result-only-"));
		assert.equal(selection.reviewed, route.endsWith("reviewed-ir"));
		assert.deepEqual(checkedRecordValueIndexPhpCallerArgs(route), [
			...selection.resultOnly ? ["--result-only"] : []
			, ...selection.reviewed ? ["--reviewed"] : []
		]);
	}
	assert.throws(() => checkedRecordValueIndexPhpSelection("ordinary"));
	assert.deepEqual(checkedRecordValueIndexPhpRunSelection({}), {
		enabled: false, routes: checkedRecordValueIndexPhpRoutes, maxLoad: 8
	});
	assert.deepEqual(checkedRecordValueIndexPhpRunSelection({
		LEAN_BRIDGE_VALUE_INDEX_PHP_TEST: "1"
		, LEAN_BRIDGE_VALUE_INDEX_PHP_ROUTES: "reviewed-ir"
		, LEAN_BRIDGE_VALUE_INDEX_PHP_MAX_LOAD: "12"
	}), { enabled: true, routes: ["reviewed-ir"], maxLoad: 12 });
	assert.throws(() => checkedRecordValueIndexPhpRunSelection({
		LEAN_BRIDGE_VALUE_INDEX_PHP_ROUTES: "reviewed-ir"
	}));
});

test("native PHP copied projection retains every erased closed value index", () => {
	for(const route of checkedRecordValueIndexPhpRoutes)
	{
		const { expected, resultOnly } = checkedRecordValueIndexPhpSelection(route);
		assert.equal(expected.types.length, Object.keys(expectedRecords).length);
		assert.equal(expected.declarations.length, resultOnly ? 8 : 16);
		for(const type of expected.types)
		{
			const [structure, kind, value] = expectedRecords[type.name];
			const index = type.source.extensions["lean-lang.org/instantiation"];
			assert.equal(index.structure, `CheckedRecordValueIndices.${structure}`);
			assert.ok(index.arguments.some(argument => argument.kind === "value"
				&& argument.type.name === kind && argument.value === value));
			assert.ok(Array.isArray(type.source.extensions["lean-lang.org/erased-proofs"].fields));
		}
		const model = compileCopiedPhpModel(expected, {
			structuredCallables: true, lists: true, variants: true
		});
		const files = renderCopiedPhpPackage(model);
		const api = files["src/Api.php"];
		assert.ok(api.startsWith("<?php\ndeclare(strict_types=1);"));
		assert.match(api, new RegExp(`namespace ${checkedRecordValueIndexPhpNamespace};`, "u"));
		for(const record of Object.keys(expectedRecords))
			assert.match(api, new RegExp(`final readonly class ${record}\\b`, "u"));
		for(const declaration of expected.declarations)
			assert.match(api, new RegExp(`function ${declaration.name.replace(/[A-Z]/gu, value => `_${value.toLowerCase()}`)}\\(`, "u"));
		if(resultOnly) assert.doesNotMatch(api, /function true_bool_index\(/u);
		else assert.match(api, /function true_bool_index\(/u);
		const changed = structuredClone(expected);
		changed.types.find(type => type.name === "On").source.extensions[
			"lean-lang.org/instantiation"].arguments[0].value = "false";
		assert.notEqual(hashBindingIr(changed), hashBindingIr(expected));
	}
});

test("native PHP caller enforces result-only boundaries and rejects divergent APIs", async () => {
	const caller = await checkedRecordValueIndexPhpCaller();
	assert.match(caller, /function check_value_index_records\(/u);
	assert.match(caller, /declare\(strict_types=0\);/u);
	const model = "tests/helpers/checked-record-value-index-php-model.php";
	for(const route of checkedRecordValueIndexPhpRoutes)
	{
		const { stdout, stderr } = await run("/usr/bin/php", [model
			, "tests/fixtures/checked-record-value-index-php/php.php", route]);
		assert.equal(stderr, "");
		assert.deepEqual(JSON.parse(stdout), checkedRecordValueIndexPhpExpected(route));
		assert.deepEqual(parseCheckedRecordValueIndexPhpResult(stdout, route)
			, checkedRecordValueIndexPhpExpected(route));
	}
	for(const [mode, faults] of Object.entries({
		full: ["accept-invalid", "wrong-status", "wrong-message", "mutate-input"
			, "wrong-produced", "missing-producer"]
		, "result-only": ["wrong-produced", "missing-producer", "inputs-exported"]
	})) for(const fault of faults)
	{
		const route = mode === "full" ? "ordinary-source" : "result-only-ordinary-source";
		const { stdout, stderr } = await run("/usr/bin/php", [model
			, "tests/fixtures/checked-record-value-index-php/php.php", route, fault]);
		assert.equal(stderr, "");
		assert.deepEqual(JSON.parse(stdout), { fault, rejected: true });
	}
	assert.equal((await run("/usr/bin/php", ["-l"
		, "tests/fixtures/checked-record-value-index-php/php.php"])).stderr, "");
});
