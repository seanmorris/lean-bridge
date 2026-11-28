/* Compile beside the real Lean-generated functions so the C compiler
   checks the carrier arguments. Only the test protocol is hand-written. */
#include "members-lean.c"
#include "lean_bridge_native_runtime.h"
#include <emscripten/threading.h>
#define LB_STR1(x) #x
#define LB_STR(x) LB_STR1(x)
extern lean_object *lb_jst_wrap_v1(uint32_t,uint32_t,b_lean_obj_arg);
extern uint32_t lb_jst_error_ticket_v1(b_lean_obj_arg);
extern void lean_bridge_wasm_task_subscribe_v1(b_lean_obj_arg,uint32_t);
lean_object *lb_jst_test_worker_check(void) {
    if (emscripten_is_main_runtime_thread()) __builtin_trap();
    return lean_box(0);
}
static void *init_component(uint8_t builtin) {return initialize_Members(builtin);}
typedef struct {uint32_t op,index,kind,token,mode,notice,tag,out;} frame;
static lean_object *tasks[4];
__attribute__((visibility("default"))) int LB_TEST_CONTROL(frame *f) {
    if (!emscripten_is_main_runtime_thread() || f->index>=4) return 0;
    if (!f->op) return lean_bridge_native_component_initialize(LB_STR(LB_TEST_CONTROL),init_component);
    if (f->op==1 && !tasks[f->index]) {
        lean_object *b=lb_jst_wrap_v1(f->kind,f->token,NULL);if (!b) return 0;
        tasks[f->index]=lb_jst_test_start_member(b,f->mode);
        lean_bridge_wasm_task_subscribe_v1(tasks[f->index],f->notice);return 1;
    }
    if ((f->op==2 || f->op==5) && tasks[f->index]) {
        lean_object *t=tasks[f->index],*v=lean_task_get(t);
        if (lean_obj_tag(v)==0) {
            f->tag=1;f->out=lb_jst_error_ticket_v1(lean_ctor_get(v,0));
        } else {f->tag=0;f->out=lean_unbox_uint32(lean_ctor_get(v,0));}
        if (f->op==2) {lean_dec(t);tasks[f->index]=NULL;}
        return 1;
    }
    if (f->op==3) {
        lean_object *b=lb_jst_wrap_v1(f->kind,f->token,NULL);if (!b) return 0;
        lean_object *r=lb_jst_test_direct_read(b);
        int ok=lean_io_result_is_ok(r);
        if (ok) f->out=lean_unbox_uint32(lean_io_result_get_value(r));
        lean_dec(r);return ok;
    }
    if (f->op==4) {lean_bridge_native_component_detach(LB_STR(LB_TEST_CONTROL));return 1;}
    return 0;
}
