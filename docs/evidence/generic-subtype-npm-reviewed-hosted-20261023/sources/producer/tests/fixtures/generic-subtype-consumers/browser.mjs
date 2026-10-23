/**
 * Run generic Subtype compositions in a page, React effect or dedicated worker.
 *
 * @file
 */
import { checkGenericSubtypeCompositions } from "./javascript.mjs";

/**
 * Validate the exact installed-package request before invoking public exports.
 *
 * @param request - Exact package, route and browser realm.
 * @param api - Installed public npm API.
 */
export const executeCorpus = (request, api) => {
	const keys = ["genericCompositions", "module", "profile", "route"].sort();
	if(!request || typeof request !== "object" || Object.keys(request).sort().join() !== keys.join())
		throw new Error("Incomplete generic Subtype browser request");
	if(request.module !== "nominalsubtypes" || request.genericCompositions !== true)
		throw new Error("Wrong generic Subtype package");
	if(!["browser-javascript", "browser-react", "browser-worker"].includes(request.profile))
		throw new Error("Wrong generic Subtype browser context");
	if(!["ordinary", "reviewed"].includes(request.route))
		throw new Error("Wrong generic Subtype author route");
	return {
		module: request.module
		, route: request.route
		, genericCompositions: true
		, ...checkGenericSubtypeCompositions(api) };
};
