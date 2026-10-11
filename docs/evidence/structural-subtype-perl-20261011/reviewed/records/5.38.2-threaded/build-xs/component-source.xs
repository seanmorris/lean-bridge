#include "runtime.h"
#include "component.h"
static void lbp_component_ready(pTHX) {
  if (!lean_bridge_native_component_ready("structuralsubtypes@1.0.0:7e70da88f20e3c962b655518dcb523dbb8b60311b41b526133fb7c98c206eb5d")) croak("Lean runtime is not ready or has been retired");
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

static lean_object * lb_read_3d0403c7f86fde2ead4d(pTHX_ lbp_scope *scope, SV *value) {

      SvGETMAGIC(value); lbp_budget(scope, sizeof(void *));
      if (!SvOK(value)) return lbp_keep(scope, lb_t3d0403c7f86fde2ead4d_none(lean_box(0)));
      if (lbp_is_branch(value, "LeanBridge::StructuralSubtypes::Some")) {
        lean_object * item = lb_read_bcb803bc837008bec599(aTHX_ scope, lbp_branch_value(aTHX_ value, "LeanBridge::StructuralSubtypes::Some"));
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
        return lbp_branch(aTHX_ "LeanBridge::StructuralSubtypes::Some", lb_write_bcb803bc837008bec599(aTHX_ scope, item));
      }
}

static lean_object * lb_read_cbf1a822cab24c3df8da(pTHX_ lbp_scope *scope, SV *value) {

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
        lean_object * item = lb_read_3d0403c7f86fde2ead4d(aTHX_ scope, sv_2mortal(SvREFCNT_inc(*entry)));
        lean_array_set_core(result, i, (lean_inc(item), item));
      }
      return result;
}
static SV *lb_write_cbf1a822cab24c3df8da(pTHX_ lbp_scope *scope, lean_object * value) {

      
      size_t length = lean_array_size(value);
      if (length > 16 * 1024 * 1024 / sizeof(void *)) croak("native copied array exceeds the 16 MiB per-call limit");
      lbp_budget(scope, length * sizeof(void *));
      AV *array = (AV *)sv_2mortal((SV *)newAV());
      for (size_t i = 0; i < length; ++i) {
        SV *item = lb_write_3d0403c7f86fde2ead4d(aTHX_ scope, lean_array_get_core(value, i));
        av_push(array, SvREFCNT_inc(item));
      }
      return lbp_mortal(newRV_inc((SV *)array));
}

