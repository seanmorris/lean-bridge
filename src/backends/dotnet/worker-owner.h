/* Include after the verified component identifier, class keys and shared
   CLR domain declarations. The transport functions are private to Wire. */
#include "worker-ledger.h"
enum { CLR_WORKER_PIN, CLR_WORKER_RESOLVE, CLR_WORKER_ADMIT, CLR_WORKER_DROP };
__attribute__((visibility("default"))) int LB_CLR_VISIT(uint64_t id,lb_dn_dispatch dispatch,
                                                        int cleanup,int (*invoke)(uint64_t)) {
    if(!lean_bridge_native_process_valid() || !invoke || (cleanup!=0 && cleanup!=1)) return 10;
    lb_dn_frame f; int rc=lb_dn_enter(&f,id,dispatch,lean_bridge_native_runtime_retire);
    if(rc) return rc==LB_DN_WRONG_THREAD?9:10;
    if(!cleanup && !lean_bridge_native_component_ready(component)) rc=10;
    else {
        lb_dnd_session *s=LB_DND(enter)(&f,component);
        if(!s) rc=14;
        else {
            f.domain_session=s; rc=lb_clr_worker_visit(&f,invoke); LB_DND(leave)(&f,s);
        }
    }
    if(f.fatal || (!cleanup && !lean_bridge_native_component_ready(component))) rc=10;
    lb_dn_leave(&f); return rc;
}
__attribute__((visibility("default"))) int LB_CLR_OBJECT(int op,unsigned kind,uint64_t input,uint64_t *h,uint64_t *out) {
    lb_dn_frame *f=lb_clr_worker_frame();
    if(!f || f->fatal || !h || !out || kind>=sizeof(worker_keys)/sizeof(*worker_keys)) return 14;
    *out=0;
    if(op==CLR_WORKER_DROP) return lb_clr_worker_release(worker_keys[kind],h)==LB_LEASE_OK?0:14;
    if(!lean_bridge_native_component_ready(component)) return 10;
    lb_dnd_session *s=f->domain_session;
    if(op==CLR_WORKER_PIN) {
        if(!input || h[0] || h[1]) return 5;
        lean_object *v=LB_DND(wrap)(f,s,kind,input,0);
        if(!v) return f->fatal?10:5;
        lean_mark_mt(v);
        int rc=lb_clr_worker_create(worker_keys[kind],v,h); lean_dec(v);
        return rc==LB_LEASE_OK?0:rc==LB_LEASE_MEMORY?11:rc==LB_LEASE_UNAVAILABLE?10:14;
    }
    if(input || (op!=CLR_WORKER_RESOLVE && op!=CLR_WORKER_ADMIT)) return 5;
    lean_object *v=lb_clr_worker_borrow(worker_keys[kind],h);
    if(!v || !LB_DND(object)(s,kind,v)) return 14;
    if(op==CLR_WORKER_ADMIT) { LB_DND(admit)(v); return 0; }
    *out=LB_DND(export)(f,s,kind,v); return *out?0:f->fatal?10:14;
}
