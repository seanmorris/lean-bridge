#include "runtime.h"
#include "component.h"
static void lbp_component_ready(pTHX) {
  if (!lean_bridge_native_component_ready("nominalprimitivesubtypes@1.0.0:b7b85b630534423c7c72abcecdcdec481bb8b9892a9b67459b7b3edc40718194")) croak("Lean runtime is not ready or has been retired");
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

MODULE = LeanBridge::NominalPrimitiveSubtypes    PACKAGE = LeanBridge::NominalPrimitiveSubtypes
PROTOTYPES: DISABLE


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
  if (!lean_bridge_native_component_initialize("nominalprimitivesubtypes@1.0.0:b7b85b630534423c7c72abcecdcdec481bb8b9892a9b67459b7b3edc40718194", (lean_bridge_native_initializer)initialize_LeanBridgeNative19ad06f04a0c2d39)) croak("Lean component initialization failed");

