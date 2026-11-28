/* Test domain and control entry ONLY. The member functions and all scalar
   marshaling are generated production code, not implemented by this fixture. */
#include "host.c"
#include "members.inc"
#include "host-wasm-errors.h"
#include <emscripten.h>
extern lean_object *initialize_GeneratedProbe(uint8_t);
extern lean_object *lb_js_generated_probe(uint32_t);
EM_JS(uint32_t, js_send, (unsigned s,unsigned n,const void *args,void *out), {
    return Module.lbHostWire.call(s,n,args,out);
});
EM_JS(void, js_finish, (void *out), { Module.lbHostWire.finish(out); });
EM_JS(void, js_retain, (unsigned token,unsigned anchor), { Module.lbHostDomain.retain(token,anchor); });
EM_JS(void, js_release, (unsigned token), { Module.lbHostDomain.release(token); });
EM_JS(unsigned, js_record, (unsigned status,const void *out), { return Module.lbHostDomain.record(status,out); });
EM_JS(void, js_discard, (unsigned key), { Module.lbHostDomain.discard(key); });
static lb_jsh_error_domain errors={NULL,js_discard};
static lean_external_class *test_tag;
static void drop(void *p) { js_release((uintptr_t)p); }
static void visit(void *p,b_lean_obj_arg f) { (void)p; (void)f; }
uint32_t lb_host_token(uint32_t k,b_lean_obj_arg o) {
    return !k && !lean_is_scalar(o) && lean_is_external(o) && lean_get_external_class(o)==test_tag
        ? (uintptr_t)lean_get_external_data(o) : 0;
}
lean_obj_res lb_host_wrap(uint32_t k,uint32_t token,b_lean_obj_arg anchor) {
    uint32_t parent=anchor ? lb_host_token(0,anchor) : 0;
    if (k || !token || (anchor && !parent)) return NULL;
    js_retain(token,parent);
    return lean_alloc_external(test_tag,(void *)(uintptr_t)token);
}
uint32_t lb_host_send(uint32_t s,uint32_t n,const bridge_scalar_slot *args,bridge_scalar_slot *out) {
    return js_send(s,n,args,out);
}
void lb_host_finish(bridge_scalar_slot *out) { js_finish(out); }
lean_obj_res lb_host_error(uint32_t s,const bridge_scalar_slot *out) {
    lean_object *e=lean_mk_io_user_error(lean_mk_string(s==1?"application throw":"host contract failure"));
    uint32_t key=js_record(s,out);
    if (!lb_jsh_errors_remember(&errors,e,key)) { js_discard(key); abort(); }
    return e;
}
__attribute__((visibility("default"))) uint32_t lb_js_generated_control(uint32_t *f) {
    if (!test_tag) {
        lean_object *r=initialize_GeneratedProbe(1); int ok=lean_io_result_is_ok(r); lean_dec(r);
        if (!ok) return 4;
        test_tag=lean_register_external_class(drop,visit);
    }
    lb_jsh_error_scope scope; lb_jsh_errors_enter(&errors,&scope);
    lean_object *r=lb_js_generated_probe(f[3]);
    int ok=lean_io_result_is_ok(r);
    if (ok) f[4]=lean_unbox_uint32(lean_io_result_get_value(r));
    f[5]=lb_jsh_errors_leave(&errors,&scope,ok ? NULL : lean_io_result_get_error(r));
    lean_dec(r); return ok ? 0 : 2;
}
