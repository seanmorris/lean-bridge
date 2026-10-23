/**
 * Run the dependent-record public caller in a page, React effect or worker.
 *
 * @file
 */
import { checkDependentRecords } from "./check.mjs";

/**
 * Delegate the complete corpus to an installed API.
 *
 * @param request - Explicit package, context and author selection.
 * @param api - Installed generated public exports.
 */
export const executeCorpus = (request, api) => {
	if(request.module !== "dependentrecords")
		throw new Error("Wrong dependent checked-record package");
	if(!["browser-javascript", "browser-react", "browser-worker"]
		.includes(request.profile))
		throw new Error("Wrong dependent checked-record browser context");
	if(typeof request.resultOnly !== "boolean")
		throw new Error("Missing dependent checked-record result-only selection");
	if(!["ordinary-source", "reviewed-ir", "result-only-ordinary-source"
		, "result-only-reviewed-ir"].includes(request.route)
		|| request.resultOnly !== request.route.startsWith("result-only-"))
		throw new Error("Wrong dependent checked-record author selection");
	const reviewed = request.route.endsWith("reviewed-ir");
	return {
		module: request.module, route: request.route
		, resultOnly: request.resultOnly
		, ...checkDependentRecords(api, request.resultOnly, reviewed)
	};
};
