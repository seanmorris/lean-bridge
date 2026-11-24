/* The private DSO ABI borrows typed Lean arguments for the duration of one
   synchronous member call. Only the JS owner touches nominal IDs, the wire,
   and application code. Wasm pointers are not part of the public API. */
#include <emscripten.h>
#include <emscripten/threading.h>
#include <emscripten/proxying.h>
#include <lean/lean.h>
#include <stdint.h>
#if !defined(__EMSCRIPTEN_PTHREADS__)
#error Requires the pthread runtime
#endif
extern uint32_t bridge_lean_runtime_status(void);
extern uint32_t lb_jst_token_v1(uint32_t,b_lean_obj_arg);
extern lean_obj_res lb_jst_wrap_v1(uint32_t,uint32_t,b_lean_obj_arg);
extern lean_obj_res lb_jst_new_error_v1(uint32_t,uint32_t);
#define LB_JST_OWNER_WIRE 1
#define lb_host_token lb_jst_member_token
#define lb_host_wrap lb_jst_member_wrap
#define lb_host_send lb_jst_member_send
#define lb_host_finish lb_jst_member_finish
#define lb_host_error lb_jst_member_error
#include "host-wasm-wire.h"
EM_JS(int,lb_jst_begin,(const char *id),{
    return Module['lbJstHostCallsV1']?.enter(UTF8ToString(id))?1:0;
});
EM_JS(void,lb_jst_end,(void),{Module['lbJstHostCallsV1'].leave();});
EM_JS(uint32_t,lb_jst_unavailable,(void),{return Module['lbJstHostCallsV1']?.unavailable()||0;});
EM_JS(uint32_t,lb_jst_kind,(uint32_t i),{return Module['lbJstHostCallsV1'].kind(i>>>0);});
EM_JS(uint32_t,lb_jst_member_send,(uint32_t slot,uint32_t n,const bridge_scalar_slot *args,bridge_scalar_slot *reply),{
    return Module['lbJstHostCallsV1'].send(slot>>>0,n>>>0,args>>>0,reply>>>0);
});
EM_JS(void,lb_jst_member_finish,(bridge_scalar_slot *reply),{Module['lbJstHostCallsV1'].finish(reply>>>0);});
EM_JS(uint32_t,lb_jst_member_record,(uint32_t status,const bridge_scalar_slot *reply),{
    return Module['lbJstHostCallsV1'].record(status>>>0,reply>>>0);
});
uint32_t lb_jst_member_token(uint32_t kind,b_lean_obj_arg value) {return lb_jst_token_v1(lb_jst_kind(kind),value);}
lean_obj_res lb_jst_member_wrap(uint32_t k,uint32_t t,b_lean_obj_arg a) {return lb_jst_wrap_v1(lb_jst_kind(k),t,a);}
lean_obj_res lb_jst_member_error(uint32_t s,const bridge_scalar_slot *r) {return lb_jst_new_error_v1(s,lb_jst_member_record(s,r));}
typedef struct {
    const char *id; unsigned slot,n; const uint8_t *tags; unsigned output; int anchor;
    lean_object **values; lean_object *result;
} lb_jst_call;
/* Called only inside the owner-side exception barrier below. */
void lb_jst_run_member_v1(void *data) {
    lb_jst_call *c=data;
    if (!emscripten_is_main_runtime_thread() || bridge_lean_runtime_status()!=2) return;
    if (!lb_jst_begin(c->id)) {
        uint32_t t=lb_jst_unavailable();
        if (t) {
            c->result=lean_io_result_mk_error(lb_jst_new_error_v1(3,t));
            lean_mark_mt(c->result);
        }
        return;
    }
    c->result=lb_host_invoke(c->slot,c->n,c->tags,c->output,c->anchor,c->values);
    lean_mark_mt(c->result);
    lb_jst_end();
}
EM_JS(int,lb_jst_safe_member,(void *data),{
    try { Module['_lb_jst_run_member_v1'](data); return 1; }
    catch (error) {
        try { Module['lbJstHostCallsV1']?.fault(error); } catch (_) {}
        return 0;
    }
});
static void run_on_owner(void *data) {
    /* Always return to emscripten_proxy_sync so it can signal its waiter,
       including when an internal host hook or Wasm operation trapped. */
    if (!lb_jst_safe_member(data)) ((lb_jst_call *)data)->result=NULL;
}
lean_obj_res lb_jst_member_v1(const char *id,unsigned slot,unsigned n,const uint8_t *tags,unsigned output,int anchor,lean_object **values) {
    lb_jst_call call={id,slot,n,tags,output,anchor,values,NULL};
    if (id && tags && values && n<=64 && (anchor==-1 || (anchor>=0 && (unsigned)anchor<n))) {
        if (emscripten_is_main_runtime_thread()) run_on_owner(&call);
        else {
            /* Never dispatch application methods on Emscripten's system
               queue: it can run reentrantly inside low-level runtime locks.
               This request owns its queue and the worker's stack stays live
               until the owner returns. There is no owner-side sleep or poll. */
            em_proxying_queue *q=em_proxying_queue_create();
            if (q) {
                for (unsigned i=0;i<n;i++) lean_mark_mt(values[i]);
                emscripten_proxy_sync(q,emscripten_main_runtime_thread_id(),run_on_owner,&call);
                em_proxying_queue_destroy(q);
            }
        }
    }
    if (call.result) return call.result;
    /* Scheduling and engine faults are not declared Lean IO failures. On
       a worker, fail only after the owner unwound the proxy request. */
    __builtin_trap();
}
