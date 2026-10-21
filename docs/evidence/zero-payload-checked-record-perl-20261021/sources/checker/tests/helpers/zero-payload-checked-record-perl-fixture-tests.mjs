/**
 * Cheap source-contract controls for the independent zero-payload Perl caller.
 * Installed CPAN acceptance remains an explicit hosted-only lane.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	parseZeroPayloadPerlResult, zeroPayloadPerlCaller
	, zeroPayloadPerlCallerArgs, zeroPayloadPerlConfigurations
	, zeroPayloadPerlCounts, zeroPayloadPerlEnvironment
	, zeroPayloadPerlInstallModes, zeroPayloadPerlModule
	, zeroPayloadPerlRoutes, zeroPayloadPerlSelection, zeroPayloadPerlTarget
} from "./zero-payload-checked-record-perl-fixture.mjs";

const model = "tests/helpers/zero-payload-checked-record-perl-model.pl";
const caller = "tests/fixtures/zero-payload-checked-record-perl/perl.pl";
const perl = process.env.LEAN_BRIDGE_PERL ?? "/usr/bin/perl";

test("zero-payload Perl selections close every route, ABI and install mode", () => {
	assert.equal(zeroPayloadPerlModule, "LeanBridge::ZeroPayloadCheckedRecords");
	assert.deepEqual(zeroPayloadPerlTarget, {
		module: zeroPayloadPerlModule, version: "1.000"
	});
	assert.deepEqual(zeroPayloadPerlRoutes, [
		"ordinary-source", "reviewed-ir"
		, "result-only-ordinary-source", "result-only-reviewed-ir"
	]);
	assert.deepEqual(zeroPayloadPerlConfigurations, [
		"5.36.3-threaded", "5.36.3-unthreaded"
		, "5.38.2-threaded", "5.38.2-unthreaded"
	]);
	assert.deepEqual(zeroPayloadPerlInstallModes, ["prebuilt-only", "build-xs"]);
	for(const route of zeroPayloadPerlRoutes)
	{
		const selection = zeroPayloadPerlSelection(route);
		assert.deepEqual(selection.configuration.targets, { cpan: zeroPayloadPerlTarget });
		assert.deepEqual(selection.configuration.modules, ["ZeroPayloadCheckedRecords"]);
		assert.equal(selection.configuration.exports?.length
			, selection.reviewed ? undefined : selection.resultOnly ? 6 : 11);
		assert.deepEqual(selection.expected.types.map(type => type.name)
			, ["Witness", "Token", "Marker", "Mark"]);
		assert.deepEqual(zeroPayloadPerlCallerArgs(route), [
			...selection.resultOnly ? ["--result-only"] : []
			, ...selection.reviewed ? ["--reviewed"] : []
		]);
	}
	assert.deepEqual(zeroPayloadPerlEnvironment({}), {
		enabled: false, routes: zeroPayloadPerlRoutes, maxLoad: 12
	});
	assert.deepEqual(zeroPayloadPerlEnvironment({ CI: "true" }), {
		enabled: false, routes: zeroPayloadPerlRoutes, maxLoad: 8
	});
	assert.deepEqual(zeroPayloadPerlEnvironment({
		LEAN_BRIDGE_ZERO_PAYLOAD_PERL_TEST: "1"
		, LEAN_BRIDGE_ZERO_PAYLOAD_PERL_ROUTES: "reviewed-ir"
		, LEAN_BRIDGE_ZERO_PAYLOAD_PERL_MAX_LOAD: "20"
	}), { enabled: true, routes: ["reviewed-ir"], maxLoad: 20 });
	for(const environment of [
		{ LEAN_BRIDGE_ZERO_PAYLOAD_PERL_TEST: "2" }
		, { LEAN_BRIDGE_ZERO_PAYLOAD_PERL_ROUTES: "ordinary-source" }
		, { LEAN_BRIDGE_ZERO_PAYLOAD_PERL_OUTPUT: "build/out" }
		, { LEAN_BRIDGE_ZERO_PAYLOAD_PERL_TEST: "1", LEAN_BRIDGE_ZERO_PAYLOAD_PERL_ROUTES: "ordinary" }
		, { LEAN_BRIDGE_ZERO_PAYLOAD_PERL_TEST: "1"
			, LEAN_BRIDGE_ZERO_PAYLOAD_PERL_ROUTES: "ordinary-source,ordinary-source" }
		, { LEAN_BRIDGE_ZERO_PAYLOAD_PERL_TEST: "1", LEAN_BRIDGE_ZERO_PAYLOAD_PERL_MAX_LOAD: "7" }
	]) assert.throws(() => zeroPayloadPerlEnvironment(environment));
});

test("independent zero-payload Perl caller rejects model faults and preserves exact carriers", async t => {
	const source = await zeroPayloadPerlCaller();
	assert.match(source, /Independent Perl caller/u);
	assert.match(source, /sub check_zero_payload_records/u);
	assert.match(source, /my \$false = \$call->\('false'\);/u);
	assert.match(source, /my \$true = \$call->\('true'\);/u);
	assert.doesNotMatch(source
		, /\$invoke->\('(maybe_witness|produce_mark)', \[[01]\]/u);
	for(const probe of [
		"'Witness'", "'Token'", "'Marker'", "'Mark::Blank'", "'Mark::Marked'"
		, "'produce_witness'", "'produce_token'", "'witnesses'", "'maybe_witness'"
		, "'produce_marker'", "'produce_mark'", "'absent_count'"
		, "Unit payload must be undef", "negative Witness count"
	]) assert.ok(source.includes(probe), probe);
	for(const route of zeroPayloadPerlRoutes)
	{
		const stdout = execFileSync(perl, [model, caller, ...zeroPayloadPerlCallerArgs(route)]
			, { encoding: "utf8" });
		parseZeroPayloadPerlResult(stdout, route);
		t.diagnostic(`${route}: immutable caller model passed`);
	}
	const faults = JSON.parse(execFileSync(perl, [model, caller, "--faults"]
		, { encoding: "utf8" }));
	assert.deepEqual(faults, {
		full: ["accept-invalid", "wrong-message", "wrong-produced", "missing-producer"
			, "option-collapsed", "array-length", "host-accepts-undef"]
		, "result-only": ["wrong-produced", "missing-producer", "inputs-exported"
			, "option-collapsed", "array-length"]
	});
	for(const [mode, counts] of Object.entries(zeroPayloadPerlCounts))
		for(const key of Object.keys(counts))
		{
			const changed = { ...counts, [key]: counts[key] + 1 };
			const route = mode === "full" ? "ordinary-source" : "result-only-ordinary-source";
			assert.throws(() => parseZeroPayloadPerlResult(`${JSON.stringify(changed)}\n`, route));
		}
	assert.equal(await zeroPayloadPerlCaller(), source);
	assert.match(await readFile(model, "utf8"), /Independent Perl model/u);
});
