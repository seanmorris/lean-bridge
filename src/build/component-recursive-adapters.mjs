/**
 * Bounded wasm32 walkers for finite copied graphs. All Lean values, including
 * primitives, travel in checked Array carriers emitted by the Lean generator.
 *
 * @file
 */
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { componentScalarTypes } from "../abi/component-scalars.mjs";
import { compileComponentCopiedGraph, componentRecursiveLimits } from "../abi/component-recursive.mjs";
import { componentRecursiveHelper, componentRecursiveTypes } from "./component-recursive-lean.mjs";
import { hasComponentNominalRefinements } from "./component-refinement-mirrors.mjs";
import { componentRecursiveDiagnostics } from "./component-recursive-diagnostics.mjs";

/**
 * Identify a shared copied-value walker after resolving transparent aliases.
 *
 * @param abi - Authenticated copied-value descriptor.
 * @param type - Concrete payload root from this descriptor.
 * @param nominalRefinements - Constraints requiring preserved alias constructors.
 */
export const componentRecursiveWalker = (abi, type, nominalRefinements = []) => {
	const { resolve } = compileComponentCopiedGraph({ schemaVersion: 1, root: abi.exports[0].result, types: abi.types });
	const definition = type.kind === "named" && nominalRefinements.length ? abi.types.find(value => value.id === type.id) : null;
	const value = definition?.kind === "alias" ? definition : resolve(type);
	const reference = ["alias", "record", "variant"].includes(value.kind) ? { kind: "named", id: value.id } : value;
	return `recursive_${sha256(canonicalJson(reference)).slice(0, 20)}`;
};

/**
 * Validate every argument before allocating Lean objects. Transparent alias
 * chains resolve during generation and consume no runtime recursion depth.
 * Encoders consume each carrier and clean only their own initialized output.
 *
 * @param abi - Validated recursive private ABI, authenticated against public IR.
 * @param options - Select shared codecs without ordinary exported call frames.
 * @param options.exportFrames - Keep existing public frame generation by default.
 * @param options.exports - Compiler-owned source exports carrying refinements.
 * @param options.nominalRefinements - Constraints requiring typed alias construction.
 */
