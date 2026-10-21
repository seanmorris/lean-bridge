#include "runtime.h"
#include "component.h"
static void lbp_component_ready(pTHX) {
  if (!lean_bridge_native_component_ready("zeropayloadcheckedrecords@1.0.0:5a457d3be3c5d97ca78f9df38fa8517cde29f729d11cd058043d02c1ff1f26c6")) croak("Lean runtime is not ready or has been retired");
}

static uint8_t lb_read_4c1bd7bbac2488b31e7f(pTHX_ lbp_scope *scope, SV *value) {
lbp_plain(aTHX_ value); if (!SvIsBOOL(value)) croak("Bool requires true() or false()"); return SvTRUE(value) ? 1 : 0;
}
static SV *lb_write_4c1bd7bbac2488b31e7f(pTHX_ lbp_scope *scope, uint8_t value) {
return lbp_mortal(newSVsv(boolSV(value != 0)));
}

static lean_object * lb_read_34d3e5dc58186a7e28fe(pTHX_ lbp_scope *scope, SV *value) {

      SvGETMAGIC(value);
      if (!lbp_is_branch(value, "LeanBridge::ZeroPayloadCheckedRecords::Witness")) croak("expected LeanBridge::ZeroPayloadCheckedRecords::Witness with an exact class and plain untied hash");
      if (HvUSEDKEYS((HV *)SvRV(value)) != 0) croak("record fields do not match the generated schema");
      HV *input = (HV *)sv_2mortal(SvREFCNT_inc(SvRV(value)));
      lbp_budget(scope, 0 * sizeof(void *));
      /* Pin every field before a child converter can invoke Perl code. */
      
      
      
      return lbp_keep(scope, lb_t34d3e5dc58186a7e28fe_make(lean_box(0)));
}
static SV *lb_write_34d3e5dc58186a7e28fe(pTHX_ lbp_scope *scope, lean_object * value) {

      lbp_budget(scope, 0 * sizeof(void *));
      HV *record = (HV *)sv_2mortal((SV *)newHV());
      
      return sv_bless(lbp_mortal(newRV_inc((SV *)record)), gv_stashpv("LeanBridge::ZeroPayloadCheckedRecords::Witness", GV_ADD));
}

static lean_object * lb_read_69a9586cb343e910790a(pTHX_ lbp_scope *scope, SV *value) {

      SvGETMAGIC(value); lbp_budget(scope, sizeof(void *));
      if (!SvOK(value)) return lbp_keep(scope, lb_t69a9586cb343e910790a_none(lean_box(0)));
      if (lbp_is_branch(value, "LeanBridge::ZeroPayloadCheckedRecords::Some")) {
        lean_object * item = lb_read_34d3e5dc58186a7e28fe(aTHX_ scope, lbp_branch_value(aTHX_ value, "LeanBridge::ZeroPayloadCheckedRecords::Some"));
        lean_inc(item);
        return lbp_keep(scope, lb_t69a9586cb343e910790a_some(item));
      }
      croak("Option requires undef or the generated Some class");
}
static SV *lb_write_69a9586cb343e910790a(pTHX_ lbp_scope *scope, lean_object * value) {

      lbp_budget(scope, sizeof(void *));
      lean_inc(value); uint8_t present = lb_t69a9586cb343e910790a_has(value);
      if (!present) return lbp_mortal(newSV(0));
       {
        lean_inc(value); lean_object * item = lb_t69a9586cb343e910790a_get0(value);
        lbp_keep(scope, item);
        return lbp_branch(aTHX_ "LeanBridge::ZeroPayloadCheckedRecords::Some", lb_write_34d3e5dc58186a7e28fe(aTHX_ scope, item));
      }
}

