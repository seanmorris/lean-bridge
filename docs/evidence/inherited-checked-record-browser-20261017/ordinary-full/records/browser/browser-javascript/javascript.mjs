/**
 * Run the same inherited checked-record caller in a page, React effect or worker.
 *
 * @file
 */
import { checkInheritedCheckedRecords } from "./check.mjs";

/**
 * Delegate the complete corpus to the installed API in this execution realm.
 *
 * @param request - Explicit package, profile, route and API selection.
 * @param api - Installed generated public exports.
 */
export const executeCorpus = (request, api) => {
	if(request.module !== "inheritedcheckedrecords")
		throw new Error("Wrong inherited checked-record package");
	if(!["browser-javascript", "browser-react", "browser-worker"].includes(
		request.profile
	)) throw new Error("Wrong inherited checked-record browser context");
	if(typeof request.resultOnly !== "boolean")
		throw new Error("Missing inherited checked-record API selection");
	if(![
		"ordinary-full", "ordinary-result-only"
		, "reviewed-full", "reviewed-result-only"
	].includes(request.route)
		|| request.resultOnly !== request.route.endsWith("result-only"))
		throw new Error("Wrong inherited checked-record author selection");
	return {
		module: request.module, route: request.route, resultOnly: request.resultOnly
		, ...checkInheritedCheckedRecords(api, { resultOnly: request.resultOnly })
	};
};
