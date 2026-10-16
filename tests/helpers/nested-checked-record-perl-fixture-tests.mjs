/**
 * Keep every nested checked-record CPAN selection explicit and independently checkable.
 *
 * @file
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { reviewedContractDifference } from "../../src/analyze/reviewed-source.mjs";
import {
	nestedCheckedRecordPerlCaller
	, nestedCheckedRecordPerlConfiguration
	, nestedCheckedRecordPerlModes
	, nestedCheckedRecordPerlModule
	, nestedCheckedRecordPerlReview
	, nestedCheckedRecordPerlRoutes
} from "./nested-checked-record-perl-fixture.mjs";

test("nested checked-record Perl selection closes both author routes and API modes", async () => {
	assert.deepEqual(nestedCheckedRecordPerlRoutes, ["ordinary", "reviewed"]);
	assert.deepEqual(nestedCheckedRecordPerlModes, ["full", "result-only"]);
	for(const route of nestedCheckedRecordPerlRoutes)
		for(const mode of nestedCheckedRecordPerlModes)
		{
			const configuration = nestedCheckedRecordPerlConfiguration(route, mode);
			const expected = nestedCheckedRecordPerlReview(mode);
			assert.deepEqual(configuration.targets, {
				cpan: { module: nestedCheckedRecordPerlModule, version: "1.000" }
			});
			assert.equal(Object.hasOwn(configuration, "contracts"), route === "ordinary");
			assert.equal(Object.hasOwn(configuration, "exports"), route === "ordinary");
			assert.equal(expected.declarations.length, mode === "full" ? 13 : 2);
			if(route === "ordinary")
				assert.deepEqual(configuration.exports
					, expected.declarations.map(item => item.source.declaration));
			const source = await nestedCheckedRecordPerlCaller(route, mode);
			assert.ok(source.includes("my $rounds = 256"));
			assert.equal(source.includes("refused('first'"), mode === "full");
			assert.equal(source.includes("result-only package omits"), mode === "result-only");
			if(mode === "full") assert.ok(source.includes(route === "ordinary"
				? "arg0.word was rejected" : "value0.word was rejected"));
			const parsed = spawnSync("perl", ["-c", "-e"
				, `BEGIN { $INC{'LeanBridge/NestedCheckedRecords.pm'} = 1 }\n${source}`]
			, { encoding: "utf8" });
			assert.equal(parsed.status, 0, parsed.stderr);
			assert.match(parsed.stderr, /syntax OK/u);
		}
});

test("nested checked-record Perl choices match the independent reviewed contract", () => {
	for(const route of nestedCheckedRecordPerlRoutes)
		for(const mode of nestedCheckedRecordPerlModes)
		{
			const configuration = nestedCheckedRecordPerlConfiguration(route, mode);
			const expected = nestedCheckedRecordPerlReview(mode);
			if(route === "reviewed") continue;
			const reconstructed = nestedCheckedRecordPerlReview(mode);
			for(const declaration of reconstructed.declarations)
			{
				const contract = configuration.contracts[declaration.source.declaration];
				assert.ok(contract, declaration.source.declaration);
				assert.equal(contract.parameters.length, declaration.parameters.length);
			}
			assert.equal(reviewedContractDifference(expected, reconstructed), null);
		}
	assert.throws(() => nestedCheckedRecordPerlConfiguration("unknown", "full"));
	assert.throws(() => nestedCheckedRecordPerlConfiguration("ordinary", "unknown"));
});

test("the immutable Perl caller retains proof-free classes and exact nested failure paths", async () => {
	const source = await readFile(
		"tests/fixtures/nested-checked-record-consumers/perl.pl", "utf8"
	);
	for(const fragment of [
		"LeanBridge::NestedCheckedRecords::Packet->new(digit =>"
		, "LeanBridge::NestedCheckedRecords::Holder->new(packet =>"
		, "LeanBridge::NestedCheckedRecords::Choice::Packet->new(value =>"
		, "ROUTE_PREFIX0.packet.value was rejected by NestedCheckedRecords.mkPacket"
		, "ROUTE_PREFIX0[1].word was rejected by NestedCheckedRecords.mkWord"
		, "ROUTE_PREFIX0.packet.digit is not below its Fin 10 bound"
		, "linked => 1", "snapshot($arguments) eq $before"
	]) assert.ok(source.includes(fragment), fragment);
	assert.equal((source.match(/^# BEGIN (?:FULL|RESULT)_ONLY$/gmu) ?? []).length, 2);
	assert.equal((source.match(/^# END (?:FULL|RESULT)_ONLY$/gmu) ?? []).length, 2);
});
