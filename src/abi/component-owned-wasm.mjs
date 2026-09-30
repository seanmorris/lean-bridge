/**
 * Browser-safe descriptor authentication for resource-bearing Wasm components.
 * The compiled control entry point carries the digest of this exact descriptor.
 *
 * @file
 */
import { canonicalizeJsonValue } from "../binding-ir/canonical.mjs";
import { sha256Text } from "../binding-ir/sha256.mjs";

export const componentOwnedWasmAbi = 10;
export const componentOwnedWasmTransferAbi = 11;

/**
 * Validate the descriptor before loading code or entering the shared heap.
 * Compiled metadata authentication must still succeed before initialization.
 *
 * @param abi - Generated owned Wasm descriptor.
 * @param bindingIr - Public compiler-authenticated binding contract.
 */
export const assertComponentOwnedWasmBindings = (abi, bindingIr) => {
	const fields = ["callbackKey", "controlSymbol", "dispatch", "initializer", "layout", "version"];
	const transfers = abi?.version === componentOwnedWasmTransferAbi;
	if(transfers) fields.push("inputTransfers");
	if(!abi || canonicalizeJsonValue(Object.keys(abi).sort()) !== canonicalizeJsonValue(fields.sort())
		|| ![componentOwnedWasmAbi, componentOwnedWasmTransferAbi].includes(abi.version) || abi.dispatch !== "owned-wasm32-control-v1"
		|| abi.layout?.schemaVersion !== 1 || abi.layout.kind !== "owned-javascript-wasm32-layout"
		|| abi.layout.native?.wordBits !== 32 || !Array.isArray(abi.layout.types)
		|| !Array.isArray(abi.layout.native.functions) || !Array.isArray(abi.layout.native.callbacks))
		throw new TypeError("Invalid owned Wasm component descriptor");
	const hash = sha256Text(canonicalizeJsonValue(bindingIr));
	if(hash !== abi.layout.native.model?.bindingIrSha256
		|| canonicalizeJsonValue(bindingIr) !== canonicalizeJsonValue(abi.layout.native.model.bindingIr)
		|| abi.controlSymbol !== `lbjs_component_${hash.slice(0, 20)}_control`
		|| typeof abi.initializer !== "string" || !/^initialize_[A-Za-z_][A-Za-z_0-9]*$/u.test(abi.initializer)
		|| (abi.callbackKey !== null && abi.callbackKey !== `leanBridgeOwnedCallbacks_${hash}`))
		throw new TypeError("Owned Wasm component binding identity mismatch");
	const consuming = bindingIr.declarations.flatMap(fn => {
		const parameters = fn.parameters.flatMap((parameter, index) => parameter.ownership === "transfer" ? [index] : []);
		return parameters.length ? [{ bindingId: fn.id, parameters }] : [];
	});
	if(Boolean(consuming.length) !== transfers || (transfers && canonicalizeJsonValue(abi.inputTransfers) !== canonicalizeJsonValue({
		schemaVersion: 1, frameBytes: 16, groupBytes: 8, consumedOffset: 12
		, exports: consuming
	}))) throw new TypeError("Owned Wasm input-transfer capability mismatch");
	return sha256Text(canonicalizeJsonValue(abi));
};
