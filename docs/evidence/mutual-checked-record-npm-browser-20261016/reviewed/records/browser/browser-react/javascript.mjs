/**
 * Run the same mutually recursive checked-record caller in every browser realm.
 *
 * @file
 */
import { checkMutualCheckedRecords } from "./check.mjs";

/**
 * Execute the complete independent caller in the selected browser realm.
 *
 * @param request - Explicit package, profile and author route.
 * @param api - Installed generated public exports.
 */
export const executeCorpus = (request, api) => {
	if(request.module !== "mutualcheckedrecords")
		throw new Error("Wrong mutual checked-record package");
	if(!["browser-javascript", "browser-react", "browser-worker"].includes(request.profile))
		throw new Error("Wrong mutual checked-record browser context");
	if(!["ordinary", "reviewed"].includes(request.route))
		throw new Error("Wrong mutual checked-record author route");
	return { module: request.module, route: request.route
		, ...checkMutualCheckedRecords(api) };
};