static lean_object * lb_read_97011fb08c2a924880ed(pTHX_ lbp_scope *scope, SV *value) {

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
      lean_object * a0 = lb_read_cbf1a822cab24c3df8da(aTHX_ scope, slot0);
      lean_object * a1 = lb_read_cbf1a822cab24c3df8da(aTHX_ scope, slot1);
      lean_inc(a0); lean_inc(a1);
      return lbp_keep(scope, lb_t97011fb08c2a924880ed_make(a0, a1));
}
static SV *lb_write_97011fb08c2a924880ed(pTHX_ lbp_scope *scope, lean_object * value) {

      lbp_budget(scope, 2 * sizeof(void *));
      AV *output = (AV *)sv_2mortal((SV *)newAV());
      lean_inc(value); lean_object * a0 = lb_t97011fb08c2a924880ed_get0(value);
      lbp_keep(scope, a0);
      av_push(output, SvREFCNT_inc(lb_write_cbf1a822cab24c3df8da(aTHX_ scope, a0)));
      lean_inc(value); lean_object * a1 = lb_t97011fb08c2a924880ed_get1(value);
      lbp_keep(scope, a1);
      av_push(output, SvREFCNT_inc(lb_write_cbf1a822cab24c3df8da(aTHX_ scope, a1)));
      return lbp_mortal(newRV_inc((SV *)output));
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

static lean_object * lb_read_fef73841aaed14bc1688(pTHX_ lbp_scope *scope, SV *value) {

    lbp_plain(aTHX_ value); if (!SvPOK(value)) croak("String requires a text scalar");
    STRLEN length; const U8 *bytes = (const U8 *)SvPVutf8(value, length); lbp_budget(scope, length);
    if (!is_utf8_string_flags(bytes, length, UTF8_DISALLOW_SURROGATE | UTF8_DISALLOW_SUPER)) croak("String contains invalid Unicode");
    return lbp_keep(scope, lean_mk_string_from_bytes((const char *)bytes, length));
}
static SV *lb_write_fef73841aaed14bc1688(pTHX_ lbp_scope *scope, lean_object * value) {

    size_t length = lean_string_size(value) - 1; lbp_budget(scope, length);
    SV *result = lbp_mortal(newSVpvn(lean_string_cstr(value), length)); SvUTF8_on(result); return result;
}

static lean_object * lb_read_593a10b514c47b999735(pTHX_ lbp_scope *scope, SV *value) {

      SvGETMAGIC(value); lbp_budget(scope, sizeof(void *));
      
      if (lbp_is_branch(value, "LeanBridge::StructuralSubtypes::Ok")) {
        lean_object * item = lb_read_bcb803bc837008bec599(aTHX_ scope, lbp_branch_value(aTHX_ value, "LeanBridge::StructuralSubtypes::Ok"));
        lean_inc(item);
        return lbp_keep(scope, lb_t593a10b514c47b999735_ok(item));
      }
      if (lbp_is_branch(value, "LeanBridge::StructuralSubtypes::Err")) {
        lean_object * item = lb_read_fef73841aaed14bc1688(aTHX_ scope, lbp_branch_value(aTHX_ value, "LeanBridge::StructuralSubtypes::Err"));
        lean_inc(item);
        return lbp_keep(scope, lb_t593a10b514c47b999735_error(item));
      }
      croak("Except requires the generated Ok or Err class");
}
static SV *lb_write_593a10b514c47b999735(pTHX_ lbp_scope *scope, lean_object * value) {

      lbp_budget(scope, sizeof(void *));
      lean_inc(value); uint8_t present = lb_t593a10b514c47b999735_has(value);
      
      if (present) {
        lean_inc(value); lean_object * item = lb_t593a10b514c47b999735_get0(value);
        lbp_keep(scope, item);
        return lbp_branch(aTHX_ "LeanBridge::StructuralSubtypes::Ok", lb_write_bcb803bc837008bec599(aTHX_ scope, item));
      }
      else {
        lean_inc(value); lean_object * item = lb_t593a10b514c47b999735_get1(value);
        lbp_keep(scope, item);
        return lbp_branch(aTHX_ "LeanBridge::StructuralSubtypes::Err", lb_write_fef73841aaed14bc1688(aTHX_ scope, item));
      }
}

static uint8_t lb_read_23919de1caf8120217dd(pTHX_ lbp_scope *scope, SV *value) {
return (uint8_t)lbp_unsigned(aTHX_ value, UINT8_MAX);
}
static SV *lb_write_23919de1caf8120217dd(pTHX_ lbp_scope *scope, uint8_t value) {
return lbp_mortal(newSVuv(value));
}

static lean_object * lb_read_36feb3e81b74ee424c50(pTHX_ lbp_scope *scope, SV *value) {

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
      uint8_t a0 = lb_read_23919de1caf8120217dd(aTHX_ scope, slot0);
      lean_object * a1 = lb_read_bcb803bc837008bec599(aTHX_ scope, slot1);
       lean_inc(a1);
      return lbp_keep(scope, lb_t36feb3e81b74ee424c50_make(a0, a1));
}
static SV *lb_write_36feb3e81b74ee424c50(pTHX_ lbp_scope *scope, lean_object * value) {

      lbp_budget(scope, 2 * sizeof(void *));
      AV *output = (AV *)sv_2mortal((SV *)newAV());
      lean_inc(value); uint8_t a0 = lb_t36feb3e81b74ee424c50_get0(value);
      
      av_push(output, SvREFCNT_inc(lb_write_23919de1caf8120217dd(aTHX_ scope, a0)));
      lean_inc(value); lean_object * a1 = lb_t36feb3e81b74ee424c50_get1(value);
      lbp_keep(scope, a1);
      av_push(output, SvREFCNT_inc(lb_write_bcb803bc837008bec599(aTHX_ scope, a1)));
      return lbp_mortal(newRV_inc((SV *)output));
}

static lean_object * lb_read_fc95d19b5edc3a6ae7ea(pTHX_ lbp_scope *scope, SV *value) {

      SvGETMAGIC(value); lbp_budget(scope, sizeof(void *));
      if (!SvOK(value)) return lbp_keep(scope, lb_tfc95d19b5edc3a6ae7ea_none(lean_box(0)));
      if (lbp_is_branch(value, "LeanBridge::StructuralSubtypes::Some")) {
        lean_object * item = lb_read_36feb3e81b74ee424c50(aTHX_ scope, lbp_branch_value(aTHX_ value, "LeanBridge::StructuralSubtypes::Some"));
        lean_inc(item);
        return lbp_keep(scope, lb_tfc95d19b5edc3a6ae7ea_some(item));
      }
      croak("Option requires undef or the generated Some class");
}
static SV *lb_write_fc95d19b5edc3a6ae7ea(pTHX_ lbp_scope *scope, lean_object * value) {

      lbp_budget(scope, sizeof(void *));
      lean_inc(value); uint8_t present = lb_tfc95d19b5edc3a6ae7ea_has(value);
      if (!present) return lbp_mortal(newSV(0));
       {
        lean_inc(value); lean_object * item = lb_tfc95d19b5edc3a6ae7ea_get0(value);
        lbp_keep(scope, item);
        return lbp_branch(aTHX_ "LeanBridge::StructuralSubtypes::Some", lb_write_36feb3e81b74ee424c50(aTHX_ scope, item));
      }
}

static lean_object * lb_read_274af85abd2df6cb24ee(pTHX_ lbp_scope *scope, SV *value) {

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
        lean_object * item = lb_read_fc95d19b5edc3a6ae7ea(aTHX_ scope, sv_2mortal(SvREFCNT_inc(*entry)));
        lean_array_set_core(result, i, (lean_inc(item), item));
      }
      return result;
}
static SV *lb_write_274af85abd2df6cb24ee(pTHX_ lbp_scope *scope, lean_object * value) {

      
      size_t length = lean_array_size(value);
      if (length > 16 * 1024 * 1024 / sizeof(void *)) croak("native copied array exceeds the 16 MiB per-call limit");
      lbp_budget(scope, length * sizeof(void *));
      AV *array = (AV *)sv_2mortal((SV *)newAV());
      for (size_t i = 0; i < length; ++i) {
        SV *item = lb_write_fc95d19b5edc3a6ae7ea(aTHX_ scope, lean_array_get_core(value, i));
        av_push(array, SvREFCNT_inc(item));
      }
      return lbp_mortal(newRV_inc((SV *)array));
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

static lean_object * lb_read_d53e659a13ae624cd586(pTHX_ lbp_scope *scope, SV *value) {

      SvGETMAGIC(value); lbp_budget(scope, sizeof(void *));
      if (!SvOK(value)) return lbp_keep(scope, lb_td53e659a13ae624cd586_none(lean_box(0)));
      if (lbp_is_branch(value, "LeanBridge::StructuralSubtypes::Some")) {
        lean_object * item = lb_read_75ac24c77bb2fef233a2(aTHX_ scope, lbp_branch_value(aTHX_ value, "LeanBridge::StructuralSubtypes::Some"));
        lean_inc(item);
        return lbp_keep(scope, lb_td53e659a13ae624cd586_some(item));
      }
      croak("Option requires undef or the generated Some class");
}
static SV *lb_write_d53e659a13ae624cd586(pTHX_ lbp_scope *scope, lean_object * value) {

      lbp_budget(scope, sizeof(void *));
      lean_inc(value); uint8_t present = lb_td53e659a13ae624cd586_has(value);
      if (!present) return lbp_mortal(newSV(0));
       {
        lean_inc(value); lean_object * item = lb_td53e659a13ae624cd586_get0(value);
        lbp_keep(scope, item);
        return lbp_branch(aTHX_ "LeanBridge::StructuralSubtypes::Some", lb_write_75ac24c77bb2fef233a2(aTHX_ scope, item));
      }
}

static lean_object * lb_read_9009c0d4e53637c1de0f(pTHX_ lbp_scope *scope, SV *value) {

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
        lean_object * item = lb_read_d53e659a13ae624cd586(aTHX_ scope, sv_2mortal(SvREFCNT_inc(*entry)));
        lean_array_set_core(result, i, (lean_inc(item), item));
      }
      lean_inc(result); return lbp_keep(scope, lb_t9009c0d4e53637c1de0f_from_array(result));
}
static SV *lb_write_9009c0d4e53637c1de0f(pTHX_ lbp_scope *scope, lean_object * value) {

      lean_inc(value); value = lbp_keep(scope, lb_t9009c0d4e53637c1de0f_to_array(value));
      size_t length = lean_array_size(value);
      if (length > 16 * 1024 * 1024 / sizeof(void *)) croak("native copied array exceeds the 16 MiB per-call limit");
      lbp_budget(scope, length * sizeof(void *));
      AV *array = (AV *)sv_2mortal((SV *)newAV());
      for (size_t i = 0; i < length; ++i) {
        SV *item = lb_write_d53e659a13ae624cd586(aTHX_ scope, lean_array_get_core(value, i));
        av_push(array, SvREFCNT_inc(item));
      }
      return lbp_mortal(newRV_inc((SV *)array));
}

