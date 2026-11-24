/* The entry point and saved test reference are component-local. The checked
   externs, host services, error frames and canonical cache are production code.
   The address is returned ONLY to the test and compared, never dereferenced. */
#include "host.c"
#include "members.inc"
#include "service.inc"
extern lean_object *PROBE_INIT(uint8_t);
extern lean_object *PROBE_BOX(lean_object *,uint32_t);
extern lean_object *PROBE_STRONG(lean_object *);
static lean_object *saved;
static int initialized;
__attribute__((visibility("default"))) uint32_t PROBE_CONTROL(uint32_t *f) {
    if (!initialized) {
        lean_object *r=PROBE_INIT(1); int ok=lean_io_result_is_ok(r); lean_dec(r);
        if (!ok) return 4;
        initialized=1;
    }
    uint32_t op=f[3], k=f[4], kind=PROBE_KIND(k);
    if (op==3) { f[8]=lb_jsh_domain_token_v1(kind,saved); return 0; }
    if (op==4) { if (saved) { lean_dec(saved); saved=NULL; } return 0; }
    if ((op!=1 && op!=2 && op!=6) || k>1) return 3;
    lean_object *o=lb_jsh_domain_wrap_v1(kind,f[5],NULL);
    if (!o) return 3;
    lb_jsh_error_scope scope; lb_jsh_domain_enter_v1(&scope);
    lean_inc(o);
    lean_object *r=k ? PROBE_STRONG(o) : PROBE_BOX(o,f[7]);
    int ok=lean_io_result_is_ok(r);
    if (ok) {
        lean_object *out=lean_io_result_get_value(r);
        f[8]=lb_jsh_domain_token_v1(kind,out); f[9]=(uintptr_t)out;
        f[10]=out==o && (!f[6] || (uintptr_t)out==f[6]);
        ok=op==6 || lb_jsh_domain_admit_v1(kind,out);
        if (op==2 && ok) {
            lean_inc(out); if (saved) lean_dec(saved); saved=out;
        }
    }
    f[11]=lb_jsh_domain_leave_v1(&scope,lean_io_result_is_error(r)?lean_io_result_get_error(r):NULL);
    lean_dec(r); lean_dec(o); return ok ? 0 : 2;
}
