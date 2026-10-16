/**
 * Exact checked-refinement diagnostics over validated recursive Wasm frames.
 * Lean remains authoritative: generated walkers locate each public position and
 * invoke the compiler-owned constructor validator for that exact carrier.
 *
 * @file
 */
import { componentRecursiveLimits } from "../abi/component-recursive.mjs";
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { componentRefinementMirrors } from "./component-refinement-mirrors.mjs";
import { componentRecursiveRefinementLeafKey } from "./component-refinements.mjs";

const leanTypes = {
	unit: "Unit", bool: "Bool", uint8: "UInt8", uint16: "UInt16"
	, uint32: "UInt32", uint64: "UInt64", int8: "Int8", int16: "Int16"
	, int32: "Int32", int64: "Int64", nat: "Nat", int: "Int"
	, float32: "Float32", float64: "Float", string: "String", bytes: "ByteArray"
	, char: "Char", usize: "USize", isize: "ISize"
};
const leanType = type => {
	if(type.kind === "primitive") return `_root_.${leanTypes[type.name]}`;
	if(type.kind === "named") return `_root_.${type.id.slice(5)}`;
	const arguments_ = type.arguments.map(leanType);
	if(type.constructor === "result")
		return `(_root_.Except ${arguments_[1]} ${arguments_[0]})`;
	return `(_root_.${{
		array: "Array", list: "List", option: "Option", tuple: "Prod"
	}[type.constructor]} ${arguments_.join(" ")})`;
};
const finBoundLimbs = bound => {
	if(typeof bound !== "string" || !/^(?:0|[1-9][0-9]*)$/u.test(bound))
		throw new TypeError("Invalid recursive Fin bound");
	const limbs = [];
	for(let value = BigInt(bound); value > 0n; value >>= 32n)
		limbs.push(Number(value & 0xffffffffn));
	return limbs;
};

/**
 * Render bounded first-error diagnostics for selected recursive inputs.
 *
 * @param options - Authenticated recursive ABI and compiler selections.
 * @param options.abi - Closed recursive private ABI.
 * @param options.exports - Compiler-selected source exports.
 * @param options.nominalRefinements - Shared nominal constraints.
 * @param options.walker - Resolve a private type to its generated frame walker.
 */
