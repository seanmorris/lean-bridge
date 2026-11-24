/* Public registrations are store-affine and generation checked. A task pins
 * its callback separately from the caller; a dispatch takes one more pin so
 * self-revocation or cancellation cannot destroy the context on its stack. */
static void lb_fn_put(lb_session *s,lb_fn *fn) {
    if (--fn->refs) return;
    void (*destroy)(void *)=fn->destroy; void *ctx=fn->ctx;
    *fn=(lb_fn){0};
    bool was=s->finalizing; s->finalizing=true; destroy(ctx); s->finalizing=was;
}
static void lb_fn_release_list(lb_session *s,lb_fn_hold *head) {
    while (head) { lb_fn_hold *next=head->next; lb_fn_put(s,head->fn); free(head); head=next; }
}
static void lb_fn_detach(lb_session *s,size_t index) {
    lb_fn_hold *holds=s->holds[index]; s->holds[index]=NULL; lb_fn_release_list(s,holds);
}
static void lb_fn_close_all(lb_session *s) {
    for (size_t i=0;i<LB_TASK_MAX;i++) lb_fn_detach(s,i);
    for (size_t i=0;i<LB_TASK_MAX;i++) if (s->funcs[i].external) {
        s->funcs[i].external=false; lb_fn_put(s,&s->funcs[i]);
    }
}
static LBP(status) lb_fn_register(lb_session *s,size_t sig,lb_fn_invoke invoke,void *ctx,void (*destroy)(void *),uint64_t *out) {
    LBP(status) rc=lb_check(s); if (rc!=LBP(OK)) return rc;
    if (!out || out[0] || out[1] || out[2]) return LBP(INVALID);
    size_t i=0; while (i<LB_TASK_MAX && s->funcs[i].id) i++;
    if (i==LB_TASK_MAX || s->fn_generation==UINT64_MAX) return LBP(LIMIT);
    s->funcs[i]=(lb_fn){.id=++s->fn_generation,.signature=sig,.refs=1,.external=true,.invoke=invoke,.ctx=ctx,.destroy=destroy};
    /* Wasmtime's store identity distinguishes loaded hosts before Lean starts;
       the broker domain also distinguishes independently loaded runtimes. */
    out[0]=s->funcs[i].id; out[1]=s->instance.store_id; out[2]=s->fn_domain; return LBP(OK);
}
static lb_fn *lb_fn_find(lb_session *s,size_t sig,const uint64_t *h) {
    if (!h || !h[0] || h[1]!=s->instance.store_id || h[2]!=s->fn_domain) return NULL;
    for (size_t i=0;i<LB_TASK_MAX;i++) if (s->funcs[i].external && s->funcs[i].id==h[0] && s->funcs[i].signature==sig) return &s->funcs[i];
    return NULL;
}
static LBP(status) lb_fn_drop(lb_session *s,size_t sig,uint64_t *h,bool revoke) {
    LBP(status) rc=lb_check(s); if (rc!=LBP(OK)) return rc;
    if (!h) return LBP(INVALID);
    lb_fn *fn=lb_fn_find(s,sig,h); if (!fn) return LBP(STALE);
    fn->external=false; fn->revoked=revoke; h[0]=h[1]=h[2]=0; lb_fn_put(s,fn); return LBP(OK);
}
static LBP(status) lb_fn_prepare(lb_session *s,const lb_fn_arg *args,size_t n,lb_fn_hold **head) {
    LBP(status) rc=lb_check(s); if (rc!=LBP(OK)) return rc;
    for (size_t i=0;i<n;i++) {
        lb_fn *fn=lb_fn_find(s,args[i].signature,args[i].handle);
        if (!fn) { rc=LBP(STALE); break; }
        lb_fn_hold *item=malloc(sizeof *item);
        if (!item) { rc=LBP(LIMIT); break; }
        *item=(lb_fn_hold){args[i].site,fn,*head}; *head=item; ++fn->refs;
    }
    if (rc!=LBP(OK)) { lb_fn_release_list(s,*head); *head=NULL; } return rc;
}
static LBP(status) lb_fn_bind(lb_session *s,size_t method,uint64_t *h,lb_fn_hold *holds,LBP(status) rc) {
    if (rc==LBP(OK)) {
        lb_task_slot *t=lb_task_find(&s->tasks,method,(uint32_t)h[1]);
        if (t && !s->holds[t-s->tasks.slots]) { s->holds[t-s->tasks.slots]=holds; return rc; }
        rc=lb_fault(s,true);
    }
    lb_fn_release_list(s,holds); return rc;
}
static LBP(status) lb_fn_message(LBP(text) text,lb_val *out) {
    if (text.size>16u*1024u*1024u || (text.size && !text.data) || !lb_utf8(text.size?text.data:"",text.size)) return LBP(INVALID);
    out->kind=WASMTIME_COMPONENT_STRING;
    wasm_name_new(&out->of.string,text.size,text.size?text.data:""); return LBP(OK);
}
/* After one host invocation, a nonblocking poll must yield the store thread.
 * Subscribe to the real next request or terminal delivery without dequeuing
 * either. Level-triggered readiness also covers work queued before we return. */
