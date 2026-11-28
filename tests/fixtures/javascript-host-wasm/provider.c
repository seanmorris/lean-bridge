/* Independent, deliberately Meter-specific ABI oracle. Include real generated C
   so a change in an extern or entry signature is a compile error. */
#include "host.c"
#include "entry.h"
#include <emscripten.h>

static lean_external_class *meter_class;
EM_JS(int, meter_member, (unsigned slot, unsigned self, unsigned value, unsigned *out), {
    return Module["lbMeterOracle"].call(slot, self, value, out);
});
EM_JS(void, meter_release, (unsigned token), { Module["lbMeterOracle"].release(token); });

static void drop_meter(void *p) { meter_release((uintptr_t)p); }
static void visit_meter(void *p, b_lean_obj_arg f) { (void)p; (void)f; }
static uint32_t token(b_lean_obj_arg x) {
    return !lean_is_scalar(x) && lean_is_external(x) && lean_get_external_class(x) == meter_class
        ? (uintptr_t)lean_get_external_data(x) : 0;
}
static lean_obj_res invoke(unsigned slot, unsigned self, unsigned value, unsigned kind) {
    unsigned answer = 0;
    if (meter_member(slot, self, value, &answer))
        return lean_io_result_mk_error(lean_mk_io_user_error(lean_mk_string("JavaScript member failed")));
    lean_object *result = kind == 2 ? lean_alloc_external(meter_class, (void *)(uintptr_t)answer)
        : kind == 1 ? lean_box_uint32(answer) : lean_box(0);
    return lean_io_result_mk_ok(result);
}
lean_obj_res lean_bridge_host_javascript_box_create(uint32_t n) { return invoke(METER_CREATE, 0, n, 2); }
lean_obj_res lean_bridge_host_javascript_box_read(b_lean_obj_arg x) { return invoke(METER_READ, token(x), 0, 1); }
lean_obj_res lean_bridge_host_javascript_box_identity(b_lean_obj_arg x) { return invoke(METER_IDENTITY, token(x), 0, 2); }
lean_obj_res lean_bridge_host_javascript_box_get_level(b_lean_obj_arg x) { return invoke(METER_GET, token(x), 0, 1); }
lean_obj_res lean_bridge_host_javascript_box_set_level(b_lean_obj_arg x, uint32_t n) { return invoke(METER_SET, token(x), n, 0); }

__attribute__((visibility("default"))) uint32_t lb_meter_control(uint32_t *frame) {
    if (!meter_class) {
        lean_object *init = initialize_HostProbe(1);
        int ok = lean_io_result_is_ok(init);
        lean_dec(init);
        if (!ok) return 1;
        meter_class = lean_register_external_class(drop_meter, visit_meter);
    }
    lean_object *result = lb_meter_probe(frame[3]);
    int ok = lean_io_result_is_ok(result);
    if (ok) frame[4] = lean_unbox_uint32(lean_io_result_get_value(result));
    lean_dec(result);
    return ok ? 0 : 2;
}
