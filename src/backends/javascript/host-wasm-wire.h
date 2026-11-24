/* Private wasm32 host-member glue. All inputs are borrowed until return.
   Copied scalars use the shared heap's scalar ABI; nominal IDs are never
   JS addresses or Lean pointers. Hooks are private to this component. */
#include "component_scalar.h"
#include <stdlib.h>
#if !defined(__wasm32__) || !defined(__EMSCRIPTEN__) || (defined(__EMSCRIPTEN_PTHREADS__) && !defined(LB_JST_OWNER_WIRE))
#error Synchronous JavaScript host imports require their owning wasm32 agent
#endif
_Static_assert(sizeof(bridge_scalar_slot) == 16, "incompatible scalar slot");
extern uint32_t lb_host_token(uint32_t kind, b_lean_obj_arg value);
/* Wrap takes its own pin; the transient reply pin belongs to finish. */
extern lean_obj_res lb_host_wrap(uint32_t kind, uint32_t token, b_lean_obj_arg anchor);
extern uint32_t lb_host_send(uint32_t slot, uint32_t count, const bridge_scalar_slot *args, bridge_scalar_slot *reply);
extern void lb_host_finish(bridge_scalar_slot *reply);
/* Return an owned IO.Error. Only status 1 is an application exception. */
extern lean_obj_res lb_host_error(uint32_t status, const bridge_scalar_slot *reply);

static lean_obj_res lb_host_invoke(uint32_t slot, unsigned n, const uint8_t *tags,
    unsigned output, int anchor, lean_object **values) {
#ifdef __EMSCRIPTEN_PTHREADS__
    if (!emscripten_is_main_runtime_thread()) __builtin_trap();
#endif
    bridge_scalar_slot args[64] = {0}, reply = {0};
    void *owned[64] = {0};
    uint32_t budget = 16u * 1024u * 1024u, status = 0;
    lean_object *answer = NULL;
    unsigned called = 0;
    for (unsigned i = 0; i < n && !status; ++i) {
        if (tags[i] >= 64) {
            uint32_t token = lb_host_token(tags[i] - 64, values[i]);
            if (!token) status = 3;
            args[i].kind = tags[i]; args[i].bits = token;
        } else {
            lean_inc(values[i]); /* The shared encoder consumes this reference. */
            status = bridge_copied_encode(&args[i], tags[i], 0, values[i], &budget);
            if (!status && (args[i].flags & 2)) owned[i] = (void *)(uintptr_t)(uint32_t)args[i].bits;
        }
    }
    if (!status) {
        called = 1;
        status = lb_host_send(slot, n, args, &reply);
    }
    if (!status && output >= 64) {
        if (reply.kind != output || reply.flags || !reply.bits || reply.bits > UINT32_MAX) status = 3;
        else {
            answer = lb_host_wrap(output - 64, (uint32_t)reply.bits, anchor < 0 ? NULL : values[anchor]);
            if (!answer) status = 3;
        }
    } else if (!status) {
        status = bridge_copied_validate(&reply, output, 0, &budget);
        if (!status) answer = bridge_copied_decode(&reply, output, 0);
    }
    lean_object *io = status ? lean_io_result_mk_error(lb_host_error(status, called ? &reply : NULL))
        : lean_io_result_mk_ok(answer);
    if (called) lb_host_finish(&reply);
    /* Never free an address read back from the JS-writable frame. */
    for (unsigned i = 0; i < n; ++i) free(owned[i]);
    return io;
}
