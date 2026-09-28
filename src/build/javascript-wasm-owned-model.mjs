/**
 * Compiler-authenticated owned values for the shared JavaScript wasm32 runtime.
 *
 * @file
 */
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { createOwnedCompiledNativeModel, generateOwnedNativeLeanAdapters } from "./owned-native-model.mjs";
import { compileOwnedJavaScriptWasmLayout } from "../backends/javascript/owned-wasm-layout.mjs";

export const javascriptWasmOwnedProfile = "javascript-wasm-owned-v1";
const transport = "owned-wasm32-control-v1";
const layoutHash = ir => sha256(canonicalJson(compileOwnedJavaScriptWasmLayout(ir)));

/**
 * Reuse typed Lean carriers while binding their public contract to wasm32.
 *
 * @param options - Fresh metadata, source identity and component coordinates.
 */
export const createOwnedJavaScriptWasmModel = options => {
	const native = createOwnedCompiledNativeModel({ ...options, hostCallbacks: true });
	return Object.freeze({ ...native, profile: javascriptWasmOwnedProfile
		, pointerBits: 32
		, ownedGraph: { ...native.ownedGraph, transport, layoutSha256: layoutHash(native.bindingIr) } });
};

/**
 * Regenerate architecture-independent Lean code and enforce the target C width.
 *
 * @param model - Checked JavaScript wasm32 ownership component.
 */
export const generateOwnedJavaScriptWasmLeanAdapters = model => {
	if(model.profile !== javascriptWasmOwnedProfile || model.pointerBits !== 32 || model.byteOrder !== "little"
		|| model.schemaVersion !== 7 || model.ownedGraph?.schemaVersion !== 2
		|| model.ownedGraph.transport !== transport || model.ownedGraph.layoutSha256 !== layoutHash(model.bindingIr))
		throw new TypeError("JavaScript ownership model differs from the checked wasm32 transport");
	const ownedGraph = { ...model.ownedGraph };
	delete ownedGraph.transport; delete ownedGraph.layoutSha256;
	if(canonicalJson(Object.keys(ownedGraph).sort()) !== canonicalJson(["schemaVersion", "module", "metadataSha256", "symbols", "hostCallbacks"].sort()))
		throw new TypeError("Unexpected JavaScript ownership carrier capability");
	const adapters = generateOwnedNativeLeanAdapters({ ...model, profile: "native-library-v1", pointerBits: 64, ownedGraph });
	return { ...adapters, header: adapters.header + '\nLEAN_CASSERT(sizeof(void *) == 4 && sizeof(size_t) == 4);\n' };
};
