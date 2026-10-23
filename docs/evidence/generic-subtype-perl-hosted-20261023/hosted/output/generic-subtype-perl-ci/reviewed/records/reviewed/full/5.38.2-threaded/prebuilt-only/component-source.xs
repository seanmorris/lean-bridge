#include "runtime.h"
#include "component.h"
static void lbp_component_ready(pTHX) {
  if (!lean_bridge_native_component_ready("nominalsubtypes@1.0.0:44fcf2e793c07c8171ed24f610f8e187c314cb85aca66387ee1222228af1890a")) croak("Lean runtime is not ready or has been retired");
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

static lean_object * lb_read_90fc0814fb0968a90151(pTHX_ lbp_scope *scope, SV *value) {

      SvGETMAGIC(value);
      if (!lbp_is_branch(value, "LeanBridge::NominalSubtypes::Envelope")) croak("expected LeanBridge::NominalSubtypes::Envelope with an exact class and plain untied hash");
      if (HvUSEDKEYS((HV *)SvRV(value)) != 2) croak("record fields do not match the generated schema");
      HV *input = (HV *)sv_2mortal(SvREFCNT_inc(SvRV(value)));
      lbp_budget(scope, 2 * sizeof(void *));
      /* Pin every field before a child converter can invoke Perl code. */
      SV *slot0 = lbp_field(aTHX_ input, "payload", 7);
      SV *slot1 = lbp_field(aTHX_ input, "digit", 5);
      lean_object * a0 = lb_read_bcb803bc837008bec599(aTHX_ scope, slot0);
      lean_object * a1 = lb_read_bcb803bc837008bec599(aTHX_ scope, slot1);
      lean_inc(a0); lean_inc(a1);
      return lbp_keep(scope, lb_t90fc0814fb0968a90151_make(a0, a1));
}
static SV *lb_write_90fc0814fb0968a90151(pTHX_ lbp_scope *scope, lean_object * value) {

      lbp_budget(scope, 2 * sizeof(void *));
      HV *record = (HV *)sv_2mortal((SV *)newHV());
      lean_inc(value); lean_object * a0 = lb_t90fc0814fb0968a90151_get0(value);
      lbp_keep(scope, a0);
      hv_store(record, "payload", 7, SvREFCNT_inc(lb_write_bcb803bc837008bec599(aTHX_ scope, a0)), 0);
      lean_inc(value); lean_object * a1 = lb_t90fc0814fb0968a90151_get1(value);
      lbp_keep(scope, a1);
      hv_store(record, "digit", 5, SvREFCNT_inc(lb_write_bcb803bc837008bec599(aTHX_ scope, a1)), 0);
      return sv_bless(lbp_mortal(newRV_inc((SV *)record)), gv_stashpv("LeanBridge::NominalSubtypes::Envelope", GV_ADD));
}

static lean_object * lb_read_2d856855000adeb791a2(pTHX_ lbp_scope *scope, SV *value) {

      SvGETMAGIC(value); lbp_budget(scope, sizeof(void *));
      if (!SvOK(value)) return lbp_keep(scope, lb_t2d856855000adeb791a2_none(lean_box(0)));
      if (lbp_is_branch(value, "LeanBridge::NominalSubtypes::Some")) {
        lean_object * item = lb_read_90fc0814fb0968a90151(aTHX_ scope, lbp_branch_value(aTHX_ value, "LeanBridge::NominalSubtypes::Some"));
        lean_inc(item);
        return lbp_keep(scope, lb_t2d856855000adeb791a2_some(item));
      }
      croak("Option requires undef or the generated Some class");
}
static SV *lb_write_2d856855000adeb791a2(pTHX_ lbp_scope *scope, lean_object * value) {

      lbp_budget(scope, sizeof(void *));
      lean_inc(value); uint8_t present = lb_t2d856855000adeb791a2_has(value);
      if (!present) return lbp_mortal(newSV(0));
       {
        lean_inc(value); lean_object * item = lb_t2d856855000adeb791a2_get0(value);
        lbp_keep(scope, item);
        return lbp_branch(aTHX_ "LeanBridge::NominalSubtypes::Some", lb_write_90fc0814fb0968a90151(aTHX_ scope, item));
      }
}

static lean_object * lb_read_ee6de6093191ad29d958(pTHX_ lbp_scope *scope, SV *value) {

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
        lean_object * item = lb_read_2d856855000adeb791a2(aTHX_ scope, sv_2mortal(SvREFCNT_inc(*entry)));
        lean_array_set_core(result, i, (lean_inc(item), item));
      }
      return result;
}
static SV *lb_write_ee6de6093191ad29d958(pTHX_ lbp_scope *scope, lean_object * value) {

      
      size_t length = lean_array_size(value);
      if (length > 16 * 1024 * 1024 / sizeof(void *)) croak("native copied array exceeds the 16 MiB per-call limit");
      lbp_budget(scope, length * sizeof(void *));
      AV *array = (AV *)sv_2mortal((SV *)newAV());
      for (size_t i = 0; i < length; ++i) {
        SV *item = lb_write_2d856855000adeb791a2(aTHX_ scope, lean_array_get_core(value, i));
        av_push(array, SvREFCNT_inc(item));
      }
      return lbp_mortal(newRV_inc((SV *)array));
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

static lean_object * lb_read_a95d99ff5a42e8c098e6(pTHX_ lbp_scope *scope, SV *value) {

      SvGETMAGIC(value); lbp_budget(scope, sizeof(void *));
      
      if (lbp_is_branch(value, "LeanBridge::NominalSubtypes::Ok")) {
        lean_object * item = lb_read_bcb803bc837008bec599(aTHX_ scope, lbp_branch_value(aTHX_ value, "LeanBridge::NominalSubtypes::Ok"));
        lean_inc(item);
        return lbp_keep(scope, lb_ta95d99ff5a42e8c098e6_ok(item));
      }
      if (lbp_is_branch(value, "LeanBridge::NominalSubtypes::Err")) {
        lean_object * item = lb_read_bcb803bc837008bec599(aTHX_ scope, lbp_branch_value(aTHX_ value, "LeanBridge::NominalSubtypes::Err"));
        lean_inc(item);
        return lbp_keep(scope, lb_ta95d99ff5a42e8c098e6_error(item));
      }
      croak("Except requires the generated Ok or Err class");
}
static SV *lb_write_a95d99ff5a42e8c098e6(pTHX_ lbp_scope *scope, lean_object * value) {

      lbp_budget(scope, sizeof(void *));
      lean_inc(value); uint8_t present = lb_ta95d99ff5a42e8c098e6_has(value);
      
      if (present) {
        lean_inc(value); lean_object * item = lb_ta95d99ff5a42e8c098e6_get0(value);
        lbp_keep(scope, item);
        return lbp_branch(aTHX_ "LeanBridge::NominalSubtypes::Ok", lb_write_bcb803bc837008bec599(aTHX_ scope, item));
      }
      else {
        lean_inc(value); lean_object * item = lb_ta95d99ff5a42e8c098e6_get1(value);
        lbp_keep(scope, item);
        return lbp_branch(aTHX_ "LeanBridge::NominalSubtypes::Err", lb_write_bcb803bc837008bec599(aTHX_ scope, item));
      }
}

static lean_object * lb_read_c7aa542980540fb600fa(pTHX_ lbp_scope *scope, SV *value) {

      SvGETMAGIC(value); lbp_budget(scope, sizeof(void *));
      if (!SvOK(value)) return lbp_keep(scope, lb_tc7aa542980540fb600fa_none(lean_box(0)));
      if (lbp_is_branch(value, "LeanBridge::NominalSubtypes::Some")) {
        lean_object * item = lb_read_a95d99ff5a42e8c098e6(aTHX_ scope, lbp_branch_value(aTHX_ value, "LeanBridge::NominalSubtypes::Some"));
        lean_inc(item);
        return lbp_keep(scope, lb_tc7aa542980540fb600fa_some(item));
      }
      croak("Option requires undef or the generated Some class");
}
static SV *lb_write_c7aa542980540fb600fa(pTHX_ lbp_scope *scope, lean_object * value) {

      lbp_budget(scope, sizeof(void *));
      lean_inc(value); uint8_t present = lb_tc7aa542980540fb600fa_has(value);
      if (!present) return lbp_mortal(newSV(0));
       {
        lean_inc(value); lean_object * item = lb_tc7aa542980540fb600fa_get0(value);
        lbp_keep(scope, item);
        return lbp_branch(aTHX_ "LeanBridge::NominalSubtypes::Some", lb_write_a95d99ff5a42e8c098e6(aTHX_ scope, item));
      }
}

static lean_object * lb_read_fc91b61a7de753b73407(pTHX_ lbp_scope *scope, SV *value) {

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
        lean_object * item = lb_read_c7aa542980540fb600fa(aTHX_ scope, sv_2mortal(SvREFCNT_inc(*entry)));
        lean_array_set_core(result, i, (lean_inc(item), item));
      }
      return result;
}
static SV *lb_write_fc91b61a7de753b73407(pTHX_ lbp_scope *scope, lean_object * value) {

      
      size_t length = lean_array_size(value);
      if (length > 16 * 1024 * 1024 / sizeof(void *)) croak("native copied array exceeds the 16 MiB per-call limit");
      lbp_budget(scope, length * sizeof(void *));
      AV *array = (AV *)sv_2mortal((SV *)newAV());
      for (size_t i = 0; i < length; ++i) {
        SV *item = lb_write_c7aa542980540fb600fa(aTHX_ scope, lean_array_get_core(value, i));
        av_push(array, SvREFCNT_inc(item));
      }
      return lbp_mortal(newRV_inc((SV *)array));
}

