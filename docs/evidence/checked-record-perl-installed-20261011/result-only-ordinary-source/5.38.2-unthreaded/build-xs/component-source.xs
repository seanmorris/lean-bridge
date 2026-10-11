#include "runtime.h"
#include "component.h"
static void lbp_component_ready(pTHX) {
  if (!lean_bridge_native_component_ready("checkedrecords@1.0.0:829ac10b0035ddbb640abc91d4e3679c83efdb1b64275fb551fd0baacff99844")) croak("Lean runtime is not ready or has been retired");
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

MODULE = LeanBridge::CheckedRecords    PACKAGE = LeanBridge::CheckedRecords
PROTOTYPES: DISABLE


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

BOOT:
  lbp_check_interpreter(aTHX);
  extern lean_object *initialize_LeanBridgeNatived3803aad486f3d2e(uint8_t);
  if (!lean_bridge_native_component_initialize("checkedrecords@1.0.0:829ac10b0035ddbb640abc91d4e3679c83efdb1b64275fb551fd0baacff99844", (lean_bridge_native_initializer)initialize_LeanBridgeNatived3803aad486f3d2e)) croak("Lean component initialization failed");

