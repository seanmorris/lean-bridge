/* In-process test veneer; method/control symbols in probe-abi.h are emitted
   from this build's authenticated class and task declarations. */
#include <jni.h>
#include <stdint.h>
#include "lean_bridge_native_runtime.h"
#include "host-domain.h"
#include "probe-abi.h"
JNIEXPORT void JNICALL Java_probe_WorkerProbe_bind(JNIEnv *e,jclass cls,jobject b,jint op) {
    (void)cls; TEST_BIND(e,b,op,NULL);
}
JNIEXPORT jobject JNICALL Java_probe_WorkerProbe_work(JNIEnv *e,jclass cls,jobject b,jobjectArray objects,jint method,jint op,
        jobject args,jobject h,jobject out,jobject tags,jobject status) {
    (void)cls; return TEST_WORK(e,b,objects,method,op,args,h,out,tags,status);
}
JNIEXPORT jobject JNICALL Java_probe_NativePort_work(JNIEnv *e,jclass cls,jobject b,jobjectArray objects,jint method,jint op,
        jobject args,jobject h,jobject out,jobject tags,jobject status) {
    (void)cls; return TEST_WORK(e,b,objects,method,op,args,h,out,tags,status);
}
JNIEXPORT jobjectArray JNICALL Java_probe_NativePort_invoke(JNIEnv *e,jclass cls,jobject b,jint op,jobjectArray args) {
    (void)cls; return (jobjectArray)TEST_BIND(e,b,op,args);
}
JNIEXPORT jint JNICALL Java_probe_WorkerProbe_plain(JNIEnv *e,jclass cls,jint method,jint op,
        jobject args,jobject h,jobject out,jobject tags,jobject control) {
    (void)cls;
    if(op!=1 && op!=3 && op!=4 && op!=6) return 5;
    int *status=(*e)->GetDirectBufferAddress(e,control);
    return TEST_TASK(method,op,(*e)->GetDirectBufferAddress(e,args),
        (*e)->GetDirectBufferAddress(e,h),(*e)->GetDirectBufferAddress(e,out),
        (*e)->GetDirectBufferAddress(e,tags),status+1);
}
JNIEXPORT void JNICALL Java_probe_WorkerProbe_clear(JNIEnv *e,jclass cls,jobject out) {
    (void)cls; TEST_INVOKE(INT32_MIN,NULL,(*e)->GetDirectBufferAddress(e,out),NULL);
}
JNIEXPORT jlong JNICALL Java_probe_WorkerProbe_live(JNIEnv *e,jclass cls) {
    (void)e; (void)cls; lean_bridge_native_snapshot s; lean_bridge_native_snapshot_read(&s); return s.live_identities;
}
static jobject count_on_owner(lb_jh_frame *f,void *ctx) {
    *(size_t *)ctx=LB_JHD(live)(f); return NULL;
}
JNIEXPORT jlong JNICALL Java_probe_WorkerProbe_domainLive(JNIEnv *e,jclass cls,jobject binder) {
    (void)cls; size_t count=0;
    lb_jh_call(e,binder,NULL,count_on_owner,&count); return (jlong)count;
}
