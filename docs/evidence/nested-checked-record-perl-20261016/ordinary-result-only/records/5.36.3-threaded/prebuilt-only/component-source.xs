#include "runtime.h"
#include "component.h"
static void lbp_component_ready(pTHX) {
  if (!lean_bridge_native_component_ready("nestedcheckedrecords@1.0.0:960bf714f5e9633c5e75df7692c33af63e6d467f8e1f9d63d0d1fef300596de8")) croak("Lean runtime is not ready or has been retired");
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

static lean_object * lb_read_f35e9094c144406778d4(pTHX_ lbp_scope *scope, SV *value) {

      SvGETMAGIC(value);
      if (!lbp_is_branch(value, "LeanBridge::NestedCheckedRecords::Packet")) croak("expected LeanBridge::NestedCheckedRecords::Packet with an exact class and plain untied hash");
      if (HvUSEDKEYS((HV *)SvRV(value)) != 2) croak("record fields do not match the generated schema");
      HV *input = (HV *)sv_2mortal(SvREFCNT_inc(SvRV(value)));
      lbp_budget(scope, 2 * sizeof(void *));
      /* Pin every field before a child converter can invoke Perl code. */
      SV *slot0 = lbp_field(aTHX_ input, "digit", 5);
      SV *slot1 = lbp_field(aTHX_ input, "word", 4);
      lean_object * a0 = lb_read_bcb803bc837008bec599(aTHX_ scope, slot0);
      lean_object * a1 = lb_read_bcb803bc837008bec599(aTHX_ scope, slot1);
      lean_inc(a0); lean_inc(a1);
      return lbp_keep(scope, lb_tf35e9094c144406778d4_make(a0, a1));
}
static SV *lb_write_f35e9094c144406778d4(pTHX_ lbp_scope *scope, lean_object * value) {

      lbp_budget(scope, 2 * sizeof(void *));
      HV *record = (HV *)sv_2mortal((SV *)newHV());
      lean_inc(value); lean_object * a0 = lb_tf35e9094c144406778d4_get0(value);
      lbp_keep(scope, a0);
      hv_store(record, "digit", 5, SvREFCNT_inc(lb_write_bcb803bc837008bec599(aTHX_ scope, a0)), 0);
      lean_inc(value); lean_object * a1 = lb_tf35e9094c144406778d4_get1(value);
      lbp_keep(scope, a1);
      hv_store(record, "word", 4, SvREFCNT_inc(lb_write_bcb803bc837008bec599(aTHX_ scope, a1)), 0);
      return sv_bless(lbp_mortal(newRV_inc((SV *)record)), gv_stashpv("LeanBridge::NestedCheckedRecords::Packet", GV_ADD));
}

static lean_object * lb_read_f9fa36ebcbdcb704f2ee(pTHX_ lbp_scope *scope, SV *value) {

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
        lean_object * item = lb_read_f35e9094c144406778d4(aTHX_ scope, sv_2mortal(SvREFCNT_inc(*entry)));
        lean_array_set_core(result, i, (lean_inc(item), item));
      }
      return result;
}
static SV *lb_write_f9fa36ebcbdcb704f2ee(pTHX_ lbp_scope *scope, lean_object * value) {

      
      size_t length = lean_array_size(value);
      if (length > 16 * 1024 * 1024 / sizeof(void *)) croak("native copied array exceeds the 16 MiB per-call limit");
      lbp_budget(scope, length * sizeof(void *));
      AV *array = (AV *)sv_2mortal((SV *)newAV());
      for (size_t i = 0; i < length; ++i) {
        SV *item = lb_write_f35e9094c144406778d4(aTHX_ scope, lean_array_get_core(value, i));
        av_push(array, SvREFCNT_inc(item));
      }
      return lbp_mortal(newRV_inc((SV *)array));
}

static lean_object * lb_read_fbdb0eed1b69f3acda27(pTHX_ lbp_scope *scope, SV *value) {

      SvGETMAGIC(value); lbp_budget(scope, sizeof(void *));
      if (!SvOK(value)) return lbp_keep(scope, lb_tfbdb0eed1b69f3acda27_none(lean_box(0)));
      if (lbp_is_branch(value, "LeanBridge::NestedCheckedRecords::Some")) {
        lean_object * item = lb_read_f35e9094c144406778d4(aTHX_ scope, lbp_branch_value(aTHX_ value, "LeanBridge::NestedCheckedRecords::Some"));
        lean_inc(item);
        return lbp_keep(scope, lb_tfbdb0eed1b69f3acda27_some(item));
      }
      croak("Option requires undef or the generated Some class");
}
static SV *lb_write_fbdb0eed1b69f3acda27(pTHX_ lbp_scope *scope, lean_object * value) {

      lbp_budget(scope, sizeof(void *));
      lean_inc(value); uint8_t present = lb_tfbdb0eed1b69f3acda27_has(value);
      if (!present) return lbp_mortal(newSV(0));
       {
        lean_inc(value); lean_object * item = lb_tfbdb0eed1b69f3acda27_get0(value);
        lbp_keep(scope, item);
        return lbp_branch(aTHX_ "LeanBridge::NestedCheckedRecords::Some", lb_write_f35e9094c144406778d4(aTHX_ scope, item));
      }
}

MODULE = LeanBridge::NestedCheckedRecords    PACKAGE = LeanBridge::NestedCheckedRecords
PROTOTYPES: DISABLE


void
produce_array(...)
  PPCODE:
    if (items != 1) croak("produce_array expects 1 arguments");
    lbp_check_interpreter(aTHX);
    lbp_component_ready(aTHX);
    LBP_ENTER();
    lean_object * a0 = lb_read_bcb803bc837008bec599(aTHX_ scope, ST(0));
    lean_inc(a0);
    lean_object * result = lb_a27e360b7c6440a8dc40dc87(a0);
    lbp_keep(scope, result);
    lbp_finish(aTHX_ scope);
    lbp_component_ready(aTHX);
    SV *out = lb_write_f9fa36ebcbdcb704f2ee(aTHX_ scope, result);
    lbp_component_ready(aTHX);
    SvREFCNT_inc(out);
    LBP_LEAVE();
    ST(0) = sv_2mortal(out);
    XSRETURN(1);


void
produce_option(...)
  PPCODE:
    if (items != 1) croak("produce_option expects 1 arguments");
    lbp_check_interpreter(aTHX);
    lbp_component_ready(aTHX);
    LBP_ENTER();
    lean_object * a0 = lb_read_bcb803bc837008bec599(aTHX_ scope, ST(0));
    lean_inc(a0);
    lean_object * result = lb_85f9f487f03e070ff66bb271(a0);
    lbp_keep(scope, result);
    lbp_finish(aTHX_ scope);
    lbp_component_ready(aTHX);
    SV *out = lb_write_fbdb0eed1b69f3acda27(aTHX_ scope, result);
    lbp_component_ready(aTHX);
    SvREFCNT_inc(out);
    LBP_LEAVE();
    ST(0) = sv_2mortal(out);
    XSRETURN(1);

BOOT:
  lbp_check_interpreter(aTHX);
  extern lean_object *initialize_LeanBridgeNativea63244d529ededa0(uint8_t);
  if (!lean_bridge_native_component_initialize("nestedcheckedrecords@1.0.0:960bf714f5e9633c5e75df7692c33af63e6d467f8e1f9d63d0d1fef300596de8", (lean_bridge_native_initializer)initialize_LeanBridgeNativea63244d529ededa0)) croak("Lean component initialization failed");

