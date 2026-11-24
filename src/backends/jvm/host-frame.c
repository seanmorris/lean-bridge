#include "host-frame.h"
#include "io-owner.h"
#include <stdlib.h>

typedef struct lb_jh_fault {
    lean_object *error;
    jthrowable original;
    struct lb_jh_fault *next;
} lb_jh_fault;
typedef struct {
    JavaVM *vm;
    lb_jh_body body;
    void *context;
    jobject binder, input, output;
    jthrowable thrown;
    const char *failure;
} request;
static _Thread_local lb_jh_frame *current;
lb_jh_frame *lb_jh_current(void) { return current; }

static void raise(JNIEnv *e, const char *type, const char *message) {
    if ((*e)->ExceptionCheck(e)) return;
    jclass cls = (*e)->FindClass(e, type);
    if (cls) { (*e)->ThrowNew(e, cls, message); (*e)->DeleteLocalRef(e, cls); }
}

jobject lb_jh_member(lb_jh_frame *f, jint slot, jobjectArray args) {
    if (f->fatal) {
        raise(f->env, "java/lang/OutOfMemoryError", "cannot retain host throwable"); return NULL;
    }
    return (*f->env)->CallObjectMethod(f->env, f->binder, f->invoke, slot, args);
}

lean_object *lb_jh_catch(lb_jh_frame *f) {
    JNIEnv *e = f->env;
    jthrowable original = (*e)->ExceptionOccurred(e);
    if (original) (*e)->ExceptionClear(e);
    lean_object *error = lean_mk_io_user_error(lean_mk_string("JVM host member failed"));
    if (original) {
        lb_jh_fault *entry = malloc(sizeof(*entry));
        jthrowable pin = entry ? (*e)->NewGlobalRef(e, original) : NULL;
        if (pin) {
            lean_inc(error);
            *entry = (lb_jh_fault){error, pin, f->faults};
            f->faults = entry;
        } else {
            free(entry);
            (*e)->ExceptionClear(e);
            f->fatal = 1;
        }
        (*e)->DeleteLocalRef(e, original);
    }
    return lean_io_result_mk_error(error);
}

int lb_jh_rethrow(lb_jh_frame *f, b_lean_obj_arg error) {
    for (lb_jh_fault *p = f->faults; p; p = p->next)
        if (p->error == error) { (*f->env)->Throw(f->env, p->original); return 1; }
    return 0;
}

static void on_owner(void *arg) {
    request *r = arg;
    JNIEnv *e = NULL;
    jint state = (*r->vm)->GetEnv(r->vm, (void **)&e, JNI_VERSION_1_8);
    int attach = state == JNI_EDETACHED;
    if ((attach && (*r->vm)->AttachCurrentThreadAsDaemon(r->vm, (void **)&e, NULL) != JNI_OK) ||
        (!attach && state != JNI_OK)) { r->failure = "cannot attach JVM owner"; return; }
    int pushed = (*e)->PushLocalFrame(e, 32) == JNI_OK;
    if (pushed) {
        lb_jh_frame f = {.env=e, .binder=r->binder, .input=r->input, .parent=current};
        jclass cls = (*e)->GetObjectClass(e, r->binder);
        if (cls) f.invoke = (*e)->GetMethodID(e, cls, "invoke", "(I[Ljava/lang/Object;)Ljava/lang/Object;");
        if (f.invoke) {
            current = &f;
            jobject v = r->body(&f, r->context);
            current = f.parent;
            if (f.fatal) {
                (*e)->ExceptionClear(e);
                raise(e, "java/lang/OutOfMemoryError", "cannot retain host throwable");
            }
            if (!(*e)->ExceptionCheck(e) && v) r->output = (*e)->NewGlobalRef(e, v);
            while (f.faults) {
                lb_jh_fault *p = f.faults; f.faults = p->next;
                lean_dec(p->error); (*e)->DeleteGlobalRef(e, p->original); free(p);
            }
        }
    }
    if ((*e)->ExceptionCheck(e)) {
        jthrowable t = (*e)->ExceptionOccurred(e);
        (*e)->ExceptionClear(e);
        r->thrown = (*e)->NewGlobalRef(e, t);
        (*e)->DeleteLocalRef(e, t);
        if (!r->thrown) {
            (*e)->ExceptionClear(e);
            r->failure = "out of memory while transferring JVM owner exception";
        }
    } else if (!pushed) r->failure = "cannot create local frame on JVM owner";
    if (pushed) (*e)->PopLocalFrame(e, NULL);
    if (attach) (*r->vm)->DetachCurrentThread(r->vm);
}

jobject lb_jh_call(JNIEnv *e, jobject binder, jobject input, lb_jh_body body, void *context) {
    request r = {.body=body, .context=context};
    jobject result = NULL;
    if (!binder || !body || (*e)->GetJavaVM(e, &r.vm) != JNI_OK) {
        raise(e, "java/lang/IllegalArgumentException", "missing JVM host binding"); return NULL;
    }
    r.binder = (*e)->NewGlobalRef(e, binder);
    if (!r.binder) goto done;
    if (input && !(r.input = (*e)->NewGlobalRef(e, input))) goto done;
    if (!LB_JVM_OWNER(call)(on_owner, &r)) r.failure = "JVM owner unavailable";
    if (r.thrown) (*e)->Throw(e, r.thrown);
    else if (r.failure) raise(e, "java/lang/IllegalStateException", r.failure);
    else if (r.output) result = (*e)->NewLocalRef(e, r.output);
done:
    if (r.output) (*e)->DeleteGlobalRef(e, r.output);
    if (r.thrown) (*e)->DeleteGlobalRef(e, r.thrown);
    if (r.input) (*e)->DeleteGlobalRef(e, r.input);
    if (r.binder) (*e)->DeleteGlobalRef(e, r.binder);
    return result;
}