static lean_object * lb_read_336715e4bb81c4e69d6b(pTHX_ lbp_scope *scope, SV *value) {

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
        lean_object * item = lb_read_9009c0d4e53637c1de0f(aTHX_ scope, sv_2mortal(SvREFCNT_inc(*entry)));
        lean_array_set_core(result, i, (lean_inc(item), item));
      }
      return result;
}
static SV *lb_write_336715e4bb81c4e69d6b(pTHX_ lbp_scope *scope, lean_object * value) {

      
      size_t length = lean_array_size(value);
      if (length > 16 * 1024 * 1024 / sizeof(void *)) croak("native copied array exceeds the 16 MiB per-call limit");
      lbp_budget(scope, length * sizeof(void *));
      AV *array = (AV *)sv_2mortal((SV *)newAV());
      for (size_t i = 0; i < length; ++i) {
        SV *item = lb_write_9009c0d4e53637c1de0f(aTHX_ scope, lean_array_get_core(value, i));
        av_push(array, SvREFCNT_inc(item));
      }
      return lbp_mortal(newRV_inc((SV *)array));
}

static lean_object * lb_read_54b454fa5cf029ff92b0(pTHX_ lbp_scope *scope, SV *value) {

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
      lean_object * a1 = lb_read_fef73841aaed14bc1688(aTHX_ scope, slot1);
      lean_inc(a0); lean_inc(a1);
      return lbp_keep(scope, lb_t54b454fa5cf029ff92b0_make(a0, a1));
}
static SV *lb_write_54b454fa5cf029ff92b0(pTHX_ lbp_scope *scope, lean_object * value) {

      lbp_budget(scope, 2 * sizeof(void *));
      AV *output = (AV *)sv_2mortal((SV *)newAV());
      lean_inc(value); lean_object * a0 = lb_t54b454fa5cf029ff92b0_get0(value);
      lbp_keep(scope, a0);
      av_push(output, SvREFCNT_inc(lb_write_bcb803bc837008bec599(aTHX_ scope, a0)));
      lean_inc(value); lean_object * a1 = lb_t54b454fa5cf029ff92b0_get1(value);
      lbp_keep(scope, a1);
      av_push(output, SvREFCNT_inc(lb_write_fef73841aaed14bc1688(aTHX_ scope, a1)));
      return lbp_mortal(newRV_inc((SV *)output));
}

