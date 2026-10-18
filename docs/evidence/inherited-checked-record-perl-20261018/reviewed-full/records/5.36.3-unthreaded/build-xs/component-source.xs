#include "runtime.h"
#include "component.h"
static void lbp_component_ready(pTHX) {
  if (!lean_bridge_native_component_ready("inheritedcheckedrecords@1.0.0:53509628e8748849ffa17fca90c68c15ad1be2ae6340b47f9ab5c1ab751ebbd4")) croak("Lean runtime is not ready or has been retired");
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
aliased(...)
  PPCODE:
    if (items != 1) croak("aliased expects 1 arguments");
    lbp_check_interpreter(aTHX);
    lbp_component_ready(aTHX);
    LBP_ENTER();
    lean_object * a0 = lb_read_315853af6092a0b959d6(aTHX_ scope, ST(0));
    { lean_inc(a0); lean_object * v0_0 = lbp_keep(scope, lb_t315853af6092a0b959d6_get0(a0));
      { lean_inc(v0_0); if (!lb_25ec12ca230f337209516eb6_refinement_0_0(v0_0)) croak("%s.toSpan was rejected by InheritedCheckedRecords.normalizeSpan", "value0"); }
      lean_inc(a0); lean_object * v0_1 = lbp_keep(scope, lb_t315853af6092a0b959d6_get1(a0));
      lean_inc(v0_1); if (!lb_25ec12ca230f337209516eb6_refinement_0_1(v0_1)) croak("%s.word was rejected by InheritedCheckedRecords.normalizeWord", "value0");
      lean_inc(a0); if (!lb_25ec12ca230f337209516eb6_refinement_0(a0)) croak("%s", "value0 was rejected by InheritedCheckedRecords.mkTicket"); }
    lean_inc(a0);
    lean_object *checked = lb_25ec12ca230f337209516eb6(a0);
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


void
echo(...)
  PPCODE:
    if (items != 1) croak("echo expects 1 arguments");
    lbp_check_interpreter(aTHX);
    lbp_component_ready(aTHX);
    LBP_ENTER();
    lean_object * a0 = lb_read_315853af6092a0b959d6(aTHX_ scope, ST(0));
    { lean_inc(a0); lean_object * v0_0 = lbp_keep(scope, lb_t315853af6092a0b959d6_get0(a0));
      { lean_inc(v0_0); if (!lb_ca5a38c02117fc35832e2681_refinement_0_0(v0_0)) croak("%s.toSpan was rejected by InheritedCheckedRecords.mkSpan", "value0"); }
      lean_inc(a0); lean_object * v0_1 = lbp_keep(scope, lb_t315853af6092a0b959d6_get1(a0));
      lean_inc(v0_1); if (!lb_ca5a38c02117fc35832e2681_refinement_0_1(v0_1)) croak("%s.word was rejected by InheritedCheckedRecords.normalizeWord", "value0");
      lean_inc(a0); if (!lb_ca5a38c02117fc35832e2681_refinement_0(a0)) croak("%s", "value0 was rejected by InheritedCheckedRecords.normalizeTicket"); }
    lean_inc(a0);
    lean_object *checked = lb_ca5a38c02117fc35832e2681(a0);
    if (lean_is_scalar(checked)) croak("Lean rejected an argument outside its checked refinement");
    lean_object *boxed = lean_ctor_get(checked, 0);
    lean_inc(boxed);
    lean_object * result = boxed;
    lean_dec(checked);
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
first(...)
  PPCODE:
    if (items != 1) croak("first expects 1 arguments");
    lbp_check_interpreter(aTHX);
    lbp_component_ready(aTHX);
    LBP_ENTER();
    lean_object * a0 = lb_read_315853af6092a0b959d6(aTHX_ scope, ST(0));
    { lean_inc(a0); lean_object * v0_0 = lbp_keep(scope, lb_t315853af6092a0b959d6_get0(a0));
      { lean_inc(v0_0); if (!lb_5fa0650d7e3d0ca3c50c17e8_refinement_0_0(v0_0)) croak("%s.toSpan was rejected by InheritedCheckedRecords.mkSpan", "value0"); }
      lean_inc(a0); lean_object * v0_1 = lbp_keep(scope, lb_t315853af6092a0b959d6_get1(a0));
      lean_inc(v0_1); if (!lb_5fa0650d7e3d0ca3c50c17e8_refinement_0_1(v0_1)) croak("%s.word was rejected by InheritedCheckedRecords.mkWord", "value0");
      lean_inc(a0); if (!lb_5fa0650d7e3d0ca3c50c17e8_refinement_0(a0)) croak("%s", "value0 was rejected by InheritedCheckedRecords.mkTicket"); }
    lean_inc(a0);
    lean_object *checked = lb_5fa0650d7e3d0ca3c50c17e8(a0);
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


void
nested(...)
  PPCODE:
    if (items != 1) croak("nested expects 1 arguments");
    lbp_check_interpreter(aTHX);
    lbp_component_ready(aTHX);
    LBP_ENTER();
    lean_object * a0 = lb_read_883791d3e6bd215ec557(aTHX_ scope, ST(0));
    { lean_inc(a0); lean_object *v0_1 = lbp_keep(scope, lb_t883791d3e6bd215ec557_get1(a0));
      { lean_object *bound = lean_cstr_to_nat("8"); int below = lean_nat_lt(v0_1, bound); lean_dec(bound);
      if (!below) croak("%s.mark is not below its Fin 8 bound", "value0"); } }
    { lean_inc(a0); lean_object * v0_0 = lbp_keep(scope, lb_t883791d3e6bd215ec557_get0(a0));
      { lean_inc(v0_0); lean_object * v1_0 = lbp_keep(scope, lb_t315853af6092a0b959d6_get0(v0_0));
      { lean_inc(v1_0); if (!lb_bb0100828f9f9e7c08651f56_refinement_0_0_0(v1_0)) croak("%s.toTicket.toSpan was rejected by InheritedCheckedRecords.mkSpan", "value0"); }
      lean_inc(v0_0); lean_object * v1_1 = lbp_keep(scope, lb_t315853af6092a0b959d6_get1(v0_0));
      lean_inc(v1_1); if (!lb_bb0100828f9f9e7c08651f56_refinement_0_0_1(v1_1)) croak("%s.toTicket.word was rejected by InheritedCheckedRecords.mkWord", "value0");
      lean_inc(v0_0); if (!lb_bb0100828f9f9e7c08651f56_refinement_0_0(v0_0)) croak("%s.toTicket was rejected by InheritedCheckedRecords.mkTicket", "value0"); }
      lean_inc(a0); if (!lb_bb0100828f9f9e7c08651f56_refinement_0(a0)) croak("%s", "value0 was rejected by InheritedCheckedRecords.mkStamped"); }
    lean_inc(a0);
    lean_object *checked = lb_bb0100828f9f9e7c08651f56(a0);
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


void
normalized(...)
  PPCODE:
    if (items != 1) croak("normalized expects 1 arguments");
    lbp_check_interpreter(aTHX);
    lbp_component_ready(aTHX);
    LBP_ENTER();
    lean_object * a0 = lb_read_315853af6092a0b959d6(aTHX_ scope, ST(0));
    { lean_inc(a0); lean_object * v0_0 = lbp_keep(scope, lb_t315853af6092a0b959d6_get0(a0));
      { lean_inc(v0_0); if (!lb_309707c4324df1d6adbb987d_refinement_0_0(v0_0)) croak("%s.toSpan was rejected by InheritedCheckedRecords.normalizeSpan", "value0"); }
      lean_inc(a0); lean_object * v0_1 = lbp_keep(scope, lb_t315853af6092a0b959d6_get1(a0));
      lean_inc(v0_1); if (!lb_309707c4324df1d6adbb987d_refinement_0_1(v0_1)) croak("%s.word was rejected by InheritedCheckedRecords.normalizeWord", "value0");
      lean_inc(a0); if (!lb_309707c4324df1d6adbb987d_refinement_0(a0)) croak("%s", "value0 was rejected by InheritedCheckedRecords.normalizeTicket"); }
    lean_inc(a0);
    lean_object *checked = lb_309707c4324df1d6adbb987d(a0);
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


void
pair(...)
  PPCODE:
    if (items != 2) croak("pair expects 2 arguments");
    lbp_check_interpreter(aTHX);
    lbp_component_ready(aTHX);
    LBP_ENTER();
    lean_object * a0 = lb_read_315853af6092a0b959d6(aTHX_ scope, ST(0));
    lean_object * a1 = lb_read_315853af6092a0b959d6(aTHX_ scope, ST(1));
    { lean_inc(a0); lean_object * v0_0 = lbp_keep(scope, lb_t315853af6092a0b959d6_get0(a0));
      { lean_inc(v0_0); if (!lb_289ea54556c6c6f756c13add_refinement_0_0(v0_0)) croak("%s.toSpan was rejected by InheritedCheckedRecords.mkSpan", "value0"); }
      lean_inc(a0); lean_object * v0_1 = lbp_keep(scope, lb_t315853af6092a0b959d6_get1(a0));
      lean_inc(v0_1); if (!lb_289ea54556c6c6f756c13add_refinement_0_1(v0_1)) croak("%s.word was rejected by InheritedCheckedRecords.mkWord", "value0");
      lean_inc(a0); if (!lb_289ea54556c6c6f756c13add_refinement_0(a0)) croak("%s", "value0 was rejected by InheritedCheckedRecords.mkTicket"); }
    { lean_inc(a1); lean_object * v0_0 = lbp_keep(scope, lb_t315853af6092a0b959d6_get0(a1));
      { lean_inc(v0_0); if (!lb_289ea54556c6c6f756c13add_refinement_1_0(v0_0)) croak("%s.toSpan was rejected by InheritedCheckedRecords.normalizeSpan", "value1"); }
      lean_inc(a1); lean_object * v0_1 = lbp_keep(scope, lb_t315853af6092a0b959d6_get1(a1));
      lean_inc(v0_1); if (!lb_289ea54556c6c6f756c13add_refinement_1_1(v0_1)) croak("%s.word was rejected by InheritedCheckedRecords.normalizeWord", "value1");
      lean_inc(a1); if (!lb_289ea54556c6c6f756c13add_refinement_1(a1)) croak("%s", "value1 was rejected by InheritedCheckedRecords.normalizeTicket"); }
    lean_inc(a0); lean_inc(a1);
    lean_object *checked = lb_289ea54556c6c6f756c13add(a0, a1);
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
  if (!lean_bridge_native_component_initialize("inheritedcheckedrecords@1.0.0:53509628e8748849ffa17fca90c68c15ad1be2ae6340b47f9ab5c1ab751ebbd4", (lean_bridge_native_initializer)initialize_LeanBridgeNative95491bb762dabafa)) croak("Lean component initialization failed");

