/* Fixture entry only. Host frame and CLR member binder are the shipping sources. */
#include "host-frame.h"
#include <stdlib.h>
#include <string.h>
extern void lean_initialize_runtime_module(void);
extern lean_object *initialize_Init(uint8_t), *initialize_FrameCheck(uint8_t);
extern lean_object *lb_dn_test_through(uint32_t), *lb_dn_test_first(uint32_t), *lb_dn_test_replace(uint32_t);
extern lean_object *lb_dn_test_mapped(uint32_t), *lb_dn_test_swallow(uint32_t);
static int ready, retired;
static void retire(void) { retired=1; }
lean_object *lean_bridge_host_dotnet_box_observe(uint32_t n) {
    uint64_t in[3]={n}, out[3]={0};
    lean_object *error=lb_dn_member(OBSERVE_SLOT,in,1,out);
    return error ? error : lean_io_result_mk_ok(lean_box_uint32((uint32_t)out[0]));
}
__attribute__((visibility("default"))) int frame_call(uint64_t id,lb_dn_dispatch dispatch,
    int op,uint32_t arg,uint32_t *out,uint32_t *fault) {
    lb_dn_frame f; *fault=0; *out=0;
    int status=lb_dn_enter(&f,id,dispatch,retire); if(status) return status;
    if(retired) { lb_dn_leave(&f); return LB_DN_FATAL; }
    if(!ready) {
        lean_initialize_runtime_module();
        lean_object *r=initialize_Init(1); if(!lean_io_result_is_ok(r)) abort(); lean_dec(r);
        r=initialize_FrameCheck(1); if(!lean_io_result_is_ok(r)) abort(); lean_dec(r);
        lean_io_mark_end_initialization(); ready=1;
    }
    lean_object *r=(op==0 ? lb_dn_test_through : op==1 ? lb_dn_test_first : op==2 ? lb_dn_test_mapped :
                    op==3 ? lb_dn_test_replace : lb_dn_test_swallow)(arg);
    lean_object *v=lean_ctor_get(r,0);
    if(f.fatal) status=LB_DN_FATAL;
    else if(!lean_io_result_is_ok(r)) { *fault=lb_dn_original(&f,v); status=LB_DN_ERROR; }
    else if(op==2 && !lean_obj_tag(v)) {
        status=strcmp(lean_string_cstr(lean_ctor_get(v,0)),"mapped in Lean")==0 ? 4 : 5;
    } else *out=lean_unbox_uint32(op==2 ? lean_ctor_get(v,0) : v);
    lean_dec(r); lb_dn_leave(&f); return status;
}
