#include "wasmtime-lab.h"
static lb_val observation(lab *s,const char *fn,lb_val *arg,const char *state) {
    lb_val v=invoke(s,fn,arg); assert(v.kind==WASMTIME_COMPONENT_VARIANT);
    assert(lb_name(&v.of.variant.discriminant,state));
    bool ready=!strcmp(state,"ready"); assert(ready==(v.of.variant.val!=NULL));
    lb_val result={0}; if (ready) wasmtime_component_val_clone(v.of.variant.val,&result);
    wasmtime_component_val_delete(&v); return result;
}
static void drop(lab *s,lb_val *owner,const char *name) {
    for (size_t i=0;i<LB_TASK_METHODS;i++) if (!strcmp(lb_methods[i].resource,name)) {
        size_t before=s->tasks.live; assert(before && owner->kind==WASMTIME_COMPONENT_RESOURCE);
        ok(wasmtime_component_resource_any_drop(s->tasks.ctx,owner->of.resource));
        assert(s->tasks.live==before-1);
        wasmtime_error_t *again=wasmtime_component_resource_any_drop(s->tasks.ctx,owner->of.resource);
        assert(again); wasmtime_error_delete(again); wasmtime_component_val_delete(owner); *owner=(lb_val){0};
        return;
    }
    abort();
}
static void resume(lab *s,bool expected) {
    lb_val r=invoke(s,"start-resume",NULL),v=observation(s,"poll-resume",&r,"ready");
    assert(v.kind==WASMTIME_COMPONENT_BOOL && v.of.boolean==expected);
    drop(s,&r,"resume-task");
}
static void rejected(wasmtime_error_t *error) { assert(error); wasmtime_error_delete(error); }
static void *wrong_thread(void *p) {
    lab *s=p; lb_tasks other={0};
    assert(!lb_task_owner(&s->tasks,s->tasks.ctx));
    rejected(lb_tasks_link(&other,s->tasks.ctx,s->linker)); assert(!other.self);
    return NULL;
}
static void wait_readable(int fd) {
    struct pollfd item={fd,POLLIN,0}; int n;
    do { n=poll(&item,1,10000); } while (n<0 && errno==EINTR);
    assert(n==1 && (item.revents&POLLIN));
}
int main(void) {
    alarm(100);
    wasm_config_t *config=wasm_config_new(); wasmtime_config_wasm_component_model_set(config,true);
    wasm_engine_t *engine=wasm_engine_new_with_config(config); wasmtime_component_t *component=NULL;
    ok(wasmtime_component_new(engine,lb_task_component,sizeof(lb_task_component),&component));
    lab s={0},peer={0}; open_lab(&s,engine,component); open_lab(&peer,engine,component);
    pthread_t worker; assert(!pthread_create(&worker,NULL,wrong_thread,&s)); assert(!pthread_join(worker,NULL));
    lb_val input={.kind=WASMTIME_COMPONENT_U32,.of.u32=UINT32_MAX};
    lb_val a=invoke(&s,"start-immediate",&input); assert(s.tasks.live==1);
    lb_task_slot *wrong=NULL;
    size_t imm=0; while (imm<LB_TASK_METHODS && strcmp(lb_methods[imm].resource,"immediate-task")) ++imm;
    assert(imm<LB_TASK_METHODS);
    rejected(lb_task_lookup(&peer.tasks,imm,&a,true,&wrong));
    rejected(lb_task_lookup(&s.tasks,(imm+1)%LB_TASK_METHODS,&a,true,&wrong));
    /* Also send the wrong nominal borrow through Wasmtime itself, in a
       disposable store. Its trap must not affect the already-open owner. */
    lab bad={0}; open_lab(&bad,engine,component);
    lb_val other=invoke(&bad,"start-immediate",&input),empty={0};
    rejected(call(&bad,"poll-parked",&other,&empty));
    wasmtime_component_val_delete(&other); close_lab(&bad);
    lb_val v=observation(&s,"poll-immediate",&a,"ready"); assert(v.kind==WASMTIME_COMPONENT_U32 && !v.of.u32);
    observation(&s,"poll-immediate",&a,"closed"); v=invoke(&s,"cancel-immediate",&a); assert(v.kind==WASMTIME_COMPONENT_BOOL && !v.of.boolean);
    drop(&s,&a,"immediate-task"); assert(!s.tasks.live);
    input=(lb_val){.kind=WASMTIME_COMPONENT_S64,.of.s64=INT64_MIN};
    a=invoke(&s,"start-parked",&input); observation(&s,"poll-parked",&a,"pending");
    int fd=s.tasks.pending_fd; assert(fd>=0 && (fcntl(fd,F_GETFD)&FD_CLOEXEC));
    observation(&s,"poll-parked",&a,"pending"); assert(s.tasks.pending_fd==fd);
    resume(&s,true); wait_readable(fd);
    v=observation(&s,"poll-parked",&a,"ready"); assert(v.kind==WASMTIME_COMPONENT_S64 && v.of.s64==INT64_MIN);
    assert(fcntl(fd,F_GETFD)==-1 && errno==EBADF); observation(&s,"poll-parked",&a,"closed"); drop(&s,&a,"parked-task");
    a=invoke(&s,"start-parked",&input); observation(&s,"poll-parked",&a,"pending"); fd=s.tasks.pending_fd;
    v=invoke(&s,"cancel-parked",&a); assert(v.kind==WASMTIME_COMPONENT_BOOL && v.of.boolean);
    assert(fcntl(fd,F_GETFD)==-1 && errno==EBADF); resume(&peer,true);
    v=invoke(&s,"cancel-parked",&a); assert(v.kind==WASMTIME_COMPONENT_BOOL && !v.of.boolean);
    observation(&s,"poll-parked",&a,"cancelled"); observation(&s,"poll-parked",&a,"closed"); drop(&s,&a,"parked-task");
    a=invoke(&s,"start-parked",&input); observation(&s,"poll-parked",&a,"pending"); fd=s.tasks.pending_fd;
    drop(&s,&a,"parked-task"); assert(!s.tasks.live && fcntl(fd,F_GETFD)==-1 && errno==EBADF); resume(&peer,true);
    a=invoke(&s,"start-parked",&input); observation(&s,"poll-parked",&a,"pending"); fd=s.tasks.pending_fd;
    wasmtime_component_val_delete(&a); close_lab(&s); assert(fcntl(fd,F_GETFD)==-1 && errno==EBADF);
    resume(&peer,true); resume(&peer,false); close_lab(&peer);
    lab full={0}; open_lab(&full,engine,component);
    input=(lb_val){.kind=WASMTIME_COMPONENT_U32,.of.u32=2};
    for (unsigned i=0;i<LB_TASK_MAX;i++) {
        lb_val owned=invoke(&full,"start-immediate",&input);
        wasmtime_component_val_delete(&owned); /* the resource is still in the store */
    }
    assert(full.tasks.live==LB_TASK_MAX); rejected(call(&full,"start-immediate",&input,&empty));
    assert(full.tasks.live==LB_TASK_MAX); close_lab(&full);
    /* The scheduler may still be finalizing the notification for a late result,
       but all native leases must reach zero, not just the Wasmtime slot count. */
    lean_bridge_native_snapshot snapshot;
    for (unsigned attempt=0;;attempt++) {
        lean_bridge_native_snapshot_read(&snapshot); if (!snapshot.live_identities) break;
        assert(attempt<5000); nanosleep(&(struct timespec){.tv_nsec=1000000},NULL);
    }
    lab retired={0}; open_lab(&retired,engine,component);
    input=(lb_val){.kind=WASMTIME_COMPONENT_S64,.of.s64=-3};
    a=invoke(&retired,"start-parked",&input); observation(&retired,"poll-parked",&a,"pending");
    fd=retired.tasks.pending_fd; lean_bridge_native_runtime_retire(); wait_readable(fd);
    lb_val unused={0}; wasmtime_error_t *failure=call(&retired,"poll-parked",&a,&unused); rejected(failure);
    wasmtime_component_val_delete(&a); close_lab(&retired); assert(fcntl(fd,F_GETFD)==-1 && errno==EBADF);
    wasmtime_component_delete(component); wasm_engine_delete(engine);
    puts("Wasmtime Lean tasks: ready/pending/fd/cancel/late/drop/shutdown/nominal/store/leases/retirement checks passed");
}
