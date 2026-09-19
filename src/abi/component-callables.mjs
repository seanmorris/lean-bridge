/**
 * Closed private descriptors for synchronous primitive npm callable frames.
 * This staged contract does not enable compiler or package admission by itself.
 *
 * @file
 */
import { componentScalarTypes } from "./component-scalars.mjs";

export const componentCallableAbi = 3;
export const componentCallableDispatch = "scalar-callable-frame-v1";
export const componentCallableCapacity = 1024;
export const componentCallableDepth = 64;

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
