#include "runtime.h"
#include "component.h"
static void lbp_component_ready(pTHX) {
  if (!lean_bridge_native_component_ready("nominalprimitivesubtypes@1.0.0:58a916198cb50e5bb7fab57554591812a8381960749e100c43effecedd0a3672")) croak("Lean runtime is not ready or has been retired");
}

static lean_object * lb_read_c6349afd7d22f2e92812(pTHX_ lbp_scope *scope, SV *value) {
lbp_plain(aTHX_ value); if (SvOK(value)) croak("Unit requires undef"); return lean_box(0);
}
static SV *lb_write_c6349afd7d22f2e92812(pTHX_ lbp_scope *scope, lean_object * value) {
return lbp_mortal(newSV(0));
}

static uint8_t lb_read_4c1bd7bbac2488b31e7f(pTHX_ lbp_scope *scope, SV *value) {
lbp_plain(aTHX_ value); if (!SvIsBOOL(value)) croak("Bool requires true() or false()"); return SvTRUE(value) ? 1 : 0;
}
static SV *lb_write_4c1bd7bbac2488b31e7f(pTHX_ lbp_scope *scope, uint8_t value) {
return lbp_mortal(newSVsv(boolSV(value != 0)));
}

static uint8_t lb_read_23919de1caf8120217dd(pTHX_ lbp_scope *scope, SV *value) {
return (uint8_t)lbp_unsigned(aTHX_ value, UINT8_MAX);
}
static SV *lb_write_23919de1caf8120217dd(pTHX_ lbp_scope *scope, uint8_t value) {
return lbp_mortal(newSVuv(value));
}

static uint16_t lb_read_66a4c943a7df0371c684(pTHX_ lbp_scope *scope, SV *value) {
return (uint16_t)lbp_unsigned(aTHX_ value, UINT16_MAX);
}
static SV *lb_write_66a4c943a7df0371c684(pTHX_ lbp_scope *scope, uint16_t value) {
return lbp_mortal(newSVuv(value));
}

static uint32_t lb_read_c602b3c6c397cf3e3223(pTHX_ lbp_scope *scope, SV *value) {
return (uint32_t)lbp_unsigned(aTHX_ value, UINT32_MAX);
}
static SV *lb_write_c602b3c6c397cf3e3223(pTHX_ lbp_scope *scope, uint32_t value) {
return lbp_mortal(newSVuv(value));
}

static uint64_t lb_read_191823654e783c145e26(pTHX_ lbp_scope *scope, SV *value) {
return (uint64_t)lbp_unsigned(aTHX_ value, UINT64_MAX);
}
static SV *lb_write_191823654e783c145e26(pTHX_ lbp_scope *scope, uint64_t value) {
return lbp_mortal(newSVuv(value));
}

static uint8_t lb_read_c9eacfdf5c8ec3f9c0ed(pTHX_ lbp_scope *scope, SV *value) {
return (uint8_t)lbp_signed(aTHX_ value, INT8_MIN, INT8_MAX);
}
static SV *lb_write_c9eacfdf5c8ec3f9c0ed(pTHX_ lbp_scope *scope, uint8_t value) {
return lbp_mortal(newSViv((int8_t)value));
}

static uint16_t lb_read_d673606d4944004f46c9(pTHX_ lbp_scope *scope, SV *value) {
return (uint16_t)lbp_signed(aTHX_ value, INT16_MIN, INT16_MAX);
}
static SV *lb_write_d673606d4944004f46c9(pTHX_ lbp_scope *scope, uint16_t value) {
return lbp_mortal(newSViv((int16_t)value));
}

static uint32_t lb_read_fb7f69db7845eed9eabb(pTHX_ lbp_scope *scope, SV *value) {
return (uint32_t)lbp_signed(aTHX_ value, INT32_MIN, INT32_MAX);
}
static SV *lb_write_fb7f69db7845eed9eabb(pTHX_ lbp_scope *scope, uint32_t value) {
return lbp_mortal(newSViv((int32_t)value));
}

static uint64_t lb_read_691fb0481286cfcf9875(pTHX_ lbp_scope *scope, SV *value) {
return (uint64_t)lbp_signed(aTHX_ value, INT64_MIN, INT64_MAX);
}
static SV *lb_write_691fb0481286cfcf9875(pTHX_ lbp_scope *scope, uint64_t value) {
return lbp_mortal(newSViv((int64_t)value));
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

static lean_object * lb_read_09ff00cb13eed05963f7(pTHX_ lbp_scope *scope, SV *value) {

    SV *text = lbp_bigint_text(aTHX_ value, 0);
    STRLEN length; const char *bytes = SvPV(text, length); lbp_budget(scope, length);
    return lbp_keep(scope, lb_native_int_parse(lean_mk_string_from_bytes(bytes, length)));
}
static SV *lb_write_09ff00cb13eed05963f7(pTHX_ lbp_scope *scope, lean_object * value) {

    lean_inc(value); lean_object *text = lbp_keep(scope, lb_native_int_text(value));
    size_t length = lean_string_size(text) - 1; lbp_budget(scope, length);
    return lbp_bigint_from_text(aTHX_ lean_string_cstr(text), length);
}

static float lb_read_c98f2de98579b12ef543(pTHX_ lbp_scope *scope, SV *value) {
lbp_plain(aTHX_ value); if (!SvNOK(value) && !SvIOK(value)) croak("Float requires a numeric scalar"); return (float)SvNV(value);
}
static SV *lb_write_c98f2de98579b12ef543(pTHX_ lbp_scope *scope, float value) {
return lbp_mortal(newSVnv(value));
}

static double lb_read_d12c8761c89669fb53df(pTHX_ lbp_scope *scope, SV *value) {
lbp_plain(aTHX_ value); if (!SvNOK(value) && !SvIOK(value)) croak("Float requires a numeric scalar"); return (double)SvNV(value);
}
static SV *lb_write_d12c8761c89669fb53df(pTHX_ lbp_scope *scope, double value) {
return lbp_mortal(newSVnv(value));
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

static lean_object * lb_read_b02b5a1865a26e6f063c(pTHX_ lbp_scope *scope, SV *value) {

    lbp_plain(aTHX_ value); if (!SvPOK(value) || SvUTF8(value)) croak("ByteArray requires an octet string, not Unicode text");
    STRLEN length; const char *bytes = SvPV(value, length); lbp_budget(scope, length);
    lean_object *result = lbp_keep(scope, lean_alloc_sarray(1, length, length));
    memcpy(lean_sarray_cptr(result), bytes, length); return result;
}
static SV *lb_write_b02b5a1865a26e6f063c(pTHX_ lbp_scope *scope, lean_object * value) {

    size_t length = lean_sarray_size(value); lbp_budget(scope, length);
    return lbp_mortal(newSVpvn((const char *)lean_sarray_cptr(value), length));
}

static uint32_t lb_read_c448ba30be9a8e39d3a8(pTHX_ lbp_scope *scope, SV *value) {

    lbp_plain(aTHX_ value); if (!SvPOK(value)) croak("Char requires a text scalar");
    STRLEN length, consumed; const U8 *bytes = (const U8 *)SvPVutf8(value, length);
    if (!length || length > 4 || !is_utf8_string_flags(bytes, length, UTF8_DISALLOW_SURROGATE | UTF8_DISALLOW_SUPER)) croak("Char requires one Unicode scalar");
    UV point = utf8_to_uvchr_buf(bytes, bytes + length, &consumed);
    if (consumed != length) croak("Char requires one Unicode scalar");
    return (uint32_t)point;
}
static SV *lb_write_c448ba30be9a8e39d3a8(pTHX_ lbp_scope *scope, uint32_t value) {

    if (value > 0x10ffff || (value >= 0xd800 && value <= 0xdfff)) croak("Invalid native Unicode scalar");
    U8 bytes[UTF8_MAXBYTES]; U8 *end = uvchr_to_utf8(bytes, value);
    SV *result = lbp_mortal(newSVpvn((const char *)bytes, end - bytes)); SvUTF8_on(result); return result;
}

static size_t lb_read_cb33884480a2e3f9a69c(pTHX_ lbp_scope *scope, SV *value) {
return (size_t)lbp_unsigned(aTHX_ value, UINT64_MAX);
}
static SV *lb_write_cb33884480a2e3f9a69c(pTHX_ lbp_scope *scope, size_t value) {
return lbp_mortal(newSVuv(value));
}

static size_t lb_read_ba3a347c728cd58c7c63(pTHX_ lbp_scope *scope, SV *value) {
return (uint64_t)lbp_signed(aTHX_ value, INT64_MIN, INT64_MAX);
}
static SV *lb_write_ba3a347c728cd58c7c63(pTHX_ lbp_scope *scope, size_t value) {
return lbp_mortal(newSViv((int64_t)value));
}

static lean_object * lb_read_980449f277836feadaee(pTHX_ lbp_scope *scope, SV *value) {

      SvGETMAGIC(value);
      if (!lbp_is_branch(value, "LeanBridge::NominalPrimitiveSubtypes::Packet")) croak("expected LeanBridge::NominalPrimitiveSubtypes::Packet with an exact class and plain untied hash");
      if (HvUSEDKEYS((HV *)SvRV(value)) != 20) croak("record fields do not match the generated schema");
      HV *input = (HV *)sv_2mortal(SvREFCNT_inc(SvRV(value)));
      lbp_budget(scope, 20 * sizeof(void *));
      /* Pin every field before a child converter can invoke Perl code. */
      SV *slot0 = lbp_field(aTHX_ input, "unitValue", 9);
      SV *slot1 = lbp_field(aTHX_ input, "boolValue", 9);
      SV *slot2 = lbp_field(aTHX_ input, "uint8Value", 10);
      SV *slot3 = lbp_field(aTHX_ input, "uint16Value", 11);
      SV *slot4 = lbp_field(aTHX_ input, "uint32Value", 11);
      SV *slot5 = lbp_field(aTHX_ input, "uint64Value", 11);
      SV *slot6 = lbp_field(aTHX_ input, "int8Value", 9);
      SV *slot7 = lbp_field(aTHX_ input, "int16Value", 10);
      SV *slot8 = lbp_field(aTHX_ input, "int32Value", 10);
      SV *slot9 = lbp_field(aTHX_ input, "int64Value", 10);
      SV *slot10 = lbp_field(aTHX_ input, "natValue", 8);
      SV *slot11 = lbp_field(aTHX_ input, "intValue", 8);
      SV *slot12 = lbp_field(aTHX_ input, "float32Value", 12);
      SV *slot13 = lbp_field(aTHX_ input, "float64Value", 12);
      SV *slot14 = lbp_field(aTHX_ input, "textValue", 9);
      SV *slot15 = lbp_field(aTHX_ input, "bytesValue", 10);
      SV *slot16 = lbp_field(aTHX_ input, "charValue", 9);
      SV *slot17 = lbp_field(aTHX_ input, "usizeValue", 10);
      SV *slot18 = lbp_field(aTHX_ input, "isizeValue", 10);
      SV *slot19 = lbp_field(aTHX_ input, "digit", 5);
      lean_object * a0 = lb_read_c6349afd7d22f2e92812(aTHX_ scope, slot0);
      uint8_t a1 = lb_read_4c1bd7bbac2488b31e7f(aTHX_ scope, slot1);
      uint8_t a2 = lb_read_23919de1caf8120217dd(aTHX_ scope, slot2);
      uint16_t a3 = lb_read_66a4c943a7df0371c684(aTHX_ scope, slot3);
      uint32_t a4 = lb_read_c602b3c6c397cf3e3223(aTHX_ scope, slot4);
      uint64_t a5 = lb_read_191823654e783c145e26(aTHX_ scope, slot5);
      uint8_t a6 = lb_read_c9eacfdf5c8ec3f9c0ed(aTHX_ scope, slot6);
      uint16_t a7 = lb_read_d673606d4944004f46c9(aTHX_ scope, slot7);
      uint32_t a8 = lb_read_fb7f69db7845eed9eabb(aTHX_ scope, slot8);
      uint64_t a9 = lb_read_691fb0481286cfcf9875(aTHX_ scope, slot9);
      lean_object * a10 = lb_read_bcb803bc837008bec599(aTHX_ scope, slot10);
      lean_object * a11 = lb_read_09ff00cb13eed05963f7(aTHX_ scope, slot11);
      float a12 = lb_read_c98f2de98579b12ef543(aTHX_ scope, slot12);
      double a13 = lb_read_d12c8761c89669fb53df(aTHX_ scope, slot13);
      lean_object * a14 = lb_read_fef73841aaed14bc1688(aTHX_ scope, slot14);
      lean_object * a15 = lb_read_b02b5a1865a26e6f063c(aTHX_ scope, slot15);
      uint32_t a16 = lb_read_c448ba30be9a8e39d3a8(aTHX_ scope, slot16);
      size_t a17 = lb_read_cb33884480a2e3f9a69c(aTHX_ scope, slot17);
      size_t a18 = lb_read_ba3a347c728cd58c7c63(aTHX_ scope, slot18);
      lean_object * a19 = lb_read_bcb803bc837008bec599(aTHX_ scope, slot19);
      lean_inc(a0);          lean_inc(a10); lean_inc(a11);   lean_inc(a14); lean_inc(a15);    lean_inc(a19);
      return lbp_keep(scope, lb_t980449f277836feadaee_make(a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15, a16, a17, a18, a19));
}
static SV *lb_write_980449f277836feadaee(pTHX_ lbp_scope *scope, lean_object * value) {

      lbp_budget(scope, 20 * sizeof(void *));
      HV *record = (HV *)sv_2mortal((SV *)newHV());
      lean_inc(value); lean_object * a0 = lb_t980449f277836feadaee_get0(value);
      lbp_keep(scope, a0);
      hv_store(record, "unitValue", 9, SvREFCNT_inc(lb_write_c6349afd7d22f2e92812(aTHX_ scope, a0)), 0);
      lean_inc(value); uint8_t a1 = lb_t980449f277836feadaee_get1(value);
      
      hv_store(record, "boolValue", 9, SvREFCNT_inc(lb_write_4c1bd7bbac2488b31e7f(aTHX_ scope, a1)), 0);
      lean_inc(value); uint8_t a2 = lb_t980449f277836feadaee_get2(value);
      
      hv_store(record, "uint8Value", 10, SvREFCNT_inc(lb_write_23919de1caf8120217dd(aTHX_ scope, a2)), 0);
      lean_inc(value); uint16_t a3 = lb_t980449f277836feadaee_get3(value);
      
      hv_store(record, "uint16Value", 11, SvREFCNT_inc(lb_write_66a4c943a7df0371c684(aTHX_ scope, a3)), 0);
      lean_inc(value); uint32_t a4 = lb_t980449f277836feadaee_get4(value);
      
      hv_store(record, "uint32Value", 11, SvREFCNT_inc(lb_write_c602b3c6c397cf3e3223(aTHX_ scope, a4)), 0);
      lean_inc(value); uint64_t a5 = lb_t980449f277836feadaee_get5(value);
      
      hv_store(record, "uint64Value", 11, SvREFCNT_inc(lb_write_191823654e783c145e26(aTHX_ scope, a5)), 0);
      lean_inc(value); uint8_t a6 = lb_t980449f277836feadaee_get6(value);
      
      hv_store(record, "int8Value", 9, SvREFCNT_inc(lb_write_c9eacfdf5c8ec3f9c0ed(aTHX_ scope, a6)), 0);
      lean_inc(value); uint16_t a7 = lb_t980449f277836feadaee_get7(value);
      
      hv_store(record, "int16Value", 10, SvREFCNT_inc(lb_write_d673606d4944004f46c9(aTHX_ scope, a7)), 0);
      lean_inc(value); uint32_t a8 = lb_t980449f277836feadaee_get8(value);
      
      hv_store(record, "int32Value", 10, SvREFCNT_inc(lb_write_fb7f69db7845eed9eabb(aTHX_ scope, a8)), 0);
      lean_inc(value); uint64_t a9 = lb_t980449f277836feadaee_get9(value);
      
      hv_store(record, "int64Value", 10, SvREFCNT_inc(lb_write_691fb0481286cfcf9875(aTHX_ scope, a9)), 0);
      lean_inc(value); lean_object * a10 = lb_t980449f277836feadaee_get10(value);
      lbp_keep(scope, a10);
      hv_store(record, "natValue", 8, SvREFCNT_inc(lb_write_bcb803bc837008bec599(aTHX_ scope, a10)), 0);
      lean_inc(value); lean_object * a11 = lb_t980449f277836feadaee_get11(value);
      lbp_keep(scope, a11);
      hv_store(record, "intValue", 8, SvREFCNT_inc(lb_write_09ff00cb13eed05963f7(aTHX_ scope, a11)), 0);
      lean_inc(value); float a12 = lb_t980449f277836feadaee_get12(value);
      
      hv_store(record, "float32Value", 12, SvREFCNT_inc(lb_write_c98f2de98579b12ef543(aTHX_ scope, a12)), 0);
      lean_inc(value); double a13 = lb_t980449f277836feadaee_get13(value);
      
      hv_store(record, "float64Value", 12, SvREFCNT_inc(lb_write_d12c8761c89669fb53df(aTHX_ scope, a13)), 0);
      lean_inc(value); lean_object * a14 = lb_t980449f277836feadaee_get14(value);
      lbp_keep(scope, a14);
      hv_store(record, "textValue", 9, SvREFCNT_inc(lb_write_fef73841aaed14bc1688(aTHX_ scope, a14)), 0);
      lean_inc(value); lean_object * a15 = lb_t980449f277836feadaee_get15(value);
      lbp_keep(scope, a15);
      hv_store(record, "bytesValue", 10, SvREFCNT_inc(lb_write_b02b5a1865a26e6f063c(aTHX_ scope, a15)), 0);
      lean_inc(value); uint32_t a16 = lb_t980449f277836feadaee_get16(value);
      
      hv_store(record, "charValue", 9, SvREFCNT_inc(lb_write_c448ba30be9a8e39d3a8(aTHX_ scope, a16)), 0);
      lean_inc(value); size_t a17 = lb_t980449f277836feadaee_get17(value);
      
      hv_store(record, "usizeValue", 10, SvREFCNT_inc(lb_write_cb33884480a2e3f9a69c(aTHX_ scope, a17)), 0);
      lean_inc(value); size_t a18 = lb_t980449f277836feadaee_get18(value);
      
      hv_store(record, "isizeValue", 10, SvREFCNT_inc(lb_write_ba3a347c728cd58c7c63(aTHX_ scope, a18)), 0);
      lean_inc(value); lean_object * a19 = lb_t980449f277836feadaee_get19(value);
      lbp_keep(scope, a19);
      hv_store(record, "digit", 5, SvREFCNT_inc(lb_write_bcb803bc837008bec599(aTHX_ scope, a19)), 0);
      return sv_bless(lbp_mortal(newRV_inc((SV *)record)), gv_stashpv("LeanBridge::NominalPrimitiveSubtypes::Packet", GV_ADD));
}

static lean_object * lb_read_d552bec1d6b17ed5222c(pTHX_ lbp_scope *scope, SV *value) {

      SvGETMAGIC(value); lbp_budget(scope, sizeof(void *));
      if (!SvOK(value)) return lbp_keep(scope, lb_td552bec1d6b17ed5222c_none(lean_box(0)));
      if (lbp_is_branch(value, "LeanBridge::NominalPrimitiveSubtypes::Some")) {
        lean_object * item = lb_read_980449f277836feadaee(aTHX_ scope, lbp_branch_value(aTHX_ value, "LeanBridge::NominalPrimitiveSubtypes::Some"));
        lean_inc(item);
        return lbp_keep(scope, lb_td552bec1d6b17ed5222c_some(item));
      }
      croak("Option requires undef or the generated Some class");
}
static SV *lb_write_d552bec1d6b17ed5222c(pTHX_ lbp_scope *scope, lean_object * value) {

      lbp_budget(scope, sizeof(void *));
      lean_inc(value); uint8_t present = lb_td552bec1d6b17ed5222c_has(value);
      if (!present) return lbp_mortal(newSV(0));
       {
        lean_inc(value); lean_object * item = lb_td552bec1d6b17ed5222c_get0(value);
        lbp_keep(scope, item);
        return lbp_branch(aTHX_ "LeanBridge::NominalPrimitiveSubtypes::Some", lb_write_980449f277836feadaee(aTHX_ scope, item));
      }
}

static lean_object * lb_read_f23b7206f2ff3fe94418(pTHX_ lbp_scope *scope, SV *value) {

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
        lean_object * item = lb_read_d552bec1d6b17ed5222c(aTHX_ scope, sv_2mortal(SvREFCNT_inc(*entry)));
        lean_array_set_core(result, i, (lean_inc(item), item));
      }
      return result;
}
static SV *lb_write_f23b7206f2ff3fe94418(pTHX_ lbp_scope *scope, lean_object * value) {

      
      size_t length = lean_array_size(value);
      if (length > 16 * 1024 * 1024 / sizeof(void *)) croak("native copied array exceeds the 16 MiB per-call limit");
      lbp_budget(scope, length * sizeof(void *));
      AV *array = (AV *)sv_2mortal((SV *)newAV());
      for (size_t i = 0; i < length; ++i) {
        SV *item = lb_write_d552bec1d6b17ed5222c(aTHX_ scope, lean_array_get_core(value, i));
        av_push(array, SvREFCNT_inc(item));
      }
      return lbp_mortal(newRV_inc((SV *)array));
}

static lean_object * lb_read_493235f6d5e0c330066f(pTHX_ lbp_scope *scope, SV *value) {

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
      lean_object * a0 = lb_read_980449f277836feadaee(aTHX_ scope, slot0);
      lean_object * a1 = lb_read_980449f277836feadaee(aTHX_ scope, slot1);
      lean_inc(a0); lean_inc(a1);
      return lbp_keep(scope, lb_t493235f6d5e0c330066f_make(a0, a1));
}
static SV *lb_write_493235f6d5e0c330066f(pTHX_ lbp_scope *scope, lean_object * value) {

      lbp_budget(scope, 2 * sizeof(void *));
      AV *output = (AV *)sv_2mortal((SV *)newAV());
      lean_inc(value); lean_object * a0 = lb_t493235f6d5e0c330066f_get0(value);
      lbp_keep(scope, a0);
      av_push(output, SvREFCNT_inc(lb_write_980449f277836feadaee(aTHX_ scope, a0)));
      lean_inc(value); lean_object * a1 = lb_t493235f6d5e0c330066f_get1(value);
      lbp_keep(scope, a1);
      av_push(output, SvREFCNT_inc(lb_write_980449f277836feadaee(aTHX_ scope, a1)));
      return lbp_mortal(newRV_inc((SV *)output));
}

static lean_object * lb_read_d367e4fc052df6d1c32d(pTHX_ lbp_scope *scope, SV *value) {

      SvGETMAGIC(value); lbp_budget(scope, sizeof(void *));
      
      if (lbp_is_branch(value, "LeanBridge::NominalPrimitiveSubtypes::Ok")) {
        lean_object * item = lb_read_980449f277836feadaee(aTHX_ scope, lbp_branch_value(aTHX_ value, "LeanBridge::NominalPrimitiveSubtypes::Ok"));
        lean_inc(item);
        return lbp_keep(scope, lb_td367e4fc052df6d1c32d_ok(item));
      }
      if (lbp_is_branch(value, "LeanBridge::NominalPrimitiveSubtypes::Err")) {
        lean_object * item = lb_read_980449f277836feadaee(aTHX_ scope, lbp_branch_value(aTHX_ value, "LeanBridge::NominalPrimitiveSubtypes::Err"));
        lean_inc(item);
        return lbp_keep(scope, lb_td367e4fc052df6d1c32d_error(item));
      }
      croak("Except requires the generated Ok or Err class");
}
static SV *lb_write_d367e4fc052df6d1c32d(pTHX_ lbp_scope *scope, lean_object * value) {

      lbp_budget(scope, sizeof(void *));
      lean_inc(value); uint8_t present = lb_td367e4fc052df6d1c32d_has(value);
      
      if (present) {
        lean_inc(value); lean_object * item = lb_td367e4fc052df6d1c32d_get0(value);
        lbp_keep(scope, item);
        return lbp_branch(aTHX_ "LeanBridge::NominalPrimitiveSubtypes::Ok", lb_write_980449f277836feadaee(aTHX_ scope, item));
      }
      else {
        lean_inc(value); lean_object * item = lb_td367e4fc052df6d1c32d_get1(value);
        lbp_keep(scope, item);
        return lbp_branch(aTHX_ "LeanBridge::NominalPrimitiveSubtypes::Err", lb_write_980449f277836feadaee(aTHX_ scope, item));
      }
}

static lean_object * lb_read_5a1383905e3435e418a9(pTHX_ lbp_scope *scope, SV *value) {

      SvGETMAGIC(value); lbp_budget(scope, sizeof(void *));
      if (!SvOK(value)) return lbp_keep(scope, lb_t5a1383905e3435e418a9_none(lean_box(0)));
      if (lbp_is_branch(value, "LeanBridge::NominalPrimitiveSubtypes::Some")) {
        lean_object * item = lb_read_d367e4fc052df6d1c32d(aTHX_ scope, lbp_branch_value(aTHX_ value, "LeanBridge::NominalPrimitiveSubtypes::Some"));
        lean_inc(item);
        return lbp_keep(scope, lb_t5a1383905e3435e418a9_some(item));
      }
      croak("Option requires undef or the generated Some class");
}
static SV *lb_write_5a1383905e3435e418a9(pTHX_ lbp_scope *scope, lean_object * value) {

      lbp_budget(scope, sizeof(void *));
      lean_inc(value); uint8_t present = lb_t5a1383905e3435e418a9_has(value);
      if (!present) return lbp_mortal(newSV(0));
       {
        lean_inc(value); lean_object * item = lb_t5a1383905e3435e418a9_get0(value);
        lbp_keep(scope, item);
        return lbp_branch(aTHX_ "LeanBridge::NominalPrimitiveSubtypes::Some", lb_write_d367e4fc052df6d1c32d(aTHX_ scope, item));
      }
}

static lean_object * lb_read_6cf14f8ea88b103e24a3(pTHX_ lbp_scope *scope, SV *value) {

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
        lean_object * item = lb_read_5a1383905e3435e418a9(aTHX_ scope, sv_2mortal(SvREFCNT_inc(*entry)));
        lean_array_set_core(result, i, (lean_inc(item), item));
      }
      return result;
}
static SV *lb_write_6cf14f8ea88b103e24a3(pTHX_ lbp_scope *scope, lean_object * value) {

      
      size_t length = lean_array_size(value);
      if (length > 16 * 1024 * 1024 / sizeof(void *)) croak("native copied array exceeds the 16 MiB per-call limit");
      lbp_budget(scope, length * sizeof(void *));
      AV *array = (AV *)sv_2mortal((SV *)newAV());
      for (size_t i = 0; i < length; ++i) {
        SV *item = lb_write_5a1383905e3435e418a9(aTHX_ scope, lean_array_get_core(value, i));
        av_push(array, SvREFCNT_inc(item));
      }
      return lbp_mortal(newRV_inc((SV *)array));
}

