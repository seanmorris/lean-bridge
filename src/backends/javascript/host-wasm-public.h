/* A synchronous component's private public-call entry. Input slots never own
   native storage. Output is delivered while still owned by Lean; any scalar
   buffer is freed here, using its saved pointer, before returning to JS. */
#if !defined(__wasm32__) || !defined(__EMSCRIPTEN__) || defined(__EMSCRIPTEN_PTHREADS__)
#error Expected a single-threaded wasm32 JavaScript host-object component
#endif
static int pub_frame(const uint32_t *f) {
    uint64_t p=(uintptr_t)f, limit=(uint64_t)__builtin_wasm_memory_size(0)*65536u;
    return p && !(p%8) && p+32<=limit && f[0]==PUB_MAGIC && f[1]>=32 && p+f[1]<=limit
        && !f[2] && !f[4] && !f[5] && !f[6] && !f[7];
}
static int pub_branch(b_lean_obj_arg v) {
    return !lean_is_scalar(v) && lean_is_ctor(v) && lean_ctor_num_objs(v)==1 && lean_obj_tag(v)<=1;
}
static uint32_t pub_out(uint32_t *f,unsigned channel,int node,b_lean_obj_arg v,uint32_t *budget) {
    uint8_t path[32]; unsigned depth=0;
    while (pub_nodes[node][0]<0) {
        if (!pub_branch(v) || depth==32) return 5;
        unsigned ok=lean_obj_tag(v); path[depth++]=ok;
        node=pub_nodes[node][ok?1:2]; v=lean_ctor_get(v,0);
    }
    unsigned tag=(unsigned)pub_nodes[node][0];
    bridge_scalar_slot slot={0}; void *allocation=NULL;
    if (tag>=64) {
        uint32_t kind=PUB_KIND(tag-64), token=lb_jsh_domain_token_v1(kind,v);
        if (!token) return 5;
        slot.kind=tag; slot.bits=token;
    } else {
        lean_inc(v); /* shared scalar encoder consumes one reference */
        if (bridge_copied_encode(&slot,tag,0,v,budget)) return 5;
        if (slot.flags&2) allocation=(void *)(uintptr_t)(uint32_t)slot.bits;
    }
    uint32_t status=PUB_DELIVER(f,channel,path,depth,&slot);
    free(allocation);
    if (!status && tag>=64 && !lb_jsh_domain_admit_v1(PUB_KIND(tag-64),v)) return 5;
    return status;
}
static uint32_t pub_call(uint32_t *f,unsigned n,const uint8_t *tags,int result,int error,
                         lean_object *(*invoke)(lean_object **)) {
    if (n>64 || f[1]!=32+16*n) return 4;
    bridge_scalar_slot *args=(bridge_scalar_slot *)(f+8);
    lean_object *v[64]={0}; uint32_t status=0,budget=16u*1024u*1024u;
    for (unsigned i=0;i<n;i++) {
        if (tags[i]>=64) {
            if (args[i].kind!=tags[i] || args[i].flags || !args[i].bits || args[i].bits>UINT32_MAX) return 4;
        } else if (bridge_copied_validate(&args[i],tags[i],0,&budget)) return 4;
    }
    static int ready;
    if (!ready) {
        lean_object *r=PUB_INIT(1); ready=lean_io_result_is_ok(r); lean_dec(r);
        if (!ready) return 5;
    }
    for (unsigned i=0;i<n;i++) {
        v[i]=tags[i]>=64 ? lb_jsh_domain_wrap_v1(PUB_KIND(tags[i]-64),(uint32_t)args[i].bits,NULL)
            : bridge_copied_decode(&args[i],tags[i],0);
        if (!v[i]) { status=4; goto cleanup; }
    }
    for (unsigned i=0;i<n;i++) if (tags[i]>=64 && !lb_jsh_domain_admit_v1(PUB_KIND(tags[i]-64),v[i])) { status=4; goto cleanup; }
    lb_jsh_error_scope scope; lb_jsh_domain_enter_v1(&scope);
    lean_object *r=invoke(v), *val=lean_ctor_get(r,0);
    uint32_t escaped=lb_jsh_domain_leave_v1(&scope,lean_io_result_is_error(r)?val:NULL);
    if (escaped) f[4]=escaped;
    else if (lean_io_result_is_error(r)) {
        lean_inc(val); lean_object *msg=PUB_TEXT(val); status=pub_out(f,2,PUB_STRING,msg,&budget); lean_dec(msg);
    } else if (error>=0) {
        if (!pub_branch(val)) status=5;
        else { int ok=lean_obj_tag(val); status=pub_out(f,ok?0:1,ok?result:error,lean_ctor_get(val,0),&budget); }
    } else status=pub_out(f,0,result,val,&budget);
    lean_dec(r);
cleanup:
    for (unsigned i=0;i<n;i++) if (v[i]) lean_dec(v[i]);
    return status;
}
