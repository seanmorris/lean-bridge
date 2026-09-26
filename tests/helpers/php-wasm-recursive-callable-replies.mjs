/**
 * Check callback reply owners after the Zend trampoline returns, before Lean
 * reads the borrowed payload. The mutant never decodes released storage.
 *
 * @file
 */
import assert from "node:assert/strict";
import { compileCallablePhpGraphZendModel } from "../../src/backends/php/callable-graph-zend-model.mjs";

/**
 * Instrument an isolated adapter, leaving packaged production bytes unchanged.
 *
 * @param ir - Original recursive callable signatures.
 * @param source - Generated Zend extension with its real call scopes.
 */
export const phpWasmRecursiveReplyProbe = (ir, source) => {
	const model = compileCallablePhpGraphZendModel(ir);
	const support = `
static bool probe_replies_enabled;
static unsigned probe_reply_checks, probe_reply_failures;
static void probe_reply_stats(zval *output) {
  add_assoc_long(output, "replyChecks", probe_reply_checks);
  add_assoc_long(output, "replyFailures", probe_reply_failures);
}
static int probe_zval_owns(zval *value, const void *data, size_t bytes, unsigned depth) {
  if (depth > 256) return 0;
  ZVAL_DEREF(value);
  if (Z_TYPE_P(value) == IS_STRING) {
    uintptr_t start = (uintptr_t)Z_STRVAL_P(value), at = (uintptr_t)data;
    return at >= start && at - start <= Z_STRLEN_P(value) && bytes <= Z_STRLEN_P(value) - (at - start);
  }
  if (Z_TYPE_P(value) == IS_ARRAY) {
    zval *child;
    ZEND_HASH_FOREACH_VAL(Z_ARRVAL_P(value), child) {
      if (probe_zval_owns(child, data, bytes, depth + 1)) return 1;
    } ZEND_HASH_FOREACH_END();
  }
  return 0;
}
static int probe_buffer_owned(lgc_call *call, const void *data, size_t count, size_t width) {
  if (!count) return 1;
  if (!data || !width || count > SIZE_MAX / width) return 0;
  // These sizes and pointers were produced by the successful lg_to walk. Only
  // ownership is mutated here. Check the allocation root before reading it.
  for (lb_block *block = call->walk.scope.blocks; block; block = block->next)
    if (block->data == data) return 1;
  for (lgc_reply *reply = call->replies; reply; reply = reply->next) {
    if (probe_zval_owns(&reply->value, data, count * width, 0)) return 1;
    for (unsigned index = 0; index < 16; ++index)
      if (probe_zval_owns(&reply->arguments[index], data, count * width, 0)) return 1;
  }
  return 0;
}
static int probe_reply_owned(lgc_call *call, unsigned type, const void *input, unsigned depth) {
  if (depth > 128) return 0;
  const lg_node *node = &lg_nodes[type]; const unsigned char *at = input;
  if (node->kind == LG_SCALAR) {
    switch (type) {
${model.types.filter(node => node.kind === "primitive" && node.aggregate).map(node => `      case ${node.index}: {
        const ${node.name} *scalar = input;
        return probe_buffer_owned(call, scalar->data, scalar->length, sizeof(*scalar->data));
      }`).join("\n")}
      default: return 1;
    }
  }
  if (node->kind == LG_SEQUENCE) {
    const lg_node *child = &lg_nodes[node->element]; size_t count; const unsigned char *data;
    memcpy(&count, at + node->length_offset, sizeof(count)); memcpy(&data, at + node->data_offset, sizeof(data));
    if (!probe_buffer_owned(call, data, count, child->size)) return 0;
    for (size_t index = 0; index < count; ++index)
      if (!probe_reply_owned(call, node->element, data + index * child->size, depth + 1)) return 0;
    return 1;
  }
  unsigned branch = 0;
  if (node->kind == LG_VARIANT) { uint32_t tag; memcpy(&tag, at + node->tag_offset, sizeof(tag)); branch = tag; }
  else if (node->kind == LG_OPTION || node->kind == LG_RESULT) branch = at[node->tag_offset];
  if (branch >= node->branch_count) return 0;
  const lg_branch *fields = &node->branches[branch];
  for (size_t index = 0; index < fields->count; ++index) {
    const lg_field *field = &fields->fields[index]; const void *child = at + field->offset;
    if (field->pointer) {
      memcpy(&child, at + field->offset, sizeof(child));
      if (!probe_buffer_owned(call, child, 1, lg_nodes[field->type].size)) return 0;
    }
    if (!probe_reply_owned(call, field->type, child, depth + 1)) return 0;
  }
  return 1;
}
ZEND_BEGIN_ARG_INFO_EX(probe_reply_args, 0, 0, 1)
  ZEND_ARG_INFO(0, enabled)
ZEND_END_ARG_INFO()
static ZEND_FUNCTION(recursive_probe_reply_ownership) {
  bool enabled;
  ZEND_PARSE_PARAMETERS_START(1, 1) Z_PARAM_BOOL(enabled) ZEND_PARSE_PARAMETERS_END();
  probe_replies_enabled = enabled; RETURN_NULL();
}
`;
	const boundary = "static int lgc_owned_type;";
	assert.equal(source.split(boundary).length, 2);
	source = source.replace(boundary, boundary + "\n" + support);
	for(const cb of model.callbacks.values())
	{
		const original = `static uint32_t lgc_callback${cb.index}(`;
		assert.equal(source.split(original).length, 2);
		source = source.replace(original, `static uint32_t probe_original_callback${cb.index}(`);
		const marker = `ZEND_BEGIN_ARG_INFO_EX(lgc_close_args${cb.index},`;
		assert.equal(source.split(marker).length, 2);
		source = source.replace(marker, `static uint32_t lgc_callback${cb.index}(void *context, ${[...cb.parameters.map((node, index) => `const ${node.name} *arg${index}`), `${cb.result.name} *output`].join(", ")}) {
  uint32_t status = probe_original_callback${cb.index}(context, ${[...cb.parameters.map((_, index) => `arg${index}`), "output"].join(", ")});
  if (status || !probe_replies_enabled) return status;
  lgc_borrow *borrow = lgc_lookup(context, ${cb.index});
  if (!borrow) return 6;
  lgc_call *call = borrow->call;
#ifdef PROBE_RELEASE_REPLY
  lgc_clear_zval(call, &call->replies->value);
#endif
  ++probe_reply_checks;
  if (!probe_reply_owned(call, ${cb.result.index}, output, 0)) {
    ++probe_reply_failures;
    lb_fail(&call->walk.scope, "callback_reply_storage_expired", 0); return 6;
  }
  return 0;
}
` + marker);
	}
	return { source, declarations: "static void probe_reply_stats(zval *output);\n"
		, statistics: "  probe_reply_stats(return_value);\n"
		, registration: "  ZEND_FE(recursive_probe_reply_ownership, probe_reply_args)\n" };
};
