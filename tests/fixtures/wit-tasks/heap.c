#include <wasmtime/component.h>
/* Fault injection applies only to this embedding, not to the Wasmtime library. */
static bool fail_next_arm=false;
static wasmtime_component_val_t *arm_new(wasmtime_component_val_t *v) {
    if (fail_next_arm) { fail_next_arm=false; return NULL; }
    return wasmtime_component_val_new(v);
}
#define wasmtime_component_val_new arm_new
#include "wasmtime-lab.h"
#undef wasmtime_component_val_new
static lb_val take_branch(lb_val *parent,lb_val *branch) {
    assert(branch); lb_val out=*branch; *branch=(lb_val){0}; wasmtime_component_val_delete(parent); return out;
}
static lb_val result(lb_val v,bool expected) {
    assert(v.kind==WASMTIME_COMPONENT_RESULT && v.of.result.is_ok==expected);
    return take_branch(&v,v.of.result.val);
}
static lb_val obs(lab *s,const char *fn,lb_val *owner,const char *label) {
    lb_val v=invoke(s,fn,owner); assert(v.kind==WASMTIME_COMPONENT_VARIANT && lb_name(&v.of.variant.discriminant,label));
    return take_branch(&v,v.of.variant.val);
}
static lb_val pair(lab *s,const char *fn,lb_val a,lb_val b) {
    lb_val args[]={a,b},out={0}; ok(calln(s,fn,args,2,&out)); return out;
}
static void discard(lab *s,lb_val *v) {
    assert(v->kind==WASMTIME_COMPONENT_RESOURCE && wasmtime_component_resource_any_owned(v->of.resource));
    size_t before=s->tasks.live;
    ok(wasmtime_component_resource_any_drop(s->tasks.ctx,v->of.resource));
    assert(s->tasks.live+1==before); wasmtime_component_val_delete(v); *v=(lb_val){0};
}
static lb_val fresh(lab *s,const char *start,const char *poll) {
    lb_val n={.kind=WASMTIME_COMPONENT_U32,.of.u32=11},h=result(invoke(s,start,&n),true);
    lb_val v=obs(s,poll,&h,"ready"); discard(s,&h); return v;
}
static bool same(lab *s,lb_val a,lb_val b) {
    lb_val v=pair(s,"same-lease-ticket",a,b); assert(v.kind==WASMTIME_COMPONENT_BOOL); return v.of.boolean;
}
static void demand(lab *s,lb_val *cursor,const char *expected) {
    lb_val v=invoke(s,"request-stream",cursor);
    assert(v.kind==WASMTIME_COMPONENT_VARIANT && lb_name(&v.of.variant.discriminant,expected) && !v.of.variant.val);
    wasmtime_component_val_delete(&v);
}
int main(void) {
    alarm(90);
    wasm_config_t *config=wasm_config_new(); wasmtime_config_wasm_component_model_set(config,true);
    wasm_engine_t *engine=wasm_engine_new_with_config(config); wasmtime_component_t *component=NULL;
    ok(wasmtime_component_new(engine,lb_task_component,sizeof(lb_task_component),&component));
    lab s={0}; open_lab(&s,engine,component);
    lb_val first=fresh(&s,"start-issue","poll-issue"),other=fresh(&s,"start-issue","poll-issue");
    assert(!same(&s,first,other)); discard(&s,&other);
    lb_val alias=invoke(&s,"retain-lease-ticket",&first);
    assert(same(&s,first,alias)); discard(&s,&first);
    lb_val h=invoke(&s,"start-view",&alias),count=obs(&s,"poll-view",&h,"ready");
    assert(count.kind==WASMTIME_COMPONENT_U32 && count.of.u32==11); discard(&s,&h);
    lb_val yes={.kind=WASMTIME_COMPONENT_BOOL,.of.boolean=true},no={.kind=WASMTIME_COMPONENT_BOOL,.of.boolean=false};
    lb_val failed=result(pair(&s,"start-checked",yes,alias),false); assert(same(&s,failed,alias)); discard(&s,&failed);
    h=result(pair(&s,"start-checked",no,alias),true);
    lb_val cursor=result(pair(&s,"open-stream",alias,yes),true);
    discard(&s,&alias); /* Both Lean owners now independently anchor the original Ticket. */
    lb_val task_value=obs(&s,"poll-checked",&h,"ready"); discard(&s,&h);
    demand(&s,&cursor,"accepted"); demand(&s,&cursor,"busy");
    lb_val item=obs(&s,"poll-stream",&cursor,"item"); assert(same(&s,task_value,item));
    demand(&s,&cursor,"accepted"); lb_val step_error=obs(&s,"poll-stream",&cursor,"failed");
    demand(&s,&cursor,"closed"); discard(&s,&cursor);
    assert(same(&s,step_error,item)); discard(&s,&item); discard(&s,&task_value);
    for (size_t i=0;i<260;i++) { lb_val owned=invoke(&s,"retain-lease-ticket",&step_error); discard(&s,&owned); }
    lb_val badge=fresh(&s,"start-tag","poll-tag");
    lb_val invalid={0}; wasmtime_error_t *err=call(&s,"retain-lease-ticket",&badge,&invalid);
    assert(err); wasmtime_error_delete(err); /* Nominally different, even with matching field layout. */
    discard(&s,&badge);
    wasmtime_component_val_delete(&step_error); /* Store shutdown must release this remaining native lease. */
    assert(s.tasks.live==1); close_lab(&s);
    lean_bridge_native_snapshot snapshot={0}; lean_bridge_native_snapshot_read(&snapshot);
    assert(snapshot.runtime_init_runs==1 && snapshot.live_identities==0);
    /* Exhaust the allocation of the outgoing variant arm after native take.
     * No Wasmtime heap owner may be orphaned when the call cannot publish it. */
    lab limited={0}; open_lab(&limited,engine,component);
    lb_val n={.kind=WASMTIME_COMPONENT_U32,.of.u32=12};
    h=result(invoke(&limited,"start-issue",&n),true); assert(limited.tasks.live==1);
    fail_next_arm=true; err=call(&limited,"poll-issue",&h,&invalid);
    assert(err && limited.tasks.import_failed && !fail_next_arm && limited.tasks.live==1);
    wasm_name_t message; wasmtime_error_message(err,&message);
    const char expected[]="Cannot allocate WIT task result"; bool reported=false;
    for (size_t i=0;i+sizeof(expected)-1<=message.size;i++)
        if (memcmp(message.data+i,expected,sizeof(expected)-1)==0) { reported=true; break; }
    assert(reported);
    wasm_name_delete(&message); wasmtime_error_delete(err);
    /* A trap can strand a canonical borrow. The embedding must tear down the
     * store; it cannot make another call to dispose the still-borrowed task. */
    wasmtime_component_val_delete(&h); close_lab(&limited);
    lean_bridge_native_snapshot_read(&snapshot);
    assert(snapshot.runtime_init_runs==1 && snapshot.live_identities==0);
    wasmtime_component_delete(component);wasm_engine_delete(engine);
    puts("Wasmtime Lean tasks: heap identity, borrowed input, owned task/item/errors and shutdown checks passed");
}
