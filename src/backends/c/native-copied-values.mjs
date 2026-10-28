/**
 * Recursive copied-value adapters. Compiler-emitted accessors own record layout.
 *
 * @file
 */
import { nativeCType, nativeObjectType, nativeTypeKey } from "../../build/native-model.mjs";
import { canonicalJson, sha256 } from "../../capsule/node.mjs";
import { finDiagnosticRejection, refinementDiagnosticRejection } from "./fin-diagnostic.mjs";
import { constructorRefinementLeaves } from "../../build/component-refinements.mjs";

/**
 * Convert a compiler type to its semantic C reference.
 *
 * @param type - Checked native type.
 */
export const nativeCReference = type => type.kind === "primitive" ? { kind: "primitive", name: type.name }
	: type.kind === "callback" ? { kind: "named", id: `bridge:Callback${sha256(canonicalJson({ parameters: type.parameters.map(nativeCReference), result: nativeCReference(type.result) })).slice(0, 20)}` }
		: ["array", "list", "option"].includes(type.kind) ? { kind: "apply", constructor: type.kind, arguments: [nativeCReference(type.element)] }
			: ["result", "tuple"].includes(type.kind) ? { kind: "apply", constructor: type.kind, arguments: type.arguments.map(nativeCReference) }
				: { kind: "named", id: `lean:${type.name}` };
const dynamic = type => ["string", "bytes", "nat", "int"].includes(type.name);

/**
 * Split an exact decimal Fin bound into little-endian uint32 limbs.
 *
 * @param bound - Compiler-owned decimal bound.
 */
export const finBoundLimbs = bound => {
	if(typeof bound !== "string" || !/^(?:0|[1-9][0-9]*)$/.test(bound)) throw new TypeError("Invalid Fin bound");
	const limbs = [];
	for(let value = BigInt(bound); value > 0n; value >>= 32n) limbs.push(Number(value & 0xffffffffn));
	return limbs;
};
// Compare caller limbs with a normalized bound; high zero limbs are permitted.
const finBelow = `static inline int lb_fin_below(const uint32_t *data, size_t length, const uint32_t *bound, size_t bound_length) {
  while (length && data[length - 1] == 0) --length;
  if (length != bound_length) return length < bound_length;
  while (length--) if (data[length] != bound[length]) return data[length] < bound[length];
  return 0;
}`;

/**
 * Compare every Fin site of one argument with its bound on caller limbs, before any Lean
 * value exists: each element of an array or list, a present option value, both product
 * components, the active Except branch, each record field and the active variant case's fields.
 *
 * @param options - One argument's refinement tree and its copied C value.
 * @param options.refinement - Validated refinement tree for the argument.
 * @param options.type - Native representation of the argument.
 * @param options.value - C expression addressing the copied value.
 * @param options.constant - Name of the first bound constant; later sites are numbered.
 * @param options.label - Argument name used in rejection messages.
 * @param options.copy - Copied C type for a native representation.
 * @param options.bounds - Receives static bound constant definitions.
 * @param options.reject - Statement rejecting the call with a quoted message.
 * @param options.parameterBounds - Live copied parameter expressions and labels, in declaration order.
 */
