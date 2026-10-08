/**
 * Derive checked-constructor selections from reviewed declarations.
 * Constructor typing remains the fresh Lean compiler's responsibility.
 *
 * @file
 */
import { assertRefinement } from "../abi/refinements.mjs";
import { compilerExportSelection, validateExportConfiguration } from "./export-configuration.mjs";

const key = "lean-lang.org/refinements";
const exportName = item => item.source.extensions["lean-lang.org/specialization"]?.name ?? item.source.declaration;
const fail = () => { throw new TypeError("Invalid reviewed Subtype constructor decision"); };
const contractSite = (site, refinement) => {
	assertRefinement(refinement, site.type);
	if(refinement?.kind === "subtype" && (site.ownership !== "copy" || site.lifetime !== null)) fail();
	return { ownership: site.ownership, lifetime: structuredClone(site.lifetime)
		, ...(refinement?.kind === "subtype" ? { refinement: { constructor: refinement.constructor } } : {}) };
};

/**
 * Select only the constructors named at top-level primitive Subtype sites.
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
		if(value === undefined) continue;
		if(!value || typeof value !== "object" || Array.isArray(value)
			|| Object.keys(value).length !== 2 || !Object.hasOwn(value, "parameters") || !Object.hasOwn(value, "result")
			|| !Array.isArray(value.parameters) || value.parameters.length !== declaration.parameters.length
			|| (value.result === null && value.parameters.every(item => item === null))) fail();
		const parameters = declaration.parameters.map((site, index) => contractSite(site, value.parameters[index]));
		const result = contractSite(declaration.result, value.result);
		if(!parameters.some(site => site.refinement) && !result.refinement) continue;
		entries.push([exportName(declaration), { parameters, result }]);
	}
	if(!entries.length) return undefined;
	const configuration = { schemaVersion: 1, exports, contracts: Object.fromEntries(entries) };
	validateExportConfiguration(configuration);
	return compilerExportSelection(configuration).contracts;
};
