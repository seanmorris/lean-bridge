/**
 * Independent Perl checked-record selections and caller diagnostics.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { checkedRecordContracts, checkedRecordReview, refinementsKey } from "./checked-record-fixture.mjs";
import { checkedRecordResultOnlySource } from "./checked-record-native-fixture.mjs";

export const checkedRecordPerlModule = "LeanBridge::CheckedRecords";
export const checkedRecordPerlRoutes = Object.freeze([
	"ordinary-source", "reviewed-ir"
	, "result-only-ordinary-source", "result-only-reviewed-ir"
]);

/**
 * Select full or standalone result-only declarations before any compiler runs.
 *
 * @param route - Explicit ordinary or independently reviewed route.
 */
export const checkedRecordPerlSelection = route => {
	assert.ok(checkedRecordPerlRoutes.includes(route), "Unknown Perl checked-record route");
	const expected = checkedRecordReview(), resultOnly = route.startsWith("result-only-");
	const reviewed = route.endsWith("reviewed-ir");
	if(resultOnly)
	{
		expected.declarations = expected.declarations.filter(item => item.name === "repeated");
		expected.types = expected.types.filter(item => item.name === "Triple");
	}
	const contracts = checkedRecordContracts();
	const exports = resultOnly ? ["CheckedRecords.repeated"] : Object.keys(contracts);
	return { resultOnly, reviewed, expected, checks: resultOnly ? 1002 : 9024
		, configuration: { schemaVersion: 1, modules: ["CheckedRecords"]
			, targets: { cpan: { module: checkedRecordPerlModule, version: "1.000" } }
			, ...reviewed ? {} : { exports, contracts: Object.fromEntries(exports.map(name => [name, contracts[name]])) } } };
};

/**
 * Authenticate every expected constructor diagnostic before changing reviewed labels.
 *
 * @param source - Independently authored Perl caller.
 * @param route - Explicit full or result-only source route.
 */
export const checkedRecordPerlCaller = (source, route) => {
	const selection = checkedRecordPerlSelection(route);
	if(selection.resultOnly) source = checkedRecordResultOnlySource(source);
	let diagnostics = 0;
	const output = source.split("\n").map(line => line.replace(/"arg(\d+) was rejected by (CheckedRecords\.[A-Za-z0-9_]+)"/gu, (message, index, constructor) => {
		const names = [...new Set([...line.matchAll(/LeanBridge::CheckedRecords::([a-z_]+)\(/gu)].map(match => match[1].replace(/_([a-z])/gu, (_, letter) => letter.toUpperCase())))];
		assert.equal(names.length, 1, "Expected one export on each diagnostic line");
		const declaration = selection.expected.declarations.find(item => item.name === names[0]);
		const parameter = declaration?.parameters[Number(index)];
		assert.ok(parameter, "Unknown checked-record diagnostic parameter");
		assert.deepEqual(declaration.source.extensions[refinementsKey].parameters[Number(index)], { kind: "checked-record", constructor });
		diagnostics++;
		return selection.reviewed ? JSON.stringify(`${parameter.name} was rejected by ${constructor}`) : message;
	})).join("\n");
	assert.equal(diagnostics, selection.resultOnly ? 0 : 13, "Missing checked-record constructor diagnostics");
	return output;
};

/**
 * Load the original caller and transform only the selected sections or reviewed labels.
 *
 * @param route - Explicit full or result-only source route.
 */
export const checkedRecordPerlConsumer = async route => checkedRecordPerlCaller(
	await readFile("tests/fixtures/checked-record-consumers/perl.pl", "utf8"), route,
);
