/**
 * Native C/C++ selections and immutable callers for dependent checked records.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
	dependentCheckedRecordRoutes, dependentCheckedRecordSelection
} from "./dependent-checked-record-browser-fixture.mjs";

export const dependentCheckedRecordNativeProfiles = Object.freeze(["c", "cpp"]);
export const dependentCheckedRecordNativeRoutes = dependentCheckedRecordRoutes;
export const dependentCheckedRecordNativeTarget = Object.freeze({
	name: "dependentrecords", version: "1.0.0"
});

/**
 * Build one exact ordinary/reviewed and full/result-only native selection.
 *
 * @param route - Exact author selection.
 */
export const dependentCheckedRecordNativeSelection = route => {
	const selection = dependentCheckedRecordSelection(route);
	return {
		...selection
		, configuration: {
			...selection.configuration
			, targets: Object.fromEntries(
				dependentCheckedRecordNativeProfiles.map(profile => [
					profile, dependentCheckedRecordNativeTarget
				])
			)
		}
	};
};

/**
 * Load one independently authored C or C++ caller.
 *
 * @param profile - C or C++ profile.
 * @param route - Exact author selection.
 */
export const dependentCheckedRecordNativeCaller = async (profile, route) => {
	assert.ok(dependentCheckedRecordNativeProfiles.includes(profile));
	const { resultOnly, reviewed } = dependentCheckedRecordNativeSelection(route);
	const extension = profile === "c" ? "c" : "cpp";
	let source = await readFile(
		`tests/fixtures/dependent-checked-record-consumers/${resultOnly
			? "result-only-" : ""}${extension}.${extension}`, "utf8"
	);
	if(reviewed)
		source = source.replaceAll(
			'"arg0 was rejected by ', '"value0 was rejected by '
		);
	return {
		source
		, checks: resultOnly ? 513 : 521
	};
};
