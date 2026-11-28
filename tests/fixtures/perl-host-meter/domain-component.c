/* Each test component has its own private session and compiled Lean module.
   The probe never exports a wrapper address to Perl. */
#include "host-domain.h"
#include "component-kinds.h"
#include "members.inc"
extern lean_object *initialize_WireCheck(uint8_t), *lbp_test_wire(lean_object *);
extern lean_object *lbp_test_explain(lean_object *);
extern lean_object *lbp_test_child(lean_object *), *lbp_test_child_of(lean_object *,lean_object *);
extern uint8_t lbp_test_compare(lean_obj_arg,lean_obj_arg);
extern lean_object *lbp_test_echo(lean_obj_arg);
extern void witness_start(void), witness_save(lean_object *);
extern lean_object *witness_value(void);
static lbp_host_session *session;
static SV *slots;
static void other_drop(void *v) { (void)v; }
static void other_each(void *v,b_lean_obj_arg visit) { (void)v; (void)visit; }
static void drop(pTHX_ void *v) { PERL_UNUSED_CONTEXT; lean_dec((lean_object *)v); }
XS_EXTERNAL(domain_probe) {
  dXSARGS;
  if (items<1) croak("missing domain operation");
  lbp_check_interpreter(aTHX);
  const char *op=SvPV_nolen(ST(0));
  if (strEQ(op,"component")) { XSRETURN_PV(COMPONENT_NAME); }
  if (strEQ(op,"bind")) {
    if (items!=4 || !SvROK(ST(3)) || SvTYPE(SvRV(ST(3)))!=SVt_PVAV) croak("missing classes or table");
    const char *classes[2]={SvPV_nolen(ST(1)),SvPV_nolen(ST(2))};
    witness_start(); static int initialized;
    if (!initialized) {
      lean_object *r=initialize_WireCheck(1); if (!lean_io_result_is_ok(r)) abort(); lean_dec(r); initialized=1;
    }
    lbp_host_bind(aTHX_ &session,specs,2,classes);
    slots=newRV_inc(SvRV(ST(3))); XSRETURN_EMPTY;
  }
  if (strEQ(op,"close")) { lbp_host_unbind(aTHX_ &session); SvREFCNT_dec(slots); slots=NULL; XSRETURN_EMPTY; }
  if (strEQ(op,"live")) { XSRETURN_UV(lbp_host_live(aTHX)); }
  if (items<2) croak("missing kind");
  unsigned k=SvUV(ST(1));
  ENTER; SAVETMPS; lbp_host_enter(aTHX_ session);
  SV *answer=&PL_sv_undef;
  if (strEQ(op,"clear")) witness_save(NULL);
  else if (strEQ(op,"close_active")) lbp_host_unbind(aTHX_ &session);
  else if (strEQ(op,"get")) answer=lbp_host_object(aTHX_ session,k,witness_value());
  else if (strEQ(op,"foreign")) {
    static lean_external_class *foreign;
    if (!foreign) foreign=lean_register_external_class(other_drop,other_each);
    lean_object *v=lean_alloc_external(foreign,NULL);
    SAVEDESTRUCTOR_X(drop,v); answer=lbp_host_object(aTHX_ session,k,v);
  }
  else {
    if (items<3) croak("missing application object");
    SSGROW(4);
    lean_object *v=lbp_host_wrap(aTHX_ session,k,ST(2),items>3 && strEQ(op,"save") ? ST(3) : NULL);
    SAVEDESTRUCTOR_X(drop,v);
    if (strEQ(op,"fail")) croak("later input rejected");
    lbp_host_admit(aTHX_ session,k,v);
    if (strEQ(op,"wire") || strEQ(op,"child") || strEQ(op,"child_of")) {
      ph_frame *f=ph_enter(aTHX_ slots); f->session=session;
      lean_object *r;
      if (strEQ(op,"child_of")) {
        if (items!=4) croak("missing anchor");
        lean_object *a=lbp_host_wrap(aTHX_ session,k,ST(3),NULL);
        lean_inc(v); r=lbp_test_child_of(v,a);
      } else { lean_inc(v); r=strEQ(op,"child") ? lbp_test_child(v) : lbp_test_wire(v); }
      SAVEDESTRUCTOR_X(drop,r);
      if (f->failed) croak("Perl host frame unavailable");
      lean_object *out=lean_ctor_get(r,0);
      if (!lean_io_result_is_ok(r)) {
        SV *original=ph_original(f,out); if (original) croak_sv(original);
        lean_inc(out); lean_object *why=lbp_test_explain(out); SAVEDESTRUCTOR_X(drop,why);
        croak("Lean failure: %s",lean_string_cstr(why));
      }
      answer=lbp_host_object(aTHX_ session,k,out);
      if (!strEQ(op,"wire")) witness_save(out);
    }
    else if (strEQ(op,"save")) witness_save(v);
    else if (strEQ(op,"same")) {
      lean_object *held=witness_value();
      if (held) { lean_inc(v); lean_inc(held); answer=boolSV(lbp_test_compare(v,held)); }
      else answer=&PL_sv_no;
    }
    else if (strEQ(op,"echo")) {
      lean_inc(v);
      lean_object *echo=lbp_test_echo(v);
      SAVEDESTRUCTOR_X(drop,echo); answer=lbp_host_object(aTHX_ session,k,echo);
    } else croak("unknown domain operation");
  }
  SV *ret=newSVsv(answer); FREETMPS; LEAVE;
  ST(0)=sv_2mortal(ret); XSRETURN(1);
}
