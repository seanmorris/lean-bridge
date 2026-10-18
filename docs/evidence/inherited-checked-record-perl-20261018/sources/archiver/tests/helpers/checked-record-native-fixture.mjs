/**
 * Independent checked-record consumers and exact author selections for native packages.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { checkedRecordContracts, checkedRecordReview, refinementsKey } from "./checked-record-fixture.mjs";

export const checkedRecordHostProfiles = Object.freeze(["python", "rust", "ruby", "dotnet", "java", "kotlin", "php-native", "wit-wasi"]);
export const checkedRecordHostExtensions = Object.freeze({
	python: "py", rust: "rs", ruby: "rb", dotnet: "cs"
	, java: "java", kotlin: "kt", "php-native": "php", "wit-wasi": "c" });
export const checkedRecordHostRoutes = Object.freeze(["ordinary-source", "reviewed-ir", "result-only-ordinary-source", "result-only-reviewed-ir"]);
const coordinate = Object.freeze({ name: "checkedrecords", version: "1.0.0" });
export const checkedRecordHostTargets = Object.freeze({
	python: ["pypi", coordinate], rust: ["cargo", coordinate]
	, ruby: ["rubygems", coordinate]
	, dotnet: ["nuget", { name: "Checkedrecords.Api", version: "1.0.0" }]
	, java: ["maven", { name: "org.leanbridge:checkedrecords", version: "1.0.0" }]
	, kotlin: ["maven", { name: "org.leanbridge:checkedrecords", version: "1.0.0" }]
	, "php-native": ["php-native", { name: "example/checkedrecords", version: "1.0.0" }]
	, "wit-wasi": ["wit-wasi", coordinate] });

/**
 * Reject empty or ambiguous selections before any producer starts.
 *
 * @param value - Optional comma-separated selection.
 * @param allowed - Closed list of supported profiles or routes.
 */
export const selectCheckedRecordHosts = (value, allowed = checkedRecordHostProfiles) => {
	if(value === undefined) return [];
	assert.equal(typeof value, "string");
	const selected = value.split(",").sort();
	assert.equal(new Set(selected).size, selected.length, "Duplicate checked-record selection");
	assert.ok(selected.every(item => allowed.includes(item)), "Unknown or empty checked-record selection");
	return selected;
};

/**
 * Produce ordinary configuration or independent review without borrowing compiler output.
 *
 * @param route - Explicit full or result-only source route.
 * @param profiles - Native consumer profiles.
 */
export const checkedRecordHostSelection = (route, profiles) => {
	assert.ok(checkedRecordHostRoutes.includes(route), "Unknown checked-record source route");
	assert.ok(profiles.length && new Set(profiles).size === profiles.length && profiles.every(profile => checkedRecordHostProfiles.includes(profile)));
	const resultOnly = route.startsWith("result-only-"), reviewed = route.endsWith("reviewed-ir");
	const expected = checkedRecordReview();
	if(resultOnly)
	{
		expected.declarations = expected.declarations.filter(item => item.name === "repeated");
		expected.types = expected.types.filter(item => item.name === "Triple");
	}
	const contracts = checkedRecordContracts();
	const exports = resultOnly ? ["CheckedRecords.repeated"] : Object.keys(contracts);
	const targets = Object.fromEntries(profiles.map(profile => checkedRecordHostTargets[profile]));
	return { resultOnly, reviewed, expected
		, checks: resultOnly ? 1002 : 9024
		, configuration: { schemaVersion: 1, modules: ["CheckedRecords"], targets
			, ...reviewed ? {} : { exports, contracts: Object.fromEntries(exports.map(name => [name, contracts[name]])) } } };
};

const calls = {
	python: /\bapi\.([a-z_]+)\(/gu, rust: /\bapi::([a-z_]+)\(/gu
	, ruby: /\bAPI\.([a-z_]+)\(/gu, dotnet: /\bApi\.([A-Za-z]+)\(/gu
	, java: /\bApi\.([A-Za-z]+)\(/gu, kotlin: /\bApi\.([A-Za-z]+)\(/gu
	, "php-native": /\b(width|span|total|first_of|smallest|scale|repeated|complement)\(/gu
	, "wit-wasi": /\b(?:call|small_call|triple_call|rejected)\("([a-z-]+)"/gu
};
const diagnostic = /"arg(\d+) was rejected by (CheckedRecords\.[A-Za-z0-9_]+)"/gu;
const sourceName = name => name[0].toLowerCase() + name.slice(1).replace(/[_-]([a-z])/gu, (_, letter) => letter.toUpperCase());

/**
 * Authenticate ordinary expected errors and optionally replace only their reviewed labels.
 *
 * @param source - Complete independent consumer.
 * @param profile - Native consumer profile.
 * @param reviewed - Whether diagnostic parameter names come from the review.
 * @param resultOnly - Whether the fixture must contain no checked input.
 */
export const checkedRecordHostDiagnostics = (source, profile, reviewed, resultOnly) => {
	assert.ok(checkedRecordHostProfiles.includes(profile));
	const review = checkedRecordReview(); let count = 0;
	const output = source.split("\n").map(line => line.replace(diagnostic, (text, position, constructor) => {
		const names = [...new Set([...line.matchAll(calls[profile])].map(match => sourceName(match[1])))];
		assert.equal(names.length, 1, `Expected one export on a diagnostic line: ${line}`);
		const declaration = review.declarations.find(item => item.id === `lean:CheckedRecords.${names[0]}`);
		const parameter = declaration?.parameters[Number(position)];
		assert.deepEqual(declaration?.source.extensions[refinementsKey]?.parameters[Number(position)], { kind: "checked-record", constructor });
		assert.ok(parameter);
		count++;
		return reviewed ? JSON.stringify(`${parameter.name} was rejected by ${constructor}`) : text;
	})).join("\n");
	assert.equal(count, resultOnly ? 0 : 13, "Missing or unexpected constructor diagnostic");
	return output;
};

/**
 * Remove only the two explicit input sections for a standalone result-only caller.
 *
 * @param source - Complete independent consumer.
 */
export const checkedRecordResultOnlySource = source => {
	for(const name of ["HELPERS", "CASES"])
	{
		const start = new RegExp(`^[\\t ]*(?:#|//) BEGIN CHECKED INPUT ${name}\\n`, "mu");
		const end = new RegExp(`^[\\t ]*(?:#|//) END CHECKED INPUT ${name}\\n`, "mu");
		assert.equal(source.match(new RegExp(start.source, "gmu"))?.length, 1, `Missing unique ${name} start`);
		assert.equal(source.match(new RegExp(end.source, "gmu"))?.length, 1, `Missing unique ${name} end`);
		const first = start.exec(source), last = end.exec(source);
		assert.ok(first.index < last.index);
		source = source.slice(0, first.index) + source.slice(last.index + last[0].length);
	}
	return source;
};

/**
 * Load ordinary caller bytes and change only reviewed diagnostic labels or explicit sections.
 *
 * @param profile - Native consumer profile.
 * @param route - Explicit full or result-only source route.
 */
export const checkedRecordHostConsumer = async (profile, route) => {
	const selection = checkedRecordHostSelection(route, [profile]);
	let source = await readFile(`tests/fixtures/checked-record-consumers/${profile}.${checkedRecordHostExtensions[profile]}`, "utf8");
	if(selection.resultOnly) source = checkedRecordResultOnlySource(source);
	return checkedRecordHostDiagnostics(source, profile, selection.reviewed, selection.resultOnly);
};
