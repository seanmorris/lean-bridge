/**
 * Closed npm selections for nested checked records.
 * Author route and API mode remain independent evidence dimensions.
 *
 * @file
 */
import assert from "node:assert/strict";
import {
	nestedCheckedRecordConfiguration,
	nestedCheckedRecordReview
} from "./nested-checked-record-fixture.mjs";

export const nestedCheckedRecordNpmRoutes = Object.freeze([
	"ordinary-full"
	, "ordinary-result-only"
	, "reviewed-full"
	, "reviewed-result-only"
]);

/** Exact public sites exercised by each installed-package caller. */
export const nestedCheckedRecordNpmPositions = Object.freeze({
	full: Object.freeze([
		"first.arg0", "second.arg0", "pair.arg0", "pair.arg1"
		, "inArray.arg0[*]", "inList.arg0[*]", "inOption.arg0?"
		, "inProduct.arg0.0", "inProduct.arg0.1"
		, "inExcept.arg0.ok", "inExcept.arg0.error"
		, "inHolder.arg0.packet", "inChoice.arg0.packet.value"
		, "echoArray.arg0[*]", "echoArray.result[*]"
		, "produceOption.result?", "produceArray.result[*]"
	])
	, "result-only": Object.freeze([
		"produceOption.result?", "produceArray.result[*]"
	])
});

/**
 * Return the immutable author selection for one installed route.
 *
 * @param route - Exact author route and API mode.
 */
export const nestedCheckedRecordNpmSelection = route => {
	assert.ok(nestedCheckedRecordNpmRoutes.includes(route), "Unknown nested checked-record npm route");
	const reviewed = route.startsWith("reviewed-"), resultOnly = route.endsWith("result-only");
	const mode = resultOnly ? "result-only" : "full";
	return {
		route, reviewed, resultOnly, mode
		, expected: nestedCheckedRecordReview(mode)
		, configuration: nestedCheckedRecordConfiguration(reviewed ? "reviewed" : "ordinary", ["npm"], mode)
	};
};

/**
 * Exact caller counts for the independently selected package.
 *
 * @param route - Exact author route and API mode.
 */
export const nestedCheckedRecordNpmExpected = route => {
	const { resultOnly } = nestedCheckedRecordNpmSelection(route);
	return resultOnly
		? { checks: 4023, rejections: 0, calls: 2006, snapshots: 2006, recoveries: 0 }
		: { checks: 10077, rejections: 2017, calls: 5037, snapshots: 5037, recoveries: 1000 };
};
