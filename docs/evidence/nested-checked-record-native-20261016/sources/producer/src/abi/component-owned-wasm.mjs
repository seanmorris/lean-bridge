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
export const componentOwnedWasmBorrowAbi = 12;
export const componentOwnedWasmReceiverAbi = 13;
export const componentOwnedWasmCallbackResultAbi = 14;

/**
 * Validate the descriptor before loading code or entering the shared heap.
 * Compiled metadata authentication must still succeed before initialization.
 *
 * @param abi - Generated owned Wasm descriptor.
 * @param bindingIr - Public compiler-authenticated binding contract.
 */
export const assertComponentOwnedWasmBindings = (abi, bindingIr) => {
	const fields = ["callbackKey", "controlSymbol", "dispatch", "initializer", "layout", "version"];
	const callbackResults = abi?.version === componentOwnedWasmCallbackResultAbi;
	const receivers = abi?.version === componentOwnedWasmReceiverAbi || (callbackResults && Object.hasOwn(abi, "receiverExports"));
	const anchored = abi?.version === componentOwnedWasmBorrowAbi || ((callbackResults || receivers) && Object.hasOwn(abi, "resultAnchors"));
	const transfers = abi?.version === componentOwnedWasmTransferAbi || ((callbackResults || receivers || anchored) && Object.hasOwn(abi, "inputTransfers"));
	if(transfers) fields.push("inputTransfers");
	if(anchored) fields.push("resultAnchors");
	if(receivers) fields.push("receiverExports");
	if(callbackResults) fields.push("callbackResultAnchors");
	if(!abi || canonicalizeJsonValue(Object.keys(abi).sort()) !== canonicalizeJsonValue(fields.sort())
		|| ![componentOwnedWasmAbi, componentOwnedWasmTransferAbi, componentOwnedWasmBorrowAbi, componentOwnedWasmReceiverAbi, componentOwnedWasmCallbackResultAbi].includes(abi.version) || abi.dispatch !== "owned-wasm32-control-v1"
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
		const parameters = [...fn.receiver ? [fn.receiver] : [], ...fn.parameters].flatMap((parameter, index) => parameter.ownership === "transfer" ? [index] : []);
		return parameters.length ? [{ bindingId: fn.id, parameters }] : [];
	});
	if(Boolean(consuming.length) !== transfers || (transfers && canonicalizeJsonValue(abi.inputTransfers) !== canonicalizeJsonValue({
		schemaVersion: 1, frameBytes: 16, groupBytes: 8, consumedOffset: 12
		, exports: consuming
	}))) throw new TypeError("Owned Wasm input-transfer capability mismatch");
	const anchors = bindingIr.declarations.filter(fn => fn.result.ownership === "borrow").map(fn => {
		const index = fn.parameters.findIndex(parameter => parameter.name === fn.result.lifetime?.anchor);
		return { bindingId: fn.id
			, parameter: fn.result.lifetime?.scope === "receiver" && fn.receiver ? 0
			: index < 0 ? -1 : index + (fn.receiver ? 1 : 0) };
	});
	const expectedAnchors = { schemaVersion: 1, anchor: "original-result-owner"
		, maximumDepth: 128, exports: anchors };
	if(Boolean(anchors.length) !== anchored || (anchored && (anchors.some(fn => fn.parameter < 0)
		|| canonicalizeJsonValue(abi.resultAnchors) !== canonicalizeJsonValue(expectedAnchors))))
		throw new TypeError("Owned Wasm result-anchor capability mismatch");
	const members = bindingIr.declarations.filter(fn => fn.receiver).map(fn => ({
		bindingId: fn.id, kind: fn.kind, owner: fn.owner, argument: 0
	}));
	if(Boolean(members.length) !== receivers || (receivers && canonicalizeJsonValue(abi.receiverExports) !== canonicalizeJsonValue({
		schemaVersion: 1, callingConvention: "receiver-first", exports: members
	}))) throw new TypeError("Owned Wasm receiver capability mismatch");
	const callbacks = bindingIr.types.filter(type => type.kind === "callback" && type.callable.result.ownership === "borrow").map(type => ({
		id: type.id
		, parameter: type.callable.result.lifetime?.scope === "parameter"
			? type.callable.parameters.findIndex(parameter => parameter.name === type.callable.result.lifetime.anchor) : -1
	}));
	const expectedCallbacks = { schemaVersion: 1, anchor: "original-argument-owner"
		, maximumDepth: 128, signatures: callbacks };
	if(Boolean(callbacks.length) !== callbackResults || (callbackResults && (callbacks.some(value => value.parameter < 0)
		|| canonicalizeJsonValue(abi.callbackResultAnchors) !== canonicalizeJsonValue(expectedCallbacks))))
		throw new TypeError("Owned Wasm callback result-anchor capability mismatch");
	return sha256Text(canonicalizeJsonValue(abi));
};
