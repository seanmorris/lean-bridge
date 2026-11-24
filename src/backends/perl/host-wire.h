/* Include in the private component XS, after its Lean big-integer helper
   declarations. Never run Perl conversions outside a protected member or
   the XS ingress scope. Reuse the synchronous package's scalar checks. */
#ifndef LB_PERL_HOST_WIRE_H
#define LB_PERL_HOST_WIRE_H
#include "host-frame.h"
#include "host-domain.h"
#include "sync-wire.h"
enum {
  PH_UNIT, PH_BOOL, PH_CHAR, PH_STRING, PH_BYTES, PH_NAT, PH_INT,
  PH_UINT8, PH_UINT16, PH_UINT32, PH_UINT64, PH_USIZE,
  PH_INT8, PH_INT16, PH_INT32, PH_INT64, PH_ISIZE,
  PH_FLOAT32, PH_FLOAT64, PH_NOMINAL=64
};
static void ph_drop_lean(pTHX_ void *o) { PERL_UNUSED_CONTEXT; lean_dec((lean_object *)o); }
static SV *ph_out(pTHX_ lbp_host_session *s, int k, b_lean_obj_arg v) {
  if (k>=PH_NOMINAL) return lbp_host_object(aTHX_ s,k-PH_NOMINAL,v);
  switch(k) {
    case PH_UNIT: return &PL_sv_undef;
    case PH_BOOL: return boolSV(lean_unbox(v));
    case PH_CHAR: return lbs_char(aTHX_ lean_unbox_uint32(v));
    case PH_UINT8: case PH_UINT16: return sv_2mortal(newSVuv(lean_unbox(v)));
    case PH_UINT32: return sv_2mortal(newSVuv(lean_unbox_uint32(v)));
    case PH_UINT64: return sv_2mortal(newSVuv(lean_unbox_uint64(v)));
    case PH_USIZE: return sv_2mortal(newSVuv(lean_unbox_usize(v)));
    case PH_INT8: return sv_2mortal(newSViv((int8_t)lean_unbox(v)));
    case PH_INT16: return sv_2mortal(newSViv((int16_t)lean_unbox(v)));
    case PH_INT32: return sv_2mortal(newSViv((int32_t)lean_unbox_uint32(v)));
    case PH_INT64: return sv_2mortal(newSViv((int64_t)lean_unbox_uint64(v)));
    case PH_ISIZE: return sv_2mortal(newSViv((intptr_t)lean_unbox_usize(v)));
    case PH_FLOAT32: return sv_2mortal(newSVnv(lean_unbox_float32(v)));
    case PH_FLOAT64: return sv_2mortal(newSVnv(lean_unbox_float(v)));
    case PH_STRING: case PH_BYTES: {
      int text=k==PH_STRING;
      uint64_t a[]={(uintptr_t)(text ? (void *)lean_string_cstr(v) : (void *)lean_sarray_cptr(v)),
                    text ? lean_string_size(v)-1 : lean_sarray_size(v),0,1};
      return lbs_bytes(aTHX_ a,text);
    }
    case PH_NAT: case PH_INT: {
      SSGROW(4); lean_inc(v);
      lean_object *t=k==PH_NAT ? PH_NAT_TEXT(v) : PH_INT_TEXT(v);
      SAVEDESTRUCTOR_X(ph_drop_lean,t);
      size_t n=lean_string_size(t)-1;
      if (n>LBS_MAX) croak("oversized Perl host integer");
      return lbp_bigint_from_text(aTHX_ lean_string_cstr(t),n);
    }
    default: croak("unknown Perl host carrier");
  }
}
static lean_object *ph_in(pTHX_ lbp_host_session *s,int k,SV *v,SV *anchor) {
  /* Conversion may inspect flags and then read the value. A tied scalar
     must supply one observation, not a fresh FETCH for each inspection. */
  if (SvGMAGICAL(v)) v=sv_mortalcopy(v);
  if (k>=PH_NOMINAL) return lbp_host_wrap(aTHX_ s,k-PH_NOMINAL,v,anchor);
  switch(k) {
    case PH_UNIT: lbp_plain(aTHX_ v); if (SvOK(v)) croak("Unit requires undef"); return lean_box(0);
    case PH_BOOL: lbp_plain(aTHX_ v); if (!SvIsBOOL(v)) croak("Bool requires a native boolean"); return lean_box(SvTRUE(v)!=0);
    case PH_UINT8: return lean_box(lbp_unsigned(aTHX_ v,UINT8_MAX));
    case PH_UINT16: return lean_box(lbp_unsigned(aTHX_ v,UINT16_MAX));
    case PH_UINT32: return lean_box_uint32(lbp_unsigned(aTHX_ v,UINT32_MAX));
    case PH_UINT64: return lean_box_uint64(lbp_unsigned(aTHX_ v,UINT64_MAX));
    case PH_USIZE: return lean_box_usize(lbp_unsigned(aTHX_ v,SIZE_MAX));
    case PH_INT8: return lean_box((uint8_t)lbp_signed(aTHX_ v,INT8_MIN,INT8_MAX));
    case PH_INT16: return lean_box((uint16_t)lbp_signed(aTHX_ v,INT16_MIN,INT16_MAX));
    case PH_INT32: return lean_box_uint32((uint32_t)lbp_signed(aTHX_ v,INT32_MIN,INT32_MAX));
    case PH_INT64: return lean_box_uint64((uint64_t)lbp_signed(aTHX_ v,INT64_MIN,INT64_MAX));
    case PH_ISIZE: return lean_box_usize((size_t)lbp_signed(aTHX_ v,INTPTR_MIN,INTPTR_MAX));
    case PH_FLOAT32: case PH_FLOAT64:
      lbp_plain(aTHX_ v);
      if (!SvNOK(v) && !SvIOK(v)) croak("Float requires a numeric scalar");
      return k==PH_FLOAT32 ? lean_box_float32((float)SvNV(v)) : lean_box_float(SvNV(v));
    case PH_CHAR: case PH_STRING: case PH_BYTES: {
      uint64_t a[3]={0}; lbs_text(aTHX_ v,a,k!=PH_BYTES,k==PH_CHAR);
      if (k==PH_CHAR) return lean_box_uint32(a[0]);
      if (k==PH_STRING) return lean_mk_string_from_bytes((const char *)(uintptr_t)a[0],a[1]);
      lean_object *bytes=lean_alloc_sarray(1,a[1],a[1]);
      if (a[1]) memcpy(lean_sarray_cptr(bytes),(const void *)(uintptr_t)a[0],a[1]);
      return bytes;
    }
    case PH_NAT: case PH_INT: {
      SV *text=lbp_bigint_text(aTHX_ v,k==PH_NAT);
      if (SvROK(text) || !SvPOK(text) || SvCUR(text)>LBS_MAX) croak("invalid Perl host integer text");
      return k==PH_NAT ? lean_cstr_to_nat(SvPVX(text)) : lean_cstr_to_int(SvPVX(text));
    }
    default: croak("unknown Perl host carrier");
  }
}
typedef struct {
  unsigned slot,n;
  const int *tags;
  int out,anchor;
  lean_object **values;
} ph_member;
static lean_object *ph_dispatch(pTHX_ void *opaque) {
  ph_member *m=opaque; ph_frame *f=ph_active;
  SV *table=f->binding;
  if (!f->session || !SvROK(table) || SvTYPE(SvRV(table))!=SVt_PVAV || SvMAGICAL(SvRV(table)))
    croak("missing private Perl host table");
  SV **entry=av_fetch((AV *)SvRV(table),m->slot,0);
  if (!entry || !SvROK(*entry) || SvTYPE(SvRV(*entry))!=SVt_PVCV) croak("invalid Perl host slot");
  /* Conversion can call Perl (BigInt, tied values) and relocate the Perl
     stack. Finish conversion and pin the slot before taking SP. */
  SV *method=sv_2mortal(newRV_inc(SvRV(*entry))), *args[64];
  for (unsigned i=0;i<m->n;++i) args[i]=ph_out(aTHX_ f->session,m->tags[i],m->values[i]);
  /* The method may reassign its argument scalars. Keep a separate reference
     to the original anchor, never the alias it received. */
  SV *anchor=m->anchor<0 ? NULL : sv_2mortal(newRV_inc(SvRV(args[m->anchor])));
  dSP; PUSHMARK(SP); EXTEND(SP,(SSize_t)m->n);
  for (unsigned i=0;i<m->n;++i) PUSHs(args[i]);
  PUTBACK; int n=call_sv(method,G_SCALAR); SPAGAIN;
  if (n!=1) croak("missing Perl host reply");
  SV *answer=POPs; PUTBACK;
  answer=sv_2mortal(SvREFCNT_inc(answer));
  lean_object *v=ph_in(aTHX_ f->session,m->out,answer,anchor);
  if (m->out>=PH_NOMINAL) lbp_host_admit(aTHX_ f->session,m->out-PH_NOMINAL,v);
  return v;
}
#endif
