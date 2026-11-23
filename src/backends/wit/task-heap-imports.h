/* Adopt one independently owned native lease into this Wasmtime store. The
 * caller's wire buffer still owns it if construction or admission fails. */
static int lb_heap_lift(lb_tasks *s,size_t kind,uint64_t *w,lb_val *out) {
    if (kind>=LB_HEAPS || w[3]!=3+kind || !w[0] || !w[1] || w[2]) return LB_MALFORMED;
    if (s->live>=LB_TASK_MAX || s->last_rep==UINT32_MAX) return LB_OVER_BUDGET;
    size_t k=0,method=LB_TASK_METHODS+kind;
    while (k<LB_TASK_MAX && s->slots[k].rep) k++;
    if (k==LB_TASK_MAX) return LB_OVER_BUDGET;
    uint32_t rep=++s->last_rep;
    wasmtime_component_resource_host_t *owner=wasmtime_component_resource_host_new(true,rep,s->tags[method]);
    if (!owner) return LB_OVER_BUDGET;
    wasmtime_component_resource_any_t *handle=NULL;
    wasmtime_error_t *err=wasmtime_component_resource_host_to_any(s->ctx,owner,&handle);
    wasmtime_component_resource_host_delete(owner);
    if (err) { wasmtime_error_delete(err); return LB_MALFORMED; }
    s->slots[k]=(lb_task_slot){.rep=rep,.method=method,.native={w[0],w[1]}};
    ++s->live; memset(w,0,4*sizeof(*w));
    *out=(lb_val){.kind=WASMTIME_COMPONENT_RESOURCE,.of.resource=handle}; return LB_GOOD;
}
static wasmtime_error_t *lb_heap_call(void *data,wasmtime_context_t *ctx,const wasmtime_component_func_type_t *type,
    lb_val *args,size_t count,lb_val *results,size_t nresults) {
    (void)type;
    lb_task_binding *b=data; lb_tasks *s=b->s; size_t method=b->method;
    if (!lb_task_owner(s,ctx) || method<LB_TASK_METHODS || method>=LB_KINDS || b->op>1 ||
        nresults!=1 || !results || count!=b->op+1 || !args) return wasmtime_error_new("Invalid WIT lease operation");
    const lb_heap_method *m=&lb_heap_methods[method-LB_TASK_METHODS];
    lb_task_slot *a=NULL,*other=NULL;
    wasmtime_error_t *err=lb_task_lookup(s,method,&args[0],false,&a);
    if (err) return err;
    if (b->op==1) {
        err=lb_task_lookup(s,method,&args[1],false,&other); if (err) return err;
        uint8_t equal=0;
        if (m->equal(a->native,other->native,&equal)!=0) return wasmtime_error_new("Cannot compare WIT leases");
        *results=(lb_val){.kind=WASMTIME_COMPONENT_BOOL,.of.boolean=equal!=0}; return NULL;
    }
    uint64_t w[4]={0};
    if (m->clone(a->native,w)!=0) return wasmtime_error_new("Cannot retain WIT lease");
    w[3]=3+method-LB_TASK_METHODS;
    int rc=lb_heap_lift(s,method-LB_TASK_METHODS,w,results);
    LB_TASK_CLEAR(w);
    return rc==LB_GOOD ? NULL : wasmtime_error_new("Cannot wrap retained WIT lease");
}
static wasmtime_error_t *lb_heap_link(lb_tasks *s,size_t method,wasmtime_component_linker_instance_t *child,
    wasmtime_component_resource_type_t *type) {
    const lb_heap_method *m=&lb_heap_methods[method-LB_TASK_METHODS];
    lb_task_binding *b=s->binds[method];
    b[0]=(lb_task_binding){s,method,0}; b[1]=(lb_task_binding){s,method,1};
    wasmtime_error_t *err=wasmtime_component_linker_instance_add_resource(child,m->name,strlen(m->name),type,lb_task_dtor,b,NULL);
    if (!err) err=wasmtime_component_linker_instance_add_func(child,m->retain,strlen(m->retain),lb_heap_call,b,NULL);
    if (!err) err=wasmtime_component_linker_instance_add_func(child,m->same,strlen(m->same),lb_heap_call,b+1,NULL);
    return err;
}
