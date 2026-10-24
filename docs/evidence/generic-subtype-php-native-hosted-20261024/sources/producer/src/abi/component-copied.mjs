/**
 * Bounded copied-slot shapes and versioned compiled-array admission.
 *
 * @file
 */
import { componentScalarTypes, scalarCopyLimit } from "./component-scalars.mjs";

// Leave space for additional primitive tags without renumbering scalar ABI 2.
// Lists retain their semantic constructor but share the ordered sequence wire layout.
export const componentCopiedTags = Object.freeze({ array: 32, list: 32, tuple: 33, option: 34, result: 35, record: 36, variant: 37 });
export const componentCopiedDepth = 32;
export const componentCopiedAbi = 4;
export const componentCopiedDispatch = "copied-array-frame-v1";
const maximumTypeNodes = 4096;
const nominal = /^lean:[A-Za-z_][A-Za-z0-9_']*(\.[A-Za-z_][A-Za-z0-9_']*)*$/;

const invalid = message => { throw new TypeError(`Invalid component copied type: ${message}`); };
const fields = (value, keys) => {
	if(!value || typeof value !== "object" || Array.isArray(value)
		|| ![Object.prototype, null].includes(Object.getPrototypeOf(value))) invalid("expected a plain descriptor");
	const own = Reflect.ownKeys(value);
	if(own.length !== keys.length || own.some(key => !keys.includes(key))) invalid("descriptor fields must be closed");
	for(const key of keys) if(!Object.hasOwn(Object.getOwnPropertyDescriptor(value, key), "value")) invalid("accessors are unsupported");
};
const dense = (values, maximum, label) => {
	if(!Array.isArray(values) || values.length > maximum || Reflect.ownKeys(values).length !== values.length + 1) invalid(`invalid ${label}`);
	for(let index = 0; index < values.length; index++)
		if(!Object.hasOwn(Object.getOwnPropertyDescriptor(values, index) ?? {}, "value")) invalid(`${label} must be dense data values`);
};

/**
 * Snapshot a bounded semantic type tree without trusting names or host coercions.
 * Records, aliases and variants use expanded nominal descriptors. Identity and
 * recursion require separate representations. Descriptor support alone does
 * not enable a shape in a compiled component's versioned ABI.
 *
 * @param type - Primitive, applied or expanded named semantic descriptor.
 */
