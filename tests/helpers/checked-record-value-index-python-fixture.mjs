/**
 * Explicit Python selections for proof-erased checked records with closed
 * compiler-derived value indices.
 *
 * This is a source foundation only. Installed wheel acceptance belongs to the
 * dedicated Python value-index lane; do not treat this helper as host support.
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

export const checkedRecordValueIndexPythonRoutes
	= checkedRecordValueIndexBrowserRoutes;
export const checkedRecordValueIndexPythonTarget = Object.freeze({
	name: checkedRecordValueIndexPackage, version: "1.0.0"
});
export const checkedRecordValueIndexPythonPackage
	= `lean_${checkedRecordValueIndexPackage}`;

/**
 * Independent installed-caller totals, separate from package implementation.
 *
 * @param route - Exact full/result-only and ordinary/reviewed route.
 */
export const checkedRecordValueIndexPythonExpected = route => {
	const { resultOnly } = checkedRecordValueIndexPythonSelection(route);
	return resultOnly
		? { calls: 8, checks: 25, recoveries: 0, rejections: 0, snapshots: 0 }
		: { calls: 28, checks: 65, recoveries: 6, rejections: 6, snapshots: 20 };
};

/** Load the immutable Python caller without consulting generated package output. */
export const checkedRecordValueIndexPythonCaller = () => readFile(
	"tests/fixtures/checked-record-value-index-python/python.py", "utf8"
);

/**
 * Preserve the independently authored ordinary/reviewed route while changing
 * only the consumer coordinate. The Binding IR remains compiler authority.
 *
 * @param route - Exact full/result-only and ordinary/reviewed route.
 */
export const checkedRecordValueIndexPythonSelection = route => {
	assert.ok(checkedRecordValueIndexPythonRoutes.includes(route)
		, "Unknown value-index Python route");
	const selection = checkedRecordValueIndexBrowserSelection(route);
	return {
		...selection
		, configuration: {
			...selection.configuration
			, targets: { pypi: checkedRecordValueIndexPythonTarget }
		}
	};
};