static lean_object * lb_read_466ade0f8f5195fb9b51(pTHX_ lbp_scope *scope, SV *value) {

      SvGETMAGIC(value);
      if (lbp_is_branch(value, "LeanBridge::NominalPrimitiveSubtypes::Event::Empty")) {
        HV *input = (HV *)sv_2mortal(SvREFCNT_inc(SvRV(value)));
        if (HvUSEDKEYS(input) != 0) croak("constructor fields do not match the generated schema");
        lbp_budget(scope, 1 * sizeof(void *));
        /* Pin all fields before a child converter can invoke Perl code. */


        
        return lbp_keep(scope, lb_t466ade0f8f5195fb9b51_make0(lean_box(0)));
      }
      if (lbp_is_branch(value, "LeanBridge::NominalPrimitiveSubtypes::Event::Box")) {
        HV *input = (HV *)sv_2mortal(SvREFCNT_inc(SvRV(value)));
        if (HvUSEDKEYS(input) != 1) croak("constructor fields do not match the generated schema");
        lbp_budget(scope, 2 * sizeof(void *));
        /* Pin all fields before a child converter can invoke Perl code. */
        SV *slot0 = lbp_field(aTHX_ input, "value", 5);
        lean_object * a0 = lb_read_980449f277836feadaee(aTHX_ scope, slot0);
        lean_inc(a0);
        return lbp_keep(scope, lb_t466ade0f8f5195fb9b51_make1(a0));
      }
      if (lbp_is_branch(value, "LeanBridge::NominalPrimitiveSubtypes::Event::Choices")) {
        HV *input = (HV *)sv_2mortal(SvREFCNT_inc(SvRV(value)));
        if (HvUSEDKEYS(input) != 1) croak("constructor fields do not match the generated schema");
        lbp_budget(scope, 2 * sizeof(void *));
        /* Pin all fields before a child converter can invoke Perl code. */
        SV *slot0 = lbp_field(aTHX_ input, "values", 6);
        lean_object * a0 = lb_read_6cf14f8ea88b103e24a3(aTHX_ scope, slot0);
        lean_inc(a0);
        return lbp_keep(scope, lb_t466ade0f8f5195fb9b51_make2(a0));
      }
      croak("expected an exact LeanBridge::NominalPrimitiveSubtypes::Event constructor with a plain untied hash");
}
static SV *lb_write_466ade0f8f5195fb9b51(pTHX_ lbp_scope *scope, lean_object * value) {

      lean_inc(value); uint32_t tag = lb_t466ade0f8f5195fb9b51_tag(value);
      switch (tag) {
      case 0: {
        lbp_budget(scope, 1 * sizeof(void *));
        HV *output = (HV *)sv_2mortal((SV *)newHV());

        return sv_bless(lbp_mortal(newRV_inc((SV *)output)), gv_stashpv("LeanBridge::NominalPrimitiveSubtypes::Event::Empty", GV_ADD));
      }
      case 1: {
        lbp_budget(scope, 2 * sizeof(void *));
        HV *output = (HV *)sv_2mortal((SV *)newHV());
        lean_inc(value); lean_object * a0 = lb_t466ade0f8f5195fb9b51_get1_0(value);
        lbp_keep(scope, a0);
        hv_store(output, "value", 5, SvREFCNT_inc(lb_write_980449f277836feadaee(aTHX_ scope, a0)), 0);
        return sv_bless(lbp_mortal(newRV_inc((SV *)output)), gv_stashpv("LeanBridge::NominalPrimitiveSubtypes::Event::Box", GV_ADD));
      }
      case 2: {
        lbp_budget(scope, 2 * sizeof(void *));
        HV *output = (HV *)sv_2mortal((SV *)newHV());
        lean_inc(value); lean_object * a0 = lb_t466ade0f8f5195fb9b51_get2_0(value);
        lbp_keep(scope, a0);
        hv_store(output, "values", 6, SvREFCNT_inc(lb_write_6cf14f8ea88b103e24a3(aTHX_ scope, a0)), 0);
        return sv_bless(lbp_mortal(newRV_inc((SV *)output)), gv_stashpv("LeanBridge::NominalPrimitiveSubtypes::Event::Choices", GV_ADD));
      }
      default: croak("Invalid native LeanBridge::NominalPrimitiveSubtypes::Event constructor");
      }
}

static lean_object * lb_read_bb4f1df77db4bc2e5592(pTHX_ lbp_scope *scope, SV *value) {

      SvGETMAGIC(value);
      if (!lbp_is_branch(value, "LeanBridge::NominalPrimitiveSubtypes::Pair")) croak("expected LeanBridge::NominalPrimitiveSubtypes::Pair with an exact class and plain untied hash");
      if (HvUSEDKEYS((HV *)SvRV(value)) != 2) croak("record fields do not match the generated schema");
      HV *input = (HV *)sv_2mortal(SvREFCNT_inc(SvRV(value)));
      lbp_budget(scope, 2 * sizeof(void *));
      /* Pin every field before a child converter can invoke Perl code. */
      SV *slot0 = lbp_field(aTHX_ input, "left", 4);
      SV *slot1 = lbp_field(aTHX_ input, "right", 5);
      lean_object * a0 = lb_read_f23b7206f2ff3fe94418(aTHX_ scope, slot0);
      lean_object * a1 = lb_read_f23b7206f2ff3fe94418(aTHX_ scope, slot1);
      lean_inc(a0); lean_inc(a1);
      return lbp_keep(scope, lb_tbb4f1df77db4bc2e5592_make(a0, a1));
}
static SV *lb_write_bb4f1df77db4bc2e5592(pTHX_ lbp_scope *scope, lean_object * value) {

      lbp_budget(scope, 2 * sizeof(void *));
      HV *record = (HV *)sv_2mortal((SV *)newHV());
      lean_inc(value); lean_object * a0 = lb_tbb4f1df77db4bc2e5592_get0(value);
      lbp_keep(scope, a0);
      hv_store(record, "left", 4, SvREFCNT_inc(lb_write_f23b7206f2ff3fe94418(aTHX_ scope, a0)), 0);
      lean_inc(value); lean_object * a1 = lb_tbb4f1df77db4bc2e5592_get1(value);
      lbp_keep(scope, a1);
      hv_store(record, "right", 5, SvREFCNT_inc(lb_write_f23b7206f2ff3fe94418(aTHX_ scope, a1)), 0);
      return sv_bless(lbp_mortal(newRV_inc((SV *)record)), gv_stashpv("LeanBridge::NominalPrimitiveSubtypes::Pair", GV_ADD));
}

static lean_object * lb_read_6ed79f4a8a3bc4358259(pTHX_ lbp_scope *scope, SV *value) {

      SvGETMAGIC(value);
      if (!lbp_is_branch(value, "LeanBridge::NominalPrimitiveSubtypes::RawPacket")) croak("expected LeanBridge::NominalPrimitiveSubtypes::RawPacket with an exact class and plain untied hash");
      if (HvUSEDKEYS((HV *)SvRV(value)) != 20) croak("record fields do not match the generated schema");
      HV *input = (HV *)sv_2mortal(SvREFCNT_inc(SvRV(value)));
      lbp_budget(scope, 20 * sizeof(void *));
      /* Pin every field before a child converter can invoke Perl code. */
      SV *slot0 = lbp_field(aTHX_ input, "unitValue", 9);
      SV *slot1 = lbp_field(aTHX_ input, "boolValue", 9);
      SV *slot2 = lbp_field(aTHX_ input, "uint8Value", 10);
      SV *slot3 = lbp_field(aTHX_ input, "uint16Value", 11);
      SV *slot4 = lbp_field(aTHX_ input, "uint32Value", 11);
      SV *slot5 = lbp_field(aTHX_ input, "uint64Value", 11);
      SV *slot6 = lbp_field(aTHX_ input, "int8Value", 9);
      SV *slot7 = lbp_field(aTHX_ input, "int16Value", 10);
      SV *slot8 = lbp_field(aTHX_ input, "int32Value", 10);
      SV *slot9 = lbp_field(aTHX_ input, "int64Value", 10);
      SV *slot10 = lbp_field(aTHX_ input, "natValue", 8);
      SV *slot11 = lbp_field(aTHX_ input, "intValue", 8);
      SV *slot12 = lbp_field(aTHX_ input, "float32Value", 12);
      SV *slot13 = lbp_field(aTHX_ input, "float64Value", 12);
      SV *slot14 = lbp_field(aTHX_ input, "textValue", 9);
      SV *slot15 = lbp_field(aTHX_ input, "bytesValue", 10);
      SV *slot16 = lbp_field(aTHX_ input, "charValue", 9);
      SV *slot17 = lbp_field(aTHX_ input, "usizeValue", 10);
      SV *slot18 = lbp_field(aTHX_ input, "isizeValue", 10);
      SV *slot19 = lbp_field(aTHX_ input, "digit", 5);
      lean_object * a0 = lb_read_c6349afd7d22f2e92812(aTHX_ scope, slot0);
      uint8_t a1 = lb_read_4c1bd7bbac2488b31e7f(aTHX_ scope, slot1);
      uint8_t a2 = lb_read_23919de1caf8120217dd(aTHX_ scope, slot2);
      uint16_t a3 = lb_read_66a4c943a7df0371c684(aTHX_ scope, slot3);
      uint32_t a4 = lb_read_c602b3c6c397cf3e3223(aTHX_ scope, slot4);
      uint64_t a5 = lb_read_191823654e783c145e26(aTHX_ scope, slot5);
      uint8_t a6 = lb_read_c9eacfdf5c8ec3f9c0ed(aTHX_ scope, slot6);
      uint16_t a7 = lb_read_d673606d4944004f46c9(aTHX_ scope, slot7);
      uint32_t a8 = lb_read_fb7f69db7845eed9eabb(aTHX_ scope, slot8);
      uint64_t a9 = lb_read_691fb0481286cfcf9875(aTHX_ scope, slot9);
      lean_object * a10 = lb_read_bcb803bc837008bec599(aTHX_ scope, slot10);
      lean_object * a11 = lb_read_09ff00cb13eed05963f7(aTHX_ scope, slot11);
      float a12 = lb_read_c98f2de98579b12ef543(aTHX_ scope, slot12);
      double a13 = lb_read_d12c8761c89669fb53df(aTHX_ scope, slot13);
      lean_object * a14 = lb_read_fef73841aaed14bc1688(aTHX_ scope, slot14);
      lean_object * a15 = lb_read_b02b5a1865a26e6f063c(aTHX_ scope, slot15);
      uint32_t a16 = lb_read_c448ba30be9a8e39d3a8(aTHX_ scope, slot16);
      size_t a17 = lb_read_cb33884480a2e3f9a69c(aTHX_ scope, slot17);
      size_t a18 = lb_read_ba3a347c728cd58c7c63(aTHX_ scope, slot18);
      lean_object * a19 = lb_read_bcb803bc837008bec599(aTHX_ scope, slot19);
      lean_inc(a0);          lean_inc(a10); lean_inc(a11);   lean_inc(a14); lean_inc(a15);    lean_inc(a19);
      return lbp_keep(scope, lb_t6ed79f4a8a3bc4358259_make(a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15, a16, a17, a18, a19));
}
static SV *lb_write_6ed79f4a8a3bc4358259(pTHX_ lbp_scope *scope, lean_object * value) {

      lbp_budget(scope, 20 * sizeof(void *));
      HV *record = (HV *)sv_2mortal((SV *)newHV());
      lean_inc(value); lean_object * a0 = lb_t6ed79f4a8a3bc4358259_get0(value);
      lbp_keep(scope, a0);
      hv_store(record, "unitValue", 9, SvREFCNT_inc(lb_write_c6349afd7d22f2e92812(aTHX_ scope, a0)), 0);
      lean_inc(value); uint8_t a1 = lb_t6ed79f4a8a3bc4358259_get1(value);
      
      hv_store(record, "boolValue", 9, SvREFCNT_inc(lb_write_4c1bd7bbac2488b31e7f(aTHX_ scope, a1)), 0);
      lean_inc(value); uint8_t a2 = lb_t6ed79f4a8a3bc4358259_get2(value);
      
      hv_store(record, "uint8Value", 10, SvREFCNT_inc(lb_write_23919de1caf8120217dd(aTHX_ scope, a2)), 0);
      lean_inc(value); uint16_t a3 = lb_t6ed79f4a8a3bc4358259_get3(value);
      
      hv_store(record, "uint16Value", 11, SvREFCNT_inc(lb_write_66a4c943a7df0371c684(aTHX_ scope, a3)), 0);
      lean_inc(value); uint32_t a4 = lb_t6ed79f4a8a3bc4358259_get4(value);
      
      hv_store(record, "uint32Value", 11, SvREFCNT_inc(lb_write_c602b3c6c397cf3e3223(aTHX_ scope, a4)), 0);
      lean_inc(value); uint64_t a5 = lb_t6ed79f4a8a3bc4358259_get5(value);
      
      hv_store(record, "uint64Value", 11, SvREFCNT_inc(lb_write_191823654e783c145e26(aTHX_ scope, a5)), 0);
      lean_inc(value); uint8_t a6 = lb_t6ed79f4a8a3bc4358259_get6(value);
      
      hv_store(record, "int8Value", 9, SvREFCNT_inc(lb_write_c9eacfdf5c8ec3f9c0ed(aTHX_ scope, a6)), 0);
      lean_inc(value); uint16_t a7 = lb_t6ed79f4a8a3bc4358259_get7(value);
      
      hv_store(record, "int16Value", 10, SvREFCNT_inc(lb_write_d673606d4944004f46c9(aTHX_ scope, a7)), 0);
      lean_inc(value); uint32_t a8 = lb_t6ed79f4a8a3bc4358259_get8(value);
      
      hv_store(record, "int32Value", 10, SvREFCNT_inc(lb_write_fb7f69db7845eed9eabb(aTHX_ scope, a8)), 0);
      lean_inc(value); uint64_t a9 = lb_t6ed79f4a8a3bc4358259_get9(value);
      
      hv_store(record, "int64Value", 10, SvREFCNT_inc(lb_write_691fb0481286cfcf9875(aTHX_ scope, a9)), 0);
      lean_inc(value); lean_object * a10 = lb_t6ed79f4a8a3bc4358259_get10(value);
      lbp_keep(scope, a10);
      hv_store(record, "natValue", 8, SvREFCNT_inc(lb_write_bcb803bc837008bec599(aTHX_ scope, a10)), 0);
      lean_inc(value); lean_object * a11 = lb_t6ed79f4a8a3bc4358259_get11(value);
      lbp_keep(scope, a11);
      hv_store(record, "intValue", 8, SvREFCNT_inc(lb_write_09ff00cb13eed05963f7(aTHX_ scope, a11)), 0);
      lean_inc(value); float a12 = lb_t6ed79f4a8a3bc4358259_get12(value);
      
      hv_store(record, "float32Value", 12, SvREFCNT_inc(lb_write_c98f2de98579b12ef543(aTHX_ scope, a12)), 0);
      lean_inc(value); double a13 = lb_t6ed79f4a8a3bc4358259_get13(value);
      
      hv_store(record, "float64Value", 12, SvREFCNT_inc(lb_write_d12c8761c89669fb53df(aTHX_ scope, a13)), 0);
      lean_inc(value); lean_object * a14 = lb_t6ed79f4a8a3bc4358259_get14(value);
      lbp_keep(scope, a14);
      hv_store(record, "textValue", 9, SvREFCNT_inc(lb_write_fef73841aaed14bc1688(aTHX_ scope, a14)), 0);
      lean_inc(value); lean_object * a15 = lb_t6ed79f4a8a3bc4358259_get15(value);
      lbp_keep(scope, a15);
      hv_store(record, "bytesValue", 10, SvREFCNT_inc(lb_write_b02b5a1865a26e6f063c(aTHX_ scope, a15)), 0);
      lean_inc(value); uint32_t a16 = lb_t6ed79f4a8a3bc4358259_get16(value);
      
      hv_store(record, "charValue", 9, SvREFCNT_inc(lb_write_c448ba30be9a8e39d3a8(aTHX_ scope, a16)), 0);
      lean_inc(value); size_t a17 = lb_t6ed79f4a8a3bc4358259_get17(value);
      
      hv_store(record, "usizeValue", 10, SvREFCNT_inc(lb_write_cb33884480a2e3f9a69c(aTHX_ scope, a17)), 0);
      lean_inc(value); size_t a18 = lb_t6ed79f4a8a3bc4358259_get18(value);
      
      hv_store(record, "isizeValue", 10, SvREFCNT_inc(lb_write_ba3a347c728cd58c7c63(aTHX_ scope, a18)), 0);
      lean_inc(value); lean_object * a19 = lb_t6ed79f4a8a3bc4358259_get19(value);
      lbp_keep(scope, a19);
      hv_store(record, "digit", 5, SvREFCNT_inc(lb_write_bcb803bc837008bec599(aTHX_ scope, a19)), 0);
      return sv_bless(lbp_mortal(newRV_inc((SV *)record)), gv_stashpv("LeanBridge::NominalPrimitiveSubtypes::RawPacket", GV_ADD));
}

