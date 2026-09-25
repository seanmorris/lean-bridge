/**
 * Check borrowed reply storage before decoding and model premature scope release.
 *
 * @file
 */
import assert from "node:assert/strict";

export const ownershipShapes = ["array", "list", "option", "result", "tuple", "record", "variant", "alias", "recursive"];

/**
 * Check indirect reply addresses against live scope owners before reading them.
 *
 * @param model - Exact production converters and callable graph.
 */
export const ownershipProbe = model => {
	const nodes = new Map(model.types.map(node => [node.id, node]));
	const declarations = [`static int probe_reply_owned(lpg_scope *scope, const void *address) {
  for (lpg_allocation *item = scope->allocations; item; item = item->next)
    if (address == item->data) return 1;
  return 0;
}`];
	for(const node of model.types) declarations.push(`static int probe_reply${node.index}(const ${node.name} *, lpg_scope *, size_t);`);
	for(const node of model.types)
	{
		const fieldCheck = (field, member) => {
			const child = nodes.get(field.type);
			const pointer = field.storage === "pointer";
			return `${pointer ? `if (!probe_reply_owned(scope, ${member})) return 0; ` : ""}if (!probe_reply${child.index}(${pointer ? "" : "&"}${member}, scope, depth + 1)) return 0;`;
		};
		const lines = [];
		if(node.kind === "primitive")
		{
			if(["nat", "int", "string", "bytes"].includes(node.ref.name)) lines.push("if (value->length && !probe_reply_owned(scope, value->data)) return 0;");
		}
		else if(node.element)
		{
			const child = nodes.get(node.element);
			lines.push("if (value->length && !probe_reply_owned(scope, value->data)) return 0;"
				, `for (size_t i = 0; i < value->length; ++i) if (!probe_reply${child.index}(&value->data[i], scope, depth + 1)) return 0;`);
		}
		else if(node.kind === "variant")
			lines.push("switch (value->kind) {", ...node.cases.map(branch => `case ${branch.tag}: ${branch.fields.map(field => fieldCheck(field, `value->cases.${branch.name}.${field.name}`)).join(" ")} break;`), "default: return 0;", "}");
		else if(node.kind === "option")
			lines.push(`if (value->has_value) { ${fieldCheck(node.fields[0], `value->${node.fields[0].name}`)} }`);
		else if(node.kind === "result")
			lines.push(`if (value->is_ok) { ${fieldCheck(node.fields[0], `value->${node.fields[0].name}`)} } else { ${fieldCheck(node.fields[1], `value->${node.fields[1].name}`)} }`);
		else lines.push(...node.fields.map(field => fieldCheck(field, `value->${field.name}`)));
		declarations.push(`static int probe_reply${node.index}(const ${node.name} *value, lpg_scope *scope, size_t depth) {
  (void)value; (void)scope;
  if (depth > 128) return 0;
  ${lines.join("\n  ")}
  return 1;
}`);
	}
	for(const shape of ownershipShapes)
	{
		const fn = model.functions.find(fn => fn.publicName === `call_${shape}`);
		const node = fn.parameters[0].node, callback = fn.parameters[1].callback;
		assert.equal(callback.parameters.length, 1);
		assert.equal(callback.parameters[0].id, node.id);
		assert.equal(callback.result.id, node.id);
		declarations.push(`static SV *probe_ownership_${shape}(pTHX_ SV *value, SV *code) {
  ENTER;
  lpg_scope *input_scope = lpg_begin(aTHX_ lpg_retire);
  lpg_scope *output_scope = lpg_begin(aTHX_ lpg_retire);
  lpg_scope *reply_scope = lpg_begin(aTHX_ lpg_retire);
  lpc_frame *frame = lpc_begin(aTHX_ reply_scope);
  ${node.name} input = {0}, output = {0};
  lpg_read${node.index}(aTHX_ input_scope, value, &input, 0, 1);
  lpc_callback *callback = lpc_callback_new(aTHX_ frame, code, ${callback.index}, "LeanBridge::Recursive::_callback_${callback.key}");
  uint32_t status = lpc_callback_${callback.index}(callback, &input, &output);
  lpc_finish(aTHX_ frame, status);
  /* Never pass a potentially dangling result to a decoder. */
  if (!probe_reply${node.index}(&output, reply_scope, 0)) croak("Callback owners released before native copying: ${shape}");
  SV *result = lpg_write${node.index}(aTHX_ output_scope, &output, 0, 1);
  LEAVE;
  return result;
}`);
	}
	return { source: declarations.join("\n")
		, xs: `
MODULE = LeanBridge::Recursive PACKAGE = LeanBridge::Recursive

void
ownership(shape, value, code)
    const char *shape
    SV *value
    SV *code
  PPCODE:
    SV *result = NULL;
    ${ownershipShapes.map((shape, index) => `${index ? "else " : ""}if (strEQ(shape, "${shape}")) result = probe_ownership_${shape}(aTHX_ value, code);`).join("\n    ")}
    else croak("Unknown ownership shape");
    SPAGAIN; SP -= items; EXTEND(SP, 1); XPUSHs(result);
`};
};

/**
 * Recreate premature reply release at the inner evaluation boundary.
 *
 * @param model - Exact production converters and callable graph.
 */
export const releaseRepliesEarly = model => {
	let xs = model.xs;
	for(const callback of model.callbacks.values())
	{
		const before = `lpg_read${callback.result.index}(aTHX_ scope, returned, invocation->output, 0, 1);`;
		assert.equal(xs.split(before).length > 1, true);
		xs = xs.replace(before, `lpg_scope *premature_reply_scope = lpg_begin(aTHX_ lpg_retire);
    lpg_read${callback.result.index}(aTHX_ premature_reply_scope, returned, invocation->output, 0, 1);`);
	}
	assert.equal((xs.match(/lpg_scope \*premature_reply_scope/g) ?? []).length, model.callbacks.size);
	return xs;
};
