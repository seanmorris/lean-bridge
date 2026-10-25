/**
 * Complete mixed owned checked-record selection shared by installed host tests.
 *
 * @file
 */
import { checkedRefinementSelection } from "../../src/analyze/checked-refinement-selection.mjs";
import {
	ownedCheckedRecordModule, ownedCheckedRecordReviewedIr
} from "./owned-checked-record-fixture.mjs";
import { ownedCheckedRecordJavaScriptSelection } from "./owned-checked-record-javascript-fixture.mjs";

const qualified = name => `${ownedCheckedRecordModule}.${name}`;

/**
 * Keep the complete mixed-shape corpus in full APIs.
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
 * Extend the independently stated full contract without changing result-only APIs.
 *
 * @param route - Ordinary/reviewed and full/result-only route.
 */
export const ownedCheckedRecordMixedSelection = route => {
	const base = ownedCheckedRecordJavaScriptSelection(route);
	return Object.freeze(base.resultOnly ? base : extendFullSelection(base));
};