MODULE = LeanBridge::NominalPrimitiveSubtypes    PACKAGE = LeanBridge::NominalPrimitiveSubtypes
PROTOTYPES: DISABLE


void
aliases(...)
  PPCODE:
    if (items != 2) croak("aliases expects 2 arguments");
    lbp_check_interpreter(aTHX);
    lbp_component_ready(aTHX);
    LBP_ENTER();
    lean_object * a0 = lb_read_f23b7206f2ff3fe94418(aTHX_ scope, ST(0));
    lean_object * a1 = lb_read_f23b7206f2ff3fe94418(aTHX_ scope, ST(1));
    { 
      for (size_t k0 = 0; k0 < lean_array_size(a0); ++k0) { lean_object *e0 = lean_array_get_core(a0, k0);
      { lean_inc(e0); if (lb_td552bec1d6b17ed5222c_has(e0)) { lean_inc(e0); lean_object *v1 = lbp_keep(scope, lb_td552bec1d6b17ed5222c_get0(e0));
      { lean_inc(v1); lean_object *v2_19 = lbp_keep(scope, lb_t980449f277836feadaee_get19(v1));
      { lean_object *bound = lean_cstr_to_nat("3"); int below = lean_nat_lt(v2_19, bound); lean_dec(bound);
      if (!below) croak("%s[%zu]?.digit is not below its Fin 3 bound", "arg0", (size_t)k0); } } } } } }
    { 
      for (size_t k0 = 0; k0 < lean_array_size(a1); ++k0) { lean_object *e0 = lean_array_get_core(a1, k0);
      { lean_inc(e0); if (lb_td552bec1d6b17ed5222c_has(e0)) { lean_inc(e0); lean_object *v1 = lbp_keep(scope, lb_td552bec1d6b17ed5222c_get0(e0));
      { lean_inc(v1); lean_object *v2_19 = lbp_keep(scope, lb_t980449f277836feadaee_get19(v1));
      { lean_object *bound = lean_cstr_to_nat("3"); int below = lean_nat_lt(v2_19, bound); lean_dec(bound);
      if (!below) croak("%s[%zu]?.digit is not below its Fin 3 bound", "arg1", (size_t)k0); } } } } } }
    { 
      for (size_t k0 = 0; k0 < lean_array_size(a0); ++k0) { lean_object *e0 = lean_array_get_core(a0, k0);
      { lean_inc(e0); if (lb_td552bec1d6b17ed5222c_has(e0)) { lean_inc(e0); lean_object * v1_0 = lbp_keep(scope, lb_td552bec1d6b17ed5222c_get0(e0));
      { lean_inc(v1_0); lean_object * v2_0 = lbp_keep(scope, lb_t980449f277836feadaee_get0(v1_0));
      lean_inc(v2_0); if (!lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_0(v2_0)) croak("%s[%zu]?.unitValue was rejected by NominalPrimitiveSubtypes.unitA", "arg0", (size_t)k0);
      lean_inc(v1_0); uint8_t v2_1 = lb_t980449f277836feadaee_get1(v1_0);
       if (!lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_1(v2_1)) croak("%s[%zu]?.boolValue was rejected by NominalPrimitiveSubtypes.boolA", "arg0", (size_t)k0);
      lean_inc(v1_0); uint8_t v2_2 = lb_t980449f277836feadaee_get2(v1_0);
       if (!lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_2(v2_2)) croak("%s[%zu]?.uint8Value was rejected by NominalPrimitiveSubtypes.uint8A", "arg0", (size_t)k0);
      lean_inc(v1_0); uint16_t v2_3 = lb_t980449f277836feadaee_get3(v1_0);
       if (!lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_3(v2_3)) croak("%s[%zu]?.uint16Value was rejected by NominalPrimitiveSubtypes.uint16A", "arg0", (size_t)k0);
      lean_inc(v1_0); uint32_t v2_4 = lb_t980449f277836feadaee_get4(v1_0);
       if (!lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_4(v2_4)) croak("%s[%zu]?.uint32Value was rejected by NominalPrimitiveSubtypes.uint32A", "arg0", (size_t)k0);
      lean_inc(v1_0); uint64_t v2_5 = lb_t980449f277836feadaee_get5(v1_0);
       if (!lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_5(v2_5)) croak("%s[%zu]?.uint64Value was rejected by NominalPrimitiveSubtypes.uint64A", "arg0", (size_t)k0);
      lean_inc(v1_0); uint8_t v2_6 = lb_t980449f277836feadaee_get6(v1_0);
       if (!lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_6(v2_6)) croak("%s[%zu]?.int8Value was rejected by NominalPrimitiveSubtypes.int8A", "arg0", (size_t)k0);
      lean_inc(v1_0); uint16_t v2_7 = lb_t980449f277836feadaee_get7(v1_0);
       if (!lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_7(v2_7)) croak("%s[%zu]?.int16Value was rejected by NominalPrimitiveSubtypes.int16A", "arg0", (size_t)k0);
      lean_inc(v1_0); uint32_t v2_8 = lb_t980449f277836feadaee_get8(v1_0);
       if (!lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_8(v2_8)) croak("%s[%zu]?.int32Value was rejected by NominalPrimitiveSubtypes.int32A", "arg0", (size_t)k0);
      lean_inc(v1_0); uint64_t v2_9 = lb_t980449f277836feadaee_get9(v1_0);
       if (!lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_9(v2_9)) croak("%s[%zu]?.int64Value was rejected by NominalPrimitiveSubtypes.int64A", "arg0", (size_t)k0);
      lean_inc(v1_0); lean_object * v2_10 = lbp_keep(scope, lb_t980449f277836feadaee_get10(v1_0));
      lean_inc(v2_10); if (!lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_10(v2_10)) croak("%s[%zu]?.natValue was rejected by NominalPrimitiveSubtypes.natA", "arg0", (size_t)k0);
      lean_inc(v1_0); lean_object * v2_11 = lbp_keep(scope, lb_t980449f277836feadaee_get11(v1_0));
      lean_inc(v2_11); if (!lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_11(v2_11)) croak("%s[%zu]?.intValue was rejected by NominalPrimitiveSubtypes.intA", "arg0", (size_t)k0);
      lean_inc(v1_0); float v2_12 = lb_t980449f277836feadaee_get12(v1_0);
       if (!lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_12(v2_12)) croak("%s[%zu]?.float32Value was rejected by NominalPrimitiveSubtypes.float32A", "arg0", (size_t)k0);
      lean_inc(v1_0); double v2_13 = lb_t980449f277836feadaee_get13(v1_0);
       if (!lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_13(v2_13)) croak("%s[%zu]?.float64Value was rejected by NominalPrimitiveSubtypes.float64A", "arg0", (size_t)k0);
      lean_inc(v1_0); lean_object * v2_14 = lbp_keep(scope, lb_t980449f277836feadaee_get14(v1_0));
      lean_inc(v2_14); if (!lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_14(v2_14)) croak("%s[%zu]?.textValue was rejected by NominalPrimitiveSubtypes.textA", "arg0", (size_t)k0);
      lean_inc(v1_0); lean_object * v2_15 = lbp_keep(scope, lb_t980449f277836feadaee_get15(v1_0));
      lean_inc(v2_15); if (!lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_15(v2_15)) croak("%s[%zu]?.bytesValue was rejected by NominalPrimitiveSubtypes.bytesA", "arg0", (size_t)k0);
      lean_inc(v1_0); uint32_t v2_16 = lb_t980449f277836feadaee_get16(v1_0);
       if (!lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_16(v2_16)) croak("%s[%zu]?.charValue was rejected by NominalPrimitiveSubtypes.charA", "arg0", (size_t)k0);
      lean_inc(v1_0); size_t v2_17 = lb_t980449f277836feadaee_get17(v1_0);
       if (!lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_17(v2_17)) croak("%s[%zu]?.usizeValue was rejected by NominalPrimitiveSubtypes.usizeA", "arg0", (size_t)k0);
      lean_inc(v1_0); size_t v2_18 = lb_t980449f277836feadaee_get18(v1_0);
       if (!lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_18(v2_18)) croak("%s[%zu]?.isizeValue was rejected by NominalPrimitiveSubtypes.isizeA", "arg0", (size_t)k0); } } } } }
    { 
      for (size_t k0 = 0; k0 < lean_array_size(a1); ++k0) { lean_object *e0 = lean_array_get_core(a1, k0);
      { lean_inc(e0); if (lb_td552bec1d6b17ed5222c_has(e0)) { lean_inc(e0); lean_object * v1_0 = lbp_keep(scope, lb_td552bec1d6b17ed5222c_get0(e0));
      { lean_inc(v1_0); lean_object * v2_0 = lbp_keep(scope, lb_t980449f277836feadaee_get0(v1_0));
      lean_inc(v2_0); if (!lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_0(v2_0)) croak("%s[%zu]?.unitValue was rejected by NominalPrimitiveSubtypes.unitB", "arg1", (size_t)k0);
      lean_inc(v1_0); uint8_t v2_1 = lb_t980449f277836feadaee_get1(v1_0);
       if (!lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_1(v2_1)) croak("%s[%zu]?.boolValue was rejected by NominalPrimitiveSubtypes.boolB", "arg1", (size_t)k0);
      lean_inc(v1_0); uint8_t v2_2 = lb_t980449f277836feadaee_get2(v1_0);
       if (!lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_2(v2_2)) croak("%s[%zu]?.uint8Value was rejected by NominalPrimitiveSubtypes.uint8B", "arg1", (size_t)k0);
      lean_inc(v1_0); uint16_t v2_3 = lb_t980449f277836feadaee_get3(v1_0);
       if (!lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_3(v2_3)) croak("%s[%zu]?.uint16Value was rejected by NominalPrimitiveSubtypes.uint16B", "arg1", (size_t)k0);
      lean_inc(v1_0); uint32_t v2_4 = lb_t980449f277836feadaee_get4(v1_0);
       if (!lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_4(v2_4)) croak("%s[%zu]?.uint32Value was rejected by NominalPrimitiveSubtypes.uint32B", "arg1", (size_t)k0);
      lean_inc(v1_0); uint64_t v2_5 = lb_t980449f277836feadaee_get5(v1_0);
       if (!lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_5(v2_5)) croak("%s[%zu]?.uint64Value was rejected by NominalPrimitiveSubtypes.uint64B", "arg1", (size_t)k0);
      lean_inc(v1_0); uint8_t v2_6 = lb_t980449f277836feadaee_get6(v1_0);
       if (!lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_6(v2_6)) croak("%s[%zu]?.int8Value was rejected by NominalPrimitiveSubtypes.int8B", "arg1", (size_t)k0);
      lean_inc(v1_0); uint16_t v2_7 = lb_t980449f277836feadaee_get7(v1_0);
       if (!lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_7(v2_7)) croak("%s[%zu]?.int16Value was rejected by NominalPrimitiveSubtypes.int16B", "arg1", (size_t)k0);
      lean_inc(v1_0); uint32_t v2_8 = lb_t980449f277836feadaee_get8(v1_0);
       if (!lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_8(v2_8)) croak("%s[%zu]?.int32Value was rejected by NominalPrimitiveSubtypes.int32B", "arg1", (size_t)k0);
      lean_inc(v1_0); uint64_t v2_9 = lb_t980449f277836feadaee_get9(v1_0);
       if (!lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_9(v2_9)) croak("%s[%zu]?.int64Value was rejected by NominalPrimitiveSubtypes.int64B", "arg1", (size_t)k0);
      lean_inc(v1_0); lean_object * v2_10 = lbp_keep(scope, lb_t980449f277836feadaee_get10(v1_0));
      lean_inc(v2_10); if (!lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_10(v2_10)) croak("%s[%zu]?.natValue was rejected by NominalPrimitiveSubtypes.natB", "arg1", (size_t)k0);
      lean_inc(v1_0); lean_object * v2_11 = lbp_keep(scope, lb_t980449f277836feadaee_get11(v1_0));
      lean_inc(v2_11); if (!lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_11(v2_11)) croak("%s[%zu]?.intValue was rejected by NominalPrimitiveSubtypes.intB", "arg1", (size_t)k0);
      lean_inc(v1_0); float v2_12 = lb_t980449f277836feadaee_get12(v1_0);
       if (!lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_12(v2_12)) croak("%s[%zu]?.float32Value was rejected by NominalPrimitiveSubtypes.float32B", "arg1", (size_t)k0);
      lean_inc(v1_0); double v2_13 = lb_t980449f277836feadaee_get13(v1_0);
       if (!lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_13(v2_13)) croak("%s[%zu]?.float64Value was rejected by NominalPrimitiveSubtypes.float64B", "arg1", (size_t)k0);
      lean_inc(v1_0); lean_object * v2_14 = lbp_keep(scope, lb_t980449f277836feadaee_get14(v1_0));
      lean_inc(v2_14); if (!lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_14(v2_14)) croak("%s[%zu]?.textValue was rejected by NominalPrimitiveSubtypes.textB", "arg1", (size_t)k0);
      lean_inc(v1_0); lean_object * v2_15 = lbp_keep(scope, lb_t980449f277836feadaee_get15(v1_0));
      lean_inc(v2_15); if (!lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_15(v2_15)) croak("%s[%zu]?.bytesValue was rejected by NominalPrimitiveSubtypes.bytesB", "arg1", (size_t)k0);
      lean_inc(v1_0); uint32_t v2_16 = lb_t980449f277836feadaee_get16(v1_0);
       if (!lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_16(v2_16)) croak("%s[%zu]?.charValue was rejected by NominalPrimitiveSubtypes.charB", "arg1", (size_t)k0);
      lean_inc(v1_0); size_t v2_17 = lb_t980449f277836feadaee_get17(v1_0);
       if (!lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_17(v2_17)) croak("%s[%zu]?.usizeValue was rejected by NominalPrimitiveSubtypes.usizeB", "arg1", (size_t)k0);
      lean_inc(v1_0); size_t v2_18 = lb_t980449f277836feadaee_get18(v1_0);
       if (!lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_18(v2_18)) croak("%s[%zu]?.isizeValue was rejected by NominalPrimitiveSubtypes.isizeB", "arg1", (size_t)k0); } } } } }
    lean_inc(a0); lean_inc(a1);
    lean_object *checked = lb_ad1aedc6e1a2dda5a7c9a643(a0, a1);
    if (lean_is_scalar(checked)) croak("Lean rejected an argument outside its checked refinement");
    lean_object *boxed = lean_ctor_get(checked, 0);
    lean_inc(boxed);
    lean_object * result = boxed;
    lean_dec(checked);
    lbp_keep(scope, result);
    lbp_finish(aTHX_ scope);
    lbp_component_ready(aTHX);
    SV *out = lb_write_f23b7206f2ff3fe94418(aTHX_ scope, result);
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
    lean_object * a0 = lb_read_980449f277836feadaee(aTHX_ scope, ST(0));
    lean_object * a1 = lb_read_980449f277836feadaee(aTHX_ scope, ST(1));
    { lean_inc(a0); lean_object *v0_19 = lbp_keep(scope, lb_t980449f277836feadaee_get19(a0));
      { lean_object *bound = lean_cstr_to_nat("3"); int below = lean_nat_lt(v0_19, bound); lean_dec(bound);
      if (!below) croak("%s.digit is not below its Fin 3 bound", "arg0"); } }
    { lean_inc(a1); lean_object *v0_19 = lbp_keep(scope, lb_t980449f277836feadaee_get19(a1));
      { lean_object *bound = lean_cstr_to_nat("3"); int below = lean_nat_lt(v0_19, bound); lean_dec(bound);
      if (!below) croak("%s.digit is not below its Fin 3 bound", "arg1"); } }
    { lean_inc(a0); lean_object * v0_0 = lbp_keep(scope, lb_t980449f277836feadaee_get0(a0));
      lean_inc(v0_0); if (!lb_f830d4f947d8993755fe2eda_refinement_0_0(v0_0)) croak("%s.unitValue was rejected by NominalPrimitiveSubtypes.unitA", "arg0");
      lean_inc(a0); uint8_t v0_1 = lb_t980449f277836feadaee_get1(a0);
       if (!lb_f830d4f947d8993755fe2eda_refinement_0_1(v0_1)) croak("%s.boolValue was rejected by NominalPrimitiveSubtypes.boolA", "arg0");
      lean_inc(a0); uint8_t v0_2 = lb_t980449f277836feadaee_get2(a0);
       if (!lb_f830d4f947d8993755fe2eda_refinement_0_2(v0_2)) croak("%s.uint8Value was rejected by NominalPrimitiveSubtypes.uint8A", "arg0");
      lean_inc(a0); uint16_t v0_3 = lb_t980449f277836feadaee_get3(a0);
       if (!lb_f830d4f947d8993755fe2eda_refinement_0_3(v0_3)) croak("%s.uint16Value was rejected by NominalPrimitiveSubtypes.uint16A", "arg0");
      lean_inc(a0); uint32_t v0_4 = lb_t980449f277836feadaee_get4(a0);
       if (!lb_f830d4f947d8993755fe2eda_refinement_0_4(v0_4)) croak("%s.uint32Value was rejected by NominalPrimitiveSubtypes.uint32A", "arg0");
      lean_inc(a0); uint64_t v0_5 = lb_t980449f277836feadaee_get5(a0);
       if (!lb_f830d4f947d8993755fe2eda_refinement_0_5(v0_5)) croak("%s.uint64Value was rejected by NominalPrimitiveSubtypes.uint64A", "arg0");
      lean_inc(a0); uint8_t v0_6 = lb_t980449f277836feadaee_get6(a0);
       if (!lb_f830d4f947d8993755fe2eda_refinement_0_6(v0_6)) croak("%s.int8Value was rejected by NominalPrimitiveSubtypes.int8A", "arg0");
      lean_inc(a0); uint16_t v0_7 = lb_t980449f277836feadaee_get7(a0);
       if (!lb_f830d4f947d8993755fe2eda_refinement_0_7(v0_7)) croak("%s.int16Value was rejected by NominalPrimitiveSubtypes.int16A", "arg0");
      lean_inc(a0); uint32_t v0_8 = lb_t980449f277836feadaee_get8(a0);
       if (!lb_f830d4f947d8993755fe2eda_refinement_0_8(v0_8)) croak("%s.int32Value was rejected by NominalPrimitiveSubtypes.int32A", "arg0");
      lean_inc(a0); uint64_t v0_9 = lb_t980449f277836feadaee_get9(a0);
       if (!lb_f830d4f947d8993755fe2eda_refinement_0_9(v0_9)) croak("%s.int64Value was rejected by NominalPrimitiveSubtypes.int64A", "arg0");
      lean_inc(a0); lean_object * v0_10 = lbp_keep(scope, lb_t980449f277836feadaee_get10(a0));
      lean_inc(v0_10); if (!lb_f830d4f947d8993755fe2eda_refinement_0_10(v0_10)) croak("%s.natValue was rejected by NominalPrimitiveSubtypes.natA", "arg0");
      lean_inc(a0); lean_object * v0_11 = lbp_keep(scope, lb_t980449f277836feadaee_get11(a0));
      lean_inc(v0_11); if (!lb_f830d4f947d8993755fe2eda_refinement_0_11(v0_11)) croak("%s.intValue was rejected by NominalPrimitiveSubtypes.intA", "arg0");
      lean_inc(a0); float v0_12 = lb_t980449f277836feadaee_get12(a0);
       if (!lb_f830d4f947d8993755fe2eda_refinement_0_12(v0_12)) croak("%s.float32Value was rejected by NominalPrimitiveSubtypes.float32A", "arg0");
      lean_inc(a0); double v0_13 = lb_t980449f277836feadaee_get13(a0);
       if (!lb_f830d4f947d8993755fe2eda_refinement_0_13(v0_13)) croak("%s.float64Value was rejected by NominalPrimitiveSubtypes.float64A", "arg0");
      lean_inc(a0); lean_object * v0_14 = lbp_keep(scope, lb_t980449f277836feadaee_get14(a0));
      lean_inc(v0_14); if (!lb_f830d4f947d8993755fe2eda_refinement_0_14(v0_14)) croak("%s.textValue was rejected by NominalPrimitiveSubtypes.textA", "arg0");
      lean_inc(a0); lean_object * v0_15 = lbp_keep(scope, lb_t980449f277836feadaee_get15(a0));
      lean_inc(v0_15); if (!lb_f830d4f947d8993755fe2eda_refinement_0_15(v0_15)) croak("%s.bytesValue was rejected by NominalPrimitiveSubtypes.bytesA", "arg0");
      lean_inc(a0); uint32_t v0_16 = lb_t980449f277836feadaee_get16(a0);
       if (!lb_f830d4f947d8993755fe2eda_refinement_0_16(v0_16)) croak("%s.charValue was rejected by NominalPrimitiveSubtypes.charA", "arg0");
      lean_inc(a0); size_t v0_17 = lb_t980449f277836feadaee_get17(a0);
       if (!lb_f830d4f947d8993755fe2eda_refinement_0_17(v0_17)) croak("%s.usizeValue was rejected by NominalPrimitiveSubtypes.usizeA", "arg0");
      lean_inc(a0); size_t v0_18 = lb_t980449f277836feadaee_get18(a0);
       if (!lb_f830d4f947d8993755fe2eda_refinement_0_18(v0_18)) croak("%s.isizeValue was rejected by NominalPrimitiveSubtypes.isizeA", "arg0"); }
    { lean_inc(a1); lean_object * v0_0 = lbp_keep(scope, lb_t980449f277836feadaee_get0(a1));
      lean_inc(v0_0); if (!lb_f830d4f947d8993755fe2eda_refinement_1_0(v0_0)) croak("%s.unitValue was rejected by NominalPrimitiveSubtypes.unitB", "arg1");
      lean_inc(a1); uint8_t v0_1 = lb_t980449f277836feadaee_get1(a1);
       if (!lb_f830d4f947d8993755fe2eda_refinement_1_1(v0_1)) croak("%s.boolValue was rejected by NominalPrimitiveSubtypes.boolB", "arg1");
      lean_inc(a1); uint8_t v0_2 = lb_t980449f277836feadaee_get2(a1);
       if (!lb_f830d4f947d8993755fe2eda_refinement_1_2(v0_2)) croak("%s.uint8Value was rejected by NominalPrimitiveSubtypes.uint8B", "arg1");
      lean_inc(a1); uint16_t v0_3 = lb_t980449f277836feadaee_get3(a1);
       if (!lb_f830d4f947d8993755fe2eda_refinement_1_3(v0_3)) croak("%s.uint16Value was rejected by NominalPrimitiveSubtypes.uint16B", "arg1");
      lean_inc(a1); uint32_t v0_4 = lb_t980449f277836feadaee_get4(a1);
       if (!lb_f830d4f947d8993755fe2eda_refinement_1_4(v0_4)) croak("%s.uint32Value was rejected by NominalPrimitiveSubtypes.uint32B", "arg1");
      lean_inc(a1); uint64_t v0_5 = lb_t980449f277836feadaee_get5(a1);
       if (!lb_f830d4f947d8993755fe2eda_refinement_1_5(v0_5)) croak("%s.uint64Value was rejected by NominalPrimitiveSubtypes.uint64B", "arg1");
      lean_inc(a1); uint8_t v0_6 = lb_t980449f277836feadaee_get6(a1);
       if (!lb_f830d4f947d8993755fe2eda_refinement_1_6(v0_6)) croak("%s.int8Value was rejected by NominalPrimitiveSubtypes.int8B", "arg1");
      lean_inc(a1); uint16_t v0_7 = lb_t980449f277836feadaee_get7(a1);
       if (!lb_f830d4f947d8993755fe2eda_refinement_1_7(v0_7)) croak("%s.int16Value was rejected by NominalPrimitiveSubtypes.int16B", "arg1");
      lean_inc(a1); uint32_t v0_8 = lb_t980449f277836feadaee_get8(a1);
       if (!lb_f830d4f947d8993755fe2eda_refinement_1_8(v0_8)) croak("%s.int32Value was rejected by NominalPrimitiveSubtypes.int32B", "arg1");
      lean_inc(a1); uint64_t v0_9 = lb_t980449f277836feadaee_get9(a1);
       if (!lb_f830d4f947d8993755fe2eda_refinement_1_9(v0_9)) croak("%s.int64Value was rejected by NominalPrimitiveSubtypes.int64B", "arg1");
      lean_inc(a1); lean_object * v0_10 = lbp_keep(scope, lb_t980449f277836feadaee_get10(a1));
      lean_inc(v0_10); if (!lb_f830d4f947d8993755fe2eda_refinement_1_10(v0_10)) croak("%s.natValue was rejected by NominalPrimitiveSubtypes.natB", "arg1");
      lean_inc(a1); lean_object * v0_11 = lbp_keep(scope, lb_t980449f277836feadaee_get11(a1));
      lean_inc(v0_11); if (!lb_f830d4f947d8993755fe2eda_refinement_1_11(v0_11)) croak("%s.intValue was rejected by NominalPrimitiveSubtypes.intB", "arg1");
      lean_inc(a1); float v0_12 = lb_t980449f277836feadaee_get12(a1);
       if (!lb_f830d4f947d8993755fe2eda_refinement_1_12(v0_12)) croak("%s.float32Value was rejected by NominalPrimitiveSubtypes.float32B", "arg1");
      lean_inc(a1); double v0_13 = lb_t980449f277836feadaee_get13(a1);
       if (!lb_f830d4f947d8993755fe2eda_refinement_1_13(v0_13)) croak("%s.float64Value was rejected by NominalPrimitiveSubtypes.float64B", "arg1");
      lean_inc(a1); lean_object * v0_14 = lbp_keep(scope, lb_t980449f277836feadaee_get14(a1));
      lean_inc(v0_14); if (!lb_f830d4f947d8993755fe2eda_refinement_1_14(v0_14)) croak("%s.textValue was rejected by NominalPrimitiveSubtypes.textB", "arg1");
      lean_inc(a1); lean_object * v0_15 = lbp_keep(scope, lb_t980449f277836feadaee_get15(a1));
      lean_inc(v0_15); if (!lb_f830d4f947d8993755fe2eda_refinement_1_15(v0_15)) croak("%s.bytesValue was rejected by NominalPrimitiveSubtypes.bytesB", "arg1");
      lean_inc(a1); uint32_t v0_16 = lb_t980449f277836feadaee_get16(a1);
       if (!lb_f830d4f947d8993755fe2eda_refinement_1_16(v0_16)) croak("%s.charValue was rejected by NominalPrimitiveSubtypes.charB", "arg1");
      lean_inc(a1); size_t v0_17 = lb_t980449f277836feadaee_get17(a1);
       if (!lb_f830d4f947d8993755fe2eda_refinement_1_17(v0_17)) croak("%s.usizeValue was rejected by NominalPrimitiveSubtypes.usizeB", "arg1");
      lean_inc(a1); size_t v0_18 = lb_t980449f277836feadaee_get18(a1);
       if (!lb_f830d4f947d8993755fe2eda_refinement_1_18(v0_18)) croak("%s.isizeValue was rejected by NominalPrimitiveSubtypes.isizeB", "arg1"); }
    lean_inc(a0); lean_inc(a1);
    lean_object *checked = lb_f830d4f947d8993755fe2eda(a0, a1);
    if (lean_is_scalar(checked)) croak("Lean rejected an argument outside its checked refinement");
    lean_object *boxed = lean_ctor_get(checked, 0);
    lean_inc(boxed);
    lean_object * result = boxed;
    lean_dec(checked);
    lbp_keep(scope, result);
    lbp_finish(aTHX_ scope);
    lbp_component_ready(aTHX);
    SV *out = lb_write_493235f6d5e0c330066f(aTHX_ scope, result);
    lbp_component_ready(aTHX);
    SvREFCNT_inc(out);
    LBP_LEAVE();
    ST(0) = sv_2mortal(out);
    XSRETURN(1);


