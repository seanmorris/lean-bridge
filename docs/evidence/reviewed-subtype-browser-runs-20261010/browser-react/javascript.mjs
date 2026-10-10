/**
 * Run the unchanged reviewed Subtype corpus in a page, React effect or dedicated worker.
 *
 * @file
 */
import { checkReviewedSubtype } from "./check.mjs";

/**
 * Check generated public calls and direct installed-runtime calls in the active realm.
 *
 * @param request - Selected installed package and browser context.
 * @param api - Installed API with its direct runtime entry point.
 */
export const executeCorpus = (request, api) => {
	if(request.module !== "subtypes") throw new Error("Wrong reviewed Subtype package");
	return { module: request.module, ...checkReviewedSubtype(api, api.raw) };
};
