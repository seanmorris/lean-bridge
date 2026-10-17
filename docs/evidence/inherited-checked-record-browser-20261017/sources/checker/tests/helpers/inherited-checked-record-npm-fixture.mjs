/**
 * Closed npm selections for inherited checked records.
 * Author route and API mode remain independent evidence dimensions.
 *
 * @file
 */
import assert from "node:assert/strict";
import {
	inheritedCheckedRecordConfiguration
	, inheritedCheckedRecordReview
} from "./inherited-checked-record-fixture.mjs";

export const inheritedCheckedRecordNpmRoutes = Object.freeze([
	"ordinary-full", "ordinary-result-only"
	, "reviewed-full", "reviewed-result-only"
]);

/** Exact public sites exercised by each installed-package caller. */
export const inheritedCheckedRecordNpmPositions = Object.freeze({
	full: Object.freeze([
		"first.arg0", "normalized.arg0", "pair.arg0", "pair.arg1"
		, "aliased.arg0", "nested.arg0", "echo.arg0", "echo.result"
		, "produce.result", "produceStamped.result"
	])
	, "result-only": Object.freeze([
		"produce.result", "produceStamped.result"
	])
});
const resultNames = new Set(["produce", "produceStamped"]);

const reviewFor = mode => {
	const review = inheritedCheckedRecordReview();
	if(mode === "full") return review;
	review.declarations = review.declarations.filter(item => resultNames.has(item.name));
	review.types = review.types.filter(type => type.name !== "TicketAlias");
	return review;
};

const configurationFor = (authorRoute, mode) => {
	const configuration = inheritedCheckedRecordConfiguration(authorRoute, ["npm"]);
	if(authorRoute === "reviewed" || mode === "full") return configuration;
	configuration.exports = configuration.exports.filter(name =>
		resultNames.has(name.split(".").at(-1)));
	configuration.contracts = Object.fromEntries(Object.entries(
		configuration.contracts
	).filter(([name]) => resultNames.has(name.split(".").at(-1))));
	if(!Object.keys(configuration.contracts).length) delete configuration.contracts;
	return configuration;
};

/**
 * Return the immutable author selection for one installed route.
 *
 * @param route - Exact author route and API mode.
 */
export const inheritedCheckedRecordNpmSelection = route => {
	assert.ok(inheritedCheckedRecordNpmRoutes.includes(route)
		, "Unknown inherited checked-record npm route");
	const reviewed = route.startsWith("reviewed-");
	const resultOnly = route.endsWith("result-only");
	const mode = resultOnly ? "result-only" : "full";
	const authorRoute = reviewed ? "reviewed" : "ordinary";
	return {
		route, reviewed, resultOnly, mode
		, expected: reviewFor(mode)
		, configuration: configurationFor(authorRoute, mode)
	};
};

/**
 * Exact caller counts for the independently selected package.
 *
 * @param route - Exact author route and API mode.
 */
export const inheritedCheckedRecordNpmExpected = route => {
	const { resultOnly } = inheritedCheckedRecordNpmSelection(route);
	return resultOnly
		? { checks: 1042, rejections: 0, calls: 518, snapshots: 518
			, recoveries: 0, rounds: 256 }
		: { checks: 5680, rejections: 1291, calls: 2839, snapshots: 2839
			, recoveries: 256, rounds: 256 };
};
