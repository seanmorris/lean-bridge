#include "runtime.h"
#include "component.h"
static void lbp_component_ready(pTHX) {
  if (!lean_bridge_native_component_ready("inheritedcheckedrecords@1.0.0:e183f646c9ebeddc2ef01799f4e7480c27b6bcba74b7b0b4e61025277eee15cf")) croak("Lean runtime is not ready or has been retired");
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

static lean_object * lb_read_2d191276e712f8e90a64(pTHX_ lbp_scope *scope, SV *value) {

      SvGETMAGIC(value);
      if (!lbp_is_branch(value, "LeanBridge::InheritedCheckedRecords::Span")) croak("expected LeanBridge::InheritedCheckedRecords::Span with an exact class and plain untied hash");
      if (HvUSEDKEYS((HV *)SvRV(value)) != 2) croak("record fields do not match the generated schema");
      HV *input = (HV *)sv_2mortal(SvREFCNT_inc(SvRV(value)));
      lbp_budget(scope, 2 * sizeof(void *));
      /* Pin every field before a child converter can invoke Perl code. */
      SV *slot0 = lbp_field(aTHX_ input, "lo", 2);
      SV *slot1 = lbp_field(aTHX_ input, "hi", 2);
      lean_object * a0 = lb_read_bcb803bc837008bec599(aTHX_ scope, slot0);
      lean_object * a1 = lb_read_bcb803bc837008bec599(aTHX_ scope, slot1);
      lean_inc(a0); lean_inc(a1);
      return lbp_keep(scope, lb_t2d191276e712f8e90a64_make(a0, a1));
}
static SV *lb_write_2d191276e712f8e90a64(pTHX_ lbp_scope *scope, lean_object * value) {

      lbp_budget(scope, 2 * sizeof(void *));
      HV *record = (HV *)sv_2mortal((SV *)newHV());
      lean_inc(value); lean_object * a0 = lb_t2d191276e712f8e90a64_get0(value);
      lbp_keep(scope, a0);
      hv_store(record, "lo", 2, SvREFCNT_inc(lb_write_bcb803bc837008bec599(aTHX_ scope, a0)), 0);
      lean_inc(value); lean_object * a1 = lb_t2d191276e712f8e90a64_get1(value);
      lbp_keep(scope, a1);
      hv_store(record, "hi", 2, SvREFCNT_inc(lb_write_bcb803bc837008bec599(aTHX_ scope, a1)), 0);
      return sv_bless(lbp_mortal(newRV_inc((SV *)record)), gv_stashpv("LeanBridge::InheritedCheckedRecords::Span", GV_ADD));
}

static lean_object * lb_read_315853af6092a0b959d6(pTHX_ lbp_scope *scope, SV *value) {

      SvGETMAGIC(value);
      if (!lbp_is_branch(value, "LeanBridge::InheritedCheckedRecords::Ticket")) croak("expected LeanBridge::InheritedCheckedRecords::Ticket with an exact class and plain untied hash");
      if (HvUSEDKEYS((HV *)SvRV(value)) != 2) croak("record fields do not match the generated schema");
      HV *input = (HV *)sv_2mortal(SvREFCNT_inc(SvRV(value)));
      lbp_budget(scope, 2 * sizeof(void *));
      /* Pin every field before a child converter can invoke Perl code. */
      SV *slot0 = lbp_field(aTHX_ input, "toSpan", 6);
      SV *slot1 = lbp_field(aTHX_ input, "word", 4);
      lean_object * a0 = lb_read_2d191276e712f8e90a64(aTHX_ scope, slot0);
      lean_object * a1 = lb_read_bcb803bc837008bec599(aTHX_ scope, slot1);
      lean_inc(a0); lean_inc(a1);
      return lbp_keep(scope, lb_t315853af6092a0b959d6_make(a0, a1));
}
static SV *lb_write_315853af6092a0b959d6(pTHX_ lbp_scope *scope, lean_object * value) {

      lbp_budget(scope, 2 * sizeof(void *));
      HV *record = (HV *)sv_2mortal((SV *)newHV());
      lean_inc(value); lean_object * a0 = lb_t315853af6092a0b959d6_get0(value);
      lbp_keep(scope, a0);
      hv_store(record, "toSpan", 6, SvREFCNT_inc(lb_write_2d191276e712f8e90a64(aTHX_ scope, a0)), 0);
      lean_inc(value); lean_object * a1 = lb_t315853af6092a0b959d6_get1(value);
      lbp_keep(scope, a1);
      hv_store(record, "word", 4, SvREFCNT_inc(lb_write_bcb803bc837008bec599(aTHX_ scope, a1)), 0);
      return sv_bless(lbp_mortal(newRV_inc((SV *)record)), gv_stashpv("LeanBridge::InheritedCheckedRecords::Ticket", GV_ADD));
}

static lean_object * lb_read_883791d3e6bd215ec557(pTHX_ lbp_scope *scope, SV *value) {

      SvGETMAGIC(value);
      if (!lbp_is_branch(value, "LeanBridge::InheritedCheckedRecords::Stamped")) croak("expected LeanBridge::InheritedCheckedRecords::Stamped with an exact class and plain untied hash");
      if (HvUSEDKEYS((HV *)SvRV(value)) != 2) croak("record fields do not match the generated schema");
      HV *input = (HV *)sv_2mortal(SvREFCNT_inc(SvRV(value)));
      lbp_budget(scope, 2 * sizeof(void *));
      /* Pin every field before a child converter can invoke Perl code. */
      SV *slot0 = lbp_field(aTHX_ input, "toTicket", 8);
      SV *slot1 = lbp_field(aTHX_ input, "mark", 4);
      lean_object * a0 = lb_read_315853af6092a0b959d6(aTHX_ scope, slot0);
      lean_object * a1 = lb_read_bcb803bc837008bec599(aTHX_ scope, slot1);
      lean_inc(a0); lean_inc(a1);
      return lbp_keep(scope, lb_t883791d3e6bd215ec557_make(a0, a1));
}
static SV *lb_write_883791d3e6bd215ec557(pTHX_ lbp_scope *scope, lean_object * value) {

      lbp_budget(scope, 2 * sizeof(void *));
      HV *record = (HV *)sv_2mortal((SV *)newHV());
      lean_inc(value); lean_object * a0 = lb_t883791d3e6bd215ec557_get0(value);
      lbp_keep(scope, a0);
      hv_store(record, "toTicket", 8, SvREFCNT_inc(lb_write_315853af6092a0b959d6(aTHX_ scope, a0)), 0);
      lean_inc(value); lean_object * a1 = lb_t883791d3e6bd215ec557_get1(value);
      lbp_keep(scope, a1);
      hv_store(record, "mark", 4, SvREFCNT_inc(lb_write_bcb803bc837008bec599(aTHX_ scope, a1)), 0);
      return sv_bless(lbp_mortal(newRV_inc((SV *)record)), gv_stashpv("LeanBridge::InheritedCheckedRecords::Stamped", GV_ADD));
}

MODULE = LeanBridge::InheritedCheckedRecords    PACKAGE = LeanBridge::InheritedCheckedRecords
PROTOTYPES: DISABLE


void
produce(...)
  PPCODE:
    if (items != 1) croak("produce expects 1 arguments");
    lbp_check_interpreter(aTHX);
    lbp_component_ready(aTHX);
    LBP_ENTER();
    lean_object * a0 = lb_read_bcb803bc837008bec599(aTHX_ scope, ST(0));
    lean_inc(a0);
    lean_object * result = lb_75e550af993806c790a65617(a0);
    lbp_keep(scope, result);
    lbp_finish(aTHX_ scope);
    lbp_component_ready(aTHX);
    SV *out = lb_write_315853af6092a0b959d6(aTHX_ scope, result);
    lbp_component_ready(aTHX);
    SvREFCNT_inc(out);
    LBP_LEAVE();
    ST(0) = sv_2mortal(out);
    XSRETURN(1);


void
produce_stamped(...)
  PPCODE:
    if (items != 1) croak("produce_stamped expects 1 arguments");
    lbp_check_interpreter(aTHX);
    lbp_component_ready(aTHX);
    LBP_ENTER();
    lean_object * a0 = lb_read_bcb803bc837008bec599(aTHX_ scope, ST(0));
    lean_inc(a0);
    lean_object * result = lb_2df70568191c40dd3c853dbc(a0);
    lbp_keep(scope, result);
    lbp_finish(aTHX_ scope);
    lbp_component_ready(aTHX);
    SV *out = lb_write_883791d3e6bd215ec557(aTHX_ scope, result);
    lbp_component_ready(aTHX);
    SvREFCNT_inc(out);
    LBP_LEAVE();
    ST(0) = sv_2mortal(out);
    XSRETURN(1);

BOOT:
  lbp_check_interpreter(aTHX);
  extern lean_object *initialize_LeanBridgeNative95491bb762dabafa(uint8_t);
  if (!lean_bridge_native_component_initialize("inheritedcheckedrecords@1.0.0:e183f646c9ebeddc2ef01799f4e7480c27b6bcba74b7b0b4e61025277eee15cf", (lean_bridge_native_initializer)initialize_LeanBridgeNative95491bb762dabafa)) croak("Lean component initialization failed");

