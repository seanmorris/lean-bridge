/* This broker is linked once, not into each component. Its cache is a weak
   index of actual Lean external objects. The last Lean reference removes a
   weak entry synchronously. Admission of a public strong result is explicit. */
#include "host-wasm-domain.h"
#include <emscripten.h>
#include <stdlib.h>
#if !defined(__wasm32__) || !defined(__EMSCRIPTEN__) || defined(__EMSCRIPTEN_PTHREADS__)
#error JavaScript host identity requires its owning wasm32 agent
#endif
#define LB_DOMAIN_EXPORT __attribute__((visibility("default")))
EM_JS(int, lb_jsh_attach_js, (unsigned kind,unsigned token,unsigned anchor,int fresh), {
    try { Module["lbJshDomainV1"].attach(kind>>>0,token>>>0,anchor>>>0,fresh); return 1; } catch (_) { return 0; }
});
EM_JS(void, lb_jsh_detach_js, (unsigned kind,unsigned token), {
    Module["lbJshDomainV1"].detach(kind>>>0,token>>>0);
});
EM_JS(int, lb_jsh_strong_js, (unsigned kind,unsigned token), {
    return Module["lbJshDomainV1"].strong(kind>>>0,token>>>0) ? 1 : 0;
});
EM_JS(void, lb_jsh_discard_js, (unsigned key), { Module["lbJshDomainV1"].discard(key>>>0); });
static lb_jsh_error_domain errors={NULL,lb_jsh_discard_js};
LB_DOMAIN_EXPORT void lb_jsh_domain_enter_v1(lb_jsh_error_scope *scope) { lb_jsh_errors_enter(&errors,scope); }
LB_DOMAIN_EXPORT uint32_t lb_jsh_domain_leave_v1(lb_jsh_error_scope *scope,b_lean_obj_arg escaped) {
    return lb_jsh_errors_leave(&errors,scope,escaped);
}
LB_DOMAIN_EXPORT lean_obj_res lb_jsh_domain_error_v1(uint32_t status,uint32_t key) {
    lean_object *e=lean_mk_io_user_error(lean_mk_string(status==1?"JavaScript host exception":"JavaScript host contract failure"));
    if (!lb_jsh_errors_remember(&errors,e,key)) { if (key) lb_jsh_discard_js(key); __builtin_trap(); }
    return e;
}
typedef struct lb_jsh_handle {
    struct lb_jsh_handle *next, **prev;
    lean_object *wrapper; /* weak unless explicitly admitted */
    uint32_t kind, token;
    int held;
} lb_jsh_handle;
static lean_external_class *handle_class;
static lb_jsh_handle *buckets[1024];
static int retiring;
static void unlink_handle(lb_jsh_handle *h) {
    *h->prev=h->next; if (h->next) h->next->prev=h->prev;
    uint32_t kind=h->kind; h->kind=0; h->next=NULL; h->prev=NULL;
    lb_jsh_detach_js(kind,h->token);
}
static void finalize(void *p) {
    lb_jsh_handle *h=p;
    if (h->kind) unlink_handle(h);
    free(h);
}
static void foreach_ref(void *p,b_lean_obj_arg f) { (void)p; (void)f; }
static lb_jsh_handle *handle(b_lean_obj_arg o) {
    if (!o || !handle_class || lean_is_scalar(o) || !lean_is_external(o) || lean_get_external_class(o)!=handle_class) return NULL;
    lb_jsh_handle *h=lean_get_external_data(o);
    return h->kind && h->wrapper==o ? h : NULL;
}
LB_DOMAIN_EXPORT uint32_t lb_jsh_domain_token_v1(uint32_t kind,b_lean_obj_arg o) {
    lb_jsh_handle *h=handle(o);
    return !retiring && h && h->kind==kind ? h->token : 0;
}
LB_DOMAIN_EXPORT lean_obj_res lb_jsh_domain_wrap_v1(uint32_t kind,uint32_t token,b_lean_obj_arg owner) {
    lb_jsh_handle *anchor=owner ? handle(owner) : NULL;
    if (retiring || !kind || !token || (owner && !anchor)) return NULL;
    lb_jsh_handle **bin=&buckets[token%1024u];
    for (lb_jsh_handle *h=*bin;h;h=h->next) if (h->token==token) {
        if (h->kind!=kind || !lb_jsh_attach_js(kind,token,anchor?anchor->token:0,0)) return NULL;
        lean_inc(h->wrapper); return h->wrapper;
    }
    lb_jsh_handle *h=calloc(1,sizeof(*h)); if (!h) return NULL;
    if (!lb_jsh_attach_js(kind,token,anchor?anchor->token:0,1)) { free(h); return NULL; }
    if (!handle_class) handle_class=lean_register_external_class(finalize,foreach_ref);
    h->wrapper=lean_alloc_external(handle_class,h); h->kind=kind; h->token=token;
    h->next=*bin; h->prev=bin; if (*bin) (*bin)->prev=&h->next; *bin=h;
    return h->wrapper;
}
LB_DOMAIN_EXPORT int lb_jsh_domain_admit_v1(uint32_t kind,b_lean_obj_arg o) {
    lb_jsh_handle *h=handle(o);
    if (retiring || !h || h->kind!=kind) return 0;
    if (!h->held && lb_jsh_strong_js(kind,h->token)) { lean_inc(o); h->held=1; }
    return 1;
}
static int retire_kind(uint32_t kind) {
    if (!kind || retiring) return 0;
    retiring=1;
    for (unsigned i=0;i<1024;i++) for (lb_jsh_handle *h=buckets[i],*next;h;h=next) {
        next=h->next;
        if (h->kind!=kind) continue;
        unlink_handle(h);
        if (h->held) { h->held=0; lean_dec(h->wrapper); }
    }
    retiring=0; return 1;
}
LB_DOMAIN_EXPORT uint32_t lb_jsh_domain_control_v1(uint32_t *f) {
    uintptr_t base=(uintptr_t)f;
    if (!base || base%8 || base+UINT64_C(32)>(uint64_t)__builtin_wasm_memory_size(0)*65536u
        || f[0]!=0x4a484431u || f[1]!=32 || f[2] || f[3]!=1 || f[5] || f[6] || f[7]) return 3;
    return retire_kind(f[4]) ? 0 : 3;
}
