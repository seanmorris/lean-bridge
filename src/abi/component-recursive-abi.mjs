/**
 * Versioned finite copied graphs for typed, bounded recursive transport.
 * Validation does not enable admission by the compiler or runtime.
 *
 * @file
 */
import { snapshotComponentCopiedGraph } from "./component-recursive.mjs";
import { assertComponentCopySemantics } from "./component-copied.mjs";
import { componentRecordDefinitions } from "./component-records.mjs";

export const componentRecursiveAbi = 8;
export const componentRecursiveDispatch = "copied-graph-frame-v1";
const fail = message => { throw new TypeError(`Invalid component recursive ABI: ${message}`); };
const closed = (value, keys) => {
	if(!value || ![Object.prototype, null].includes(Object.getPrototypeOf(value))
		|| Reflect.ownKeys(value).length !== keys.length || Reflect.ownKeys(value).some(key => !keys.includes(key))) fail("descriptor fields must be closed");
	for(const key of keys) if(!Object.hasOwn(Object.getOwnPropertyDescriptor(value, key) ?? {}, "value")) fail("descriptor accessors are unsupported");
};
const dense = (values, limit) => {
	if(!Array.isArray(values) || values.length > limit || Reflect.ownKeys(values).length !== values.length + 1) fail("expected a bounded dense table");
	for(let index = 0; index < values.length; index++)
		if(!Object.hasOwn(Object.getOwnPropertyDescriptor(values, index) ?? {}, "value")) fail("table accessors or holes are unsupported");
};

/**
 * Validate finite definitions and every root without expanding nominal edges.
 *
 * @param abi - Private copied-graph descriptor.
 */
export const assertComponentRecursiveAbi = abi => {
	closed(abi, ["version", "dispatch", "types", "exports"]);
	if(abi.version !== componentRecursiveAbi || abi.dispatch !== componentRecursiveDispatch) fail("unsupported version or dispatch");
	dense(abi.exports, 10000);
	if(!abi.exports.length) fail("exports must be nonempty");
	const bindings = new Set(), symbols = new Set();
	for(const item of abi.exports)
	{
		closed(item, ["bindingId", "symbol", "parameters", "result", "resultMode"]);
		dense(item.parameters, 32);
		if(typeof item.bindingId !== "string" || !item.bindingId.length || item.bindingId.length > 1024 || bindings.has(item.bindingId)
			|| typeof item.symbol !== "string" || !/^lean_bridge_[a-f0-9]{24}$/.test(item.symbol) || symbols.has(item.symbol)) fail("invalid export identity");
		bindings.add(item.bindingId); symbols.add(item.symbol);
		if(item.resultMode !== "value") fail("copied graphs require synchronous results");
		for(const root of [...item.parameters, item.result]) snapshotComponentCopiedGraph({ schemaVersion: 1, root, types: abi.types });
	}
};

/**
 * Compare original alias edges, nominal identities and pure copy semantics.
 *
 * @param abi - Private finite graph descriptor.
 * @param ir - Independently compiler-authenticated public Binding IR.
 */
export const assertComponentRecursiveBindings = (abi, ir) => {
	assertComponentRecursiveAbi(abi);
	const root = { kind: "primitive", name: "unit" };
	const graph = types => snapshotComponentCopiedGraph({ schemaVersion: 1, root, types });
	if(JSON.stringify(graph(abi.types)) !== JSON.stringify(graph(componentRecordDefinitions(ir, true)))) fail("nominal definitions differ from public types");
	assertComponentCopySemantics(abi, ir, root => snapshotComponentCopiedGraph({ schemaVersion: 1, root, types: abi.types }).root);
};
