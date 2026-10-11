/**
 * Execute the independent structural corpus in its actual page or worker realm.
 *
 * @file
 */
import { checkStructuralSubtypes } from "./check.mjs";

/**
 * Delegate every assertion to the copied caller and installed public API.
 *
 * @param request - Selected package and context.
 * @param api - Installed generated API in the active realm.
 */
export const executeCorpus = (request, api) => {
	if(request.module !== "structuralsubtypes") throw new Error("Wrong structural Subtype package");
	return { module: request.module, ...checkStructuralSubtypes(api) };
};
