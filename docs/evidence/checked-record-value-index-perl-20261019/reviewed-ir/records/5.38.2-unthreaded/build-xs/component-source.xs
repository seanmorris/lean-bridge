#include "runtime.h"
#include "component.h"
static void lbp_component_ready(pTHX) {
  if (!lean_bridge_native_component_ready("checkedrecordvalueindices@1.0.0:39941bbf2ec5f61793b17581a6f4e1e79725ec63f2fd2a6d5a5cbfa7274ae1e6")) croak("Lean runtime is not ready or has been retired");
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

static lean_object * lb_read_e6e782ea1d9b18dc3e44(pTHX_ lbp_scope *scope, SV *value) {

      SvGETMAGIC(value);
      if (!lbp_is_branch(value, "LeanBridge::CheckedRecordValueIndices::Ab")) croak("expected LeanBridge::CheckedRecordValueIndices::Ab with an exact class and plain untied hash");
      if (HvUSEDKEYS((HV *)SvRV(value)) != 1) croak("record fields do not match the generated schema");
      HV *input = (HV *)sv_2mortal(SvREFCNT_inc(SvRV(value)));
      lbp_budget(scope, 1 * sizeof(void *));
      /* Pin every field before a child converter can invoke Perl code. */
      SV *slot0 = lbp_field(aTHX_ input, "size", 4);
      lean_object * a0 = lb_read_bcb803bc837008bec599(aTHX_ scope, slot0);
      lean_inc(a0);
      return lbp_keep(scope, lb_te6e782ea1d9b18dc3e44_make(a0));
}
static SV *lb_write_e6e782ea1d9b18dc3e44(pTHX_ lbp_scope *scope, lean_object * value) {

      lbp_budget(scope, 1 * sizeof(void *));
      HV *record = (HV *)sv_2mortal((SV *)newHV());
      lean_inc(value); lean_object * a0 = lb_te6e782ea1d9b18dc3e44_get0(value);
      lbp_keep(scope, a0);
      hv_store(record, "size", 4, SvREFCNT_inc(lb_write_bcb803bc837008bec599(aTHX_ scope, a0)), 0);
      return sv_bless(lbp_mortal(newRV_inc((SV *)record)), gv_stashpv("LeanBridge::CheckedRecordValueIndices::Ab", GV_ADD));
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

static lean_object * lb_read_97a1bccb66cfd61c7d52(pTHX_ lbp_scope *scope, SV *value) {

      SvGETMAGIC(value);
      if (!lbp_is_branch(value, "LeanBridge::CheckedRecordValueIndices::EmptySized")) croak("expected LeanBridge::CheckedRecordValueIndices::EmptySized with an exact class and plain untied hash");
      if (HvUSEDKEYS((HV *)SvRV(value)) != 1) croak("record fields do not match the generated schema");
      HV *input = (HV *)sv_2mortal(SvREFCNT_inc(SvRV(value)));
      lbp_budget(scope, 1 * sizeof(void *));
      /* Pin every field before a child converter can invoke Perl code. */
      SV *slot0 = lbp_field(aTHX_ input, "data", 4);
      lean_object * a0 = lb_read_224517b0527dd01c7a6b(aTHX_ scope, slot0);
      lean_inc(a0);
      return lbp_keep(scope, lb_t97a1bccb66cfd61c7d52_make(a0));
}
static SV *lb_write_97a1bccb66cfd61c7d52(pTHX_ lbp_scope *scope, lean_object * value) {

      lbp_budget(scope, 1 * sizeof(void *));
      HV *record = (HV *)sv_2mortal((SV *)newHV());
      lean_inc(value); lean_object * a0 = lb_t97a1bccb66cfd61c7d52_get0(value);
      lbp_keep(scope, a0);
      hv_store(record, "data", 4, SvREFCNT_inc(lb_write_224517b0527dd01c7a6b(aTHX_ scope, a0)), 0);
      return sv_bless(lbp_mortal(newRV_inc((SV *)record)), gv_stashpv("LeanBridge::CheckedRecordValueIndices::EmptySized", GV_ADD));
}

static lean_object * lb_read_0ac37d04b2c3f2e53e25(pTHX_ lbp_scope *scope, SV *value) {

      SvGETMAGIC(value);
      if (!lbp_is_branch(value, "LeanBridge::CheckedRecordValueIndices::EmptyToken")) croak("expected LeanBridge::CheckedRecordValueIndices::EmptyToken with an exact class and plain untied hash");
      if (HvUSEDKEYS((HV *)SvRV(value)) != 1) croak("record fields do not match the generated schema");
      HV *input = (HV *)sv_2mortal(SvREFCNT_inc(SvRV(value)));
      lbp_budget(scope, 1 * sizeof(void *));
      /* Pin every field before a child converter can invoke Perl code. */
      SV *slot0 = lbp_field(aTHX_ input, "count", 5);
      lean_object * a0 = lb_read_bcb803bc837008bec599(aTHX_ scope, slot0);
      lean_inc(a0);
      return lbp_keep(scope, lb_t0ac37d04b2c3f2e53e25_make(a0));
}
static SV *lb_write_0ac37d04b2c3f2e53e25(pTHX_ lbp_scope *scope, lean_object * value) {

      lbp_budget(scope, 1 * sizeof(void *));
      HV *record = (HV *)sv_2mortal((SV *)newHV());
      lean_inc(value); lean_object * a0 = lb_t0ac37d04b2c3f2e53e25_get0(value);
      lbp_keep(scope, a0);
      hv_store(record, "count", 5, SvREFCNT_inc(lb_write_bcb803bc837008bec599(aTHX_ scope, a0)), 0);
      return sv_bless(lbp_mortal(newRV_inc((SV *)record)), gv_stashpv("LeanBridge::CheckedRecordValueIndices::EmptyToken", GV_ADD));
}

static lean_object * lb_read_a9c042e57916781102d9(pTHX_ lbp_scope *scope, SV *value) {

      SvGETMAGIC(value);
      if (!lbp_is_branch(value, "LeanBridge::CheckedRecordValueIndices::Off")) croak("expected LeanBridge::CheckedRecordValueIndices::Off with an exact class and plain untied hash");
      if (HvUSEDKEYS((HV *)SvRV(value)) != 1) croak("record fields do not match the generated schema");
      HV *input = (HV *)sv_2mortal(SvREFCNT_inc(SvRV(value)));
      lbp_budget(scope, 1 * sizeof(void *));
      /* Pin every field before a child converter can invoke Perl code. */
      SV *slot0 = lbp_field(aTHX_ input, "count", 5);
      lean_object * a0 = lb_read_bcb803bc837008bec599(aTHX_ scope, slot0);
      lean_inc(a0);
      return lbp_keep(scope, lb_ta9c042e57916781102d9_make(a0));
}
static SV *lb_write_a9c042e57916781102d9(pTHX_ lbp_scope *scope, lean_object * value) {

      lbp_budget(scope, 1 * sizeof(void *));
      HV *record = (HV *)sv_2mortal((SV *)newHV());
      lean_inc(value); lean_object * a0 = lb_ta9c042e57916781102d9_get0(value);
      lbp_keep(scope, a0);
      hv_store(record, "count", 5, SvREFCNT_inc(lb_write_bcb803bc837008bec599(aTHX_ scope, a0)), 0);
      return sv_bless(lbp_mortal(newRV_inc((SV *)record)), gv_stashpv("LeanBridge::CheckedRecordValueIndices::Off", GV_ADD));
}

static lean_object * lb_read_d74f96c3ad55654fb4e2(pTHX_ lbp_scope *scope, SV *value) {

      SvGETMAGIC(value);
      if (!lbp_is_branch(value, "LeanBridge::CheckedRecordValueIndices::On")) croak("expected LeanBridge::CheckedRecordValueIndices::On with an exact class and plain untied hash");
      if (HvUSEDKEYS((HV *)SvRV(value)) != 1) croak("record fields do not match the generated schema");
      HV *input = (HV *)sv_2mortal(SvREFCNT_inc(SvRV(value)));
      lbp_budget(scope, 1 * sizeof(void *));
      /* Pin every field before a child converter can invoke Perl code. */
      SV *slot0 = lbp_field(aTHX_ input, "count", 5);
      lean_object * a0 = lb_read_bcb803bc837008bec599(aTHX_ scope, slot0);
      lean_inc(a0);
      return lbp_keep(scope, lb_td74f96c3ad55654fb4e2_make(a0));
}
static SV *lb_write_d74f96c3ad55654fb4e2(pTHX_ lbp_scope *scope, lean_object * value) {

      lbp_budget(scope, 1 * sizeof(void *));
      HV *record = (HV *)sv_2mortal((SV *)newHV());
      lean_inc(value); lean_object * a0 = lb_td74f96c3ad55654fb4e2_get0(value);
      lbp_keep(scope, a0);
      hv_store(record, "count", 5, SvREFCNT_inc(lb_write_bcb803bc837008bec599(aTHX_ scope, a0)), 0);
      return sv_bless(lbp_mortal(newRV_inc((SV *)record)), gv_stashpv("LeanBridge::CheckedRecordValueIndices::On", GV_ADD));
}

static lean_object * lb_read_a8d5e8c0b6bc9e7e0253(pTHX_ lbp_scope *scope, SV *value) {

      SvGETMAGIC(value);
      if (!lbp_is_branch(value, "LeanBridge::CheckedRecordValueIndices::UnicodeToken")) croak("expected LeanBridge::CheckedRecordValueIndices::UnicodeToken with an exact class and plain untied hash");
      if (HvUSEDKEYS((HV *)SvRV(value)) != 1) croak("record fields do not match the generated schema");
      HV *input = (HV *)sv_2mortal(SvREFCNT_inc(SvRV(value)));
      lbp_budget(scope, 1 * sizeof(void *));
      /* Pin every field before a child converter can invoke Perl code. */
      SV *slot0 = lbp_field(aTHX_ input, "count", 5);
      lean_object * a0 = lb_read_bcb803bc837008bec599(aTHX_ scope, slot0);
      lean_inc(a0);
      return lbp_keep(scope, lb_ta8d5e8c0b6bc9e7e0253_make(a0));
}
static SV *lb_write_a8d5e8c0b6bc9e7e0253(pTHX_ lbp_scope *scope, lean_object * value) {

      lbp_budget(scope, 1 * sizeof(void *));
      HV *record = (HV *)sv_2mortal((SV *)newHV());
      lean_inc(value); lean_object * a0 = lb_ta8d5e8c0b6bc9e7e0253_get0(value);
      lbp_keep(scope, a0);
      hv_store(record, "count", 5, SvREFCNT_inc(lb_write_bcb803bc837008bec599(aTHX_ scope, a0)), 0);
      return sv_bless(lbp_mortal(newRV_inc((SV *)record)), gv_stashpv("LeanBridge::CheckedRecordValueIndices::UnicodeToken", GV_ADD));
}

static lean_object * lb_read_15b03e27f4c8772be0ea(pTHX_ lbp_scope *scope, SV *value) {

      SvGETMAGIC(value);
      if (!lbp_is_branch(value, "LeanBridge::CheckedRecordValueIndices::WideToken")) croak("expected LeanBridge::CheckedRecordValueIndices::WideToken with an exact class and plain untied hash");
      if (HvUSEDKEYS((HV *)SvRV(value)) != 1) croak("record fields do not match the generated schema");
      HV *input = (HV *)sv_2mortal(SvREFCNT_inc(SvRV(value)));
      lbp_budget(scope, 1 * sizeof(void *));
      /* Pin every field before a child converter can invoke Perl code. */
      SV *slot0 = lbp_field(aTHX_ input, "count", 5);
      lean_object * a0 = lb_read_bcb803bc837008bec599(aTHX_ scope, slot0);
      lean_inc(a0);
      return lbp_keep(scope, lb_t15b03e27f4c8772be0ea_make(a0));
}
static SV *lb_write_15b03e27f4c8772be0ea(pTHX_ lbp_scope *scope, lean_object * value) {

      lbp_budget(scope, 1 * sizeof(void *));
      HV *record = (HV *)sv_2mortal((SV *)newHV());
      lean_inc(value); lean_object * a0 = lb_t15b03e27f4c8772be0ea_get0(value);
      lbp_keep(scope, a0);
      hv_store(record, "count", 5, SvREFCNT_inc(lb_write_bcb803bc837008bec599(aTHX_ scope, a0)), 0);
      return sv_bless(lbp_mortal(newRV_inc((SV *)record)), gv_stashpv("LeanBridge::CheckedRecordValueIndices::WideToken", GV_ADD));
}

static lean_object * lb_read_cd43cc36cead5a0e3bc7(pTHX_ lbp_scope *scope, SV *value) {

      SvGETMAGIC(value);
      if (!lbp_is_branch(value, "LeanBridge::CheckedRecordValueIndices::ZeroToken")) croak("expected LeanBridge::CheckedRecordValueIndices::ZeroToken with an exact class and plain untied hash");
      if (HvUSEDKEYS((HV *)SvRV(value)) != 1) croak("record fields do not match the generated schema");
      HV *input = (HV *)sv_2mortal(SvREFCNT_inc(SvRV(value)));
      lbp_budget(scope, 1 * sizeof(void *));
      /* Pin every field before a child converter can invoke Perl code. */
      SV *slot0 = lbp_field(aTHX_ input, "count", 5);
      lean_object * a0 = lb_read_bcb803bc837008bec599(aTHX_ scope, slot0);
      lean_inc(a0);
      return lbp_keep(scope, lb_tcd43cc36cead5a0e3bc7_make(a0));
}
static SV *lb_write_cd43cc36cead5a0e3bc7(pTHX_ lbp_scope *scope, lean_object * value) {

      lbp_budget(scope, 1 * sizeof(void *));
      HV *record = (HV *)sv_2mortal((SV *)newHV());
      lean_inc(value); lean_object * a0 = lb_tcd43cc36cead5a0e3bc7_get0(value);
      lbp_keep(scope, a0);
      hv_store(record, "count", 5, SvREFCNT_inc(lb_write_bcb803bc837008bec599(aTHX_ scope, a0)), 0);
      return sv_bless(lbp_mortal(newRV_inc((SV *)record)), gv_stashpv("LeanBridge::CheckedRecordValueIndices::ZeroToken", GV_ADD));
}

MODULE = LeanBridge::CheckedRecordValueIndices    PACKAGE = LeanBridge::CheckedRecordValueIndices
PROTOTYPES: DISABLE


void
ab_string_index(...)
  PPCODE:
    if (items != 1) croak("ab_string_index expects 1 arguments");
    lbp_check_interpreter(aTHX);
    lbp_component_ready(aTHX);
    LBP_ENTER();
    lean_object * a0 = lb_read_e6e782ea1d9b18dc3e44(aTHX_ scope, ST(0));
    { lean_inc(a0); if (!lb_aa7389f0b324bcc872e58eb7_refinement_0(a0)) croak("%s", "value0 was rejected by CheckedRecordValueIndices.mkAb"); }
    lean_inc(a0);
    lean_object *checked = lb_aa7389f0b324bcc872e58eb7(a0);
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
empty_sized_index(...)
  PPCODE:
    if (items != 1) croak("empty_sized_index expects 1 arguments");
    lbp_check_interpreter(aTHX);
    lbp_component_ready(aTHX);
    LBP_ENTER();
    lean_object * a0 = lb_read_97a1bccb66cfd61c7d52(aTHX_ scope, ST(0));
    { lean_inc(a0); if (!lb_bc7bc77b17e26626a1e79470_refinement_0(a0)) croak("%s", "value0 was rejected by CheckedRecordValueIndices.mkEmptySized"); }
    lean_inc(a0);
    lean_object *checked = lb_bc7bc77b17e26626a1e79470(a0);
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
empty_string_index(...)
  PPCODE:
    if (items != 1) croak("empty_string_index expects 1 arguments");
    lbp_check_interpreter(aTHX);
    lbp_component_ready(aTHX);
    LBP_ENTER();
    lean_object * a0 = lb_read_0ac37d04b2c3f2e53e25(aTHX_ scope, ST(0));
    { lean_inc(a0); if (!lb_9317a25424a9625bb91b8651_refinement_0(a0)) croak("%s", "value0 was rejected by CheckedRecordValueIndices.mkEmptyToken"); }
    lean_inc(a0);
    lean_object *checked = lb_9317a25424a9625bb91b8651(a0);
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
false_bool_index(...)
  PPCODE:
    if (items != 1) croak("false_bool_index expects 1 arguments");
    lbp_check_interpreter(aTHX);
    lbp_component_ready(aTHX);
    LBP_ENTER();
    lean_object * a0 = lb_read_a9c042e57916781102d9(aTHX_ scope, ST(0));
    { lean_inc(a0); if (!lb_8171c54f4160a22ad89a1929_refinement_0(a0)) croak("%s", "value0 was rejected by CheckedRecordValueIndices.mkOff"); }
    lean_inc(a0);
    lean_object *checked = lb_8171c54f4160a22ad89a1929(a0);
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
produce_ab(...)
  PPCODE:
    if (items != 0) croak("produce_ab expects 0 arguments");
    lbp_check_interpreter(aTHX);
    lbp_component_ready(aTHX);
    LBP_ENTER();
    
    
    lean_object * result = lb_4d7bad0a7665bc1e177e4091(lean_box(0));
    lbp_keep(scope, result);
    lbp_finish(aTHX_ scope);
    lbp_component_ready(aTHX);
    SV *out = lb_write_e6e782ea1d9b18dc3e44(aTHX_ scope, result);
    lbp_component_ready(aTHX);
    SvREFCNT_inc(out);
    LBP_LEAVE();
    ST(0) = sv_2mortal(out);
    XSRETURN(1);


void
produce_empty_sized(...)
  PPCODE:
    if (items != 0) croak("produce_empty_sized expects 0 arguments");
    lbp_check_interpreter(aTHX);
    lbp_component_ready(aTHX);
    LBP_ENTER();
    
    
    lean_object * result = lb_2cb2ac73cad1bf0e92f223f2(lean_box(0));
    lbp_keep(scope, result);
    lbp_finish(aTHX_ scope);
    lbp_component_ready(aTHX);
    SV *out = lb_write_97a1bccb66cfd61c7d52(aTHX_ scope, result);
    lbp_component_ready(aTHX);
    SvREFCNT_inc(out);
    LBP_LEAVE();
    ST(0) = sv_2mortal(out);
    XSRETURN(1);


void
produce_empty_string(...)
  PPCODE:
    if (items != 1) croak("produce_empty_string expects 1 arguments");
    lbp_check_interpreter(aTHX);
    lbp_component_ready(aTHX);
    LBP_ENTER();
    lean_object * a0 = lb_read_bcb803bc837008bec599(aTHX_ scope, ST(0));
    lean_inc(a0);
    lean_object * result = lb_1c301039413f26b466ffc0ac(a0);
    lbp_keep(scope, result);
    lbp_finish(aTHX_ scope);
    lbp_component_ready(aTHX);
    SV *out = lb_write_0ac37d04b2c3f2e53e25(aTHX_ scope, result);
    lbp_component_ready(aTHX);
    SvREFCNT_inc(out);
    LBP_LEAVE();
    ST(0) = sv_2mortal(out);
    XSRETURN(1);


void
produce_false_bool(...)
  PPCODE:
    if (items != 0) croak("produce_false_bool expects 0 arguments");
    lbp_check_interpreter(aTHX);
    lbp_component_ready(aTHX);
    LBP_ENTER();
    
    
    lean_object * result = lb_4aa58b13819217d37533c8be(lean_box(0));
    lbp_keep(scope, result);
    lbp_finish(aTHX_ scope);
    lbp_component_ready(aTHX);
    SV *out = lb_write_a9c042e57916781102d9(aTHX_ scope, result);
    lbp_component_ready(aTHX);
    SvREFCNT_inc(out);
    LBP_LEAVE();
    ST(0) = sv_2mortal(out);
    XSRETURN(1);


void
produce_true_bool(...)
  PPCODE:
    if (items != 0) croak("produce_true_bool expects 0 arguments");
    lbp_check_interpreter(aTHX);
    lbp_component_ready(aTHX);
    LBP_ENTER();
    
    
    lean_object * result = lb_fa4a826e4cfc4b858bea336d(lean_box(0));
    lbp_keep(scope, result);
    lbp_finish(aTHX_ scope);
    lbp_component_ready(aTHX);
    SV *out = lb_write_d74f96c3ad55654fb4e2(aTHX_ scope, result);
    lbp_component_ready(aTHX);
    SvREFCNT_inc(out);
    LBP_LEAVE();
    ST(0) = sv_2mortal(out);
    XSRETURN(1);


void
produce_unicode_string(...)
  PPCODE:
    if (items != 1) croak("produce_unicode_string expects 1 arguments");
    lbp_check_interpreter(aTHX);
    lbp_component_ready(aTHX);
    LBP_ENTER();
    lean_object * a0 = lb_read_bcb803bc837008bec599(aTHX_ scope, ST(0));
    lean_inc(a0);
    lean_object * result = lb_c3c99619aef987f5fd710b1d(a0);
    lbp_keep(scope, result);
    lbp_finish(aTHX_ scope);
    lbp_component_ready(aTHX);
    SV *out = lb_write_a8d5e8c0b6bc9e7e0253(aTHX_ scope, result);
    lbp_component_ready(aTHX);
    SvREFCNT_inc(out);
    LBP_LEAVE();
    ST(0) = sv_2mortal(out);
    XSRETURN(1);


void
produce_wide_nat(...)
  PPCODE:
    if (items != 1) croak("produce_wide_nat expects 1 arguments");
    lbp_check_interpreter(aTHX);
    lbp_component_ready(aTHX);
    LBP_ENTER();
    lean_object * a0 = lb_read_bcb803bc837008bec599(aTHX_ scope, ST(0));
    lean_inc(a0);
    lean_object * result = lb_ee4a5ad2bcd3cf6bb8065218(a0);
    lbp_keep(scope, result);
    lbp_finish(aTHX_ scope);
    lbp_component_ready(aTHX);
    SV *out = lb_write_15b03e27f4c8772be0ea(aTHX_ scope, result);
    lbp_component_ready(aTHX);
    SvREFCNT_inc(out);
    LBP_LEAVE();
    ST(0) = sv_2mortal(out);
    XSRETURN(1);


void
produce_zero_nat(...)
  PPCODE:
    if (items != 1) croak("produce_zero_nat expects 1 arguments");
    lbp_check_interpreter(aTHX);
    lbp_component_ready(aTHX);
    LBP_ENTER();
    lean_object * a0 = lb_read_bcb803bc837008bec599(aTHX_ scope, ST(0));
    lean_inc(a0);
    lean_object * result = lb_de7d470e18379efff61de31b(a0);
    lbp_keep(scope, result);
    lbp_finish(aTHX_ scope);
    lbp_component_ready(aTHX);
    SV *out = lb_write_cd43cc36cead5a0e3bc7(aTHX_ scope, result);
    lbp_component_ready(aTHX);
    SvREFCNT_inc(out);
    LBP_LEAVE();
    ST(0) = sv_2mortal(out);
    XSRETURN(1);


void
true_bool_index(...)
  PPCODE:
    if (items != 1) croak("true_bool_index expects 1 arguments");
    lbp_check_interpreter(aTHX);
    lbp_component_ready(aTHX);
    LBP_ENTER();
    lean_object * a0 = lb_read_d74f96c3ad55654fb4e2(aTHX_ scope, ST(0));
    { lean_inc(a0); if (!lb_d1b030ebab8bb6628451db44_refinement_0(a0)) croak("%s", "value0 was rejected by CheckedRecordValueIndices.mkOn"); }
    lean_inc(a0);
    lean_object *checked = lb_d1b030ebab8bb6628451db44(a0);
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
unicode_string_index(...)
  PPCODE:
    if (items != 1) croak("unicode_string_index expects 1 arguments");
    lbp_check_interpreter(aTHX);
    lbp_component_ready(aTHX);
    LBP_ENTER();
    lean_object * a0 = lb_read_a8d5e8c0b6bc9e7e0253(aTHX_ scope, ST(0));
    { lean_inc(a0); if (!lb_35b0d02ac4b5686e440a8198_refinement_0(a0)) croak("%s", "value0 was rejected by CheckedRecordValueIndices.mkUnicodeToken"); }
    lean_inc(a0);
    lean_object *checked = lb_35b0d02ac4b5686e440a8198(a0);
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
wide_nat_index(...)
  PPCODE:
    if (items != 1) croak("wide_nat_index expects 1 arguments");
    lbp_check_interpreter(aTHX);
    lbp_component_ready(aTHX);
    LBP_ENTER();
    lean_object * a0 = lb_read_15b03e27f4c8772be0ea(aTHX_ scope, ST(0));
    { lean_inc(a0); if (!lb_629d14b28988602cba2f4f16_refinement_0(a0)) croak("%s", "value0 was rejected by CheckedRecordValueIndices.mkWideToken"); }
    lean_inc(a0);
    lean_object *checked = lb_629d14b28988602cba2f4f16(a0);
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
zero_nat_index(...)
  PPCODE:
    if (items != 1) croak("zero_nat_index expects 1 arguments");
    lbp_check_interpreter(aTHX);
    lbp_component_ready(aTHX);
    LBP_ENTER();
    lean_object * a0 = lb_read_cd43cc36cead5a0e3bc7(aTHX_ scope, ST(0));
    { lean_inc(a0); if (!lb_2ddd8644625ba5d077273f54_refinement_0(a0)) croak("%s", "value0 was rejected by CheckedRecordValueIndices.mkZeroToken"); }
    lean_inc(a0);
    lean_object *checked = lb_2ddd8644625ba5d077273f54(a0);
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
  extern lean_object *initialize_LeanBridgeNative767c615eabad08d7(uint8_t);
  if (!lean_bridge_native_component_initialize("checkedrecordvalueindices@1.0.0:39941bbf2ec5f61793b17581a6f4e1e79725ec63f2fd2a6d5a5cbfa7274ae1e6", (lean_bridge_native_initializer)initialize_LeanBridgeNative767c615eabad08d7)) croak("Lean component initialization failed");

