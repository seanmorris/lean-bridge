/**
 * Copied-record and compound admission, separate from scalar/array/callable ABIs.
 *
 * @file
 */
import { snapshotComponentCopiedType, assertComponentCopySemantics } from "./component-copied.mjs";

export const componentRecordAbi = 5;
export const componentRecordDispatch = "copied-record-frame-v1";
export const componentCompoundAbi = 6;
export const componentCompoundDispatch = "copied-compound-frame-v1";
const invalid = message => { throw new TypeError(`Invalid component record ABI: ${message}`); };
const closed = (value, keys) => {
	if(!value || typeof value !== "object" || Array.isArray(value)
		|| ![Object.prototype, null].includes(Object.getPrototypeOf(value))) invalid("expected a plain descriptor");
	const own = Reflect.ownKeys(value);
	if(own.length !== keys.length || own.some(key => !keys.includes(key))) invalid("descriptor fields must be closed");
	for(const key of keys) if(!Object.hasOwn(Object.getOwnPropertyDescriptor(value, key), "value")) invalid("accessors are unsupported");
};
const dense = (values, limit) => {
	if(!Array.isArray(values) || values.length > limit || Reflect.ownKeys(values).length !== values.length + 1) invalid("expected a bounded dense table");
	for(let index = 0; index < values.length; index++)
		if(!Object.hasOwn(Object.getOwnPropertyDescriptor(values, index) ?? {}, "value")) invalid("table accessors or holes are unsupported");
};

/**
 * Resolve nominal references into immutable, bounded copied transport trees.
 *
 * @param type - Semantic Binding IR reference.
 * @param records - Closed private record definitions.
 * @param compounds - Admit Option, result and binary product constructors.
 */
export const resolveComponentRecordType = (type, records, compounds = false) => {
	let nodes = 0;
	const active = new Set();
	const visit = (value, depth) => {
		if(depth > 32 || ++nodes > 4096) invalid("record nesting or node limit exceeded");
		const kind = Object.getOwnPropertyDescriptor(value ?? {}, "kind");
		if(!kind || !Object.hasOwn(kind, "value")) invalid("missing type kind");
		if(kind.value === "primitive") return snapshotComponentCopiedType(value);
		if(kind.value === "apply")
		{
			closed(value, ["kind", "constructor", "arguments"]);
			dense(value.arguments, 2);
			const allowed = compounds ? ["array", "option", "result", "tuple"] : ["array"];
			const count = ["tuple", "result"].includes(value.constructor) ? 2 : 1;
			if(!allowed.includes(value.constructor) || value.arguments.length !== count) invalid("unsupported copied constructor or arity");
			return { kind: "apply", constructor: value.constructor, arguments: value.arguments.map(argument => visit(argument, depth + 1)) };
		}
		closed(value, ["kind", "id"]);
		if(kind.value !== "named" || active.has(value.id)) invalid("recursive or unsupported record reference");
		const record = records.find(item => item.id === value.id);
		if(!record) invalid("unknown record identity");
		active.add(value.id);
		try
		{ return { kind: "record", id: record.id, fields: record.fields.map(field => ({ name: field.name, type: visit(field.type, depth + 1) })) }; }
		finally
		{ active.delete(value.id); }
	};
	return snapshotComponentCopiedType(visit(type, 0));
};

/**
 * Select only immutable, non-generic copied records from a validated public IR.
 *
 * @param ir - Compiler-authenticated Binding IR.
 */
export const componentRecordDefinitions = ir => ir.types.map(type => {
	if(type.kind !== "record" || type.representation !== "copied" || type.mutability !== "immutable"
		|| type.typeParameters.length || type.target !== null || type.resource !== null || type.callable !== null
		|| type.cases.length || type.host !== null || type.fields.some(field => field.mutability !== "immutable")) invalid("unsupported record semantics");
	return { id: type.id, fields: type.fields.map(field => ({ name: field.name, type: field.type })) };
}).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/**
 * Authenticate a closed version-five or version-six descriptor before loading code.
 *
 * @param abi - Private record transport descriptor.
 */
export const assertComponentRecordAbi = abi => {
	closed(abi, ["version", "dispatch", "records", "exports"]);
	const compounds = abi.version === componentCompoundAbi;
	if(compounds ? abi.dispatch !== componentCompoundDispatch : abi.version !== componentRecordAbi || abi.dispatch !== componentRecordDispatch) invalid("unsupported version or dispatch");
	dense(abi.records, 1024); dense(abi.exports, 10000);
	if((!compounds && !abi.records.length) || !abi.exports.length) invalid("records and exports must be nonempty");
	const ids = new Set(), bindings = new Set(), symbols = new Set();
	for(const record of abi.records)
	{
		closed(record, ["id", "fields"]); dense(record.fields, 1024);
		if(typeof record.id !== "string" || !/^lean:[A-Za-z_][A-Za-z0-9_']*(\.[A-Za-z_][A-Za-z0-9_']*)*$/.test(record.id) || ids.has(record.id)) invalid("invalid or duplicate record identity");
		ids.add(record.id);
		for(const field of record.fields) closed(field, ["name", "type"]);
	}
	let hasCompound = false;
	const inspect = type => {
		if(type.kind === "apply")
		{ hasCompound ||= type.constructor !== "array"; type.arguments.forEach(inspect); }
		if(type.kind === "record") type.fields.forEach(field => inspect(field.type));
	};
	const resolve = type => { const value = resolveComponentRecordType(type, abi.records, compounds); inspect(value); return value; };
	for(const record of abi.records) resolve({ kind: "named", id: record.id });
	for(const item of abi.exports)
	{
		closed(item, ["bindingId", "symbol", "parameters", "result", "resultMode"]); dense(item.parameters, 32);
		if(typeof item.bindingId !== "string" || !item.bindingId.length || item.bindingId.length > 1024 || bindings.has(item.bindingId)
			|| typeof item.symbol !== "string" || !/^lean_bridge_[a-f0-9]{24}$/.test(item.symbol) || symbols.has(item.symbol)) invalid("invalid export identity");
		bindings.add(item.bindingId); symbols.add(item.symbol);
		if(item.resultMode !== "value") invalid("records require synchronous results");
		for(const type of [...item.parameters, item.result]) resolve(type);
	}
	if(compounds && !hasCompound) invalid("compound ABI requires an Option, result or product");
};

/**
 * Bind names, field order, nested types and call semantics to the public IR.
 *
 * @param abi - Private transport descriptor.
 * @param ir - Public Binding IR.
 */
export const assertComponentRecordBindings = (abi, ir) => {
	assertComponentRecordAbi(abi);
	const compounds = abi.version === componentCompoundAbi;
	const expanded = records => records.map(record => resolveComponentRecordType({ kind: "named", id: record.id }, records, compounds));
	if(JSON.stringify(expanded(abi.records)) !== JSON.stringify(expanded(componentRecordDefinitions(ir)))) invalid("record field or identity mismatch");
	assertComponentCopySemantics(abi, ir, type => resolveComponentRecordType(type, abi.records, compounds));
};
