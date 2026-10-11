/**
 * Run the same checked-record public caller in a page, React effect or worker.
 *
 * @file
 */
import { checkCheckedRecords } from "./check.mjs";

/**
 * Delegate the complete corpus to the installed API in this execution realm.
 *
 * @param request - Explicit package, profile and result-only selection.
 * @param api - Installed generated public exports.
 */
export const executeCorpus = (request, api) => {
	if(request.module !== "checkedrecords") throw new Error("Wrong checked-record package");
	if(!["browser-javascript", "browser-react", "browser-worker"].includes(request.profile)) throw new Error("Wrong checked-record browser context");
	if(typeof request.resultOnly !== "boolean") throw new Error("Missing checked-record result-only selection");
	if(!["ordinary-source", "reviewed-ir", "result-only-ordinary-source", "result-only-reviewed-ir"].includes(request.route)
		|| request.resultOnly !== request.route.startsWith("result-only-")) throw new Error("Wrong checked-record author selection");
	return { module: request.module, route: request.route, resultOnly: request.resultOnly, ...checkCheckedRecords(api, request.resultOnly) };
};