MODULE = LeanBridge::StructuralSubtypes    PACKAGE = LeanBridge::StructuralSubtypes
PROTOTYPES: DISABLE


void
alias_arguments(...)
  PPCODE:
    if (items != 2) croak("alias_arguments expects 2 arguments");
    lbp_check_interpreter(aTHX);
    lbp_component_ready(aTHX);
    LBP_ENTER();
    lean_object * a0 = lb_read_cbf1a822cab24c3df8da(aTHX_ scope, ST(0));
    lean_object * a1 = lb_read_cbf1a822cab24c3df8da(aTHX_ scope, ST(1));
    { 
      for (size_t k0 = 0; k0 < lean_array_size(a0); ++k0) { lean_object *e0 = lean_array_get_core(a0, k0);
      { lean_inc(e0); if (lb_t3d0403c7f86fde2ead4d_has(e0)) { lean_inc(e0); lean_object * v1_0 = lbp_keep(scope, lb_t3d0403c7f86fde2ead4d_get0(e0));
      lean_inc(v1_0); if (!lb_486d24ee5849ed09fee4459f_refinement_0_0_0(v1_0)) croak("%s[%zu]? was rejected by StructuralSubtypes.checkedPositive", "value0", (size_t)k0); } } } }
    { 
      for (size_t k0 = 0; k0 < lean_array_size(a1); ++k0) { lean_object *e0 = lean_array_get_core(a1, k0);
      { lean_inc(e0); if (lb_t3d0403c7f86fde2ead4d_has(e0)) { lean_inc(e0); lean_object * v1_0 = lbp_keep(scope, lb_t3d0403c7f86fde2ead4d_get0(e0));
      lean_inc(v1_0); if (!lb_486d24ee5849ed09fee4459f_refinement_1_0_0(v1_0)) croak("%s[%zu]? was rejected by StructuralSubtypes.normalizePositive", "value1", (size_t)k0); } } } }
    lean_inc(a0); lean_inc(a1);
    lean_object *checked = lb_486d24ee5849ed09fee4459f(a0, a1);
    if (lean_is_scalar(checked)) croak("Lean rejected an argument outside its checked refinement");
    lean_object *boxed = lean_ctor_get(checked, 0);
    lean_inc(boxed);
    lean_object * result = boxed;
    lean_dec(checked);
    lbp_keep(scope, result);
    lbp_finish(aTHX_ scope);
    lbp_component_ready(aTHX);
    SV *out = lb_write_cbf1a822cab24c3df8da(aTHX_ scope, result);
    lbp_component_ready(aTHX);
    SvREFCNT_inc(out);
    LBP_LEAVE();
    ST(0) = sv_2mortal(out);
    XSRETURN(1);


