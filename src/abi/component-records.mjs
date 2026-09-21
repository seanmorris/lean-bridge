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
export const componentNominalAbi = 7;
export const componentNominalDispatch = "copied-nominal-frame-v1";
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
 * @param compounds - Admit List, Option, result and binary product constructors.
 * @param nominal - Admit copied aliases and tagged variants.
 */
export const resolveComponentRecordType = (type, records, compounds = false, nominal = false) => {
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
			const allowed = compounds ? ["array", "list", "option", "result", "tuple"] : ["array"];
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
		{
			const fields = values => values.map(field => ({ name: field.name, type: visit(field.type, depth + 1) }));
			if(nominal && record.kind === "alias") return { kind: "alias", id: record.id, target: visit(record.target, depth + 1) };
			if(nominal && record.kind === "variant") return { kind: "variant", id: record.id, cases: record.cases.map(item => ({ name: item.name, fields: fields(item.fields) })) };
			return { kind: "record", id: record.id, fields: fields(record.fields) };
		}
		finally
		{ active.delete(value.id); }
	};
	return snapshotComponentCopiedType(visit(type, 0));
};

/**
 * Select only immutable, non-generic copied records from a validated public IR.
 *
 * @param ir - Compiler-authenticated Binding IR.
 * @param nominal - Include closed aliases and variants in the nominal table.
 */
export const componentRecordDefinitions = (ir, nominal = false) => ir.types.map(type => {
	if(nominal)
	{
		if(!["record", "alias", "variant"].includes(type.kind) || type.representation !== "copied" || type.mutability !== "immutable"
			|| type.typeParameters.length || type.resource !== null || type.callable !== null || type.host !== null) invalid("unsupported nominal semantics");
		const fields = values => values.map(field => {
			if(field.mutability !== "immutable") invalid("unsupported nominal field mutability");
			return { name: field.name, type: field.type };
		});
		if(type.kind === "alias")
		{
			if(type.fields.length || type.cases.length || type.target === null) invalid("unsupported alias semantics");
			return { kind: "alias", id: type.id, target: type.target };
		}
		if(type.target !== null || (type.kind === "record" ? type.cases.length : type.fields.length)) invalid("unsupported nominal semantics");
		return type.kind === "record" ? { kind: "record", id: type.id, fields: fields(type.fields) }
			: { kind: "variant", id: type.id, cases: type.cases.map(item => ({ name: item.name, fields: fields(item.fields) })) };
	}
	if(type.kind !== "record" || type.representation !== "copied" || type.mutability !== "immutable"
		|| type.typeParameters.length || type.target !== null || type.resource !== null || type.callable !== null
		|| type.cases.length || type.host !== null || type.fields.some(field => field.mutability !== "immutable")) invalid("unsupported record semantics");
	return { id: type.id, fields: type.fields.map(field => ({ name: field.name, type: field.type })) };
}).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/**
 * Authenticate a closed record, compound or nominal descriptor before loading code.
 *
 * @param abi - Private record transport descriptor.
 */
export const assertComponentRecordAbi = abi => {
	const nominal = Object.getOwnPropertyDescriptor(abi ?? {}, "version")?.value === componentNominalAbi;
	closed(abi, ["version", "dispatch", nominal ? "types" : "records", "exports"]);
	if(![componentRecordAbi, componentCompoundAbi, componentNominalAbi].includes(abi.version)) invalid("unsupported version or dispatch");
	const compounds = nominal || abi.version === componentCompoundAbi, records = nominal ? abi.types : abi.records;
	const dispatch = { [componentRecordAbi]: componentRecordDispatch, [componentCompoundAbi]: componentCompoundDispatch, [componentNominalAbi]: componentNominalDispatch }[abi.version];
	if(!dispatch || abi.dispatch !== dispatch) invalid("unsupported version or dispatch");
	dense(records, 1024); dense(abi.exports, 10000);
	if(((!compounds || nominal) && !records.length) || !abi.exports.length) invalid("records and exports must be nonempty");
	const ids = new Set(), bindings = new Set(), symbols = new Set();
	for(const record of records)
	{
		const kind = nominal ? Object.getOwnPropertyDescriptor(record ?? {}, "kind")?.value : "record";
		if(nominal && !["record", "alias", "variant"].includes(kind)) invalid("unknown nominal kind");
		closed(record, [...(nominal ? ["kind"] : []), "id", kind === "alias" ? "target" : kind === "variant" ? "cases" : "fields"]);
		if(typeof record.id !== "string" || !/^lean:[A-Za-z_][A-Za-z0-9_']*(\.[A-Za-z_][A-Za-z0-9_']*)*$/.test(record.id) || ids.has(record.id)) invalid("invalid or duplicate record identity");
		ids.add(record.id);
		const checkFields = fields => { dense(fields, 1024); for(const field of fields) closed(field, ["name", "type"]); };
		if(record.kind === "alias") continue;
		if(record.kind === "variant")
		{
			dense(record.cases, 1024);
			for(const item of record.cases)
			{ closed(item, ["name", "fields"]); checkFields(item.fields); }
		}
		else checkFields(record.fields);
	}
	let hasCompound = false, hasNominal = false;
	const inspect = type => {
		if(type.kind === "apply")
		{ hasCompound ||= type.constructor !== "array"; type.arguments.forEach(inspect); }
		if(type.kind === "record") type.fields.forEach(field => inspect(field.type));
		if(type.kind === "alias")
		{ hasNominal = true; inspect(type.target); }
		if(type.kind === "variant")
		{ hasNominal = true; type.cases.forEach(item => item.fields.forEach(field => inspect(field.type))); }
	};
	const resolve = type => { const value = resolveComponentRecordType(type, records, compounds, nominal); inspect(value); return value; };
	for(const record of records) resolve({ kind: "named", id: record.id });
	for(const item of abi.exports)
	{
		closed(item, ["bindingId", "symbol", "parameters", "result", "resultMode"]); dense(item.parameters, 32);
		if(typeof item.bindingId !== "string" || !item.bindingId.length || item.bindingId.length > 1024 || bindings.has(item.bindingId)
			|| typeof item.symbol !== "string" || !/^lean_bridge_[a-f0-9]{24}$/.test(item.symbol) || symbols.has(item.symbol)) invalid("invalid export identity");
		bindings.add(item.bindingId); symbols.add(item.symbol);
		if(item.resultMode !== "value") invalid("records require synchronous results");
		for(const type of [...item.parameters, item.result]) resolve(type);
	}
	if(nominal ? !hasNominal : compounds && !hasCompound) invalid("ABI requires its named or compound type family");
};

/**
 * Bind names, field order, nested types and call semantics to the public IR.
 *
 * @param abi - Private transport descriptor.
 * @param ir - Public Binding IR.
 */
export const assertComponentRecordBindings = (abi, ir) => {
	assertComponentRecordAbi(abi);
	const nominal = abi.version === componentNominalAbi, compounds = nominal || abi.version === componentCompoundAbi;
	const records = nominal ? abi.types : abi.records;
	const expanded = records => records.map(record => resolveComponentRecordType({ kind: "named", id: record.id }, records, compounds, nominal));
	if(JSON.stringify(expanded(records)) !== JSON.stringify(expanded(componentRecordDefinitions(ir, nominal)))) invalid("record field or identity mismatch");
	assertComponentCopySemantics(abi, ir, type => resolveComponentRecordType(type, records, compounds, nominal));
};
