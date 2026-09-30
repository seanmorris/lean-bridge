/**
 * Authenticate public input owners and invalidate them at the native move point.
 * Copied storage survives callback reentry until the enclosing call finishes.
 *
 * @file
 */

/**
 * Emit a bounded, allocation-free transfer plan for generated C calls.
 *
 * @param values - Checked public C layout with transferred-input capability.
 */
export const ownedCInputTransfers = values => {
	const p = values.prefix;
	const resultKind = JSON.stringify(`owned-c-result:${values.native.model.component.id}`);
	return `
typedef struct {
  ${p}_result **slot;
  oc_result *result;
} oc_transfer_input;
typedef struct {
  oc_transfer_input *inputs;
  size_t count;
  int consumed;
} oc_transfer_frame;

static inline int oc_transfer_prepare(oc_session *session, oc_transfer_frame *frame,
    ov_result_owner **owners, void *out, size_t bytes, size_t alignment,
    ${p}_result **output_owner) {
  for (size_t i = 0; i < frame->count; ++i) {
    ${p}_result **slot = frame->inputs[i].slot;
    if (!oc_outputs(out, bytes, alignment, slot) ||
        !oc_outputs(slot, sizeof(*slot), _Alignof(${p}_result *), output_owner) ||
        !*slot) return LB_OWNED_INVALID;
    oc_result *result = oc_results;
    while (result && result->key != (uint64_t)(uintptr_t)*slot) result = result->next;
    if (!result || result->session != session) return LB_OWNED_INVALID;
    for (size_t j = 0; j < i; ++j)
      if (frame->inputs[j].result == result) return LB_OWNED_INVALID;
    frame->inputs[i].result = result;
    owners[i] = &result->native;
  }
  return LB_OWNED_OK;
}

/* Native conversion has validated every value and moved every input batch.
   This hook cannot allocate, call user code, or fail partway through the set. */
static inline void oc_transfer_consume(void *context) {
  oc_transfer_frame *frame = context;
  for (size_t i = 0; i < frame->count; ++i) {
    oc_result *result = frame->inputs[i].result;
    oc_result **position = &oc_results;
    while (*position != result) position = &(*position)->next;
    *position = result->next;
    --result->session->results;
    *frame->inputs[i].slot = NULL;
  }
  frame->consumed = 1;
}

static inline int oc_transfer_finish(oc_transfer_frame *frame, int status) {
  if (!frame->consumed) return status;
  for (size_t i = 0; i < frame->count; ++i) {
    oc_result *result = frame->inputs[i].result;
    int cleanup = ov_owner_clear(&result->native);
    if (!status) status = cleanup;
${values.anchoredResults ? "    cleanup = oc_views_clear(&result->views); if (!status) status = cleanup;\n" : ""}\
    if (lean_bridge_native_identity_release(result->key, ${resultKind}, result) < 0 && !status)
      status = LB_OWNED_RUNTIME;
    oc_release(result->blocks); LB_OWNED_FREE(result);
  }
  return status;
}
`;
};
