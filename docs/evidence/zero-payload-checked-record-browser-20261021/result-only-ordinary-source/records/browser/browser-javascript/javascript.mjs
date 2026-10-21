/**
 * Execute the same zero-payload caller in a page, React effect or worker.
 *
 * @file
 */
import { checkZeroPayloadRecords } from "./check.mjs";

/**
 * Delegate the immutable caller to the installed API in this execution realm.
 *
 * @param request - Exact package, route and browser profile.
 * @param api - Installed generated public API.
 */
export const executeCorpus = (request, api) => {
	if(request.module !== "zeropayloadcheckedrecords")
		throw new Error("Wrong zero-payload package");
	if(!["browser-javascript", "browser-react", "browser-worker"].includes(
		request.profile
	)) throw new Error("Wrong zero-payload browser context");
	if(typeof request.resultOnly !== "boolean")
		throw new Error("Missing zero-payload result-only selection");
	if(![
		"ordinary-source", "reviewed-ir"
		, "result-only-ordinary-source", "result-only-reviewed-ir"
	].includes(request.route)
		|| request.resultOnly !== request.route.startsWith("result-only-"))
		throw new Error("Wrong zero-payload author selection");
	return {
		module: request.module, route: request.route, resultOnly: request.resultOnly
		, ...checkZeroPayloadRecords(api, request.resultOnly)
	};
};
