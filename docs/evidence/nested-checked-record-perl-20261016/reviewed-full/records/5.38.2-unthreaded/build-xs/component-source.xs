#include "runtime.h"
#include "component.h"
static void lbp_component_ready(pTHX) {
  if (!lean_bridge_native_component_ready("nestedcheckedrecords@1.0.0:7a51096a6523a1acdba21e0b16615f76a47e84003762cc1c967948248cbd09f4")) croak("Lean runtime is not ready or has been retired");
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

static lean_object * lb_read_cddeeeaf929e6028ab58(pTHX_ lbp_scope *scope, SV *value) {

      SvGETMAGIC(value);
      if (lbp_is_branch(value, "LeanBridge::NestedCheckedRecords::Choice::Empty")) {
        HV *input = (HV *)sv_2mortal(SvREFCNT_inc(SvRV(value)));
        if (HvUSEDKEYS(input) != 0) croak("constructor fields do not match the generated schema");
        lbp_budget(scope, 1 * sizeof(void *));
        /* Pin all fields before a child converter can invoke Perl code. */


        
        return lbp_keep(scope, lb_tcddeeeaf929e6028ab58_make0(lean_box(0)));
      }
      if (lbp_is_branch(value, "LeanBridge::NestedCheckedRecords::Choice::Packet")) {
        HV *input = (HV *)sv_2mortal(SvREFCNT_inc(SvRV(value)));
        if (HvUSEDKEYS(input) != 1) croak("constructor fields do not match the generated schema");
        lbp_budget(scope, 2 * sizeof(void *));
        /* Pin all fields before a child converter can invoke Perl code. */
        SV *slot0 = lbp_field(aTHX_ input, "value", 5);
        lean_object * a0 = lb_read_f35e9094c144406778d4(aTHX_ scope, slot0);
        lean_inc(a0);
        return lbp_keep(scope, lb_tcddeeeaf929e6028ab58_make1(a0));
      }
      croak("expected an exact LeanBridge::NestedCheckedRecords::Choice constructor with a plain untied hash");
}
static SV *lb_write_cddeeeaf929e6028ab58(pTHX_ lbp_scope *scope, lean_object * value) {

      lean_inc(value); uint32_t tag = lb_tcddeeeaf929e6028ab58_tag(value);
      switch (tag) {
      case 0: {
        lbp_budget(scope, 1 * sizeof(void *));
        HV *output = (HV *)sv_2mortal((SV *)newHV());

        return sv_bless(lbp_mortal(newRV_inc((SV *)output)), gv_stashpv("LeanBridge::NestedCheckedRecords::Choice::Empty", GV_ADD));
      }
      case 1: {
        lbp_budget(scope, 2 * sizeof(void *));
        HV *output = (HV *)sv_2mortal((SV *)newHV());
        lean_inc(value); lean_object * a0 = lb_tcddeeeaf929e6028ab58_get1_0(value);
        lbp_keep(scope, a0);
        hv_store(output, "value", 5, SvREFCNT_inc(lb_write_f35e9094c144406778d4(aTHX_ scope, a0)), 0);
        return sv_bless(lbp_mortal(newRV_inc((SV *)output)), gv_stashpv("LeanBridge::NestedCheckedRecords::Choice::Packet", GV_ADD));
      }
      default: croak("Invalid native LeanBridge::NestedCheckedRecords::Choice constructor");
      }
}

static lean_object * lb_read_14d9022f57e0ccd06f81(pTHX_ lbp_scope *scope, SV *value) {

      SvGETMAGIC(value); lbp_budget(scope, sizeof(void *));
      
      if (lbp_is_branch(value, "LeanBridge::NestedCheckedRecords::Ok")) {
        lean_object * item = lb_read_f35e9094c144406778d4(aTHX_ scope, lbp_branch_value(aTHX_ value, "LeanBridge::NestedCheckedRecords::Ok"));
        lean_inc(item);
        return lbp_keep(scope, lb_t14d9022f57e0ccd06f81_ok(item));
      }
      if (lbp_is_branch(value, "LeanBridge::NestedCheckedRecords::Err")) {
        lean_object * item = lb_read_f35e9094c144406778d4(aTHX_ scope, lbp_branch_value(aTHX_ value, "LeanBridge::NestedCheckedRecords::Err"));
        lean_inc(item);
        return lbp_keep(scope, lb_t14d9022f57e0ccd06f81_error(item));
      }
      croak("Except requires the generated Ok or Err class");
}
static SV *lb_write_14d9022f57e0ccd06f81(pTHX_ lbp_scope *scope, lean_object * value) {

      lbp_budget(scope, sizeof(void *));
      lean_inc(value); uint8_t present = lb_t14d9022f57e0ccd06f81_has(value);
      
      if (present) {
        lean_inc(value); lean_object * item = lb_t14d9022f57e0ccd06f81_get0(value);
        lbp_keep(scope, item);
        return lbp_branch(aTHX_ "LeanBridge::NestedCheckedRecords::Ok", lb_write_f35e9094c144406778d4(aTHX_ scope, item));
      }
      else {
        lean_inc(value); lean_object * item = lb_t14d9022f57e0ccd06f81_get1(value);
        lbp_keep(scope, item);
        return lbp_branch(aTHX_ "LeanBridge::NestedCheckedRecords::Err", lb_write_f35e9094c144406778d4(aTHX_ scope, item));
      }
}

static lean_object * lb_read_cd336fb36ba39028fc07(pTHX_ lbp_scope *scope, SV *value) {

      SvGETMAGIC(value);
      if (!lbp_is_branch(value, "LeanBridge::NestedCheckedRecords::Holder")) croak("expected LeanBridge::NestedCheckedRecords::Holder with an exact class and plain untied hash");
      if (HvUSEDKEYS((HV *)SvRV(value)) != 2) croak("record fields do not match the generated schema");
      HV *input = (HV *)sv_2mortal(SvREFCNT_inc(SvRV(value)));
      lbp_budget(scope, 2 * sizeof(void *));
      /* Pin every field before a child converter can invoke Perl code. */
      SV *slot0 = lbp_field(aTHX_ input, "packet", 6);
      SV *slot1 = lbp_field(aTHX_ input, "tag", 3);
      lean_object * a0 = lb_read_f35e9094c144406778d4(aTHX_ scope, slot0);
      lean_object * a1 = lb_read_bcb803bc837008bec599(aTHX_ scope, slot1);
      lean_inc(a0); lean_inc(a1);
      return lbp_keep(scope, lb_tcd336fb36ba39028fc07_make(a0, a1));
}
static SV *lb_write_cd336fb36ba39028fc07(pTHX_ lbp_scope *scope, lean_object * value) {

      lbp_budget(scope, 2 * sizeof(void *));
      HV *record = (HV *)sv_2mortal((SV *)newHV());
      lean_inc(value); lean_object * a0 = lb_tcd336fb36ba39028fc07_get0(value);
      lbp_keep(scope, a0);
      hv_store(record, "packet", 6, SvREFCNT_inc(lb_write_f35e9094c144406778d4(aTHX_ scope, a0)), 0);
      lean_inc(value); lean_object * a1 = lb_tcd336fb36ba39028fc07_get1(value);
      lbp_keep(scope, a1);
      hv_store(record, "tag", 3, SvREFCNT_inc(lb_write_bcb803bc837008bec599(aTHX_ scope, a1)), 0);
      return sv_bless(lbp_mortal(newRV_inc((SV *)record)), gv_stashpv("LeanBridge::NestedCheckedRecords::Holder", GV_ADD));
}

static lean_object * lb_read_60a009a91931a5562832(pTHX_ lbp_scope *scope, SV *value) {

      SvGETMAGIC(value);
      if (!SvROK(value) || SvTYPE(SvRV(value)) != SVt_PVAV || SvOBJECT(SvRV(value)) || (SvMAGICAL(SvRV(value)) && mg_find(SvRV(value), PERL_MAGIC_tied))) croak("List requires a plain array reference");
      AV *array = (AV *)sv_2mortal(SvREFCNT_inc(SvRV(value))); size_t length = av_count(array);
      if (length > 16 * 1024 * 1024 / sizeof(void *)) croak("native copied array exceeds the 16 MiB per-call limit");
      lbp_budget(scope, length * sizeof(void *));
      /* Pin the sequence before an element converter can invoke Perl code. */
      AV *slots = (AV *)sv_2mortal((SV *)newAV());
      if (length) av_extend(slots, length - 1);
      for (size_t i = 0; i < length; ++i) {
        SV **entry = av_fetch(array, i, 0); if (!entry) croak("sparse Perl Lists are unsupported");
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
      lean_inc(result); return lbp_keep(scope, lb_t60a009a91931a5562832_from_array(result));
}
static SV *lb_write_60a009a91931a5562832(pTHX_ lbp_scope *scope, lean_object * value) {

      lean_inc(value); value = lbp_keep(scope, lb_t60a009a91931a5562832_to_array(value));
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

static lean_object * lb_read_ae5b2d5f055eddb8c5fc(pTHX_ lbp_scope *scope, SV *value) {

      SvGETMAGIC(value);
      if (!SvROK(value) || SvTYPE(SvRV(value)) != SVt_PVAV || SvOBJECT(SvRV(value)) || SvMAGICAL(SvRV(value))) croak("Prod requires a plain two-element array reference");
      AV *input = (AV *)sv_2mortal(SvREFCNT_inc(SvRV(value)));
      if (av_count(input) != 2) croak("Prod requires exactly two elements");
      lbp_budget(scope, 2 * sizeof(void *));
      /* Pin both slots before a child converter can invoke Perl code. */
      SV **entry0 = av_fetch(input, 0, 0); if (!entry0) croak("sparse Perl products are unsupported");
      SV *slot0 = sv_2mortal(SvREFCNT_inc(*entry0));
      SV **entry1 = av_fetch(input, 1, 0); if (!entry1) croak("sparse Perl products are unsupported");
      SV *slot1 = sv_2mortal(SvREFCNT_inc(*entry1));
      lean_object * a0 = lb_read_f35e9094c144406778d4(aTHX_ scope, slot0);
      lean_object * a1 = lb_read_f35e9094c144406778d4(aTHX_ scope, slot1);
      lean_inc(a0); lean_inc(a1);
      return lbp_keep(scope, lb_tae5b2d5f055eddb8c5fc_make(a0, a1));
}
static SV *lb_write_ae5b2d5f055eddb8c5fc(pTHX_ lbp_scope *scope, lean_object * value) {

      lbp_budget(scope, 2 * sizeof(void *));
      AV *output = (AV *)sv_2mortal((SV *)newAV());
      lean_inc(value); lean_object * a0 = lb_tae5b2d5f055eddb8c5fc_get0(value);
      lbp_keep(scope, a0);
      av_push(output, SvREFCNT_inc(lb_write_f35e9094c144406778d4(aTHX_ scope, a0)));
      lean_inc(value); lean_object * a1 = lb_tae5b2d5f055eddb8c5fc_get1(value);
      lbp_keep(scope, a1);
      av_push(output, SvREFCNT_inc(lb_write_f35e9094c144406778d4(aTHX_ scope, a1)));
      return lbp_mortal(newRV_inc((SV *)output));
}

MODULE = LeanBridge::NestedCheckedRecords    PACKAGE = LeanBridge::NestedCheckedRecords
PROTOTYPES: DISABLE


void
echo_array(...)
  PPCODE:
    if (items != 1) croak("echo_array expects 1 arguments");
    lbp_check_interpreter(aTHX);
    lbp_component_ready(aTHX);
    LBP_ENTER();
    lean_object * a0 = lb_read_f9fa36ebcbdcb704f2ee(aTHX_ scope, ST(0));
    { 
      for (size_t k0 = 0; k0 < lean_array_size(a0); ++k0) { lean_object *e0 = lean_array_get_core(a0, k0);
      { lean_inc(e0); lean_object *v1_0 = lbp_keep(scope, lb_tf35e9094c144406778d4_get0(e0));
      { lean_object *bound = lean_cstr_to_nat("10"); int below = lean_nat_lt(v1_0, bound); lean_dec(bound);
      if (!below) croak("%s[%zu].digit is not below its Fin 10 bound", "value0", (size_t)k0); } } } }
    { 
      for (size_t k0 = 0; k0 < lean_array_size(a0); ++k0) { lean_object *e0 = lean_array_get_core(a0, k0);
      { lean_inc(e0); lean_object * v1_1 = lbp_keep(scope, lb_tf35e9094c144406778d4_get1(e0));
      lean_inc(v1_1); if (!lb_736e6e42272689e8602e2ea4_refinement_0_0_1(v1_1)) croak("%s[%zu].word was rejected by NestedCheckedRecords.mkWord", "value0", (size_t)k0);
      lean_inc(e0); if (!lb_736e6e42272689e8602e2ea4_refinement_0_0(e0)) croak("%s[%zu] was rejected by NestedCheckedRecords.mkPacket", "value0", (size_t)k0); } } }
    lean_inc(a0);
    lean_object *checked = lb_736e6e42272689e8602e2ea4(a0);
    if (lean_is_scalar(checked)) croak("Lean rejected an argument outside its checked refinement");
    lean_object *boxed = lean_ctor_get(checked, 0);
    lean_inc(boxed);
    lean_object * result = boxed;
    lean_dec(checked);
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
first(...)
  PPCODE:
    if (items != 1) croak("first expects 1 arguments");
    lbp_check_interpreter(aTHX);
    lbp_component_ready(aTHX);
    LBP_ENTER();
    lean_object * a0 = lb_read_f35e9094c144406778d4(aTHX_ scope, ST(0));
    { lean_inc(a0); lean_object *v0_0 = lbp_keep(scope, lb_tf35e9094c144406778d4_get0(a0));
      { lean_object *bound = lean_cstr_to_nat("10"); int below = lean_nat_lt(v0_0, bound); lean_dec(bound);
      if (!below) croak("%s.digit is not below its Fin 10 bound", "value0"); } }
    { lean_inc(a0); lean_object * v0_1 = lbp_keep(scope, lb_tf35e9094c144406778d4_get1(a0));
      lean_inc(v0_1); if (!lb_5958d1767f4416b0c44cb0c8_refinement_0_1(v0_1)) croak("%s.word was rejected by NestedCheckedRecords.mkWord", "value0");
      lean_inc(a0); if (!lb_5958d1767f4416b0c44cb0c8_refinement_0(a0)) croak("%s", "value0 was rejected by NestedCheckedRecords.mkPacket"); }
    lean_inc(a0);
    lean_object *checked = lb_5958d1767f4416b0c44cb0c8(a0);
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
in_array(...)
  PPCODE:
    if (items != 1) croak("in_array expects 1 arguments");
    lbp_check_interpreter(aTHX);
    lbp_component_ready(aTHX);
    LBP_ENTER();
    lean_object * a0 = lb_read_f9fa36ebcbdcb704f2ee(aTHX_ scope, ST(0));
    { 
      for (size_t k0 = 0; k0 < lean_array_size(a0); ++k0) { lean_object *e0 = lean_array_get_core(a0, k0);
      { lean_inc(e0); lean_object *v1_0 = lbp_keep(scope, lb_tf35e9094c144406778d4_get0(e0));
      { lean_object *bound = lean_cstr_to_nat("10"); int below = lean_nat_lt(v1_0, bound); lean_dec(bound);
      if (!below) croak("%s[%zu].digit is not below its Fin 10 bound", "value0", (size_t)k0); } } } }
    { 
      for (size_t k0 = 0; k0 < lean_array_size(a0); ++k0) { lean_object *e0 = lean_array_get_core(a0, k0);
      { lean_inc(e0); lean_object * v1_1 = lbp_keep(scope, lb_tf35e9094c144406778d4_get1(e0));
      lean_inc(v1_1); if (!lb_901886a48c494a07f1221bd4_refinement_0_0_1(v1_1)) croak("%s[%zu].word was rejected by NestedCheckedRecords.mkWord", "value0", (size_t)k0);
      lean_inc(e0); if (!lb_901886a48c494a07f1221bd4_refinement_0_0(e0)) croak("%s[%zu] was rejected by NestedCheckedRecords.mkPacket", "value0", (size_t)k0); } } }
    lean_inc(a0);
    lean_object *checked = lb_901886a48c494a07f1221bd4(a0);
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
in_choice(...)
  PPCODE:
    if (items != 1) croak("in_choice expects 1 arguments");
    lbp_check_interpreter(aTHX);
    lbp_component_ready(aTHX);
    LBP_ENTER();
    lean_object * a0 = lb_read_cddeeeaf929e6028ab58(aTHX_ scope, ST(0));
    { lean_inc(a0); uint32_t t0 = lb_tcddeeeaf929e6028ab58_tag(a0);
      if (t0 == 1u) { lean_inc(a0); lean_object *v0_0 = lbp_keep(scope, lb_tcddeeeaf929e6028ab58_get1_0(a0));
      { lean_inc(v0_0); lean_object *v1_0 = lbp_keep(scope, lb_tf35e9094c144406778d4_get0(v0_0));
      { lean_object *bound = lean_cstr_to_nat("10"); int below = lean_nat_lt(v1_0, bound); lean_dec(bound);
      if (!below) croak("%s.packet.value.digit is not below its Fin 10 bound", "value0"); } } } }
    { lean_inc(a0); uint32_t t0 = lb_tcddeeeaf929e6028ab58_tag(a0);
      if (t0 == 1u) { lean_inc(a0); lean_object * v0_1_0 = lbp_keep(scope, lb_tcddeeeaf929e6028ab58_get1_0(a0));
      { lean_inc(v0_1_0); lean_object * v1_1 = lbp_keep(scope, lb_tf35e9094c144406778d4_get1(v0_1_0));
      lean_inc(v1_1); if (!lb_747af41a1169d20ede396a7c_refinement_0_1_0_1(v1_1)) croak("%s.packet.value.word was rejected by NestedCheckedRecords.normalizeWord", "value0");
      lean_inc(v0_1_0); if (!lb_747af41a1169d20ede396a7c_refinement_0_1_0(v0_1_0)) croak("%s.packet.value was rejected by NestedCheckedRecords.mkPacket", "value0"); } } }
    lean_inc(a0);
    lean_object *checked = lb_747af41a1169d20ede396a7c(a0);
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
in_except(...)
  PPCODE:
    if (items != 1) croak("in_except expects 1 arguments");
    lbp_check_interpreter(aTHX);
    lbp_component_ready(aTHX);
    LBP_ENTER();
    lean_object * a0 = lb_read_14d9022f57e0ccd06f81(aTHX_ scope, ST(0));
    { lean_inc(a0); if (lb_t14d9022f57e0ccd06f81_has(a0)) { lean_inc(a0); lean_object *v0 = lbp_keep(scope, lb_t14d9022f57e0ccd06f81_get0(a0));
      { lean_inc(v0); lean_object *v1_0 = lbp_keep(scope, lb_tf35e9094c144406778d4_get0(v0));
      { lean_object *bound = lean_cstr_to_nat("10"); int below = lean_nat_lt(v1_0, bound); lean_dec(bound);
      if (!below) croak("%s.ok.digit is not below its Fin 10 bound", "value0"); } } } else { lean_inc(a0); lean_object *v0 = lbp_keep(scope, lb_t14d9022f57e0ccd06f81_get1(a0));
      { lean_inc(v0); lean_object *v1_0 = lbp_keep(scope, lb_tf35e9094c144406778d4_get0(v0));
      { lean_object *bound = lean_cstr_to_nat("10"); int below = lean_nat_lt(v1_0, bound); lean_dec(bound);
      if (!below) croak("%s.error.digit is not below its Fin 10 bound", "value0"); } } } }
    { lean_inc(a0); if (lb_t14d9022f57e0ccd06f81_has(a0)) { lean_inc(a0); lean_object * v0_0 = lbp_keep(scope, lb_t14d9022f57e0ccd06f81_get0(a0));
      { lean_inc(v0_0); lean_object * v1_1 = lbp_keep(scope, lb_tf35e9094c144406778d4_get1(v0_0));
      lean_inc(v1_1); if (!lb_5c47339f5c461dfb7aca7095_refinement_0_0_1(v1_1)) croak("%s.ok.word was rejected by NestedCheckedRecords.mkWord", "value0");
      lean_inc(v0_0); if (!lb_5c47339f5c461dfb7aca7095_refinement_0_0(v0_0)) croak("%s.ok was rejected by NestedCheckedRecords.normalizePacket", "value0"); } } else { lean_inc(a0); lean_object * v0_1 = lbp_keep(scope, lb_t14d9022f57e0ccd06f81_get1(a0));
      { lean_inc(v0_1); lean_object * v1_1 = lbp_keep(scope, lb_tf35e9094c144406778d4_get1(v0_1));
      lean_inc(v1_1); if (!lb_5c47339f5c461dfb7aca7095_refinement_0_1_1(v1_1)) croak("%s.error.word was rejected by NestedCheckedRecords.normalizeWord", "value0");
      lean_inc(v0_1); if (!lb_5c47339f5c461dfb7aca7095_refinement_0_1(v0_1)) croak("%s.error was rejected by NestedCheckedRecords.mkPacket", "value0"); } } }
    lean_inc(a0);
    lean_object *checked = lb_5c47339f5c461dfb7aca7095(a0);
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
in_holder(...)
  PPCODE:
    if (items != 1) croak("in_holder expects 1 arguments");
    lbp_check_interpreter(aTHX);
    lbp_component_ready(aTHX);
    LBP_ENTER();
    lean_object * a0 = lb_read_cd336fb36ba39028fc07(aTHX_ scope, ST(0));
    { lean_inc(a0); lean_object *v0_0 = lbp_keep(scope, lb_tcd336fb36ba39028fc07_get0(a0));
      { lean_inc(v0_0); lean_object *v1_0 = lbp_keep(scope, lb_tf35e9094c144406778d4_get0(v0_0));
      { lean_object *bound = lean_cstr_to_nat("10"); int below = lean_nat_lt(v1_0, bound); lean_dec(bound);
      if (!below) croak("%s.packet.digit is not below its Fin 10 bound", "value0"); } } }
    { lean_inc(a0); lean_object * v0_0 = lbp_keep(scope, lb_tcd336fb36ba39028fc07_get0(a0));
      { lean_inc(v0_0); lean_object * v1_1 = lbp_keep(scope, lb_tf35e9094c144406778d4_get1(v0_0));
      lean_inc(v1_1); if (!lb_83154aa7144b6a3870db30d4_refinement_0_0_1(v1_1)) croak("%s.packet.word was rejected by NestedCheckedRecords.mkWord", "value0");
      lean_inc(v0_0); if (!lb_83154aa7144b6a3870db30d4_refinement_0_0(v0_0)) croak("%s.packet was rejected by NestedCheckedRecords.normalizePacket", "value0"); } }
    lean_inc(a0);
    lean_object *checked = lb_83154aa7144b6a3870db30d4(a0);
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
in_list(...)
  PPCODE:
    if (items != 1) croak("in_list expects 1 arguments");
    lbp_check_interpreter(aTHX);
    lbp_component_ready(aTHX);
    LBP_ENTER();
    lean_object * a0 = lb_read_60a009a91931a5562832(aTHX_ scope, ST(0));
    { lean_inc(a0); lean_object *items0 = lbp_keep(scope, lb_t60a009a91931a5562832_to_array(a0));
      for (size_t k0 = 0; k0 < lean_array_size(items0); ++k0) { lean_object *e0 = lean_array_get_core(items0, k0);
      { lean_inc(e0); lean_object *v1_0 = lbp_keep(scope, lb_tf35e9094c144406778d4_get0(e0));
      { lean_object *bound = lean_cstr_to_nat("10"); int below = lean_nat_lt(v1_0, bound); lean_dec(bound);
      if (!below) croak("%s[%zu].digit is not below its Fin 10 bound", "value0", (size_t)k0); } } } }
    { lean_inc(a0); lean_object *items0 = lbp_keep(scope, lb_t60a009a91931a5562832_to_array(a0));
      for (size_t k0 = 0; k0 < lean_array_size(items0); ++k0) { lean_object *e0 = lean_array_get_core(items0, k0);
      { lean_inc(e0); lean_object * v1_1 = lbp_keep(scope, lb_tf35e9094c144406778d4_get1(e0));
      lean_inc(v1_1); if (!lb_db4d19a4e1cc947e70cd771a_refinement_0_0_1(v1_1)) croak("%s[%zu].word was rejected by NestedCheckedRecords.normalizeWord", "value0", (size_t)k0);
      lean_inc(e0); if (!lb_db4d19a4e1cc947e70cd771a_refinement_0_0(e0)) croak("%s[%zu] was rejected by NestedCheckedRecords.normalizePacket", "value0", (size_t)k0); } } }
    lean_inc(a0);
    lean_object *checked = lb_db4d19a4e1cc947e70cd771a(a0);
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
in_option(...)
  PPCODE:
    if (items != 1) croak("in_option expects 1 arguments");
    lbp_check_interpreter(aTHX);
    lbp_component_ready(aTHX);
    LBP_ENTER();
    lean_object * a0 = lb_read_fbdb0eed1b69f3acda27(aTHX_ scope, ST(0));
    { lean_inc(a0); if (lb_tfbdb0eed1b69f3acda27_has(a0)) { lean_inc(a0); lean_object *v0 = lbp_keep(scope, lb_tfbdb0eed1b69f3acda27_get0(a0));
      { lean_inc(v0); lean_object *v1_0 = lbp_keep(scope, lb_tf35e9094c144406778d4_get0(v0));
      { lean_object *bound = lean_cstr_to_nat("10"); int below = lean_nat_lt(v1_0, bound); lean_dec(bound);
      if (!below) croak("%s?.digit is not below its Fin 10 bound", "value0"); } } } }
    { lean_inc(a0); if (lb_tfbdb0eed1b69f3acda27_has(a0)) { lean_inc(a0); lean_object * v0_0 = lbp_keep(scope, lb_tfbdb0eed1b69f3acda27_get0(a0));
      { lean_inc(v0_0); lean_object * v1_1 = lbp_keep(scope, lb_tf35e9094c144406778d4_get1(v0_0));
      lean_inc(v1_1); if (!lb_132bf2f486b40fdf10a35ddf_refinement_0_0_1(v1_1)) croak("%s?.word was rejected by NestedCheckedRecords.normalizeWord", "value0");
      lean_inc(v0_0); if (!lb_132bf2f486b40fdf10a35ddf_refinement_0_0(v0_0)) croak("%s? was rejected by NestedCheckedRecords.mkPacket", "value0"); } } }
    lean_inc(a0);
    lean_object *checked = lb_132bf2f486b40fdf10a35ddf(a0);
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
in_product(...)
  PPCODE:
    if (items != 1) croak("in_product expects 1 arguments");
    lbp_check_interpreter(aTHX);
    lbp_component_ready(aTHX);
    LBP_ENTER();
    lean_object * a0 = lb_read_ae5b2d5f055eddb8c5fc(aTHX_ scope, ST(0));
    { lean_inc(a0); lean_object *v0_0 = lbp_keep(scope, lb_tae5b2d5f055eddb8c5fc_get0(a0));
      { lean_inc(v0_0); lean_object *v1_0 = lbp_keep(scope, lb_tf35e9094c144406778d4_get0(v0_0));
      { lean_object *bound = lean_cstr_to_nat("10"); int below = lean_nat_lt(v1_0, bound); lean_dec(bound);
      if (!below) croak("%s.0.digit is not below its Fin 10 bound", "value0"); } }
      lean_inc(a0); lean_object *v0_1 = lbp_keep(scope, lb_tae5b2d5f055eddb8c5fc_get1(a0));
      { lean_inc(v0_1); lean_object *v1_0 = lbp_keep(scope, lb_tf35e9094c144406778d4_get0(v0_1));
      { lean_object *bound = lean_cstr_to_nat("10"); int below = lean_nat_lt(v1_0, bound); lean_dec(bound);
      if (!below) croak("%s.1.digit is not below its Fin 10 bound", "value0"); } } }
    { lean_inc(a0); lean_object * v0_0 = lbp_keep(scope, lb_tae5b2d5f055eddb8c5fc_get0(a0));
      { lean_inc(v0_0); lean_object * v1_1 = lbp_keep(scope, lb_tf35e9094c144406778d4_get1(v0_0));
      lean_inc(v1_1); if (!lb_15be5b0eae9d80d6eda2e863_refinement_0_0_1(v1_1)) croak("%s.0.word was rejected by NestedCheckedRecords.mkWord", "value0");
      lean_inc(v0_0); if (!lb_15be5b0eae9d80d6eda2e863_refinement_0_0(v0_0)) croak("%s.0 was rejected by NestedCheckedRecords.mkPacket", "value0"); }
      lean_inc(a0); lean_object * v0_1 = lbp_keep(scope, lb_tae5b2d5f055eddb8c5fc_get1(a0));
      { lean_inc(v0_1); lean_object * v1_1 = lbp_keep(scope, lb_tf35e9094c144406778d4_get1(v0_1));
      lean_inc(v1_1); if (!lb_15be5b0eae9d80d6eda2e863_refinement_0_1_1(v1_1)) croak("%s.1.word was rejected by NestedCheckedRecords.normalizeWord", "value0");
      lean_inc(v0_1); if (!lb_15be5b0eae9d80d6eda2e863_refinement_0_1(v0_1)) croak("%s.1 was rejected by NestedCheckedRecords.normalizePacket", "value0"); } }
    lean_inc(a0);
    lean_object *checked = lb_15be5b0eae9d80d6eda2e863(a0);
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
    lean_object * a0 = lb_read_f35e9094c144406778d4(aTHX_ scope, ST(0));
    lean_object * a1 = lb_read_f35e9094c144406778d4(aTHX_ scope, ST(1));
    { lean_inc(a0); lean_object *v0_0 = lbp_keep(scope, lb_tf35e9094c144406778d4_get0(a0));
      { lean_object *bound = lean_cstr_to_nat("10"); int below = lean_nat_lt(v0_0, bound); lean_dec(bound);
      if (!below) croak("%s.digit is not below its Fin 10 bound", "value0"); } }
    { lean_inc(a1); lean_object *v0_0 = lbp_keep(scope, lb_tf35e9094c144406778d4_get0(a1));
      { lean_object *bound = lean_cstr_to_nat("10"); int below = lean_nat_lt(v0_0, bound); lean_dec(bound);
      if (!below) croak("%s.digit is not below its Fin 10 bound", "value1"); } }
    { lean_inc(a0); lean_object * v0_1 = lbp_keep(scope, lb_tf35e9094c144406778d4_get1(a0));
      lean_inc(v0_1); if (!lb_057b765fe3895fbd2312f96f_refinement_0_1(v0_1)) croak("%s.word was rejected by NestedCheckedRecords.mkWord", "value0");
      lean_inc(a0); if (!lb_057b765fe3895fbd2312f96f_refinement_0(a0)) croak("%s", "value0 was rejected by NestedCheckedRecords.mkPacket"); }
    { lean_inc(a1); lean_object * v0_1 = lbp_keep(scope, lb_tf35e9094c144406778d4_get1(a1));
      lean_inc(v0_1); if (!lb_057b765fe3895fbd2312f96f_refinement_1_1(v0_1)) croak("%s.word was rejected by NestedCheckedRecords.normalizeWord", "value1");
      lean_inc(a1); if (!lb_057b765fe3895fbd2312f96f_refinement_1(a1)) croak("%s", "value1 was rejected by NestedCheckedRecords.normalizePacket"); }
    lean_inc(a0); lean_inc(a1);
    lean_object *checked = lb_057b765fe3895fbd2312f96f(a0, a1);
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


void
second(...)
  PPCODE:
    if (items != 1) croak("second expects 1 arguments");
    lbp_check_interpreter(aTHX);
    lbp_component_ready(aTHX);
    LBP_ENTER();
    lean_object * a0 = lb_read_f35e9094c144406778d4(aTHX_ scope, ST(0));
    { lean_inc(a0); lean_object *v0_0 = lbp_keep(scope, lb_tf35e9094c144406778d4_get0(a0));
      { lean_object *bound = lean_cstr_to_nat("10"); int below = lean_nat_lt(v0_0, bound); lean_dec(bound);
      if (!below) croak("%s.digit is not below its Fin 10 bound", "value0"); } }
    { lean_inc(a0); lean_object * v0_1 = lbp_keep(scope, lb_tf35e9094c144406778d4_get1(a0));
      lean_inc(v0_1); if (!lb_93083abb1dedb8e0ff0743dc_refinement_0_1(v0_1)) croak("%s.word was rejected by NestedCheckedRecords.normalizeWord", "value0");
      lean_inc(a0); if (!lb_93083abb1dedb8e0ff0743dc_refinement_0(a0)) croak("%s", "value0 was rejected by NestedCheckedRecords.normalizePacket"); }
    lean_inc(a0);
    lean_object *checked = lb_93083abb1dedb8e0ff0743dc(a0);
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
  extern lean_object *initialize_LeanBridgeNativea63244d529ededa0(uint8_t);
  if (!lean_bridge_native_component_initialize("nestedcheckedrecords@1.0.0:7a51096a6523a1acdba21e0b16615f76a47e84003762cc1c967948248cbd09f4", (lean_bridge_native_initializer)initialize_LeanBridgeNativea63244d529ededa0)) croak("Lean component initialization failed");