export const finRefinementWalk = ({ refinement, type: root, value: argument, constant, label, copy, bounds, reject, parameterBounds = [] }) => {
	let sites = 0;
	const check = (site, type, value, indent, path) => {
		if(site === null || ["subtype", "fin-field"].includes(site.kind)) return [];
		if(type.kind === "alias") return check(site, type.target, value, indent, path);
		if(site.kind === "checked-record")
		{
			if(!Object.hasOwn(site, "arguments")) return [];
			const fields = copy(type).fields;
			return site.arguments.flatMap((child, index) => child === null ? [] : check(
				child, type.fields[index].type, `(&${value}->${fields[index].name})`
				, indent, [...path, `.${site.fields[index]}`]));
		}
		if(site.kind === "fin")
		{
			// A top-level scalar keeps its historical constant name; nested sites are numbered.
			const limbs = finBoundLimbs(site.bound), name = sites === 0 && refinement.kind === "fin" ? constant : `${constant}_${sites}`;
			sites += 1;
			if(limbs.length) bounds.push(`static const uint32_t ${name}[${limbs.length}] = {${limbs.map(limb => `0x${limb.toString(16)}u`).join(", ")}};`);
			const rejected = finDiagnosticRejection({ path, bound: site.bound, name, indent, reject });
			return [`${indent}if (!lb_fin_below(${value}->data, ${value}->length, ${limbs.length ? name : "NULL"}, ${limbs.length})) ${rejected}`];
		}
		if(site.kind === "fin-parameter")
		{
			const bound = parameterBounds[site.parameter], name = `${constant}_${sites}`;
			sites += 1;
			if(type.kind !== "primitive" || type.name !== "nat" || !bound
				|| typeof bound.value !== "string" || typeof bound.label !== "string")
				throw new TypeError("Dependent Fin requires its earlier copied Nat parameter");
			const rejected = refinementDiagnosticRejection({
				path, suffix: ` is not below its dependent Fin bound ${bound.label}`
				, name, indent, reject
			});
			return [`${indent}if (!lb_fin_below(${value}->data, ${value}->length, ${bound.value}->data, ${bound.value}->length)) ${rejected}`];
		}
		const fields = copy(type).fields;
		if(site.kind === "array" || site.kind === "list")
		{
			const index = `k${indent.length}`;
			return [`${indent}for (size_t ${index} = 0; ${index} < ${value}->length; ++${index}) {`, ...check(site.arguments[0], type.element, `(&${value}->data[${index}])`, `${indent}  `, [...path, "[", { index }, "]"]), `${indent}}`];
		}
		// A record checks each refined field in declaration order; a variant only its active case.
		if(site.kind === "record")
			return site.arguments.flatMap((child, index) => child === null ? [] : check(child, type.fields[index].type, `(&${value}->${fields[index].name})`, indent, [...path, `.${site.fields[index]}`]));
		if(site.kind === "variant")
		{
			const cases = copy(type).cases;
			return site.cases.flatMap(({ arguments: children }, index) => children.every(child => child === null) ? [] : [`${indent}if (${value}->kind == ${index}u) {`
				, ...children.flatMap((child, field) => child === null ? [] : check(child, type.cases[index].fields[field].type, `(&${value}->cases.${cases[index].name}.${cases[index].fields[field].name})`, `${indent}  `, [...path, `.${site.cases[index].name}.${site.cases[index].fields[field]}`]))
				, `${indent}}`]);
		}
		const flag = { option: "has_value", result: "is_ok" }[site.kind];
		return site.arguments.flatMap((child, index) => {
			if(child === null) return [];
			const suffix = site.kind === "option" ? "?" : site.kind === "result" ? `.${index ? "error" : "ok"}` : `.${index}`;
			const inner = check(child, type.arguments ? type.arguments[index] : type.element, `(&${value}->${fields[index].name})`, flag ? `${indent}  ` : indent, [...path, suffix]);
			return flag ? [`${indent}if (${index === 1 ? "!" : ""}${value}->${flag}) {`, ...inner, `${indent}}`] : inner;
		});
	};
	return check(refinement, root, argument, "  ", [label]);
};

/**
 * Check each author constructor after all raw-shape and Fin checks have passed.
 * Each leaf validator consumes its own fresh conversion, never the dispatch input.
 *
 * @param options - Checked constructor traversal.
 * @param options.refinement - Validated refinement tree.
 * @param options.type - Erased native type.
 * @param options.value - C expression pointing to the caller value.
 * @param options.symbol - Validator symbol prefix.
 * @param options.label - Caller argument name.
 * @param options.copy - Lookup a copied C type.
 * @param options.input - Convert a copied leaf to a fresh Lean value.
 * @param options.reject - Render rejection from a C string expression.
 */
