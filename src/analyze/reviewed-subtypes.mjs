/**
 * Derive checked-constructor selections from reviewed declarations.
 * Constructor typing remains the fresh Lean compiler's responsibility.
 *
 * @file
 */
import { assertRefinement, callbackDefinitionRefinement, callbackSubtypeDirection } from "../abi/refinements.mjs";
import { checkedRefinementSelection } from "./checked-refinement-selection.mjs";
import { compilerExportSelection, validateExportConfiguration } from "./export-configuration.mjs";

const key = "lean-lang.org/refinements";
const exportName = item => item.source.extensions["lean-lang.org/specialization"]?.name ?? item.source.declaration;
const fail = () => { throw new TypeError("Invalid reviewed Subtype constructor decision"); };
const contractSite = (site, refinement, types, produced = false) => {
	assertRefinement(refinement, site.type, 0, true, types, produced);
	// A Subtype or checked-record constructor is selected per site, over a copied value.
	const selection = checkedRefinementSelection(refinement);
	if(refinement !== null && (site.ownership !== "copy" || site.lifetime !== null)) fail();
	return { ownership: site.ownership, lifetime: structuredClone(site.lifetime)
		, ...(selection ? { refinement: selection } : {}) };
};

const callbackContractSite = (site, types) => {
	if(site.type.kind !== "named") return null;
	const definition = types.find(type => type.id === site.type.id);
	if(definition?.kind !== "callback") return null;
	const refinements = callbackDefinitionRefinement(definition, types);
	if(refinements === null) return null;
	const direction = callbackSubtypeDirection({
		parameters: definition.callable.parameters.map(parameter => parameter.type)
		, result: definition.callable.result.type
	}, refinements, types);
	if(direction === null) return null;
	return {
		ownership: site.ownership
		, lifetime: structuredClone(site.lifetime)
		, callable: {
			parameters: definition.callable.parameters.map((parameter, index) =>
				contractSite(parameter, refinements.parameters[index], types
					, direction === "host"))
			, result: contractSite(
				definition.callable.result, refinements.result, types
				, direction === "closure"
			)
		}
	};
};

/**
 * Select primitive Subtype constructors through structural containers, aliases,
 * copied plain records and variants, and top-level checked-record constructors.
 * The caller must validate the complete Binding IR, including specializations,
 * and reconcile fresh metadata. Contracts use the public specialization name.
 * No contract is added for Fin-only or unrefined declarations. Other sites of a
 * mixed signature retain ownership/lifetime without an invented reject policy.
 *
 * @param document - Reviewed Binding IR, not compiler-produced proof evidence.
 */
export const reviewedSubtypeContracts = document => {
	const exports = document.declarations.map(exportName);
	if(new Set(exports).size !== exports.length) fail();
	const entries = [];
	for(const declaration of document.declarations)
	{
		const value = declaration.source.extensions[key];
		if(value !== undefined && (!value || typeof value !== "object"
			|| Array.isArray(value) || Object.keys(value).length !== 2
			|| !Object.hasOwn(value, "parameters")
			|| !Object.hasOwn(value, "result")
			|| !Array.isArray(value.parameters)
			|| value.parameters.length !== declaration.parameters.length
			|| (value.result === null
				&& value.parameters.every(item => item === null)))) fail();
		const callbackParameters = declaration.parameters.map(site =>
			callbackContractSite(site, document.types));
		const callbackResult = callbackContractSite(
			declaration.result, document.types
		);
		if(value === undefined && !callbackParameters.some(Boolean)
			&& callbackResult === null) continue;
		const parameters = declaration.parameters.map(
			(site, index) => callbackParameters[index] ?? contractSite(
				site, value?.parameters?.[index] ?? null, document.types
			)
		);
		const result = callbackResult ?? contractSite(
			declaration.result, value?.result ?? null, document.types, true
		);
		if(!callbackParameters.some(Boolean) && callbackResult === null
			&& !parameters.some(site => site.refinement)
			&& !result.refinement) continue;
		entries.push([exportName(declaration), { parameters, result }]);
	}
	if(!entries.length) return undefined;
	const configuration = { schemaVersion: 1, exports, contracts: Object.fromEntries(entries) };
	validateExportConfiguration(configuration);
	return compilerExportSelection(configuration).contracts;
};
