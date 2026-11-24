#include <lean/lean.h>
#include <emscripten/threading.h>
#include <stdatomic.h>
#include <stdint.h>
#include "lean_bridge_native_runtime.h"
#define LB_STR1(x) #x
#define LB_STR(x) LB_STR1(x)
extern lean_object *initialize_Identity(uint8_t);
static void *init_component(uint8_t builtin) {return initialize_Identity(builtin);}

extern lean_object *lb_jst_wrap_v1(uint32_t,uint32_t,b_lean_obj_arg);
extern uint32_t lb_jst_token_v1(uint32_t,b_lean_obj_arg);
extern int lb_jst_admit_v1(uint32_t,b_lean_obj_arg);
extern void lean_bridge_wasm_task_ready_v1(uint32_t);
extern void lean_bridge_wasm_task_subscribe_v1(b_lean_obj_arg,uint32_t);
extern lean_object *lean_io_promise_new(void);
extern lean_object *lean_io_promise_resolve(lean_obj_arg,b_lean_obj_arg);
extern lean_object *lb_jst_test_park(lean_obj_arg,lean_obj_arg,lean_obj_arg);
static lean_object *gate,*task;
static _Atomic uint32_t worker_kind,entered;
static _Atomic int observed_cancel;
static int requested_cancel;

lean_object *lb_jst_test_canceled(uint8_t canceled) {
    atomic_store(&observed_cancel,canceled);return lean_box(0);
}

lean_object *lb_jst_test_observe(b_lean_obj_arg o) {
    /* Worker-side lookup must fail without touching the JS realm or the index. */
    uint32_t k=atomic_load(&worker_kind);
    if (emscripten_is_main_runtime_thread() || lb_jst_token_v1(k,o)!=0 || lb_jst_admit_v1(k,o)!=0) __builtin_trap();
    lean_bridge_wasm_task_ready_v1(atomic_load(&entered));return lean_box(0);
}
/* Keep the pointer witness entirely inside this private test frame. JS only
 * sees equality, the host token and the two readiness notifications. */
typedef struct { uint32_t op,kind,token,entered,finished; lean_object *witness; } frame;
__attribute__((visibility("default"))) int LB_TEST_CONTROL(frame *f) {
    uint32_t k=f->kind,t=f->token;
    if (!emscripten_is_main_runtime_thread()) return 0;
    if (f->op==0) return lean_bridge_native_component_initialize(LB_STR(LB_TEST_CONTROL),init_component);
    if (f->op==6) {lean_bridge_native_component_detach(LB_STR(LB_TEST_CONTROL));return 1;}
    if (f->op==1) {
        if (task || gate) return 0;
        lean_object *r=lb_jst_wrap_v1(k,t,NULL);if (!r) return 0;
        f->witness=r;gate=lean_io_promise_new();lean_inc(gate);
        atomic_store(&worker_kind,k);atomic_store(&entered,f->entered);
        requested_cancel=0;atomic_store(&observed_cancel,-1);
        task=lb_jst_test_park(lean_box(0),r,gate);
        lean_bridge_wasm_task_subscribe_v1(task,f->finished);
        return 1;
    }
    if (f->op==2 || f->op==3) {
        lean_object *r=lb_jst_wrap_v1(k,t,NULL);if (!r) return 0;
        int ok=(f->op==3 || r==f->witness) && lb_jst_token_v1(k,r)==t && !lb_jst_token_v1(k+1,r) && lb_jst_admit_v1(k,r);
        lean_dec(r);return ok;
    }
    if (f->op==4 && gate) {
        lean_dec(lean_io_promise_resolve(lean_box(1),gate));lean_dec(gate);gate=NULL;return 1;
    }
    if (f->op==5 && task && !gate) {
        lean_object *r=lean_task_get(task);int ok=r==f->witness && lb_jst_token_v1(k,r)==t && atomic_load(&observed_cancel)==requested_cancel;
        lean_dec(task);task=NULL;f->witness=NULL;return ok;
    }
    if (f->op==7 && task && gate && !requested_cancel) {
        lean_io_cancel_core(task);requested_cancel=1;return 1;
    }
    return 0;
}
