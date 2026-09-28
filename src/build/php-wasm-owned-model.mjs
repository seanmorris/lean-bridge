/**
 * Compiler-authenticated owned values on the shared PHP-Wasm target.
 *
 * @file
 */
import { canonicalJson } from "../capsule/node.mjs";
import { createOwnedCompiledNativeModel, generateOwnedNativeLeanAdapters } from "./owned-native-model.mjs";
import { compileOwnedPhpZendModel } from "../backends/php/owned-zend-model.mjs";

const transport = "owned-zend-v1";
const layoutHash = ir => compileOwnedPhpZendModel(ir).layoutSha256;

/**
 * Typed Lean carriers are target-independent. The Zend layout, machine words
 * and C compilation are explicitly wasm32. The historical compiled profile
 * names the shared PHP-Wasm target; ownedGraph authenticates its ownership ABI.
 *
 * @param options - Measured compiler metadata, source identity and coordinates.
 */
export const createOwnedPhpWasmModel = options => {
	const native = createOwnedCompiledNativeModel({ ...options, hostCallbacks: true });
	return Object.freeze({ ...native
		, profile: "php-wasm-copied-v1", pointerBits: 32
		, ownedGraph: { ...native.ownedGraph, transport, layoutSha256: layoutHash(native.bindingIr) } });
};

/**
 * Reuse the authenticated architecture-neutral Lean helpers, not a native
 * library or native C layout. Compile-time assertions enforce the Zend width.
 *
 * @param model - Reconstructed ownership component for the PHP-Wasm target.
 */
export const generateOwnedPhpWasmLeanAdapters = model => {
	if(model.profile !== "php-wasm-copied-v1" || model.pointerBits !== 32 || model.byteOrder !== "little"
		|| model.schemaVersion !== 7 || model.ownedGraph?.schemaVersion !== 2
		|| model.ownedGraph.transport !== transport || model.ownedGraph.layoutSha256 !== layoutHash(model.bindingIr))
		throw new TypeError("PHP-Wasm ownership model differs from the checked 32-bit transport");
	const ownedGraph = { ...model.ownedGraph };
	delete ownedGraph.transport; delete ownedGraph.layoutSha256;
	const semantic = { ...model, profile: "native-library-v1", pointerBits: 64, ownedGraph };
	const adapters = generateOwnedNativeLeanAdapters(semantic);
	const expected = ["schemaVersion", "module", "metadataSha256", "symbols", "hostCallbacks"].sort();
	if(canonicalJson(Object.keys(ownedGraph).sort()) !== canonicalJson(expected))
		throw new TypeError("Unexpected PHP-Wasm ownership carrier capability");
	return { ...adapters
		, header: adapters.header + '\nLEAN_CASSERT(sizeof(void *) == 4 && sizeof(size_t) == 4);\n' };
};
