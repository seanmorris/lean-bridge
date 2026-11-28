/** @file Check the dynamic module interface before running its initialization code. */

const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);

/**
 * Require one imported heap/table and only the compiler-bound control export.
 *
 * @param bytes - Compiled side module bytes.
 * @param controlSymbol - Sole component entry point authenticated by its IR.
 * @param hostCallbacks - Require the two callback metadata globals when present.
 */
export const validateJavaScriptWasmControl = async (bytes, controlSymbol, hostCallbacks = true) => {
	if(typeof hostCallbacks !== "boolean") throw new TypeError("JavaScript callback capability must be explicit");
	const suffix = /^lbjs_component_([a-f0-9]{20})_control$(?![\s\S])/.exec(controlSymbol)?.[1];
	if(!suffix) throw new Error("Invalid JavaScript control symbol");
	const module = await WebAssembly.compile(bytes);
	const imports = WebAssembly.Module.imports(module), exports = WebAssembly.Module.exports(module);
	if(!same(imports.filter(item => item.kind === "memory" || item.kind === "table").map(item => [item.module, item.name]).sort(), [["env", "__indirect_function_table"], ["env", "memory"]])
		|| exports.some(item => ["memory", "table"].includes(item.kind)))
		throw new Error("Owned JavaScript components must share the host memory and table");
	// Emscripten reads these two data globals to install the component's EM_JS
	// callbacks. They are metadata, not additional callable or resource exports.
	const expected = [`function:${controlSymbol}`, "function:__wasm_call_ctors"
		, ...hostCallbacks ? [`global:__em_js__lbjs_${suffix}_dispatch_js`
			, `global:__em_js__lbjs_${suffix}_finish_js`] : []].sort();
	// The linker omits this private helper when the module has no data relocations.
	const required = exports.map(item => `${item.kind}:${item.name}`).filter(name => name !== "function:__wasm_apply_data_relocs").sort();
	if(!same(required, expected)
		|| !imports.some(item => item.module === "env" && item.kind === "function" && item.name === "lean_bridge_native_component_initialize"))
		throw Object.assign(new Error("Owned JavaScript components must import the shared broker and export only their checked control function"), {
			details: { controlSymbol, exports, brokerImports: imports.filter(item => item.name.includes("component_initialize")) }
		});
	return module;
};
