/* Isolated fault injection after a real host callback returns to the generated
   C trampoline. This file is never included in a published package. */
#include "component_scalar.h"

static uint32_t structured_test_corrupt_reply, structured_test_dispatch_count;

LEAN_EXPORT uint32_t structured_test_reply(bridge_scalar_frame *frame) {
  structured_test_corrupt_reply = (uint32_t)frame->args[0].bits;
  structured_test_dispatch_count = 0;
  return 0;
}

LEAN_EXPORT uint32_t structured_test_dispatches(bridge_scalar_frame *frame) {
  (void)frame;
  return structured_test_dispatch_count;
}

static uint32_t structured_test_dispatch(uint32_t token, char const *key, bridge_scalar_frame *frame) {
  ++structured_test_dispatch_count;
  uint32_t status = bridge_callable_dispatch(token, key, frame);
  if (!status && !frame->status && structured_test_corrupt_reply) {
    frame->result.kind = UINT32_MAX;
  }
  return status;
}

#define bridge_callable_dispatch structured_test_dispatch
