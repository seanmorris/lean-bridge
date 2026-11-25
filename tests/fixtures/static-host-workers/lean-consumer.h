/* Private embedding of the two calls in the consumer integration. The
 * independently compiled user imports neither this nor any exchange slot. */
#include "application-exchange.h"
typedef struct {lwit_bridge bridge;lwit_exchange box,error;} graph_binding;
static wasmtime_error_t *create_call(void *data,wasmtime_context_t *ctx,const wasmtime_component_func_type_t *type,
                                      V *args,size_t n,V *results,size_t count){
    (void)type;graph_binding *g=data;lwit_bridge *b=&g->bridge;lwit_store *s=b->members.store;
    if(!lwit_open(s) || ctx!=s->ctx || n!=2 || count!=1 ||
        args[0].kind!=WASMTIME_COMPONENT_U32 || args[1].kind!=WASMTIME_COMPONENT_U32)return wasmtime_error_new("invalid create call");
    lwit_owner err={0},alias={0};workshop_diagnostic d={0};workshop_box out={0};
    workshop_status rc=lwit_sync_first_error(b,args[0].of.u32,args[1].of.u32,&out,&err,&d);
    wasmtime_error_t *e=NULL;
    if(rc==workshop_HOST_ERROR)e=lwit_exchange_put(&g->error,&err);
    else if(rc==workshop_OK){
        e=lwit_export_box(b,out,&alias);
        if(!e)e=lwit_exchange_put(&g->box,&alias);
        assert(workshop_box_drop(&out)==workshop_OK);
    } else e=wasmtime_error_new("unexpected native create status");
    workshop_diagnostic_clear(&d);
    if(e){(void)lwit_no_error(lwit_drop(&err));(void)lwit_no_error(lwit_drop(&alias));return e;}
    results[0]=(V){.kind=WASMTIME_COMPONENT_BOOL,.of.boolean=rc==workshop_OK};return NULL;
}
static wasmtime_error_t *update_call(void *data,wasmtime_context_t *ctx,const wasmtime_component_func_type_t *type,
                                      V *args,size_t n,V *results,size_t count){
    (void)type;graph_binding *g=data;lwit_bridge *b=&g->bridge;lwit_store *s=b->members.store;
    if(!lwit_open(s) || ctx!=s->ctx || n!=1 || count!=1 || args[0].kind!=WASMTIME_COMPONENT_U32)
        return wasmtime_error_new("invalid update call");
    lwit_owner input={0},err={0};wasmtime_error_t *e=lwit_exchange_take(&g->box,&input);if(e)return e;
    workshop_box box={0};workshop_diagnostic d={0};uint32_t out=0;
    assert(lwit_import_box(b,&input,&box));
    workshop_status rc=lwit_sync_update(b,box,args[0].of.u32,&out,&err,&d);
    workshop_diagnostic_clear(&d);
    assert(workshop_box_drop(&box)==workshop_OK);
    if(rc==workshop_HOST_ERROR){e=lwit_exchange_put(&g->error,&err);if(e){(void)lwit_no_error(lwit_drop(&err));return e;}}
    else if(rc!=workshop_OK)return wasmtime_error_new("unexpected native update status");
    V value=u32(out);results[0]=(V){.kind=WASMTIME_COMPONENT_RESULT,.of.result={.is_ok=rc==workshop_OK,
        .val=rc==workshop_OK?wasmtime_component_val_new(&value):NULL}};return NULL;
}
static void check_exchange(session *s,graph_binding *g){
    lwit_bridge *b=&g->bridge;workshop_box original[2]={0};workshop_diagnostic d={0};lwit_owner fault={0};
    uint32_t before=drops(s);
    for(unsigned i=0;i<2;i++){
        lwit_owner o={0};assert(lwit_sync_make(b,80+i,&original[i],&fault,&d)==workshop_OK && !fault.any);
        ok(lwit_export_box(b,original[i],&o));
        refused(lwit_exchange_put(&g->error,&o));assert(o.any && !s->store.failed);
        ok(lwit_exchange_put(&g->box,&o));assert(!o.any);
    }
    for(unsigned i=0;i<2;i++){
        lwit_owner o={0};workshop_box alias={0};bool same=false;
        ok(lwit_exchange_take(&g->box,&o));refused(lwit_exchange_take(&g->box,&o));
        assert(!lwit_import_box(b,&o,&original[0]) && o.any);
        assert(lwit_import_box(b,&o,&alias) && !o.any);
        assert(workshop_box_same(original[1-i],alias,&same)==workshop_OK && same);
        assert(workshop_box_drop(&alias)==workshop_OK);
    }
    assert(workshop_box_drop(&original[0])==workshop_OK && workshop_box_drop(&original[1])==workshop_OK);
    assert(drops(s)==before+4 && !s->store.owners);
    refused(lwit_exchange_take(&g->box,&fault));assert(s->store.failed && !fault.any);
    refused(lwit_exchange_take(&g->error,&fault));assert(!fault.any);
}
static void guest_calls_lean(wasm_engine_t *engine,wasmtime_component_t *graph){
    graph_binding binding={0};session g={0};
    wasmtime_store_t *one=wasmtime_store_new(engine,NULL,NULL);g.store.ctx=wasmtime_store_context(one);
    wasmtime_component_linker_t *linker=wasmtime_component_linker_new(engine);
    wasmtime_component_linker_instance_t *root=wasmtime_component_linker_root(linker);
    ok(wasmtime_component_linker_instance_add_func(root,"dispatch-create",15,create_call,&binding,NULL));
    ok(wasmtime_component_linker_instance_add_func(root,"dispatch-update",15,update_call,&binding,NULL));
    wasmtime_component_linker_instance_delete(root);
    ok(wasmtime_component_linker_instantiate(linker,g.store.ctx,graph,&g.store.instance));
    assert(lwit_bridge_open(&g.store,&binding.bridge));lwit_members *m=&binding.bridge.members;
    wasmtime_component_export_index_t *scope=wasmtime_component_instance_get_export_index(
        &g.store.instance,g.store.ctx,NULL,"private-exchange",16);
    assert(scope && !lwit_exchange_bind(&g.store,scope,m->error,"put-item0","take-item0",&binding.box));
    assert(lwit_exchange_bind(&g.store,scope,m->kinds[0].type,"put-item0","take-item0",&binding.box));
    assert(lwit_exchange_bind(&g.store,scope,m->error,"put-item1","take-item1",&binding.error));
    wasmtime_component_export_index_delete(scope);
    const uint32_t cases[][4]={{42,73,73,3},{UINT32_MAX,UINT32_MAX-1,'i',2},{UINT32_MAX-1,UINT32_MAX,'o',2},{11,27,27,3}};
    for(size_t i=0;i<sizeof cases/sizeof *cases;i++){
        uint32_t before=drops(&g);V args[]={u32(cases[i][0]),u32(cases[i][1])};
        V v=invoke(&g,"exercise",args,2,true);
        assert(v.kind==WASMTIME_COMPONENT_U32 && v.of.u32==cases[i][2] && drops(&g)==before+cases[i][3] && !g.store.owners);
    }
    check_exchange(&g,&binding);
    assert(lwit_bridge_close(&binding.bridge)==workshop_OK);ok(lwit_shutdown(&g.store));
    wasmtime_component_linker_delete(linker);wasmtime_store_delete(one);
    puts("independent Wasm consumer called Lean and ran original guest destructors");
}
