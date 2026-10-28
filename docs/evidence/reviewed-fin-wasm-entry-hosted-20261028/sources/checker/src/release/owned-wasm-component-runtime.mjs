/**
 * Authenticate and initialize owned bindings inside the existing shared loader.
 * Each component shares the loader's retirement state and underlying Lean heap.
 *
 * @file
 */
import { assertComponentOwnedWasmBindings } from "../abi/component-owned-wasm.mjs";
import { createOwnedWasmBindings } from "./owned-wasm-bindings.mjs";
import { createOwnedWasmCalls } from "./owned-wasm-calls.mjs";

/**
 * The caller has already verified and linked the exact side-module bytes.
 * Check compiled metadata before calling the component's own initializer.
 *
 * @param module - Existing shared Emscripten heap.
 * @param descriptor - Snapshotted component descriptor and public binding IR.
 * @param operation - Generated control operation through the shared trampoline.
 * @param lifecycle - The loader's assertOpen and poison hooks.
 */
export const createOwnedWasmComponentRuntime = (module, descriptor, operation, lifecycle) => {
	const expected = assertComponentOwnedWasmBindings(descriptor.privateAbi, descriptor.bindingIr);
	const binding = createOwnedWasmBindings(module, operation, lifecycle, descriptor.privateAbi.callbackKey);
	if(binding.metadataHash() !== expected)
	{
		lifecycle.poison();
		throw new Error("Owned Wasm compiled metadata mismatch");
	}
	const status = binding.initialize();
	if(status)
	{
		lifecycle.poison();
		throw new Error(`Owned Wasm component initialization failed (${status})`);
	}
	try
	{ return createOwnedWasmCalls(module, descriptor.privateAbi.layout, binding.bindings); }
	catch(error)
	{
		try
		{ if(binding.bindings.close()) lifecycle.poison(); }
		catch
		{ lifecycle.poison(); }
		throw error;
	}
};