static LBP(status) lb_fn_yield(lb_session *s,size_t i,lb_val *owner,int *gate) {
    lb_task_slot *t=&s->tasks.slots[owner-s->owners];
    if (t->state!=LB_TASK_RUNNING) return LBP(OK);
    int terminal=-1,callback=-1,status=lb_methods[i].poll(t->native,&terminal);
    if (status==0) return LBP(OK);
    if (status!=LB_TASK_PENDING || terminal<0 || lb_cb_ports[i].fd(t->native,&callback)!=0 || callback<0)
        return lb_fault(s,false);
    if (!t->waiting && LB_TASK_WAIT(terminal,callback,t->gate)!=0) return lb_fault(s,false);
    t->waiting=true; *gate=t->gate[0]; return LBP(OK);
}
static LBP(status) lb_fn_dispatch(lb_session *s,lb_val *owner,uint32_t rep,size_t site,lb_val *request) {
    if (!request || request->kind!=WASMTIME_COMPONENT_RESOURCE || !wasmtime_component_resource_any_owned(request->of.resource))
        return lb_fault(s,true);
    lb_fn_hold *hold=s->holds[owner-s->owners];
    while (hold && hold->site!=site) hold=hold->next;
    if (!hold) return lb_fault(s,true);
    lb_fn *fn=hold->fn; const lb_cb_method *m=&lb_cb_methods[site]; bool failed=false;
    lb_val arg={0},answer={0}; LBP(status) rc=lb_invoke(s,m->read,request,1,&arg);
    if (rc!=LBP(OK)) return rc;
    lb_fn_frame current={rep,s->frame}; s->frame=&current; ++fn->refs;
    if (fn->revoked) { failed=true; rc=lb_fn_message((LBP(text)){"retained callback is closed",26},&answer); }
    else rc=fn->invoke(fn->ctx,&arg,&failed,&answer);
    wasmtime_component_val_delete(&arg); lb_fn_put(s,fn); s->frame=current.outer;
    if (s->close_pending) {
        wasmtime_component_val_delete(&answer); if (!s->frame) lb_dispose(s); return LBP(UNAVAILABLE);
    }
    if (s->failed) { wasmtime_component_val_delete(&answer); return LBP(UNAVAILABLE); }
    bool invalid=rc!=LBP(OK);
    if (invalid) {
        wasmtime_component_val_delete(&answer); answer=(lb_val){0}; failed=true;
        rc=lb_fn_message((LBP(text)){"invalid callback reply",22},&answer);
        if (rc!=LBP(OK)) return lb_fault(s,true);
    }
    lb_val pair[]={*request,answer},out={0};
    rc=lb_invoke(s,failed?m->fail:m->reply,pair,2,&out);
    wasmtime_component_val_delete(&answer);
    if (rc!=LBP(OK)) return rc;
    bool valid=out.kind==WASMTIME_COMPONENT_BOOL; wasmtime_component_val_delete(&out);
    if (!valid) return lb_fault(s,true);
    return invalid?LBP(INVALID):LBP(OK);
}