void
echo_a(...)
  PPCODE:
    if (items != 1) croak("echo_a expects 1 arguments");
    lbp_check_interpreter(aTHX);
    lbp_component_ready(aTHX);
    LBP_ENTER();
    lean_object * a0 = lb_read_980449f277836feadaee(aTHX_ scope, ST(0));
    { lean_inc(a0); lean_object *v0_19 = lbp_keep(scope, lb_t980449f277836feadaee_get19(a0));
      { lean_object *bound = lean_cstr_to_nat("3"); int below = lean_nat_lt(v0_19, bound); lean_dec(bound);
      if (!below) croak("%s.digit is not below its Fin 3 bound", "arg0"); } }
    { lean_inc(a0); lean_object * v0_0 = lbp_keep(scope, lb_t980449f277836feadaee_get0(a0));
      lean_inc(v0_0); if (!lb_f444432e2b24d280246a5934_refinement_0_0(v0_0)) croak("%s.unitValue was rejected by NominalPrimitiveSubtypes.unitA", "arg0");
      lean_inc(a0); uint8_t v0_1 = lb_t980449f277836feadaee_get1(a0);
       if (!lb_f444432e2b24d280246a5934_refinement_0_1(v0_1)) croak("%s.boolValue was rejected by NominalPrimitiveSubtypes.boolA", "arg0");
      lean_inc(a0); uint8_t v0_2 = lb_t980449f277836feadaee_get2(a0);
       if (!lb_f444432e2b24d280246a5934_refinement_0_2(v0_2)) croak("%s.uint8Value was rejected by NominalPrimitiveSubtypes.uint8A", "arg0");
      lean_inc(a0); uint16_t v0_3 = lb_t980449f277836feadaee_get3(a0);
       if (!lb_f444432e2b24d280246a5934_refinement_0_3(v0_3)) croak("%s.uint16Value was rejected by NominalPrimitiveSubtypes.uint16A", "arg0");
      lean_inc(a0); uint32_t v0_4 = lb_t980449f277836feadaee_get4(a0);
       if (!lb_f444432e2b24d280246a5934_refinement_0_4(v0_4)) croak("%s.uint32Value was rejected by NominalPrimitiveSubtypes.uint32A", "arg0");
      lean_inc(a0); uint64_t v0_5 = lb_t980449f277836feadaee_get5(a0);
       if (!lb_f444432e2b24d280246a5934_refinement_0_5(v0_5)) croak("%s.uint64Value was rejected by NominalPrimitiveSubtypes.uint64A", "arg0");
      lean_inc(a0); uint8_t v0_6 = lb_t980449f277836feadaee_get6(a0);
       if (!lb_f444432e2b24d280246a5934_refinement_0_6(v0_6)) croak("%s.int8Value was rejected by NominalPrimitiveSubtypes.int8A", "arg0");
      lean_inc(a0); uint16_t v0_7 = lb_t980449f277836feadaee_get7(a0);
       if (!lb_f444432e2b24d280246a5934_refinement_0_7(v0_7)) croak("%s.int16Value was rejected by NominalPrimitiveSubtypes.int16A", "arg0");
      lean_inc(a0); uint32_t v0_8 = lb_t980449f277836feadaee_get8(a0);
       if (!lb_f444432e2b24d280246a5934_refinement_0_8(v0_8)) croak("%s.int32Value was rejected by NominalPrimitiveSubtypes.int32A", "arg0");
      lean_inc(a0); uint64_t v0_9 = lb_t980449f277836feadaee_get9(a0);
       if (!lb_f444432e2b24d280246a5934_refinement_0_9(v0_9)) croak("%s.int64Value was rejected by NominalPrimitiveSubtypes.int64A", "arg0");
      lean_inc(a0); lean_object * v0_10 = lbp_keep(scope, lb_t980449f277836feadaee_get10(a0));
      lean_inc(v0_10); if (!lb_f444432e2b24d280246a5934_refinement_0_10(v0_10)) croak("%s.natValue was rejected by NominalPrimitiveSubtypes.natA", "arg0");
      lean_inc(a0); lean_object * v0_11 = lbp_keep(scope, lb_t980449f277836feadaee_get11(a0));
      lean_inc(v0_11); if (!lb_f444432e2b24d280246a5934_refinement_0_11(v0_11)) croak("%s.intValue was rejected by NominalPrimitiveSubtypes.intA", "arg0");
      lean_inc(a0); float v0_12 = lb_t980449f277836feadaee_get12(a0);
       if (!lb_f444432e2b24d280246a5934_refinement_0_12(v0_12)) croak("%s.float32Value was rejected by NominalPrimitiveSubtypes.float32A", "arg0");
      lean_inc(a0); double v0_13 = lb_t980449f277836feadaee_get13(a0);
       if (!lb_f444432e2b24d280246a5934_refinement_0_13(v0_13)) croak("%s.float64Value was rejected by NominalPrimitiveSubtypes.float64A", "arg0");
      lean_inc(a0); lean_object * v0_14 = lbp_keep(scope, lb_t980449f277836feadaee_get14(a0));
      lean_inc(v0_14); if (!lb_f444432e2b24d280246a5934_refinement_0_14(v0_14)) croak("%s.textValue was rejected by NominalPrimitiveSubtypes.textA", "arg0");
      lean_inc(a0); lean_object * v0_15 = lbp_keep(scope, lb_t980449f277836feadaee_get15(a0));
      lean_inc(v0_15); if (!lb_f444432e2b24d280246a5934_refinement_0_15(v0_15)) croak("%s.bytesValue was rejected by NominalPrimitiveSubtypes.bytesA", "arg0");
      lean_inc(a0); uint32_t v0_16 = lb_t980449f277836feadaee_get16(a0);
       if (!lb_f444432e2b24d280246a5934_refinement_0_16(v0_16)) croak("%s.charValue was rejected by NominalPrimitiveSubtypes.charA", "arg0");
      lean_inc(a0); size_t v0_17 = lb_t980449f277836feadaee_get17(a0);
       if (!lb_f444432e2b24d280246a5934_refinement_0_17(v0_17)) croak("%s.usizeValue was rejected by NominalPrimitiveSubtypes.usizeA", "arg0");
      lean_inc(a0); size_t v0_18 = lb_t980449f277836feadaee_get18(a0);
       if (!lb_f444432e2b24d280246a5934_refinement_0_18(v0_18)) croak("%s.isizeValue was rejected by NominalPrimitiveSubtypes.isizeA", "arg0"); }
    lean_inc(a0);
    lean_object *checked = lb_f444432e2b24d280246a5934(a0);
    if (lean_is_scalar(checked)) croak("Lean rejected an argument outside its checked refinement");
    lean_object *boxed = lean_ctor_get(checked, 0);
    lean_inc(boxed);
    lean_object * result = boxed;
    lean_dec(checked);
    lbp_keep(scope, result);
    lbp_finish(aTHX_ scope);
    lbp_component_ready(aTHX);
    SV *out = lb_write_980449f277836feadaee(aTHX_ scope, result);
    lbp_component_ready(aTHX);
    SvREFCNT_inc(out);
    LBP_LEAVE();
    ST(0) = sv_2mortal(out);
    XSRETURN(1);


