/**
 * Native and CPAN target selections for the shared owned checked-record corpus.
 *
 * @file
 */
import assert from "node:assert/strict";
import { ownedCheckedRecordJavaScriptRoutes } from "./owned-checked-record-javascript-fixture.mjs";
import { ownedCheckedRecordMixedSelection } from "./owned-checked-record-mixed-fixture.mjs";

export const ownedCheckedRecordNativeRoutes
	= ownedCheckedRecordJavaScriptRoutes;

/**
 * Replace only the downstream package targets of one authenticated selection.
 *
 * @param route - Ordinary/reviewed and full/result-only route.
 * @param profiles - Native profiles to publish.
 */
export const ownedCheckedRecordNativeSelection = (route, profiles) => {
	assert.ok(Array.isArray(profiles) && profiles.length > 0);
	assert.ok(profiles.every(profile => ["c", "cpp", "cpan"].includes(profile)));
	const selected = ownedCheckedRecordMixedSelection(route);
	const configuration = structuredClone(selected.configuration);
	const packageName = selected.resultOnly
		? "owned-checked-records-result-only" : "owned-checked-records";
	configuration.targets = Object.fromEntries(profiles.map(profile => [profile
		, profile === "cpan"
			? { module: "LeanBridge::OwnedCheckedRecords", version: "1.000" }
			: { name: packageName, version: "1.0.0" }
	]));
	return Object.freeze({ ...selected, configuration });
};
