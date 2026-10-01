/**
 * Public semantic C values and callbacks routed through the owned WIT component.
 * Production package admission and installed receipts are recorded separately.
 *
 * @file
 */
import { generateOwnedCPackage } from "../c/owned-package.mjs";
import { generateOwnedCValues } from "../c/owned-values.mjs";
import { compileOwnedWitGraphModel } from "./owned-graph-model.mjs";
import { renderOwnedWitSession } from "./owned-session.mjs";

/**
 * Reuse checked public value/callback conversions, but route every exported
 * operation and returned closure invocation through an actual WIT call. Retain
 * and copy helpers manipulate local result ownership without running an export.
 *
 * @param options - Authenticated compiler metadata and component identity.
 * @param componentBytes - Compiled binary of the generated WIT projection.
 * @param settings - Optional WIT package coordinates.
 */
export const generateOwnedWitPackage = (options, componentBytes, settings = {}) => {
	let model;
	const generated = generateOwnedCPackage(options, {
		publicPrefix: ownedWitPublicPrefix
		, transferredInputs: options.transferredInputs === true
		, anchoredResults: options.anchoredResults === true
		, receiverExports: options.receiverExports === true
		, render: ({ generated }) => {
			model = compileOwnedWitGraphModel(generated.layout.model.bindingIr, settings, {
				transferredInputs: options.transferredInputs
				, anchoredResults: options.anchoredResults
				, receiverExports: options.receiverExports
			});
			if(generated.layout.header !== model.layout.header) throw new TypeError("Owned WIT and native value layouts must match");
			return renderOwnedWitSession(model, componentBytes);
		}
	});
	return { ...generated, model };
};

/**
 * Resolve a separate host namespace without changing the authenticated IR.
 *
 * @param ir - Authenticated version-4 binding contract.
 * @param options - Explicit public C ownership capabilities.
 */
export const ownedWitPublicPrefix = (ir, options = {}) => `${generateOwnedCValues(ir, options).prefix}_wasmtime`;