void
echo_b(...)
  PPCODE:
    if (items != 1) croak("echo_b expects 1 arguments");
    lbp_check_interpreter(aTHX);
    lbp_component_ready(aTHX);
    LBP_ENTER();
    lean_object * a0 = lb_read_980449f277836feadaee(aTHX_ scope, ST(0));
    { lean_inc(a0); lean_object *v0_19 = lbp_keep(scope, lb_t980449f277836feadaee_get19(a0));
      { lean_object *bound = lean_cstr_to_nat("3"); int below = lean_nat_lt(v0_19, bound); lean_dec(bound);
      if (!below) croak("%s.digit is not below its Fin 3 bound", "arg0"); } }
    { lean_inc(a0); lean_object * v0_0 = lbp_keep(scope, lb_t980449f277836feadaee_get0(a0));
      lean_inc(v0_0); if (!lb_fcd46ebe42d8a5f37879812b_refinement_0_0(v0_0)) croak("%s.unitValue was rejected by NominalPrimitiveSubtypes.unitB", "arg0");
      lean_inc(a0); uint8_t v0_1 = lb_t980449f277836feadaee_get1(a0);
       if (!lb_fcd46ebe42d8a5f37879812b_refinement_0_1(v0_1)) croak("%s.boolValue was rejected by NominalPrimitiveSubtypes.boolB", "arg0");
      lean_inc(a0); uint8_t v0_2 = lb_t980449f277836feadaee_get2(a0);
       if (!lb_fcd46ebe42d8a5f37879812b_refinement_0_2(v0_2)) croak("%s.uint8Value was rejected by NominalPrimitiveSubtypes.uint8B", "arg0");
      lean_inc(a0); uint16_t v0_3 = lb_t980449f277836feadaee_get3(a0);
       if (!lb_fcd46ebe42d8a5f37879812b_refinement_0_3(v0_3)) croak("%s.uint16Value was rejected by NominalPrimitiveSubtypes.uint16B", "arg0");
      lean_inc(a0); uint32_t v0_4 = lb_t980449f277836feadaee_get4(a0);
       if (!lb_fcd46ebe42d8a5f37879812b_refinement_0_4(v0_4)) croak("%s.uint32Value was rejected by NominalPrimitiveSubtypes.uint32B", "arg0");
      lean_inc(a0); uint64_t v0_5 = lb_t980449f277836feadaee_get5(a0);
       if (!lb_fcd46ebe42d8a5f37879812b_refinement_0_5(v0_5)) croak("%s.uint64Value was rejected by NominalPrimitiveSubtypes.uint64B", "arg0");
      lean_inc(a0); uint8_t v0_6 = lb_t980449f277836feadaee_get6(a0);
       if (!lb_fcd46ebe42d8a5f37879812b_refinement_0_6(v0_6)) croak("%s.int8Value was rejected by NominalPrimitiveSubtypes.int8B", "arg0");
      lean_inc(a0); uint16_t v0_7 = lb_t980449f277836feadaee_get7(a0);
       if (!lb_fcd46ebe42d8a5f37879812b_refinement_0_7(v0_7)) croak("%s.int16Value was rejected by NominalPrimitiveSubtypes.int16B", "arg0");
      lean_inc(a0); uint32_t v0_8 = lb_t980449f277836feadaee_get8(a0);
       if (!lb_fcd46ebe42d8a5f37879812b_refinement_0_8(v0_8)) croak("%s.int32Value was rejected by NominalPrimitiveSubtypes.int32B", "arg0");
      lean_inc(a0); uint64_t v0_9 = lb_t980449f277836feadaee_get9(a0);
       if (!lb_fcd46ebe42d8a5f37879812b_refinement_0_9(v0_9)) croak("%s.int64Value was rejected by NominalPrimitiveSubtypes.int64B", "arg0");
      lean_inc(a0); lean_object * v0_10 = lbp_keep(scope, lb_t980449f277836feadaee_get10(a0));
      lean_inc(v0_10); if (!lb_fcd46ebe42d8a5f37879812b_refinement_0_10(v0_10)) croak("%s.natValue was rejected by NominalPrimitiveSubtypes.natB", "arg0");
      lean_inc(a0); lean_object * v0_11 = lbp_keep(scope, lb_t980449f277836feadaee_get11(a0));
      lean_inc(v0_11); if (!lb_fcd46ebe42d8a5f37879812b_refinement_0_11(v0_11)) croak("%s.intValue was rejected by NominalPrimitiveSubtypes.intB", "arg0");
      lean_inc(a0); float v0_12 = lb_t980449f277836feadaee_get12(a0);
       if (!lb_fcd46ebe42d8a5f37879812b_refinement_0_12(v0_12)) croak("%s.float32Value was rejected by NominalPrimitiveSubtypes.float32B", "arg0");
      lean_inc(a0); double v0_13 = lb_t980449f277836feadaee_get13(a0);
       if (!lb_fcd46ebe42d8a5f37879812b_refinement_0_13(v0_13)) croak("%s.float64Value was rejected by NominalPrimitiveSubtypes.float64B", "arg0");
      lean_inc(a0); lean_object * v0_14 = lbp_keep(scope, lb_t980449f277836feadaee_get14(a0));
      lean_inc(v0_14); if (!lb_fcd46ebe42d8a5f37879812b_refinement_0_14(v0_14)) croak("%s.textValue was rejected by NominalPrimitiveSubtypes.textB", "arg0");
      lean_inc(a0); lean_object * v0_15 = lbp_keep(scope, lb_t980449f277836feadaee_get15(a0));
      lean_inc(v0_15); if (!lb_fcd46ebe42d8a5f37879812b_refinement_0_15(v0_15)) croak("%s.bytesValue was rejected by NominalPrimitiveSubtypes.bytesB", "arg0");
      lean_inc(a0); uint32_t v0_16 = lb_t980449f277836feadaee_get16(a0);
       if (!lb_fcd46ebe42d8a5f37879812b_refinement_0_16(v0_16)) croak("%s.charValue was rejected by NominalPrimitiveSubtypes.charB", "arg0");
      lean_inc(a0); size_t v0_17 = lb_t980449f277836feadaee_get17(a0);
       if (!lb_fcd46ebe42d8a5f37879812b_refinement_0_17(v0_17)) croak("%s.usizeValue was rejected by NominalPrimitiveSubtypes.usizeB", "arg0");
      lean_inc(a0); size_t v0_18 = lb_t980449f277836feadaee_get18(a0);
       if (!lb_fcd46ebe42d8a5f37879812b_refinement_0_18(v0_18)) croak("%s.isizeValue was rejected by NominalPrimitiveSubtypes.isizeB", "arg0"); }
    lean_inc(a0);
    lean_object *checked = lb_fcd46ebe42d8a5f37879812b(a0);
    if (lean_is_scalar(checked)) croak("Lean rejected an argument outside its checked refinement");
    lean_object *boxed = lean_ctor_get(checked, 0);
    lean_inc(boxed);
    lean_object * result = boxed;
    lean_dec(checked);
    lbp_keep(scope, result);
    lbp_finish(aTHX_ scope);
    lbp_component_ready(aTHX);
    SV *out = lb_write_980449f277836feadaee(aTHX_ scope, result);
    lbp_component_ready(aTHX);
    SvREFCNT_inc(out);
    LBP_LEAVE();
    ST(0) = sv_2mortal(out);
    XSRETURN(1);


void
echo_event_a(...)
  PPCODE:
    if (items != 1) croak("echo_event_a expects 1 arguments");
    lbp_check_interpreter(aTHX);
    lbp_component_ready(aTHX);
    LBP_ENTER();
    lean_object * a0 = lb_read_466ade0f8f5195fb9b51(aTHX_ scope, ST(0));
    { lean_inc(a0); uint32_t t0 = lb_t466ade0f8f5195fb9b51_tag(a0);
      if (t0 == 1u) { lean_inc(a0); lean_object *v0_0 = lbp_keep(scope, lb_t466ade0f8f5195fb9b51_get1_0(a0));
      { lean_inc(v0_0); lean_object *v1_19 = lbp_keep(scope, lb_t980449f277836feadaee_get19(v0_0));
      { lean_object *bound = lean_cstr_to_nat("3"); int below = lean_nat_lt(v1_19, bound); lean_dec(bound);
      if (!below) croak("%s.box.value.digit is not below its Fin 3 bound", "arg0"); } } } else if (t0 == 2u) { lean_inc(a0); lean_object *v0_0 = lbp_keep(scope, lb_t466ade0f8f5195fb9b51_get2_0(a0));
      { 
      for (size_t k1 = 0; k1 < lean_array_size(v0_0); ++k1) { lean_object *e1 = lean_array_get_core(v0_0, k1);
      { lean_inc(e1); if (lb_t5a1383905e3435e418a9_has(e1)) { lean_inc(e1); lean_object *v2 = lbp_keep(scope, lb_t5a1383905e3435e418a9_get0(e1));
      { lean_inc(v2); if (lb_td367e4fc052df6d1c32d_has(v2)) { lean_inc(v2); lean_object *v3 = lbp_keep(scope, lb_td367e4fc052df6d1c32d_get0(v2));
      { lean_inc(v3); lean_object *v4_19 = lbp_keep(scope, lb_t980449f277836feadaee_get19(v3));
      { lean_object *bound = lean_cstr_to_nat("3"); int below = lean_nat_lt(v4_19, bound); lean_dec(bound);
      if (!below) croak("%s.choices.values[%zu]?.ok.digit is not below its Fin 3 bound", "arg0", (size_t)k1); } } } else { lean_inc(v2); lean_object *v3 = lbp_keep(scope, lb_td367e4fc052df6d1c32d_get1(v2));
      { lean_inc(v3); lean_object *v4_19 = lbp_keep(scope, lb_t980449f277836feadaee_get19(v3));
      { lean_object *bound = lean_cstr_to_nat("3"); int below = lean_nat_lt(v4_19, bound); lean_dec(bound);
      if (!below) croak("%s.choices.values[%zu]?.error.digit is not below its Fin 3 bound", "arg0", (size_t)k1); } } } } } } } } } }
    { lean_inc(a0); uint32_t t0 = lb_t466ade0f8f5195fb9b51_tag(a0);
      if (t0 == 1u) { lean_inc(a0); lean_object * v0_1_0 = lbp_keep(scope, lb_t466ade0f8f5195fb9b51_get1_0(a0));
      { lean_inc(v0_1_0); lean_object * v1_0 = lbp_keep(scope, lb_t980449f277836feadaee_get0(v0_1_0));
      lean_inc(v1_0); if (!lb_7418bd537393e68a59611679_refinement_0_1_0_0(v1_0)) croak("%s.box.value.unitValue was rejected by NominalPrimitiveSubtypes.unitA", "arg0");
      lean_inc(v0_1_0); uint8_t v1_1 = lb_t980449f277836feadaee_get1(v0_1_0);
       if (!lb_7418bd537393e68a59611679_refinement_0_1_0_1(v1_1)) croak("%s.box.value.boolValue was rejected by NominalPrimitiveSubtypes.boolA", "arg0");
      lean_inc(v0_1_0); uint8_t v1_2 = lb_t980449f277836feadaee_get2(v0_1_0);
       if (!lb_7418bd537393e68a59611679_refinement_0_1_0_2(v1_2)) croak("%s.box.value.uint8Value was rejected by NominalPrimitiveSubtypes.uint8A", "arg0");
      lean_inc(v0_1_0); uint16_t v1_3 = lb_t980449f277836feadaee_get3(v0_1_0);
       if (!lb_7418bd537393e68a59611679_refinement_0_1_0_3(v1_3)) croak("%s.box.value.uint16Value was rejected by NominalPrimitiveSubtypes.uint16A", "arg0");
      lean_inc(v0_1_0); uint32_t v1_4 = lb_t980449f277836feadaee_get4(v0_1_0);
       if (!lb_7418bd537393e68a59611679_refinement_0_1_0_4(v1_4)) croak("%s.box.value.uint32Value was rejected by NominalPrimitiveSubtypes.uint32A", "arg0");
      lean_inc(v0_1_0); uint64_t v1_5 = lb_t980449f277836feadaee_get5(v0_1_0);
       if (!lb_7418bd537393e68a59611679_refinement_0_1_0_5(v1_5)) croak("%s.box.value.uint64Value was rejected by NominalPrimitiveSubtypes.uint64A", "arg0");
      lean_inc(v0_1_0); uint8_t v1_6 = lb_t980449f277836feadaee_get6(v0_1_0);
       if (!lb_7418bd537393e68a59611679_refinement_0_1_0_6(v1_6)) croak("%s.box.value.int8Value was rejected by NominalPrimitiveSubtypes.int8A", "arg0");
      lean_inc(v0_1_0); uint16_t v1_7 = lb_t980449f277836feadaee_get7(v0_1_0);
       if (!lb_7418bd537393e68a59611679_refinement_0_1_0_7(v1_7)) croak("%s.box.value.int16Value was rejected by NominalPrimitiveSubtypes.int16A", "arg0");
      lean_inc(v0_1_0); uint32_t v1_8 = lb_t980449f277836feadaee_get8(v0_1_0);
       if (!lb_7418bd537393e68a59611679_refinement_0_1_0_8(v1_8)) croak("%s.box.value.int32Value was rejected by NominalPrimitiveSubtypes.int32A", "arg0");
      lean_inc(v0_1_0); uint64_t v1_9 = lb_t980449f277836feadaee_get9(v0_1_0);
       if (!lb_7418bd537393e68a59611679_refinement_0_1_0_9(v1_9)) croak("%s.box.value.int64Value was rejected by NominalPrimitiveSubtypes.int64A", "arg0");
      lean_inc(v0_1_0); lean_object * v1_10 = lbp_keep(scope, lb_t980449f277836feadaee_get10(v0_1_0));
      lean_inc(v1_10); if (!lb_7418bd537393e68a59611679_refinement_0_1_0_10(v1_10)) croak("%s.box.value.natValue was rejected by NominalPrimitiveSubtypes.natA", "arg0");
      lean_inc(v0_1_0); lean_object * v1_11 = lbp_keep(scope, lb_t980449f277836feadaee_get11(v0_1_0));
      lean_inc(v1_11); if (!lb_7418bd537393e68a59611679_refinement_0_1_0_11(v1_11)) croak("%s.box.value.intValue was rejected by NominalPrimitiveSubtypes.intA", "arg0");
      lean_inc(v0_1_0); float v1_12 = lb_t980449f277836feadaee_get12(v0_1_0);
       if (!lb_7418bd537393e68a59611679_refinement_0_1_0_12(v1_12)) croak("%s.box.value.float32Value was rejected by NominalPrimitiveSubtypes.float32A", "arg0");
      lean_inc(v0_1_0); double v1_13 = lb_t980449f277836feadaee_get13(v0_1_0);
       if (!lb_7418bd537393e68a59611679_refinement_0_1_0_13(v1_13)) croak("%s.box.value.float64Value was rejected by NominalPrimitiveSubtypes.float64A", "arg0");
      lean_inc(v0_1_0); lean_object * v1_14 = lbp_keep(scope, lb_t980449f277836feadaee_get14(v0_1_0));
      lean_inc(v1_14); if (!lb_7418bd537393e68a59611679_refinement_0_1_0_14(v1_14)) croak("%s.box.value.textValue was rejected by NominalPrimitiveSubtypes.textA", "arg0");
      lean_inc(v0_1_0); lean_object * v1_15 = lbp_keep(scope, lb_t980449f277836feadaee_get15(v0_1_0));
      lean_inc(v1_15); if (!lb_7418bd537393e68a59611679_refinement_0_1_0_15(v1_15)) croak("%s.box.value.bytesValue was rejected by NominalPrimitiveSubtypes.bytesA", "arg0");
      lean_inc(v0_1_0); uint32_t v1_16 = lb_t980449f277836feadaee_get16(v0_1_0);
       if (!lb_7418bd537393e68a59611679_refinement_0_1_0_16(v1_16)) croak("%s.box.value.charValue was rejected by NominalPrimitiveSubtypes.charA", "arg0");
      lean_inc(v0_1_0); size_t v1_17 = lb_t980449f277836feadaee_get17(v0_1_0);
       if (!lb_7418bd537393e68a59611679_refinement_0_1_0_17(v1_17)) croak("%s.box.value.usizeValue was rejected by NominalPrimitiveSubtypes.usizeA", "arg0");
      lean_inc(v0_1_0); size_t v1_18 = lb_t980449f277836feadaee_get18(v0_1_0);
       if (!lb_7418bd537393e68a59611679_refinement_0_1_0_18(v1_18)) croak("%s.box.value.isizeValue was rejected by NominalPrimitiveSubtypes.isizeA", "arg0"); } } else if (t0 == 2u) { lean_inc(a0); lean_object * v0_2_0 = lbp_keep(scope, lb_t466ade0f8f5195fb9b51_get2_0(a0));
      { 
      for (size_t k1 = 0; k1 < lean_array_size(v0_2_0); ++k1) { lean_object *e1 = lean_array_get_core(v0_2_0, k1);
      { lean_inc(e1); if (lb_t5a1383905e3435e418a9_has(e1)) { lean_inc(e1); lean_object * v2_0 = lbp_keep(scope, lb_t5a1383905e3435e418a9_get0(e1));
      { lean_inc(v2_0); if (lb_td367e4fc052df6d1c32d_has(v2_0)) { lean_inc(v2_0); lean_object * v3_0 = lbp_keep(scope, lb_td367e4fc052df6d1c32d_get0(v2_0));
      { lean_inc(v3_0); lean_object * v4_0 = lbp_keep(scope, lb_t980449f277836feadaee_get0(v3_0));
      lean_inc(v4_0); if (!lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_0(v4_0)) croak("%s.choices.values[%zu]?.ok.unitValue was rejected by NominalPrimitiveSubtypes.unitA", "arg0", (size_t)k1);
      lean_inc(v3_0); uint8_t v4_1 = lb_t980449f277836feadaee_get1(v3_0);
       if (!lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_1(v4_1)) croak("%s.choices.values[%zu]?.ok.boolValue was rejected by NominalPrimitiveSubtypes.boolA", "arg0", (size_t)k1);
      lean_inc(v3_0); uint8_t v4_2 = lb_t980449f277836feadaee_get2(v3_0);
       if (!lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_2(v4_2)) croak("%s.choices.values[%zu]?.ok.uint8Value was rejected by NominalPrimitiveSubtypes.uint8A", "arg0", (size_t)k1);
      lean_inc(v3_0); uint16_t v4_3 = lb_t980449f277836feadaee_get3(v3_0);
       if (!lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_3(v4_3)) croak("%s.choices.values[%zu]?.ok.uint16Value was rejected by NominalPrimitiveSubtypes.uint16A", "arg0", (size_t)k1);
      lean_inc(v3_0); uint32_t v4_4 = lb_t980449f277836feadaee_get4(v3_0);
       if (!lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_4(v4_4)) croak("%s.choices.values[%zu]?.ok.uint32Value was rejected by NominalPrimitiveSubtypes.uint32A", "arg0", (size_t)k1);
      lean_inc(v3_0); uint64_t v4_5 = lb_t980449f277836feadaee_get5(v3_0);
       if (!lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_5(v4_5)) croak("%s.choices.values[%zu]?.ok.uint64Value was rejected by NominalPrimitiveSubtypes.uint64A", "arg0", (size_t)k1);
      lean_inc(v3_0); uint8_t v4_6 = lb_t980449f277836feadaee_get6(v3_0);
       if (!lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_6(v4_6)) croak("%s.choices.values[%zu]?.ok.int8Value was rejected by NominalPrimitiveSubtypes.int8A", "arg0", (size_t)k1);
      lean_inc(v3_0); uint16_t v4_7 = lb_t980449f277836feadaee_get7(v3_0);
       if (!lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_7(v4_7)) croak("%s.choices.values[%zu]?.ok.int16Value was rejected by NominalPrimitiveSubtypes.int16A", "arg0", (size_t)k1);
      lean_inc(v3_0); uint32_t v4_8 = lb_t980449f277836feadaee_get8(v3_0);
       if (!lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_8(v4_8)) croak("%s.choices.values[%zu]?.ok.int32Value was rejected by NominalPrimitiveSubtypes.int32A", "arg0", (size_t)k1);
      lean_inc(v3_0); uint64_t v4_9 = lb_t980449f277836feadaee_get9(v3_0);
       if (!lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_9(v4_9)) croak("%s.choices.values[%zu]?.ok.int64Value was rejected by NominalPrimitiveSubtypes.int64A", "arg0", (size_t)k1);
      lean_inc(v3_0); lean_object * v4_10 = lbp_keep(scope, lb_t980449f277836feadaee_get10(v3_0));
      lean_inc(v4_10); if (!lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_10(v4_10)) croak("%s.choices.values[%zu]?.ok.natValue was rejected by NominalPrimitiveSubtypes.natA", "arg0", (size_t)k1);
      lean_inc(v3_0); lean_object * v4_11 = lbp_keep(scope, lb_t980449f277836feadaee_get11(v3_0));
      lean_inc(v4_11); if (!lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_11(v4_11)) croak("%s.choices.values[%zu]?.ok.intValue was rejected by NominalPrimitiveSubtypes.intA", "arg0", (size_t)k1);
      lean_inc(v3_0); float v4_12 = lb_t980449f277836feadaee_get12(v3_0);
       if (!lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_12(v4_12)) croak("%s.choices.values[%zu]?.ok.float32Value was rejected by NominalPrimitiveSubtypes.float32A", "arg0", (size_t)k1);
      lean_inc(v3_0); double v4_13 = lb_t980449f277836feadaee_get13(v3_0);
       if (!lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_13(v4_13)) croak("%s.choices.values[%zu]?.ok.float64Value was rejected by NominalPrimitiveSubtypes.float64A", "arg0", (size_t)k1);
      lean_inc(v3_0); lean_object * v4_14 = lbp_keep(scope, lb_t980449f277836feadaee_get14(v3_0));
      lean_inc(v4_14); if (!lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_14(v4_14)) croak("%s.choices.values[%zu]?.ok.textValue was rejected by NominalPrimitiveSubtypes.textA", "arg0", (size_t)k1);
      lean_inc(v3_0); lean_object * v4_15 = lbp_keep(scope, lb_t980449f277836feadaee_get15(v3_0));
      lean_inc(v4_15); if (!lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_15(v4_15)) croak("%s.choices.values[%zu]?.ok.bytesValue was rejected by NominalPrimitiveSubtypes.bytesA", "arg0", (size_t)k1);
      lean_inc(v3_0); uint32_t v4_16 = lb_t980449f277836feadaee_get16(v3_0);
       if (!lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_16(v4_16)) croak("%s.choices.values[%zu]?.ok.charValue was rejected by NominalPrimitiveSubtypes.charA", "arg0", (size_t)k1);
      lean_inc(v3_0); size_t v4_17 = lb_t980449f277836feadaee_get17(v3_0);
       if (!lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_17(v4_17)) croak("%s.choices.values[%zu]?.ok.usizeValue was rejected by NominalPrimitiveSubtypes.usizeA", "arg0", (size_t)k1);
      lean_inc(v3_0); size_t v4_18 = lb_t980449f277836feadaee_get18(v3_0);
       if (!lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_18(v4_18)) croak("%s.choices.values[%zu]?.ok.isizeValue was rejected by NominalPrimitiveSubtypes.isizeA", "arg0", (size_t)k1); } } else { lean_inc(v2_0); lean_object * v3_1 = lbp_keep(scope, lb_td367e4fc052df6d1c32d_get1(v2_0));
      { lean_inc(v3_1); lean_object * v4_0 = lbp_keep(scope, lb_t980449f277836feadaee_get0(v3_1));
      lean_inc(v4_0); if (!lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_0(v4_0)) croak("%s.choices.values[%zu]?.error.unitValue was rejected by NominalPrimitiveSubtypes.unitB", "arg0", (size_t)k1);
      lean_inc(v3_1); uint8_t v4_1 = lb_t980449f277836feadaee_get1(v3_1);
       if (!lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_1(v4_1)) croak("%s.choices.values[%zu]?.error.boolValue was rejected by NominalPrimitiveSubtypes.boolB", "arg0", (size_t)k1);
      lean_inc(v3_1); uint8_t v4_2 = lb_t980449f277836feadaee_get2(v3_1);
       if (!lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_2(v4_2)) croak("%s.choices.values[%zu]?.error.uint8Value was rejected by NominalPrimitiveSubtypes.uint8B", "arg0", (size_t)k1);
      lean_inc(v3_1); uint16_t v4_3 = lb_t980449f277836feadaee_get3(v3_1);
       if (!lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_3(v4_3)) croak("%s.choices.values[%zu]?.error.uint16Value was rejected by NominalPrimitiveSubtypes.uint16B", "arg0", (size_t)k1);
      lean_inc(v3_1); uint32_t v4_4 = lb_t980449f277836feadaee_get4(v3_1);
       if (!lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_4(v4_4)) croak("%s.choices.values[%zu]?.error.uint32Value was rejected by NominalPrimitiveSubtypes.uint32B", "arg0", (size_t)k1);
      lean_inc(v3_1); uint64_t v4_5 = lb_t980449f277836feadaee_get5(v3_1);
       if (!lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_5(v4_5)) croak("%s.choices.values[%zu]?.error.uint64Value was rejected by NominalPrimitiveSubtypes.uint64B", "arg0", (size_t)k1);
      lean_inc(v3_1); uint8_t v4_6 = lb_t980449f277836feadaee_get6(v3_1);
       if (!lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_6(v4_6)) croak("%s.choices.values[%zu]?.error.int8Value was rejected by NominalPrimitiveSubtypes.int8B", "arg0", (size_t)k1);
      lean_inc(v3_1); uint16_t v4_7 = lb_t980449f277836feadaee_get7(v3_1);
       if (!lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_7(v4_7)) croak("%s.choices.values[%zu]?.error.int16Value was rejected by NominalPrimitiveSubtypes.int16B", "arg0", (size_t)k1);
      lean_inc(v3_1); uint32_t v4_8 = lb_t980449f277836feadaee_get8(v3_1);
       if (!lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_8(v4_8)) croak("%s.choices.values[%zu]?.error.int32Value was rejected by NominalPrimitiveSubtypes.int32B", "arg0", (size_t)k1);
      lean_inc(v3_1); uint64_t v4_9 = lb_t980449f277836feadaee_get9(v3_1);
       if (!lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_9(v4_9)) croak("%s.choices.values[%zu]?.error.int64Value was rejected by NominalPrimitiveSubtypes.int64B", "arg0", (size_t)k1);
      lean_inc(v3_1); lean_object * v4_10 = lbp_keep(scope, lb_t980449f277836feadaee_get10(v3_1));
      lean_inc(v4_10); if (!lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_10(v4_10)) croak("%s.choices.values[%zu]?.error.natValue was rejected by NominalPrimitiveSubtypes.natB", "arg0", (size_t)k1);
      lean_inc(v3_1); lean_object * v4_11 = lbp_keep(scope, lb_t980449f277836feadaee_get11(v3_1));
      lean_inc(v4_11); if (!lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_11(v4_11)) croak("%s.choices.values[%zu]?.error.intValue was rejected by NominalPrimitiveSubtypes.intB", "arg0", (size_t)k1);
      lean_inc(v3_1); float v4_12 = lb_t980449f277836feadaee_get12(v3_1);
       if (!lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_12(v4_12)) croak("%s.choices.values[%zu]?.error.float32Value was rejected by NominalPrimitiveSubtypes.float32B", "arg0", (size_t)k1);
      lean_inc(v3_1); double v4_13 = lb_t980449f277836feadaee_get13(v3_1);
       if (!lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_13(v4_13)) croak("%s.choices.values[%zu]?.error.float64Value was rejected by NominalPrimitiveSubtypes.float64B", "arg0", (size_t)k1);
      lean_inc(v3_1); lean_object * v4_14 = lbp_keep(scope, lb_t980449f277836feadaee_get14(v3_1));
      lean_inc(v4_14); if (!lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_14(v4_14)) croak("%s.choices.values[%zu]?.error.textValue was rejected by NominalPrimitiveSubtypes.textB", "arg0", (size_t)k1);
      lean_inc(v3_1); lean_object * v4_15 = lbp_keep(scope, lb_t980449f277836feadaee_get15(v3_1));
      lean_inc(v4_15); if (!lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_15(v4_15)) croak("%s.choices.values[%zu]?.error.bytesValue was rejected by NominalPrimitiveSubtypes.bytesB", "arg0", (size_t)k1);
      lean_inc(v3_1); uint32_t v4_16 = lb_t980449f277836feadaee_get16(v3_1);
       if (!lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_16(v4_16)) croak("%s.choices.values[%zu]?.error.charValue was rejected by NominalPrimitiveSubtypes.charB", "arg0", (size_t)k1);
      lean_inc(v3_1); size_t v4_17 = lb_t980449f277836feadaee_get17(v3_1);
       if (!lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_17(v4_17)) croak("%s.choices.values[%zu]?.error.usizeValue was rejected by NominalPrimitiveSubtypes.usizeB", "arg0", (size_t)k1);
      lean_inc(v3_1); size_t v4_18 = lb_t980449f277836feadaee_get18(v3_1);
       if (!lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_18(v4_18)) croak("%s.choices.values[%zu]?.error.isizeValue was rejected by NominalPrimitiveSubtypes.isizeB", "arg0", (size_t)k1); } } } } } } } } }
    lean_inc(a0);
    lean_object *checked = lb_7418bd537393e68a59611679(a0);
    if (lean_is_scalar(checked)) croak("Lean rejected an argument outside its checked refinement");
    lean_object *boxed = lean_ctor_get(checked, 0);
    lean_inc(boxed);
    lean_object * result = boxed;
    lean_dec(checked);
    lbp_keep(scope, result);
    lbp_finish(aTHX_ scope);
    lbp_component_ready(aTHX);
    SV *out = lb_write_466ade0f8f5195fb9b51(aTHX_ scope, result);
    lbp_component_ready(aTHX);
    SvREFCNT_inc(out);
    LBP_LEAVE();
    ST(0) = sv_2mortal(out);
    XSRETURN(1);