export const constructorRefinementWalk = ({ refinement, type: root, value: argument, symbol, label, copy, input, reject }) => {
	const check = (site, type, value, indent, path, suffix) => {
		if(site === null || ["fin", "fin-field", "fin-parameter"].includes(site.kind)) return [];
		if(type.kind === "alias") return check(site, type.target, value, indent, path, suffix);
		if(site.kind === "subtype")
		{
			const name = `${symbol}${suffix}`;
			const rejected = refinementDiagnosticRejection({ path, suffix: ` was rejected by ${site.constructor}`, name, indent, reject });
			return [`${indent}if (!${name}(${input(type, value)})) ${rejected}`];
		}
		if(site.kind === "checked-record")
		{
			const fields = copy(type).fields;
			const nested = Object.hasOwn(site, "arguments") ? site.arguments.flatMap((child, index) => check(
				child, type.fields[index].type, `(&${value}->${fields[index].name})`, indent
				, [...path, `.${site.fields[index]}`], `${suffix}_${index}`)) : [];
			const name = `${symbol}${suffix}`;
			const rejected = refinementDiagnosticRejection({ path, suffix: ` was rejected by ${site.constructor}`, name, indent, reject });
			return [...nested, `${indent}if (!${name}(${input(type, value)})) ${rejected}`];
		}
		if(site.kind === "record")
		{
			const fields = copy(type).fields;
			return site.arguments.flatMap((child, index) => check(child, type.fields[index].type,
				`(&${value}->${fields[index].name})`, indent, [...path, `.${site.fields[index]}`], `${suffix}_${index}`));
		}
		if(site.kind === "variant")
		{
			const cases = copy(type).cases;
			return site.cases.flatMap((branch, index) => {
				const inner = branch.arguments.flatMap((child, field) => check(child, type.cases[index].fields[field].type,
					`(&${value}->cases.${cases[index].name}.${cases[index].fields[field].name})`, `${indent}  `,
					[...path, `.${branch.name}.${branch.fields[field]}`], `${suffix}_${index}_${field}`));
				return inner.length ? [`${indent}if (${value}->kind == ${index}u) {`, ...inner, `${indent}}`] : [];
			});
		}
		if(!["array", "list", "option", "tuple", "result"].includes(site.kind)) throw new TypeError("Unsupported constructor refinement transport");
		if(["array", "list"].includes(site.kind))
		{
			const index = `k${indent.length}`;
			return [`${indent}for (size_t ${index} = 0; ${index} < ${value}->length; ++${index}) {`
				, ...check(site.arguments[0], type.element, `(&${value}->data[${index}])`, `${indent}  `, [...path, "[", { index }, "]"], `${suffix}_0`)
				, `${indent}}`];
		}
		const fields = copy(type).fields, flag = { option: "has_value", result: "is_ok" }[site.kind];
		return site.arguments.flatMap((child, index) => {
			if(child === null) return [];
			const segment = site.kind === "option" ? "?" : site.kind === "result" ? `.${index ? "error" : "ok"}` : `.${index}`;
			const inner = check(child, type.arguments?.[index] ?? type.element, `(&${value}->${fields[index].name})`, flag ? `${indent}  ` : indent, [...path, segment], `${suffix}_${index}`);
			return flag ? [`${indent}if (${index === 1 ? "!" : ""}${value}->${flag}) {`, ...inner, `${indent}}`] : inner;
		});
	};
	return check(refinement, root, argument, "  ", [label], "");
};

/**
 * Render recursive validation, conversion and typed calls.
 *
 * @param model - Verified native compiler model.
 * @param surface - Admitted copied C surface.
 */
