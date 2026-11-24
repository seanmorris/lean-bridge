/* The SDK owns tagged list elements. The C facade exposes packed bytes,
 * copying at each lifetime boundary. Never treat these buffers as UTF-8. */
static inline int lb_unpack_bytes(const lb_val *v,LBP(bytes) *out) {
    if (v->kind!=WASMTIME_COMPONENT_LIST) return LB_MALFORMED;
    size_t n=v->of.list.size;
    const lb_val *items=v->of.list.data;
    if (!lb_buffer(items,n,sizeof(*items),_Alignof(lb_val))) return LB_MALFORMED;
    if (n>(16u*1024u*1024u)/sizeof(*items)) return LB_OVER_BUDGET;
    uint8_t *data=n?malloc(n):NULL;
    if (n && !data) return LB_OVER_BUDGET;
    for (size_t i=0;i<n;i++) {
        if (items[i].kind!=WASMTIME_COMPONENT_U8) {free(data);return LB_MALFORMED;}
        data[i]=items[i].of.u8;
    }
    *out=(LBP(bytes)){data,n};return LB_GOOD;
}
static inline LBP(status) lb_pack_bytes(LBP(byte_view) value,lb_val *out,lb_scope *budget) {
    if (!lb_buffer(value.data,value.size,1,1)) return LBP(INVALID);
    if (!lb_charge(budget,1,sizeof(lb_val)) || !lb_charge(budget,value.size,sizeof(lb_val)+1)) return LBP(LIMIT);
    out->kind=WASMTIME_COMPONENT_LIST;wasmtime_component_vallist_new_uninit(&out->of.list,value.size);
    for (size_t i=0;i<value.size;i++)
        out->of.list.data[i]=(lb_val){.kind=WASMTIME_COMPONENT_U8,.of.u8=value.data[i]};
    return LBP(OK);
}
typedef struct { size_t slot; LBP(byte_view) value; } lb_bytes_arg;
static inline LBP(status) lb_start_bytes(lb_session *s,size_t method,lb_val *args,
    const uint64_t *const *leases,const lb_bytes_arg *values,size_t count,uint64_t *out,lb_val *failure) {
    LBP(status) rc=lb_check(s);if (rc!=LBP(OK)) return rc;
    if (!out || out[0] || out[1]) return LBP(INVALID);
    lb_scope budget={.remaining=16u*1024u*1024u};size_t built=0;
    for (;built<count;built++) {
        rc=lb_pack_bytes(values[built].value,&args[values[built].slot],&budget);
        if (rc!=LBP(OK)) break;
    }
    if (rc==LBP(OK)) {
#if LB_HEAPS
        if (leases) rc=lb_start_leases(s,method,args,leases,out,failure);
        else
#else
        (void)leases;
#endif
        rc=lb_start(s,method,args,out,failure);
    }
    while (built) wasmtime_component_val_delete(&args[values[--built].slot]);
    return rc;
}
