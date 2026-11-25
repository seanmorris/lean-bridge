/* This registry is private to one component; the host-domain entry gate
 * confines it to the original process/owner thread. A ticket is never an
 * address. A component can have several independent open bindings. */
typedef struct {
    lean_object *fn;
    uintptr_t owner;
    uint64_t ticket;
    unsigned site;
} dn_closure_slot;
static dn_closure_slot *dn_closures;
static size_t dn_capacity, dn_live, dn_next;
static uint64_t dn_serial;
enum { DN_SLOT_BITS=12, DN_SLOTS=1<<DN_SLOT_BITS, DN_CLOSURE_STALE=16 };
static int dn_closure_save(lb_dnd_session *s,unsigned site,lean_object *fn,uint64_t *out) {
    if (dn_serial==(UINT64_MAX>>DN_SLOT_BITS)) return 12;
    if (dn_live==dn_capacity) {
        if (dn_capacity==DN_SLOTS) return 12;
        size_t n=dn_capacity?dn_capacity*2:8;
#ifdef DN_HOST_FIXED_WASM_ALLOCATOR
        /* The prepared single-threaded heap exports malloc/free, not realloc.
         * Keep the old table intact if growth fails. Slots contain owned Lean
         * references; moving their bytes does not acquire or release them. */
        dn_closure_slot *p=malloc(n*sizeof(*p)); if(!p) return 11;
        if(dn_capacity) memcpy(p,dn_closures,dn_capacity*sizeof(*p));
        free(dn_closures);
#else
        dn_closure_slot *p=realloc(dn_closures,n*sizeof(*p)); if(!p) return 11;
#endif
        memset(p+dn_capacity,0,(n-dn_capacity)*sizeof(*p));
        dn_next=dn_capacity; dn_closures=p; dn_capacity=n;
    }
    while(dn_closures[dn_next].fn) dn_next=(dn_next+1)%dn_capacity;
    const size_t i=dn_next; const uint64_t id=(++dn_serial<<DN_SLOT_BITS)|i;
    lean_inc(fn); dn_closures[i]=(dn_closure_slot){fn,(uintptr_t)s,id,site};
    ++dn_live; dn_next=(i+1)%dn_capacity; out[0]=id; return 0;
}
static dn_closure_slot *dn_closure_find(lb_dnd_session *s,unsigned site,uint64_t id) {
    const size_t i=(size_t)(id&(DN_SLOTS-1));
    if(!id || i>=dn_capacity) return NULL;
    dn_closure_slot *v=dn_closures+i;
    return v->fn && v->ticket==id && v->owner==(uintptr_t)s && v->site==site ? v : NULL;
}
static void dn_closure_release(dn_closure_slot *v) {
    lean_object *fn=v->fn; *v=(dn_closure_slot){0};
    if(!--dn_live) { free(dn_closures); dn_closures=NULL; dn_capacity=dn_next=0; }
    lean_dec(fn);
}
static void dn_closure_retire(uintptr_t key,uint64_t watermark) {
    /* Revoke the entire group before a finalizer can re-enter. New tickets
     * from another opening at a recycled address are outside this batch. */
    for(size_t i=0;i<dn_capacity;i++)
        if(dn_closures[i].owner==key && (dn_closures[i].ticket>>DN_SLOT_BITS)<=watermark)
            dn_closures[i].owner=0;
    for(size_t i=0;i<dn_capacity;i++)
        if(dn_closures[i].fn && !dn_closures[i].owner) dn_closure_release(dn_closures+i);
}
static int dn_closure_drop(lb_dnd_session *s,unsigned site,const uint64_t *args,size_t n) {
    if(!args || n!=1 || args[1] || args[2]) return 5;
    dn_closure_slot *v=dn_closure_find(s,site,args[0]); if(!v) return DN_CLOSURE_STALE;
    dn_closure_release(v); return 0;
}
