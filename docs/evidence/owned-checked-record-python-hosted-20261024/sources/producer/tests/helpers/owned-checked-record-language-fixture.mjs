/**
 * Python, Ruby and Rust target selections for the owned checked-record corpus.
 *
 * @file
 */
import assert from "node:assert/strict";
import {
	ownedCheckedRecordJavaScriptRoutes
	, ownedCheckedRecordJavaScriptSelection
} from "./owned-checked-record-javascript-fixture.mjs";

export const ownedCheckedRecordLanguageRoutes
	= ownedCheckedRecordJavaScriptRoutes;
export const ownedCheckedRecordLanguageTargets = Object.freeze({
	python: ["pypi", "lean-owned-checked-records"]
	, ruby: ["rubygems", "lean_bridge_owned_checked_records"]
	, rust: ["cargo", "owned-checked-records"]
});

/**
 * Replace only the downstream package targets of one authenticated selection.
 *
 * @param route - Ordinary/reviewed and full/result-only route.
 * @param profiles - Language profiles to publish.
 */
export const ownedCheckedRecordLanguageSelection = (route, profiles) => {
	assert.ok(Array.isArray(profiles) && profiles.length > 0);
	assert.ok(profiles.every(profile =>
		Object.hasOwn(ownedCheckedRecordLanguageTargets, profile)
	));
	const selected = ownedCheckedRecordJavaScriptSelection(route);
	const configuration = structuredClone(selected.configuration);
	configuration.targets = Object.fromEntries(profiles.map(profile => {
		const [target, name] = ownedCheckedRecordLanguageTargets[profile];
		const suffix = selected.resultOnly ? "-result-only" : "";
		return [target, { name: `${name}${suffix}`, version: "1.0.0" }];
	}));
	return Object.freeze({ ...selected, configuration });
};
