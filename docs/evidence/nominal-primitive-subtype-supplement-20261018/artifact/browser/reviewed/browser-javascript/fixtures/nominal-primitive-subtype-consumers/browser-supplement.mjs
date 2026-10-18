/**
 * Run the supplemental strict-constructor and variant-refusal caller inside a page,
 * React effect or worker. The original browser.mjs entry and its counts are unchanged.
 *
 * @file
 */
import { checkNominalPrimitiveSupplement } from "./javascript-supplement.mjs";

/**
 * Validate the requested full package and route before invoking its public exports.
 *
 * @param request - Exact package, context and author route; only the full API applies.
 * @param api - Installed public API in this execution realm.
 */
export const executeCorpus = (request, api) => {
	const keys = ["module", "profile", "route", "mode", "resultOnly"].sort();
	if(!request || typeof request !== "object" || Object.keys(request).sort().join() !== keys.join())
		throw new Error("Incomplete nominal supplement request");
	if(request.module !== "nominalprimitivesubtypes") throw new Error("Wrong nominal package");
	if(!["browser-javascript", "browser-react", "browser-worker"].includes(request.profile))
		throw new Error("Wrong nominal browser context");
	if(!["ordinary", "reviewed"].includes(request.route)) throw new Error("Wrong nominal author route");
	if(request.mode !== "full" || request.resultOnly !== false) throw new Error("The supplement needs the full API");
	const { module, route, mode } = request;
	return { module, route, mode, resultOnly: false, ...checkNominalPrimitiveSupplement(api) };
};
