/**
 * Native and CPAN target selections for the shared owned checked-record corpus.
 *
 * @file
 */
import assert from "node:assert/strict";
import { checkedRefinementSelection } from "../../src/analyze/checked-refinement-selection.mjs";
import {
	ownedCheckedRecordModule, ownedCheckedRecordReviewedIr
} from "./owned-checked-record-fixture.mjs";
import {
	ownedCheckedRecordJavaScriptRoutes
	, ownedCheckedRecordJavaScriptSelection
} from "./owned-checked-record-javascript-fixture.mjs";

export const ownedCheckedRecordNativeRoutes
	= ownedCheckedRecordJavaScriptRoutes;

const qualified = name => `${ownedCheckedRecordModule}.${name}`;

/**
 * Keep the complete mixed-shape corpus in native and Perl full APIs.
 *
 * @param selected - Independent ordinary/reviewed full API selection.
 */
const extendFullSelection = selected => {
	const reviewedIr = structuredClone(selected.reviewedIr);
	const configuration = structuredClone(selected.configuration);
	const complete = ownedCheckedRecordReviewedIr();
	reviewedIr.types.push(complete.types.find(type => type.name === "Grant"));
	const additions = ["bookingSpan", "claimQuota", "echoGrant", "echoClaims"]
		.map(name => complete.declarations.find(item => item.name === name));
	for(const [source, name] of [
		["withClaimCallback", "transferWithClaimCallback"]
		, ["pairClaim", "transferPairClaim"]
	]) {
		const declaration = structuredClone(reviewedIr.declarations.find(item =>
			item.name === source));
		Object.assign(declaration, { id: `lean:${qualified(name)}`, name
			, overloadKey: qualified(name) });
		declaration.source.declaration = qualified(name);
		for(const parameter of declaration.parameters)
			if(parameter.type.kind === "named"
				&& parameter.type.id.startsWith("lean:"))
				parameter.ownership = "transfer";
		additions.push(declaration);
	}
	reviewedIr.declarations.push(...additions);
	if(selected.authorRoute === "ordinary")
		for(const declaration of additions)
		{
			const name = qualified(declaration.name);
			configuration.exports.push(name);
			if(["transferWithClaimCallback", "transferPairClaim"].includes(declaration.name))
			{
				const source = declaration.name === "transferWithClaimCallback"
					? "withClaimCallback" : "pairClaim";
				const contract = structuredClone(configuration.contracts[qualified(source)]);
				for(const [index, parameter] of declaration.parameters.entries())
					contract.parameters[index].ownership = parameter.ownership;
				configuration.contracts[name] = contract;
			}
			else
			{
				const refinements = declaration.source.extensions["lean-lang.org/refinements"];
				configuration.contracts[name] = {
					parameters: declaration.parameters.map((parameter, index) => ({
						ownership: parameter.ownership, lifetime: parameter.lifetime
						, refinement: checkedRefinementSelection(refinements.parameters[index])
					}))
					, result: { ownership: declaration.result.ownership
						, lifetime: declaration.result.lifetime }
				};
			}
		}
	return { ...selected, reviewedIr, configuration };
};

/**
 * Replace only the downstream package targets of one authenticated selection.
 *
 * @param route - Ordinary/reviewed and full/result-only route.
 * @param profiles - Native profiles to publish.
 */
export const ownedCheckedRecordNativeSelection = (route, profiles) => {
	assert.ok(Array.isArray(profiles) && profiles.length > 0);
	assert.ok(profiles.every(profile => ["c", "cpp", "cpan"].includes(profile)));
	const base = ownedCheckedRecordJavaScriptSelection(route);
	const selected = base.resultOnly ? base : extendFullSelection(base);
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