void
echo_event_b(...)
  PPCODE:
    if (items != 1) croak("echo_event_b expects 1 arguments");
    lbp_check_interpreter(aTHX);
    lbp_component_ready(aTHX);
    LBP_ENTER();
    lean_object * a0 = lb_read_466ade0f8f5195fb9b51(aTHX_ scope, ST(0));
    { lean_inc(a0); uint32_t t0 = lb_t466ade0f8f5195fb9b51_tag(a0);
      if (t0 == 1u) { lean_inc(a0); lean_object *v0_0 = lbp_keep(scope, lb_t466ade0f8f5195fb9b51_get1_0(a0));
      { lean_inc(v0_0); lean_object *v1_19 = lbp_keep(scope, lb_t980449f277836feadaee_get19(v0_0));
      { lean_object *bound = lean_cstr_to_nat("3"); int below = lean_nat_lt(v1_19, bound); lean_dec(bound);
      if (!below) croak("%s.box.value.digit is not below its Fin 3 bound", "arg0"); } } } else if (t0 == 2u) { lean_inc(a0); lean_object *v0_0 = lbp_keep(scope, lb_t466ade0f8f5195fb9b51_get2_0(a0));
      { 
      for (size_t k1 = 0; k1 < lean_array_size(v0_0); ++k1) { lean_object *e1 = lean_array_get_core(v0_0, k1);
      { lean_inc(e1); if (lb_t5a1383905e3435e418a9_has(e1)) { lean_inc(e1); lean_object *v2 = lbp_keep(scope, lb_t5a1383905e3435e418a9_get0(e1));
      { lean_inc(v2); if (lb_td367e4fc052df6d1c32d_has(v2)) { lean_inc(v2); lean_object *v3 = lbp_keep(scope, lb_td367e4fc052df6d1c32d_get0(v2));
      { lean_inc(v3); lean_object *v4_19 = lbp_keep(scope, lb_t980449f277836feadaee_get19(v3));
      { lean_object *bound = lean_cstr_to_nat("3"); int below = lean_nat_lt(v4_19, bound); lean_dec(bound);
      if (!below) croak("%s.choices.values[%zu]?.ok.digit is not below its Fin 3 bound", "arg0", (size_t)k1); } } } else { lean_inc(v2); lean_object *v3 = lbp_keep(scope, lb_td367e4fc052df6d1c32d_get1(v2));
      { lean_inc(v3); lean_object *v4_19 = lbp_keep(scope, lb_t980449f277836feadaee_get19(v3));
      { lean_object *bound = lean_cstr_to_nat("3"); int below = lean_nat_lt(v4_19, bound); lean_dec(bound);
      if (!below) croak("%s.choices.values[%zu]?.error.digit is not below its Fin 3 bound", "arg0", (size_t)k1); } } } } } } } } } }
    { lean_inc(a0); uint32_t t0 = lb_t466ade0f8f5195fb9b51_tag(a0);
      if (t0 == 1u) { lean_inc(a0); lean_object * v0_1_0 = lbp_keep(scope, lb_t466ade0f8f5195fb9b51_get1_0(a0));
      { lean_inc(v0_1_0); lean_object * v1_0 = lbp_keep(scope, lb_t980449f277836feadaee_get0(v0_1_0));
      lean_inc(v1_0); if (!lb_2ff268195b6929b7f5ecf871_refinement_0_1_0_0(v1_0)) croak("%s.box.value.unitValue was rejected by NominalPrimitiveSubtypes.unitB", "arg0");
      lean_inc(v0_1_0); uint8_t v1_1 = lb_t980449f277836feadaee_get1(v0_1_0);
       if (!lb_2ff268195b6929b7f5ecf871_refinement_0_1_0_1(v1_1)) croak("%s.box.value.boolValue was rejected by NominalPrimitiveSubtypes.boolB", "arg0");
      lean_inc(v0_1_0); uint8_t v1_2 = lb_t980449f277836feadaee_get2(v0_1_0);
       if (!lb_2ff268195b6929b7f5ecf871_refinement_0_1_0_2(v1_2)) croak("%s.box.value.uint8Value was rejected by NominalPrimitiveSubtypes.uint8B", "arg0");
      lean_inc(v0_1_0); uint16_t v1_3 = lb_t980449f277836feadaee_get3(v0_1_0);
       if (!lb_2ff268195b6929b7f5ecf871_refinement_0_1_0_3(v1_3)) croak("%s.box.value.uint16Value was rejected by NominalPrimitiveSubtypes.uint16B", "arg0");
      lean_inc(v0_1_0); uint32_t v1_4 = lb_t980449f277836feadaee_get4(v0_1_0);
       if (!lb_2ff268195b6929b7f5ecf871_refinement_0_1_0_4(v1_4)) croak("%s.box.value.uint32Value was rejected by NominalPrimitiveSubtypes.uint32B", "arg0");
      lean_inc(v0_1_0); uint64_t v1_5 = lb_t980449f277836feadaee_get5(v0_1_0);
       if (!lb_2ff268195b6929b7f5ecf871_refinement_0_1_0_5(v1_5)) croak("%s.box.value.uint64Value was rejected by NominalPrimitiveSubtypes.uint64B", "arg0");
      lean_inc(v0_1_0); uint8_t v1_6 = lb_t980449f277836feadaee_get6(v0_1_0);
       if (!lb_2ff268195b6929b7f5ecf871_refinement_0_1_0_6(v1_6)) croak("%s.box.value.int8Value was rejected by NominalPrimitiveSubtypes.int8B", "arg0");
      lean_inc(v0_1_0); uint16_t v1_7 = lb_t980449f277836feadaee_get7(v0_1_0);
       if (!lb_2ff268195b6929b7f5ecf871_refinement_0_1_0_7(v1_7)) croak("%s.box.value.int16Value was rejected by NominalPrimitiveSubtypes.int16B", "arg0");
      lean_inc(v0_1_0); uint32_t v1_8 = lb_t980449f277836feadaee_get8(v0_1_0);
       if (!lb_2ff268195b6929b7f5ecf871_refinement_0_1_0_8(v1_8)) croak("%s.box.value.int32Value was rejected by NominalPrimitiveSubtypes.int32B", "arg0");
      lean_inc(v0_1_0); uint64_t v1_9 = lb_t980449f277836feadaee_get9(v0_1_0);
       if (!lb_2ff268195b6929b7f5ecf871_refinement_0_1_0_9(v1_9)) croak("%s.box.value.int64Value was rejected by NominalPrimitiveSubtypes.int64B", "arg0");
      lean_inc(v0_1_0); lean_object * v1_10 = lbp_keep(scope, lb_t980449f277836feadaee_get10(v0_1_0));
      lean_inc(v1_10); if (!lb_2ff268195b6929b7f5ecf871_refinement_0_1_0_10(v1_10)) croak("%s.box.value.natValue was rejected by NominalPrimitiveSubtypes.natB", "arg0");
      lean_inc(v0_1_0); lean_object * v1_11 = lbp_keep(scope, lb_t980449f277836feadaee_get11(v0_1_0));
      lean_inc(v1_11); if (!lb_2ff268195b6929b7f5ecf871_refinement_0_1_0_11(v1_11)) croak("%s.box.value.intValue was rejected by NominalPrimitiveSubtypes.intB", "arg0");
      lean_inc(v0_1_0); float v1_12 = lb_t980449f277836feadaee_get12(v0_1_0);
       if (!lb_2ff268195b6929b7f5ecf871_refinement_0_1_0_12(v1_12)) croak("%s.box.value.float32Value was rejected by NominalPrimitiveSubtypes.float32B", "arg0");
      lean_inc(v0_1_0); double v1_13 = lb_t980449f277836feadaee_get13(v0_1_0);
       if (!lb_2ff268195b6929b7f5ecf871_refinement_0_1_0_13(v1_13)) croak("%s.box.value.float64Value was rejected by NominalPrimitiveSubtypes.float64B", "arg0");
      lean_inc(v0_1_0); lean_object * v1_14 = lbp_keep(scope, lb_t980449f277836feadaee_get14(v0_1_0));
      lean_inc(v1_14); if (!lb_2ff268195b6929b7f5ecf871_refinement_0_1_0_14(v1_14)) croak("%s.box.value.textValue was rejected by NominalPrimitiveSubtypes.textB", "arg0");
      lean_inc(v0_1_0); lean_object * v1_15 = lbp_keep(scope, lb_t980449f277836feadaee_get15(v0_1_0));
      lean_inc(v1_15); if (!lb_2ff268195b6929b7f5ecf871_refinement_0_1_0_15(v1_15)) croak("%s.box.value.bytesValue was rejected by NominalPrimitiveSubtypes.bytesB", "arg0");
      lean_inc(v0_1_0); uint32_t v1_16 = lb_t980449f277836feadaee_get16(v0_1_0);
       if (!lb_2ff268195b6929b7f5ecf871_refinement_0_1_0_16(v1_16)) croak("%s.box.value.charValue was rejected by NominalPrimitiveSubtypes.charB", "arg0");
      lean_inc(v0_1_0); size_t v1_17 = lb_t980449f277836feadaee_get17(v0_1_0);
       if (!lb_2ff268195b6929b7f5ecf871_refinement_0_1_0_17(v1_17)) croak("%s.box.value.usizeValue was rejected by NominalPrimitiveSubtypes.usizeB", "arg0");
      lean_inc(v0_1_0); size_t v1_18 = lb_t980449f277836feadaee_get18(v0_1_0);
       if (!lb_2ff268195b6929b7f5ecf871_refinement_0_1_0_18(v1_18)) croak("%s.box.value.isizeValue was rejected by NominalPrimitiveSubtypes.isizeB", "arg0"); } } else if (t0 == 2u) { lean_inc(a0); lean_object * v0_2_0 = lbp_keep(scope, lb_t466ade0f8f5195fb9b51_get2_0(a0));
      { 
      for (size_t k1 = 0; k1 < lean_array_size(v0_2_0); ++k1) { lean_object *e1 = lean_array_get_core(v0_2_0, k1);
      { lean_inc(e1); if (lb_t5a1383905e3435e418a9_has(e1)) { lean_inc(e1); lean_object * v2_0 = lbp_keep(scope, lb_t5a1383905e3435e418a9_get0(e1));
      { lean_inc(v2_0); if (lb_td367e4fc052df6d1c32d_has(v2_0)) { lean_inc(v2_0); lean_object * v3_0 = lbp_keep(scope, lb_td367e4fc052df6d1c32d_get0(v2_0));
      { lean_inc(v3_0); lean_object * v4_0 = lbp_keep(scope, lb_t980449f277836feadaee_get0(v3_0));
      lean_inc(v4_0); if (!lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_0(v4_0)) croak("%s.choices.values[%zu]?.ok.unitValue was rejected by NominalPrimitiveSubtypes.unitB", "arg0", (size_t)k1);
      lean_inc(v3_0); uint8_t v4_1 = lb_t980449f277836feadaee_get1(v3_0);
       if (!lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_1(v4_1)) croak("%s.choices.values[%zu]?.ok.boolValue was rejected by NominalPrimitiveSubtypes.boolB", "arg0", (size_t)k1);
      lean_inc(v3_0); uint8_t v4_2 = lb_t980449f277836feadaee_get2(v3_0);
       if (!lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_2(v4_2)) croak("%s.choices.values[%zu]?.ok.uint8Value was rejected by NominalPrimitiveSubtypes.uint8B", "arg0", (size_t)k1);
      lean_inc(v3_0); uint16_t v4_3 = lb_t980449f277836feadaee_get3(v3_0);
       if (!lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_3(v4_3)) croak("%s.choices.values[%zu]?.ok.uint16Value was rejected by NominalPrimitiveSubtypes.uint16B", "arg0", (size_t)k1);
      lean_inc(v3_0); uint32_t v4_4 = lb_t980449f277836feadaee_get4(v3_0);
       if (!lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_4(v4_4)) croak("%s.choices.values[%zu]?.ok.uint32Value was rejected by NominalPrimitiveSubtypes.uint32B", "arg0", (size_t)k1);
      lean_inc(v3_0); uint64_t v4_5 = lb_t980449f277836feadaee_get5(v3_0);
       if (!lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_5(v4_5)) croak("%s.choices.values[%zu]?.ok.uint64Value was rejected by NominalPrimitiveSubtypes.uint64B", "arg0", (size_t)k1);
      lean_inc(v3_0); uint8_t v4_6 = lb_t980449f277836feadaee_get6(v3_0);
       if (!lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_6(v4_6)) croak("%s.choices.values[%zu]?.ok.int8Value was rejected by NominalPrimitiveSubtypes.int8B", "arg0", (size_t)k1);
      lean_inc(v3_0); uint16_t v4_7 = lb_t980449f277836feadaee_get7(v3_0);
       if (!lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_7(v4_7)) croak("%s.choices.values[%zu]?.ok.int16Value was rejected by NominalPrimitiveSubtypes.int16B", "arg0", (size_t)k1);
      lean_inc(v3_0); uint32_t v4_8 = lb_t980449f277836feadaee_get8(v3_0);
       if (!lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_8(v4_8)) croak("%s.choices.values[%zu]?.ok.int32Value was rejected by NominalPrimitiveSubtypes.int32B", "arg0", (size_t)k1);
      lean_inc(v3_0); uint64_t v4_9 = lb_t980449f277836feadaee_get9(v3_0);
       if (!lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_9(v4_9)) croak("%s.choices.values[%zu]?.ok.int64Value was rejected by NominalPrimitiveSubtypes.int64B", "arg0", (size_t)k1);
      lean_inc(v3_0); lean_object * v4_10 = lbp_keep(scope, lb_t980449f277836feadaee_get10(v3_0));
      lean_inc(v4_10); if (!lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_10(v4_10)) croak("%s.choices.values[%zu]?.ok.natValue was rejected by NominalPrimitiveSubtypes.natB", "arg0", (size_t)k1);
      lean_inc(v3_0); lean_object * v4_11 = lbp_keep(scope, lb_t980449f277836feadaee_get11(v3_0));
      lean_inc(v4_11); if (!lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_11(v4_11)) croak("%s.choices.values[%zu]?.ok.intValue was rejected by NominalPrimitiveSubtypes.intB", "arg0", (size_t)k1);
      lean_inc(v3_0); float v4_12 = lb_t980449f277836feadaee_get12(v3_0);
       if (!lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_12(v4_12)) croak("%s.choices.values[%zu]?.ok.float32Value was rejected by NominalPrimitiveSubtypes.float32B", "arg0", (size_t)k1);
      lean_inc(v3_0); double v4_13 = lb_t980449f277836feadaee_get13(v3_0);
       if (!lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_13(v4_13)) croak("%s.choices.values[%zu]?.ok.float64Value was rejected by NominalPrimitiveSubtypes.float64B", "arg0", (size_t)k1);
      lean_inc(v3_0); lean_object * v4_14 = lbp_keep(scope, lb_t980449f277836feadaee_get14(v3_0));
      lean_inc(v4_14); if (!lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_14(v4_14)) croak("%s.choices.values[%zu]?.ok.textValue was rejected by NominalPrimitiveSubtypes.textB", "arg0", (size_t)k1);
      lean_inc(v3_0); lean_object * v4_15 = lbp_keep(scope, lb_t980449f277836feadaee_get15(v3_0));
      lean_inc(v4_15); if (!lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_15(v4_15)) croak("%s.choices.values[%zu]?.ok.bytesValue was rejected by NominalPrimitiveSubtypes.bytesB", "arg0", (size_t)k1);
      lean_inc(v3_0); uint32_t v4_16 = lb_t980449f277836feadaee_get16(v3_0);
       if (!lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_16(v4_16)) croak("%s.choices.values[%zu]?.ok.charValue was rejected by NominalPrimitiveSubtypes.charB", "arg0", (size_t)k1);
      lean_inc(v3_0); size_t v4_17 = lb_t980449f277836feadaee_get17(v3_0);
       if (!lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_17(v4_17)) croak("%s.choices.values[%zu]?.ok.usizeValue was rejected by NominalPrimitiveSubtypes.usizeB", "arg0", (size_t)k1);
      lean_inc(v3_0); size_t v4_18 = lb_t980449f277836feadaee_get18(v3_0);
       if (!lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_18(v4_18)) croak("%s.choices.values[%zu]?.ok.isizeValue was rejected by NominalPrimitiveSubtypes.isizeB", "arg0", (size_t)k1); } } else { lean_inc(v2_0); lean_object * v3_1 = lbp_keep(scope, lb_td367e4fc052df6d1c32d_get1(v2_0));
      { lean_inc(v3_1); lean_object * v4_0 = lbp_keep(scope, lb_t980449f277836feadaee_get0(v3_1));
      lean_inc(v4_0); if (!lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_0(v4_0)) croak("%s.choices.values[%zu]?.error.unitValue was rejected by NominalPrimitiveSubtypes.unitA", "arg0", (size_t)k1);
      lean_inc(v3_1); uint8_t v4_1 = lb_t980449f277836feadaee_get1(v3_1);
       if (!lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_1(v4_1)) croak("%s.choices.values[%zu]?.error.boolValue was rejected by NominalPrimitiveSubtypes.boolA", "arg0", (size_t)k1);
      lean_inc(v3_1); uint8_t v4_2 = lb_t980449f277836feadaee_get2(v3_1);
       if (!lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_2(v4_2)) croak("%s.choices.values[%zu]?.error.uint8Value was rejected by NominalPrimitiveSubtypes.uint8A", "arg0", (size_t)k1);
      lean_inc(v3_1); uint16_t v4_3 = lb_t980449f277836feadaee_get3(v3_1);
       if (!lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_3(v4_3)) croak("%s.choices.values[%zu]?.error.uint16Value was rejected by NominalPrimitiveSubtypes.uint16A", "arg0", (size_t)k1);
      lean_inc(v3_1); uint32_t v4_4 = lb_t980449f277836feadaee_get4(v3_1);
       if (!lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_4(v4_4)) croak("%s.choices.values[%zu]?.error.uint32Value was rejected by NominalPrimitiveSubtypes.uint32A", "arg0", (size_t)k1);
      lean_inc(v3_1); uint64_t v4_5 = lb_t980449f277836feadaee_get5(v3_1);
       if (!lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_5(v4_5)) croak("%s.choices.values[%zu]?.error.uint64Value was rejected by NominalPrimitiveSubtypes.uint64A", "arg0", (size_t)k1);
      lean_inc(v3_1); uint8_t v4_6 = lb_t980449f277836feadaee_get6(v3_1);
       if (!lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_6(v4_6)) croak("%s.choices.values[%zu]?.error.int8Value was rejected by NominalPrimitiveSubtypes.int8A", "arg0", (size_t)k1);
      lean_inc(v3_1); uint16_t v4_7 = lb_t980449f277836feadaee_get7(v3_1);
       if (!lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_7(v4_7)) croak("%s.choices.values[%zu]?.error.int16Value was rejected by NominalPrimitiveSubtypes.int16A", "arg0", (size_t)k1);
      lean_inc(v3_1); uint32_t v4_8 = lb_t980449f277836feadaee_get8(v3_1);
       if (!lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_8(v4_8)) croak("%s.choices.values[%zu]?.error.int32Value was rejected by NominalPrimitiveSubtypes.int32A", "arg0", (size_t)k1);
      lean_inc(v3_1); uint64_t v4_9 = lb_t980449f277836feadaee_get9(v3_1);
       if (!lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_9(v4_9)) croak("%s.choices.values[%zu]?.error.int64Value was rejected by NominalPrimitiveSubtypes.int64A", "arg0", (size_t)k1);
      lean_inc(v3_1); lean_object * v4_10 = lbp_keep(scope, lb_t980449f277836feadaee_get10(v3_1));
      lean_inc(v4_10); if (!lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_10(v4_10)) croak("%s.choices.values[%zu]?.error.natValue was rejected by NominalPrimitiveSubtypes.natA", "arg0", (size_t)k1);
      lean_inc(v3_1); lean_object * v4_11 = lbp_keep(scope, lb_t980449f277836feadaee_get11(v3_1));
      lean_inc(v4_11); if (!lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_11(v4_11)) croak("%s.choices.values[%zu]?.error.intValue was rejected by NominalPrimitiveSubtypes.intA", "arg0", (size_t)k1);
      lean_inc(v3_1); float v4_12 = lb_t980449f277836feadaee_get12(v3_1);
       if (!lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_12(v4_12)) croak("%s.choices.values[%zu]?.error.float32Value was rejected by NominalPrimitiveSubtypes.float32A", "arg0", (size_t)k1);
      lean_inc(v3_1); double v4_13 = lb_t980449f277836feadaee_get13(v3_1);
       if (!lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_13(v4_13)) croak("%s.choices.values[%zu]?.error.float64Value was rejected by NominalPrimitiveSubtypes.float64A", "arg0", (size_t)k1);
      lean_inc(v3_1); lean_object * v4_14 = lbp_keep(scope, lb_t980449f277836feadaee_get14(v3_1));
      lean_inc(v4_14); if (!lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_14(v4_14)) croak("%s.choices.values[%zu]?.error.textValue was rejected by NominalPrimitiveSubtypes.textA", "arg0", (size_t)k1);
      lean_inc(v3_1); lean_object * v4_15 = lbp_keep(scope, lb_t980449f277836feadaee_get15(v3_1));
      lean_inc(v4_15); if (!lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_15(v4_15)) croak("%s.choices.values[%zu]?.error.bytesValue was rejected by NominalPrimitiveSubtypes.bytesA", "arg0", (size_t)k1);
      lean_inc(v3_1); uint32_t v4_16 = lb_t980449f277836feadaee_get16(v3_1);
       if (!lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_16(v4_16)) croak("%s.choices.values[%zu]?.error.charValue was rejected by NominalPrimitiveSubtypes.charA", "arg0", (size_t)k1);
      lean_inc(v3_1); size_t v4_17 = lb_t980449f277836feadaee_get17(v3_1);
       if (!lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_17(v4_17)) croak("%s.choices.values[%zu]?.error.usizeValue was rejected by NominalPrimitiveSubtypes.usizeA", "arg0", (size_t)k1);
      lean_inc(v3_1); size_t v4_18 = lb_t980449f277836feadaee_get18(v3_1);
       if (!lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_18(v4_18)) croak("%s.choices.values[%zu]?.error.isizeValue was rejected by NominalPrimitiveSubtypes.isizeA", "arg0", (size_t)k1); } } } } } } } } }
    lean_inc(a0);
    lean_object *checked = lb_2ff268195b6929b7f5ecf871(a0);
    if (lean_is_scalar(checked)) croak("Lean rejected an argument outside its checked refinement");
    lean_object *boxed = lean_ctor_get(checked, 0);
    lean_inc(boxed);
    lean_object * result = boxed;
    lean_dec(checked);
    lbp_keep(scope, result);
    lbp_finish(aTHX_ scope);
    lbp_component_ready(aTHX);
    SV *out = lb_write_466ade0f8f5195fb9b51(aTHX_ scope, result);
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
    lean_object * a0 = lb_read_bb4f1df77db4bc2e5592(aTHX_ scope, ST(0));
    { lean_inc(a0); lean_object *v0_0 = lbp_keep(scope, lb_tbb4f1df77db4bc2e5592_get0(a0));
      { 
      for (size_t k1 = 0; k1 < lean_array_size(v0_0); ++k1) { lean_object *e1 = lean_array_get_core(v0_0, k1);
      { lean_inc(e1); if (lb_td552bec1d6b17ed5222c_has(e1)) { lean_inc(e1); lean_object *v2 = lbp_keep(scope, lb_td552bec1d6b17ed5222c_get0(e1));
      { lean_inc(v2); lean_object *v3_19 = lbp_keep(scope, lb_t980449f277836feadaee_get19(v2));
      { lean_object *bound = lean_cstr_to_nat("3"); int below = lean_nat_lt(v3_19, bound); lean_dec(bound);
      if (!below) croak("%s.left[%zu]?.digit is not below its Fin 3 bound", "arg0", (size_t)k1); } } } } } }
      lean_inc(a0); lean_object *v0_1 = lbp_keep(scope, lb_tbb4f1df77db4bc2e5592_get1(a0));
      { 
      for (size_t k1 = 0; k1 < lean_array_size(v0_1); ++k1) { lean_object *e1 = lean_array_get_core(v0_1, k1);
      { lean_inc(e1); if (lb_td552bec1d6b17ed5222c_has(e1)) { lean_inc(e1); lean_object *v2 = lbp_keep(scope, lb_td552bec1d6b17ed5222c_get0(e1));
      { lean_inc(v2); lean_object *v3_19 = lbp_keep(scope, lb_t980449f277836feadaee_get19(v2));
      { lean_object *bound = lean_cstr_to_nat("3"); int below = lean_nat_lt(v3_19, bound); lean_dec(bound);
      if (!below) croak("%s.right[%zu]?.digit is not below its Fin 3 bound", "arg0", (size_t)k1); } } } } } } }
    { lean_inc(a0); lean_object * v0_0 = lbp_keep(scope, lb_tbb4f1df77db4bc2e5592_get0(a0));
      { 
      for (size_t k1 = 0; k1 < lean_array_size(v0_0); ++k1) { lean_object *e1 = lean_array_get_core(v0_0, k1);
      { lean_inc(e1); if (lb_td552bec1d6b17ed5222c_has(e1)) { lean_inc(e1); lean_object * v2_0 = lbp_keep(scope, lb_td552bec1d6b17ed5222c_get0(e1));
      { lean_inc(v2_0); lean_object * v3_0 = lbp_keep(scope, lb_t980449f277836feadaee_get0(v2_0));
      lean_inc(v3_0); if (!lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_0(v3_0)) croak("%s.left[%zu]?.unitValue was rejected by NominalPrimitiveSubtypes.unitA", "arg0", (size_t)k1);
      lean_inc(v2_0); uint8_t v3_1 = lb_t980449f277836feadaee_get1(v2_0);
       if (!lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_1(v3_1)) croak("%s.left[%zu]?.boolValue was rejected by NominalPrimitiveSubtypes.boolA", "arg0", (size_t)k1);
      lean_inc(v2_0); uint8_t v3_2 = lb_t980449f277836feadaee_get2(v2_0);
       if (!lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_2(v3_2)) croak("%s.left[%zu]?.uint8Value was rejected by NominalPrimitiveSubtypes.uint8A", "arg0", (size_t)k1);
      lean_inc(v2_0); uint16_t v3_3 = lb_t980449f277836feadaee_get3(v2_0);
       if (!lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_3(v3_3)) croak("%s.left[%zu]?.uint16Value was rejected by NominalPrimitiveSubtypes.uint16A", "arg0", (size_t)k1);
      lean_inc(v2_0); uint32_t v3_4 = lb_t980449f277836feadaee_get4(v2_0);
       if (!lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_4(v3_4)) croak("%s.left[%zu]?.uint32Value was rejected by NominalPrimitiveSubtypes.uint32A", "arg0", (size_t)k1);
      lean_inc(v2_0); uint64_t v3_5 = lb_t980449f277836feadaee_get5(v2_0);
       if (!lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_5(v3_5)) croak("%s.left[%zu]?.uint64Value was rejected by NominalPrimitiveSubtypes.uint64A", "arg0", (size_t)k1);
      lean_inc(v2_0); uint8_t v3_6 = lb_t980449f277836feadaee_get6(v2_0);
       if (!lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_6(v3_6)) croak("%s.left[%zu]?.int8Value was rejected by NominalPrimitiveSubtypes.int8A", "arg0", (size_t)k1);
      lean_inc(v2_0); uint16_t v3_7 = lb_t980449f277836feadaee_get7(v2_0);
       if (!lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_7(v3_7)) croak("%s.left[%zu]?.int16Value was rejected by NominalPrimitiveSubtypes.int16A", "arg0", (size_t)k1);
      lean_inc(v2_0); uint32_t v3_8 = lb_t980449f277836feadaee_get8(v2_0);
       if (!lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_8(v3_8)) croak("%s.left[%zu]?.int32Value was rejected by NominalPrimitiveSubtypes.int32A", "arg0", (size_t)k1);
      lean_inc(v2_0); uint64_t v3_9 = lb_t980449f277836feadaee_get9(v2_0);
       if (!lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_9(v3_9)) croak("%s.left[%zu]?.int64Value was rejected by NominalPrimitiveSubtypes.int64A", "arg0", (size_t)k1);
      lean_inc(v2_0); lean_object * v3_10 = lbp_keep(scope, lb_t980449f277836feadaee_get10(v2_0));
      lean_inc(v3_10); if (!lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_10(v3_10)) croak("%s.left[%zu]?.natValue was rejected by NominalPrimitiveSubtypes.natA", "arg0", (size_t)k1);
      lean_inc(v2_0); lean_object * v3_11 = lbp_keep(scope, lb_t980449f277836feadaee_get11(v2_0));
      lean_inc(v3_11); if (!lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_11(v3_11)) croak("%s.left[%zu]?.intValue was rejected by NominalPrimitiveSubtypes.intA", "arg0", (size_t)k1);
      lean_inc(v2_0); float v3_12 = lb_t980449f277836feadaee_get12(v2_0);
       if (!lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_12(v3_12)) croak("%s.left[%zu]?.float32Value was rejected by NominalPrimitiveSubtypes.float32A", "arg0", (size_t)k1);
      lean_inc(v2_0); double v3_13 = lb_t980449f277836feadaee_get13(v2_0);
       if (!lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_13(v3_13)) croak("%s.left[%zu]?.float64Value was rejected by NominalPrimitiveSubtypes.float64A", "arg0", (size_t)k1);
      lean_inc(v2_0); lean_object * v3_14 = lbp_keep(scope, lb_t980449f277836feadaee_get14(v2_0));
      lean_inc(v3_14); if (!lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_14(v3_14)) croak("%s.left[%zu]?.textValue was rejected by NominalPrimitiveSubtypes.textA", "arg0", (size_t)k1);
      lean_inc(v2_0); lean_object * v3_15 = lbp_keep(scope, lb_t980449f277836feadaee_get15(v2_0));
      lean_inc(v3_15); if (!lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_15(v3_15)) croak("%s.left[%zu]?.bytesValue was rejected by NominalPrimitiveSubtypes.bytesA", "arg0", (size_t)k1);
      lean_inc(v2_0); uint32_t v3_16 = lb_t980449f277836feadaee_get16(v2_0);
       if (!lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_16(v3_16)) croak("%s.left[%zu]?.charValue was rejected by NominalPrimitiveSubtypes.charA", "arg0", (size_t)k1);
      lean_inc(v2_0); size_t v3_17 = lb_t980449f277836feadaee_get17(v2_0);
       if (!lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_17(v3_17)) croak("%s.left[%zu]?.usizeValue was rejected by NominalPrimitiveSubtypes.usizeA", "arg0", (size_t)k1);
      lean_inc(v2_0); size_t v3_18 = lb_t980449f277836feadaee_get18(v2_0);
       if (!lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_18(v3_18)) croak("%s.left[%zu]?.isizeValue was rejected by NominalPrimitiveSubtypes.isizeA", "arg0", (size_t)k1); } } } } }
      lean_inc(a0); lean_object * v0_1 = lbp_keep(scope, lb_tbb4f1df77db4bc2e5592_get1(a0));
      { 
      for (size_t k1 = 0; k1 < lean_array_size(v0_1); ++k1) { lean_object *e1 = lean_array_get_core(v0_1, k1);
      { lean_inc(e1); if (lb_td552bec1d6b17ed5222c_has(e1)) { lean_inc(e1); lean_object * v2_0 = lbp_keep(scope, lb_td552bec1d6b17ed5222c_get0(e1));
      { lean_inc(v2_0); lean_object * v3_0 = lbp_keep(scope, lb_t980449f277836feadaee_get0(v2_0));
      lean_inc(v3_0); if (!lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_0(v3_0)) croak("%s.right[%zu]?.unitValue was rejected by NominalPrimitiveSubtypes.unitB", "arg0", (size_t)k1);
      lean_inc(v2_0); uint8_t v3_1 = lb_t980449f277836feadaee_get1(v2_0);
       if (!lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_1(v3_1)) croak("%s.right[%zu]?.boolValue was rejected by NominalPrimitiveSubtypes.boolB", "arg0", (size_t)k1);
      lean_inc(v2_0); uint8_t v3_2 = lb_t980449f277836feadaee_get2(v2_0);
       if (!lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_2(v3_2)) croak("%s.right[%zu]?.uint8Value was rejected by NominalPrimitiveSubtypes.uint8B", "arg0", (size_t)k1);
      lean_inc(v2_0); uint16_t v3_3 = lb_t980449f277836feadaee_get3(v2_0);
       if (!lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_3(v3_3)) croak("%s.right[%zu]?.uint16Value was rejected by NominalPrimitiveSubtypes.uint16B", "arg0", (size_t)k1);
      lean_inc(v2_0); uint32_t v3_4 = lb_t980449f277836feadaee_get4(v2_0);
       if (!lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_4(v3_4)) croak("%s.right[%zu]?.uint32Value was rejected by NominalPrimitiveSubtypes.uint32B", "arg0", (size_t)k1);
      lean_inc(v2_0); uint64_t v3_5 = lb_t980449f277836feadaee_get5(v2_0);
       if (!lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_5(v3_5)) croak("%s.right[%zu]?.uint64Value was rejected by NominalPrimitiveSubtypes.uint64B", "arg0", (size_t)k1);
      lean_inc(v2_0); uint8_t v3_6 = lb_t980449f277836feadaee_get6(v2_0);
       if (!lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_6(v3_6)) croak("%s.right[%zu]?.int8Value was rejected by NominalPrimitiveSubtypes.int8B", "arg0", (size_t)k1);
      lean_inc(v2_0); uint16_t v3_7 = lb_t980449f277836feadaee_get7(v2_0);
       if (!lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_7(v3_7)) croak("%s.right[%zu]?.int16Value was rejected by NominalPrimitiveSubtypes.int16B", "arg0", (size_t)k1);
      lean_inc(v2_0); uint32_t v3_8 = lb_t980449f277836feadaee_get8(v2_0);
       if (!lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_8(v3_8)) croak("%s.right[%zu]?.int32Value was rejected by NominalPrimitiveSubtypes.int32B", "arg0", (size_t)k1);
      lean_inc(v2_0); uint64_t v3_9 = lb_t980449f277836feadaee_get9(v2_0);
       if (!lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_9(v3_9)) croak("%s.right[%zu]?.int64Value was rejected by NominalPrimitiveSubtypes.int64B", "arg0", (size_t)k1);
      lean_inc(v2_0); lean_object * v3_10 = lbp_keep(scope, lb_t980449f277836feadaee_get10(v2_0));
      lean_inc(v3_10); if (!lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_10(v3_10)) croak("%s.right[%zu]?.natValue was rejected by NominalPrimitiveSubtypes.natB", "arg0", (size_t)k1);
      lean_inc(v2_0); lean_object * v3_11 = lbp_keep(scope, lb_t980449f277836feadaee_get11(v2_0));
      lean_inc(v3_11); if (!lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_11(v3_11)) croak("%s.right[%zu]?.intValue was rejected by NominalPrimitiveSubtypes.intB", "arg0", (size_t)k1);
      lean_inc(v2_0); float v3_12 = lb_t980449f277836feadaee_get12(v2_0);
       if (!lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_12(v3_12)) croak("%s.right[%zu]?.float32Value was rejected by NominalPrimitiveSubtypes.float32B", "arg0", (size_t)k1);
      lean_inc(v2_0); double v3_13 = lb_t980449f277836feadaee_get13(v2_0);
       if (!lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_13(v3_13)) croak("%s.right[%zu]?.float64Value was rejected by NominalPrimitiveSubtypes.float64B", "arg0", (size_t)k1);
      lean_inc(v2_0); lean_object * v3_14 = lbp_keep(scope, lb_t980449f277836feadaee_get14(v2_0));
      lean_inc(v3_14); if (!lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_14(v3_14)) croak("%s.right[%zu]?.textValue was rejected by NominalPrimitiveSubtypes.textB", "arg0", (size_t)k1);
      lean_inc(v2_0); lean_object * v3_15 = lbp_keep(scope, lb_t980449f277836feadaee_get15(v2_0));
      lean_inc(v3_15); if (!lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_15(v3_15)) croak("%s.right[%zu]?.bytesValue was rejected by NominalPrimitiveSubtypes.bytesB", "arg0", (size_t)k1);
      lean_inc(v2_0); uint32_t v3_16 = lb_t980449f277836feadaee_get16(v2_0);
       if (!lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_16(v3_16)) croak("%s.right[%zu]?.charValue was rejected by NominalPrimitiveSubtypes.charB", "arg0", (size_t)k1);
      lean_inc(v2_0); size_t v3_17 = lb_t980449f277836feadaee_get17(v2_0);
       if (!lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_17(v3_17)) croak("%s.right[%zu]?.usizeValue was rejected by NominalPrimitiveSubtypes.usizeB", "arg0", (size_t)k1);
      lean_inc(v2_0); size_t v3_18 = lb_t980449f277836feadaee_get18(v2_0);
       if (!lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_18(v3_18)) croak("%s.right[%zu]?.isizeValue was rejected by NominalPrimitiveSubtypes.isizeB", "arg0", (size_t)k1); } } } } } }
    lean_inc(a0);
    lean_object *checked = lb_fe44a84c56da309434fd70ce(a0);
    if (lean_is_scalar(checked)) croak("Lean rejected an argument outside its checked refinement");
    lean_object *boxed = lean_ctor_get(checked, 0);
    lean_inc(boxed);
    lean_object * result = boxed;
    lean_dec(checked);
    lbp_keep(scope, result);
    lbp_finish(aTHX_ scope);
    lbp_component_ready(aTHX);
    SV *out = lb_write_bb4f1df77db4bc2e5592(aTHX_ scope, result);
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
    lean_object * a0 = lb_read_6ed79f4a8a3bc4358259(aTHX_ scope, ST(0));
    lean_inc(a0);
    lean_object * result = lb_4d420414dfdb252510c59482(a0);
    lbp_keep(scope, result);
    lbp_finish(aTHX_ scope);
    lbp_component_ready(aTHX);
    SV *out = lb_write_d552bec1d6b17ed5222c(aTHX_ scope, result);
    lbp_component_ready(aTHX);
    SvREFCNT_inc(out);
    LBP_LEAVE();
    ST(0) = sv_2mortal(out);
    XSRETURN(1);


