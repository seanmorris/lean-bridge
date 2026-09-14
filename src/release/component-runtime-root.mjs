/**
 * Locate the installed shared Wasm runtime for component packaging.
 *
 * @file
 */
import { stat } from "node:fs/promises";
import { join, resolve } from "node:path";

/**
 * Find the runtime without compiling a replacement during package projection.
 *
 * @param options - Installed engine and explicit environment.
 * @param options.engineRoot - Installed engine directory.
 * @param options.environment - Runtime override and process environment.
 */
export const resolveComponentRuntimeRoot = async ({ engineRoot, environment }) => {
	const candidates = environment.LEAN_BRIDGE_RUNTIME_ROOT
		? [environment.LEAN_BRIDGE_RUNTIME_ROOT]
		: [join(engineRoot, "runtime/wasm"), join(engineRoot, "build/lean-link-spike/lazy")];
	for(const candidate of candidates)
	{
		const root = resolve(candidate);
		try
		{
			const files = await Promise.all([stat(join(root, "main.mjs")), stat(join(root, "main.wasm"))]);
			if(files.every(file => file.isFile())) return root;
		} catch(error)
		{ if(error.code !== "ENOENT") throw error; }
	}
	throw Object.assign(new Error("The selected Lean Bridge runtime is missing main.mjs or main.wasm"), { code: "shared-runtime-package-unavailable" });
};