export const generateComponentRecursiveAdapters = (abi, { exportFrames = true, exports = [], nominalRefinements = [] } = {}) => {
	const refs = componentRecursiveTypes(abi);
	const nominal = exports.some(item => [...item.refinements?.parameters ?? [], item.refinements?.result ?? null].some(tree => hasComponentNominalRefinements(tree)));
	const { resolve } = compileComponentCopiedGraph({ schemaVersion: 1, root: abi.exports[0].result, types: abi.types });
	const definitions = new Map(abi.types.map(type => [type.id, type]));
	const definitionOf = type => nominalRefinements.length && type.kind === "named" && definitions.get(type.id)?.kind === "alias"
		? definitions.get(type.id) : resolve(type);
	const reference = type => {
		const value = definitionOf(type);
		return ["alias", "record", "variant"].includes(value.kind) ? { kind: "named", id: value.id } : value;
	};
	const identity = type => sha256(canonicalJson(reference(type))).slice(0, 20);
	const walker = type => `recursive_${identity(type)}`;
	const types = new Map(refs.map(type => [walker(type), reference(type)]));
	const diagnostics = nominal ? componentRecursiveDiagnostics({
		abi, exports, nominalRefinements, walker
	}) : null;
	const lines = [
		'#include "component_scalar.h"'
		, ...diagnostics ? [
			diagnostics.support
			, ...diagnostics.validators, ...diagnostics.bounds, ...diagnostics.prototypes
		] : []
		, '_Static_assert(sizeof(size_t) == 4, "recursive frames require wasm32 Lean");'
		, "typedef struct {"
		, "  uint32_t bytes, nodes;"
		, "  bridge_recursive_arena *owner;"
		, `  bridge_scalar_slot const *path[${componentRecursiveLimits.valueDepth + 1}];`
		, "} recursive_budget;"
		, "static uint32_t recursive_enter(bridge_scalar_slot const *slot, uint32_t depth, recursive_budget *budget) {"
		, `  if (depth > ${componentRecursiveLimits.valueDepth} || !budget->nodes) return 4;`
		, "  for (uint32_t i = 0; i < depth; ++i) if (budget->path[i] == slot) return 3;"
		, "  budget->path[depth] = slot; --budget->nodes; return 0;"
		, "}", ""
	];
	for(const [id, type] of types)
	{
		lines.push(`static uint32_t ${id}_validate(bridge_scalar_slot const *, uint32_t, recursive_budget *);`
			, `static lean_object *${id}_decode(bridge_scalar_slot const *);`
			, `static uint32_t ${id}_encode(bridge_scalar_slot *, lean_object *, uint32_t, recursive_budget *);`);
		if(type.kind === "primitive") continue;
		const definition = definitionOf(type), symbol = componentRecursiveHelper(abi, type);
		const make = (name, count) => lines.push(`extern lean_object *${symbol}_${name}(${Array(Math.max(1, count)).fill("lean_object *").join(", ")});`);
		const field = name => lines.push(`extern lean_object *${symbol}_${name}(lean_object *);`);
		if(definition.kind === "alias")
		{ make("make", 1); field("field0"); }
		else if(definition.kind === "variant")
		{
			lines.push(`extern uint32_t ${symbol}_branch(lean_object *);`);
			definition.cases.forEach((item, branch) => {
				make(`make${branch}`, item.fields.length);
				item.fields.forEach((_, index) => field(`case${branch}_field${index}`));
			});
		}
		else if(["host-null", "option", "result"].includes(type.constructor))
		{
			lines.push(`extern uint32_t ${symbol}_branch(lean_object *);`);
			if(["host-null", "option"].includes(type.constructor)) make("none", 0);
			type.arguments.forEach((_, index) => { make(`make${index}`, 1); field(`field${index}`); });
		}
		else if(["array", "list"].includes(type.constructor))
		{ make("make", 1); field("items"); }
		else
		{
			const fields = definition.kind === "record" ? definition.fields : type.arguments;
			make("make", fields.length); fields.forEach((_, index) => field(`field${index}`));
		}
	}
	const validateChild = (type, slot) => `if ((status = ${walker(type)}_validate(${slot}, depth + 1, budget))) return status;`;
	const encodeField = (type, name, slot) => [
		"  if (!status) {", "    lean_inc(value);"
		, `    lean_object *child = ${name}(value);`
		, `    status = ${walker(type)}_encode(${slot}, child, depth + 1, budget);`
		, "  }"];
	for(const [id, type] of types)
	{
		if(type.kind === "primitive")
		{
			const tag = componentScalarTypes.indexOf(type.name);
			lines.push(`static uint32_t ${id}_validate(bridge_scalar_slot const *slot, uint32_t depth, recursive_budget *budget) {`
				, "  uint32_t status = recursive_enter(slot, depth, budget);"
				, `  return status ? status : bridge_copied_validate(slot, ${tag}, 0, &budget->bytes);`, "}"
				, `static lean_object *${id}_decode(bridge_scalar_slot const *slot) {`
				, "  lean_object *value = lean_alloc_array(1, 1);"
				, `  lean_array_set_core(value, 0, bridge_copied_decode(slot, ${tag}, 0));`, "  return value;", "}"
				, `static uint32_t ${id}_encode(bridge_scalar_slot *slot, lean_object *value, uint32_t depth, recursive_budget *budget) {`
				, `  if (depth > ${componentRecursiveLimits.valueDepth} || !budget->nodes) { lean_dec(value); return 4; }`
				, "  --budget->nodes;"
				, "  if (!lean_is_array(value) || lean_array_size(value) != 1) { lean_dec(value); return 6; }"
				, "  lean_object *child = lean_array_get_core(value, 0); lean_inc(child); lean_dec(value);"
				, `  return bridge_recursive_encode_leaf(budget->owner, slot, ${tag}, child, &budget->bytes);`, "}");
			continue;
		}
		const definition = definitionOf(type), symbol = componentRecursiveHelper(abi, type);
		if(definition.kind === "alias")
		{
			const target = walker(definition.target);
			lines.push(`static uint32_t ${id}_validate(bridge_scalar_slot const *slot, uint32_t depth, recursive_budget *budget) {`
				, `  return ${target}_validate(slot, depth, budget);`, "}"
				, `static lean_object *${id}_decode(bridge_scalar_slot const *slot) {`
				, `  return ${symbol}_make(${target}_decode(slot));`, "}"
				, `static uint32_t ${id}_encode(bridge_scalar_slot *slot, lean_object *value, uint32_t depth, recursive_budget *budget) {`
				, `  return ${target}_encode(slot, ${symbol}_field0(value), depth, budget);`, "}");
			continue;
		}
		const variant = definition.kind === "variant", array = ["array", "list"].includes(type.constructor);
		const option = type.constructor === "option", hostNull = type.constructor === "host-null", nullable = option || hostNull, sum = nullable || type.constructor === "result";
		const children = definition.kind === "record" ? definition.fields.map(field => field.type) : type.arguments;
		const tag = variant ? 37 : definition.kind === "record" ? 36 : ({ array: 32, list: 32, option: 34, result: 35, tuple: 33, "host-null": 38 })[type.constructor];
		const count = variant || array || nullable ? "UINT32_MAX" : sum ? "1" : String(children.length);
		lines.push(`static uint32_t ${id}_validate(bridge_scalar_slot const *slot, uint32_t depth, recursive_budget *budget) {`
			, "  uint32_t status = recursive_enter(slot, depth, budget);", "  if (status) return status;"
			, `  status = bridge_nominal_children_validate(slot, ${tag}, ${count}, &budget->bytes);`, "  if (status) return status;"
			, "  uint32_t count = slot->bits >> 32;", "  if (count > budget->nodes) return 4;"
			, "  bridge_scalar_slot const *children = (bridge_scalar_slot const *)(uintptr_t)(uint32_t)slot->bits;");
		if(variant)
		{
			lines.push("  switch (slot->flags >> 2) {");
			definition.cases.forEach((item, branch) => {
				lines.push(`  case ${branch}:`, `    if (count != ${item.fields.length}) return 3;`);
				item.fields.forEach((field, index) => lines.push(`    ${validateChild(field.type, `children + ${index}`)}`));
				lines.push("    return 0;");
			});
			lines.push("  default: return 3;", "  }");
		}
		else if(array) lines.push(`  for (uint32_t i = 0; i < count; ++i) { ${validateChild(children[0], "children + i")} }`);
		else if(sum) children.forEach((child, index) => lines.push(`  if ((slot->flags & 1u) == ${nullable ? 1 : index}) { ${validateChild(child, "children")} }`));
		else children.forEach((child, index) => lines.push(`  ${validateChild(child, `children + ${index}`)}`));
		lines.push("  return 0;", "}", `static lean_object *${id}_decode(bridge_scalar_slot const *slot) {`
			, "  bridge_scalar_slot const *children = (bridge_scalar_slot const *)(uintptr_t)(uint32_t)slot->bits;");
		const decode = (children, make) => {
			children.forEach((child, index) => lines.push(`    lean_object *a${index} = ${walker(child)}_decode(children + ${index});`));
			lines.push(`    return ${symbol}_${make}(${children.length ? children.map((_, index) => `a${index}`).join(", ") : "lean_box(0)"});`);
		};
		if(variant)
		{
			lines.push("  switch (slot->flags >> 2) {");
			definition.cases.forEach((item, branch) => {
				lines.push(`  case ${branch}: {`); decode(item.fields.map(field => field.type), `make${branch}`); lines.push("  }");
			});
			lines.push("  default: return lean_alloc_array(0, 0); /* unreachable after validation */", "  }");
		}
		else if(array) lines.push("  uint32_t count = slot->bits >> 32;", "  lean_object *items = lean_alloc_array(count, count);"
			, `  for (uint32_t i = 0; i < count; ++i) lean_array_set_core(items, i, ${walker(children[0])}_decode(children + i));`
			, `  return ${symbol}_make(items);`);
		else if(sum)
		{
			if(nullable) lines.push(`  if (!(slot->flags & 1u)) return ${symbol}_none(lean_box(0));`);
			children.forEach((child, index) => lines.push(`  if ((slot->flags & 1u) == ${nullable ? 1 : index}) return ${symbol}_make${index}(${walker(child)}_decode(children));`));
			lines.push("  return lean_alloc_array(0, 0); /* unreachable after validation */");
		}
		else decode(children, "make");
		lines.push("}", `static uint32_t ${id}_encode(bridge_scalar_slot *slot, lean_object *value, uint32_t depth, recursive_budget *budget) {`
			, `  if (depth > ${componentRecursiveLimits.valueDepth} || !budget->nodes) { lean_dec(value); return 4; }`
			, "  --budget->nodes;", "  if (!lean_is_array(value) || lean_array_size(value) != 1) { lean_dec(value); return 6; }");
		if(variant || sum) lines.push("  lean_inc(value);", `  uint32_t branch = ${symbol}_branch(value);`
			, `  if (branch >= ${variant ? definition.cases.length : 2}) { lean_dec(value); return 6; }`);
		if(variant)
		{
			lines.push("  uint32_t status = 0;", "  switch (branch) {");
			definition.cases.forEach((item, branch) => {
				lines.push(`  case ${branch}: {`, `    if (budget->nodes < ${item.fields.length}) { lean_dec(value); return 4; }`
					, `    status = bridge_recursive_children_allocate(budget->owner, slot, 37, ${item.fields.length}, branch, &budget->bytes);`
					, "    if (status) { lean_dec(value); return status; }"
					, "    bridge_scalar_slot *children = (bridge_scalar_slot *)(uintptr_t)(uint32_t)slot->bits;");
				item.fields.forEach((field, index) => lines.push(...encodeField(field.type, `${symbol}_case${branch}_field${index}`, `children + ${index}`)));
				lines.push("    break;", "  }");
			});
			lines.push("  }");
		}
		else
		{
			if(array) lines.push(`  value = ${symbol}_items(value);`);
			lines.push(`  size_t count = ${array ? "lean_array_size(value)" : nullable ? "branch" : sum ? "1" : children.length};`
				, "  if (count > budget->nodes) { lean_dec(value); return 4; }"
				, `  uint32_t status = bridge_recursive_children_allocate(budget->owner, slot, ${tag}, (uint32_t)count, ${sum ? "branch" : "0"}, &budget->bytes);`
				, "  if (status) { lean_dec(value); return status; }", "  bridge_scalar_slot *children = (bridge_scalar_slot *)(uintptr_t)(uint32_t)slot->bits;");
			if(array) lines.push("  for (uint32_t i = 0; i < count; ++i) {", "    lean_object *child = lean_array_get_core(value, i); lean_inc(child);"
				, `    status = ${walker(children[0])}_encode(children + i, child, depth + 1, budget);`, "    if (status) break;", "  }");
			else if(sum) children.forEach((child, index) => lines.push(`  if (branch == ${nullable ? 1 : index}) {`, ...encodeField(child, `${symbol}_field${index}`, "children"), "  }"));
			else children.forEach((child, index) => lines.push(...encodeField(child, `${symbol}_field${index}`, `children + ${index}`)));
		}
		lines.push("  lean_dec(value);", "  return status;", "}");
	}
	if(diagnostics) lines.push(...diagnostics.helpers, "");
	for(const item of exportFrames ? abi.exports : [])
	{
		const refinements = exports.find(value => value.bindingId === item.bindingId)?.refinements?.parameters ?? [];
		if(nominal) item.parameters.forEach((_, index) => lines.push(`extern uint8_t ${item.symbol}_fin_guard_${index}(lean_object *);`));
		const cleanup = item.parameters.map((_, index) => `lean_dec(a${index});`).join(" ");
		for(const [index, refinement] of refinements.entries()) if(refinement && (nominalRefinements.length || refinement.kind !== "fin"))
			lines.push(`extern uint8_t ${item.symbol}_refinement_${index}(lean_object *);`);
		const diagnosticPasses = diagnostics?.calls.get(item.bindingId) ?? [];
		const diagnostic = (mode, index) => {
			const check = diagnosticPasses.find(pass => pass.mode === mode)
				?.checked.find(candidate => candidate.index === index);
			if(!check) return null;
			const root = JSON.stringify(check.root);
			return [
				`    ${cleanup} bridge_recursive_frame_clear(frame);`
				, "    crd_reset();"
				, `    if (!crd_text(${root}, sizeof(${root}) - 1)) {`
				, "      crd_overflow(); return crd_frame_failure(frame);"
				, "    }"
				, `    uint32_t diagnostic_nodes = ${componentRecursiveLimits.valueNodes};`
				, `    status = ${check.name}(&frame->args[${index}], 0, &diagnostic_nodes);`
				, "    if (status == 5) return crd_frame_failure(frame);"
				, "    frame->status = status ? status : 6; return frame->status;"
			];
		};
		lines.push(`extern lean_object *${item.symbol}_lean(${Array(Math.max(1, item.parameters.length)).fill("lean_object *").join(", ")});`
			, `LEAN_EXPORT uint32_t ${item.symbol}(bridge_scalar_frame *frame) {`
			, `  uint32_t status = bridge_recursive_frame_validate(frame, ${item.parameters.length});`
			, "  if (status) return status;", "  if (bridge_recursive_abi() != 1) return 6;"
			, `  recursive_budget budget = { .bytes = 16u * 1024u * 1024u, .nodes = ${componentRecursiveLimits.valueNodes}, .owner = NULL, .path = {0} };`);
		item.parameters.forEach((type, index) => lines.push(`  if ((status = ${walker(type)}_validate(&frame->args[${index}], 0, &budget))) return status;`));
		lines.push("  if (budget.bytes < 16 || !budget.nodes) return 4;", "  budget.bytes -= 16;");
		lines.push("  if ((status = bridge_recursive_arena_open(frame, &budget.owner))) return status;");
		item.parameters.forEach((type, index) => lines.push(`  lean_object *a${index} = ${walker(type)}_decode(&frame->args[${index}]);`));
		if(nominalRefinements.length) item.parameters.forEach((_, index) => lines.push(
			`  if (!lean_is_array(a${index}) || lean_array_size(a${index}) != 1) { ${cleanup} bridge_recursive_frame_clear(frame); frame->status = 5; return 5; }`));
		// Validate bounds across every argument before any parameter's constructor validator.
		if(nominal) item.parameters.forEach((_, index) => {
			const details = diagnostic("fin", index);
			lines.push(`  lean_inc(a${index});`, details
				? [`  if (!${item.symbol}_fin_guard_${index}(a${index})) {`
					, ...details, "  }"].join("\n")
				: `  if (!${item.symbol}_fin_guard_${index}(a${index})) { ${cleanup} bridge_recursive_frame_clear(frame); frame->status = 5; return 5; }`);
		});
		for(const [index, refinement] of refinements.entries()) if(refinement && (nominalRefinements.length || refinement.kind !== "fin"))
		{
			const details = diagnostic("constructor", index);
			lines.push(`  lean_inc(a${index});`, details
				? [`  if (!${item.symbol}_refinement_${index}(a${index})) {`
					, ...details, "  }"].join("\n")
				: `  if (!${item.symbol}_refinement_${index}(a${index})) { ${cleanup} bridge_recursive_frame_clear(frame); frame->status = 5; return 5; }`);
		}
		lines.push(`  lean_object *result = ${item.symbol}_lean(${item.parameters.length ? item.parameters.map((_, index) => `a${index}`).join(", ") : "lean_box(0)"});`
			, `  status = ${walker(item.result)}_encode(&frame->result, result, 0, &budget);`
			, "  if (status) bridge_recursive_frame_clear(frame);", "  return status;", "}", "");
	}
	return lines.join("\n");
};