static lean_object * lb_read_ca0d998129b5c191a0d3(pTHX_ lbp_scope *scope, SV *value) {

      SvGETMAGIC(value);
      if (lbp_is_branch(value, "LeanBridge::NominalSubtypes::Event::Empty")) {
        HV *input = (HV *)sv_2mortal(SvREFCNT_inc(SvRV(value)));
        if (HvUSEDKEYS(input) != 0) croak("constructor fields do not match the generated schema");
        lbp_budget(scope, 1 * sizeof(void *));
        /* Pin all fields before a child converter can invoke Perl code. */


        
        return lbp_keep(scope, lb_tca0d998129b5c191a0d3_make0(lean_box(0)));
      }
      if (lbp_is_branch(value, "LeanBridge::NominalSubtypes::Event::Box")) {
        HV *input = (HV *)sv_2mortal(SvREFCNT_inc(SvRV(value)));
        if (HvUSEDKEYS(input) != 1) croak("constructor fields do not match the generated schema");
        lbp_budget(scope, 2 * sizeof(void *));
        /* Pin all fields before a child converter can invoke Perl code. */
        SV *slot0 = lbp_field(aTHX_ input, "value", 5);
        lean_object * a0 = lb_read_90fc0814fb0968a90151(aTHX_ scope, slot0);
        lean_inc(a0);
        return lbp_keep(scope, lb_tca0d998129b5c191a0d3_make1(a0));
      }
      if (lbp_is_branch(value, "LeanBridge::NominalSubtypes::Event::Choices")) {
        HV *input = (HV *)sv_2mortal(SvREFCNT_inc(SvRV(value)));
        if (HvUSEDKEYS(input) != 1) croak("constructor fields do not match the generated schema");
        lbp_budget(scope, 2 * sizeof(void *));
        /* Pin all fields before a child converter can invoke Perl code. */
        SV *slot0 = lbp_field(aTHX_ input, "values", 6);
        lean_object * a0 = lb_read_fc91b61a7de753b73407(aTHX_ scope, slot0);
        lean_inc(a0);
        return lbp_keep(scope, lb_tca0d998129b5c191a0d3_make2(a0));
      }
      croak("expected an exact LeanBridge::NominalSubtypes::Event constructor with a plain untied hash");
}
static SV *lb_write_ca0d998129b5c191a0d3(pTHX_ lbp_scope *scope, lean_object * value) {

      lean_inc(value); uint32_t tag = lb_tca0d998129b5c191a0d3_tag(value);
      switch (tag) {
      case 0: {
        lbp_budget(scope, 1 * sizeof(void *));
        HV *output = (HV *)sv_2mortal((SV *)newHV());

        return sv_bless(lbp_mortal(newRV_inc((SV *)output)), gv_stashpv("LeanBridge::NominalSubtypes::Event::Empty", GV_ADD));
      }
      case 1: {
        lbp_budget(scope, 2 * sizeof(void *));
        HV *output = (HV *)sv_2mortal((SV *)newHV());
        lean_inc(value); lean_object * a0 = lb_tca0d998129b5c191a0d3_get1_0(value);
        lbp_keep(scope, a0);
        hv_store(output, "value", 5, SvREFCNT_inc(lb_write_90fc0814fb0968a90151(aTHX_ scope, a0)), 0);
        return sv_bless(lbp_mortal(newRV_inc((SV *)output)), gv_stashpv("LeanBridge::NominalSubtypes::Event::Box", GV_ADD));
      }
      case 2: {
        lbp_budget(scope, 2 * sizeof(void *));
        HV *output = (HV *)sv_2mortal((SV *)newHV());
        lean_inc(value); lean_object * a0 = lb_tca0d998129b5c191a0d3_get2_0(value);
        lbp_keep(scope, a0);
        hv_store(output, "values", 6, SvREFCNT_inc(lb_write_fc91b61a7de753b73407(aTHX_ scope, a0)), 0);
        return sv_bless(lbp_mortal(newRV_inc((SV *)output)), gv_stashpv("LeanBridge::NominalSubtypes::Event::Choices", GV_ADD));
      }
      default: croak("Invalid native LeanBridge::NominalSubtypes::Event constructor");
      }
}

static lean_object * lb_read_088895fe25b27367c934(pTHX_ lbp_scope *scope, SV *value) {

      SvGETMAGIC(value);
      if (!lbp_is_branch(value, "LeanBridge::NominalSubtypes::AliasPair")) croak("expected LeanBridge::NominalSubtypes::AliasPair with an exact class and plain untied hash");
      if (HvUSEDKEYS((HV *)SvRV(value)) != 2) croak("record fields do not match the generated schema");
      HV *input = (HV *)sv_2mortal(SvREFCNT_inc(SvRV(value)));
      lbp_budget(scope, 2 * sizeof(void *));
      /* Pin every field before a child converter can invoke Perl code. */
      SV *slot0 = lbp_field(aTHX_ input, "left", 4);
      SV *slot1 = lbp_field(aTHX_ input, "right", 5);
      lean_object * a0 = lb_read_ee6de6093191ad29d958(aTHX_ scope, slot0);
      lean_object * a1 = lb_read_ee6de6093191ad29d958(aTHX_ scope, slot1);
      lean_inc(a0); lean_inc(a1);
      return lbp_keep(scope, lb_t088895fe25b27367c934_make(a0, a1));
}
static SV *lb_write_088895fe25b27367c934(pTHX_ lbp_scope *scope, lean_object * value) {

      lbp_budget(scope, 2 * sizeof(void *));
      HV *record = (HV *)sv_2mortal((SV *)newHV());
      lean_inc(value); lean_object * a0 = lb_t088895fe25b27367c934_get0(value);
      lbp_keep(scope, a0);
      hv_store(record, "left", 4, SvREFCNT_inc(lb_write_ee6de6093191ad29d958(aTHX_ scope, a0)), 0);
      lean_inc(value); lean_object * a1 = lb_t088895fe25b27367c934_get1(value);
      lbp_keep(scope, a1);
      hv_store(record, "right", 5, SvREFCNT_inc(lb_write_ee6de6093191ad29d958(aTHX_ scope, a1)), 0);
      return sv_bless(lbp_mortal(newRV_inc((SV *)record)), gv_stashpv("LeanBridge::NominalSubtypes::AliasPair", GV_ADD));
}

static lean_object * lb_read_2dfafc6ad0cae13b43d7(pTHX_ lbp_scope *scope, SV *value) {

      SvGETMAGIC(value);
      if (!lbp_is_branch(value, "LeanBridge::NominalSubtypes::GenericNat")) croak("expected LeanBridge::NominalSubtypes::GenericNat with an exact class and plain untied hash");
      if (HvUSEDKEYS((HV *)SvRV(value)) != 2) croak("record fields do not match the generated schema");
      HV *input = (HV *)sv_2mortal(SvREFCNT_inc(SvRV(value)));
      lbp_budget(scope, 2 * sizeof(void *));
      /* Pin every field before a child converter can invoke Perl code. */
      SV *slot0 = lbp_field(aTHX_ input, "value", 5);
      SV *slot1 = lbp_field(aTHX_ input, "marker", 6);
      lean_object * a0 = lb_read_bcb803bc837008bec599(aTHX_ scope, slot0);
      lean_object * a1 = lb_read_bcb803bc837008bec599(aTHX_ scope, slot1);
      lean_inc(a0); lean_inc(a1);
      return lbp_keep(scope, lb_t2dfafc6ad0cae13b43d7_make(a0, a1));
}
static SV *lb_write_2dfafc6ad0cae13b43d7(pTHX_ lbp_scope *scope, lean_object * value) {

      lbp_budget(scope, 2 * sizeof(void *));
      HV *record = (HV *)sv_2mortal((SV *)newHV());
      lean_inc(value); lean_object * a0 = lb_t2dfafc6ad0cae13b43d7_get0(value);
      lbp_keep(scope, a0);
      hv_store(record, "value", 5, SvREFCNT_inc(lb_write_bcb803bc837008bec599(aTHX_ scope, a0)), 0);
      lean_inc(value); lean_object * a1 = lb_t2dfafc6ad0cae13b43d7_get1(value);
      lbp_keep(scope, a1);
      hv_store(record, "marker", 6, SvREFCNT_inc(lb_write_bcb803bc837008bec599(aTHX_ scope, a1)), 0);
      return sv_bless(lbp_mortal(newRV_inc((SV *)record)), gv_stashpv("LeanBridge::NominalSubtypes::GenericNat", GV_ADD));
}

