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
const layoutHash = (ir, transferredInputs, anchoredResults = false) => sha256(canonicalJson(compileOwnedJavaScriptWasmLayout(ir, { transferredInputs, anchoredResults })));

/**
 * Reuse typed Lean carriers while binding their public contract to wasm32.
 *
 * @param options - Fresh metadata, source identity and component coordinates.
 */
export const createOwnedJavaScriptWasmModel = options => {
	const native = createOwnedCompiledNativeModel({ ...options
		, hostCallbacks: true, transferredInputs: true
		, anchoredResults: options.anchoredResults ?? true });
	return Object.freeze({ ...native, profile: javascriptWasmOwnedProfile
		, pointerBits: 32
		, ownedGraph: { ...native.ownedGraph, transport, layoutSha256: layoutHash(native.bindingIr, Boolean(native.ownedGraph.inputTransfers), Boolean(native.ownedGraph.resultAnchors)) } });
};

/**
 * Regenerate architecture-independent Lean code and enforce the target C width.
 *
 * @param model - Checked JavaScript wasm32 ownership component.
 */
export const generateOwnedJavaScriptWasmLeanAdapters = model => {
	const anchoredResults = model.schemaVersion === 9;
	const transferredInputs = model.schemaVersion === 8 || (anchoredResults && model.ownedGraph?.inputTransfers !== undefined);
	if(model.profile !== javascriptWasmOwnedProfile || model.pointerBits !== 32 || model.byteOrder !== "little"
		|| ![7, 8, 9].includes(model.schemaVersion) || model.ownedGraph?.schemaVersion !== (anchoredResults ? 4 : transferredInputs ? 3 : 2)
		|| !model.ownedGraph.hostCallbacks
		|| model.ownedGraph.transport !== transport || model.ownedGraph.layoutSha256 !== layoutHash(model.bindingIr, transferredInputs, anchoredResults))
		throw new TypeError("JavaScript ownership model differs from the checked wasm32 transport");
	const ownedGraph = { ...model.ownedGraph };
	delete ownedGraph.transport; delete ownedGraph.layoutSha256;
	if(canonicalJson(Object.keys(ownedGraph).sort()) !== canonicalJson(["schemaVersion", "module", "metadataSha256", "symbols", "hostCallbacks", ...transferredInputs ? ["inputTransfers"] : [], ...anchoredResults ? ["resultAnchors"] : []].sort()))
		throw new TypeError("Unexpected JavaScript ownership carrier capability");
	const adapters = generateOwnedNativeLeanAdapters({ ...model, profile: "native-library-v1", pointerBits: 64, ownedGraph });
	return { ...adapters, header: adapters.header + '\nLEAN_CASSERT(sizeof(void *) == 4 && sizeof(size_t) == 4);\n' };
};
