/* Included only inside a generated MRI extension, with its checked Lean prototypes. */
#include <string.h>
static VALUE text_value(VALUE x) {
    Check_Type(x,T_STRING);
    rb_encoding *enc=rb_enc_get(x);
    if ((enc!=rb_utf8_encoding() && enc!=rb_usascii_encoding()) || rb_enc_str_coderange(x)==ENC_CODERANGE_BROKEN)
        rb_raise(rb_eEncodingError,"expected valid UTF-8 or US-ASCII");
    return x;
}
static lean_object *lb_string(VALUE x) {
    VALUE s=text_value(x); return lean_mk_string_from_bytes(RSTRING_PTR(s),RSTRING_LEN(s));
}
static lean_object *lb_char(VALUE x) {
    VALUE s=text_value(x); const char *p=RSTRING_PTR(s); long n=RSTRING_LEN(s); int used=0;
    if (!n) rb_raise(rb_eRangeError,"Char requires one Unicode scalar");
    unsigned ch=rb_enc_codepoint_len(p,p+n,&used,rb_enc_get(s));
    if (used!=n || ch>0x10ffff || (ch>=0xd800 && ch<=0xdfff)) rb_raise(rb_eRangeError,"Char requires one Unicode scalar");
    return lean_box_uint32(ch);
}
static lean_object *lb_bytes(VALUE x) {
    Check_Type(x,T_STRING); if(rb_enc_get(x)!=rb_ascii8bit_encoding()) rb_raise(rb_eEncodingError,"expected binary String");
    size_t n=(size_t)RSTRING_LEN(x); if(lean_alloc_sarray_would_overflow(1,n)) rb_raise(rb_eRangeError,"ByteArray too large");
    lean_object *v=lean_alloc_sarray(1,n,n); memcpy(lean_sarray_cptr(v),RSTRING_PTR(x),n); return v;
}
static lean_object *lb_big_in(VALUE x,int sign) {
    if(!RB_INTEGER_TYPE_P(x)) rb_raise(rb_eTypeError,"expected an Integer");
    VALUE s=FIXNUM_P(x)?rb_fix2str(x,10):rb_big2str(x,10);const char *p=StringValueCStr(s);
    if(!sign && p[0]=='-') rb_raise(rb_eRangeError,"Nat cannot be negative");
    return sign?lean_cstr_to_int(p):lean_cstr_to_nat(p);
}
static VALUE parse_decimal(VALUE data) { return rb_cstr_to_inum(lean_string_cstr((lean_object*)data),10,1); }
static VALUE lb_big_out(lean_object *v,int sign) {
    lean_inc(v);lean_object *str=sign?lb_ruby_host_int_text(v):lb_ruby_host_nat_text(v);
    int state=0; VALUE x=rb_protect(parse_decimal,(VALUE)str,&state);lean_dec(str);if(state) rb_jump_tag(state);return x;
}
static double lb_float(VALUE x) { Check_Type(x,T_FLOAT); return RFLOAT_VALUE(x); }
static uint8_t lb_bool(VALUE x) { if (x!=Qtrue && x!=Qfalse) rb_raise(rb_eTypeError,"expected true or false"); return x==Qtrue; }
static lean_object *lb_unit(VALUE x) { if(x!=unit) rb_raise(rb_eTypeError,"expected UNIT"); return lean_box(0); }
static uint64_t lb_integer(VALUE x,unsigned bits,int sign) {
    if (!RB_INTEGER_TYPE_P(x)) rb_raise(rb_eTypeError,"expected an Integer");
    uint64_t n=0; int mode=rb_integer_pack(x,&n,1,sizeof(n),0,INTEGER_PACK_NATIVE_BYTE_ORDER|INTEGER_PACK_LSWORD_FIRST);
    uint64_t limit=sign?(UINT64_C(1)<<(bits-1)):(bits==64?UINT64_MAX:((UINT64_C(1)<<bits)-1));
    if(mode==2 || mode==-2 || (mode<0 && !sign) || n>limit || (sign && mode>=0 && n==limit)) rb_raise(rb_eRangeError,"integer outside Lean range");
    return mode<0?0-n:n;
}
