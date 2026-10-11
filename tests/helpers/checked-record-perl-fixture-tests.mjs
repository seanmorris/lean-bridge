/**
 * Verify independently authored Perl callers without claiming installed execution.
 *
 * @file
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { checkedRecordPerlCaller, checkedRecordPerlConsumer, checkedRecordPerlRoutes, checkedRecordPerlSelection } from "./checked-record-perl-fixture.mjs";

test("Perl checked-record fixtures retain independent declarations on all four routes", async () => {
	for(const route of checkedRecordPerlRoutes)
	{
		const selection = checkedRecordPerlSelection(route), source = await checkedRecordPerlConsumer(route);
		assert.deepEqual(selection.configuration.targets, { cpan: { module: "LeanBridge::CheckedRecords", version: "1.000" } });
		assert.equal(selection.expected.declarations.length, selection.resultOnly ? 1 : 8);
		assert.equal(selection.checks, selection.resultOnly ? 1002 : 9024);
		assert.equal(Object.hasOwn(selection.configuration, "contracts"), !selection.reviewed);
		assert.ok(source.includes("for my $i (0 .. 999)"));
		assert.ok(source.includes("refaddr($first->data) != refaddr($second->data)"));
		if(selection.resultOnly)
		{
			assert.doesNotMatch(source, /::(?:Interval|Percent|Triple)->new|was rejected by/u);
			assert.ok(source.includes("::repeated($big)"));
		}
		else
		{
			assert.equal((source.match(/was rejected by CheckedRecords\./gu) ?? []).length, 13);
			assert.ok(source.includes(`${selection.reviewed ? "value1" : "arg1"} was rejected by CheckedRecords.mkInterval`));
			assert.ok(source.includes("values_of($triple->data) eq '9,2,4'"));
		}
		// Compile Perl syntax only. Supplying %INC avoids loading a nonexistent package;
		// -c executes no consumer calls and cannot establish installed acceptance.
		const parsed = spawnSync("perl", ["-c", "-e", `BEGIN { $INC{'LeanBridge/CheckedRecords.pm'} = 1 }\n${source}`], { encoding: "utf8" });
		assert.equal(parsed.status, 0, parsed.stderr);
		assert.match(parsed.stderr, /syntax OK/u);
	}
});

test("Perl checked-record callers reject lost, substituted and unreviewed diagnostics", async () => {
	const source = await readFile("tests/fixtures/checked-record-consumers/perl.pl", "utf8");
	for(const route of ["ordinary-source", "reviewed-ir"])
	{
		assert.throws(() => checkedRecordPerlCaller(source.replace("arg1 was rejected by CheckedRecords.mkInterval", "arg0 was rejected by CheckedRecords.mkTriple"), route));
		assert.throws(() => checkedRecordPerlCaller(source.replace("arg1 was rejected by CheckedRecords.mkInterval", "arg2 was rejected by CheckedRecords.mkInterval"), route));
		assert.throws(() => checkedRecordPerlCaller(source.replace("arg1 was rejected by CheckedRecords.mkInterval", "lost"), route));
	}
	assert.throws(() => checkedRecordPerlSelection("unknown"));
	assert.throws(() => checkedRecordPerlCaller(source.replace("# END CHECKED INPUT CASES", "# Missing marker"), "result-only-reviewed-ir"));
});
