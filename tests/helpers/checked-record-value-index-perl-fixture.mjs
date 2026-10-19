/**
 * Explicit CPAN selections and independent Perl caller for closed value indices.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
	checkedRecordValueIndexBrowserRoutes, checkedRecordValueIndexBrowserSelection
} from "./checked-record-value-index-browser-fixture.mjs";

export const checkedRecordValueIndexPerlModule
	= "LeanBridge::CheckedRecordValueIndices";
export const checkedRecordValueIndexPerlRoutes
	= checkedRecordValueIndexBrowserRoutes;
export const checkedRecordValueIndexPerlConfigurations = Object.freeze([
	"5.36.3-threaded", "5.36.3-unthreaded"
	, "5.38.2-threaded", "5.38.2-unthreaded"
]);
export const checkedRecordValueIndexPerlModes = Object.freeze([
	"prebuilt-only", "build-xs"
]);

/**
 * Replace only npm coordinates with the exact CPAN component coordinate.
 *
 * @param route - Exact ordinary/reviewed and full/result-only route.
 */
export const checkedRecordValueIndexPerlSelection = route => {
	const selection = checkedRecordValueIndexBrowserSelection(route);
	return {
		...selection
		, configuration: {
			...selection.configuration
			, targets: {
				cpan: { module: checkedRecordValueIndexPerlModule, version: "1.000" }
			}
		}
	};
};

/**
 * Expected compact receipt from the independent installed Perl caller.
 *
 * @param route - Exact author/API route.
 */
export const checkedRecordValueIndexPerlExpected = route => {
	const { resultOnly } = checkedRecordValueIndexPerlSelection(route);
	return resultOnly
		? { calls: 8, checks: 9, recoveries: 0, rejections: 0, snapshots: 0 }
		: { calls: 28, checks: 49, recoveries: 6, rejections: 6, snapshots: 14 };
};

/**
 * Select one immutable caller specialization before package production.
 *
 * @param route - Exact author/API route.
 * @param source - Original caller source with no package-derived edits.
 */
export const checkedRecordValueIndexPerlCaller = (route, source) => {
	const selection = checkedRecordValueIndexPerlSelection(route);
	assert.equal(typeof source, "string");
	assert.match(source, /ROUTE_PREFIX/u);
	assert.match(source, /ROUTE_RESULT_ONLY/u);
	return source.replaceAll("ROUTE_PREFIX", selection.reviewed ? "value0" : "arg0")
		.replaceAll("ROUTE_RESULT_ONLY", selection.resultOnly ? "1" : "0");
};

/**
 * Load an independently authored caller without consulting generated outputs.
 *
 * @param route - Exact author/API route.
 * @param reader - Optional immutable-source reader.
 */
export const checkedRecordValueIndexPerlConsumer = async (
	route, reader = path => readFile(path, "utf8")
) => checkedRecordValueIndexPerlCaller(route, await reader(
	"tests/fixtures/checked-record-value-index-perl/perl.pl"
));
