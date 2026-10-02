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
const layoutHash = (ir, transferredInputs, anchoredResults = false, receiverExports = false, callbackResultAnchors = false) => sha256(canonicalJson(compileOwnedJavaScriptWasmLayout(ir, { transferredInputs, anchoredResults, receiverExports, callbackResultAnchors })));

/**
 * Reuse typed Lean carriers while binding their public contract to wasm32.
 *
 * @param options - Fresh metadata, source identity and component coordinates.
 */
export const createOwnedJavaScriptWasmModel = options => {
	const native = createOwnedCompiledNativeModel({ ...options
		, hostCallbacks: options.hostCallbacks ?? true
		, transferredInputs: options.transferredInputs ?? true
		, anchoredResults: options.anchoredResults ?? true
		, receiverExports: options.receiverExports ?? true });
	return Object.freeze({ ...native, profile: javascriptWasmOwnedProfile
		, pointerBits: 32
		, ownedGraph: { ...native.ownedGraph, transport, layoutSha256: layoutHash(native.bindingIr, Boolean(native.ownedGraph.inputTransfers), Boolean(native.ownedGraph.resultAnchors), Boolean(native.ownedGraph.receiverExports), Boolean(native.ownedGraph.callbackResultAnchors)) } });
};

/**
 * Regenerate architecture-independent Lean code and enforce the target C width.
 *
 * @param model - Checked JavaScript wasm32 ownership component.
 */
export const generateOwnedJavaScriptWasmLeanAdapters = model => {
	const callbackResults = model.schemaVersion === 11;
	const receivers = model.schemaVersion === 10 || (callbackResults && model.ownedGraph?.receiverExports !== undefined);
	const anchoredResults = model.schemaVersion === 9 || ((callbackResults || receivers) && model.ownedGraph?.resultAnchors !== undefined);
	const transferredInputs = model.schemaVersion === 8 || ((callbackResults || receivers || anchoredResults) && model.ownedGraph?.inputTransfers !== undefined);
	const hostCallbacks = model.schemaVersion === 7 || ((callbackResults || receivers || transferredInputs || anchoredResults) && model.ownedGraph?.hostCallbacks !== undefined);
	if(model.profile !== javascriptWasmOwnedProfile || model.pointerBits !== 32 || model.byteOrder !== "little"
		|| ![6, 7, 8, 9, 10, 11].includes(model.schemaVersion) || model.ownedGraph?.schemaVersion !== (callbackResults ? 6 : receivers ? 5 : anchoredResults ? 4 : transferredInputs ? 3 : hostCallbacks ? 2 : 1)
		|| model.ownedGraph.transport !== transport || model.ownedGraph.layoutSha256 !== layoutHash(model.bindingIr, transferredInputs, anchoredResults, receivers, callbackResults))
		throw new TypeError("JavaScript ownership model differs from the checked wasm32 transport");
	const ownedGraph = { ...model.ownedGraph };
	delete ownedGraph.transport; delete ownedGraph.layoutSha256;
	if(canonicalJson(Object.keys(ownedGraph).sort()) !== canonicalJson(["schemaVersion", "module", "metadataSha256", "symbols", ...hostCallbacks ? ["hostCallbacks"] : [], ...transferredInputs ? ["inputTransfers"] : [], ...anchoredResults ? ["resultAnchors"] : [], ...receivers ? ["receiverExports"] : [], ...callbackResults ? ["callbackResultAnchors"] : []].sort()))
		throw new TypeError("Unexpected JavaScript ownership carrier capability");
	const adapters = generateOwnedNativeLeanAdapters({ ...model, profile: "native-library-v1", pointerBits: 64, ownedGraph });
	return { ...adapters, header: adapters.header + '\nLEAN_CASSERT(sizeof(void *) == 4 && sizeof(size_t) == 4);\n' };
};
