/* Private, store-affine Wasmtime imports. Native workers never enter the store.
 * The generated method table binds each resource to its own typed native wire. */
#include <stdatomic.h>
#include <pthread.h>
#include <sys/syscall.h>
#include <unistd.h>

typedef int (*lb_task_decoder)(const uint64_t *,const uint8_t *,lb_scope *,lb_val *);
typedef struct {
    const char *resource, *names[3];
    size_t argc; const enum lb_kind *args;
    lb_task_decoder ready,start_failure,terminal; int failure_status;
    int (*start)(const uint64_t *,uint64_t *,uint64_t *,uint8_t *);
    int (*poll)(uint64_t *,int *);
    int (*take)(uint64_t *,uint64_t *,uint8_t *);
    int (*close)(uint64_t *);
} lb_task_method;
/* LB_GENERATED_METHOD_TABLE */

/* Entries survive native completion until the WIT owner is dropped. Reps are
 * never reused within a store, even when a slot is reused. */
enum { LB_TASK_MAX=256 };
enum { LB_TASK_RUNNING, LB_TASK_CANCELLED, LB_TASK_CLOSED };
typedef struct { uint32_t rep; size_t method; int state, gate[2]; bool waiting; uint64_t native[2]; } lb_task_slot;
typedef struct lb_tasks lb_tasks;
typedef struct { lb_tasks *s; size_t method, op; } lb_task_binding;
struct lb_tasks {
    const lb_tasks *self; pid_t pid; pthread_t thread; wasmtime_context_t *ctx;
    lb_task_binding binds[LB_TASK_METHODS][3]; uint32_t tags[LB_TASK_METHODS], last_rep;
    lb_task_slot slots[LB_TASK_MAX]; size_t live; int pending_fd; bool import_failed;
};
static _Atomic uint32_t lb_task_next_tag;
static bool lb_task_owner(lb_tasks *s,wasmtime_context_t *ctx) {
    return s && s->self==s && s->pid==getpid() && pthread_equal(s->thread,pthread_self()) && ctx && s->ctx==ctx;
}
static lb_task_slot *lb_task_find(lb_tasks *s,size_t method,uint32_t rep) {
    for (size_t i=0; rep && i<LB_TASK_MAX; i++)
        if (s->slots[i].rep==rep && s->slots[i].method==method) return &s->slots[i];
    return NULL;
}
static void lb_task_unwatch(lb_task_slot *t) {
    if (t->waiting) { LB_TASK_UNWAIT(t->gate); t->waiting=false; }
}
static bool lb_task_release(lb_tasks *s,lb_task_slot *t) {
    if (!t || !t->rep || (t->native[0] && lb_methods[t->method].close(t->native)!=0)) return false;
    lb_task_unwatch(t);
    *t=(lb_task_slot){0}; --s->live; return true;
}
static wasmtime_error_t *lb_task_dtor(void *data,wasmtime_context_t *ctx,uint32_t rep) {
    lb_task_binding *b=data;
    if (!lb_task_owner(b->s,ctx) || !lb_task_release(b->s,lb_task_find(b->s,b->method,rep)))
        return wasmtime_error_new("Wrong store or expired WIT task");
    return NULL;
}
/* Only call on a resource from this store. Converting a ResourceAny discharges
 * its canonical ownership or borrow; deleting just the C box does not. */