void
produce_choices(...)
  PPCODE:
    if (items != 1) croak("produce_choices expects 1 arguments");
    lbp_check_interpreter(aTHX);
    lbp_component_ready(aTHX);
    LBP_ENTER();
    lean_object * a0 = lb_read_6ed79f4a8a3bc4358259(aTHX_ scope, ST(0));
    lean_inc(a0);
    lean_object * result = lb_e791062d392a94a18563a45f(a0);
    lbp_keep(scope, result);
    lbp_finish(aTHX_ scope);
    lbp_component_ready(aTHX);
    SV *out = lb_write_466ade0f8f5195fb9b51(aTHX_ scope, result);
    lbp_component_ready(aTHX);
    SvREFCNT_inc(out);
    LBP_LEAVE();
    ST(0) = sv_2mortal(out);
    XSRETURN(1);


void
produce_event(...)
  PPCODE:
    if (items != 1) croak("produce_event expects 1 arguments");
    lbp_check_interpreter(aTHX);
    lbp_component_ready(aTHX);
    LBP_ENTER();
    lean_object * a0 = lb_read_6ed79f4a8a3bc4358259(aTHX_ scope, ST(0));
    lean_inc(a0);
    lean_object * result = lb_e721c226f4fcff66a4ffea0f(a0);
    lbp_keep(scope, result);
    lbp_finish(aTHX_ scope);
    lbp_component_ready(aTHX);
    SV *out = lb_write_466ade0f8f5195fb9b51(aTHX_ scope, result);
    lbp_component_ready(aTHX);
    SvREFCNT_inc(out);
    LBP_LEAVE();
    ST(0) = sv_2mortal(out);
    XSRETURN(1);


