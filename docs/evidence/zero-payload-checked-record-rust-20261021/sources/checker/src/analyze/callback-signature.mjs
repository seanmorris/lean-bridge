/**
 * Distinguish borrowed callable results without changing existing signature IDs.
 *
 * @file
 */

/**
 * Use local parameter positions so reviewed names cannot change callback identity.
 *
 * @param {{ parameters: Array<{ name: string, type: unknown }>, result: {
 * type: unknown, ownership: string, lifetime?: { scope: string, anchor: string | null } | null
 * } }} callable - Checked callable sites before native layout selection.
 */
export const callbackSemanticSignature = callable => {
	const signature = { parameters: callable.parameters.map(value => value.type), result: callable.result.type };
	if(callable.result.ownership !== "borrow") return signature;
	const parameter = callable.parameters.findIndex(value => value.name === callable.result.lifetime?.anchor);
	if(callable.result.lifetime?.scope !== "parameter" || parameter < 0)
		throw new TypeError("Borrowed callback results require a local parameter anchor");
	return { ...signature, resultAnchor: parameter };
};
