/* Private JNI ingress for synchronous compiled Lean calls. */
#ifndef LB_JVM_HOST_FRAME_H
#define LB_JVM_HOST_FRAME_H
#include <jni.h>
#include <lean/lean.h>

typedef struct lb_jh_frame {
    JNIEnv *env;
    jobject binder, input;
    jmethodID invoke;
    int fatal;
    jthrowable terminal;
    int (*available)(void);
    void (*retire)(void);
    struct lb_jh_fault *faults;
    struct lb_jh_frame *parent;
} lb_jh_frame;

/* body runs on the shared Lean owner. Its return is a JNI local belonging
   to that thread; a pending exception takes precedence over the result. */
typedef jobject (*lb_jh_body)(lb_jh_frame *, void *);
jobject lb_jh_call(JNIEnv *, jobject binder, jobject input, lb_jh_body, void *context);
lb_jh_frame *lb_jh_current(void);
int lb_jh_guard(lb_jh_frame *);
jobject lb_jh_invoke(lb_jh_frame *, jmethodID, jint slot, jobjectArray args);
jobject lb_jh_member(lb_jh_frame *, jint slot, jobjectArray args);
/* After a failed host call: convert the pending throwable to a fresh IO.Error.
   Only the same Lean error may recover the original Java object. */
lean_object *lb_jh_catch(lb_jh_frame *);
int lb_jh_rethrow(lb_jh_frame *, b_lean_obj_arg error);
#endif
