/* Private XS conversions over the compiled, pointer-only synchronous wire.
   No native pointer or caller-selected symbol crosses the public Perl API. */
#include "runtime.h"
#include <stdint.h>
#include <string.h>
#define LBS_MAX (16u * 1024u * 1024u)
_Static_assert(sizeof(IV) == 8 && sizeof(UV) == 8 && sizeof(uintptr_t) == 8, "Perl Linux x64");

static int lbs_unicode(const U8 *s, size_t n) {
    return !n || is_utf8_string_flags(s, n, UTF8_DISALLOW_SURROGATE | UTF8_DISALLOW_SUPER);
}
static void lbs_text(pTHX_ SV *v, uint64_t *a, int text, int character) {
    lbp_plain(aTHX_ v);
    if (!SvPOK(v) || (!text && SvUTF8(v))) croak(text ? "Expected Perl text" : "Expected an octet string");
    /* A later argument may run Perl code and mutate the original scalar. */
    SV *copy = sv_mortalcopy(v);
    STRLEN n; const U8 *s;
    if (text) s = (const U8 *)SvPVutf8(copy,n); else s = (const U8 *)SvPV(copy,n);
    if (n > LBS_MAX || (text && !lbs_unicode(s,n))) croak("Invalid Unicode text or oversized buffer");
    if (character) {
        STRLEN used;
        if (!n || n > 4) croak("Char requires one Unicode scalar");
        a[0] = utf8_to_uvchr_buf(s,s+n,&used);
        if (used != n) croak("Char requires one Unicode scalar");
    } else { a[0] = (uintptr_t)s; a[1] = n; }
}
static void lbs_float(pTHX_ SV *v, uint64_t *a, int single) {
    lbp_plain(aTHX_ v);
    if (!SvNOK(v) && !SvIOK(v)) croak("Float requires a numeric scalar");
    if (single) { float f = (float)SvNV(v); memcpy(a,&f,4); }
    else { double f = (double)SvNV(v); memcpy(a,&f,8); }
}
static void lbs_integer(pTHX_ SV *v, uint64_t *a, int natural) {
    dSP;
    if (!SvROK(v) || !sv_derived_from(v,"Math::BigInt")) croak("Expected Math::BigInt");
    PUSHMARK(SP); XPUSHs(v); PUTBACK;
    int count = call_method("as_hex", G_SCALAR); SPAGAIN;
    if (count != 1) croak("Expected one Math::BigInt magnitude");
    SV *hex = sv_mortalcopy(POPs); PUTBACK;
    if (SvROK(hex) || !SvPOK(hex)) croak("Math::BigInt must be finite and integral");
    STRLEN n; const char *s = SvPV(hex,n);
    int neg = n && *s == '-'; if (neg) { ++s; --n; }
    if ((natural && neg) || n < 3 || s[0] != '0' || s[1] != 'x') croak("Invalid Math::BigInt for this Lean type");
    s += 2; n -= 2;
    if (n == 1 && *s == '0' && !neg) return;
    if (n > 2 * LBS_MAX || *s == '0') croak("Invalid or oversized integer magnitude");
    size_t words = (n + 15) / 16;
    SV *storage = sv_2mortal(newSV(words * 8 + 1));
    uint64_t *p = (uint64_t *)SvPVX(storage); memset(p,0,words*8);
    for (size_t i=0;i<n;++i) {
        unsigned c = (unsigned char)s[n-1-i];
        unsigned d = c >= '0' && c <= '9' ? c-'0' : c >= 'a' && c <= 'f' ? c-'a'+10 : c >= 'A' && c <= 'F' ? c-'A'+10 : 16;
        if (d > 15) croak("Invalid Math::BigInt magnitude");
        p[i/16] |= (uint64_t)d << ((i%16)*4);
    }
    a[0] = (uintptr_t)p; a[1] = words; a[2] = neg;
}
static SV *lbs_wide(pTHX_ const uint64_t *a, int natural) {
    const uint64_t *p = (const uint64_t *)(uintptr_t)a[0]; size_t n = a[1];
    if (a[3] != 2 || n > LBS_MAX/8 || (n && !p) || a[2] > 1 || (a[2] && (natural || !n))) croak("Invalid native integer");
    if (!n) return lbp_bigint_from_text(aTHX_ "0",1);
    const char *digits = "0123456789abcdef"; size_t len = n*16+2+a[2];
    SV *hold = sv_2mortal(newSV(len+1)); char *buf = SvPVX(hold), *s=buf;
    if (a[2]) *s++='-'; *s++='0'; *s++='x';
    for (size_t i=n;i>0;--i) for (int j=15;j>=0;--j) *s++=digits[(p[i-1]>>(j*4))&15];
    return lbp_bigint_from_text(aTHX_ buf,len);
}
static SV *lbs_bytes(pTHX_ const uint64_t *a, int text) {
    const U8 *p = (const U8 *)(uintptr_t)a[0]; size_t n = a[1];
    if (a[3] != 1 || n > LBS_MAX || (n && !p) || (text && !lbs_unicode(p,n))) croak("Invalid native text or bytes");
    SV *v = sv_2mortal(newSVpvn(n ? (const char *)p : "",n));
    if (text) SvUTF8_on(v);
    return v;
}
static SV *lbs_char(pTHX_ uint64_t c) {
    U8 bytes[UTF8_MAXBYTES+1];
    if (c > 0x10ffff || (c >= 0xd800 && c <= 0xdfff)) croak("Invalid native Char");
    U8 *end = uvchr_to_utf8(bytes,(UV)c);
    SV *s = sv_2mortal(newSVpvn((const char *)bytes,end-bytes)); SvUTF8_on(s); return s;
}
static SV *lbs_nv(pTHX_ const uint64_t *a, int single) {
    if (single) { float f; memcpy(&f,a,4); return sv_2mortal(newSVnv(f)); }
    double f; memcpy(&f,a,8); return sv_2mortal(newSVnv(f));
}
static SV *lbs_failure(pTHX_ const char *klass, const char *name, SV *v) {
    HV *h=(HV *)sv_2mortal((SV *)newHV());
    hv_stores(h,"declaration",newSVpv(name,0)); hv_stores(h,"payload",SvREFCNT_inc(v));
    return sv_bless(sv_2mortal(newRV_inc((SV *)h)),gv_stashpv(klass,GV_ADD));
}
