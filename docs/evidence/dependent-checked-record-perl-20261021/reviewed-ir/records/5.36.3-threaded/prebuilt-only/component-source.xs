#include "runtime.h"
#include "component.h"
static void lbp_component_ready(pTHX) {
  if (!lean_bridge_native_component_ready("dependentrecords@1.0.0:cd5e274866e4d6615a5da362d86900b493ee62a46ef9878944fa052a6a2eeb94")) croak("Lean runtime is not ready or has been retired");
}

static lean_object * lb_read_bcb803bc837008bec599(pTHX_ lbp_scope *scope, SV *value) {

    SV *text = lbp_bigint_text(aTHX_ value, 1);
    STRLEN length; const char *bytes = SvPV(text, length); lbp_budget(scope, length);
    return lbp_keep(scope, lean_cstr_to_nat(bytes));
}
static SV *lb_write_bcb803bc837008bec599(pTHX_ lbp_scope *scope, lean_object * value) {

    lean_inc(value); lean_object *text = lbp_keep(scope, lb_native_nat_text(value));
    size_t length = lean_string_size(text) - 1; lbp_budget(scope, length);
    return lbp_bigint_from_text(aTHX_ lean_string_cstr(text), length);
}

static lean_object * lb_read_9c7fb003d50bbc5bd05d(pTHX_ lbp_scope *scope, SV *value) {

      SvGETMAGIC(value);
      if (!lbp_is_branch(value, "LeanBridge::DependentRecords::Dependent")) croak("expected LeanBridge::DependentRecords::Dependent with an exact class and plain untied hash");
      if (HvUSEDKEYS((HV *)SvRV(value)) != 2) croak("record fields do not match the generated schema");
      HV *input = (HV *)sv_2mortal(SvREFCNT_inc(SvRV(value)));
      lbp_budget(scope, 2 * sizeof(void *));
      /* Pin every field before a child converter can invoke Perl code. */
      SV *slot0 = lbp_field(aTHX_ input, "bound", 5);
      SV *slot1 = lbp_field(aTHX_ input, "below", 5);
      lean_object * a0 = lb_read_bcb803bc837008bec599(aTHX_ scope, slot0);
      lean_object * a1 = lb_read_bcb803bc837008bec599(aTHX_ scope, slot1);
      lean_inc(a0); lean_inc(a1);
      return lbp_keep(scope, lb_t9c7fb003d50bbc5bd05d_make(a0, a1));
}
static SV *lb_write_9c7fb003d50bbc5bd05d(pTHX_ lbp_scope *scope, lean_object * value) {

      lbp_budget(scope, 2 * sizeof(void *));
      HV *record = (HV *)sv_2mortal((SV *)newHV());
      lean_inc(value); lean_object * a0 = lb_t9c7fb003d50bbc5bd05d_get0(value);
      lbp_keep(scope, a0);
      hv_store(record, "bound", 5, SvREFCNT_inc(lb_write_bcb803bc837008bec599(aTHX_ scope, a0)), 0);
      lean_inc(value); lean_object * a1 = lb_t9c7fb003d50bbc5bd05d_get1(value);
      lbp_keep(scope, a1);
      hv_store(record, "below", 5, SvREFCNT_inc(lb_write_bcb803bc837008bec599(aTHX_ scope, a1)), 0);
      return sv_bless(lbp_mortal(newRV_inc((SV *)record)), gv_stashpv("LeanBridge::DependentRecords::Dependent", GV_ADD));
}

MODULE = LeanBridge::DependentRecords    PACKAGE = LeanBridge::DependentRecords
PROTOTYPES: DISABLE


void
dependent_result(...)
  PPCODE:
    if (items != 1) croak("dependent_result expects 1 arguments");
    lbp_check_interpreter(aTHX);
    lbp_component_ready(aTHX);
    LBP_ENTER();
    lean_object * a0 = lb_read_bcb803bc837008bec599(aTHX_ scope, ST(0));
    lean_inc(a0);
    lean_object * result = lb_e59e187300c993f56dccdfb9(a0);
    lbp_keep(scope, result);
    lbp_finish(aTHX_ scope);
    lbp_component_ready(aTHX);
    SV *out = lb_write_9c7fb003d50bbc5bd05d(aTHX_ scope, result);
    lbp_component_ready(aTHX);
    SvREFCNT_inc(out);
    LBP_LEAVE();
    ST(0) = sv_2mortal(out);
    XSRETURN(1);


void
dependent_roundtrip(...)
  PPCODE:
    if (items != 1) croak("dependent_roundtrip expects 1 arguments");
    lbp_check_interpreter(aTHX);
    lbp_component_ready(aTHX);
    LBP_ENTER();
    lean_object * a0 = lb_read_9c7fb003d50bbc5bd05d(aTHX_ scope, ST(0));
    { lean_inc(a0); if (!lb_5c4342be8d065a841e1981ff_refinement_0(a0)) croak("%s", "value0 was rejected by DependentRecords.mkDependent"); }
    lean_inc(a0);
    lean_object *checked = lb_5c4342be8d065a841e1981ff(a0);
    if (lean_is_scalar(checked)) croak("Lean rejected an argument outside its checked refinement");
    lean_object *boxed = lean_ctor_get(checked, 0);
    lean_inc(boxed);
    lean_object * result = boxed;
    lean_dec(checked);
    lbp_keep(scope, result);
    lbp_finish(aTHX_ scope);
    lbp_component_ready(aTHX);
    SV *out = lb_write_9c7fb003d50bbc5bd05d(aTHX_ scope, result);
    lbp_component_ready(aTHX);
    SvREFCNT_inc(out);
    LBP_LEAVE();
    ST(0) = sv_2mortal(out);
    XSRETURN(1);


void
dependent_total(...)
  PPCODE:
    if (items != 1) croak("dependent_total expects 1 arguments");
    lbp_check_interpreter(aTHX);
    lbp_component_ready(aTHX);
    LBP_ENTER();
    lean_object * a0 = lb_read_9c7fb003d50bbc5bd05d(aTHX_ scope, ST(0));
    { lean_inc(a0); if (!lb_6742bb14f123c11405a71a1d_refinement_0(a0)) croak("%s", "value0 was rejected by DependentRecords.mkDependent"); }
    lean_inc(a0);
    lean_object *checked = lb_6742bb14f123c11405a71a1d(a0);
    if (lean_is_scalar(checked)) croak("Lean rejected an argument outside its checked refinement");
    lean_object *boxed = lean_ctor_get(checked, 0);
    lean_inc(boxed);
    lean_object * result = boxed;
    lean_dec(checked);
    lbp_keep(scope, result);
    lbp_finish(aTHX_ scope);
    lbp_component_ready(aTHX);
    SV *out = lb_write_bcb803bc837008bec599(aTHX_ scope, result);
    lbp_component_ready(aTHX);
    SvREFCNT_inc(out);
    LBP_LEAVE();
    ST(0) = sv_2mortal(out);
    XSRETURN(1);

BOOT:
  lbp_check_interpreter(aTHX);
  extern lean_object *initialize_LeanBridgeNativeca8ca903379eb247(uint8_t);
  if (!lean_bridge_native_component_initialize("dependentrecords@1.0.0:cd5e274866e4d6615a5da362d86900b493ee62a46ef9878944fa052a6a2eeb94", (lean_bridge_native_initializer)initialize_LeanBridgeNativeca8ca903379eb247)) croak("Lean component initialization failed");

