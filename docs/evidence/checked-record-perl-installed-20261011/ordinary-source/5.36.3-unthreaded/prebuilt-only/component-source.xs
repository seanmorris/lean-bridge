#include "runtime.h"
#include "component.h"
static void lbp_component_ready(pTHX) {
  if (!lean_bridge_native_component_ready("checkedrecords@1.0.0:5342b43886aa8fff09a23979e2217e5cbca4f5538a4fc1b23b6314379c342f80")) croak("Lean runtime is not ready or has been retired");
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

static lean_object * lb_read_2b4e50dd17df301ed218(pTHX_ lbp_scope *scope, SV *value) {

      SvGETMAGIC(value);
      if (!lbp_is_branch(value, "LeanBridge::CheckedRecords::Percent")) croak("expected LeanBridge::CheckedRecords::Percent with an exact class and plain untied hash");
      if (HvUSEDKEYS((HV *)SvRV(value)) != 1) croak("record fields do not match the generated schema");
      HV *input = (HV *)sv_2mortal(SvREFCNT_inc(SvRV(value)));
      lbp_budget(scope, 1 * sizeof(void *));
      /* Pin every field before a child converter can invoke Perl code. */
      SV *slot0 = lbp_field(aTHX_ input, "value", 5);
      lean_object * a0 = lb_read_bcb803bc837008bec599(aTHX_ scope, slot0);
      lean_inc(a0);
      return lbp_keep(scope, lb_t2b4e50dd17df301ed218_make(a0));
}
static SV *lb_write_2b4e50dd17df301ed218(pTHX_ lbp_scope *scope, lean_object * value) {

      lbp_budget(scope, 1 * sizeof(void *));
      HV *record = (HV *)sv_2mortal((SV *)newHV());
      lean_inc(value); lean_object * a0 = lb_t2b4e50dd17df301ed218_get0(value);
      lbp_keep(scope, a0);
      hv_store(record, "value", 5, SvREFCNT_inc(lb_write_bcb803bc837008bec599(aTHX_ scope, a0)), 0);
      return sv_bless(lbp_mortal(newRV_inc((SV *)record)), gv_stashpv("LeanBridge::CheckedRecords::Percent", GV_ADD));
}

static lean_object * lb_read_224517b0527dd01c7a6b(pTHX_ lbp_scope *scope, SV *value) {

      SvGETMAGIC(value);
      if (!SvROK(value) || SvTYPE(SvRV(value)) != SVt_PVAV || SvOBJECT(SvRV(value)) || (SvMAGICAL(SvRV(value)) && mg_find(SvRV(value), PERL_MAGIC_tied))) croak("Array requires a plain array reference");
      AV *array = (AV *)sv_2mortal(SvREFCNT_inc(SvRV(value))); size_t length = av_count(array);
      if (length > 16 * 1024 * 1024 / sizeof(void *)) croak("native copied array exceeds the 16 MiB per-call limit");
      lbp_budget(scope, length * sizeof(void *));
      /* Pin the sequence before an element converter can invoke Perl code. */
      AV *slots = (AV *)sv_2mortal((SV *)newAV());
      if (length) av_extend(slots, length - 1);
      for (size_t i = 0; i < length; ++i) {
        SV **entry = av_fetch(array, i, 0); if (!entry) croak("sparse Perl arrays are unsupported");
        av_push(slots, SvREFCNT_inc(*entry));
      }
      lean_object *result = lean_alloc_array(length, length);
      /* Registration can fail and release result; every slot must already be valid. */
      for (size_t i = 0; i < length; ++i) lean_array_set_core(result, i, lean_box(0));
      lbp_keep(scope, result);
      for (size_t i = 0; i < length; ++i) {
        SV **entry = av_fetch(slots, i, 0); if (!entry) croak("sparse Perl arrays are unsupported");
        lean_object * item = lb_read_bcb803bc837008bec599(aTHX_ scope, sv_2mortal(SvREFCNT_inc(*entry)));
        lean_array_set_core(result, i, (lean_inc(item), item));
      }
      return result;
}
static SV *lb_write_224517b0527dd01c7a6b(pTHX_ lbp_scope *scope, lean_object * value) {

      
      size_t length = lean_array_size(value);
      if (length > 16 * 1024 * 1024 / sizeof(void *)) croak("native copied array exceeds the 16 MiB per-call limit");
      lbp_budget(scope, length * sizeof(void *));
      AV *array = (AV *)sv_2mortal((SV *)newAV());
      for (size_t i = 0; i < length; ++i) {
        SV *item = lb_write_bcb803bc837008bec599(aTHX_ scope, lean_array_get_core(value, i));
        av_push(array, SvREFCNT_inc(item));
      }
      return lbp_mortal(newRV_inc((SV *)array));
}

static lean_object * lb_read_bf20058b8573a6a30bee(pTHX_ lbp_scope *scope, SV *value) {

      SvGETMAGIC(value);
      if (!lbp_is_branch(value, "LeanBridge::CheckedRecords::Triple")) croak("expected LeanBridge::CheckedRecords::Triple with an exact class and plain untied hash");
      if (HvUSEDKEYS((HV *)SvRV(value)) != 1) croak("record fields do not match the generated schema");
      HV *input = (HV *)sv_2mortal(SvREFCNT_inc(SvRV(value)));
      lbp_budget(scope, 1 * sizeof(void *));
      /* Pin every field before a child converter can invoke Perl code. */
      SV *slot0 = lbp_field(aTHX_ input, "data", 4);
      lean_object * a0 = lb_read_224517b0527dd01c7a6b(aTHX_ scope, slot0);
      lean_inc(a0);
      return lbp_keep(scope, lb_tbf20058b8573a6a30bee_make(a0));
}
static SV *lb_write_bf20058b8573a6a30bee(pTHX_ lbp_scope *scope, lean_object * value) {

      lbp_budget(scope, 1 * sizeof(void *));
      HV *record = (HV *)sv_2mortal((SV *)newHV());
      lean_inc(value); lean_object * a0 = lb_tbf20058b8573a6a30bee_get0(value);
      lbp_keep(scope, a0);
      hv_store(record, "data", 4, SvREFCNT_inc(lb_write_224517b0527dd01c7a6b(aTHX_ scope, a0)), 0);
      return sv_bless(lbp_mortal(newRV_inc((SV *)record)), gv_stashpv("LeanBridge::CheckedRecords::Triple", GV_ADD));
}

static lean_object * lb_read_c3f448eba7f824e0e035(pTHX_ lbp_scope *scope, SV *value) {

      SvGETMAGIC(value);
      if (!lbp_is_branch(value, "LeanBridge::CheckedRecords::Interval")) croak("expected LeanBridge::CheckedRecords::Interval with an exact class and plain untied hash");
      if (HvUSEDKEYS((HV *)SvRV(value)) != 2) croak("record fields do not match the generated schema");
      HV *input = (HV *)sv_2mortal(SvREFCNT_inc(SvRV(value)));
      lbp_budget(scope, 2 * sizeof(void *));
      /* Pin every field before a child converter can invoke Perl code. */
      SV *slot0 = lbp_field(aTHX_ input, "lo", 2);
      SV *slot1 = lbp_field(aTHX_ input, "hi", 2);
      lean_object * a0 = lb_read_bcb803bc837008bec599(aTHX_ scope, slot0);
      lean_object * a1 = lb_read_bcb803bc837008bec599(aTHX_ scope, slot1);
      lean_inc(a0); lean_inc(a1);
      return lbp_keep(scope, lb_tc3f448eba7f824e0e035_make(a0, a1));
}
static SV *lb_write_c3f448eba7f824e0e035(pTHX_ lbp_scope *scope, lean_object * value) {

      lbp_budget(scope, 2 * sizeof(void *));
      HV *record = (HV *)sv_2mortal((SV *)newHV());
      lean_inc(value); lean_object * a0 = lb_tc3f448eba7f824e0e035_get0(value);
      lbp_keep(scope, a0);
      hv_store(record, "lo", 2, SvREFCNT_inc(lb_write_bcb803bc837008bec599(aTHX_ scope, a0)), 0);
      lean_inc(value); lean_object * a1 = lb_tc3f448eba7f824e0e035_get1(value);
      lbp_keep(scope, a1);
      hv_store(record, "hi", 2, SvREFCNT_inc(lb_write_bcb803bc837008bec599(aTHX_ scope, a1)), 0);
      return sv_bless(lbp_mortal(newRV_inc((SV *)record)), gv_stashpv("LeanBridge::CheckedRecords::Interval", GV_ADD));
}

MODULE = LeanBridge::CheckedRecords    PACKAGE = LeanBridge::CheckedRecords
PROTOTYPES: DISABLE


void
complement(...)
  PPCODE:
    if (items != 1) croak("complement expects 1 arguments");
    lbp_check_interpreter(aTHX);
    lbp_component_ready(aTHX);
    LBP_ENTER();
    lean_object * a0 = lb_read_2b4e50dd17df301ed218(aTHX_ scope, ST(0));
    lean_inc(a0); if (!lb_e576ee8305e380910c850b82_refinement_0(a0)) croak("%s", "arg0 was rejected by CheckedRecords.mkPercent");
    lean_inc(a0);
    lean_object *checked = lb_e576ee8305e380910c850b82(a0);
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
first_of(...)
  PPCODE:
    if (items != 1) croak("first_of expects 1 arguments");
    lbp_check_interpreter(aTHX);
    lbp_component_ready(aTHX);
    LBP_ENTER();
    lean_object * a0 = lb_read_bf20058b8573a6a30bee(aTHX_ scope, ST(0));
    lean_inc(a0); if (!lb_6020322b80f8b9017fcfa3cd_refinement_0(a0)) croak("%s", "arg0 was rejected by CheckedRecords.mkTriple");
    lean_inc(a0);
    lean_object *checked = lb_6020322b80f8b9017fcfa3cd(a0);
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
repeated(...)
  PPCODE:
    if (items != 1) croak("repeated expects 1 arguments");
    lbp_check_interpreter(aTHX);
    lbp_component_ready(aTHX);
    LBP_ENTER();
    lean_object * a0 = lb_read_bcb803bc837008bec599(aTHX_ scope, ST(0));
    lean_inc(a0);
    lean_object * result = lb_4c18758fdab8ddafcc87474a(a0);
    lbp_keep(scope, result);
    lbp_finish(aTHX_ scope);
    lbp_component_ready(aTHX);
    SV *out = lb_write_bf20058b8573a6a30bee(aTHX_ scope, result);
    lbp_component_ready(aTHX);
    SvREFCNT_inc(out);
    LBP_LEAVE();
    ST(0) = sv_2mortal(out);
    XSRETURN(1);


void
scale(...)
  PPCODE:
    if (items != 2) croak("scale expects 2 arguments");
    lbp_check_interpreter(aTHX);
    lbp_component_ready(aTHX);
    LBP_ENTER();
    lean_object * a0 = lb_read_bcb803bc837008bec599(aTHX_ scope, ST(0));
    lean_object * a1 = lb_read_bf20058b8573a6a30bee(aTHX_ scope, ST(1));
    lean_inc(a1); if (!lb_2a443e55ebb87a4b42d08148_refinement_1(a1)) croak("%s", "arg1 was rejected by CheckedRecords.mkTriple");
    lean_inc(a0); lean_inc(a1);
    lean_object *checked = lb_2a443e55ebb87a4b42d08148(a0, a1);
    if (lean_is_scalar(checked)) croak("Lean rejected an argument outside its checked refinement");
    lean_object *boxed = lean_ctor_get(checked, 0);
    lean_inc(boxed);
    lean_object * result = boxed;
    lean_dec(checked);
    lbp_keep(scope, result);
    lbp_finish(aTHX_ scope);
    lbp_component_ready(aTHX);
    SV *out = lb_write_bf20058b8573a6a30bee(aTHX_ scope, result);
    lbp_component_ready(aTHX);
    SvREFCNT_inc(out);
    LBP_LEAVE();
    ST(0) = sv_2mortal(out);
    XSRETURN(1);


void
smallest(...)
  PPCODE:
    if (items != 1) croak("smallest expects 1 arguments");
    lbp_check_interpreter(aTHX);
    lbp_component_ready(aTHX);
    LBP_ENTER();
    lean_object * a0 = lb_read_bf20058b8573a6a30bee(aTHX_ scope, ST(0));
    lean_inc(a0); if (!lb_c5d6822b1d53e0688e082812_refinement_0(a0)) croak("%s", "arg0 was rejected by CheckedRecords.sortedTriple");
    lean_inc(a0);
    lean_object *checked = lb_c5d6822b1d53e0688e082812(a0);
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
span(...)
  PPCODE:
    if (items != 2) croak("span expects 2 arguments");
    lbp_check_interpreter(aTHX);
    lbp_component_ready(aTHX);
    LBP_ENTER();
    lean_object * a0 = lb_read_c3f448eba7f824e0e035(aTHX_ scope, ST(0));
    lean_object * a1 = lb_read_c3f448eba7f824e0e035(aTHX_ scope, ST(1));
    lean_inc(a0); if (!lb_a6305cd0ef2e210efa593d33_refinement_0(a0)) croak("%s", "arg0 was rejected by CheckedRecords.mkInterval");
    lean_inc(a1); if (!lb_a6305cd0ef2e210efa593d33_refinement_1(a1)) croak("%s", "arg1 was rejected by CheckedRecords.mkInterval");
    lean_inc(a0); lean_inc(a1);
    lean_object *checked = lb_a6305cd0ef2e210efa593d33(a0, a1);
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
total(...)
  PPCODE:
    if (items != 1) croak("total expects 1 arguments");
    lbp_check_interpreter(aTHX);
    lbp_component_ready(aTHX);
    LBP_ENTER();
    lean_object * a0 = lb_read_bf20058b8573a6a30bee(aTHX_ scope, ST(0));
    lean_inc(a0); if (!lb_dd4efd56947fae04424545d2_refinement_0(a0)) croak("%s", "arg0 was rejected by CheckedRecords.mkTriple");
    lean_inc(a0);
    lean_object *checked = lb_dd4efd56947fae04424545d2(a0);
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
width(...)
  PPCODE:
    if (items != 1) croak("width expects 1 arguments");
    lbp_check_interpreter(aTHX);
    lbp_component_ready(aTHX);
    LBP_ENTER();
    lean_object * a0 = lb_read_c3f448eba7f824e0e035(aTHX_ scope, ST(0));
    lean_inc(a0); if (!lb_aad2b63e65ac8fb15f3f227a_refinement_0(a0)) croak("%s", "arg0 was rejected by CheckedRecords.mkInterval");
    lean_inc(a0);
    lean_object *checked = lb_aad2b63e65ac8fb15f3f227a(a0);
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
  extern lean_object *initialize_LeanBridgeNatived3803aad486f3d2e(uint8_t);
  if (!lean_bridge_native_component_initialize("checkedrecords@1.0.0:5342b43886aa8fff09a23979e2217e5cbca4f5538a4fc1b23b6314379c342f80", (lean_bridge_native_initializer)initialize_LeanBridgeNatived3803aad486f3d2e)) croak("Lean component initialization failed");