export const generateCopiedNativeCalls = (model, surface) => {
	const p = surface.prefix, macro = p.toUpperCase();
	const copy = type => surface.copy(nativeCReference(type));
	const id = type => `lb_copy_${copy(type).index}`;
	const boxed = (type, value) => nativeObjectType(type) ? value : `${type.abi.box}(${value})`;
	const unboxed = (type, value) => nativeObjectType(type) ? value : `(${nativeCType(type)})${type.abi.unbox}(${value})`;
	const definitions = model.types.filter(type => type.kind !== "callback").map(type => {
		const c = copy(type), key = id(type), n = nativeCType(type);
		const check = [], input = [], output = [], extra = [];
		if(type.kind === "primitive")
		{
			if(type.name === "unit") check.push("if (*value != 0) return 0;");
			if(type.name === "char") check.push("if (*value > 0x10ffff || (*value >= 0xd800 && *value <= 0xdfff)) return 0;");
			if(type.name === "usize" && model.pointerBits === 32) check.push("if (*value > UINT32_MAX) return 0;");
			if(type.name === "isize" && model.pointerBits === 32) check.push("if (*value < INT32_MIN || *value > INT32_MAX) return 0;");
			if(dynamic(type))
			{
				const width = ["nat", "int"].includes(type.name) ? "sizeof(uint32_t)" : "1";
				check.push(`if ((value->length && !value->data) || !lb_charge(budget, value->length, ${width})) return 0;`);
				if(type.name === "string") check.push("if (!lb_utf8((const uint8_t *)value->data, value->length)) return 0;");
			}
			if(type.name === "unit") input.push("return lean_box(0);");
			else if(type.name === "string") input.push('return lean_mk_string_from_bytes(value->length ? value->data : "", value->length);');
			else if(type.name === "bytes") input.push("return lb_bytes_in(value->data, value->length);");
			else if(type.name === "nat") input.push("return lb_nat_in(value->data, value->length);");
			else if(type.name === "int") input.push("return lb_int_in(value->data, value->length, value->negative);");
			else input.push(`return (${n})*value;`);
			if(type.name === "string" || type.name === "bytes")
			{
				output.push(`size_t length = ${type.name === "string" ? "lean_string_size(value) - 1" : "lean_sarray_size(value)"};`
					, "if (!lb_charge(budget, length, 1)) return 0;", "void *data = length ? malloc(length) : NULL;"
					, "if (length && !data) return -1;"
					, `if (length) memcpy(data, ${type.name === "string" ? "lean_string_cstr(value)" : "lean_sarray_cptr(value)"}, length);`
					, `*out = (${c.name}){data, length, data, free};`);
			} else if(type.name === "nat" || type.name === "int")
			{
				if(type.name === "int") output.push("bool negative = lean_int_lt(value, lean_box(0));", "lean_object *magnitude = lean_nat_abs(value);");
				output.push("uint32_t *data = NULL; size_t length = 0;"
					, `int status = lb_nat_out(${type.name === "int" ? "magnitude" : "value"}, &data, &length, *budget);`);
				if(type.name === "int") output.push("lean_dec(magnitude);");
				output.push("if (status != 1) return status;", "*budget -= length * sizeof(uint32_t);"
					, `*out = (${c.name}){data, length, data, free${type.name === "int" ? ", negative" : ""}};`);
			} else if(type.name === "char") output.push("if (value > 0x10ffff || (value >= 0xd800 && value <= 0xdfff)) return -2;", "*out = value;");
			else if(type.name === "unit") output.push("*out = 0;");
			else if(type.name === "isize") output.push(`int${model.pointerBits}_t signed_value; memcpy(&signed_value, &value, sizeof(value));`, "*out = signed_value;");
			else if(/^int\d/.test(type.name)) output.push("memcpy(out, &value, sizeof(value));");
			else output.push(`*out = (${c.name})value;`);
		} else if(type.kind === "array" || type.kind === "list")
		{
			const element = copy(type.element), child = id(type.element);
			const list = type.kind === "list", helper = `lb_t${nativeTypeKey(type)}`;
			const items = list ? "items" : "value", release = list ? "lean_dec(items); " : "";
			const width = `((sizeof(${element.name}) > sizeof(void *)) ? sizeof(${element.name}) : sizeof(void *))`;
			check.push(`if ((value->length && !value->data) || !lb_charge(budget, value->length, ${width})) return 0;`
				, `for (size_t i = 0; i < value->length; ++i) if (!${child}_check(&value->data[i], budget)) return 0;`);
			input.push("lean_object *result = lean_alloc_array(value->length, value->length);"
				, `for (size_t i = 0; i < value->length; ++i) lean_array_set_core(result, i, ${boxed(type.element, `${child}_in(&value->data[i])`)});`
				, list ? `return ${helper}_from_array(result);` : "return result;");
			extra.push(`typedef struct { size_t length; ${element.name} data[]; } ${key}_owner;`
				, `static void ${key}_release(void *raw) {`, `  ${key}_owner *owner = raw;`
				, ...(element.aggregate ? [`  for (size_t i = 0; i < owner->length; ++i) ${element.name}_clear(&owner->data[i]);`] : [])
				, "  free(owner);", "}");
			if(list) output.push("lean_inc(value);", `lean_object *items = ${helper}_to_array(value);`);
			output.push(`size_t length = lean_array_size(${items});`
				, `if (!lb_charge(budget, length, ${width}) || !lb_charge(budget, 1, sizeof(${key}_owner))) { ${release}return 0; }`
				, `if (!length) { ${release}*out = (${c.name}){0}; return 1; }`
				, `${key}_owner *owner = calloc(1, sizeof(*owner) + length * sizeof(${element.name}));`
				, `if (!owner) { ${release}return -1; }`, "owner->length = length;"
				, "for (size_t i = 0; i < length; ++i) {"
				, `  int status = ${child}_out(${unboxed(type.element, `lean_array_get_core(${items}, i)`)}, &owner->data[i], budget);`
				, `  if (status != 1) { ${release}${key}_release(owner); return status; }`, "}"
				, ...(list ? ["lean_dec(items);"] : [])
				, `*out = (${c.name}){owner->data, length, owner, ${key}_release};`);
		} else if(type.kind === "variant")
		{
			const helper = `lb_t${nativeTypeKey(type)}`;
			check.push(`if (!lb_charge(budget, 1, sizeof(${c.name}))) return 0;`, "switch (value->kind) {");
			input.push("switch (value->kind) {");
			output.push(`if (!lb_charge(budget, 1, sizeof(${c.name}))) return 0;`);
			if(nativeObjectType(type)) output.push("lean_inc(value);");
			output.push(`uint32_t kind = ${helper}_tag(value);`, `if (kind >= ${type.cases.length}) return -3;`
				, `*out = (${c.name}){0};`, "out->kind = kind;", "switch (kind) {");
			type.cases.forEach((branch, i) => {
				const member = c.cases[i];
				check.push(`case ${i}:`); input.push(`case ${i}:`); output.push(`case ${i}: {`);
				const args = branch.fields.map((field, j) => {
					const slot = `cases.${member.name}.${member.fields[j].name}`;
					check.push(`  if (!${id(field.type)}_check(&value->${slot}, budget)) return 0;`);
					if(nativeObjectType(type)) output.push("  lean_inc(value);");
					output.push(`  ${nativeCType(field.type)} field${j} = ${helper}_get${i}_${j}(value);`
						, `  int status${j} = ${id(field.type)}_out(field${j}, &out->${slot}, budget);`);
					if(nativeObjectType(field.type)) output.push(`  lean_dec(field${j});`);
					output.push(`  if (status${j} != 1) { ${c.name}_clear(out); return status${j}; }`);
					return `${id(field.type)}_in(&value->${slot})`;
				});
				check.push("  break;");
				input.push(`  return ${helper}_make${i}(${args.join(", ") || "lean_box(0)"});`);
				output.push("  break;", "}");
			});
			check.push("default: return 0;", "}");
			input.push("default: abort();", "}");
			output.push("default: return -3;", "}");
		} else
		{
			const fields = type.kind === "record" ? type.fields : (type.element ? [type.element] : type.arguments).map(type => ({ type }));
			const flag = { option: "has_value", result: "is_ok" }[type.kind];
			const condition = i => flag ? `${i === 1 ? "!" : ""}value->${flag}` : "1";
			check.push(`if (!lb_charge(budget, 1, sizeof(${c.name}))) return 0;`);
			if(flag) check.push(`if (value->${flag} > 1) return 0;`);
			for(const [i, field] of fields.entries()) check.push(`if (${condition(i)} && !${id(field.type)}_check(&value->${c.fields[i].name}, budget)) return 0;`);
			const args = fields.map((field, i) => `${id(field.type)}_in(&value->${c.fields[i].name})`), helper = `lb_t${nativeTypeKey(type)}`;
			if(type.kind === "option") input.push(`return value->has_value ? ${helper}_some(${args[0]}) : ${helper}_none(lean_box(0));`);
			else if(type.kind === "result") input.push(`return value->is_ok ? ${helper}_ok(${args[0]}) : ${helper}_error(${args[1]});`);
			else input.push(`return ${helper}_make(${args.join(", ") || "lean_box(0)"});`);
			output.push(`if (!lb_charge(budget, 1, sizeof(${c.name}))) return 0;`, `*out = (${c.name}){0};`);
			if(flag)
			{
				if(nativeObjectType(type)) output.push("lean_inc(value);");
				output.push(`out->${flag} = ${helper}_has(value);`);
			}
			for(const [i, field] of fields.entries())
			{
				if(flag) output.push(`if (${i === 1 ? "!" : ""}out->${flag}) {`);
				if(nativeObjectType(type)) output.push("lean_inc(value);");
				output.push(`${nativeCType(field.type)} field${i} = lb_t${nativeTypeKey(type)}_get${i}(value);`
					, `int status${i} = ${id(field.type)}_out(field${i}, &out->${c.fields[i].name}, budget);`);
				if(nativeObjectType(field.type)) output.push(`lean_dec(field${i});`);
				output.push(`if (status${i} != 1) { ${c.name}_clear(out); return status${i}; }`);
				if(flag) output.push("}");
			}
		}
		return [...extra
			, `static inline int ${key}_check(const ${c.name} *value, size_t *budget) {`
			, "  (void)value; (void)budget;", ...check.map(line => `  ${line}`)
			, "  return 1;", "}"
			, `static inline ${n} ${key}_in(const ${c.name} *value) {`
			, "  (void)value;", ...input.map(line => `  ${line}`), "}"
			, `static inline int ${key}_out(${n} value, ${c.name} *out, size_t *budget) {`
			, "  (void)value; (void)budget;", ...output.map(line => `  ${line}`)
			, "  return 1;", "}"].join("\n");
	});
	const exports = new Map(model.exports.map(item => [`lean:${item.name}`, item])), bounds = [];
	const calls = surface.functions.filter(fn => ![...fn.declaration.parameters, fn.declaration.result].some(site => surface.callbacks.has(site.type.id))).map(fn => {
		const native = exports.get(fn.declaration.id), lines = [`static ${p}_status lb_call_${fn.field}(${fn.signature}) {`
			// Public C parameter names start with a lowercase letter. Keep every
			// generator-owned local in the disjoint _lb_ namespace so an admitted
			// Lean parameter such as `value`, `result`, `status` or `budget` cannot
			// redeclare an implementation local in the same function scope.
			, "  (void)context; size_t _lb_budget = 16u * 1024u * 1024u;"
			, `  if (lb_ready(error) != ${macro}_STATUS_OK) return ${macro}_STATUS_UNEXPECTED_ERROR;`];
		const refinements = native.refinements?.parameters ?? [];
		const parameterBounds = fn.parameters.map(({ name }, index) => ({
			label: name
			, value: copy(native.parameters[index].type).aggregate ? name : `(&${name})`
		}));
		const args = fn.parameters.map(({ name }, i) => {
			const type = native.parameters[i].type, value = copy(type).aggregate ? name : `&${name}`;
			lines.push(`  if (!${id(type)}_check(${value}, &_lb_budget)) return lb_invalid(error, "Invalid copied input or 16 MiB call limit exceeded");`);
			return `${id(type)}_in(${value})`;
		});
		// Every bound is checked on caller limbs before any Lean value is allocated,
		// including each element reached through arrays, lists, options, products, results,
		// record fields and the active variant case.
		const constructed = refinement => ["subtype", "checked-record"].includes(refinement?.kind);
		refinements.forEach((refinement, i) => {
			if(!refinement) return;
			const value = copy(native.parameters[i].type).aggregate ? fn.parameters[i].name : `(&${fn.parameters[i].name})`;
			const reject = message => `return lb_invalid(error, ${message});`;
			lines.push(...finRefinementWalk({ refinement, type: native.parameters[i].type, value, constant: `lb_fin_${fn.field}_${i}`, label: fn.parameters[i].name, copy, bounds, reject, parameterBounds }));
		});
		// Author-checked constructors run only after every structural and Fin check, on a fresh
		// conversion that the exported validator owns and releases; the call converts again.
		// A checked record's conversion builds only its payload mirror; the constructor builds the record.
		refinements.forEach((refinement, i) => {
			if(!refinement || !constructorRefinementLeaves(refinement, native.parameters[i].type).length) return;
			const type = native.parameters[i].type, value = copy(type).aggregate ? fn.parameters[i].name : `&${fn.parameters[i].name}`;
			lines.push(...constructorRefinementWalk({ refinement, type, value
				, symbol: `${native.symbol}_refinement_${i}`
				, label: fn.parameters[i].name, copy
				, input: (child, expression) => `${id(child)}_in(${expression})`
				, reject: message => `return lb_invalid(error, ${message});` }));
		});
		if(refinements.some(Boolean))
		{
			const nestedConstructor = refinements.some((refinement, i) => refinement && !constructed(refinement) && constructorRefinementLeaves(refinement, native.parameters[i].type).length);
			const checkedRejection = nestedConstructor || (refinements.some(constructed) && !refinements.some(refinement => refinement && !constructed(refinement)));
			lines.push(`  lean_object *_lb_checked = ${native.symbol}(${args.join(", ") || "lean_box(0)"});`
				, `  if (lean_is_scalar(_lb_checked)) return lb_invalid(error, ${JSON.stringify(checkedRejection ? "Lean rejected an argument outside its checked refinement" : "Lean rejected an argument outside its Fin bound")});`
				, "  lean_object *_lb_boxed = lean_ctor_get(_lb_checked, 0);");
			if(nativeObjectType(native.result)) lines.push("  lean_inc(_lb_boxed);");
			lines.push(`  ${nativeCType(native.result)} _lb_value = ${unboxed(native.result, "_lb_boxed")};`, "  lean_dec(_lb_checked);");
		}
		else lines.push(`  ${nativeCType(native.result)} _lb_value = ${native.symbol}(${args.join(", ") || "lean_box(0)"});`);
		if(native.result.kind !== "primitive" || native.result.name !== "unit")
		{
			lines.push(`  ${copy(native.result).name} _lb_result = {0};`, `  int _lb_status = ${id(native.result)}_out(_lb_value, &_lb_result, &_lb_budget);`);
			if(nativeObjectType(native.result)) lines.push("  lean_dec(_lb_value);");
			lines.push('  if (_lb_status == 0) return lb_invalid(error, "16 MiB call limit exceeded");'
				, '  if (_lb_status == -2) return lb_failure(error, "Invalid native Unicode scalar result");'
				, ...(model.types.some(type => type.kind === "variant") ? ['  if (_lb_status == -3) return lb_failure(error, "Invalid native variant result");'] : [])
				, '  if (_lb_status < 0) return lb_failure(error, "Cannot allocate copied result");'
				, `  if (lb_ready(error) != ${macro}_STATUS_OK) { ${copy(native.result).aggregate ? `${copy(native.result).name}_clear(&_lb_result); ` : ""}return ${macro}_STATUS_UNEXPECTED_ERROR; }`, "  *out = _lb_result;");
		} else lines.push("  lean_dec(_lb_value); (void)_lb_budget;", `  if (lb_ready(error) != ${macro}_STATUS_OK) return ${macro}_STATUS_UNEXPECTED_ERROR;`);
		lines.push(`  if (error) *error = (${p}_error){0};`, `  return ${macro}_STATUS_OK;`, "}");
		return lines.join("\n");
	});
	// A leased closure's checked arguments use the same comparison in the callable section below.
	const fin = bounds.length || model.exports.some(item => item.refinements?.parameters.some(Boolean)) || model.types.some(type => type.checked) ? [finBelow, ...bounds].join("\n") + "\n\n" : "";
	return `${definitions.join("\n\n")}\n\n${fin}${calls.join("\n\n")}`;
};
