/**
 * Source and independent-caller controls for zero-payload checked records in
 * native PHP: guarded nullary readonly carriers, exact class identity, Unit,
 * Option, arrays and both Mark branches.
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
	zeroPayloadBrowserInputNames, zeroPayloadBrowserResultNames
} from "./zero-payload-checked-record-browser-fixture.mjs";
import { erasedProofsKey } from "./zero-payload-checked-record-fixture.mjs";
import {
	parseZeroPayloadPhpResult, zeroPayloadPhpCaller, zeroPayloadPhpCallerArgs
	, zeroPayloadPhpEnvironment, zeroPayloadPhpExpected, zeroPayloadPhpLoadCeilings
	, zeroPayloadPhpNamespace, zeroPayloadPhpRoutes, zeroPayloadPhpSelection
	, zeroPayloadPhpTarget
} from "./zero-payload-checked-record-php-fixture.mjs";

const run = promisify(execFile);
const snake = name => name.replace(/[A-Z]/gu, value => `_${value.toLowerCase()}`);
const callerPath = "tests/fixtures/zero-payload-checked-record-php/php.php";
const modelPath = "tests/helpers/zero-payload-checked-record-php-model.php";

test("zero-payload native PHP selections preserve all four independent routes", () => {
	assert.deepEqual(zeroPayloadPhpRoutes, [
		"ordinary-source", "reviewed-ir"
		, "result-only-ordinary-source", "result-only-reviewed-ir"
	]);
	assert.deepEqual(zeroPayloadPhpTarget, {
		name: "example/zeropayloadcheckedrecords", version: "1.0.0"
	});
	assert.equal(zeroPayloadPhpNamespace, "LeanZeropayloadcheckedrecords");
	assert.deepEqual(zeroPayloadPhpLoadCeilings, [8, 12, 16, 20]);
	for(const route of zeroPayloadPhpRoutes)
	{
		const selection = zeroPayloadPhpSelection(route);
		assert.deepEqual(selection.configuration.targets, { "php-native": zeroPayloadPhpTarget });
		assert.deepEqual(selection.configuration.modules, ["ZeroPayloadCheckedRecords"]);
		assert.equal(selection.resultOnly, route.startsWith("result-only-"));
		assert.equal(selection.reviewed, route.endsWith("reviewed-ir"));
		assert.equal(selection.configuration.exports?.length
			, selection.reviewed ? undefined : selection.resultOnly ? 6 : 11);
		assert.deepEqual(selection.expected.types.map(type => type.name)
			, ["Witness", "Token", "Marker", "Mark"]);
		assert.deepEqual(zeroPayloadPhpCallerArgs(route), [
			...selection.resultOnly ? ["--result-only"] : []
			, ...selection.reviewed ? ["--reviewed"] : []
		]);
	}
	assert.throws(() => zeroPayloadPhpSelection("ordinary"));
	assert.deepEqual(zeroPayloadPhpEnvironment({}), {
		enabled: false, routes: zeroPayloadPhpRoutes, maxLoad: 8
	});
	assert.deepEqual(zeroPayloadPhpEnvironment({
		LEAN_BRIDGE_ZERO_PAYLOAD_PHP_TEST: "1"
		, LEAN_BRIDGE_ZERO_PAYLOAD_PHP_ROUTES: "reviewed-ir"
		, LEAN_BRIDGE_ZERO_PAYLOAD_PHP_MAX_LOAD: "12"
	}), { enabled: true, routes: ["reviewed-ir"], maxLoad: 12 });
	for(const environment of [
		{ LEAN_BRIDGE_ZERO_PAYLOAD_PHP_TEST: "2" }
		, { LEAN_BRIDGE_ZERO_PAYLOAD_PHP_ROUTES: "reviewed-ir" }
		, { LEAN_BRIDGE_ZERO_PAYLOAD_PHP_OUTPUT: "build/out" }
		, { LEAN_BRIDGE_ZERO_PAYLOAD_PHP_TEST: "1"
			, LEAN_BRIDGE_ZERO_PAYLOAD_PHP_ROUTES: "ordinary" }
		, { LEAN_BRIDGE_ZERO_PAYLOAD_PHP_TEST: "1"
			, LEAN_BRIDGE_ZERO_PAYLOAD_PHP_ROUTES: "ordinary-source,ordinary-source" }
		, { LEAN_BRIDGE_ZERO_PAYLOAD_PHP_TEST: "1"
			, LEAN_BRIDGE_ZERO_PAYLOAD_PHP_MAX_LOAD: "7" }
	]) assert.throws(() => zeroPayloadPhpEnvironment(environment));
});

test("native PHP copied projection keeps zero-payload carriers guarded and distinct", () => {
	for(const route of zeroPayloadPhpRoutes)
	{
		const { expected, resultOnly } = zeroPayloadPhpSelection(route);
		const types = Object.fromEntries(expected.types.map(type => [type.name, type]));
		assert.deepEqual(types.Witness.source.extensions[erasedProofsKey], { fields: ["positive"] });
		assert.deepEqual(types.Token.source.extensions[erasedProofsKey], { fields: ["fresh"] });
		assert.equal(types.Marker.source.extensions[erasedProofsKey], undefined);
		assert.equal(types.Mark.kind, "variant");
		const model = compileCopiedPhpModel(expected, {
			structuredCallables: true, lists: true, variants: true
		});
		const files = renderCopiedPhpPackage(model);
		const api = files["src/Api.php"];
		assert.ok(api.startsWith("<?php\ndeclare(strict_types=1);"));
		assert.match(api, new RegExp(`namespace ${zeroPayloadPhpNamespace};`, "u"));
		assert.match(api, /final readonly class Witness\n\{\n\n {4}public function __construct\(\) \{\n {8}if \(func_num_args\(\) !== 0\) throw new \\ArgumentCountError\('Witness requires exactly 0 fields'\);/u);
		assert.match(api, /final readonly class Token\n\{\n {4}\/\*\* @var null \*\/\n {4}public null \$tag;/u);
		assert.match(api, /final readonly class Marker\n\{\n\n {4}public function __construct\(\) \{/u);
		assert.match(api, /abstract readonly class Mark \{\}\nfinal readonly class MarkBlank extends Mark/u);
		assert.match(api, /final readonly class MarkMarked extends Mark\n\{\n {4}\/\*\* @var Witness \*\/\n {4}public Witness \$witness;/u);
		assert.match(api, /final readonly class Some\n/u);
		assert.match(api, /function witnesses\(mixed \$value0\): array/u);
		assert.match(api, /function maybe_witness\(mixed \$value0\): Some\|null/u);
		assert.match(api, /function produce_mark\(mixed \$value0\): Mark/u);
		assert.doesNotMatch(api, /\b(?:positive|fresh)\b/u);
		for(const name of zeroPayloadBrowserResultNames)
			assert.match(api, new RegExp(`function ${snake(name)}\\(`, "u"), name);
		for(const name of zeroPayloadBrowserInputNames)
			assert.equal(new RegExp(`function ${snake(name)}\\(`, "u").test(api), !resultOnly, name);
		if(!resultOnly) assert.match(api, /\$value0 checked by ZeroPayloadCheckedRecords\.mkAbsent/u);
		const native = files["src/Internal/Native.php"];
		assert.match(native, /throw new \\TypeError\('Expected Witness'\)/u);
		assert.match(native, /throw new \\TypeError\('Unit requires null'\)/u);
		assert.match(native, /throw new \\TypeError\('Expected an exact Mark constructor'\)/u);
		assert.match(native, /return new \\LeanZeropayloadcheckedrecords\\Some\(self::check0\(\$value->value, \$budget\)\)/u);
		const changed = structuredClone(expected);
		changed.types.find(type => type.name === "Witness").source.extensions[erasedProofsKey]
			= { fields: [] };
		assert.notEqual(hashBindingIr(changed), hashBindingIr(expected));
	}
});

test("native PHP zero-payload caller refuses faults, preserves rejected inputs and recovers", async () => {
	const caller = await zeroPayloadPhpCaller();
	assert.match(caller, /function check_zero_payload_records\(/u);
	assert.match(caller, /declare\(strict_types=0\);/u);
	assert.match(caller, /was rejected by ZeroPayloadCheckedRecords\.' \. \$constructor/u);
	for(const probe of [
		"$refuse('absent_count', [new Witness()], 'mkAbsent'"
		, "$hostRefuse('witness_count', static fn(): array => [null]"
		, "$hostRefuse('token_tag', static fn(): array => [new Token(0)]"
		, "$hostRefuse('mark_count', static fn(): array => [new MarkMarked(null)]"
		, "$hostRefuse('witnesses', static fn(): array => [$negative]"
		, "$invoke('maybe_witness', [false], null)"
		, "$invoke('maybe_witness', [true], new Some(new Witness()))"
		, "$invoke('witnesses', [$n(0)], [])"
		, "$invoke('produce_mark', [true], new MarkMarked(new Witness()))"
		, "try { new Witness(1); } catch (ArgumentCountError)"
	]) assert.ok(caller.includes(probe), probe);
	for(const route of zeroPayloadPhpRoutes)
	{
		const { stdout, stderr } = await run("/usr/bin/php", [modelPath, callerPath, route]);
		assert.equal(stderr, "");
		assert.deepEqual(JSON.parse(stdout), zeroPayloadPhpExpected(route));
		assert.deepEqual(parseZeroPayloadPhpResult(stdout, route), zeroPayloadPhpExpected(route));
		for(const field of Object.keys(zeroPayloadPhpExpected(route)))
		{
			const changed = { ...zeroPayloadPhpExpected(route) };
			changed[field] += 1;
			assert.throws(() => parseZeroPayloadPhpResult(`${JSON.stringify(changed)}\n`, route));
		}
	}
	for(const [mode, faults] of Object.entries({
		full: ["accept-invalid", "wrong-status", "wrong-message"
			, "wrong-produced", "missing-producer", "option-collapsed"
			, "array-length", "host-accepts-null"]
		, "result-only": ["wrong-produced", "missing-producer"
			, "inputs-exported", "option-collapsed", "array-length"]
	})) for(const fault of faults)
	{
		const route = mode === "full" ? "ordinary-source" : "result-only-ordinary-source";
		const { stdout, stderr } = await run("/usr/bin/php", [modelPath, callerPath, route, fault]);
		assert.equal(stderr, "");
		assert.deepEqual(JSON.parse(stdout), { fault, rejected: true });
	}
	assert.equal((await run("/usr/bin/php", ["-l", callerPath])).stderr, "");
	assert.throws(() => parseZeroPayloadPhpResult("{}\n", "ordinary-source"));
	assert.equal(await zeroPayloadPhpCaller(), caller);
});