static lean_object * lb_read_fb04270e7e168afb2516(pTHX_ lbp_scope *scope, SV *value) {

      SvGETMAGIC(value);
      if (lbp_is_branch(value, "LeanBridge::ZeroPayloadCheckedRecords::Mark::Blank")) {
        HV *input = (HV *)sv_2mortal(SvREFCNT_inc(SvRV(value)));
        if (HvUSEDKEYS(input) != 0) croak("constructor fields do not match the generated schema");
        lbp_budget(scope, 1 * sizeof(void *));
        /* Pin all fields before a child converter can invoke Perl code. */


        
        return lbp_keep(scope, lb_tfb04270e7e168afb2516_make0(lean_box(0)));
      }
      if (lbp_is_branch(value, "LeanBridge::ZeroPayloadCheckedRecords::Mark::Marked")) {
        HV *input = (HV *)sv_2mortal(SvREFCNT_inc(SvRV(value)));
        if (HvUSEDKEYS(input) != 1) croak("constructor fields do not match the generated schema");
        lbp_budget(scope, 2 * sizeof(void *));
        /* Pin all fields before a child converter can invoke Perl code. */
        SV *slot0 = lbp_field(aTHX_ input, "witness", 7);
        lean_object * a0 = lb_read_34d3e5dc58186a7e28fe(aTHX_ scope, slot0);
        lean_inc(a0);
        return lbp_keep(scope, lb_tfb04270e7e168afb2516_make1(a0));
      }
      croak("expected an exact LeanBridge::ZeroPayloadCheckedRecords::Mark constructor with a plain untied hash");
}
static SV *lb_write_fb04270e7e168afb2516(pTHX_ lbp_scope *scope, lean_object * value) {

      lean_inc(value); uint32_t tag = lb_tfb04270e7e168afb2516_tag(value);
      switch (tag) {
      case 0: {
        lbp_budget(scope, 1 * sizeof(void *));
        HV *output = (HV *)sv_2mortal((SV *)newHV());

        return sv_bless(lbp_mortal(newRV_inc((SV *)output)), gv_stashpv("LeanBridge::ZeroPayloadCheckedRecords::Mark::Blank", GV_ADD));
      }
      case 1: {
        lbp_budget(scope, 2 * sizeof(void *));
        HV *output = (HV *)sv_2mortal((SV *)newHV());
        lean_inc(value); lean_object * a0 = lb_tfb04270e7e168afb2516_get1_0(value);
        lbp_keep(scope, a0);
        hv_store(output, "witness", 7, SvREFCNT_inc(lb_write_34d3e5dc58186a7e28fe(aTHX_ scope, a0)), 0);
        return sv_bless(lbp_mortal(newRV_inc((SV *)output)), gv_stashpv("LeanBridge::ZeroPayloadCheckedRecords::Mark::Marked", GV_ADD));
      }
      default: croak("Invalid native LeanBridge::ZeroPayloadCheckedRecords::Mark constructor");
      }
}

static lean_object * lb_read_c0930e24985d380f1be0(pTHX_ lbp_scope *scope, SV *value) {

      SvGETMAGIC(value);
      if (!lbp_is_branch(value, "LeanBridge::ZeroPayloadCheckedRecords::Marker")) croak("expected LeanBridge::ZeroPayloadCheckedRecords::Marker with an exact class and plain untied hash");
      if (HvUSEDKEYS((HV *)SvRV(value)) != 0) croak("record fields do not match the generated schema");
      HV *input = (HV *)sv_2mortal(SvREFCNT_inc(SvRV(value)));
      lbp_budget(scope, 0 * sizeof(void *));
      /* Pin every field before a child converter can invoke Perl code. */
      
      
      
      return lbp_keep(scope, lb_tc0930e24985d380f1be0_make(lean_box(0)));
}
static SV *lb_write_c0930e24985d380f1be0(pTHX_ lbp_scope *scope, lean_object * value) {

      lbp_budget(scope, 0 * sizeof(void *));
      HV *record = (HV *)sv_2mortal((SV *)newHV());
      
      return sv_bless(lbp_mortal(newRV_inc((SV *)record)), gv_stashpv("LeanBridge::ZeroPayloadCheckedRecords::Marker", GV_ADD));
}

static lean_object * lb_read_c6349afd7d22f2e92812(pTHX_ lbp_scope *scope, SV *value) {
lbp_plain(aTHX_ value); if (SvOK(value)) croak("Unit requires undef"); return lean_box(0);
}
static SV *lb_write_c6349afd7d22f2e92812(pTHX_ lbp_scope *scope, lean_object * value) {
return lbp_mortal(newSV(0));
}