export const componentRecursiveDiagnostics = ({
	abi, exports, nominalRefinements, walker
}) => {
	if(!exports.length) return null;
	const normalized = componentRefinementMirrors(
		abi, exports, leanType, nominalRefinements);
	if(!normalized.sites.some(item => item.refinements.parameters.some(Boolean)))
		return null;
	const definitions = new Map(abi.types.map(type => [type.id, type]));
	const cycles = normalized.cycles, validators = new Set(), bounds = new Map();
	const helpers = new Map();
	let local = 0;
	const contains = (tree, mode, active = new Set()) => {
		if(!tree) return false;
		if(tree.kind === "fin") return mode === "fin";
		if(tree.kind === "subtype") return mode === "constructor";
		if(tree.kind === "checked-record") return mode === "constructor"
			|| (tree.arguments ?? []).some(child => contains(child, mode, active));
		if(tree.kind === "recursive")
		{
			if(active.has(tree.cycle)) return false;
			const target = cycles.get(tree.cycle);
			if(!target) throw new TypeError(`Missing recursive refinement target ${tree.cycle}`);
			return contains(target, mode, new Set([...active, tree.cycle]));
		}
		const nested = tree.cycle ? new Set([...active, tree.cycle]) : active;
		const children = tree.kind === "variant"
			? tree.cases.flatMap(branch => branch.arguments) : tree.arguments ?? [];
		return children.some(child => contains(child, mode, nested));
	};
	const appendText = (value, indent = "  ") =>
		`${indent}if (!crd_text(${JSON.stringify(value)}, sizeof(${JSON.stringify(value)}) - 1)) return 5;`;
	const scoped = (segments, call, indent = "  ") => {
		const suffix = local++, mark = `mark${suffix}`, status = `status${suffix}`;
		return [
			`${indent}uint32_t ${mark} = crd_length;`
			, ...segments.map(segment => typeof segment === "string"
				? appendText(segment, indent)
				: `${indent}if (!crd_index(${segment.index})) return 5;`)
			, `${indent}uint32_t ${status} = ${call};`
			, `${indent}if (${status}) return ${status};`
			, `${indent}crd_restore(${mark});`
		];
	};
	const concrete = (type, aliases = new Set()) => {
		if(type.kind !== "named") return type;
		const definition = definitions.get(type.id);
		if(definition?.kind !== "alias") return type;
		if(aliases.has(type.id)) throw new TypeError(`Recursive diagnostic alias ${type.id}`);
		return concrete(definition.target, new Set([...aliases, type.id]));
	};
	const helper = (mode, inputTree, inputType, symbol, parameter) => {
		let tree = inputTree, type = concrete(inputType);
		if(tree.kind === "recursive")
		{
			tree = cycles.get(tree.cycle);
			if(!tree) throw new TypeError(`Missing recursive refinement target ${inputTree.cycle}`);
		}
		const key = sha256(canonicalJson({ mode, tree, type, symbol, parameter })).slice(0, 20);
		const name = `crd_${key}`;
		if(helpers.has(name)) return name;
		const entry = { name, lines: null }; helpers.set(name, entry);
		const lines = [
			`static uint32_t ${name}(bridge_scalar_slot const *slot, uint32_t depth, uint32_t *nodes) {`
			, `  if (depth > ${componentRecursiveLimits.valueDepth} || !*nodes) return 4;`
			, "  --*nodes;"
		];
		const definition = type.kind === "named" ? definitions.get(type.id) : null;
		const children = () =>
			"bridge_scalar_slot const *children = (bridge_scalar_slot const *)(uintptr_t)(uint32_t)slot->bits;";
		const descend = (child, childType, segment, expression, indent = "  ") => {
			if(!contains(child, mode)) return [];
			const childName = helper(mode, child, childType, symbol, parameter);
			return scoped([segment], `${childName}(${expression}, depth + 1, nodes)`, indent);
		};
		if(tree.kind === "fin")
		{
			if(mode === "fin")
			{
				if(type.kind !== "primitive" || type.name !== "nat")
					throw new TypeError("A recursive Fin diagnostic must erase to Nat");
				const limbs = finBoundLimbs(tree.bound);
				const constant = `crd_fin_${sha256(tree.bound).slice(0, 20)}`;
				if(limbs.length) bounds.set(constant
					, `static const uint32_t ${constant}[${limbs.length}] = {${limbs.map(
						limb => `0x${limb.toString(16)}u`).join(", ")}};`);
				lines.push(`  if (!crd_fin_below(slot, ${limbs.length ? constant : "NULL"}, ${limbs.length}))`
					, `    return crd_reject(${JSON.stringify(` must be bigint below ${tree.bound}`)});`);
			}
		}
		else if(tree.kind === "subtype")
		{
			if(mode === "constructor")
			{
				const leaf = componentRecursiveRefinementLeafKey(tree, type);
				const validator = `${symbol}_graph_refinement_${parameter}_${leaf}`;
				validators.add(`extern uint8_t ${validator}(lean_object *);`);
				lines.push(`  if (!${validator}(${walker(type)}_decode(slot)))`
					, `    return crd_reject(${JSON.stringify(` was rejected by ${tree.constructor}`)});`);
			}
		}
		else if(tree.kind === "checked-record")
		{
			if(definition?.kind !== "record")
				throw new TypeError(`Recursive checked-record diagnostic differs from ${tree.definition}`);
			if(Object.hasOwn(tree, "arguments"))
			{
				lines.push(`  ${children()}`);
				for(const [index, child] of tree.arguments.entries())
					lines.push(...descend(child, definition.fields[index].type
						, `.${tree.fields[index]}`, `children + ${index}`));
			}
			if(mode === "constructor")
			{
				const leaf = componentRecursiveRefinementLeafKey(tree, type);
				const validator = `${symbol}_graph_refinement_${parameter}_${leaf}`;
				validators.add(`extern uint8_t ${validator}(lean_object *);`);
				lines.push(`  if (!${validator}(${walker(type)}_decode(slot)))`
					, `    return crd_reject(${JSON.stringify(` was rejected by ${tree.constructor}`)});`);
			}
		}
		else if(tree.kind === "record")
		{
			if(definition?.kind !== "record" || definition.fields.length !== tree.arguments.length)
				throw new TypeError("Recursive record diagnostic differs from its layout");
			lines.push(`  ${children()}`);
			for(const [index, child] of tree.arguments.entries())
				lines.push(...descend(child, definition.fields[index].type
					, `.${tree.fields[index]}`, `children + ${index}`));
		}
		else if(tree.kind === "variant")
		{
			if(definition?.kind !== "variant" || definition.cases.length !== tree.cases.length)
				throw new TypeError("Recursive variant diagnostic differs from its layout");
			lines.push(`  ${children()}`, "  switch (slot->flags >> 2) {");
			for(const [branchIndex, branch] of tree.cases.entries())
			{
				const fields = definition.cases[branchIndex].fields;
				const nested = branch.arguments.flatMap((child, index) =>
					descend(child, fields[index].type, `.${branch.fields[index]}`
						, `children + ${index}`, "    "));
				if(nested.length) lines.push(`  case ${branchIndex}:`, ...nested, "    break;");
			}
			lines.push("  default: break;", "  }");
		}
		else if(["array", "list"].includes(tree.kind))
		{
			if(type.kind !== "apply" || type.constructor !== tree.kind)
				throw new TypeError(`Recursive ${tree.kind} diagnostic differs from its layout`);
			const child = tree.arguments[0];
			if(contains(child, mode))
			{
				const childName = helper(mode, child, type.arguments[0], symbol, parameter);
				const index = `i${local++}`;
				lines.push(`  ${children()}`, "  uint32_t count = (uint32_t)(slot->bits >> 32);"
					, `  for (uint32_t ${index} = 0; ${index} < count; ++${index}) {`
					, ...scoped([{ index }]
						, `${childName}(children + ${index}, depth + 1, nodes)`, "    "), "  }");
			}
		}
		else
		{
			if(type.kind !== "apply" || type.constructor !== tree.kind)
				throw new TypeError(`Recursive ${tree.kind} diagnostic differs from its layout`);
			lines.push(`  ${children()}`);
			for(const [index, child] of tree.arguments.entries())
			{
				const segment = tree.kind === "option" ? ".value"
					: tree.kind === "result" ? `.${index ? "error" : "ok"}` : `[${index}]`;
				const expression = ["option", "result"].includes(tree.kind)
					? "children" : `children + ${index}`;
				const nested = descend(child, type.arguments[index], segment, expression
					, ["option", "result"].includes(tree.kind) ? "    " : "  ");
				if(tree.kind === "option") lines.push("  if (slot->flags & 1u) {", ...nested, "  }");
				else if(tree.kind === "result") lines.push(
					`  if ((slot->flags & 1u) == ${index}) {`, ...nested, "  }");
				else lines.push(...nested);
			}
		}
		lines.push("  return 0;", "}"); entry.lines = lines;
		return name;
	};
	const signatures = new Map(abi.exports.map(item => [item.bindingId, item]));
	const calls = new Map();
	for(const item of normalized.sites)
	{
		const signature = signatures.get(item.bindingId);
		if(!signature) throw new TypeError("Recursive diagnostic export lacks a signature");
		const passes = [];
		for(const mode of ["fin", "constructor"])
		{
			const checked = item.refinements.parameters.map((tree, index) => {
				const parameter = item.parameters[index]?.name;
				const parameterName = typeof parameter === "string" && parameter.length
					? parameter : `arg${index}`;
				return tree && contains(tree, mode) ? {
					index
					, root: `${item.bindingId.slice(item.bindingId.lastIndexOf(".") + 1)}.${parameterName}`
					, name: helper(mode, tree, signature.parameters[index], item.symbol, index)
				} : null;
			}).filter(Boolean);
			if(checked.length) passes.push({ mode, checked });
		}
		if(passes.length) calls.set(item.bindingId, passes);
	}
	const support = `
enum { CRD_MESSAGE_LIMIT = 16384, CRD_KIND = UINT32_MAX };
static char crd_message[CRD_MESSAGE_LIMIT + 1];
static uint32_t crd_length;
static inline void crd_reset(void) { crd_length = 0; crd_message[0] = 0; }
static inline void crd_restore(uint32_t mark) { crd_length = mark; crd_message[mark] = 0; }
static inline int crd_text(const char *text, uint32_t length) {
  if (length > CRD_MESSAGE_LIMIT - crd_length) return 0;
  memcpy(crd_message + crd_length, text, length); crd_length += length;
  crd_message[crd_length] = 0; return 1;
}
static inline int crd_index(uint32_t value) {
  char digits[11]; uint32_t length = 0;
  do { digits[length++] = (char)('0' + value % 10); value /= 10; } while (value);
  if (!crd_text("[", 1)) return 0;
  while (length) if (!crd_text(&digits[--length], 1)) return 0;
  return crd_text("]", 1);
}
static inline uint32_t crd_overflow(void) {
  static const char overflow[] = "Refinement diagnostic exceeds 16 KiB";
  crd_reset(); (void)crd_text(overflow, sizeof(overflow) - 1); return 5;
}
static inline uint32_t crd_reject(const char *suffix) {
  if (!crd_text(suffix, (uint32_t)strlen(suffix))) return crd_overflow();
  return 5;
}
static inline int crd_fin_below(bridge_scalar_slot const *slot, const uint32_t *bound, uint32_t bound_length) {
  const uint32_t *data = (const uint32_t *)(uintptr_t)(uint32_t)slot->bits;
  uint32_t length = (uint32_t)(slot->bits >> 32);
  while (length && data[length - 1] == 0) --length;
  if (length != bound_length) return length < bound_length;
  while (length--) if (data[length] != bound[length]) return data[length] < bound[length];
  return 0;
}
static inline uint32_t crd_frame_failure(bridge_scalar_frame *frame) {
  frame->result.kind = CRD_KIND; frame->result.flags = 0;
  frame->result.bits = ((uint64_t)crd_length << 32) | (uint32_t)(uintptr_t)crd_message;
  frame->status = 5; return 5;
}
`;
	return {
		support
		, validators: [...validators].sort()
		, bounds: [...bounds.values()].sort()
		, prototypes: [...helpers.values()].map(({ name }) =>
			`static uint32_t ${name}(bridge_scalar_slot const *, uint32_t, uint32_t *);`)
		, helpers: [...helpers.values()].map(entry => entry.lines.join("\n"))
		, calls
	};
};
