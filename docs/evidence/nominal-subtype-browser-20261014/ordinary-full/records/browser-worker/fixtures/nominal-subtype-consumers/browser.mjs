/**
 * Run the unchanged nominal caller inside a page, React effect or worker.
 *
 * @file
 */
import { checkNominalSubtypes } from "./javascript.mjs";

/**
 * Validate the requested package and route before invoking its public exports.
 *
 * @param request - Exact package, context, author route and API mode.
 * @param api - Installed public API in this execution realm.
 */
export const executeCorpus = (request, api) => {
	const keys = ["module", "profile", "route", "mode", "resultOnly"].sort();
	if(!request || typeof request !== "object" || Object.keys(request).sort().join() !== keys.join())
		throw new Error("Incomplete nominal browser request");
	if(request.module !== "nominalsubtypes") throw new Error("Wrong nominal package");
	if(!["browser-javascript", "browser-react", "browser-worker"].includes(request.profile)) throw new Error("Wrong nominal browser context");
	if(!["ordinary", "reviewed"].includes(request.route)) throw new Error("Wrong nominal author route");
	if(!["full", "result-only"].includes(request.mode) || typeof request.resultOnly !== "boolean"
		|| request.resultOnly !== (request.mode === "result-only")) throw new Error("Wrong nominal API mode");
	return { module: request.module, route: request.route, mode: request.mode
		, resultOnly: request.resultOnly
		, ...checkNominalSubtypes(api, { resultOnly: request.resultOnly }) };
};
