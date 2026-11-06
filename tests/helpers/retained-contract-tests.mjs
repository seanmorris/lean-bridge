/**
 * Register immutable history and retained-evidence contracts only in a lane that
 * materializes their complete input closure. Installed consumer lanes still run
 * every current-behavior test from the parent module.
 *
 * @file
 */
import assert from "node:assert/strict";

export const retainedContractScopes = Object.freeze(["required", "deferred"]);

/**
 * Resolve and validate the retained-contract policy for this test process.
 *
 * @param environment - Process environment or a focused-test substitute.
 */
export const retainedContractScope = (environment = process.env) => {
	const scope = environment.LEAN_BRIDGE_RETAINED_CONTRACTS ?? "required";
	assert.ok(retainedContractScopes.includes(scope)
		, `LEAN_BRIDGE_RETAINED_CONTRACTS must be one of: ${retainedContractScopes.join(", ")}`);
	return scope;
};

/**
 * Register exact-history/evidence test modules in their declared order.
 * Loaders are functions so imports remain relative to their owning test module.
 *
 * @param loaders - Ordered deferred module loaders.
 * @param environment - Process environment or a focused-test substitute.
 */
export const registerRetainedContractTests = async (loaders, environment = process.env) => {
	assert.ok(Array.isArray(loaders) && loaders.every(loader => typeof loader === "function")
		, "Retained contract loaders must be functions");
	const scope = retainedContractScope(environment);
	if(scope === "deferred") return Object.freeze({ scope, registered: 0 });
	for(const loader of loaders) await loader();
	return Object.freeze({ scope, registered: loaders.length });
};
