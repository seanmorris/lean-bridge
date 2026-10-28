/**
 * Compiler-authenticated owned values on the shared PHP-Wasm target.
 *
 * @file
 */
import { canonicalJson } from "../capsule/node.mjs";
import { createOwnedCompiledNativeModel, generateOwnedNativeLeanAdapters } from "./owned-native-model.mjs";
import { compileOwnedPhpZendModel } from "../backends/php/owned-zend-model.mjs";

const transport = "owned-zend-v1";
const layoutHash = (ir, transferredInputs, anchoredResults = false, receiverExports = false, callbackResultAnchors = false, hostCallbacks = true) => compileOwnedPhpZendModel(ir, { transferredInputs, anchoredResults, receiverExports, callbackResultAnchors, hostCallbacks }).layoutSha256;

/**
 * Typed Lean carriers are target-independent. The Zend layout, machine words
 * and C compilation are explicitly wasm32. The historical compiled profile
 * names the shared PHP-Wasm target; ownedGraph authenticates its ownership ABI.
 *
 * @param options - Measured compiler metadata, source identity and coordinates.
 */
export const createOwnedPhpWasmModel = options => {
	const native = createOwnedCompiledNativeModel({ ...options
		, hostCallbacks: options.hostCallbacks ?? true
		, transferredInputs: options.transferredInputs ?? true
		, receiverExports: options.receiverExports ?? true
		, anchoredResults: options.anchoredResults ?? true
		, callbackResultAnchors: options.callbackResultAnchors ?? true });
	return Object.freeze({ ...native
		, profile: "php-wasm-copied-v1", pointerBits: 32
		, ownedGraph: { ...native.ownedGraph, transport, layoutSha256: layoutHash(native.bindingIr, Boolean(native.ownedGraph.inputTransfers), Boolean(native.ownedGraph.resultAnchors), Boolean(native.ownedGraph.receiverExports), Boolean(native.ownedGraph.callbackResultAnchors), Boolean(native.ownedGraph.hostCallbacks)) } });
};

/**
 * Reuse the authenticated architecture-neutral Lean helpers, not a native
 * library or native C layout. Compile-time assertions enforce the Zend width.
 *
 * @param model - Reconstructed ownership component for the PHP-Wasm target.
 */
export const generateOwnedPhpWasmLeanAdapters = model => {
	const callbackResults = model.schemaVersion === 11;
	const receivers = model.schemaVersion === 10 || (callbackResults && model.ownedGraph?.receiverExports !== undefined);
	const anchoredResults = model.schemaVersion === 9 || ((callbackResults || receivers) && model.ownedGraph?.resultAnchors !== undefined);
	const transferredInputs = model.schemaVersion === 8 || ((callbackResults || receivers || anchoredResults) && model.ownedGraph?.inputTransfers !== undefined);
	const hostCallbacks = model.schemaVersion === 7 || ((callbackResults || receivers || transferredInputs || anchoredResults) && model.ownedGraph?.hostCallbacks !== undefined);
	if(model.profile !== "php-wasm-copied-v1" || model.pointerBits !== 32 || model.byteOrder !== "little"
		|| ![6, 7, 8, 9, 10, 11].includes(model.schemaVersion) || model.ownedGraph?.schemaVersion !== (callbackResults ? 6 : receivers ? 5 : anchoredResults ? 4 : transferredInputs ? 3 : hostCallbacks ? 2 : 1)
		|| (!callbackResults && model.ownedGraph.callbackResultAnchors !== undefined)
		|| (!hostCallbacks && model.ownedGraph.hostCallbacks !== undefined)
		|| model.ownedGraph.transport !== transport || model.ownedGraph.layoutSha256 !== layoutHash(model.bindingIr, transferredInputs, anchoredResults, receivers, callbackResults, hostCallbacks))
		throw new TypeError("PHP-Wasm ownership model differs from the checked 32-bit transport");
	const ownedGraph = { ...model.ownedGraph };
	delete ownedGraph.transport; delete ownedGraph.layoutSha256;
	const semantic = { ...model, profile: "native-library-v1", pointerBits: 64, ownedGraph };
	const adapters = generateOwnedNativeLeanAdapters(semantic);
	const expected = [
		"schemaVersion", "module", "metadataSha256", "symbols"
		, ...hostCallbacks ? ["hostCallbacks"] : []
		, ...transferredInputs ? ["inputTransfers"] : []
		, ...anchoredResults ? ["resultAnchors"] : []
		, ...receivers ? ["receiverExports"] : []].sort();
	if(callbackResults) expected.push("callbackResultAnchors");
	expected.sort();
	if(canonicalJson(Object.keys(ownedGraph).sort()) !== canonicalJson(expected))
		throw new TypeError("Unexpected PHP-Wasm ownership carrier capability");
	return { ...adapters
		, header: adapters.header + '\nLEAN_CASSERT(sizeof(void *) == 4 && sizeof(size_t) == 4);\n' };
};