static wasmtime_error_t *lb_task_lookup(lb_tasks *s,size_t method,const lb_val *v,bool own,lb_task_slot **slot) {
    if (!lb_task_owner(s,s->ctx) || method>=LB_TASK_METHODS || !v || v->kind!=WASMTIME_COMPONENT_RESOURCE || !v->of.resource
        || wasmtime_component_resource_any_owned(v->of.resource)!=own) return wasmtime_error_new("Wrong WIT task ownership");
    wasmtime_component_resource_type_t *actual=wasmtime_component_resource_any_type(v->of.resource);
    wasmtime_component_resource_type_t *want=wasmtime_component_resource_type_new_host(s->tags[method]);
    bool match=wasmtime_component_resource_type_equal(actual,want);
    wasmtime_component_resource_type_delete(actual); wasmtime_component_resource_type_delete(want);
    if (!match) return wasmtime_error_new("Wrong nominal WIT task type");
    wasmtime_component_resource_host_t *r=NULL;
    wasmtime_error_t *err=wasmtime_component_resource_any_to_host(s->ctx,v->of.resource,&r);
    if (err) return err;
    *slot=wasmtime_component_resource_host_type(r)==s->tags[method] && wasmtime_component_resource_host_owned(r)==own
        ? lb_task_find(s,method,wasmtime_component_resource_host_rep(r)) : NULL;
    wasmtime_component_resource_host_delete(r);
    return *slot ? NULL : wasmtime_error_new("Expired native WIT task");
}
static wasmtime_error_t *lb_task_call(void *data,wasmtime_context_t *ctx,const wasmtime_component_func_type_t *type,
    lb_val *args,size_t count,lb_val *results,size_t nresults) {
    (void)type;
    lb_task_binding *b=data; lb_tasks *s=b->s; const lb_task_method *m=&lb_methods[b->method];
    if (!lb_task_owner(s,ctx) || nresults!=1 || !results || count!=(b->op==0?m->argc:1) || (count && !args))
        return wasmtime_error_new("Invalid WIT task call or affinity");
    s->pending_fd=-1;
    lb_scope scope={.remaining=16u*1024u*1024u};
    uint64_t words[4]={0}; uint8_t tags[LB_TASK_TAGS]={0}; wasmtime_error_t *err=NULL; lb_task_slot *t=NULL;
    lb_val reply={0};
    if (b->op==0) {
        if (s->live==LB_TASK_MAX || s->last_rep==UINT32_MAX) return wasmtime_error_new("WIT task limit");
        uint64_t a[LB_TASK_WORDS]={0};
        for (size_t j=0;j<count;j++) if (!lb_input(m->args[j],&args[j],&scope,&a[j*3])) {
            err=wasmtime_error_new("Invalid task input"); goto done;
        }
        for (size_t i=0;i<LB_TASK_MAX;i++) if (!s->slots[i].rep) { t=&s->slots[i]; break; }
        lb_val *branch=&reply;
        if (!t || (m->start_failure && lb_result(&reply,true,&branch,&scope)!=LB_GOOD)) {
            err=wasmtime_error_new("Cannot allocate WIT factory result"); goto done;
        }
        int started=m->start(a,t->native,words,tags);
        if (started!=0) {
            if (!m->start_failure || started!=m->failure_status || t->native[0] || t->native[1]) {
                err=wasmtime_error_new("Lean task start failed"); goto done;
            }
            reply.of.result.is_ok=false;
            if (m->start_failure(words,tags,&scope,branch)!=LB_GOOD) {
                err=wasmtime_error_new("Invalid Lean factory error"); goto done;
            }
            *results=reply; reply=(lb_val){0}; goto done;
        }
        t->rep=++s->last_rep; t->method=b->method; t->state=LB_TASK_RUNNING; ++s->live;
        wasmtime_component_resource_host_t *r=wasmtime_component_resource_host_new(true,t->rep,s->tags[b->method]);
        wasmtime_component_resource_any_t *handle=NULL;
        err=wasmtime_component_resource_host_to_any(ctx,r,&handle); wasmtime_component_resource_host_delete(r);
        if (err) { (void)lb_task_release(s,t); goto done; }
        *branch=(lb_val){.kind=WASMTIME_COMPONENT_RESOURCE,.of.resource=handle};
        *results=reply; reply=(lb_val){0};
    } else {
        err=lb_task_lookup(s,b->method,args,false,&t); if (err) goto done;
        if (b->op==2) {
            bool accepted=t->state==LB_TASK_RUNNING;
            if (accepted && m->close(t->native)!=0) { err=wasmtime_error_new("Lean task cancellation failed"); goto done; }
            if (accepted) { lb_task_unwatch(t); t->state=LB_TASK_CANCELLED; }
            *results=(lb_val){.kind=WASMTIME_COMPONENT_BOOL,.of.boolean=accepted};
        } else {
            const char *state="closed"; lb_val *payload=NULL;
            if (t->state==LB_TASK_CANCELLED) { state="cancelled"; t->state=LB_TASK_CLOSED; }
            else if (t->state==LB_TASK_RUNNING) {
                int fd=-1,status=m->poll(t->native,&fd);
                if (status==LB_TASK_PENDING && fd>=0) {
                    if (!t->waiting && LB_TASK_WAIT(fd,-1,t->gate)!=0) { err=wasmtime_error_new("Cannot subscribe to task readiness"); goto done; }
                    t->waiting=true; s->pending_fd=t->gate[0]; state="pending";
                }
                else if (status==0) {
                    int taken=m->take(t->native,words,tags); lb_task_decoder decode=m->ready; state="ready";
                    if (m->terminal && taken==LB_TASK_IO_ERROR) { decode=m->terminal; state="failed"; }
                    else if (taken!=0) { err=wasmtime_error_new("Lean task delivery failed"); goto done; }
                    lb_task_unwatch(t);
                    t->state=LB_TASK_CLOSED;
                    if (decode(words,tags,&scope,&reply)!=LB_GOOD) {
                        err=wasmtime_error_new("Malformed Lean task result"); goto done;
                    }
                    payload=wasmtime_component_val_new(&reply);
                    if (!payload) { err=wasmtime_error_new("Cannot allocate WIT task result"); goto done; }
                    reply=(lb_val){0};
                } else { err=wasmtime_error_new("Lean task poll or delivery failed"); goto done; }
            }
            *results=(lb_val){.kind=WASMTIME_COMPONENT_VARIANT,.of.variant.val=payload};
            wasm_name_new(&results->of.variant.discriminant,strlen(state),state);
        }
    }
done:
    wasmtime_component_val_delete(&reply); lb_scope_close(&scope); LB_TASK_CLEAR(words); return err;
}
static wasmtime_error_t *lb_task_dispatch(void *data,wasmtime_context_t *ctx,const wasmtime_component_func_type_t *type,
    lb_val *args,size_t count,lb_val *results,size_t nresults) {
    wasmtime_error_t *error=lb_task_call(data,ctx,type,args,count,results,nresults);
    if (error) ((lb_task_binding *)data)->s->import_failed=true;
    return error;
}
/* The linker and store must not outlive s. Teardown is also required after
 * a trap: Wasmtime is not responsible for freeing embedder-owned Lean tasks. */