void
alias_pair(...)
  PPCODE:
    if (items != 1) croak("alias_pair expects 1 arguments");
    lbp_check_interpreter(aTHX);
    lbp_component_ready(aTHX);
    LBP_ENTER();
    lean_object * a0 = lb_read_97011fb08c2a924880ed(aTHX_ scope, ST(0));
    { lean_inc(a0); lean_object * v0_0 = lbp_keep(scope, lb_t97011fb08c2a924880ed_get0(a0));
      { 
      for (size_t k1 = 0; k1 < lean_array_size(v0_0); ++k1) { lean_object *e1 = lean_array_get_core(v0_0, k1);
      { lean_inc(e1); if (lb_t3d0403c7f86fde2ead4d_has(e1)) { lean_inc(e1); lean_object * v2_0 = lbp_keep(scope, lb_t3d0403c7f86fde2ead4d_get0(e1));
      lean_inc(v2_0); if (!lb_85ecd6046aa1f73f83abcf27_refinement_0_0_0_0(v2_0)) croak("%s.0[%zu]? was rejected by StructuralSubtypes.checkedPositive", "value0", (size_t)k1); } } } }
      lean_inc(a0); lean_object * v0_1 = lbp_keep(scope, lb_t97011fb08c2a924880ed_get1(a0));
      { 
      for (size_t k1 = 0; k1 < lean_array_size(v0_1); ++k1) { lean_object *e1 = lean_array_get_core(v0_1, k1);
      { lean_inc(e1); if (lb_t3d0403c7f86fde2ead4d_has(e1)) { lean_inc(e1); lean_object * v2_0 = lbp_keep(scope, lb_t3d0403c7f86fde2ead4d_get0(e1));
      lean_inc(v2_0); if (!lb_85ecd6046aa1f73f83abcf27_refinement_0_1_0_0(v2_0)) croak("%s.1[%zu]? was rejected by StructuralSubtypes.normalizePositive", "value0", (size_t)k1); } } } } }
    lean_inc(a0);
    lean_object *checked = lb_85ecd6046aa1f73f83abcf27(a0);
    if (lean_is_scalar(checked)) croak("Lean rejected an argument outside its checked refinement");
    lean_object *boxed = lean_ctor_get(checked, 0);
    lean_inc(boxed);
    lean_object * result = boxed;
    lean_dec(checked);
    lbp_keep(scope, result);
    lbp_finish(aTHX_ scope);
    lbp_component_ready(aTHX);
    SV *out = lb_write_97011fb08c2a924880ed(aTHX_ scope, result);
    lbp_component_ready(aTHX);
    SvREFCNT_inc(out);
    LBP_LEAVE();
    ST(0) = sv_2mortal(out);
    XSRETURN(1);