static lean_object * lb_read_57b6486affb0e5f49fdf(pTHX_ lbp_scope *scope, SV *value) {

      SvGETMAGIC(value);
      if (!lbp_is_branch(value, "LeanBridge::ZeroPayloadCheckedRecords::Token")) croak("expected LeanBridge::ZeroPayloadCheckedRecords::Token with an exact class and plain untied hash");
      if (HvUSEDKEYS((HV *)SvRV(value)) != 1) croak("record fields do not match the generated schema");
      HV *input = (HV *)sv_2mortal(SvREFCNT_inc(SvRV(value)));
      lbp_budget(scope, 1 * sizeof(void *));
      /* Pin every field before a child converter can invoke Perl code. */
      SV *slot0 = lbp_field(aTHX_ input, "tag", 3);
      lean_object * a0 = lb_read_c6349afd7d22f2e92812(aTHX_ scope, slot0);
      lean_inc(a0);
      return lbp_keep(scope, lb_t57b6486affb0e5f49fdf_make(a0));
}
static SV *lb_write_57b6486affb0e5f49fdf(pTHX_ lbp_scope *scope, lean_object * value) {

      lbp_budget(scope, 1 * sizeof(void *));
      HV *record = (HV *)sv_2mortal((SV *)newHV());
      lean_inc(value); lean_object * a0 = lb_t57b6486affb0e5f49fdf_get0(value);
      lbp_keep(scope, a0);
      hv_store(record, "tag", 3, SvREFCNT_inc(lb_write_c6349afd7d22f2e92812(aTHX_ scope, a0)), 0);
      return sv_bless(lbp_mortal(newRV_inc((SV *)record)), gv_stashpv("LeanBridge::ZeroPayloadCheckedRecords::Token", GV_ADD));
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

static lean_object * lb_read_2d5a3c90d023dde89ed1(pTHX_ lbp_scope *scope, SV *value) {

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
        lean_object * item = lb_read_34d3e5dc58186a7e28fe(aTHX_ scope, sv_2mortal(SvREFCNT_inc(*entry)));
        lean_array_set_core(result, i, (lean_inc(item), item));
      }
      return result;
}
static SV *lb_write_2d5a3c90d023dde89ed1(pTHX_ lbp_scope *scope, lean_object * value) {

      
      size_t length = lean_array_size(value);
      if (length > 16 * 1024 * 1024 / sizeof(void *)) croak("native copied array exceeds the 16 MiB per-call limit");
      lbp_budget(scope, length * sizeof(void *));
      AV *array = (AV *)sv_2mortal((SV *)newAV());
      for (size_t i = 0; i < length; ++i) {
        SV *item = lb_write_34d3e5dc58186a7e28fe(aTHX_ scope, lean_array_get_core(value, i));
        av_push(array, SvREFCNT_inc(item));
      }
      return lbp_mortal(newRV_inc((SV *)array));
}

MODULE = LeanBridge::ZeroPayloadCheckedRecords    PACKAGE = LeanBridge::ZeroPayloadCheckedRecords
PROTOTYPES: DISABLE


void
maybe_witness(...)
  PPCODE:
    if (items != 1) croak("maybe_witness expects 1 arguments");
    lbp_check_interpreter(aTHX);
    lbp_component_ready(aTHX);
    LBP_ENTER();
    uint8_t a0 = lb_read_4c1bd7bbac2488b31e7f(aTHX_ scope, ST(0));
    
    lean_object * result = lb_cde1a97bb44e62e5508a2ab3(a0);
    lbp_keep(scope, result);
    lbp_finish(aTHX_ scope);
    lbp_component_ready(aTHX);
    SV *out = lb_write_69a9586cb343e910790a(aTHX_ scope, result);
    lbp_component_ready(aTHX);
    SvREFCNT_inc(out);
    LBP_LEAVE();
    ST(0) = sv_2mortal(out);
    XSRETURN(1);


