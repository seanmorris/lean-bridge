/* Compiled test ingress, not the installed CPAN component loader. */
#include "host-frame.h"
#include <pthread.h>
extern void lean_initialize_runtime_module(void);
extern lean_object *initialize_Init(uint8_t), *initialize_FrameCheck(uint8_t);
extern lean_object *lb_test_perl_through(uint32_t), *lb_test_perl_mapped(uint32_t);
extern lean_object *lb_test_perl_replace(uint32_t), *lb_test_perl_first(uint32_t);
extern lean_object *lb_test_perl_repeat(uint32_t);
static pid_t owner_pid;
static pthread_t owner_thread;
#ifdef MULTIPLICITY
static PerlInterpreter *owner_perl;
#endif
static lean_object *invoke(pTHX_ void *data) {
    dSP;
    PUSHMARK(SP); XPUSHs(sv_2mortal(newSVuv(*(uint32_t *)data))); PUTBACK;
    int n = call_sv(ph_active->binding, G_SCALAR);
    SPAGAIN;
    if (n != 1) croak("missing method reply");
    SV *v = POPs; PUTBACK;
    SvGETMAGIC(v);
    if (SvROK(v) || !SvIOK(v) || (!SvIsUV(v) && SvIV(v) < 0) || SvUV(v) > UINT32_MAX)
        croak("invalid UInt32 reply");
    return lean_box_uint32((uint32_t)SvUV(v));
}
lean_object *lean_bridge_host_perl_box_observe(uint32_t n) {
    return ph_call(invoke, &n);
}
static void drop_result(pTHX_ void *p) { PERL_UNUSED_CONTEXT; lean_dec((lean_object *)p); }
XS_EXTERNAL(ph_probe) {
    dXSARGS;
    if (items != 3 || !SvROK(ST(0)) || SvTYPE(SvRV(ST(0))) != SVt_PVCV) croak("wrong probe arguments");
    if (owner_pid && (owner_pid != getpid() || !pthread_equal(owner_thread, pthread_self())
#ifdef MULTIPLICITY
        || owner_perl != aTHX
#endif
        )) croak("foreign Perl owner");
    if (!owner_pid) {
        owner_pid=getpid(); owner_thread=pthread_self();
#ifdef MULTIPLICITY
        owner_perl=aTHX;
#endif
        lean_initialize_runtime_module();
        lean_object *r=initialize_Init(1); if (!lean_io_result_is_ok(r)) abort(); lean_dec(r);
        r=initialize_FrameCheck(1); if (!lean_io_result_is_ok(r)) abort(); lean_dec(r);
        lean_io_mark_end_initialization();
    }
    unsigned op=SvUV(ST(1)), n=SvUV(ST(2));
    ENTER; SAVETMPS;
    ph_frame *f=ph_enter(aTHX_ ST(0));
    SSGROW(4);
    lean_object *r=(op==0 ? lb_test_perl_through : op==1 ? lb_test_perl_mapped :
                    op==2 ? lb_test_perl_replace : op==3 ? lb_test_perl_first : lb_test_perl_repeat)(n);
    SAVEDESTRUCTOR_X(drop_result,r);
    if (f->failed) croak("Perl host frame unavailable");
    lean_object *v=lean_ctor_get(r,0);
    if (!lean_io_result_is_ok(r)) {
        SV *original=ph_original(f,v);
        if (original) croak_sv(original);
        croak("replacement Lean IO error");
    }
    SV *answer=op==1 && lean_obj_tag(v)==0 ? newSVpv(lean_string_cstr(lean_ctor_get(v,0)),0) :
        newSVuv(lean_unbox_uint32(op==1 ? lean_ctor_get(v,0) : v));
    FREETMPS; LEAVE;
    ST(0)=sv_2mortal(answer); XSRETURN(1);
}
