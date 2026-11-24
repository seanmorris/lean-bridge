/* Component-private conversions for BOTH imported members and exported calls.
   Java validates public values, C checks the private carrier before using it.
   A NULL jobject is an ordinary Unit on the wire; a failed conversion sets
   a JNI exception. A NULL lean_object* always indicates failure. */
#ifndef LB_JVM_HOST_WIRE_H
#define LB_JVM_HOST_WIRE_H
#include "host-domain.h"
#include <limits.h>
#include <stdlib.h>
#include <string.h>
enum {
    JH_UNIT,JH_BOOL,JH_CHAR,JH_UINT8,JH_UINT16,JH_UINT32,JH_UINT64,JH_USIZE,
    JH_INT8,JH_INT16,JH_INT32,JH_INT64,JH_ISIZE,JH_FLOAT32,JH_FLOAT64,
    JH_STRING,JH_BYTES,JH_NAT,JH_INT,JH_NOMINAL=32
};
extern lean_object *lb_jh_nat_text(lean_object *);
extern lean_object *lb_jh_int_text(lean_object *);
static void jh_raise(JNIEnv *e,const char *type,const char *why) {
    if ((*e)->ExceptionCheck(e)) return;
    jclass c=(*e)->FindClass(e,type);
    if (c) { (*e)->ThrowNew(e,c,why); (*e)->DeleteLocalRef(e,c); }
}
static void jh_bad(JNIEnv *e) { jh_raise(e,"java/lang/IllegalArgumentException","invalid JVM host wire value"); }
static jobject jh_word(JNIEnv *e,uint64_t u) {
    jclass c=(*e)->FindClass(e,"java/lang/Long"); if (!c) return NULL;
    jmethodID of=(*e)->GetStaticMethodID(e,c,"valueOf","(J)Ljava/lang/Long;");
    jobject result=of ? (*e)->CallStaticObjectMethod(e,c,of,(jlong)u) : NULL;
    (*e)->DeleteLocalRef(e,c); return result;
}
static jobject jh_bytes(JNIEnv *e,const char *ptr,size_t n) {
    if (n>INT_MAX) { jh_raise(e,"java/lang/IllegalArgumentException","value exceeds JVM array limit"); return NULL; }
    jbyteArray b=(*e)->NewByteArray(e,(jsize)n);
    if (b && n) (*e)->SetByteArrayRegion(e,b,0,(jsize)n,(const jbyte *)ptr);
    return b;
}
static jobject jh_to(lb_jh_frame *f,lb_jhd_session *s,int k,lean_object *v) {
    JNIEnv *e=f->env;
    if (k>=JH_NOMINAL) return LB_JHD(object)(f,s,k-JH_NOMINAL,v);
    uint64_t bits=0;
    switch(k) {
    case JH_UNIT: return NULL;
    case JH_BOOL: case JH_UINT8: case JH_UINT16: bits=lean_unbox(v); break;
    case JH_INT8: bits=(uint64_t)(int8_t)lean_unbox(v); break;
    case JH_INT16: bits=(uint64_t)(int16_t)lean_unbox(v); break;
    case JH_UINT32: case JH_CHAR: bits=lean_unbox_uint32(v); break;
    case JH_INT32: bits=(uint64_t)(int32_t)lean_unbox_uint32(v); break;
    case JH_UINT64: case JH_INT64: bits=lean_unbox_uint64(v); break;
    case JH_USIZE: case JH_ISIZE: bits=lean_unbox_usize(v); break;
    case JH_FLOAT32: { float x=lean_unbox_float32(v); uint32_t u; memcpy(&u,&x,4); bits=u; break; }
    case JH_FLOAT64: { double x=lean_unbox_float(v); memcpy(&bits,&x,8); break; }
    case JH_STRING: return jh_bytes(e,lean_string_cstr(v),lean_string_size(v)-1);
    case JH_BYTES: return jh_bytes(e,(const char *)lean_sarray_cptr(v),lean_sarray_size(v));
    case JH_NAT: case JH_INT: {
        lean_inc(v); lean_object *str=k==JH_NAT ? lb_jh_nat_text(v) : lb_jh_int_text(v);
        jobject out=jh_bytes(e,lean_string_cstr(str),lean_string_size(str)-1); lean_dec(str); return out;
    }
    default: jh_bad(e); return NULL;
    }
    return jh_word(e,bits);
}
static lean_object *jh_from(lb_jh_frame *f,lb_jhd_session *s,int k,jobject obj,jobject anchor) {
    JNIEnv *e=f->env;
    if (k>=JH_NOMINAL) return LB_JHD(wrap)(f,s,k-JH_NOMINAL,obj,anchor);
    if (k==JH_UNIT) { if (!obj) return lean_box(0); jh_bad(e); return NULL; }
    if (!obj) { jh_bad(e); return NULL; }
    if (k>=JH_STRING && k<=JH_INT) {
        jclass cls=(*e)->FindClass(e,"[B"); if (!cls) return NULL;
        if (!(*e)->IsInstanceOf(e,obj,cls)) { jh_bad(e); return NULL; }
        size_t n=(size_t)(*e)->GetArrayLength(e,obj);
        if (k==JH_BYTES) {
            lean_object *a=lean_alloc_sarray(1,n,n);
            if (n) (*e)->GetByteArrayRegion(e,obj,0,(jsize)n,(jbyte *)lean_sarray_cptr(a));
            if ((*e)->ExceptionCheck(e)) { lean_dec(a); return NULL; }
            return a;
        }
        char *p=malloc(n+1); if (!p) { jh_raise(e,"java/lang/OutOfMemoryError","cannot copy host value"); return NULL; }
        if (n) (*e)->GetByteArrayRegion(e,obj,0,(jsize)n,(jbyte *)p);
        lean_object *out=NULL;
        if (!(*e)->ExceptionCheck(e)) {
            p[n]=0;
            if (k==JH_STRING) out=lean_mk_string_from_bytes(p,n);
            else {
                size_t i=(k==JH_INT && p[0]=='-'); int digits=i<n;
                for (;digits && i<n;++i) digits=p[i]>='0' && p[i]<='9';
                if (!digits) jh_bad(e); else out=k==JH_INT ? lean_cstr_to_int(p) : lean_cstr_to_nat(p);
            }
        }
        free(p); return out;
    }
    jclass cls=(*e)->FindClass(e,"java/lang/Long"); if (!cls) return NULL;
    if (!(*e)->IsInstanceOf(e,obj,cls)) { jh_bad(e); return NULL; }
    jmethodID get=(*e)->GetMethodID(e,cls,"longValue","()J"); if (!get) return NULL;
    jlong n=(*e)->CallLongMethod(e,obj,get); if ((*e)->ExceptionCheck(e)) return NULL;
    uint64_t u=(uint64_t)n;
    switch(k) {
    case JH_BOOL: if (u<=1) return lean_box(u); break;
    case JH_UINT8: if (u<=UINT8_MAX) return lean_box(u); break;
    case JH_UINT16: if (u<=UINT16_MAX) return lean_box(u); break;
    case JH_INT8: if (n>=INT8_MIN && n<=INT8_MAX) return lean_box((uint8_t)n); break;
    case JH_INT16: if (n>=INT16_MIN && n<=INT16_MAX) return lean_box((uint16_t)n); break;
    case JH_CHAR: if (u<=0x10ffff && !(u>=0xd800 && u<=0xdfff)) return lean_box_uint32((uint32_t)u); break;
    case JH_UINT32: if (u<=UINT32_MAX) return lean_box_uint32((uint32_t)u); break;
    case JH_INT32: if (n>=INT32_MIN && n<=INT32_MAX) return lean_box_uint32((uint32_t)n); break;
    case JH_INT64: case JH_UINT64: return lean_box_uint64(u);
    case JH_ISIZE: case JH_USIZE: return lean_box_usize((size_t)u);
    case JH_FLOAT32: { uint32_t w=(uint32_t)u; float x; memcpy(&x,&w,4); return lean_box_float32(x); }
    case JH_FLOAT64: { double x; memcpy(&x,&u,8); return lean_box_float(x); }
    default: break;
    }
    jh_bad(e); return NULL;
}
#endif
