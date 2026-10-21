/**
 * Author selections and exact execution totals for zero-payload npm packages.
 *
 * @file
 */
import assert from "node:assert/strict";
import {
	zeroPayloadCheckedRecordContracts
	, zeroPayloadCheckedRecordReview
} from "./zero-payload-checked-record-fixture.mjs";

export const zeroPayloadBrowserName = "zeropayloadcheckedrecords";
export const zeroPayloadBrowserRoutes = Object.freeze([
	"ordinary-source"
	, "reviewed-ir"
	, "result-only-ordinary-source"
	, "result-only-reviewed-ir"
]);
export const zeroPayloadBrowserProfiles = Object.freeze([
	"browser-javascript"
	, "browser-react"
	, "browser-worker"
]);
export const zeroPayloadBrowserEngines = Object.freeze([
	"chromium", "firefox", "webkit"
]);
/**
 * Return exact independent-caller totals for one route.
 *
 * @param route - Exact ordinary/reviewed and full/result-only selection.
 */
export const zeroPayloadBrowserExpected = route => {
	assert.ok(zeroPayloadBrowserRoutes.includes(route));
	return route.startsWith("result-only-")
		? { checks: 22, rejections: 0, calls: 6, snapshots: 6, recoveries: 0 }
		: { checks: 56, rejections: 8, calls: 25, snapshots: 25, recoveries: 8 };
};

/**
 * Select a complete or result-only ordinary/reviewed API.
 *
 * @param route - Exact ordinary/reviewed and full/result-only selection.
 */
export const zeroPayloadBrowserSelection = route => {
	assert.ok(zeroPayloadBrowserRoutes.includes(route), "Unknown zero-payload browser route");
	const resultOnly = route.startsWith("result-only-");
	const reviewed = route.endsWith("reviewed-ir");
	const resultNames = new Set([
		"produceWitness", "produceToken", "witnesses", "maybeWitness", "produceMarker"
	]);
	const expected = zeroPayloadCheckedRecordReview();
	if(resultOnly)
	{
		expected.declarations = expected.declarations.filter(item => resultNames.has(item.name));
		const retained = new Set(expected.declarations.flatMap(item => {
			const names = [];
			const visit = value => {
				if(value?.kind === "named") names.push(value.id.replace(/^lean:/u, ""));
				for(const argument of value?.arguments ?? []) visit(argument);
			};
			visit(item.result.type); return names;
		}));
		expected.types = expected.types.filter(item => retained.has(
			`ZeroPayloadCheckedRecords.${item.name}`
		));
	}
	const contracts = zeroPayloadCheckedRecordContracts();
	const exports = resultOnly
		? Object.keys(contracts).filter(name => resultNames.has(name.split(".").at(-1)))
		: Object.keys(contracts);
	return {
		resultOnly, reviewed, expected
		, configuration: {
			schemaVersion: 1
			, modules: ["ZeroPayloadCheckedRecords"]
			, targets: { npm: { name: zeroPayloadBrowserName, version: "1.0.0" } }
			, ...reviewed ? {} : {
				exports
				, contracts: Object.fromEntries(exports.map(name => [name, contracts[name]]))
			}
		}
	};
};
