/* Component-private, little-endian .NET 8 Linux x64 member wire. */
#ifndef LB_DN_HOST_WIRE_H
#define LB_DN_HOST_WIRE_H
#include "host-frame.h"
#include <string.h>
#include <stdlib.h>
#define LB_MAX_BYTES (16u*1024*1024)
#define LB(x) lb_dn_int_##x
#define LB_TASK_GMP 0
typedef enum { LB(OK), LB(LIMIT), LB(INVALID), LB(NO_MEMORY) } LB(status);
typedef struct { uint64_t *words; size_t len; int negative; } LB(integer);
typedef struct { const uint64_t *words; size_t len; int negative; } LB(integer_view);
#include "task-integers.h"
#undef LB_TASK_GMP
#undef LB
enum { DN_UNIT, DN_BOOL, DN_CHAR, DN_UINT8, DN_UINT16, DN_UINT32, DN_UINT64, DN_USIZE,
       DN_INT8, DN_INT16, DN_INT32, DN_INT64, DN_ISIZE, DN_FLOAT32, DN_FLOAT64,
       DN_STRING, DN_BYTES, DN_NAT, DN_INT };
static int dn_put(int k,lean_object *v,uint64_t *w,size_t *budget,lb_dn_int_integer *scratch) {
    switch(k) {
    case DN_UNIT: return 1;
    case DN_BOOL: case DN_UINT8: case DN_INT8: case DN_UINT16: case DN_INT16: w[0]=lean_unbox(v); return 1;
    case DN_CHAR: case DN_UINT32: case DN_INT32: w[0]=lean_unbox_uint32(v); return 1;
    case DN_UINT64: case DN_INT64: w[0]=lean_unbox_uint64(v); return 1;
    case DN_USIZE: case DN_ISIZE: w[0]=lean_unbox_usize(v); return 1;
    case DN_FLOAT32: { uint32_t b; float n=lean_unbox_float32(v); memcpy(&b,&n,4); w[0]=b; return 1; }
    case DN_FLOAT64: { double n=lean_unbox_float(v); memcpy(w,&n,8); return 1; }
    case DN_BYTES: case DN_STRING: {
        size_t n=k==DN_BYTES ? lean_sarray_size(v) : lean_string_size(v)-1;
        if(n>LB_MAX_BYTES-*budget) return 0;
        *budget+=n; w[0]=k==DN_BYTES ? (uintptr_t)lean_sarray_cptr(v) : (uintptr_t)lean_string_cstr(v); w[1]=n; return 1;
    }
    case DN_INT: case DN_NAT: {
        int sign=k==DN_INT; lean_object *mag=sign ? lean_nat_abs(v) : v;
        size_t count=0; int fits=lb_word_count(mag,&count)==lb_dn_int_OK && lb_charge_integer(count,budget)==lb_dn_int_OK;
        if(sign) lean_dec(mag);
        if(!fits || lb_integer_result(scratch,v,sign)!=lb_dn_int_OK) return 0;
        w[0]=(uintptr_t)scratch->words; w[1]=scratch->len; w[2]=(uint64_t)scratch->negative; return 1;
    }
    default: return 0;
    }
}
static lean_object *dn_get(int k,const uint64_t *w) {
    const uint64_t n=w[0]; const char *p=(const char *)(uintptr_t)n;
    if(k!=DN_NAT && k!=DN_INT && (w[2] || (k!=DN_STRING && k!=DN_BYTES && w[1]))) return NULL;
    switch(k) {
    case DN_UNIT: return n ? NULL : lean_box(0);
    case DN_BOOL: return n>1 ? NULL : lean_box(n);
    case DN_UINT8: case DN_INT8: return n>UINT8_MAX ? NULL : lean_box(n);
    case DN_UINT16: case DN_INT16: return n>UINT16_MAX ? NULL : lean_box(n);
    case DN_CHAR: if(n>0x10ffff || (n>=0xd800 && n<=0xdfff)) return NULL; return lean_box_uint32((uint32_t)n);
    case DN_UINT32: case DN_INT32: return n>UINT32_MAX ? NULL : lean_box_uint32((uint32_t)n);
    case DN_UINT64: case DN_INT64: return lean_box_uint64(n);
    case DN_USIZE: case DN_ISIZE: return lean_box_usize(n);
    case DN_FLOAT32: { if(n>UINT32_MAX) return NULL; uint32_t b=(uint32_t)n; float f; memcpy(&f,&b,4); return lean_box_float32(f); }
    case DN_FLOAT64: { double f; memcpy(&f,w,8); return lean_box_float(f); }
    case DN_STRING: case DN_BYTES: {
        size_t len=w[1]; if(len>LB_MAX_BYTES || (len && !p)) return NULL;
        if(k==DN_STRING) return lean_mk_string_from_bytes(len ? p : "",len);
        lean_object *a=lean_alloc_sarray(1,len,len); if(len) memcpy(lean_sarray_cptr(a),p,len); return a;
    }
    case DN_NAT: case DN_INT: {
        if(w[2]>1) return NULL; size_t charge=0;
        lb_dn_int_integer_view view={(const uint64_t *)p,w[1],(int)w[2]};
        return lb_check_integer(view,k==DN_INT,&charge)==lb_dn_int_OK ? lb_integer_arg(view,k==DN_INT) : NULL;
    }
    default: return NULL;
    }
}
#undef LB_MAX_BYTES
#endif
