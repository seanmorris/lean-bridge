/* Two builds of this fixture have different JNI names and component IDs.
   Host method dispatch, the owner, and canonical identity are production code. */
#include "host-domain.h"
#include "lean_bridge_native_runtime.h"
#include "component.h"
extern void witness_save(lean_object *);
extern lean_object *witness_value(void);
extern lean_object *initialize_SharedRefs(uint8_t);
extern lean_object *lb_box_self(lean_object *), *lb_key_self(lean_object *);
extern lean_object *lb_compare_wrappers(lean_object *,lean_object *);
static void *init(uint8_t builtin) { return initialize_SharedRefs(builtin); }
static _Thread_local lb_jhd_session *active;

static lean_object *identity(unsigned kind, jint slot, lean_object *receiver) {
    lb_jh_frame *f=lb_jh_current(); JNIEnv *e=f->env;
    jobject obj=LB_JHD(object)(f,active,kind,receiver);
    if (!obj) return lb_jh_catch(f);
    jclass cls=(*e)->FindClass(e,"java/lang/Object");
    jobjectArray args=cls ? (*e)->NewObjectArray(e,1,cls,obj) : NULL;
    if (!args) return lb_jh_catch(f);
    jobject ret=lb_jh_member(f,slot,args);
    if ((*e)->ExceptionCheck(e)) return lb_jh_catch(f);
    lean_object *v=LB_JHD(wrap)(f,active,kind,ret,NULL);
    if (!v) return lb_jh_catch(f);
    LB_JHD(admit)(v); return lean_io_result_mk_ok(v);
}
lean_object *lean_bridge_host_jvm_box_identity(lean_object *v) { return identity(0,0,v); }
lean_object *lean_bridge_host_jvm_key_identity(lean_object *v) { return identity(1,1,v); }
typedef struct { int op, kind; jlong count; } request;
static jobject execute(lb_jh_frame *f, void *context) {
    JNIEnv *e=f->env; request *r=context;
    if (r->op == 0) {
        if (!lean_bridge_native_component_initialize(COMPONENT,init)) {
            (*e)->ThrowNew(e,(*e)->FindClass(e,"java/lang/IllegalStateException"),"Lean init failed"); return NULL;
        }
        LB_JHD(open)(f,COMPONENT,specs,2); return NULL;
    }
    if (r->op == 1) { LB_JHD(close)(f,COMPONENT); return NULL; }
    if (r->op == 9) { r->count=(jlong)LB_JHD(live)(f); return NULL; }
    lb_jhd_session *s=LB_JHD(enter)(f,COMPONENT); if (!s) return NULL;
    lb_jhd_session *prior=active; active=s;
    jobject result=NULL; lean_object *arg=NULL, *io=NULL, *saved=witness_value();
    unsigned k=(unsigned)r->kind;
    if (r->op == 5) { if (saved) result=LB_JHD(object)(f,s,k,saved); goto end; }
    if (r->op == 6) { witness_save(NULL); goto end; }
    arg=LB_JHD(wrap)(f,s,k,f->input,NULL); if (!arg) goto end;
    if (r->op == 7) { /* second argument fails before admitting the first */
        lean_object *bad=LB_JHD(wrap)(f,s,k,NULL,NULL); if (bad) lean_dec(bad); goto end;
    }
    LB_JHD(admit)(arg);
    if (r->op == 4) {
        if (saved) { lean_inc(saved); lean_inc(arg); io=lb_compare_wrappers(saved,arg); }
        if (io) r->count=lean_unbox(lean_ctor_get(io,0));
        goto end;
    }
    lean_inc(arg); io=k ? lb_key_self(arg) : lb_box_self(arg);
    if (!lean_io_result_is_ok(io)) {
        if (!lb_jh_rethrow(f,lean_ctor_get(io,0))) (*e)->ThrowNew(e,(*e)->FindClass(e,"java/lang/IllegalStateException"),"Lean call failed");
        goto end;
    }
    lean_object *value=lean_ctor_get(io,0);
    if (r->op == 3) witness_save(value);
    result=LB_JHD(object)(f,s,k,value);
end:
    if (arg) lean_dec(arg);
    if (io) lean_dec(io);
    active=prior; LB_JHD(leave)(f,s); return result;
}
JNIEXPORT jobject JNICALL CALL(JNIEnv *e,jclass cls,jobject binder,jint op,jint kind,jobject input) {
    (void)cls; request r={op,kind,0}; return lb_jh_call(e,binder,input,execute,&r);
}
JNIEXPORT jlong JNICALL COUNT(JNIEnv *e,jclass cls,jobject binder,jint op,jint kind,jobject input) {
    (void)cls; request r={op,kind,0}; (void)lb_jh_call(e,binder,input,execute,&r); return r.count;
}