void
arrays(...)
  PPCODE:
    if (items != 1) croak("arrays expects 1 arguments");
    lbp_check_interpreter(aTHX);
    lbp_component_ready(aTHX);
    LBP_ENTER();
    lean_object * a0 = lb_read_224517b0527dd01c7a6b(aTHX_ scope, ST(0));
    { 
      for (size_t k0 = 0; k0 < lean_array_size(a0); ++k0) { lean_object *e0 = lean_array_get_core(a0, k0);
      lean_inc(e0); if (!lb_a8afafdcdccfd487c60aab47_refinement_0_0(e0)) croak("%s[%zu] was rejected by StructuralSubtypes.checkedPositive", "value0", (size_t)k0); } }
    lean_inc(a0);
    lean_object *checked = lb_a8afafdcdccfd487c60aab47(a0);
    if (lean_is_scalar(checked)) croak("Lean rejected an argument outside its checked refinement");
    lean_object *boxed = lean_ctor_get(checked, 0);
    lean_inc(boxed);
    lean_object * result = boxed;
    lean_dec(checked);
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
    lean_object * a0 = lb_read_593a10b514c47b999735(aTHX_ scope, ST(0));
    { lean_inc(a0); if (lb_t593a10b514c47b999735_has(a0)) { lean_inc(a0); lean_object * v0_0 = lbp_keep(scope, lb_t593a10b514c47b999735_get0(a0));
      lean_inc(v0_0); if (!lb_78e54ba4d815e6e77c4895b1_refinement_0_0(v0_0)) croak("%s.ok was rejected by StructuralSubtypes.checkedPositive", "value0"); } else { lean_inc(a0); lean_object * v0_1 = lbp_keep(scope, lb_t593a10b514c47b999735_get1(a0));
      lean_inc(v0_1); if (!lb_78e54ba4d815e6e77c4895b1_refinement_0_1(v0_1)) croak("%s.error was rejected by StructuralSubtypes.checkedWord", "value0"); } }
    lean_inc(a0);
    lean_object *checked = lb_78e54ba4d815e6e77c4895b1(a0);
    if (lean_is_scalar(checked)) croak("Lean rejected an argument outside its checked refinement");
    lean_object *boxed = lean_ctor_get(checked, 0);
    lean_inc(boxed);
    lean_object * result = boxed;
    lean_dec(checked);
    lbp_keep(scope, result);
    lbp_finish(aTHX_ scope);
    lbp_component_ready(aTHX);
    SV *out = lb_write_593a10b514c47b999735(aTHX_ scope, result);
    lbp_component_ready(aTHX);
    SvREFCNT_inc(out);
    LBP_LEAVE();
    ST(0) = sv_2mortal(out);
    XSRETURN(1);


void
byte_branches(...)
  PPCODE:
    if (items != 1) croak("byte_branches expects 1 arguments");
    lbp_check_interpreter(aTHX);
    lbp_component_ready(aTHX);
    LBP_ENTER();
    lean_object * a0 = lb_read_274af85abd2df6cb24ee(aTHX_ scope, ST(0));
    { 
      for (size_t k0 = 0; k0 < lean_array_size(a0); ++k0) { lean_object *e0 = lean_array_get_core(a0, k0);
      { lean_inc(e0); if (lb_tfc95d19b5edc3a6ae7ea_has(e0)) { lean_inc(e0); lean_object * v1_0 = lbp_keep(scope, lb_tfc95d19b5edc3a6ae7ea_get0(e0));
      { lean_inc(v1_0); uint8_t v2_0 = lb_t36feb3e81b74ee424c50_get0(v1_0);
       if (!lb_d848cf752c7261f24cfd5b10_refinement_0_0_0_0(v2_0)) croak("%s[%zu]?.0 was rejected by StructuralSubtypes.checkedByte", "value0", (size_t)k0);
      lean_inc(v1_0); lean_object * v2_1 = lbp_keep(scope, lb_t36feb3e81b74ee424c50_get1(v1_0));
      lean_inc(v2_1); if (!lb_d848cf752c7261f24cfd5b10_refinement_0_0_0_1(v2_1)) croak("%s[%zu]?.1 was rejected by StructuralSubtypes.checkedPositive", "value0", (size_t)k0); } } } } }
    lean_inc(a0);
    lean_object *checked = lb_d848cf752c7261f24cfd5b10(a0);
    if (lean_is_scalar(checked)) croak("Lean rejected an argument outside its checked refinement");
    lean_object *boxed = lean_ctor_get(checked, 0);
    lean_inc(boxed);
    lean_object * result = boxed;
    lean_dec(checked);
    lbp_keep(scope, result);
    lbp_finish(aTHX_ scope);
    lbp_component_ready(aTHX);
    SV *out = lb_write_274af85abd2df6cb24ee(aTHX_ scope, result);
    lbp_component_ready(aTHX);
    SvREFCNT_inc(out);
    LBP_LEAVE();
    ST(0) = sv_2mortal(out);
    XSRETURN(1);


