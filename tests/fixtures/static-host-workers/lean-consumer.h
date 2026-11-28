static void check_exchange(session *s,lwit_operations *g){
    lwit_bridge *b=&g->bridge;workshop_box original[2]={0};workshop_diagnostic d={0};lwit_owner fault={0};
    uint32_t before=drops(s);
    for(unsigned i=0;i<2;i++){
        lwit_owner o={0};assert(lwit_sync_make(b,80+i,&original[i],&fault,&d)==workshop_OK && !fault.any);
        ok(lwit_export_box(b,original[i],&o));
        refused(lwit_exchange_put(&g->slots[1],&o));assert(o.any && !s->store.failed);
        ok(lwit_exchange_put(&g->slots[0],&o));assert(!o.any);
    }
    for(unsigned i=0;i<2;i++){
        lwit_owner o={0};workshop_box alias={0};bool same=false;
        ok(lwit_exchange_take(&g->slots[0],&o));refused(lwit_exchange_take(&g->slots[0],&o));
        assert(!lwit_import_box(b,&o,&original[0]) && o.any);
        assert(lwit_import_box(b,&o,&alias) && !o.any);
        assert(workshop_box_same(original[1-i],alias,&same)==workshop_OK && same);
        assert(workshop_box_drop(&alias)==workshop_OK);
    }
    assert(workshop_box_drop(&original[0])==workshop_OK && workshop_box_drop(&original[1])==workshop_OK);
    assert(drops(s)==before+4 && !s->store.owners);
    refused(lwit_exchange_take(&g->slots[0],&fault));assert(s->store.failed && !fault.any);
    refused(lwit_exchange_take(&g->slots[1],&fault));assert(!fault.any);
}
/* Observe the defining guest destructor before a Wasm trap unwinds.
 * Calling back into the trapped component to ask for its counter is invalid. */
static wasmtime_error_t *observe_drop(void *count,wasmtime_context_t *ctx,const wasmtime_component_func_type_t *ft,
    V *args,size_t argc,V *results,size_t resultc){
    (void)ctx;(void)ft;(void)args;(void)results;assert(!argc && !resultc);++*(uint32_t *)count;return NULL;
}
static void guest_calls_lean(wasm_engine_t *engine,wasmtime_component_t *graph,bool malformed){
    lwit_operations binding={0};session g={0};
    wasmtime_store_t *one=wasmtime_store_new(engine,NULL,NULL);g.store.ctx=wasmtime_store_context(one);
    wasmtime_component_linker_t *linker=wasmtime_component_linker_new(engine);
    ok(lwit_operations_link(linker,&binding));
    uint32_t observed=0;wasmtime_component_linker_instance_t *root=wasmtime_component_linker_root(linker);
    ok(wasmtime_component_linker_instance_add_func(root,"observe-drop",12,observe_drop,&observed,NULL));
    wasmtime_component_linker_instance_delete(root);
    ok(wasmtime_component_linker_instantiate(linker,g.store.ctx,graph,&g.store.instance));
    assert(lwit_operations_open(&g.store,&binding));
    if(malformed){
        workshop_box native={0};lwit_owner owner={0},fault={0};workshop_diagnostic d={0};
        assert(lwit_sync_make(&binding.bridge,77,&native,&fault,&d)==workshop_OK);
        ok(lwit_export_box(&binding.bridge,native,&owner));assert(workshop_box_drop(&native)==workshop_OK);
        uint32_t before=drops(&g);assert(before==observed);wasmtime_component_func_t bad;
        assert(lwit_lookup(&g.store,NULL,"bad-input",&bad));
        V arg=resource(&owner);
        wasmtime_error_t *e=wasmtime_component_func_call(&bad,g.store.ctx,&arg,1,NULL,0);
        assert(e && g.store.failed && g.store.owners==&owner && !owner.next);
        wasm_name_t message;wasmtime_error_message(e,&message);const char expected[]="invalid WIT argument or conversion limit: shift";
        bool found=false;for(size_t i=0;i+sizeof(expected)-1<=message.size;i++)if(!memcmp(message.data+i,expected,sizeof(expected)-1))found=true;
        assert(found);wasm_name_delete(&message);wasmtime_error_delete(e);
        assert(observed==before+1);ok(lwit_drop(&owner));
        goto close;
    }
    const uint32_t cases[][4]={{42,73,73,3},{UINT32_MAX,UINT32_MAX-1,'i',2},{UINT32_MAX-1,UINT32_MAX,'o',2},{11,27,27,3}};
    for(size_t i=0;i<sizeof cases/sizeof *cases;i++){
        uint32_t before=drops(&g);V args[]={u32(cases[i][0]),u32(cases[i][1])};
        V v=invoke(&g,"exercise",args,2,true);
        assert(v.kind==WASMTIME_COMPONENT_U32 && v.of.u32==cases[i][2] && drops(&g)==before+cases[i][3] && !g.store.owners);
    }
    V suite=invoke(&g,"suite",NULL,0,true);
    assert(suite.kind==WASMTIME_COMPONENT_U32 && suite.of.u32==1 && !g.store.owners && observed==drops(&g));
    check_exchange(&g,&binding);
close:
    assert(lwit_operations_close(&binding)==workshop_OK);ok(lwit_shutdown(&g.store));
    wasmtime_component_linker_delete(linker);wasmtime_store_delete(one);
    if(!malformed)puts("independent Wasm consumer called Lean and ran original guest destructors");
}
