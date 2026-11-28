/* Witness for the shared frame, not a Maven provider or public JNI API. */
#include "host-frame.h"
#include <stdint.h>
#include <stdlib.h>
extern void lean_initialize_runtime_module(void);
extern lean_object *initialize_Init(uint8_t);
extern lean_object *initialize_FrameCheck(uint8_t);
extern lean_object *lb_test_jvm_through(uint32_t);
extern lean_object *lb_test_jvm_mapped(uint32_t);
extern lean_object *lb_test_jvm_replace(uint32_t);
extern lean_object *lb_test_jvm_first(uint32_t);
static jobject boxed(JNIEnv *e, uint32_t v) {
    jclass cls = (*e)->FindClass(e, "java/lang/Long");
    if (!cls) return NULL;
    jmethodID of = (*e)->GetStaticMethodID(e, cls, "valueOf", "(J)Ljava/lang/Long;");
    return of ? (*e)->CallStaticObjectMethod(e, cls, of, (jlong)v) : NULL;
}
lean_object *lean_bridge_host_jvm_box_observe(uint32_t value) {
    lb_jh_frame *f = lb_jh_current(); JNIEnv *e = f->env;
    jobject n = boxed(e, value);
    if ((*e)->ExceptionCheck(e)) return lb_jh_catch(f);
    jclass object = (*e)->FindClass(e, "java/lang/Object");
    if (!object) return lb_jh_catch(f);
    jobjectArray args = (*e)->NewObjectArray(e, 1, object, n);
    if (!args) return lb_jh_catch(f);
    jobject out = lb_jh_member(f, 0, args);
    if ((*e)->ExceptionCheck(e)) return lb_jh_catch(f);
    jclass cls = (*e)->GetObjectClass(e, out);
    jmethodID val = cls ? (*e)->GetMethodID(e, cls, "longValue", "()J") : NULL;
    if (!val) return lb_jh_catch(f);
    jlong v = (*e)->CallLongMethod(e, out, val);
    return (*e)->ExceptionCheck(e) ? lb_jh_catch(f) : lean_io_result_mk_ok(lean_box_uint32((uint32_t)v));
}
typedef struct { jint op; uint32_t arg; } args;
static jobject execute(lb_jh_frame *f, void *data) {
    args *a = data; JNIEnv *e = f->env; static int initialized;
    if (!initialized) {
        lean_initialize_runtime_module();
        lean_object *init = initialize_Init(1); if (!lean_io_result_is_ok(init)) abort(); lean_dec(init);
        init = initialize_FrameCheck(1); if (!lean_io_result_is_ok(init)) abort(); lean_dec(init);
        lean_io_mark_end_initialization(); initialized=1;
    }
    lean_object *res = (a->op == 0 ? lb_test_jvm_through : a->op == 1 ? lb_test_jvm_mapped :
                        a->op == 2 ? lb_test_jvm_replace : lb_test_jvm_first)(a->arg);
    lean_object *v = lean_ctor_get(res,0); jobject answer = NULL;
    if (!lean_io_result_is_ok(res)) {
        if (!lb_jh_rethrow(f,v)) {
            jclass state = (*e)->FindClass(e,"java/lang/IllegalStateException");
            if (state) (*e)->ThrowNew(e,state,"replacement Lean IO error");
        }
    } else if (a->op == 1 && lean_obj_tag(v) == 0) {
        answer = (*e)->NewStringUTF(e,lean_string_cstr(lean_ctor_get(v,0)));
    } else answer = boxed(e,lean_unbox_uint32(a->op == 1 ? lean_ctor_get(v,0) : v));
    lean_dec(res); return answer;
}
JNIEXPORT jobject JNICALL Java_example_FrameCheck_call(JNIEnv *e,jclass cls,jobject binder,jint op,jlong v) {
    (void)cls; args a = {op,(uint32_t)v};
    return lb_jh_call(e,binder,NULL,execute,&a);
}