static bool lb_tasks_shutdown(lb_tasks *s) {
    if (!lb_task_owner(s,s->ctx)) return false;
    for (size_t i=0;i<LB_TASK_MAX;i++) if (s->slots[i].rep && !lb_task_release(s,&s->slots[i])) return false;
    s->ctx=NULL; return true;
}
static wasmtime_error_t *lb_tasks_link(lb_tasks *s,wasmtime_context_t *ctx,wasmtime_component_linker_t *linker) {
    if (!s || s->self || !ctx || !linker || getpid()!=(pid_t)syscall(SYS_gettid))
        return wasmtime_error_new("WIT tasks require a fresh process-main-thread session");
    s->self=s; s->pid=getpid(); s->thread=pthread_self(); s->ctx=ctx; s->pending_fd=-1;
    wasmtime_component_linker_instance_t *root=wasmtime_component_linker_root(linker),*child=NULL;
    wasmtime_error_t *err=wasmtime_component_linker_instance_add_instance(root,LB_TASK_IMPORT,strlen(LB_TASK_IMPORT),&child);
    for (size_t i=0;!err && i<LB_TASK_METHODS;i++) {
        uint32_t old=atomic_load(&lb_task_next_tag);
        while (old!=UINT32_MAX && !atomic_compare_exchange_weak(&lb_task_next_tag,&old,old+1)) {}
        if (old==UINT32_MAX) { err=wasmtime_error_new("WIT task type identities exhausted"); break; }
        s->tags[i]=old+1;
        wasmtime_component_resource_type_t *ty=wasmtime_component_resource_type_new_host(s->tags[i]);
        for (size_t j=0;j<3;j++) s->binds[i][j]=(lb_task_binding){s,i,j};
        const lb_task_method *m=&lb_methods[i];
        err=wasmtime_component_linker_instance_add_resource(child,m->resource,strlen(m->resource),ty,lb_task_dtor,&s->binds[i][0],NULL);
        wasmtime_component_resource_type_delete(ty);
        for (size_t j=0;j<3 && !err;j++)
            err=wasmtime_component_linker_instance_add_func(child,m->names[j],strlen(m->names[j]),lb_task_dispatch,&s->binds[i][j],NULL);
    }
    if (child) wasmtime_component_linker_instance_delete(child);
    wasmtime_component_linker_instance_delete(root); return err;
}
