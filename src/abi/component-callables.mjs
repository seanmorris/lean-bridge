/**
 * Closed private descriptors for synchronous primitive npm callable frames.
 * Compiler, packager and loader share the same admission rules.
 *
 * @file
 */
import { componentScalarTypes } from "./component-scalars.mjs";

export const componentCallableAbi = 3;
export const componentCallableDispatch = "scalar-callable-frame-v1";
export const componentCallableCapacity = 1024;
export const componentCallableDepth = 64;

/**
 * Canonical input for the shared signature-key digest.
 *
 * @param signature - Primitive argument and result references.
 */
export const componentCallableSignatureText = signature => JSON.stringify(["primitive-callable-v1", signature.parameters.map(type => type.name), signature.result.name]);

const fail = message => {
	throw Object.assign(new TypeError(`Invalid component callable ABI: ${message}`), { code: "invalid-component-callable-abi" });
};
const closed = (value, keys) => {
	if(!value || typeof value !== "object" || Array.isArray(value)
		|| Object.keys(value).length !== keys.length || Object.keys(value).some(key => !keys.includes(key))) fail("fields must be closed");
};
const text = value => typeof value === "string" && value.length > 0 && value.length <= 1024;
const scalar = type => {
	closed(type, ["kind", "name"]);
	if(type.kind !== "primitive" || !componentScalarTypes.includes(type.name)) fail("callables require primitive arguments and results");
};

/**
 * Validate descriptors before registering host callbacks or linking callable code.
 * Primitive slots retain scalar ABI 2; callable identities are private uint32 tokens.
 *
 * @param abi - Generated descriptor, independently checked against Binding IR later.
 */
export const assertComponentCallableAbi = abi => {
	closed(abi, ["version", "dispatch", "callbacks", "exports"]);
	if(abi.version !== componentCallableAbi || abi.dispatch !== componentCallableDispatch) fail("unsupported version or dispatch");
	if(!Array.isArray(abi.callbacks) || !abi.callbacks.length || abi.callbacks.length > componentCallableCapacity) fail("invalid callback table");
	const ids = new Set(), keys = new Set();
	for(const callback of abi.callbacks)
	{
		closed(callback, ["id", "key", "parameters", "result"]);
		if(!text(callback.id) || ids.has(callback.id) || typeof callback.key !== "string" || !/^[a-f0-9]{40}$/.test(callback.key) || keys.has(callback.key)) fail("callback identities must be unique");
		ids.add(callback.id); keys.add(callback.key);
		if(!Array.isArray(callback.parameters) || callback.parameters.length < 1 || callback.parameters.length > 16) fail("callback arity must be 1 through 16");
		for(const type of callback.parameters) scalar(type);
		scalar(callback.result);
	}
	const used = new Set(), bindings = new Set(), symbols = new Set();
	const value = type => {
		if(type?.kind === "primitive") return scalar(type);
		closed(type, ["kind", "id"]);
		if(type.kind !== "named" || !ids.has(type.id)) fail("unknown callback type");
		used.add(type.id);
	};
	if(!Array.isArray(abi.exports) || !abi.exports.length || abi.exports.length > 10000) fail("invalid export table");
	for(const item of abi.exports)
	{
		closed(item, ["bindingId", "symbol", "parameters", "result", "resultMode"]);
		if(!text(item.bindingId) || bindings.has(item.bindingId) || typeof item.symbol !== "string" || !/^lean_bridge_[a-f0-9]{24}$/.test(item.symbol) || symbols.has(item.symbol)) fail("export identities must be unique");
		bindings.add(item.bindingId); symbols.add(item.symbol);
		if(item.resultMode !== "value" || !Array.isArray(item.parameters) || item.parameters.length > 32) fail("exports require synchronous calls with at most 32 arguments");
		for(const type of item.parameters) value(type);
		value(item.result);
	}
	if(used.size !== ids.size) fail("unused callback signature");
};

/**
 * Bind transport shapes to the ownership and synchronous effects in Binding IR.
 * The loader separately recomputes each signature key before linking code.
 *
 * @param abi - Closed private descriptor.
 * @param ir - Compiler-checked public Binding IR shipped with the component.
 */
export const assertComponentCallableBindings = (abi, ir) => {
	assertComponentCallableAbi(abi);
	const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
	const callbacks = new Map(abi.callbacks.map(type => [type.id, type]));
	const typeEqual = (a, b) => a?.kind === b?.kind && (a?.kind === "primitive" ? a.name === b.name : a?.kind === "named" && a.id === b.id);
	const site = (value, type, result = false) => {
		const identity = type.kind === "named";
		if(!typeEqual(value.type, type) || value.ownership !== (identity ? result ? "lease" : "borrow" : "copy")) fail("binding ownership or type mismatch");
		if(identity)
		{
			closed(value.lifetime, ["scope", "anchor"]);
			if(value.lifetime.scope !== (result ? "explicit" : "call") || value.lifetime.anchor !== null) fail("binding lifetime mismatch");
		}
		else if(value.lifetime !== null) fail("copied values cannot retain identity");
	};
	const failure = (value, callback) => {
		if(value.mode !== (callback ? "declared" : "none") || value.unexpected !== "poison-runtime" || !same(value.errors, callback ? ["error:native-callback"] : [])) fail("binding failure mismatch");
	};
	const parameters = (actual, expected) => {
		if(actual.length !== expected.length) fail("binding arity mismatch");
		actual.forEach((value, index) => {
			if(value.optional || value.default !== null || value.mutability !== "immutable") fail("unsupported parameter semantics");
			site(value, expected[index]);
		});
	};
	if(ir.types.length !== callbacks.size || new Set(ir.types.map(type => type.id)).size !== callbacks.size) fail("binding callback table mismatch");
	for(const type of ir.types)
	{
		const expected = callbacks.get(type.id), call = type.callable;
		if(!expected || type.kind !== "callback" || type.representation !== "identity" || type.mutability !== "immutable"
			|| type.typeParameters.length || type.fields.length || type.cases.length || type.target !== null || type.resource !== null || type.host !== null) fail("unsupported callable type");
		if(call.resultMode !== "value" || call.invocation !== "many" || call.reentry !== "same-agent" || call.selfDisposal !== "defer" || !same(call.effects.toSorted(), ["fails", "host-call"])) fail("unsupported callable semantics");
		parameters(call.parameters, expected.parameters); site(call.result, expected.result, true); failure(call.failure, true);
	}
	if(ir.declarations.length !== abi.exports.length || new Set(ir.declarations.map(item => item.id)).size !== abi.exports.length) fail("binding export table mismatch");
	for(const declaration of ir.declarations)
	{
		const expected = abi.exports.find(item => item.bindingId === declaration.id);
		if(!expected || declaration.kind !== "function" || declaration.owner !== null || declaration.receiver !== null || declaration.typeParameters.length
			|| declaration.resultMode !== "value" || declaration.mutability !== "immutable" || declaration.capabilities.length) fail("unsupported export semantics");
		parameters(declaration.parameters, expected.parameters); site(declaration.result, expected.result, true);
		const hostCall = expected.parameters.some(type => type.kind === "named");
		if(!same(declaration.effects.toSorted(), hostCall ? ["fails", "host-call"] : [])) fail("binding effect mismatch");
		failure(declaration.failure, hostCall);
	}
};
