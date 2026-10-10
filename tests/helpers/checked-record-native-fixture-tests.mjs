/**
 * Keep all native checked-record callers independent of producer output.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { validateExportConfiguration } from "../../src/analyze/export-configuration.mjs";
import { validateReviewedSource } from "../../src/analyze/reviewed-source.mjs";
import { checkedRecordHostProfiles, checkedRecordHostRoutes, checkedRecordHostExtensions, checkedRecordHostConsumer, checkedRecordHostDiagnostics, checkedRecordHostSelection, checkedRecordResultOnlySource, selectCheckedRecordHosts } from "./checked-record-native-fixture.mjs";
import { checkedRecordNativeGenerators } from "./checked-record-native-hosts.mjs";

test("checked-record installed selections retain all eight hosts and four source routes", () => {
	assert.deepEqual(checkedRecordHostProfiles, ["python", "rust", "ruby", "dotnet", "java", "kotlin", "php-native", "wit-wasi"]);
	assert.ok(Object.isFrozen(checkedRecordHostProfiles));
	assert.ok(Object.isFrozen(checkedRecordHostRoutes));
	assert.deepEqual(selectCheckedRecordHosts(undefined), []);
	assert.deepEqual(selectCheckedRecordHosts("ruby,python"), ["python", "ruby"]);
	for(const value of ["", "python,", "python,python", " python", "python,ruby ", "c", "cpp", "perl", "php-wasm", "unknown"])
		assert.throws(() => selectCheckedRecordHosts(value));
	for(const route of checkedRecordHostRoutes)
	{
		const selection = checkedRecordHostSelection(route, checkedRecordHostProfiles);
		validateExportConfiguration(selection.configuration);
		const source = canonicalJson(selection.expected);
		validateReviewedSource({ schemaVersion: 1, path: "api.binding-ir.json", source, sourceSha256: sha256(source), semanticSha256: hashBindingIr(selection.expected) });
		assert.equal(selection.expected.declarations.length, selection.resultOnly ? 1 : 8);
		assert.equal(selection.checks, selection.resultOnly ? 1002 : 9024);
		assert.equal(selection.expected.types.length, selection.resultOnly ? 1 : 3);
		if(selection.reviewed)
		{
			assert.equal(selection.configuration.contracts, undefined);
			assert.equal(selection.configuration.exports, undefined);
		} else assert.equal(selection.configuration.exports.length, selection.resultOnly ? 1 : 8);
		for(const profile of checkedRecordHostProfiles) assert.ok(checkedRecordNativeGenerators[profile](selection.expected));
	}
	assert.throws(() => checkedRecordHostSelection("unknown", ["python"]));
	assert.throws(() => checkedRecordHostSelection("reviewed-ir", []));
	assert.throws(() => checkedRecordHostSelection("reviewed-ir", ["python", "python"]));
});

test("each native caller preserves ordinary bytes and changes only authenticated reviewed labels", async () => {
	for(const profile of checkedRecordHostProfiles)
	{
		const raw = await readFile(`tests/fixtures/checked-record-consumers/${profile}.${checkedRecordHostExtensions[profile]}`, "utf8");
		const ordinary = await checkedRecordHostConsumer(profile, "ordinary-source");
		assert.equal(ordinary, raw, profile);
		const reviewed = await checkedRecordHostConsumer(profile, "reviewed-ir");
		assert.equal(reviewed.replace(/"value(\d+) was rejected by /gu, '"arg$1 was rejected by '), raw, profile);
		assert.equal((reviewed.match(/"value\d+ was rejected by /gu) ?? []).length, 13);
		for(const constructor of ["mkInterval", "mkTriple", "sortedTriple", "mkPercent"])
			assert.ok(reviewed.includes(`was rejected by CheckedRecords.${constructor}`), profile);
		const cases = raw.split("BEGIN CHECKED INPUT CASES\n")[1].split("END CHECKED INPUT CASES")[0];
		assert.equal((cases.match(/\b(?:check|Check|CHECK)!?\(/gu) ?? []).length, 30, profile);
		const repetitions = profile === "rust" ? /\b1000u64\b/gu : /\b1000\b/gu;
		assert.equal((cases.match(repetitions) ?? []).length, 1, profile);
	}
});

test("result-only callers remove only their two explicit input sections", async () => {
	for(const profile of checkedRecordHostProfiles)
	{
		const raw = await checkedRecordHostConsumer(profile, "ordinary-source");
		const source = await checkedRecordHostConsumer(profile, "result-only-ordinary-source");
		assert.equal(source, checkedRecordResultOnlySource(raw));
		assert.equal(await checkedRecordHostConsumer(profile, "result-only-reviewed-ir"), source);
		assert.doesNotMatch(source, /was rejected by|BEGIN CHECKED INPUT|END CHECKED INPUT/u);
		const repetitions = profile === "rust" ? /\b1000u64\b/gu : /\b1000\b/gu;
		assert.equal((source.match(repetitions) ?? []).length, 1, profile);
		assert.ok(source.includes("checked-record-ok:"), profile);
		assert.ok(source.includes("repeated") || source.includes("Repeated"), profile);
		for(const marker of ["BEGIN CHECKED INPUT HELPERS", "END CHECKED INPUT HELPERS", "BEGIN CHECKED INPUT CASES", "END CHECKED INPUT CASES"])
			assert.throws(() => checkedRecordResultOnlySource(raw.replace(marker, "missing")), undefined, profile);
	}
});

test("checked-record diagnostic controls reject changed constructors, positions and missing checks", async () => {
	for(const profile of checkedRecordHostProfiles)
	{
		const source = await checkedRecordHostConsumer(profile, "ordinary-source");
		for(const changed of [source.replace("arg0 was rejected by CheckedRecords.mkInterval", "arg1 was rejected by CheckedRecords.mkInterval")
			, source.replace("arg0 was rejected by CheckedRecords.mkInterval", "arg0 was rejected by CheckedRecords.mkTriple")
			, source.replace("arg0 was rejected by CheckedRecords.mkInterval", "incorrect message")
			, source.replace("arg0 was rejected by CheckedRecords.mkInterval", "arg9 was rejected by CheckedRecords.mkInterval")])
			assert.throws(() => checkedRecordHostDiagnostics(changed, profile, true, false), undefined, profile);
		assert.throws(() => checkedRecordHostDiagnostics(source, profile, true, true));
	}
});