static lean_object * lb_read_f487892807ab67e30881(pTHX_ lbp_scope *scope, SV *value) {

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
        lean_object * item = lb_read_bcb803bc837008bec599(aTHX_ scope, sv_2mortal(SvREFCNT_inc(*entry)));
        lean_array_set_core(result, i, (lean_inc(item), item));
      }
      lean_inc(result); return lbp_keep(scope, lb_tf487892807ab67e30881_from_array(result));
}
static SV *lb_write_f487892807ab67e30881(pTHX_ lbp_scope *scope, lean_object * value) {

      lean_inc(value); value = lbp_keep(scope, lb_tf487892807ab67e30881_to_array(value));
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

static lean_object * lb_read_3192fd5c3c5f9017c8f9(pTHX_ lbp_scope *scope, SV *value) {

      SvGETMAGIC(value);
      if (!lbp_is_branch(value, "LeanBridge::NominalSubtypes::Pair")) croak("expected LeanBridge::NominalSubtypes::Pair with an exact class and plain untied hash");
      if (HvUSEDKEYS((HV *)SvRV(value)) != 2) croak("record fields do not match the generated schema");
      HV *input = (HV *)sv_2mortal(SvREFCNT_inc(SvRV(value)));
      lbp_budget(scope, 2 * sizeof(void *));
      /* Pin every field before a child converter can invoke Perl code. */
      SV *slot0 = lbp_field(aTHX_ input, "left", 4);
      SV *slot1 = lbp_field(aTHX_ input, "right", 5);
      lean_object * a0 = lb_read_90fc0814fb0968a90151(aTHX_ scope, slot0);
      lean_object * a1 = lb_read_90fc0814fb0968a90151(aTHX_ scope, slot1);
      lean_inc(a0); lean_inc(a1);
      return lbp_keep(scope, lb_t3192fd5c3c5f9017c8f9_make(a0, a1));
}
static SV *lb_write_3192fd5c3c5f9017c8f9(pTHX_ lbp_scope *scope, lean_object * value) {

      lbp_budget(scope, 2 * sizeof(void *));
      HV *record = (HV *)sv_2mortal((SV *)newHV());
      lean_inc(value); lean_object * a0 = lb_t3192fd5c3c5f9017c8f9_get0(value);
      lbp_keep(scope, a0);
      hv_store(record, "left", 4, SvREFCNT_inc(lb_write_90fc0814fb0968a90151(aTHX_ scope, a0)), 0);
      lean_inc(value); lean_object * a1 = lb_t3192fd5c3c5f9017c8f9_get1(value);
      lbp_keep(scope, a1);
      hv_store(record, "right", 5, SvREFCNT_inc(lb_write_90fc0814fb0968a90151(aTHX_ scope, a1)), 0);
      return sv_bless(lbp_mortal(newRV_inc((SV *)record)), gv_stashpv("LeanBridge::NominalSubtypes::Pair", GV_ADD));
}

static lean_object * lb_read_3d0403c7f86fde2ead4d(pTHX_ lbp_scope *scope, SV *value) {

      SvGETMAGIC(value); lbp_budget(scope, sizeof(void *));
      if (!SvOK(value)) return lbp_keep(scope, lb_t3d0403c7f86fde2ead4d_none(lean_box(0)));
      if (lbp_is_branch(value, "LeanBridge::NominalSubtypes::Some")) {
        lean_object * item = lb_read_bcb803bc837008bec599(aTHX_ scope, lbp_branch_value(aTHX_ value, "LeanBridge::NominalSubtypes::Some"));
        lean_inc(item);
        return lbp_keep(scope, lb_t3d0403c7f86fde2ead4d_some(item));
      }
      croak("Option requires undef or the generated Some class");
}
static SV *lb_write_3d0403c7f86fde2ead4d(pTHX_ lbp_scope *scope, lean_object * value) {

      lbp_budget(scope, sizeof(void *));
      lean_inc(value); uint8_t present = lb_t3d0403c7f86fde2ead4d_has(value);
      if (!present) return lbp_mortal(newSV(0));
       {
        lean_inc(value); lean_object * item = lb_t3d0403c7f86fde2ead4d_get0(value);
        lbp_keep(scope, item);
        return lbp_branch(aTHX_ "LeanBridge::NominalSubtypes::Some", lb_write_bcb803bc837008bec599(aTHX_ scope, item));
      }
}

static lean_object * lb_read_75ac24c77bb2fef233a2(pTHX_ lbp_scope *scope, SV *value) {

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
      lean_object * a0 = lb_read_bcb803bc837008bec599(aTHX_ scope, slot0);
      lean_object * a1 = lb_read_bcb803bc837008bec599(aTHX_ scope, slot1);
      lean_inc(a0); lean_inc(a1);
      return lbp_keep(scope, lb_t75ac24c77bb2fef233a2_make(a0, a1));
}
static SV *lb_write_75ac24c77bb2fef233a2(pTHX_ lbp_scope *scope, lean_object * value) {

      lbp_budget(scope, 2 * sizeof(void *));
      AV *output = (AV *)sv_2mortal((SV *)newAV());
      lean_inc(value); lean_object * a0 = lb_t75ac24c77bb2fef233a2_get0(value);
      lbp_keep(scope, a0);
      av_push(output, SvREFCNT_inc(lb_write_bcb803bc837008bec599(aTHX_ scope, a0)));
      lean_inc(value); lean_object * a1 = lb_t75ac24c77bb2fef233a2_get1(value);
      lbp_keep(scope, a1);
      av_push(output, SvREFCNT_inc(lb_write_bcb803bc837008bec599(aTHX_ scope, a1)));
      return lbp_mortal(newRV_inc((SV *)output));
}

MODULE = LeanBridge::NominalSubtypes    PACKAGE = LeanBridge::NominalSubtypes
PROTOTYPES: DISABLE


void
aliases(...)
  PPCODE:
    if (items != 2) croak("aliases expects 2 arguments");
    lbp_check_interpreter(aTHX);
    lbp_component_ready(aTHX);
    LBP_ENTER();
    lean_object * a0 = lb_read_ee6de6093191ad29d958(aTHX_ scope, ST(0));
    lean_object * a1 = lb_read_ee6de6093191ad29d958(aTHX_ scope, ST(1));
    { 
      for (size_t k0 = 0; k0 < lean_array_size(a0); ++k0) { lean_object *e0 = lean_array_get_core(a0, k0);
      { lean_inc(e0); if (lb_t2d856855000adeb791a2_has(e0)) { lean_inc(e0); lean_object *v1 = lbp_keep(scope, lb_t2d856855000adeb791a2_get0(e0));
      { lean_inc(v1); lean_object *v2_1 = lbp_keep(scope, lb_t90fc0814fb0968a90151_get1(v1));
      { lean_object *bound = lean_cstr_to_nat("3"); int below = lean_nat_lt(v2_1, bound); lean_dec(bound);
      if (!below) croak("%s[%zu]?.digit is not below its Fin 3 bound", "value0", (size_t)k0); } } } } } }
    { 
      for (size_t k0 = 0; k0 < lean_array_size(a1); ++k0) { lean_object *e0 = lean_array_get_core(a1, k0);
      { lean_inc(e0); if (lb_t2d856855000adeb791a2_has(e0)) { lean_inc(e0); lean_object *v1 = lbp_keep(scope, lb_t2d856855000adeb791a2_get0(e0));
      { lean_inc(v1); lean_object *v2_1 = lbp_keep(scope, lb_t90fc0814fb0968a90151_get1(v1));
      { lean_object *bound = lean_cstr_to_nat("3"); int below = lean_nat_lt(v2_1, bound); lean_dec(bound);
      if (!below) croak("%s[%zu]?.digit is not below its Fin 3 bound", "value1", (size_t)k0); } } } } } }
    { 
      for (size_t k0 = 0; k0 < lean_array_size(a0); ++k0) { lean_object *e0 = lean_array_get_core(a0, k0);
      { lean_inc(e0); if (lb_t2d856855000adeb791a2_has(e0)) { lean_inc(e0); lean_object * v1_0 = lbp_keep(scope, lb_t2d856855000adeb791a2_get0(e0));
      { lean_inc(v1_0); lean_object * v2_0 = lbp_keep(scope, lb_t90fc0814fb0968a90151_get0(v1_0));
      lean_inc(v2_0); if (!lb_3748c7dfb58492cd91254d26_refinement_0_0_0_0(v2_0)) croak("%s[%zu]?.payload was rejected by NominalSubtypes.plusOne", "value0", (size_t)k0); } } } } }
    { 
      for (size_t k0 = 0; k0 < lean_array_size(a1); ++k0) { lean_object *e0 = lean_array_get_core(a1, k0);
      { lean_inc(e0); if (lb_t2d856855000adeb791a2_has(e0)) { lean_inc(e0); lean_object * v1_0 = lbp_keep(scope, lb_t2d856855000adeb791a2_get0(e0));
      { lean_inc(v1_0); lean_object * v2_0 = lbp_keep(scope, lb_t90fc0814fb0968a90151_get0(v1_0));
      lean_inc(v2_0); if (!lb_3748c7dfb58492cd91254d26_refinement_1_0_0_0(v2_0)) croak("%s[%zu]?.payload was rejected by NominalSubtypes.plusTwo", "value1", (size_t)k0); } } } } }
    lean_inc(a0); lean_inc(a1);
    lean_object *checked = lb_3748c7dfb58492cd91254d26(a0, a1);
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
array_values(...)
  PPCODE:
    if (items != 1) croak("array_values expects 1 arguments");
    lbp_check_interpreter(aTHX);
    lbp_component_ready(aTHX);
    LBP_ENTER();
    lean_object * a0 = lb_read_bcb803bc837008bec599(aTHX_ scope, ST(0));
    lean_inc(a0);
    lean_object * result = lb_e6117b4a2c058276486949a3(a0);
    lbp_keep(scope, result);
    lbp_finish(aTHX_ scope);
    lbp_component_ready(aTHX);
    SV *out = lb_write_224517b0527dd01c7a6b(aTHX_ scope, result);
    lbp_component_ready(aTHX);
    SvREFCNT_inc(out);
    LBP_LEAVE();
    ST(0) = sv_2mortal(out);
    XSRETURN(1);


void
branch(...)
  PPCODE:
    if (items != 1) croak("branch expects 1 arguments");
    lbp_check_interpreter(aTHX);
    lbp_component_ready(aTHX);
    LBP_ENTER();
    lean_object * a0 = lb_read_bcb803bc837008bec599(aTHX_ scope, ST(0));
    lean_inc(a0);
    lean_object * result = lb_c68be1e1f84c99c070a44992(a0);
    lbp_keep(scope, result);
    lbp_finish(aTHX_ scope);
    lbp_component_ready(aTHX);
    SV *out = lb_write_a95d99ff5a42e8c098e6(aTHX_ scope, result);
    lbp_component_ready(aTHX);
    SvREFCNT_inc(out);
    LBP_LEAVE();
    ST(0) = sv_2mortal(out);
    XSRETURN(1);


void
combine(...)
  PPCODE:
    if (items != 2) croak("combine expects 2 arguments");
    lbp_check_interpreter(aTHX);
    lbp_component_ready(aTHX);
    LBP_ENTER();
    lean_object * a0 = lb_read_90fc0814fb0968a90151(aTHX_ scope, ST(0));
    lean_object * a1 = lb_read_90fc0814fb0968a90151(aTHX_ scope, ST(1));
    { lean_inc(a0); lean_object *v0_1 = lbp_keep(scope, lb_t90fc0814fb0968a90151_get1(a0));
      { lean_object *bound = lean_cstr_to_nat("3"); int below = lean_nat_lt(v0_1, bound); lean_dec(bound);
      if (!below) croak("%s.digit is not below its Fin 3 bound", "value0"); } }
    { lean_inc(a1); lean_object *v0_1 = lbp_keep(scope, lb_t90fc0814fb0968a90151_get1(a1));
      { lean_object *bound = lean_cstr_to_nat("3"); int below = lean_nat_lt(v0_1, bound); lean_dec(bound);
      if (!below) croak("%s.digit is not below its Fin 3 bound", "value1"); } }
    { lean_inc(a0); lean_object * v0_0 = lbp_keep(scope, lb_t90fc0814fb0968a90151_get0(a0));
      lean_inc(v0_0); if (!lb_daf0377c7093092f7b8a2ed8_refinement_0_0(v0_0)) croak("%s.payload was rejected by NominalSubtypes.plusOne", "value0"); }
    { lean_inc(a1); lean_object * v0_0 = lbp_keep(scope, lb_t90fc0814fb0968a90151_get0(a1));
      lean_inc(v0_0); if (!lb_daf0377c7093092f7b8a2ed8_refinement_1_0(v0_0)) croak("%s.payload was rejected by NominalSubtypes.plusTwo", "value1"); }
    lean_inc(a0); lean_inc(a1);
    lean_object *checked = lb_daf0377c7093092f7b8a2ed8(a0, a1);
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
    lean_object * a0 = lb_read_90fc0814fb0968a90151(aTHX_ scope, ST(0));
    { lean_inc(a0); lean_object *v0_1 = lbp_keep(scope, lb_t90fc0814fb0968a90151_get1(a0));
      { lean_object *bound = lean_cstr_to_nat("3"); int below = lean_nat_lt(v0_1, bound); lean_dec(bound);
      if (!below) croak("%s.digit is not below its Fin 3 bound", "value0"); } }
    { lean_inc(a0); lean_object * v0_0 = lbp_keep(scope, lb_t90fc0814fb0968a90151_get0(a0));
      lean_inc(v0_0); if (!lb_6ff6f48ad1c2a8496199d55a_refinement_0_0(v0_0)) croak("%s.payload was rejected by NominalSubtypes.plusOne", "value0"); }
    lean_inc(a0);
    lean_object *checked = lb_6ff6f48ad1c2a8496199d55a(a0);
    if (lean_is_scalar(checked)) croak("Lean rejected an argument outside its checked refinement");
    lean_object *boxed = lean_ctor_get(checked, 0);
    lean_inc(boxed);
    lean_object * result = boxed;
    lean_dec(checked);
    lbp_keep(scope, result);
    lbp_finish(aTHX_ scope);
    lbp_component_ready(aTHX);
    SV *out = lb_write_90fc0814fb0968a90151(aTHX_ scope, result);
    lbp_component_ready(aTHX);
    SvREFCNT_inc(out);
    LBP_LEAVE();
    ST(0) = sv_2mortal(out);
    XSRETURN(1);


void
echo_event(...)
  PPCODE:
    if (items != 1) croak("echo_event expects 1 arguments");
    lbp_check_interpreter(aTHX);
    lbp_component_ready(aTHX);
    LBP_ENTER();
    lean_object * a0 = lb_read_ca0d998129b5c191a0d3(aTHX_ scope, ST(0));
    { lean_inc(a0); uint32_t t0 = lb_tca0d998129b5c191a0d3_tag(a0);
      if (t0 == 1u) { lean_inc(a0); lean_object *v0_0 = lbp_keep(scope, lb_tca0d998129b5c191a0d3_get1_0(a0));
      { lean_inc(v0_0); lean_object *v1_1 = lbp_keep(scope, lb_t90fc0814fb0968a90151_get1(v0_0));
      { lean_object *bound = lean_cstr_to_nat("3"); int below = lean_nat_lt(v1_1, bound); lean_dec(bound);
      if (!below) croak("%s.box.value.digit is not below its Fin 3 bound", "value0"); } } } }
    { lean_inc(a0); uint32_t t0 = lb_tca0d998129b5c191a0d3_tag(a0);
      if (t0 == 1u) { lean_inc(a0); lean_object * v0_1_0 = lbp_keep(scope, lb_tca0d998129b5c191a0d3_get1_0(a0));
      { lean_inc(v0_1_0); lean_object * v1_0 = lbp_keep(scope, lb_t90fc0814fb0968a90151_get0(v0_1_0));
      lean_inc(v1_0); if (!lb_3130b31f2b54800f3c5305b6_refinement_0_1_0_0(v1_0)) croak("%s.box.value.payload was rejected by NominalSubtypes.plusOne", "value0"); } } else if (t0 == 2u) { lean_inc(a0); lean_object * v0_2_0 = lbp_keep(scope, lb_tca0d998129b5c191a0d3_get2_0(a0));
      { 
      for (size_t k1 = 0; k1 < lean_array_size(v0_2_0); ++k1) { lean_object *e1 = lean_array_get_core(v0_2_0, k1);
      { lean_inc(e1); if (lb_tc7aa542980540fb600fa_has(e1)) { lean_inc(e1); lean_object * v2_0 = lbp_keep(scope, lb_tc7aa542980540fb600fa_get0(e1));
      { lean_inc(v2_0); if (lb_ta95d99ff5a42e8c098e6_has(v2_0)) { lean_inc(v2_0); lean_object * v3_0 = lbp_keep(scope, lb_ta95d99ff5a42e8c098e6_get0(v2_0));
      lean_inc(v3_0); if (!lb_3130b31f2b54800f3c5305b6_refinement_0_2_0_0_0_0(v3_0)) croak("%s.choices.values[%zu]?.ok was rejected by NominalSubtypes.plusOne", "value0", (size_t)k1); } else { lean_inc(v2_0); lean_object * v3_1 = lbp_keep(scope, lb_ta95d99ff5a42e8c098e6_get1(v2_0));
      lean_inc(v3_1); if (!lb_3130b31f2b54800f3c5305b6_refinement_0_2_0_0_0_1(v3_1)) croak("%s.choices.values[%zu]?.error was rejected by NominalSubtypes.plusTwo", "value0", (size_t)k1); } } } } } } } }
    lean_inc(a0);
    lean_object *checked = lb_3130b31f2b54800f3c5305b6(a0);
    if (lean_is_scalar(checked)) croak("Lean rejected an argument outside its checked refinement");
    lean_object *boxed = lean_ctor_get(checked, 0);
    lean_inc(boxed);
    lean_object * result = boxed;
    lean_dec(checked);
    lbp_keep(scope, result);
    lbp_finish(aTHX_ scope);
    lbp_component_ready(aTHX);
    SV *out = lb_write_ca0d998129b5c191a0d3(aTHX_ scope, result);
    lbp_component_ready(aTHX);
    SvREFCNT_inc(out);
    LBP_LEAVE();
    ST(0) = sv_2mortal(out);
    XSRETURN(1);


void
echo_groups(...)
  PPCODE:
    if (items != 1) croak("echo_groups expects 1 arguments");
    lbp_check_interpreter(aTHX);
    lbp_component_ready(aTHX);
    LBP_ENTER();
    lean_object * a0 = lb_read_ee6de6093191ad29d958(aTHX_ scope, ST(0));
    { 
      for (size_t k0 = 0; k0 < lean_array_size(a0); ++k0) { lean_object *e0 = lean_array_get_core(a0, k0);
      { lean_inc(e0); if (lb_t2d856855000adeb791a2_has(e0)) { lean_inc(e0); lean_object *v1 = lbp_keep(scope, lb_t2d856855000adeb791a2_get0(e0));
      { lean_inc(v1); lean_object *v2_1 = lbp_keep(scope, lb_t90fc0814fb0968a90151_get1(v1));
      { lean_object *bound = lean_cstr_to_nat("3"); int below = lean_nat_lt(v2_1, bound); lean_dec(bound);
      if (!below) croak("%s[%zu]?.digit is not below its Fin 3 bound", "value0", (size_t)k0); } } } } } }
    { 
      for (size_t k0 = 0; k0 < lean_array_size(a0); ++k0) { lean_object *e0 = lean_array_get_core(a0, k0);
      { lean_inc(e0); if (lb_t2d856855000adeb791a2_has(e0)) { lean_inc(e0); lean_object * v1_0 = lbp_keep(scope, lb_t2d856855000adeb791a2_get0(e0));
      { lean_inc(v1_0); lean_object * v2_0 = lbp_keep(scope, lb_t90fc0814fb0968a90151_get0(v1_0));
      lean_inc(v2_0); if (!lb_520e1c8263f474b50f99b104_refinement_0_0_0_0(v2_0)) croak("%s[%zu]?.payload was rejected by NominalSubtypes.plusOne", "value0", (size_t)k0); } } } } }
    lean_inc(a0);
    lean_object *checked = lb_520e1c8263f474b50f99b104(a0);
    if (lean_is_scalar(checked)) croak("Lean rejected an argument outside its checked refinement");
    lean_object *boxed = lean_ctor_get(checked, 0);
    lean_inc(boxed);
    lean_object * result = boxed;
    lean_dec(checked);
    lbp_keep(scope, result);
    lbp_finish(aTHX_ scope);
    lbp_component_ready(aTHX);
    SV *out = lb_write_ee6de6093191ad29d958(aTHX_ scope, result);
    lbp_component_ready(aTHX);
    SvREFCNT_inc(out);
    LBP_LEAVE();
    ST(0) = sv_2mortal(out);
    XSRETURN(1);


void
echo_pair(...)
  PPCODE:
    if (items != 1) croak("echo_pair expects 1 arguments");
    lbp_check_interpreter(aTHX);
    lbp_component_ready(aTHX);
    LBP_ENTER();
    lean_object * a0 = lb_read_088895fe25b27367c934(aTHX_ scope, ST(0));
    { lean_inc(a0); lean_object *v0_0 = lbp_keep(scope, lb_t088895fe25b27367c934_get0(a0));
      { 
      for (size_t k1 = 0; k1 < lean_array_size(v0_0); ++k1) { lean_object *e1 = lean_array_get_core(v0_0, k1);
      { lean_inc(e1); if (lb_t2d856855000adeb791a2_has(e1)) { lean_inc(e1); lean_object *v2 = lbp_keep(scope, lb_t2d856855000adeb791a2_get0(e1));
      { lean_inc(v2); lean_object *v3_1 = lbp_keep(scope, lb_t90fc0814fb0968a90151_get1(v2));
      { lean_object *bound = lean_cstr_to_nat("3"); int below = lean_nat_lt(v3_1, bound); lean_dec(bound);
      if (!below) croak("%s.left[%zu]?.digit is not below its Fin 3 bound", "value0", (size_t)k1); } } } } } }
      lean_inc(a0); lean_object *v0_1 = lbp_keep(scope, lb_t088895fe25b27367c934_get1(a0));
      { 
      for (size_t k1 = 0; k1 < lean_array_size(v0_1); ++k1) { lean_object *e1 = lean_array_get_core(v0_1, k1);
      { lean_inc(e1); if (lb_t2d856855000adeb791a2_has(e1)) { lean_inc(e1); lean_object *v2 = lbp_keep(scope, lb_t2d856855000adeb791a2_get0(e1));
      { lean_inc(v2); lean_object *v3_1 = lbp_keep(scope, lb_t90fc0814fb0968a90151_get1(v2));
      { lean_object *bound = lean_cstr_to_nat("3"); int below = lean_nat_lt(v3_1, bound); lean_dec(bound);
      if (!below) croak("%s.right[%zu]?.digit is not below its Fin 3 bound", "value0", (size_t)k1); } } } } } } }
    { lean_inc(a0); lean_object * v0_0 = lbp_keep(scope, lb_t088895fe25b27367c934_get0(a0));
      { 
      for (size_t k1 = 0; k1 < lean_array_size(v0_0); ++k1) { lean_object *e1 = lean_array_get_core(v0_0, k1);
      { lean_inc(e1); if (lb_t2d856855000adeb791a2_has(e1)) { lean_inc(e1); lean_object * v2_0 = lbp_keep(scope, lb_t2d856855000adeb791a2_get0(e1));
      { lean_inc(v2_0); lean_object * v3_0 = lbp_keep(scope, lb_t90fc0814fb0968a90151_get0(v2_0));
      lean_inc(v3_0); if (!lb_c141598aa043753e0a6404a3_refinement_0_0_0_0_0(v3_0)) croak("%s.left[%zu]?.payload was rejected by NominalSubtypes.plusOne", "value0", (size_t)k1); } } } } }
      lean_inc(a0); lean_object * v0_1 = lbp_keep(scope, lb_t088895fe25b27367c934_get1(a0));
      { 
      for (size_t k1 = 0; k1 < lean_array_size(v0_1); ++k1) { lean_object *e1 = lean_array_get_core(v0_1, k1);
      { lean_inc(e1); if (lb_t2d856855000adeb791a2_has(e1)) { lean_inc(e1); lean_object * v2_0 = lbp_keep(scope, lb_t2d856855000adeb791a2_get0(e1));
      { lean_inc(v2_0); lean_object * v3_0 = lbp_keep(scope, lb_t90fc0814fb0968a90151_get0(v2_0));
      lean_inc(v3_0); if (!lb_c141598aa043753e0a6404a3_refinement_0_1_0_0_0(v3_0)) croak("%s.right[%zu]?.payload was rejected by NominalSubtypes.plusTwo", "value0", (size_t)k1); } } } } } }
    lean_inc(a0);
    lean_object *checked = lb_c141598aa043753e0a6404a3(a0);
    if (lean_is_scalar(checked)) croak("Lean rejected an argument outside its checked refinement");
    lean_object *boxed = lean_ctor_get(checked, 0);
    lean_inc(boxed);
    lean_object * result = boxed;
    lean_dec(checked);
    lbp_keep(scope, result);
    lbp_finish(aTHX_ scope);
    lbp_component_ready(aTHX);
    SV *out = lb_write_088895fe25b27367c934(aTHX_ scope, result);
    lbp_component_ready(aTHX);
    SvREFCNT_inc(out);
    LBP_LEAVE();
    ST(0) = sv_2mortal(out);
    XSRETURN(1);


void
event_choices(...)
  PPCODE:
    if (items != 1) croak("event_choices expects 1 arguments");
    lbp_check_interpreter(aTHX);
    lbp_component_ready(aTHX);
    LBP_ENTER();
    lean_object * a0 = lb_read_bcb803bc837008bec599(aTHX_ scope, ST(0));
    lean_inc(a0);
    lean_object * result = lb_d8df7ac2dfbfe3b3b1460c5f(a0);
    lbp_keep(scope, result);
    lbp_finish(aTHX_ scope);
    lbp_component_ready(aTHX);
    SV *out = lb_write_ca0d998129b5c191a0d3(aTHX_ scope, result);
    lbp_component_ready(aTHX);
    SvREFCNT_inc(out);
    LBP_LEAVE();
    ST(0) = sv_2mortal(out);
    XSRETURN(1);


void
event_empty(...)
  PPCODE:
    if (items != 1) croak("event_empty expects 1 arguments");
    lbp_check_interpreter(aTHX);
    lbp_component_ready(aTHX);
    LBP_ENTER();
    lean_object * a0 = lb_read_bcb803bc837008bec599(aTHX_ scope, ST(0));
    lean_inc(a0);
    lean_object * result = lb_d4cfd58d7ddb8560ef50dc52(a0);
    lbp_keep(scope, result);
    lbp_finish(aTHX_ scope);
    lbp_component_ready(aTHX);
    SV *out = lb_write_ca0d998129b5c191a0d3(aTHX_ scope, result);
    lbp_component_ready(aTHX);
    SvREFCNT_inc(out);
    LBP_LEAVE();
    ST(0) = sv_2mortal(out);
    XSRETURN(1);


void
event_first(...)
  PPCODE:
    if (items != 1) croak("event_first expects 1 arguments");
    lbp_check_interpreter(aTHX);
    lbp_component_ready(aTHX);
    LBP_ENTER();
    lean_object * a0 = lb_read_ca0d998129b5c191a0d3(aTHX_ scope, ST(0));
    { lean_inc(a0); uint32_t t0 = lb_tca0d998129b5c191a0d3_tag(a0);
      if (t0 == 1u) { lean_inc(a0); lean_object *v0_0 = lbp_keep(scope, lb_tca0d998129b5c191a0d3_get1_0(a0));
      { lean_inc(v0_0); lean_object *v1_1 = lbp_keep(scope, lb_t90fc0814fb0968a90151_get1(v0_0));
      { lean_object *bound = lean_cstr_to_nat("3"); int below = lean_nat_lt(v1_1, bound); lean_dec(bound);
      if (!below) croak("%s.box.value.digit is not below its Fin 3 bound", "value0"); } } } }
    { lean_inc(a0); uint32_t t0 = lb_tca0d998129b5c191a0d3_tag(a0);
      if (t0 == 1u) { lean_inc(a0); lean_object * v0_1_0 = lbp_keep(scope, lb_tca0d998129b5c191a0d3_get1_0(a0));
      { lean_inc(v0_1_0); lean_object * v1_0 = lbp_keep(scope, lb_t90fc0814fb0968a90151_get0(v0_1_0));
      lean_inc(v1_0); if (!lb_836f5736fc807cf3d52332a8_refinement_0_1_0_0(v1_0)) croak("%s.box.value.payload was rejected by NominalSubtypes.plusOne", "value0"); } } else if (t0 == 2u) { lean_inc(a0); lean_object * v0_2_0 = lbp_keep(scope, lb_tca0d998129b5c191a0d3_get2_0(a0));
      { 
      for (size_t k1 = 0; k1 < lean_array_size(v0_2_0); ++k1) { lean_object *e1 = lean_array_get_core(v0_2_0, k1);
      { lean_inc(e1); if (lb_tc7aa542980540fb600fa_has(e1)) { lean_inc(e1); lean_object * v2_0 = lbp_keep(scope, lb_tc7aa542980540fb600fa_get0(e1));
      { lean_inc(v2_0); if (lb_ta95d99ff5a42e8c098e6_has(v2_0)) { lean_inc(v2_0); lean_object * v3_0 = lbp_keep(scope, lb_ta95d99ff5a42e8c098e6_get0(v2_0));
      lean_inc(v3_0); if (!lb_836f5736fc807cf3d52332a8_refinement_0_2_0_0_0_0(v3_0)) croak("%s.choices.values[%zu]?.ok was rejected by NominalSubtypes.plusOne", "value0", (size_t)k1); } else { lean_inc(v2_0); lean_object * v3_1 = lbp_keep(scope, lb_ta95d99ff5a42e8c098e6_get1(v2_0));
      lean_inc(v3_1); if (!lb_836f5736fc807cf3d52332a8_refinement_0_2_0_0_0_1(v3_1)) croak("%s.choices.values[%zu]?.error was rejected by NominalSubtypes.plusTwo", "value0", (size_t)k1); } } } } } } } }
    lean_inc(a0);
    lean_object *checked = lb_836f5736fc807cf3d52332a8(a0);
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
event_second(...)
  PPCODE:
    if (items != 1) croak("event_second expects 1 arguments");
    lbp_check_interpreter(aTHX);
    lbp_component_ready(aTHX);
    LBP_ENTER();
    lean_object * a0 = lb_read_ca0d998129b5c191a0d3(aTHX_ scope, ST(0));
    { lean_inc(a0); uint32_t t0 = lb_tca0d998129b5c191a0d3_tag(a0);
      if (t0 == 1u) { lean_inc(a0); lean_object *v0_0 = lbp_keep(scope, lb_tca0d998129b5c191a0d3_get1_0(a0));
      { lean_inc(v0_0); lean_object *v1_1 = lbp_keep(scope, lb_t90fc0814fb0968a90151_get1(v0_0));
      { lean_object *bound = lean_cstr_to_nat("3"); int below = lean_nat_lt(v1_1, bound); lean_dec(bound);
      if (!below) croak("%s.box.value.digit is not below its Fin 3 bound", "value0"); } } } }
    { lean_inc(a0); uint32_t t0 = lb_tca0d998129b5c191a0d3_tag(a0);
      if (t0 == 1u) { lean_inc(a0); lean_object * v0_1_0 = lbp_keep(scope, lb_tca0d998129b5c191a0d3_get1_0(a0));
      { lean_inc(v0_1_0); lean_object * v1_0 = lbp_keep(scope, lb_t90fc0814fb0968a90151_get0(v0_1_0));
      lean_inc(v1_0); if (!lb_d80fcef28cbece8bf39f7be6_refinement_0_1_0_0(v1_0)) croak("%s.box.value.payload was rejected by NominalSubtypes.plusTwo", "value0"); } } else if (t0 == 2u) { lean_inc(a0); lean_object * v0_2_0 = lbp_keep(scope, lb_tca0d998129b5c191a0d3_get2_0(a0));
      { 
      for (size_t k1 = 0; k1 < lean_array_size(v0_2_0); ++k1) { lean_object *e1 = lean_array_get_core(v0_2_0, k1);
      { lean_inc(e1); if (lb_tc7aa542980540fb600fa_has(e1)) { lean_inc(e1); lean_object * v2_0 = lbp_keep(scope, lb_tc7aa542980540fb600fa_get0(e1));
      { lean_inc(v2_0); if (lb_ta95d99ff5a42e8c098e6_has(v2_0)) { lean_inc(v2_0); lean_object * v3_0 = lbp_keep(scope, lb_ta95d99ff5a42e8c098e6_get0(v2_0));
      lean_inc(v3_0); if (!lb_d80fcef28cbece8bf39f7be6_refinement_0_2_0_0_0_0(v3_0)) croak("%s.choices.values[%zu]?.ok was rejected by NominalSubtypes.plusTwo", "value0", (size_t)k1); } else { lean_inc(v2_0); lean_object * v3_1 = lbp_keep(scope, lb_ta95d99ff5a42e8c098e6_get1(v2_0));
      lean_inc(v3_1); if (!lb_d80fcef28cbece8bf39f7be6_refinement_0_2_0_0_0_1(v3_1)) croak("%s.choices.values[%zu]?.error was rejected by NominalSubtypes.plusOne", "value0", (size_t)k1); } } } } } } } }
    lean_inc(a0);
    lean_object *checked = lb_d80fcef28cbece8bf39f7be6(a0);
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
event_value(...)
  PPCODE:
    if (items != 1) croak("event_value expects 1 arguments");
    lbp_check_interpreter(aTHX);
    lbp_component_ready(aTHX);
    LBP_ENTER();
    lean_object * a0 = lb_read_bcb803bc837008bec599(aTHX_ scope, ST(0));
    lean_inc(a0);
    lean_object * result = lb_90cdba474b79f516c0b52978(a0);
    lbp_keep(scope, result);
    lbp_finish(aTHX_ scope);
    lbp_component_ready(aTHX);
    SV *out = lb_write_ca0d998129b5c191a0d3(aTHX_ scope, result);
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
    lean_object * a0 = lb_read_90fc0814fb0968a90151(aTHX_ scope, ST(0));
    { lean_inc(a0); lean_object *v0_1 = lbp_keep(scope, lb_t90fc0814fb0968a90151_get1(a0));
      { lean_object *bound = lean_cstr_to_nat("3"); int below = lean_nat_lt(v0_1, bound); lean_dec(bound);
      if (!below) croak("%s.digit is not below its Fin 3 bound", "value0"); } }
    { lean_inc(a0); lean_object * v0_0 = lbp_keep(scope, lb_t90fc0814fb0968a90151_get0(a0));
      lean_inc(v0_0); if (!lb_bf4a2541d27b77f9e2561f26_refinement_0_0(v0_0)) croak("%s.payload was rejected by NominalSubtypes.plusOne", "value0"); }
    lean_inc(a0);
    lean_object *checked = lb_bf4a2541d27b77f9e2561f26(a0);
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
echo_generic_first(...)
  PPCODE:
    if (items != 1) croak("echo_generic_first expects 1 arguments");
    lbp_check_interpreter(aTHX);
    lbp_component_ready(aTHX);
    LBP_ENTER();
    lean_object * a0 = lb_read_2dfafc6ad0cae13b43d7(aTHX_ scope, ST(0));
    { lean_inc(a0); lean_object * v0_0 = lbp_keep(scope, lb_t2dfafc6ad0cae13b43d7_get0(a0));
      lean_inc(v0_0); if (!lb_65ca4b84c02f5a041da47257_refinement_0_0(v0_0)) croak("%s.value was rejected by NominalSubtypes.plusOne", "value0"); }
    lean_inc(a0);
    lean_object *checked = lb_65ca4b84c02f5a041da47257(a0);
    if (lean_is_scalar(checked)) croak("Lean rejected an argument outside its checked refinement");
    lean_object *boxed = lean_ctor_get(checked, 0);
    lean_inc(boxed);
    lean_object * result = boxed;
    lean_dec(checked);
    lbp_keep(scope, result);
    lbp_finish(aTHX_ scope);
    lbp_component_ready(aTHX);
    SV *out = lb_write_2dfafc6ad0cae13b43d7(aTHX_ scope, result);
    lbp_component_ready(aTHX);
    SvREFCNT_inc(out);
    LBP_LEAVE();
    ST(0) = sv_2mortal(out);
    XSRETURN(1);


void
echo_generic_second(...)
  PPCODE:
    if (items != 1) croak("echo_generic_second expects 1 arguments");
    lbp_check_interpreter(aTHX);
    lbp_component_ready(aTHX);
    LBP_ENTER();
    lean_object * a0 = lb_read_2dfafc6ad0cae13b43d7(aTHX_ scope, ST(0));
    { lean_inc(a0); lean_object * v0_0 = lbp_keep(scope, lb_t2dfafc6ad0cae13b43d7_get0(a0));
      lean_inc(v0_0); if (!lb_cf1048308d2ec09b2ffa507b_refinement_0_0(v0_0)) croak("%s.value was rejected by NominalSubtypes.plusTwo", "value0"); }
    lean_inc(a0);
    lean_object *checked = lb_cf1048308d2ec09b2ffa507b(a0);
    if (lean_is_scalar(checked)) croak("Lean rejected an argument outside its checked refinement");
    lean_object *boxed = lean_ctor_get(checked, 0);
    lean_inc(boxed);
    lean_object * result = boxed;
    lean_dec(checked);
    lbp_keep(scope, result);
    lbp_finish(aTHX_ scope);
    lbp_component_ready(aTHX);
    SV *out = lb_write_2dfafc6ad0cae13b43d7(aTHX_ scope, result);
    lbp_component_ready(aTHX);
    SvREFCNT_inc(out);
    LBP_LEAVE();
    ST(0) = sv_2mortal(out);
    XSRETURN(1);


void
generic_use(...)
  PPCODE:
    if (items != 1) croak("generic_use expects 1 arguments");
    lbp_check_interpreter(aTHX);
    lbp_component_ready(aTHX);
    LBP_ENTER();
    lean_object * a0 = lb_read_2dfafc6ad0cae13b43d7(aTHX_ scope, ST(0));
    { lean_inc(a0); lean_object * v0_0 = lbp_keep(scope, lb_t2dfafc6ad0cae13b43d7_get0(a0));
      lean_inc(v0_0); if (!lb_2a5ed83ff2079f621f3ea48a_refinement_0_0(v0_0)) croak("%s.value was rejected by NominalSubtypes.plusOne", "value0"); }
    lean_inc(a0);
    lean_object *checked = lb_2a5ed83ff2079f621f3ea48a(a0);
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
group_values(...)
  PPCODE:
    if (items != 1) croak("group_values expects 1 arguments");
    lbp_check_interpreter(aTHX);
    lbp_component_ready(aTHX);
    LBP_ENTER();
    lean_object * a0 = lb_read_bcb803bc837008bec599(aTHX_ scope, ST(0));
    lean_inc(a0);
    lean_object * result = lb_fe0216c702a5ebbfe74fc560(a0);
    lbp_keep(scope, result);
    lbp_finish(aTHX_ scope);
    lbp_component_ready(aTHX);
    SV *out = lb_write_ee6de6093191ad29d958(aTHX_ scope, result);
    lbp_component_ready(aTHX);
    SvREFCNT_inc(out);
    LBP_LEAVE();
    ST(0) = sv_2mortal(out);
    XSRETURN(1);


void
inspect_alias_pair(...)
  PPCODE:
    if (items != 1) croak("inspect_alias_pair expects 1 arguments");
    lbp_check_interpreter(aTHX);
    lbp_component_ready(aTHX);
    LBP_ENTER();
    lean_object * a0 = lb_read_088895fe25b27367c934(aTHX_ scope, ST(0));
    { lean_inc(a0); lean_object *v0_0 = lbp_keep(scope, lb_t088895fe25b27367c934_get0(a0));
      { 
      for (size_t k1 = 0; k1 < lean_array_size(v0_0); ++k1) { lean_object *e1 = lean_array_get_core(v0_0, k1);
      { lean_inc(e1); if (lb_t2d856855000adeb791a2_has(e1)) { lean_inc(e1); lean_object *v2 = lbp_keep(scope, lb_t2d856855000adeb791a2_get0(e1));
      { lean_inc(v2); lean_object *v3_1 = lbp_keep(scope, lb_t90fc0814fb0968a90151_get1(v2));
      { lean_object *bound = lean_cstr_to_nat("3"); int below = lean_nat_lt(v3_1, bound); lean_dec(bound);
      if (!below) croak("%s.left[%zu]?.digit is not below its Fin 3 bound", "value0", (size_t)k1); } } } } } }
      lean_inc(a0); lean_object *v0_1 = lbp_keep(scope, lb_t088895fe25b27367c934_get1(a0));
      { 
      for (size_t k1 = 0; k1 < lean_array_size(v0_1); ++k1) { lean_object *e1 = lean_array_get_core(v0_1, k1);
      { lean_inc(e1); if (lb_t2d856855000adeb791a2_has(e1)) { lean_inc(e1); lean_object *v2 = lbp_keep(scope, lb_t2d856855000adeb791a2_get0(e1));
      { lean_inc(v2); lean_object *v3_1 = lbp_keep(scope, lb_t90fc0814fb0968a90151_get1(v2));
      { lean_object *bound = lean_cstr_to_nat("3"); int below = lean_nat_lt(v3_1, bound); lean_dec(bound);
      if (!below) croak("%s.right[%zu]?.digit is not below its Fin 3 bound", "value0", (size_t)k1); } } } } } } }
    { lean_inc(a0); lean_object * v0_0 = lbp_keep(scope, lb_t088895fe25b27367c934_get0(a0));
      { 
      for (size_t k1 = 0; k1 < lean_array_size(v0_0); ++k1) { lean_object *e1 = lean_array_get_core(v0_0, k1);
      { lean_inc(e1); if (lb_t2d856855000adeb791a2_has(e1)) { lean_inc(e1); lean_object * v2_0 = lbp_keep(scope, lb_t2d856855000adeb791a2_get0(e1));
      { lean_inc(v2_0); lean_object * v3_0 = lbp_keep(scope, lb_t90fc0814fb0968a90151_get0(v2_0));
      lean_inc(v3_0); if (!lb_5e8bbc0f751366e2ffd88f8d_refinement_0_0_0_0_0(v3_0)) croak("%s.left[%zu]?.payload was rejected by NominalSubtypes.plusOne", "value0", (size_t)k1); } } } } }
      lean_inc(a0); lean_object * v0_1 = lbp_keep(scope, lb_t088895fe25b27367c934_get1(a0));
      { 
      for (size_t k1 = 0; k1 < lean_array_size(v0_1); ++k1) { lean_object *e1 = lean_array_get_core(v0_1, k1);
      { lean_inc(e1); if (lb_t2d856855000adeb791a2_has(e1)) { lean_inc(e1); lean_object * v2_0 = lbp_keep(scope, lb_t2d856855000adeb791a2_get0(e1));
      { lean_inc(v2_0); lean_object * v3_0 = lbp_keep(scope, lb_t90fc0814fb0968a90151_get0(v2_0));
      lean_inc(v3_0); if (!lb_5e8bbc0f751366e2ffd88f8d_refinement_0_1_0_0_0(v3_0)) croak("%s.right[%zu]?.payload was rejected by NominalSubtypes.plusTwo", "value0", (size_t)k1); } } } } } }
    lean_inc(a0);
    lean_object *checked = lb_5e8bbc0f751366e2ffd88f8d(a0);
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
list_values(...)
  PPCODE:
    if (items != 1) croak("list_values expects 1 arguments");
    lbp_check_interpreter(aTHX);
    lbp_component_ready(aTHX);
    LBP_ENTER();
    lean_object * a0 = lb_read_bcb803bc837008bec599(aTHX_ scope, ST(0));
    lean_inc(a0);
    lean_object * result = lb_30775f99f7ee1962ca940d1a(a0);
    lbp_keep(scope, result);
    lbp_finish(aTHX_ scope);
    lbp_component_ready(aTHX);
    SV *out = lb_write_f487892807ab67e30881(aTHX_ scope, result);
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
    lean_object * a0 = lb_read_3192fd5c3c5f9017c8f9(aTHX_ scope, ST(0));
    { lean_inc(a0); lean_object *v0_0 = lbp_keep(scope, lb_t3192fd5c3c5f9017c8f9_get0(a0));
      { lean_inc(v0_0); lean_object *v1_1 = lbp_keep(scope, lb_t90fc0814fb0968a90151_get1(v0_0));
      { lean_object *bound = lean_cstr_to_nat("3"); int below = lean_nat_lt(v1_1, bound); lean_dec(bound);
      if (!below) croak("%s.left.digit is not below its Fin 3 bound", "value0"); } }
      lean_inc(a0); lean_object *v0_1 = lbp_keep(scope, lb_t3192fd5c3c5f9017c8f9_get1(a0));
      { lean_inc(v0_1); lean_object *v1_1 = lbp_keep(scope, lb_t90fc0814fb0968a90151_get1(v0_1));
      { lean_object *bound = lean_cstr_to_nat("3"); int below = lean_nat_lt(v1_1, bound); lean_dec(bound);
      if (!below) croak("%s.right.digit is not below its Fin 3 bound", "value0"); } } }
    { lean_inc(a0); lean_object * v0_0 = lbp_keep(scope, lb_t3192fd5c3c5f9017c8f9_get0(a0));
      { lean_inc(v0_0); lean_object * v1_0 = lbp_keep(scope, lb_t90fc0814fb0968a90151_get0(v0_0));
      lean_inc(v1_0); if (!lb_b873cf2f2731a105d83aaeae_refinement_0_0_0(v1_0)) croak("%s.left.payload was rejected by NominalSubtypes.plusOne", "value0"); }
      lean_inc(a0); lean_object * v0_1 = lbp_keep(scope, lb_t3192fd5c3c5f9017c8f9_get1(a0));
      { lean_inc(v0_1); lean_object * v1_0 = lbp_keep(scope, lb_t90fc0814fb0968a90151_get0(v0_1));
      lean_inc(v1_0); if (!lb_b873cf2f2731a105d83aaeae_refinement_0_1_0(v1_0)) croak("%s.right.payload was rejected by NominalSubtypes.plusTwo", "value0"); } }
    lean_inc(a0);
    lean_object *checked = lb_b873cf2f2731a105d83aaeae(a0);
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
no_items(...)
  PPCODE:
    if (items != 1) croak("no_items expects 1 arguments");
    lbp_check_interpreter(aTHX);
    lbp_component_ready(aTHX);
    LBP_ENTER();
    lean_object * a0 = lb_read_bcb803bc837008bec599(aTHX_ scope, ST(0));
    lean_inc(a0);
    lean_object * result = lb_fb21161d65be28d916dcac41(a0);
    lbp_keep(scope, result);
    lbp_finish(aTHX_ scope);
    lbp_component_ready(aTHX);
    SV *out = lb_write_224517b0527dd01c7a6b(aTHX_ scope, result);
    lbp_component_ready(aTHX);
    SvREFCNT_inc(out);
    LBP_LEAVE();
    ST(0) = sv_2mortal(out);
    XSRETURN(1);


void
optional(...)
  PPCODE:
    if (items != 1) croak("optional expects 1 arguments");
    lbp_check_interpreter(aTHX);
    lbp_component_ready(aTHX);
    LBP_ENTER();
    lean_object * a0 = lb_read_bcb803bc837008bec599(aTHX_ scope, ST(0));
    lean_inc(a0);
    lean_object * result = lb_9686ecc5fe69d4a6438a0e6a(a0);
    lbp_keep(scope, result);
    lbp_finish(aTHX_ scope);
    lbp_component_ready(aTHX);
    SV *out = lb_write_3d0403c7f86fde2ead4d(aTHX_ scope, result);
    lbp_component_ready(aTHX);
    SvREFCNT_inc(out);
    LBP_LEAVE();
    ST(0) = sv_2mortal(out);
    XSRETURN(1);


void
pair_values(...)
  PPCODE:
    if (items != 1) croak("pair_values expects 1 arguments");
    lbp_check_interpreter(aTHX);
    lbp_component_ready(aTHX);
    LBP_ENTER();
    lean_object * a0 = lb_read_bcb803bc837008bec599(aTHX_ scope, ST(0));
    lean_inc(a0);
    lean_object * result = lb_0fffaedb5541aceb2b121d97(a0);
    lbp_keep(scope, result);
    lbp_finish(aTHX_ scope);
    lbp_component_ready(aTHX);
    SV *out = lb_write_088895fe25b27367c934(aTHX_ scope, result);
    lbp_component_ready(aTHX);
    SvREFCNT_inc(out);
    LBP_LEAVE();
    ST(0) = sv_2mortal(out);
    XSRETURN(1);


void
plain_fin(...)
  PPCODE:
    if (items != 1) croak("plain_fin expects 1 arguments");
    lbp_check_interpreter(aTHX);
    lbp_component_ready(aTHX);
    LBP_ENTER();
    lean_object * a0 = lb_read_bcb803bc837008bec599(aTHX_ scope, ST(0));
    { lean_object *bound = lean_cstr_to_nat("3"); int below = lean_nat_lt(a0, bound); lean_dec(bound);
      if (!below) croak("%s", "value0 is not below its Fin 3 bound"); }
    lean_inc(a0);
    lean_object *checked = lb_15d9d6482d088a2aeae57e49(a0);
    if (lean_is_scalar(checked)) croak("Lean rejected an argument outside its Fin bound");
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
produce_envelope(...)
  PPCODE:
    if (items != 1) croak("produce_envelope expects 1 arguments");
    lbp_check_interpreter(aTHX);
    lbp_component_ready(aTHX);
    LBP_ENTER();
    lean_object * a0 = lb_read_bcb803bc837008bec599(aTHX_ scope, ST(0));
    lean_inc(a0);
    lean_object * result = lb_1675ed3831b1403640f61957(a0);
    lbp_keep(scope, result);
    lbp_finish(aTHX_ scope);
    lbp_component_ready(aTHX);
    SV *out = lb_write_90fc0814fb0968a90151(aTHX_ scope, result);
    lbp_component_ready(aTHX);
    SvREFCNT_inc(out);
    LBP_LEAVE();
    ST(0) = sv_2mortal(out);
    XSRETURN(1);


void
product(...)
  PPCODE:
    if (items != 1) croak("product expects 1 arguments");
    lbp_check_interpreter(aTHX);
    lbp_component_ready(aTHX);
    LBP_ENTER();
    lean_object * a0 = lb_read_bcb803bc837008bec599(aTHX_ scope, ST(0));
    lean_inc(a0);
    lean_object * result = lb_bb98c244bdedfd3d9997d34a(a0);
    lbp_keep(scope, result);
    lbp_finish(aTHX_ scope);
    lbp_component_ready(aTHX);
    SV *out = lb_write_75ac24c77bb2fef233a2(aTHX_ scope, result);
    lbp_component_ready(aTHX);
    SvREFCNT_inc(out);
    LBP_LEAVE();
    ST(0) = sv_2mortal(out);
    XSRETURN(1);


void
scalar(...)
  PPCODE:
    if (items != 1) croak("scalar expects 1 arguments");
    lbp_check_interpreter(aTHX);
    lbp_component_ready(aTHX);
    LBP_ENTER();
    lean_object * a0 = lb_read_bcb803bc837008bec599(aTHX_ scope, ST(0));
    lean_inc(a0);
    lean_object * result = lb_a90151ccf6e7f9af5767c444(a0);
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
second(...)
  PPCODE:
    if (items != 1) croak("second expects 1 arguments");
    lbp_check_interpreter(aTHX);
    lbp_component_ready(aTHX);
    LBP_ENTER();
    lean_object * a0 = lb_read_90fc0814fb0968a90151(aTHX_ scope, ST(0));
    { lean_inc(a0); lean_object *v0_1 = lbp_keep(scope, lb_t90fc0814fb0968a90151_get1(a0));
      { lean_object *bound = lean_cstr_to_nat("3"); int below = lean_nat_lt(v0_1, bound); lean_dec(bound);
      if (!below) croak("%s.digit is not below its Fin 3 bound", "value0"); } }
    { lean_inc(a0); lean_object * v0_0 = lbp_keep(scope, lb_t90fc0814fb0968a90151_get0(a0));
      lean_inc(v0_0); if (!lb_5633e9a71959a57d229c02d9_refinement_0_0(v0_0)) croak("%s.payload was rejected by NominalSubtypes.plusTwo", "value0"); }
    lean_inc(a0);
    lean_object *checked = lb_5633e9a71959a57d229c02d9(a0);
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
  extern lean_object *initialize_LeanBridgeNative7f8bfe55e5831a91(uint8_t);
  if (!lean_bridge_native_component_initialize("nominalsubtypes@1.0.0:44fcf2e793c07c8171ed24f610f8e187c314cb85aca66387ee1222228af1890a", (lean_bridge_native_initializer)initialize_LeanBridgeNative7f8bfe55e5831a91)) croak("Lean component initialization failed");

