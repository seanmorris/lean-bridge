/**
 * Source and independent-caller controls for dependent checked records in
 * native PHP: a retained `bound : Nat` with a retained `below : Fin bound`,
 * checked only by the reviewed Lean constructor, projected to a guarded
 * readonly class with two exact naturals.
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
	parseDependentCheckedRecordPhpResult, dependentCheckedRecordPhpCaller
	, dependentCheckedRecordPhpCallerArgs, dependentCheckedRecordPhpCallerPath
	, dependentCheckedRecordPhpEnvironment
	, dependentCheckedRecordPhpExpected, dependentCheckedRecordPhpFixtureRoot
	, dependentCheckedRecordPhpLeanModule, dependentCheckedRecordPhpLoadCeilings
	, dependentCheckedRecordPhpNamespace, dependentCheckedRecordPhpRoutes
	, dependentCheckedRecordPhpSelection, dependentCheckedRecordPhpTarget
} from "./dependent-checked-record-php-fixture.mjs";

const run = promisify(execFile);
const callerPath = "tests/fixtures/dependent-checked-record-consumers/php.php";
const modelPath = "tests/helpers/dependent-checked-record-php-model.php";
const erasedProofsKey = "lean-lang.org/erased-proofs";
const nominalRefinementsKey = "lean-lang.org/nominal-refinements";

test("dependent native PHP selections preserve all four independent routes", () => {
	assert.deepEqual(dependentCheckedRecordPhpRoutes, [
		"ordinary-source", "reviewed-ir"
		, "result-only-ordinary-source", "result-only-reviewed-ir"
	]);
	assert.deepEqual(dependentCheckedRecordPhpTarget, {
		name: "example/dependentrecords", version: "1.0.0"
	});
	assert.equal(dependentCheckedRecordPhpNamespace, "LeanDependentrecords");
	assert.equal(dependentCheckedRecordPhpFixtureRoot
		, "tests/fixtures/onboarding/dependent-checked-records");
	assert.equal(dependentCheckedRecordPhpLeanModule, "DependentRecords");
	assert.equal(dependentCheckedRecordPhpCallerPath, callerPath);
	assert.deepEqual(dependentCheckedRecordPhpLoadCeilings, [8, 12, 16, 20]);
	for(const route of dependentCheckedRecordPhpRoutes)
	{
		const selection = dependentCheckedRecordPhpSelection(route);
		assert.deepEqual(selection.configuration.targets
			, { "php-native": dependentCheckedRecordPhpTarget });
		assert.deepEqual(selection.configuration.modules, ["DependentRecords"]);
		assert.equal(selection.resultOnly, route.startsWith("result-only-"));
		assert.equal(selection.reviewed, route.endsWith("reviewed-ir"));
		assert.equal(selection.configuration.exports?.length
			, selection.reviewed ? undefined : selection.resultOnly ? 1 : 3);
		assert.deepEqual(selection.expected.types.map(type => type.name), ["Dependent"]);
		assert.deepEqual(selection.expected.declarations.map(item => item.name)
			, selection.resultOnly ? ["dependentResult"]
				: ["dependentTotal", "dependentRoundtrip", "dependentResult"]);
		assert.deepEqual(dependentCheckedRecordPhpCallerArgs(route), [
			...selection.resultOnly ? ["--result-only"] : []
			, ...selection.reviewed ? ["--reviewed"] : []
		]);
		assert.deepEqual(dependentCheckedRecordPhpExpected(route), selection.resultOnly
			? { calls: 513, checks: 516, recoveries: 0, rejections: 0, snapshots: 513 }
			: { calls: 1289, checks: 2326, recoveries: 258, rejections: 258, snapshots: 1289 });
	}
	assert.throws(() => dependentCheckedRecordPhpSelection("ordinary"));
	assert.deepEqual(dependentCheckedRecordPhpEnvironment({}), {
		enabled: false, routes: dependentCheckedRecordPhpRoutes, maxLoad: 8
	});
	assert.deepEqual(dependentCheckedRecordPhpEnvironment({
		LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_PHP_TEST: "1"
		, LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_PHP_ROUTES: "reviewed-ir"
		, LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_PHP_MAX_LOAD: "12"
	}), { enabled: true, routes: ["reviewed-ir"], maxLoad: 12 });
	for(const environment of [
		{ LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_PHP_TEST: "2" }
		, { LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_PHP_ROUTES: "reviewed-ir" }
		, { LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_PHP_OUTPUT: "build/out" }
		, { LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_PHP_TEST: "1"
			, LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_PHP_ROUTES: "ordinary" }
		, { LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_PHP_TEST: "1"
			, LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_PHP_ROUTES: "ordinary-source,ordinary-source" }
		, { LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_PHP_TEST: "1"
			, LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_PHP_MAX_LOAD: "7" }
	]) assert.throws(() => dependentCheckedRecordPhpEnvironment(environment));
});

test("native PHP copied projection keeps the dependent record guarded and exact", () => {
	for(const route of dependentCheckedRecordPhpRoutes)
	{
		const { expected, resultOnly } = dependentCheckedRecordPhpSelection(route);
		const [dependent] = expected.types;
		assert.deepEqual(dependent.source.extensions[erasedProofsKey], { fields: ["valid"] });
		assert.deepEqual(dependent.source.extensions[nominalRefinementsKey]
			, { kind: "record", fields: [null, { kind: "fin-field", field: "bound" }] });
		assert.deepEqual(dependent.fields.map(field => [field.name, field.type])
			, [["bound", { kind: "primitive", name: "nat" }], ["below", { kind: "primitive", name: "nat" }]]);
		const model = compileCopiedPhpModel(expected, {
			structuredCallables: true, lists: true, variants: true
		});
		const files = renderCopiedPhpPackage(model);
		const api = files["src/Api.php"];
		assert.ok(api.startsWith("<?php\ndeclare(strict_types=1);"));
		assert.match(api, new RegExp(`namespace ${dependentCheckedRecordPhpNamespace};`, "u"));
		assert.match(api, /final readonly class Dependent\n\{\n {4}\/\*\* @var \\Brick\\Math\\BigInteger \*\/\n {4}public \\Brick\\Math\\BigInteger \$bound;\n {4}\/\*\* @var \\Brick\\Math\\BigInteger \*\/\n {4}public \\Brick\\Math\\BigInteger \$below;/u);
		assert.match(api, /if \(func_num_args\(\) !== 2\) throw new \\ArgumentCountError\('Dependent requires exactly 2 fields'\);/u);
		assert.match(api, /function dependent_result\(mixed \$value0\): Dependent/u);
		assert.match(api, /result projects proof-backed record payload fields; result\.below < result\.bound/u);
		assert.doesNotMatch(api, /\bvalid\b/u);
		assert.equal(/function dependent_total\(mixed \$value0\): \\Brick\\Math\\BigInteger/u.test(api), !resultOnly);
		assert.equal(/function dependent_roundtrip\(mixed \$value0\): Dependent/u.test(api), !resultOnly);
		assert.equal(/\$value0 checked by DependentRecords\.mkDependent; \$value0\.below < \$value0\.bound/u.test(api), !resultOnly);
		const native = files["src/Internal/Native.php"];
		assert.match(native, /throw new \\TypeError\('Expected Dependent'\)/u);
		assert.match(native, /throw new \\TypeError\('Dependent requires exactly its initialized fields'\)/u);
		assert.match(native, /throw new \\TypeError\('Expected Brick Math BigInteger'\)/u);
		assert.match(native, /return new \\LeanDependentrecords\\Dependent\(self::from0\(\$value->bound, \$scope\), self::from0\(\$value->below, \$scope\)\)/u);
		assert.match(native, /throw new \\LeanDependentrecords\\LeanBridgeError\(\$message, \$status\)/u);
		const changed = structuredClone(expected);
		changed.types[0].source.extensions[nominalRefinementsKey].fields[1] = null;
		assert.notEqual(hashBindingIr(changed), hashBindingIr(expected));
		const erased = structuredClone(expected);
		erased.types[0].source.extensions[erasedProofsKey] = { fields: [] };
		assert.notEqual(hashBindingIr(erased), hashBindingIr(expected));
	}
});

test("native PHP dependent caller refuses faults, preserves rejected inputs and recovers", async () => {
	const caller = await dependentCheckedRecordPhpCaller();
	assert.match(caller, /function check_dependent_records\(/u);
	assert.match(caller, /declare\(strict_types=0\);/u);
	assert.match(caller, /\$parameterPrefix \. '0 was rejected by DependentRecords\.mkDependent'/u);
	assert.match(caller, /BigInteger::one\(\)->shiftedLeft\(130\)/u);
	for(const probe of [
		"$refuse($record($n(2), $n(2)), 'equal fields')"
		, "$refuse($record($n(0), $n(0)), 'zero bound')"
		, "$refuse($record($bound, $bound), 'loop refusal ' . $index)"
		, "$invoke('dependent_total', [$record($huge, $below)], $huge->plus($below), 'huge total')"
		, "$invoke('dependent_roundtrip', [$hugeRecord], $hugeRecord, 'huge roundtrip')"
		, "for ($index = 0; $index < 512; ++$index) $produced($n($index), 'result ' . $index)"
		, "$check($error->getCode() === 1"
		, "$check(dependent_snapshot($value) === $before, $label . ' preserves rejected input')"
	]) assert.ok(caller.includes(probe), probe);
	for(const route of dependentCheckedRecordPhpRoutes)
	{
		const { stdout, stderr } = await run("/usr/bin/php", [modelPath, callerPath, route]);
		assert.equal(stderr, "");
		assert.deepEqual(JSON.parse(stdout), dependentCheckedRecordPhpExpected(route));
		assert.deepEqual(parseDependentCheckedRecordPhpResult(stdout, route)
			, dependentCheckedRecordPhpExpected(route));
		for(const field of Object.keys(dependentCheckedRecordPhpExpected(route)))
		{
			const changed = { ...dependentCheckedRecordPhpExpected(route) };
			changed[field] += 1;
			assert.throws(() => parseDependentCheckedRecordPhpResult(`${JSON.stringify(changed)}\n`, route));
		}
	}
	for(const [mode, faults] of Object.entries({
		full: ["accept-invalid", "wrong-status", "wrong-message", "mutate-input"
			, "wrong-produced", "wrong-roundtrip", "missing-producer"]
		, "result-only": ["wrong-produced", "missing-producer", "inputs-exported"]
	})) for(const fault of faults)
	{
		const route = mode === "full" ? "ordinary-source" : "result-only-ordinary-source";
		const { stdout, stderr } = await run("/usr/bin/php", [modelPath, callerPath, route, fault]);
		assert.equal(stderr, "");
		assert.deepEqual(JSON.parse(stdout), { fault, rejected: true });
	}
	assert.equal((await run("/usr/bin/php", ["-l", callerPath])).stderr, "");
	assert.throws(() => parseDependentCheckedRecordPhpResult("{}\n", "ordinary-source"));
	assert.equal(await dependentCheckedRecordPhpCaller(), caller);
});
