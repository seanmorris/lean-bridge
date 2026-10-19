/**
 * Explicit native-PHP selections for proof-erased checked records with closed
 * compiler-derived value indices. This is source/caller evidence only.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
	checkedRecordValueIndexBrowserRoutes
	, checkedRecordValueIndexBrowserSelection
	, checkedRecordValueIndexPackage
} from "./checked-record-value-index-browser-fixture.mjs";

export const checkedRecordValueIndexPhpRoutes = checkedRecordValueIndexBrowserRoutes;
export const checkedRecordValueIndexPhpTarget = Object.freeze({
	name: `example/${checkedRecordValueIndexPackage}`, version: "1.0.0"
});
export const checkedRecordValueIndexPhpNamespace = "LeanCheckedrecordvalueindices";

/** Load the immutable weak-mode caller without consulting generated output. */
export const checkedRecordValueIndexPhpCaller = () => readFile(
	"tests/fixtures/checked-record-value-index-php/php.php", "utf8"
);

/**
 * Preserve only author-route switches; strictness is exercised at install time.
 *
 * @param route - Exact full/result-only and ordinary/reviewed route.
 */
export const checkedRecordValueIndexPhpCallerArgs = route => {
	const selection = checkedRecordValueIndexPhpSelection(route);
	return [...selection.resultOnly ? ["--result-only"] : []
		, ...selection.reviewed ? ["--reviewed"] : []];
};

/**
 * Exact independent caller totals, not values reported by the package.
 *
 * @param route - Exact full/result-only and ordinary/reviewed route.
 */
export const checkedRecordValueIndexPhpExpected = route => {
	const { resultOnly } = checkedRecordValueIndexPhpSelection(route);
	return resultOnly
		? { calls: 8, checks: 25, recoveries: 0, rejections: 0, snapshots: 0 }
		: { calls: 28, checks: 65, recoveries: 6, rejections: 6, snapshots: 20 };
};

/**
 * Require exactly the one-line receipt emitted by the immutable caller.
 *
 * @param stdout - Complete caller output.
 * @param route - Exact full/result-only and ordinary/reviewed route.
 */
export const parseCheckedRecordValueIndexPhpResult = (stdout, route) => {
	assert.equal(typeof stdout, "string"); assert.ok(stdout.endsWith("\n"));
	assert.deepEqual(JSON.parse(stdout), checkedRecordValueIndexPhpExpected(route));
	return checkedRecordValueIndexPhpExpected(route);
};

/**
 * Preserve the independently authored full/result-only and ordinary/reviewed route.
 *
 * @param route - Exact full/result-only and ordinary/reviewed route.
 */
export const checkedRecordValueIndexPhpSelection = route => {
	assert.ok(checkedRecordValueIndexPhpRoutes.includes(route)
		, "Unknown value-index native PHP route");
	const selection = checkedRecordValueIndexBrowserSelection(route);
	return {
		...selection
		, configuration: {
			...selection.configuration
			, targets: { "php-native": checkedRecordValueIndexPhpTarget }
		}
	};
};