export const snapshotComponentCopiedType = type => {
	let nodes = 0;
	const active = new Set(), aliases = new Set();
	const copyFields = (values, depth, variant = false) => {
		dense(values, 1024, "record fields");
		const names = new Set();
		return Object.freeze(values.map(field => {
			fields(field, ["name", "type"]);
			if(typeof field.name !== "string" || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(field.name)
				|| ["__proto__", "prototype", "constructor"].includes(field.name) || names.has(field.name)
				|| variant && field.name === "kind") invalid("invalid record field name");
			names.add(field.name);
			return Object.freeze({ name: field.name, type: visit(field.type, depth + 1) });
		}));
	};
	const visit = (value, depth) => {
		if(depth > componentCopiedDepth || ++nodes > maximumTypeNodes) invalid("type nesting or node limit exceeded");
		if(active.has(value)) invalid("cyclic type descriptor");
		const kind = value && Object.getOwnPropertyDescriptor(value, "kind");
		if(!kind || !Object.hasOwn(kind, "value")) invalid("missing data kind");
		if(kind.value === "primitive")
		{
			fields(value, ["kind", "name"]);
			if(!componentScalarTypes.includes(value.name)) invalid("unknown primitive");
			return Object.freeze({ kind: "primitive", name: value.name });
		}
		if(kind.value === "alias")
		{
			fields(value, ["kind", "id", "target"]);
			if(typeof value.id !== "string" || !nominal.test(value.id)) invalid("invalid alias identity");
			if(aliases.has(value.id)) invalid("cyclic alias descriptor");
			active.add(value); aliases.add(value.id);
			try
			{ return Object.freeze({ kind: "alias", id: value.id, target: visit(value.target, depth + 1) }); }
			finally
			{ active.delete(value); aliases.delete(value.id); }
		}
		if(kind.value === "variant")
		{
			fields(value, ["kind", "id", "cases"]);
			if(typeof value.id !== "string" || !nominal.test(value.id)) invalid("invalid variant identity");
			dense(value.cases, 1024, "variant cases");
			if(!value.cases.length) invalid("variant cases must be nonempty");
			active.add(value);
			try
			{
				const names = new Set();
				const cases = value.cases.map(item => {
					fields(item, ["name", "fields"]);
					if(typeof item.name !== "string" || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(item.name) || names.has(item.name)) invalid("invalid variant case name");
					names.add(item.name);
					return Object.freeze({ name: item.name, fields: copyFields(item.fields, depth, true) });
				});
				return Object.freeze({ kind: "variant", id: value.id, cases: Object.freeze(cases) });
			} finally
			{ active.delete(value); }
		}
		if(kind.value === "record")
		{
			fields(value, ["kind", "id", "fields"]);
			if(typeof value.id !== "string" || !/^lean:[A-Za-z_][A-Za-z0-9_'.]*$/.test(value.id)) invalid("invalid record identity");
			active.add(value);
			try
			{ return Object.freeze({ kind: "record", id: value.id, fields: copyFields(value.fields, depth) }); }
			finally
			{ active.delete(value); }
		}
		fields(value, ["kind", "constructor", "arguments"]);
		if(kind.value !== "apply" || !["array", "list", "tuple", "option", "result"].includes(value.constructor)) invalid("unsupported constructor");
		const args = value.arguments;
		if(!Array.isArray(args) || args.length > 32 || Reflect.ownKeys(args).length !== args.length + 1) invalid("invalid type arguments");
		const count = value.constructor === "tuple" ? args.length : value.constructor === "result" ? 2 : 1;
		if(args.length !== count || (value.constructor === "tuple" && count < 2)) invalid("constructor arity mismatch");
		active.add(value);
		try
		{
			const children = [];
			for(let index = 0; index < count; index++)
			{
				const child = Object.getOwnPropertyDescriptor(args, index);
				if(!child || !Object.hasOwn(child, "value")) invalid("type arguments must be dense data values");
				children.push(visit(child.value, depth + 1));
			}
			return Object.freeze({ kind: "apply", constructor: value.constructor, arguments: Object.freeze(children) });
		} finally
		{ active.delete(value); }
	};
	return visit(type, 0);
};

/**
 * Describe the currently compiled subset: primitives and nested arrays only.
 *
 * @param type - Public or private semantic type reference.
 */
export const componentArrayShape = type => {
	let value = snapshotComponentCopiedType(type), depth = 0;
	while(value.kind === "apply")
	{
		if(value.constructor !== "array") invalid("compiled copied values currently require arrays");
		depth++;
		value = value.arguments[0];
	}
	if(value.kind !== "primitive") invalid("compiled array leaves must be primitive");
	return { kind: componentScalarTypes.indexOf(value.name), depth };
};

/**
 * Check the versioned, closed descriptor before linking a copied component.
 *
 * @param abi - Compiler-generated private array descriptor.
 */
export const assertComponentCopiedAbi = abi => {
	fields(abi, ["version", "dispatch", "exports"]);
	if(abi.version !== componentCopiedAbi || abi.dispatch !== componentCopiedDispatch) invalid("unsupported copied ABI");
	if(!Array.isArray(abi.exports) || !abi.exports.length || abi.exports.length > 10000) invalid("invalid export table");
	const bindings = new Set(), symbols = new Set();
	let arrays = false;
	for(const item of abi.exports)
	{
		fields(item, ["bindingId", "symbol", "parameters", "result", "resultMode"]);
		if(typeof item.bindingId !== "string" || !item.bindingId.length || item.bindingId.length > 1024 || bindings.has(item.bindingId)
			|| typeof item.symbol !== "string" || !/^lean_bridge_[a-f0-9]{24}$/.test(item.symbol) || symbols.has(item.symbol)) invalid("invalid export identity");
		bindings.add(item.bindingId); symbols.add(item.symbol);
		if(item.resultMode !== "value" || !Array.isArray(item.parameters) || item.parameters.length > 32) invalid("copied calls require synchronous bounded arity");
		for(const type of [...item.parameters, item.result]) if(componentArrayShape(type).depth) arrays = true;
	}
	if(!arrays) invalid("scalar-only components must retain scalar ABI 2");
};

/**
 * Bind the transport to the public types, copy ownership and pure effects.
 *
 * @param abi - Closed private descriptor.
 * @param ir - Compiler-checked Binding IR.
 */
export const assertComponentCopiedBindings = (abi, ir) => {
	assertComponentCopiedAbi(abi);
	if(ir.types.length) invalid("unsupported copied binding tables");
	assertComponentCopySemantics(abi, ir, componentArrayShape);
};

/**
 * Check pure copied call semantics after the versioned ABI has been validated.
 *
 * @param abi - Validated private copied descriptor.
 * @param ir - Binding IR to authenticate.
 * @param resolve - Closed type resolver preserving nominal identities.
 */
export const assertComponentCopySemantics = (abi, ir, resolve) => {
	if(ir.errors.length || ir.capabilities.length || ir.declarations.length !== abi.exports.length) invalid("unsupported copied binding tables");
	const seen = new Set();
	const site = (value, type) => {
		if(JSON.stringify(resolve(value.type)) !== JSON.stringify(resolve(type)) || value.ownership !== "copy" || value.lifetime !== null) invalid("binding type or ownership mismatch");
	};
	for(const declaration of ir.declarations)
	{
		const expected = abi.exports.find(item => item.bindingId === declaration.id);
		if(!expected || seen.has(declaration.id) || declaration.kind !== "function" || declaration.owner !== null || declaration.receiver !== null
			|| declaration.typeParameters.length || declaration.resultMode !== "value" || declaration.mutability !== "immutable"
			|| declaration.effects.length || declaration.capabilities.length || declaration.failure.mode !== "none"
			|| declaration.failure.errors.length || declaration.failure.unexpected !== "poison-runtime"
			|| declaration.parameters.length !== expected.parameters.length) invalid("unsupported copied export semantics");
		seen.add(declaration.id);
		declaration.parameters.forEach((value, index) => {
			if(value.optional || value.default !== null || value.mutability !== "immutable") invalid("unsupported copied parameter semantics");
			site(value, expected.parameters[index]);
		});
		site(declaration.result, expected.result);
	}
};

/**
 * Share one copy allowance across arguments and the result, including slot storage.
 * A caller may lower the limit, but cannot raise the transport's 16 MiB ceiling.
 *
 * @param limit - Maximum copied bytes for this call.
 */
export const createComponentCopyBudget = (limit = scalarCopyLimit) => {
	if(!Number.isSafeInteger(limit) || limit < 0 || limit > scalarCopyLimit) throw new RangeError("Invalid component copy budget");
	let used = 0;
	return Object.freeze({
		/** Bytes charged across all values in the owning call. */
		get used() { return used; }
		, charge: bytes => {
			if(!Number.isSafeInteger(bytes) || bytes < 0 || bytes > limit - used) throw new RangeError("Component copy budget exceeded");
			used += bytes;
		}
	});
};
