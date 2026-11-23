/* A ResourceAny is tied to one Store. Only a lease on the underlying Lean
 * object crosses package boundaries; a destination Store gets a fresh owner. */
static LBP(status) lb_lease_status(int rc) {
    if (!rc) return LBP(OK);
    if (rc==LB_WIT_LEASE_STALE) return LBP(STALE);
    if (rc==LB_WIT_LEASE_INVALID) return LBP(INVALID);
    if (rc==LB_WIT_LEASE_LIMIT || rc==LB_WIT_LEASE_MEMORY) return LBP(LIMIT);
    return LBP(UNAVAILABLE);
}
static inline int lb_export_lease(lb_session *s,size_t kind,const lb_val *v,uint64_t out[2]) {
    if (kind>=LB_HEAPS || out[0] || out[1]) return LB_MALFORMED;
    lb_task_slot *slot=NULL;
    wasmtime_error_t *err=lb_task_lookup(&s->tasks,LB_TASK_METHODS+kind,v,true,&slot);
    if (err) { wasmtime_error_delete(err); return LB_MALFORMED; }
    /* Converting an own to its host representation consumed the canonical
     * owner. Move its native lease to the caller, without cloning or dropping. */
    out[0]=slot->native[0]; out[1]=slot->native[1];
    *slot=(lb_task_slot){0}; --s->tasks.live; return LB_GOOD;
}
static inline LBP(status) lb_start_leases(lb_session *s,size_t i,lb_val *args,
    const uint64_t *const *leases,uint64_t *out,lb_val *failure) {
    LBP(status) rc=lb_check(s); if (rc!=LBP(OK)) return rc;
    if (!out || out[0] || out[1]) return LBP(INVALID);
    const lb_task_method *m=&lb_methods[i]; size_t count=0;
    for (size_t n=0;n<m->argc;n++) if (m->args[n]>=LB_HEAP_BASE) count++;
    /* Reserve a slot for the new task and one for its eventual owned result. */
    if (LB_TASK_MAX-s->tasks.live<count+2 || UINT32_MAX-s->tasks.last_rep<count+2) return LBP(LIMIT);
    for (size_t n=0;n<m->argc;n++) {
        if (m->args[n]<LB_HEAP_BASE) continue;
        size_t kind=m->args[n]-LB_HEAP_BASE; uint64_t w[4]={0};
        rc=lb_lease_status(lb_heap_methods[kind].clone(leases[n],w));
        if (rc!=LBP(OK)) break;
        w[3]=3+kind; int lifted=lb_heap_lift(&s->tasks,kind,w,&args[n]); LB_TASK_CLEAR(w);
        if (lifted!=LB_GOOD) { rc=lifted==LB_OVER_BUDGET ? LBP(LIMIT) : lb_fault(s,true); break; }
    }
    if (rc==LBP(OK)) rc=lb_start(s,i,args,out,failure);
    for (size_t n=0;n<m->argc;n++) {
        if (m->args[n]<LB_HEAP_BASE || args[n].kind!=WASMTIME_COMPONENT_RESOURCE) continue;
        /* A trapped call can strand a canonical borrow. In that case store
         * shutdown, not an attempted reentry, releases its remaining slots. */
        if (!s->failed) {
            wasmtime_error_t *err=wasmtime_component_resource_any_drop(s->tasks.ctx,args[n].of.resource);
            if (err) { wasmtime_error_delete(err); rc=lb_fault(s,true); }
        }
        wasmtime_component_val_delete(&args[n]); args[n]=(lb_val){0};
    }
    return rc;
}
