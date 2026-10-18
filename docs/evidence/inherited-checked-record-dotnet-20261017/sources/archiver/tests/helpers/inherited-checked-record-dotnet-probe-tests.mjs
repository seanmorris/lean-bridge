/**
 * Check exact full/result-only compiler probe expectations.
 *
 * @file
 */
import assert from "node:assert/strict";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import {
	checkInheritedCheckedRecordDotnetProbe
	, inheritedCheckedRecordDotnetApiProbe
	, inheritedCheckedRecordDotnetInputNames
} from "./inherited-checked-record-dotnet-probe.mjs";

const cwd = "/tmp/lean-bridge-inherited-dotnet-probe";
const location = expression => {
	const line = inheritedCheckedRecordDotnetApiProbe.split("\n")
		.findIndex(source => source.includes(expression)) + 1;
	assert.ok(line > 0);
	return [{ physicalLocation: {
		artifactLocation: { uri: pathToFileURL(join(cwd, "probe.cs")).href }
		, region: { startLine: line, endLine: line }
	} }];
};
const resultOnlyResults = [
	...inheritedCheckedRecordDotnetInputNames.map(name => ({
		ruleId: "CS0117", level: "error"
		, message: { text: `'Api' does not contain a definition for '${name}'` }
		, locations: location(`nameof(Api.${name})`)
	}))
];
const record = (mode, results = resultOnlyResults) => ({
	cwd
	, restore: { code: 0, stdout: "restored", stderr: "" }
	, build: { code: mode === "full" ? 0 : 1, stdout: "compiled", stderr: "" }
	, diagnostics: { version: "2.1.0", runs: [{ results }] }
	, outputs: mode === "full"
		? { "Probe.dll": { bytes: 10, sha256: "a".repeat(64) } } : {}
});

test("inherited checked-record C# API probe names every input and carrier", () => {
	assert.deepEqual(inheritedCheckedRecordDotnetInputNames, [
		"First", "Normalized", "Pair", "Aliased", "Nested", "Echo"
	]);
	for(const name of inheritedCheckedRecordDotnetInputNames)
		assert.ok(inheritedCheckedRecordDotnetApiProbe.includes(`nameof(Api.${name})`));
	for(const name of ["Produce", "ProduceStamped", "Span", "Ticket", "Stamped"])
		assert.ok(inheritedCheckedRecordDotnetApiProbe.includes(name));
});

test("inherited checked-record C# API probe accepts exact full and result-only records", () => {
	checkInheritedCheckedRecordDotnetProbe(record("full", []), "full");
	checkInheritedCheckedRecordDotnetProbe(record("result-only"), "result-only");
	assert.throws(() => checkInheritedCheckedRecordDotnetProbe(
		record("result-only", resultOnlyResults.slice(1)), "result-only"
	));
	const changed = structuredClone(resultOnlyResults);
	changed[0].message.text = "changed";
	assert.throws(() => checkInheritedCheckedRecordDotnetProbe(
		record("result-only", changed), "result-only"
	));
});
