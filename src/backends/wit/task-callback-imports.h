/* One nominal request per invocation. Only the store owner accesses these
 * slots. Lean workers enqueue requests; they never enter Wasmtime. */
static int lb_cb_text(lb_tasks *s,uint64_t *w,const uint8_t *tags,lb_scope *scope,lb_val *out) {
    (void)s; (void)tags; return lb_output(LB_STRING,w,scope,out);
}
static lb_task_slot *lb_cb_parent(lb_tasks *s,lb_task_slot *request) {
    const lb_cb_method *m=&lb_cb_methods[request->method-LB_CB_BASE];
    lb_task_slot *parent=lb_task_find(s,m->owner,request->parent);
    return parent && parent->request==request->rep && parent->state==LB_TASK_RUNNING && parent->native[0] ? parent : NULL;
}
static int lb_cb_refuse(const lb_cb_port *port,lb_task_slot *parent,const char *reason) {
    uint64_t msg[3]={(uintptr_t)reason,strlen(reason),0}; uint32_t id=0;
    return port->fail(parent->native,msg,&id);
}
static bool lb_cb_dispose(lb_tasks *s,lb_task_slot *request) {
    lb_task_slot *parent=lb_cb_parent(s,request);
    if (parent) {
        const lb_cb_port *port=&lb_cb_ports[parent->method];
        if (!s->closing && lb_cb_refuse(port,parent,"callback request dropped")!=0) {
            /* Don't strand a worker even if the native error could not be allocated. */
            if (lb_methods[parent->method].close(parent->native)!=0) return false;
            parent->state=LB_TASK_CANCELLED;
        }
        parent->request=0; lb_task_unwatch(parent);
    }
    LB_TASK_CLEAR(request->argument); return true;
}
/* Capture the argument before transferring the owner. A retained request can
 * still be read after cancellation, but can never settle a different task. */
static wasmtime_error_t *lb_cb_offer(lb_tasks *s,lb_task_slot *parent,int *fd,const char **state,lb_val **out) {
    const lb_cb_port *p=&lb_cb_ports[parent->method];
    if (parent->request) return NULL;
    if (p->fd(parent->native,fd)!=0 || *fd<0) return wasmtime_error_new("Missing callback readiness");
    uint32_t slot; int status=p->next(parent->native,&slot);
    if (status==LB_TASK_PENDING) return NULL;
    if (status!=0) return wasmtime_error_new("Cannot read native callback request");
    size_t kind=0; while (kind<LB_CALLBACKS && (lb_cb_methods[kind].owner!=parent->method || lb_cb_methods[kind].slot!=slot)) ++kind;
    if (kind==LB_CALLBACKS) return wasmtime_error_new("Unknown native callback slot");
    if (s->live==LB_TASK_MAX || s->last_rep==UINT32_MAX) {
        if (lb_cb_refuse(p,parent,"callback request capacity exhausted")!=0) return wasmtime_error_new("Cannot settle a full callback table");
        return NULL;
    }
    uint64_t arg[4]={0};
    if (p->arg(parent->native,slot,arg)!=0) { LB_TASK_CLEAR(arg); return wasmtime_error_new("Cannot capture callback argument"); }
    size_t index=0; while (index<LB_TASK_MAX && s->slots[index].rep) index++;
    lb_val empty={0}; lb_val *box=wasmtime_component_val_new(&empty);
    uint32_t rep=++s->last_rep;
    wasmtime_component_resource_host_t *owner=wasmtime_component_resource_host_new(true,rep,s->tags[LB_CB_BASE+kind]);
    wasmtime_component_resource_any_t *any=NULL;
    wasmtime_error_t *err=box && owner && index<LB_TASK_MAX ? wasmtime_component_resource_host_to_any(s->ctx,owner,&any)
        : wasmtime_error_new("Cannot allocate WIT callback request");
    if (owner) wasmtime_component_resource_host_delete(owner);
    if (err) { if (box) wasmtime_component_val_free(box); LB_TASK_CLEAR(arg); return err; }
    lb_task_slot *child=&s->slots[index];
    *child=(lb_task_slot){.method=LB_CB_BASE+kind,.rep=rep,.parent=parent->rep};
    memcpy(child->argument,arg,sizeof arg); ++s->live; parent->request=rep;
    lb_task_unwatch(parent);
    *box=(lb_val){.kind=WASMTIME_COMPONENT_RESOURCE,.of.resource=any};
    *state=lb_cb_methods[kind].state; *out=box; return NULL;
}
static wasmtime_error_t *lb_cb_call(void *data,wasmtime_context_t *ctx,const wasmtime_component_func_type_t *type,
    lb_val *args,size_t count,lb_val *results,size_t nresults) {
    (void)type; lb_task_binding *b=data; lb_tasks *s=b->s;
    if (!lb_task_owner(s,ctx) || b->method<LB_CB_BASE || b->method>=LB_KINDS || b->op>2 ||
        count!=(b->op?2u:1u) || !args || !results || nresults!=1) return wasmtime_error_new("Invalid WIT callback operation");
    const lb_cb_method *m=&lb_cb_methods[b->method-LB_CB_BASE];
    lb_task_slot *child=NULL;
    wasmtime_error_t *err=lb_task_lookup(s,b->method,args,b->op!=0,&child);
    if (err) return err;
    lb_scope scope={.remaining=16u*1024u*1024u};
    if (!b->op) {
        if (lb_output(m->arg_kind,child->argument,&scope,results)!=LB_GOOD) err=wasmtime_error_new("Invalid stored callback argument");
    } else {
        lb_task_slot *parent=lb_cb_parent(s,child); bool accepted=false;
        if (parent) {
            const lb_cb_port *p=&lb_cb_ports[m->owner]; uint64_t w[3]={0}; uint32_t origin=0;
            if (!lb_input(b->op==1?m->reply_kind:LB_STRING,args+1,&scope,w)) err=wasmtime_error_new("Invalid callback reply");
            else if ((b->op==1?p->reply(parent->native,m->slot,w):p->fail(parent->native,w,&origin))!=0)
                err=wasmtime_error_new("Native callback settlement failed");
            else { accepted=true; parent->request=0; child->parent=0; lb_task_unwatch(parent); }
        }
        /* A canonical own was consumed even when the parent had gone away. */
        if (!lb_task_release(s,child) && !err) err=wasmtime_error_new("Cannot release consumed callback request");
        if (!err) *results=(lb_val){.kind=WASMTIME_COMPONENT_BOOL,.of.boolean=accepted};
    }
    lb_scope_close(&scope); return err;
}
static wasmtime_error_t *lb_cb_link(lb_tasks *s,size_t method,wasmtime_component_linker_instance_t *child,wasmtime_component_resource_type_t *ty) {
    const lb_cb_method *m=&lb_cb_methods[method-LB_CB_BASE];
    const char *names[]={m->read,m->reply,m->fail}; lb_task_binding *b=s->binds[method];
    for (size_t i=0;i<3;i++) b[i]=(lb_task_binding){s,method,i};
    wasmtime_error_t *err=wasmtime_component_linker_instance_add_resource(child,m->resource,strlen(m->resource),ty,lb_task_dtor,b,NULL);
    for (size_t i=0;!err && i<3;i++) err=wasmtime_component_linker_instance_add_func(child,names[i],strlen(names[i]),lb_cb_call,b+i,NULL);
    return err;
}
