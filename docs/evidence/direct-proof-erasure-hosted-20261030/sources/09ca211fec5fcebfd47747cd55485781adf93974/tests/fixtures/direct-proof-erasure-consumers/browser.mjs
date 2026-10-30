/**
 * Execute the direct proof-erasure caller in its actual page or worker realm.
 *
 * @file
 */
import { checkDirectProofErasure } from "./check.mjs";

/**
 * Delegate every assertion to the copied caller and installed public API.
 *
 * @param request - Selected package and browser context.
 * @param api - Installed generated public API.
 */
export const executeCorpus = (request, api) => {
	if(request.module !== "direct-proof-erasure")
		throw new Error("Wrong direct proof-erasure package");
	return { module: request.module, ...checkDirectProofErasure(api) };
};
