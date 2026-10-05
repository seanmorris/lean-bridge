/**
 * Copied-payload callable descriptors for compiler and package authentication.
 * Keep callback identities separate from copied nominal references.
 *
 * @file
 */
import { snapshotComponentCopiedGraph } from "./component-recursive.mjs";
import { componentRecordDefinitions } from "./component-records.mjs";
import { componentCallableCapacity } from "./component-callables.mjs";

export const componentStructuredCallableAbi = 9;
export const componentStructuredCallableDispatch = "copied-callable-frame-v1";
const fail = message => {
	throw Object.assign(new TypeError(`Invalid component structured callable ABI: ${message}`), { code: "invalid-component-structured-callable-abi" });
};
const closed = (value, keys) => {
	if(!value || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail("expected a plain descriptor");
	const actual = Reflect.ownKeys(value);
	if(actual.length !== keys.length || actual.some(key => !keys.includes(key))) fail("descriptor fields must be closed");
	for(const key of keys)
		if(!Object.hasOwn(Object.getOwnPropertyDescriptor(value, key) ?? {}, "value")) fail("descriptor accessors are unsupported");
};
const dense = (values, limit) => {
	if(!Array.isArray(values) || values.length > limit || Reflect.ownKeys(values).length !== values.length + 1) fail("expected a bounded dense table");
	for(let index = 0; index < values.length; index++)
		if(!Object.hasOwn(Object.getOwnPropertyDescriptor(values, index) ?? {}, "value")) fail("table accessors or holes are unsupported");
};
const text = value => typeof value === "string" && value.length > 0 && value.length <= 1024;
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const graph = (root, types) => {
	try
	{ return snapshotComponentCopiedGraph({ schemaVersion: 1, root, types }); }
	catch(error)
	{ fail(error.message); }
};
const data = (value, key) => {
	const descriptor = value && Object.getOwnPropertyDescriptor(value, key);
	if(!descriptor || !Object.hasOwn(descriptor, "value")) fail("missing data field");
	return descriptor.value;
};

/**
 * Bind a callback key to copied definitions as well as its root references.
 * Matching nominal names with different field types cannot share a key.
 *
 * @param signature - Concrete callback parameters and result.
 * @param types - Finite copied nominal definitions, excluding callback identities.
 */
export const componentStructuredCallableSignatureText = (signature, types) => {
	const parameters = data(signature, "parameters"), result = data(signature, "result");
	dense(parameters, 16);
	if(!parameters.length) fail("callback arity must be 1 through 16");
	const checked = graph(result, types);
	return JSON.stringify(["copied-callable-v1"
		, parameters.map(root => graph(root, checked.types).root)
		, checked.root, checked.types]);
};

/**
 * Authenticate identities, finite copied definitions and every payload root.
 * Identity-bearing fields cannot pass through the copied graph validator.
 *
 * @param abi - Closed descriptor, not evidence of installed support.
 */
export const assertComponentStructuredCallableAbi = abi => {
	closed(abi, ["version", "dispatch", "types", "callbacks", "exports"]);
	if(abi.version !== componentStructuredCallableAbi || abi.dispatch !== componentStructuredCallableDispatch) fail("unsupported version or dispatch");
	const copied = graph({ kind: "primitive", name: "unit" }, abi.types);
	dense(abi.callbacks, componentCallableCapacity);
	if(!abi.callbacks.length) fail("callbacks must be nonempty");
	const identities = new Set(), keys = new Set();
	for(const callback of abi.callbacks)
	{
		closed(callback, ["id", "key", "parameters", "result"]);
		if(!text(callback.id) || identities.has(callback.id) || copied.types.some(type => type.id === callback.id)
			|| typeof callback.key !== "string" || !/^[a-f0-9]{40}$/.test(callback.key) || keys.has(callback.key)) fail("callback identities must be unique");
		identities.add(callback.id); keys.add(callback.key);
		componentStructuredCallableSignatureText(callback, copied.types);
	}
	const used = new Set(), bindings = new Set(), symbols = new Set();
	const value = type => {
		if(data(type, "kind") === "named")
		{
			closed(type, ["kind", "id"]);
			if(identities.has(type.id))
			{ used.add(type.id); return; }
		}
		graph(type, copied.types);
	};
	dense(abi.exports, 10000);
	if(!abi.exports.length) fail("exports must be nonempty");
	for(const item of abi.exports)
	{
		closed(item, ["bindingId", "symbol", "parameters", "result", "resultMode"]);
		if(!text(item.bindingId) || bindings.has(item.bindingId) || typeof item.symbol !== "string"
			|| !/^lean_bridge_[a-f0-9]{24}$/.test(item.symbol) || symbols.has(item.symbol)) fail("export identities must be unique");
		bindings.add(item.bindingId); symbols.add(item.symbol);
		if(item.resultMode !== "value") fail("exports require synchronous results");
		dense(item.parameters, 32);
		item.parameters.forEach(value); value(item.result);
	}
	if(used.size !== identities.size) fail("unused callback signature");
};

/**
 * Match the private protocol with independently authenticated public semantics.
 * A named copied record retains copy ownership. Only callback IDs carry leases.
 *
 * @param abi - Closed copied-payload callback descriptor.
 * @param ir - Validated public Binding IR from the compiler or reviewed source.
 */
export const assertComponentStructuredCallableBindings = (abi, ir) => {
	assertComponentStructuredCallableAbi(abi);
	const callbacks = new Map(abi.callbacks.map(type => [type.id, type]));
	const copied = graph({ kind: "primitive", name: "unit" }, abi.types);
	if(ir.types.length !== callbacks.size + copied.types.length || new Set(ir.types.map(type => type.id)).size !== ir.types.length) fail("binding type table mismatch");
	const definitions = componentRecordDefinitions({ types: ir.types.filter(type => type.kind !== "callback") }, true);
	if(!same(copied.types, graph(copied.root, definitions).types)) fail("nominal definitions differ from public types");
	const site = (value, expected, result = false) => {
		const identity = expected.kind === "named" && callbacks.has(expected.id);
		if(identity) closed(value.type, ["kind", "id"]);
		const matches = identity ? value.type.kind === "named" && value.type.id === expected.id
			: same(graph(value.type, copied.types).root, graph(expected, copied.types).root);
		if(!matches || value.ownership !== (identity ? result ? "lease" : "borrow" : "copy")) fail("binding ownership or type mismatch");
		if(identity)
		{
			closed(value.lifetime, ["scope", "anchor"]);
			if(value.lifetime.scope !== (result ? "explicit" : "call") || value.lifetime.anchor !== null) fail("binding lifetime mismatch");
		}
		else if(value.lifetime !== null) fail("copied values cannot retain identity");
	};
	const parameters = (actual, expected) => {
		if(actual.length !== expected.length) fail("binding arity mismatch");
		actual.forEach((value, index) => {
			if(value.optional || value.default !== null || value.mutability !== "immutable") fail("unsupported parameter semantics");
			site(value, expected[index]);
		});
	};
	const failure = (value, callback) => {
		if(value.mode !== (callback ? "declared" : "none") || value.unexpected !== "poison-runtime"
			|| !same(value.errors, callback ? ["error:native-callback"] : [])) fail("binding failure mismatch");
	};
	for(const type of ir.types.filter(type => type.kind === "callback"))
	{
		const expected = callbacks.get(type.id), call = type.callable;
		if(!expected || type.representation !== "identity" || type.mutability !== "immutable" || type.typeParameters.length
			|| type.fields.length || type.cases.length || type.target !== null || type.resource !== null || type.host !== null) fail("unsupported callable type");
		if(call.resultMode !== "value" || call.invocation !== "many" || call.reentry !== "same-agent" || call.selfDisposal !== "defer"
			|| !same(call.effects.toSorted(), ["fails", "host-call"])) fail("unsupported callable semantics");
		parameters(call.parameters, expected.parameters); site(call.result, expected.result, true); failure(call.failure, true);
	}
	if(ir.declarations.length !== abi.exports.length || new Set(ir.declarations.map(item => item.id)).size !== abi.exports.length) fail("binding export table mismatch");
	for(const declaration of ir.declarations)
	{
		const expected = abi.exports.find(item => item.bindingId === declaration.id);
		if(!expected || declaration.kind !== "function" || declaration.owner !== null || declaration.receiver !== null || declaration.typeParameters.length
			|| declaration.resultMode !== "value" || declaration.mutability !== "immutable" || declaration.capabilities.length) fail("unsupported export semantics");
		parameters(declaration.parameters, expected.parameters); site(declaration.result, expected.result, true);
		const hostCall = expected.parameters.some(type => type.kind === "named" && callbacks.has(type.id));
		if(!same(declaration.effects.toSorted(), hostCall ? ["fails", "host-call"] : [])) fail("binding effect mismatch");
		failure(declaration.failure, hostCall);
	}
};
