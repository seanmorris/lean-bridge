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
	checkNestedCheckedRecordDotnetProbe
	, nestedCheckedRecordDotnetApiProbe
	, nestedCheckedRecordDotnetInputNames
	, nestedCheckedRecordDotnetInputTypes
} from "./nested-checked-record-dotnet-probe.mjs";

const cwd = "/tmp/lean-bridge-nested-dotnet-probe";
const location = expression => {
	const line = nestedCheckedRecordDotnetApiProbe.split("\n")
		.findIndex(source => source.includes(expression)) + 1;
	assert.ok(line > 0);
	return [{ physicalLocation: {
		artifactLocation: { uri: pathToFileURL(join(cwd, "probe.cs")).href }
		, region: { startLine: line, endLine: line }
	} }];
};
const resultOnlyResults = [
	...nestedCheckedRecordDotnetInputNames.map(name => ({
		ruleId: "CS0117", level: "error"
		, message: { text: `'Api' does not contain a definition for '${name}'` }
		, locations: location(`nameof(Api.${name})`)
	}))
	, ...nestedCheckedRecordDotnetInputTypes.map(name => ({
		ruleId: "CS0246", level: "error"
		, message: { text: `The type or namespace name '${name}' could not be found (are you missing a using directive or an assembly reference?)` }
		, locations: location(`${name}? ${name}Value`)
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

test("nested checked-record C# API probe names every input and carrier", () => {
	assert.equal(nestedCheckedRecordDotnetInputNames.length, 11);
	assert.deepEqual(nestedCheckedRecordDotnetInputTypes, [
		"Holder", "Choice", "ChoiceEmpty", "ChoicePacket"
	]);
	for(const name of nestedCheckedRecordDotnetInputNames)
		assert.ok(nestedCheckedRecordDotnetApiProbe.includes(`nameof(Api.${name})`));
	for(const name of ["Packet", "Option<Packet>", "Result<Packet, Packet>"])
		assert.ok(nestedCheckedRecordDotnetApiProbe.includes(name));
});

test("nested checked-record C# API probe accepts exact full and result-only records", () => {
	checkNestedCheckedRecordDotnetProbe(record("full", []), "full");
	checkNestedCheckedRecordDotnetProbe(record("result-only"), "result-only");
	assert.throws(() => checkNestedCheckedRecordDotnetProbe(
		record("result-only", resultOnlyResults.slice(1)), "result-only"
	));
	const changed = structuredClone(resultOnlyResults);
	changed[0].message.text = "changed";
	assert.throws(() => checkNestedCheckedRecordDotnetProbe(
		record("result-only", changed), "result-only"
	));
});