void
produce_mark(...)
  PPCODE:
    if (items != 1) croak("produce_mark expects 1 arguments");
    lbp_check_interpreter(aTHX);
    lbp_component_ready(aTHX);
    LBP_ENTER();
    uint8_t a0 = lb_read_4c1bd7bbac2488b31e7f(aTHX_ scope, ST(0));
    
    lean_object * result = lb_3190b0fd601d06277d65cc15(a0);
    lbp_keep(scope, result);
    lbp_finish(aTHX_ scope);
    lbp_component_ready(aTHX);
    SV *out = lb_write_fb04270e7e168afb2516(aTHX_ scope, result);
    lbp_component_ready(aTHX);
    SvREFCNT_inc(out);
    LBP_LEAVE();
    ST(0) = sv_2mortal(out);
    XSRETURN(1);


void
produce_marker(...)
  PPCODE:
    if (items != 0) croak("produce_marker expects 0 arguments");
    lbp_check_interpreter(aTHX);
    lbp_component_ready(aTHX);
    LBP_ENTER();
    
    
    lean_object * result = lb_53d00d3f28c820ff014ddaab(lean_box(0));
    lbp_keep(scope, result);
    lbp_finish(aTHX_ scope);
    lbp_component_ready(aTHX);
    SV *out = lb_write_c0930e24985d380f1be0(aTHX_ scope, result);
    lbp_component_ready(aTHX);
    SvREFCNT_inc(out);
    LBP_LEAVE();
    ST(0) = sv_2mortal(out);
    XSRETURN(1);


void
produce_token(...)
  PPCODE:
    if (items != 0) croak("produce_token expects 0 arguments");
    lbp_check_interpreter(aTHX);
    lbp_component_ready(aTHX);
    LBP_ENTER();
    
    
    lean_object * result = lb_582f4605f271fe1a26173078(lean_box(0));
    lbp_keep(scope, result);
    lbp_finish(aTHX_ scope);
    lbp_component_ready(aTHX);
    SV *out = lb_write_57b6486affb0e5f49fdf(aTHX_ scope, result);
    lbp_component_ready(aTHX);
    SvREFCNT_inc(out);
    LBP_LEAVE();
    ST(0) = sv_2mortal(out);
    XSRETURN(1);


void
produce_witness(...)
  PPCODE:
    if (items != 0) croak("produce_witness expects 0 arguments");
    lbp_check_interpreter(aTHX);
    lbp_component_ready(aTHX);
    LBP_ENTER();
    
    
    lean_object * result = lb_e28f59b3ac170ab2f8d671cf(lean_box(0));
    lbp_keep(scope, result);
    lbp_finish(aTHX_ scope);
    lbp_component_ready(aTHX);
    SV *out = lb_write_34d3e5dc58186a7e28fe(aTHX_ scope, result);
    lbp_component_ready(aTHX);
    SvREFCNT_inc(out);
    LBP_LEAVE();
    ST(0) = sv_2mortal(out);
    XSRETURN(1);


void
witnesses(...)
  PPCODE:
    if (items != 1) croak("witnesses expects 1 arguments");
    lbp_check_interpreter(aTHX);
    lbp_component_ready(aTHX);
    LBP_ENTER();
    lean_object * a0 = lb_read_bcb803bc837008bec599(aTHX_ scope, ST(0));
    lean_inc(a0);
    lean_object * result = lb_77f288f49ad4518952eca999(a0);
    lbp_keep(scope, result);
    lbp_finish(aTHX_ scope);
    lbp_component_ready(aTHX);
    SV *out = lb_write_2d5a3c90d023dde89ed1(aTHX_ scope, result);
    lbp_component_ready(aTHX);
    SvREFCNT_inc(out);
    LBP_LEAVE();
    ST(0) = sv_2mortal(out);
    XSRETURN(1);

BOOT:
  lbp_check_interpreter(aTHX);
  extern lean_object *initialize_LeanBridgeNatived43d7c5a9f170f3c(uint8_t);
  if (!lean_bridge_native_component_initialize("zeropayloadcheckedrecords@1.0.0:5a457d3be3c5d97ca78f9df38fa8517cde29f729d11cd058043d02c1ff1f26c6", (lean_bridge_native_initializer)initialize_LeanBridgeNatived43d7c5a9f170f3c)) croak("Lean component initialization failed");

