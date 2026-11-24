/* Included below the compiler-derived class/operation tables and the existing
   host provider. Only copied values leave the owner in native buffers. A class
   result returns as a JNI reference, while its temporary lease is still live. */
#include "worker-ledger.h"
extern int LB_JW_TASK(int,int,const uint64_t *,uint64_t *,uint64_t *,uint8_t *,int *);
extern void LB_JW_CLEAR(uint64_t *);
typedef struct {
    int method,op,*control;
    uint64_t *args,*h,*out;
    uint8_t *tags;
} lb_jw_call;
static jobject worker_convert(lb_jh_frame *f,void *context) {
    lb_jw_call *r=context; JNIEnv *e=f->env;
    const lb_jw_layout *layout=&worker_methods[r->method];
    unsigned count=r->op==0?layout->slots:r->op==8?1:0;
    /* Never write a transport token into the calling Java thread's arena. */
    uint64_t words[3*64]; uint64_t *args=r->args;
    if(count) {
        memcpy(words,args,24*(r->op==8?2:count)); args=words;
    }
    int reply=-1, read=-1;
    if(r->op==7 || r->op==8) {
        uint64_t slot=r->args[r->op==7?0:3];
        if(slot>=layout->slots || layout->replies[slot]==-2) { jh_bad(e); return NULL; }
        reply=layout->replies[slot]; read=layout->reads[slot];
    }
    jobjectArray objects=(jobjectArray)f->input;
    jsize n=objects?(*e)->GetArrayLength(e,objects):0;
    if(n && n!=(jsize)count) { jh_bad(e); return NULL; }
    for(unsigned j=0;j<count;j++) {
        int k=r->op==8?reply:layout->args[j];
        jobject object=n?(*e)->GetObjectArrayElement(e,objects,(jsize)j):NULL;
        if((*e)->ExceptionCheck(e)) return NULL;
        if(k>=0 && !object) { jh_raise(e,"java/lang/NullPointerException","missing JVM worker class"); return NULL; }
        if(k<0 && object) { jh_bad(e); return NULL; }
        if(object) {
            uint64_t *w=args+3*j;
            if(w[2]) { jh_bad(e); return NULL; }
            int s=lb_jw_pin((unsigned)k,worker_keys[k],object,w); (*e)->DeleteLocalRef(e,object);
            if(s) { r->control[0]=s; return NULL; }
        }
    }
    int s=LB_JW_TASK(r->method,r->op,args,r->h,r->out,r->tags,&r->control[1]);
    r->control[0]=s;
    if(s==0 || (r->op==0 && (s==3 || s==4))) lb_jw_admit();
    int expected=worker_result_kind(r->method,r->op,s,read,r->tags);
    if(r->out[3]<3) {
        if(expected!=-1) { lean_bridge_native_runtime_retire(); jh_raise(e,"java/lang/IllegalStateException","invalid JVM worker result tag"); }
        return NULL;
    }
    uint64_t k=r->out[3]-3; jobject result=NULL;
    if(k<sizeof(worker_keys)/sizeof(*worker_keys) && !r->out[2] && expected==(int)k)
        result=lb_jw_object((unsigned)k,worker_keys[k],r->out);
    LB_JW_CLEAR(r->out);
    if(!result && !(*e)->ExceptionCheck(e)) {
        lean_bridge_native_runtime_retire(); jh_raise(e,"java/lang/IllegalStateException","invalid JVM worker class result");
    }
    return result;
}
static jobject worker_on_owner(lb_jh_frame *f,void *ctx) {
    f->available=available; f->retire=lean_bridge_native_runtime_retire;
    if(!lb_jh_guard(f)) return NULL;
    lb_jhd_session *s=LB_JHD(enter)(f,component); if(!s) return NULL;
    jobject result=lb_jw_visit(f,s,worker_convert,ctx);
    LB_JHD(leave)(f,s); return result;
}
/* Caller retains all direct buffers and their arenas until this synchronous
   JNI method returns. No poll, await or application callback runs inside it. */
static void *worker_buffer(JNIEnv *e,jobject b,jlong size,uintptr_t alignment) {
    if(!b || (*e)->GetDirectBufferCapacity(e,b)<size) return NULL;
    void *p=(*e)->GetDirectBufferAddress(e,b);
    return (uintptr_t)p%alignment==0?p:NULL;
}
__attribute__((visibility("default"))) jobject LB_JW_CALL(JNIEnv *e,jobject binder,jobjectArray classes,jint method,jint op,
        jobject args,jobject handle,jobject output,jobject tags,jobject control) {
    if(method<0 || (unsigned)method>=sizeof(worker_methods)/sizeof(*worker_methods) || (op!=0 && op!=2 && op!=7 && op!=8)) {
        jh_bad(e); return NULL;
    }
    const lb_jw_layout *m=&worker_methods[method];
    unsigned slots=op==0?m->slots:op==8?2:op==7?1:0;
    lb_jw_call r={.method=method,.op=op,.args=slots?worker_buffer(e,args,24*slots,8):NULL,
        .h=worker_buffer(e,handle,16,8),.out=worker_buffer(e,output,32,8),
        .tags=worker_buffer(e,tags,op==2 || op==0?m->tags:1,1),.control=worker_buffer(e,control,8,4)};
    if(!r.h || !r.out || !r.tags || !r.control || (slots && !r.args) || r.out[3]) { jh_bad(e); return NULL; }
    r.control[0]=5; r.control[1]=-1;
    return lb_jh_call(e,binder,classes,worker_on_owner,&r);
}
