/* Consumer-level behavior is exercised in Client.cs. This entry only drives the
   private production domain/frame and compiled Lean. The witness holds exactly
   one Lean pointer, never a CLR handle, and makes no identity decisions. */
#include "host-domain.h"
#include "lean_bridge_native_runtime.h"
#include "component.h"
extern void witness_save(lean_object *);
extern lean_object *witness_value(void), *initialize_SharedRefs(uint8_t);
extern lean_object *lb_same(lean_object *,lean_object *), *lb_self(lean_object *), *lb_key(lean_object *);
extern lean_object *lb_child(lean_object *), *lb_factory(void);
static void *init(uint8_t b) { return initialize_SharedRefs(b); }
enum { OPEN, CLOSE, SELF, SAVE, SAME, RECALL, CLEAR, REJECT_SECOND, FACTORY, COUNT, CHILD };
__attribute__((visibility("default")))
int test_call(uint64_t call,lb_dn_dispatch dispatch,int op,unsigned k,uint64_t input,uint64_t *out,uint32_t *fault) {
    lb_dn_frame f;
    if(!lean_bridge_native_process_valid() || lb_dn_enter(&f,call,dispatch,lean_bridge_native_runtime_retire)) return DN_DOMAIN_FATAL;
    int status=DN_BOUND;
    *out=0; *fault=0;
    if(op==OPEN) status=lean_bridge_native_component_initialize(COMPONENT,init) ? LB_DND(open)(&f,COMPONENT,specs,2) : DN_DOMAIN_FATAL;
    else if(op==CLOSE) status=LB_DND(close)(&f,COMPONENT);
    else if(op==COUNT) *out=LB_DND(live)(&f);
    else if(!lean_bridge_native_component_ready(COMPONENT)) status=DN_DOMAIN_FATAL;
    else {
        lb_dnd_session *s=LB_DND(enter)(&f,COMPONENT);
        if(!s) { status=DN_CLOSED; goto end; }
        f.domain_session=s;
        lean_object *arg=NULL,*io=NULL,*saved=witness_value();
        if(op==CLEAR) witness_save(NULL);
        else if(op==RECALL) { if(!(*out=LB_DND(export)(&f,s,k,saved))) status=DN_CLOSED; }
        else {
            if(op!=FACTORY) {
                arg=LB_DND(wrap)(&f,s,k,input,0);
                if(!arg) { status=DN_INCOMPATIBLE; goto leave; }
                if(op==REJECT_SECOND) {
                    lean_object *bad=LB_DND(wrap)(&f,s,k,0,0);
                    if(bad) lean_dec(bad); else status=DN_INCOMPATIBLE;
                    goto leave;
                }
                LB_DND(admit)(arg);
            }
            if(op==SAME) {
                if(saved) { lean_inc(saved); lean_inc(arg); io=lb_same(saved,arg); *out=lean_unbox(lean_ctor_get(io,0)); }
            } else {
                if(arg) lean_inc(arg);
                io=op==FACTORY ? lb_factory() : op==CHILD ? lb_child(arg) : k ? lb_key(arg) : lb_self(arg);
                lean_object *v=lean_ctor_get(io,0);
                if(!lean_io_result_is_ok(io)) { *fault=lb_dn_original(&f,v); status=DN_CLOSED; }
                else {
                    if(op==SAVE || op==CHILD) witness_save(v);
                    if(!(*out=LB_DND(export)(&f,s,k,v))) status=DN_CLOSED;
                }
            }
        }
leave:  if(io) lean_dec(io); if(arg) lean_dec(arg); LB_DND(leave)(&f,s);
    }
end: if(f.fatal) status=DN_DOMAIN_FATAL; lb_dn_leave(&f); return status;
}