void
lists(...)
  PPCODE:
    if (items != 1) croak("lists expects 1 arguments");
    lbp_check_interpreter(aTHX);
    lbp_component_ready(aTHX);
    LBP_ENTER();
    lean_object * a0 = lb_read_f487892807ab67e30881(aTHX_ scope, ST(0));
    { lean_inc(a0); lean_object *items0 = lbp_keep(scope, lb_tf487892807ab67e30881_to_array(a0));
      for (size_t k0 = 0; k0 < lean_array_size(items0); ++k0) { lean_object *e0 = lean_array_get_core(items0, k0);
      lean_inc(e0); if (!lb_0b5409d057862ec3f96beec1_refinement_0_0(e0)) croak("%s[%zu] was rejected by StructuralSubtypes.checkedPositive", "value0", (size_t)k0); } }
    lean_inc(a0);
    lean_object *checked = lb_0b5409d057862ec3f96beec1(a0);
    if (lean_is_scalar(checked)) croak("Lean rejected an argument outside its checked refinement");
    lean_object *boxed = lean_ctor_get(checked, 0);
    lean_inc(boxed);
    lean_object * result = boxed;
    lean_dec(checked);
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
    lean_object * a0 = lb_read_336715e4bb81c4e69d6b(aTHX_ scope, ST(0));
    { 
      for (size_t k0 = 0; k0 < lean_array_size(a0); ++k0) { lean_object *e0 = lean_array_get_core(a0, k0);
      { lean_inc(e0); lean_object *items1 = lbp_keep(scope, lb_t9009c0d4e53637c1de0f_to_array(e0));
      for (size_t k1 = 0; k1 < lean_array_size(items1); ++k1) { lean_object *e1 = lean_array_get_core(items1, k1);
      { lean_inc(e1); if (lb_td53e659a13ae624cd586_has(e1)) { lean_inc(e1); lean_object *v2 = lbp_keep(scope, lb_td53e659a13ae624cd586_get0(e1));
      { lean_inc(v2); lean_object *v3_1 = lbp_keep(scope, lb_t75ac24c77bb2fef233a2_get1(v2));
      { lean_object *bound = lean_cstr_to_nat("184467440737095516170"); int below = lean_nat_lt(v3_1, bound); lean_dec(bound);
      if (!below) croak("%s[%zu][%zu]?.1 is not below its Fin 184467440737095516170 bound", "value0", (size_t)k0, (size_t)k1); } } } } } } } }
    { 
      for (size_t k0 = 0; k0 < lean_array_size(a0); ++k0) { lean_object *e0 = lean_array_get_core(a0, k0);
      { lean_inc(e0); lean_object *items1 = lbp_keep(scope, lb_t9009c0d4e53637c1de0f_to_array(e0));
      for (size_t k1 = 0; k1 < lean_array_size(items1); ++k1) { lean_object *e1 = lean_array_get_core(items1, k1);
      { lean_inc(e1); if (lb_td53e659a13ae624cd586_has(e1)) { lean_inc(e1); lean_object * v2_0 = lbp_keep(scope, lb_td53e659a13ae624cd586_get0(e1));
      { lean_inc(v2_0); lean_object * v3_0 = lbp_keep(scope, lb_t75ac24c77bb2fef233a2_get0(v2_0));
      lean_inc(v3_0); if (!lb_d0560c47cb866c2fde2d7214_refinement_0_0_0_0_0(v3_0)) croak("%s[%zu][%zu]?.0 was rejected by StructuralSubtypes.checkedPositive", "value0", (size_t)k0, (size_t)k1); } } } } } } }
    lean_inc(a0);
    lean_object *checked = lb_d0560c47cb866c2fde2d7214(a0);
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
options(...)
  PPCODE:
    if (items != 1) croak("options expects 1 arguments");
    lbp_check_interpreter(aTHX);
    lbp_component_ready(aTHX);
    LBP_ENTER();
    lean_object * a0 = lb_read_3d0403c7f86fde2ead4d(aTHX_ scope, ST(0));
    { lean_inc(a0); if (lb_t3d0403c7f86fde2ead4d_has(a0)) { lean_inc(a0); lean_object * v0_0 = lbp_keep(scope, lb_t3d0403c7f86fde2ead4d_get0(a0));
      lean_inc(v0_0); if (!lb_4518d0e9e129c150c099cebd_refinement_0_0(v0_0)) croak("%s? was rejected by StructuralSubtypes.checkedPositive", "value0"); } }
    lean_inc(a0);
    lean_object *checked = lb_4518d0e9e129c150c099cebd(a0);
    if (lean_is_scalar(checked)) croak("Lean rejected an argument outside its checked refinement");
    lean_object *boxed = lean_ctor_get(checked, 0);
    lean_inc(boxed);
    lean_object * result = boxed;
    lean_dec(checked);
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
plain_fin(...)
  PPCODE:
    if (items != 1) croak("plain_fin expects 1 arguments");
    lbp_check_interpreter(aTHX);
    lbp_component_ready(aTHX);
    LBP_ENTER();
    lean_object * a0 = lb_read_cbf1a822cab24c3df8da(aTHX_ scope, ST(0));
    { 
      for (size_t k0 = 0; k0 < lean_array_size(a0); ++k0) { lean_object *e0 = lean_array_get_core(a0, k0);
      { lean_inc(e0); if (lb_t3d0403c7f86fde2ead4d_has(e0)) { lean_inc(e0); lean_object *v1 = lbp_keep(scope, lb_t3d0403c7f86fde2ead4d_get0(e0));
      { lean_object *bound = lean_cstr_to_nat("10"); int below = lean_nat_lt(v1, bound); lean_dec(bound);
      if (!below) croak("%s[%zu]? is not below its Fin 10 bound", "value0", (size_t)k0); } } } } }
    lean_inc(a0);
    lean_object *checked = lb_9dc502b24e87182eae2912ae(a0);
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
product(...)
  PPCODE:
    if (items != 1) croak("product expects 1 arguments");
    lbp_check_interpreter(aTHX);
    lbp_component_ready(aTHX);
    LBP_ENTER();
    lean_object * a0 = lb_read_54b454fa5cf029ff92b0(aTHX_ scope, ST(0));
    { lean_inc(a0); lean_object * v0_0 = lbp_keep(scope, lb_t54b454fa5cf029ff92b0_get0(a0));
      lean_inc(v0_0); if (!lb_679f47fcbb2f10761b9db312_refinement_0_0(v0_0)) croak("%s.0 was rejected by StructuralSubtypes.checkedPositive", "value0");
      lean_inc(a0); lean_object * v0_1 = lbp_keep(scope, lb_t54b454fa5cf029ff92b0_get1(a0));
      lean_inc(v0_1); if (!lb_679f47fcbb2f10761b9db312_refinement_0_1(v0_1)) croak("%s.1 was rejected by StructuralSubtypes.checkedWord", "value0"); }
    lean_inc(a0);
    lean_object *checked = lb_679f47fcbb2f10761b9db312(a0);
    if (lean_is_scalar(checked)) croak("Lean rejected an argument outside its checked refinement");
    lean_object *boxed = lean_ctor_get(checked, 0);
    lean_inc(boxed);
    lean_object * result = boxed;
    lean_dec(checked);
    lbp_keep(scope, result);
    lbp_finish(aTHX_ scope);
    lbp_component_ready(aTHX);
    SV *out = lb_write_54b454fa5cf029ff92b0(aTHX_ scope, result);
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
    lean_inc(a0); if (!lb_76da6e2b36bf2bc74bb2d821_refinement_0(a0)) croak("%s", "value0 was rejected by StructuralSubtypes.checkedPositive");
    lean_inc(a0);
    lean_object *checked = lb_76da6e2b36bf2bc74bb2d821(a0);
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
specialized(...)
  PPCODE:
    if (items != 1) croak("specialized expects 1 arguments");
    lbp_check_interpreter(aTHX);
    lbp_component_ready(aTHX);
    LBP_ENTER();
    lean_object * a0 = lb_read_f487892807ab67e30881(aTHX_ scope, ST(0));
    { lean_inc(a0); lean_object *items0 = lbp_keep(scope, lb_tf487892807ab67e30881_to_array(a0));
      for (size_t k0 = 0; k0 < lean_array_size(items0); ++k0) { lean_object *e0 = lean_array_get_core(items0, k0);
      lean_inc(e0); if (!lb_9f6df65d361b8f96297241fd_refinement_0_0(e0)) croak("%s[%zu] was rejected by StructuralSubtypes.checkedPositive", "value0", (size_t)k0); } }
    lean_inc(a0);
    lean_object *checked = lb_9f6df65d361b8f96297241fd(a0);
    if (lean_is_scalar(checked)) croak("Lean rejected an argument outside its checked refinement");
    lean_object *boxed = lean_ctor_get(checked, 0);
    lean_inc(boxed);
    lean_object * result = boxed;
    lean_dec(checked);
    lbp_keep(scope, result);
    lbp_finish(aTHX_ scope);
    lbp_component_ready(aTHX);
    SV *out = lb_write_f487892807ab67e30881(aTHX_ scope, result);
    lbp_component_ready(aTHX);
    SvREFCNT_inc(out);
    LBP_LEAVE();
    ST(0) = sv_2mortal(out);
    XSRETURN(1);

BOOT:
  lbp_check_interpreter(aTHX);
  extern lean_object *initialize_LeanBridgeNative85dc6ef3dd30a6b6(uint8_t);
  if (!lean_bridge_native_component_initialize("structuralsubtypes@1.0.0:7e70da88f20e3c962b655518dcb523dbb8b60311b41b526133fb7c98c206eb5d", (lean_bridge_native_initializer)initialize_LeanBridgeNative85dc6ef3dd30a6b6)) croak("Lean component initialization failed");

