/**
 * Execute the optional-parameter caller in its actual page or worker realm.
 *
 * @file
 */
import { checkOptionalParameters } from "./check.mjs";

/**
 * Delegate every assertion to the copied caller and installed public API.
 *
 * @param request - Selected package and browser context.
 * @param api - Installed generated public API.
 */
export const executeCorpus = (request, api) => {
	if(request.module !== "optional-parameters")
		throw new Error("Wrong optional-parameter package");
	return { module: request.module, ...checkOptionalParameters(api) };
};
