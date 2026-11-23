/* These calls enter the component's public exports, including each request
 * read and settlement. Only readiness and cleanup use the test embedding. */
#include "wasmtime-lab.h"
#include "retained-quiescence.h"
static lb_val start(lab *s,bool factory,bool lean_error) {
    lb_val args[2]={{.kind=WASMTIME_COMPONENT_BOOL,.of.boolean=factory},{.kind=WASMTIME_COMPONENT_BOOL,.of.boolean=lean_error}}, out={0};
    ok(calln(s,"start-through",args,2,&out)); assert(out.kind==WASMTIME_COMPONENT_RESOURCE); return out;
}
static void drop(lab *s,lb_val *v) {
    ok(wasmtime_component_resource_any_drop(s->tasks.ctx,v->of.resource));
    wasmtime_component_val_delete(v); *v=(lb_val){0};
}
static lb_val observe(lab *s,lb_val *task,const char *want,bool value) {
    while (1) {
        lb_val obs=invoke(s,"poll-through",task);
        assert(obs.kind==WASMTIME_COMPONENT_VARIANT);
        if (lb_name(&obs.of.variant.discriminant,"pending")) {
            assert(!obs.of.variant.val && s->tasks.pending_fd>=0);
            struct pollfd event={s->tasks.pending_fd,POLLIN,0}; int n;
            wasmtime_component_val_delete(&obs);
            do { n=poll(&event,1,10000); } while(n<0 && errno==EINTR);
            assert(n==1 && (event.revents&POLLIN)); continue;
        }
        if (!lb_name(&obs.of.variant.discriminant,want))
            fprintf(stderr,"Expected %s; got %.*s\n",want,(int)obs.of.variant.discriminant.size,obs.of.variant.discriminant.data);
        assert(lb_name(&obs.of.variant.discriminant,want) && value==(obs.of.variant.val!=NULL));
        lb_val out={0};
        if (value) { out=*obs.of.variant.val; *obs.of.variant.val=(lb_val){0}; }
        wasmtime_component_val_delete(&obs); return out;
    }
}
static lb_val demand(lab *s,lb_val *job) {
    lb_val request=observe(s,job,"call-transform",true);
    assert(request.kind==WASMTIME_COMPONENT_RESOURCE && wasmtime_component_resource_any_owned(request.of.resource));
    lb_val arg=invoke(s,"read-callback-through-p3",&request);
    assert(arg.kind==WASMTIME_COMPONENT_U32 && arg.of.u32==11); return request;
}
static void answer(lab *s,lb_val *request,const char *msg,size_t n,bool accepted) {
    lb_val args[2]={*request,{0}},out={0};
    if (msg) { args[1].kind=WASMTIME_COMPONENT_STRING; wasm_name_new(&args[1].of.string,n,msg); }
    else args[1]=(lb_val){.kind=WASMTIME_COMPONENT_U32,.of.u32=42};
    ok(calln(s,msg?"fail-callback-through-p3":"reply-callback-through-p3",args,2,&out));
    assert(out.kind==WASMTIME_COMPONENT_BOOL && out.of.boolean==accepted);
    wasmtime_component_val_delete(&args[1]); wasmtime_component_val_delete(request); *request=(lb_val){0};
}
static void ready(lab *s,lb_val *job) {
    lb_val result=observe(s,job,"ready",true); assert(result.kind==WASMTIME_COMPONENT_U32 && result.of.u32==42);
    observe(s,job,"closed",false); drop(s,job);
}
static void failure(lab *s,lb_val *job,const char *state,const char *msg,size_t size) {
    lb_val out=observe(s,job,state,true);
    assert(out.kind==WASMTIME_COMPONENT_STRING && out.of.string.size==size && !memcmp(out.of.string.data,msg,size));
    wasmtime_component_val_delete(&out); observe(s,job,"closed",false); drop(s,job);
}
static void phases(lab *s,bool factory) {
    lb_val job=start(s,factory,false),req=demand(s,&job);
    answer(s,&req,NULL,0,true); ready(s,&job);
    static const char bytes[]="owner\0failure";
    job=start(s,factory,false); req=demand(s,&job);
    answer(s,&req,bytes,sizeof bytes-1,true);
    failure(s,&job,factory?"factory-callback-failed":"worker-callback-failed",bytes,sizeof bytes-1);
    job=start(s,factory,true); failure(s,&job,factory?"factory-failed":"failed","same message",12);
    job=start(s,factory,false); req=demand(s,&job); drop(s,&req);
    failure(s,&job,factory?"factory-callback-failed":"worker-callback-failed","callback request dropped",24);
}
static void overlap(lab *s) {
    lb_val outer=start(s,true,false),first=demand(s,&outer);
    lb_val inner=start(s,false,false),second=demand(s,&inner);
    answer(s,&second,NULL,0,true); ready(s,&inner);
    lb_val cancelled=invoke(s,"cancel-through",&outer); assert(cancelled.of.boolean);
    observe(s,&outer,"cancelled",false); observe(s,&outer,"closed",false); drop(s,&outer);
    lb_val next=start(s,true,false),third=demand(s,&next);
    lb_val cached=invoke(s,"read-callback-through-p3",&first); assert(cached.of.u32==11);
    answer(s,&first,NULL,0,false); answer(s,&third,NULL,0,true); ready(s,&next);
    assert(s->tasks.live==0);
}
static void capacity(lab *s) {
    lb_val job=start(s,true,false),held[LB_TASK_MAX-1];
    /* Occupy the other slots with finite factories, not blocked workers. */
    for (size_t i=0;i<LB_TASK_MAX-1;i++) held[i]=start(s,true,true);
    assert(s->tasks.live==LB_TASK_MAX);
    static const char reason[]="callback request capacity exhausted";
    failure(s,&job,"factory-callback-failed",reason,sizeof reason-1);
    for (size_t i=0;i<LB_TASK_MAX-1;i++) drop(s,&held[i]);
    assert(!s->tasks.live);
    job=start(s,true,false); lb_val request=demand(s,&job); answer(s,&request,NULL,0,true); ready(s,&job);
}
int main(void) {
    alarm(120);
    wasm_config_t *cfg=wasm_config_new(); wasmtime_config_wasm_component_model_set(cfg,true);
    wasm_engine_t *engine=wasm_engine_new_with_config(cfg); wasmtime_component_t *comp=NULL;
    ok(wasmtime_component_new(engine,lb_task_component,sizeof(lb_task_component),&comp));
    lab s={0}; open_lab(&s,engine,comp); phases(&s,true); phases(&s,false); overlap(&s); capacity(&s);
    for (unsigned i=0;i<260;i++) {
        lb_val job=start(&s,true,false),request=demand(&s,&job);
        answer(&s,&request,NULL,0,true); ready(&s,&job); assert(!s.tasks.live);
    }
    lb_val pending=start(&s,false,false),abandoned=demand(&s,&pending);
    close_lab(&s); wasmtime_component_val_delete(&pending); wasmtime_component_val_delete(&abandoned);
    wasmtime_component_delete(comp); wasm_engine_delete(engine);
    check_quiescent();
    puts("Wasmtime retained requests: both phases, nested dispatch, stale settlement, 260 reuse cycles and shutdown passed");
}