void
produce_group(...)
  PPCODE:
    if (items != 1) croak("produce_group expects 1 arguments");
    lbp_check_interpreter(aTHX);
    lbp_component_ready(aTHX);
    LBP_ENTER();
    lean_object * a0 = lb_read_6ed79f4a8a3bc4358259(aTHX_ scope, ST(0));
    lean_inc(a0);
    lean_object * result = lb_2c1c751c1667dd64cd4c3fe3(a0);
    lbp_keep(scope, result);
    lbp_finish(aTHX_ scope);
    lbp_component_ready(aTHX);
    SV *out = lb_write_f23b7206f2ff3fe94418(aTHX_ scope, result);
    lbp_component_ready(aTHX);
    SvREFCNT_inc(out);
    LBP_LEAVE();
    ST(0) = sv_2mortal(out);
    XSRETURN(1);


void
produce_pair(...)
  PPCODE:
    if (items != 1) croak("produce_pair expects 1 arguments");
    lbp_check_interpreter(aTHX);
    lbp_component_ready(aTHX);
    LBP_ENTER();
    lean_object * a0 = lb_read_6ed79f4a8a3bc4358259(aTHX_ scope, ST(0));
    lean_inc(a0);
    lean_object * result = lb_a54b47645ca8b931f9ef293a(a0);
    lbp_keep(scope, result);
    lbp_finish(aTHX_ scope);
    lbp_component_ready(aTHX);
    SV *out = lb_write_bb4f1df77db4bc2e5592(aTHX_ scope, result);
    lbp_component_ready(aTHX);
    SvREFCNT_inc(out);
    LBP_LEAVE();
    ST(0) = sv_2mortal(out);
    XSRETURN(1);


void
refuse_unit(...)
  PPCODE:
    if (items != 1) croak("refuse_unit expects 1 arguments");
    lbp_check_interpreter(aTHX);
    lbp_component_ready(aTHX);
    LBP_ENTER();
    lean_object * a0 = lb_read_980449f277836feadaee(aTHX_ scope, ST(0));
    { lean_inc(a0); lean_object *v0_19 = lbp_keep(scope, lb_t980449f277836feadaee_get19(a0));
      { lean_object *bound = lean_cstr_to_nat("3"); int below = lean_nat_lt(v0_19, bound); lean_dec(bound);
      if (!below) croak("%s.digit is not below its Fin 3 bound", "arg0"); } }
    { lean_inc(a0); lean_object * v0_0 = lbp_keep(scope, lb_t980449f277836feadaee_get0(a0));
      lean_inc(v0_0); if (!lb_0ca05a58ebc875690e9ebfb5_refinement_0_0(v0_0)) croak("%s.unitValue was rejected by NominalPrimitiveSubtypes.unitReject", "arg0");
      lean_inc(a0); uint8_t v0_1 = lb_t980449f277836feadaee_get1(a0);
       if (!lb_0ca05a58ebc875690e9ebfb5_refinement_0_1(v0_1)) croak("%s.boolValue was rejected by NominalPrimitiveSubtypes.boolA", "arg0");
      lean_inc(a0); uint8_t v0_2 = lb_t980449f277836feadaee_get2(a0);
       if (!lb_0ca05a58ebc875690e9ebfb5_refinement_0_2(v0_2)) croak("%s.uint8Value was rejected by NominalPrimitiveSubtypes.uint8A", "arg0");
      lean_inc(a0); uint16_t v0_3 = lb_t980449f277836feadaee_get3(a0);
       if (!lb_0ca05a58ebc875690e9ebfb5_refinement_0_3(v0_3)) croak("%s.uint16Value was rejected by NominalPrimitiveSubtypes.uint16A", "arg0");
      lean_inc(a0); uint32_t v0_4 = lb_t980449f277836feadaee_get4(a0);
       if (!lb_0ca05a58ebc875690e9ebfb5_refinement_0_4(v0_4)) croak("%s.uint32Value was rejected by NominalPrimitiveSubtypes.uint32A", "arg0");
      lean_inc(a0); uint64_t v0_5 = lb_t980449f277836feadaee_get5(a0);
       if (!lb_0ca05a58ebc875690e9ebfb5_refinement_0_5(v0_5)) croak("%s.uint64Value was rejected by NominalPrimitiveSubtypes.uint64A", "arg0");
      lean_inc(a0); uint8_t v0_6 = lb_t980449f277836feadaee_get6(a0);
       if (!lb_0ca05a58ebc875690e9ebfb5_refinement_0_6(v0_6)) croak("%s.int8Value was rejected by NominalPrimitiveSubtypes.int8A", "arg0");
      lean_inc(a0); uint16_t v0_7 = lb_t980449f277836feadaee_get7(a0);
       if (!lb_0ca05a58ebc875690e9ebfb5_refinement_0_7(v0_7)) croak("%s.int16Value was rejected by NominalPrimitiveSubtypes.int16A", "arg0");
      lean_inc(a0); uint32_t v0_8 = lb_t980449f277836feadaee_get8(a0);
       if (!lb_0ca05a58ebc875690e9ebfb5_refinement_0_8(v0_8)) croak("%s.int32Value was rejected by NominalPrimitiveSubtypes.int32A", "arg0");
      lean_inc(a0); uint64_t v0_9 = lb_t980449f277836feadaee_get9(a0);
       if (!lb_0ca05a58ebc875690e9ebfb5_refinement_0_9(v0_9)) croak("%s.int64Value was rejected by NominalPrimitiveSubtypes.int64A", "arg0");
      lean_inc(a0); lean_object * v0_10 = lbp_keep(scope, lb_t980449f277836feadaee_get10(a0));
      lean_inc(v0_10); if (!lb_0ca05a58ebc875690e9ebfb5_refinement_0_10(v0_10)) croak("%s.natValue was rejected by NominalPrimitiveSubtypes.natA", "arg0");
      lean_inc(a0); lean_object * v0_11 = lbp_keep(scope, lb_t980449f277836feadaee_get11(a0));
      lean_inc(v0_11); if (!lb_0ca05a58ebc875690e9ebfb5_refinement_0_11(v0_11)) croak("%s.intValue was rejected by NominalPrimitiveSubtypes.intA", "arg0");
      lean_inc(a0); float v0_12 = lb_t980449f277836feadaee_get12(a0);
       if (!lb_0ca05a58ebc875690e9ebfb5_refinement_0_12(v0_12)) croak("%s.float32Value was rejected by NominalPrimitiveSubtypes.float32A", "arg0");
      lean_inc(a0); double v0_13 = lb_t980449f277836feadaee_get13(a0);
       if (!lb_0ca05a58ebc875690e9ebfb5_refinement_0_13(v0_13)) croak("%s.float64Value was rejected by NominalPrimitiveSubtypes.float64A", "arg0");
      lean_inc(a0); lean_object * v0_14 = lbp_keep(scope, lb_t980449f277836feadaee_get14(a0));
      lean_inc(v0_14); if (!lb_0ca05a58ebc875690e9ebfb5_refinement_0_14(v0_14)) croak("%s.textValue was rejected by NominalPrimitiveSubtypes.textA", "arg0");
      lean_inc(a0); lean_object * v0_15 = lbp_keep(scope, lb_t980449f277836feadaee_get15(a0));
      lean_inc(v0_15); if (!lb_0ca05a58ebc875690e9ebfb5_refinement_0_15(v0_15)) croak("%s.bytesValue was rejected by NominalPrimitiveSubtypes.bytesA", "arg0");
      lean_inc(a0); uint32_t v0_16 = lb_t980449f277836feadaee_get16(a0);
       if (!lb_0ca05a58ebc875690e9ebfb5_refinement_0_16(v0_16)) croak("%s.charValue was rejected by NominalPrimitiveSubtypes.charA", "arg0");
      lean_inc(a0); size_t v0_17 = lb_t980449f277836feadaee_get17(a0);
       if (!lb_0ca05a58ebc875690e9ebfb5_refinement_0_17(v0_17)) croak("%s.usizeValue was rejected by NominalPrimitiveSubtypes.usizeA", "arg0");
      lean_inc(a0); size_t v0_18 = lb_t980449f277836feadaee_get18(a0);
       if (!lb_0ca05a58ebc875690e9ebfb5_refinement_0_18(v0_18)) croak("%s.isizeValue was rejected by NominalPrimitiveSubtypes.isizeA", "arg0"); }
    lean_inc(a0);
    lean_object *checked = lb_0ca05a58ebc875690e9ebfb5(a0);
    if (lean_is_scalar(checked)) croak("Lean rejected an argument outside its checked refinement");
    lean_object *boxed = lean_ctor_get(checked, 0);
    lean_inc(boxed);
    lean_object * result = boxed;
    lean_dec(checked);
    lbp_keep(scope, result);
    lbp_finish(aTHX_ scope);
    lbp_component_ready(aTHX);
    SV *out = lb_write_980449f277836feadaee(aTHX_ scope, result);
    lbp_component_ready(aTHX);
    SvREFCNT_inc(out);
    LBP_LEAVE();
    ST(0) = sv_2mortal(out);
    XSRETURN(1);


void
word_bits(...)
  PPCODE:
    if (items != 0) croak("word_bits expects 0 arguments");
    lbp_check_interpreter(aTHX);
    lbp_component_ready(aTHX);
    
    uint32_t result = lb_2df79ff835926bf7b8864ec6(lean_box(0));
    lbp_component_ready(aTHX);
    ST(0) = lb_write_c602b3c6c397cf3e3223(aTHX_ NULL, result);
    XSRETURN(1);

BOOT:
  lbp_check_interpreter(aTHX);
  extern lean_object *initialize_LeanBridgeNative19ad06f04a0c2d39(uint8_t);
  if (!lean_bridge_native_component_initialize("nominalprimitivesubtypes@1.0.0:58a916198cb50e5bb7fab57554591812a8381960749e100c43effecedd0a3672", (lean_bridge_native_initializer)initialize_LeanBridgeNative19ad06f04a0c2d39)) croak("Lean component initialization failed");

