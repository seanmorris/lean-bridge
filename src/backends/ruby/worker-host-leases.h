/* Private to the generated MRI extension. The worker owns only a Lean external
   object. Ruby values, ledger access, and GC roots stay on MRI's owner. */
#include "task-resource-ledger.h"
#include <string.h>

static unsigned lb_worker_kind(VALUE index) {
    if (!FIXNUM_P(index) || FIX2LONG(index)<0 ||
        (unsigned long)FIX2LONG(index)>=sizeof(worker_keys)/sizeof(*worker_keys))
        rb_raise(rb_eTypeError,"unknown Ruby worker kind");
    return (unsigned)FIX2LONG(index);
}
static void lb_worker_token(VALUE str,uint64_t h[2]) {
    if (!RB_TYPE_P(str,T_STRING) || RSTRING_LEN(str)!=2*sizeof(uint64_t))
        rb_raise(rb_eTypeError,"invalid Ruby worker lease");
    memcpy(h,RSTRING_PTR(str),2*sizeof(uint64_t));
}
static VALUE lb_worker_pin_frame(VALUE data) {
    lb_call *a=(lb_call *)data; unsigned i=lb_worker_kind(a->args[0]);
    uint64_t h[2]={0}; VALUE token=rb_str_new(NULL,sizeof(h));
    a->values[0]=lb_rh_wrap(session,i,a->args[1],Qnil);
    lean_mark_mt(a->values[0]);
    int rc=LB_LEASE(create)(worker_keys[i],a->values[0],h);
    if (rc==LB_LEASE_MEMORY) rb_memerror();
    if (rc!=LB_LEASE_OK) rb_raise(rb_eRuntimeError,"Ruby worker lease unavailable");
    memcpy(RSTRING_PTR(token),h,sizeof(h)); return token;
}
static VALUE lb_worker_value_frame(VALUE data) {
    lb_call *a=(lb_call *)data; unsigned i=lb_worker_kind(a->args[0]); uint64_t h[2];
    lb_worker_token(a->args[1],h);
    lean_object *v=LB_LEASE(borrow)(worker_keys[i],h);
    /* Check the current session's live nominal row, not just the token. */
    VALUE object=lb_rh_object(session,i,v);
    if (RTEST(a->args[2])) lb_rh_admit(v);
    return object;
}
static VALUE lb_worker_pin(VALUE mod,VALUE i,VALUE obj) {
    (void)mod; VALUE args[]={i,obj}; return lb_invoke(lb_worker_pin_frame,args);
}
static VALUE lb_worker_yield(VALUE data) { (void)data; return rb_yield_values(0); }
static VALUE lb_worker_call(VALUE mod) { (void)mod; return lb_invoke(lb_worker_yield,NULL); }
static VALUE lb_worker_collect(VALUE mod) { (void)mod; lb_worker_sweep(); return Qnil; }
static VALUE lb_worker_resolve(VALUE mod,VALUE i,VALUE h) {
    (void)mod; VALUE args[]={i,h,Qfalse}; return lb_invoke(lb_worker_value_frame,args);
}
static VALUE lb_worker_admit(VALUE mod,VALUE i,VALUE h) {
    (void)mod; VALUE args[]={i,h,Qtrue}; return lb_invoke(lb_worker_value_frame,args);
}
static VALUE lb_worker_drop(VALUE mod,VALUE index,VALUE token) {
    (void)mod; lb_rh_owner(); unsigned i=lb_worker_kind(index); uint64_t h[2];
    lb_worker_token(token,h);
    if (session) (void)lb_rh_type(session,i);
    /* Cleanup also runs after retirement; do not require an available component. */
    int rc=LB_LEASE(release)(worker_keys[i],h);
    lb_worker_sweep();
    return rc==LB_LEASE_OK ? Qtrue : Qfalse;
}
static void lb_rh_worker_methods(VALUE mod) {
    rb_define_singleton_method(mod,"__worker_collect",lb_worker_collect,0);
    rb_define_singleton_method(mod,"__worker_call",lb_worker_call,0);
    rb_define_singleton_method(mod,"__worker_pin",lb_worker_pin,2);
    rb_define_singleton_method(mod,"__worker_resolve",lb_worker_resolve,2);
    rb_define_singleton_method(mod,"__worker_admit",lb_worker_admit,2);
    rb_define_singleton_method(mod,"__worker_drop",lb_worker_drop,2);
}
