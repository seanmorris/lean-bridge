/* Per-component slots. All operations run on the owner's serialized JNI
 * dispatcher; the caller's Java thread never manipulates a Lean reference. */
typedef lb_jhd_session lb_dnd_session;
/*__LB_FUNCTION_SLOTS__*/

static jlongArray jh_ticket_cell(lb_jh_frame *f,int pos) {
    JNIEnv *e=f->env;
    jobject v=(*e)->GetObjectArrayElement(e,(jobjectArray)f->input,pos);
    if ((*e)->ExceptionCheck(e)) return NULL;
    jclass type=(*e)->FindClass(e,"[J");
    if (!type || (*e)->ExceptionCheck(e)) return NULL;
    if (!v || !(*e)->IsInstanceOf(e,v,type) || (*e)->GetArrayLength(e,(jlongArray)v)!=1) {
        jh_bad(e); return NULL;
    }
    return (jlongArray)v;
}
static jlongArray jh_empty_cell(lb_jh_frame *f,int pos) {
    jlongArray cell=jh_ticket_cell(f,pos); if (!cell) return NULL;
    jlong value=0; (*f->env)->GetLongArrayRegion(f->env,cell,0,1,&value);
    if ((*f->env)->ExceptionCheck(f->env)) return NULL;
    if (value) { jh_bad(f->env); return NULL; }
    return cell;
}
static uint64_t jh_ticket(lb_jh_frame *f,int pos) {
    JNIEnv *e=f->env; jlong value=0;
    jlongArray cell=jh_ticket_cell(f,pos);
    if (cell) (*e)->GetLongArrayRegion(e,cell,0,1,&value);
    return (uint64_t)value;
}
static void jh_stale(JNIEnv *e) {
    jh_raise(e,"java/lang/IllegalStateException","Closed, foreign or wrong-site returned Lean function");
}
static lean_object *jh_function(lb_jh_frame *f,unsigned site) {
    uint64_t id=jh_ticket(f,0);
    if ((*f->env)->ExceptionCheck(f->env)) return NULL;
    dn_closure_slot *v=dn_closure_find(jh_session,site,id);
    if (!v) { jh_stale(f->env); return NULL; }
    lean_inc(v->fn); return v->fn;
}
static jobject jh_publish_function(lb_jh_frame *f,unsigned site,jlongArray cell,lean_object *fn) {
    JNIEnv *e=f->env; uint64_t id=0;
    if (!lb_jh_guard(f)) return NULL;
    int status=dn_closure_save(jh_session,site,fn,&id);
    if (status) {
        jh_raise(e,status==11?"java/lang/OutOfMemoryError":"java/lang/IllegalStateException","Cannot retain returned Lean function");
        return NULL;
    }
    /* Publish into a Java-owned cell before constructing or transferring the
     * JNI result. The factory can revoke even if that later allocation fails. */
    jlong bits=(jlong)id; (*e)->SetLongArrayRegion(e,cell,0,1,&bits);
    if ((*e)->ExceptionCheck(e)) dn_closure_release(dn_closure_find(jh_session,site,id));
    return NULL;
}
static void jh_drop_function(lb_jh_frame *f,unsigned site) {
    JNIEnv *e=f->env;
    if (!f->input || (*e)->GetArrayLength(e,(jobjectArray)f->input)!=1) { jh_bad(e); return; }
    uint64_t id=jh_ticket(f,0); if ((*e)->ExceptionCheck(e)) return;
    dn_closure_slot *v=dn_closure_find(jh_session,site,id);
    if (!v) { jh_stale(e); return; }
    dn_closure_release(v);
}
static int jh_retire_functions(lb_jh_frame *f) {
    JNIEnv *e=f->env;
    for (lb_jh_frame *p=f->parent;p;p=p->parent) if ((*e)->IsSameObject(e,p->binder,f->binder)) {
        jh_raise(e,"java/lang/IllegalStateException","Cannot close a binding inside its active call"); return 0;
    }
    lb_jhd_session *s=LB_JHD(enter)(f,component); if (!s) return 0;
    dn_closure_retire((uintptr_t)s,dn_serial);
    LB_JHD(leave)(f,s); return !(*e)->ExceptionCheck(e);
}
