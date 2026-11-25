/* Drive the embedding between application calls. The consumer, not this C
 * process, owns the canonical future reader and its returned nominal value. */
#include "echo-future.h"
static void future_action(session *s,const char *name){
    wasmtime_component_func_t f;assert(lwit_lookup(&s->store,NULL,name,&f));
    ok(wasmtime_component_func_call(&f,s->store.ctx,NULL,0,NULL,0));
}
static unsigned future_rows(lwit_future_echo *f,lb_cf_phase phase){
    unsigned n=0;for(unsigned i=0;i<f->r.capacity;i++)n+=f->rows[i].phase==phase;return n;
}
static void guest_futures(wasm_engine_t *engine,wasmtime_component_t *graph,bool shutdown_native){
    lwit_operations ops={0};lwit_future_echo worker={0};session s={0};uint32_t observed=0;
    wasmtime_store_t *store=wasmtime_store_new(engine,NULL,NULL);s.store.ctx=wasmtime_store_context(store);
    wasmtime_component_linker_t *l=wasmtime_component_linker_new(engine);
    ok(lwit_operations_link(l,&ops));ok(lwit_future_echo_link(l,&worker));
    wasmtime_component_linker_instance_t *root=wasmtime_component_linker_root(l);
    ok(wasmtime_component_linker_instance_add_func(root,"observe-drop",12,observe_drop,&observed,NULL));
    wasmtime_component_linker_instance_delete(root);
    ok(wasmtime_component_linker_instantiate(l,s.store.ctx,graph,&s.store.instance));
    assert(lwit_operations_open(&s.store,&ops) && lwit_future_echo_open(&worker,&ops));
    for(unsigned mode=shutdown_native?4:0;mode<5;mode++){
        workshop_box native={0};lwit_owner input={0},fault={0};workshop_diagnostic d={0};
        assert(lwit_sync_make(&ops.bridge,71+mode,&native,&fault,&d)==workshop_OK);
        ok(lwit_export_box(&ops.bridge,native,&input));assert(workshop_box_drop(&native)==workshop_OK);
        ok(lwit_exchange_put(&ops.slots[0],&input));uint32_t before=observed;
        future_action(&s,"start");assert(future_rows(&worker,LB_CF_NATIVE)==1);
        if(mode==3)future_action(&s,"request");
        if(mode!=1 && !shutdown_native){
            ok(lb_cf_advance(&worker.r,5000));assert(future_rows(&worker,LB_CF_WRITER)==(mode==3?0:1));
        }
        if(mode==0 || mode==3){
            V v=invoke(&s,mode==0?"receive":"collect",NULL,0,true);assert(v.kind==WASMTIME_COMPONENT_BOOL && v.of.boolean);
        }else if(mode==4){
            /* Leave the actual reader live. Shutdown must cancel its unaccepted
             * write and run the object's destructor before deleting the store. */
            future_action(&s,"release-original");assert(observed==before+(shutdown_native?1:2));
            ok(lwit_future_echo_shutdown(&worker));assert(observed==before+(shutdown_native?2:3) && !s.store.owners);
            assert(!lwit_future_echo_open(&worker,&ops));
            break;
        }else future_action(&s,"discard");
        ok(lb_cf_reap(&worker.r));
        assert(future_rows(&worker,LB_CF_FREE)==worker.r.capacity && !s.store.owners);
        assert(observed==before+(mode==1?2:3) && drops(&s)==observed);
    }
    ok(lwit_future_echo_shutdown(&worker));assert(lwit_operations_close(&ops)==workshop_OK);ok(lwit_shutdown(&s.store));
    wasmtime_component_linker_delete(l);wasmtime_store_delete(store);
    puts(shutdown_native?"native object future shutdown before take":"compiled Lean canonical object future: both delivery orders, both reader drops, blocked writer shutdown");
}
