/* Consumer-owned store and component: no native wire or broker headers. */
#include "journal_wasmtime.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#define CHECK(x) do { if (!(x)) { fprintf(stderr,"line %d: %s\n",__LINE__,#x); exit(1); } } while(0)
typedef wasmtime_component_val_t V;
static void expect(wasmtime_error_t *error,const char *text) {
    CHECK(error); wasm_name_t message; wasmtime_error_message(error,&message);
    char *copy=calloc(message.size+1,1); CHECK(copy); memcpy(copy,message.data,message.size);
    if (!strstr(copy,text)) { fprintf(stderr,"expected %s: %s\n",text,copy); exit(1); }
    free(copy); wasm_name_delete(&message); wasmtime_error_delete(error);
}
static wasmtime_component_func_t find(const wasmtime_component_instance_t *instance,
    wasmtime_context_t *ctx,const char *iface,const char *name) {
    wasmtime_component_export_index_t *root=wasmtime_component_instance_get_export_index(instance,ctx,NULL,iface,strlen(iface));
    CHECK(root);
    wasmtime_component_export_index_t *ix=wasmtime_component_instance_get_export_index(instance,ctx,root,name,strlen(name));
    wasmtime_component_export_index_delete(root); CHECK(ix); wasmtime_component_func_t f;
    CHECK(wasmtime_component_instance_get_func(instance,ctx,ix,&f)); wasmtime_component_export_index_delete(ix); return f;
}
int main(int argc,char **argv) {
    CHECK(argc==4); bool trap=!strcmp(argv[3],"trap");
    FILE *file=fopen(argv[1],"rb"); CHECK(file && !fseek(file,0,SEEK_END));
    long n=ftell(file); CHECK(n>0 && n<1024*1024 && !fseek(file,0,SEEK_SET));
    uint8_t *bytes=malloc((size_t)n); CHECK(bytes && fread(bytes,1,(size_t)n,file)==(size_t)n); fclose(file);
    wasm_config_t *cfg=wasm_config_new(); CHECK(cfg); wasmtime_config_wasm_component_model_set(cfg,true);
    wasm_engine_t *engine=wasm_engine_new_with_config(cfg); wasmtime_component_t *component=NULL; CHECK(engine);
    CHECK(!wasmtime_component_new(engine,bytes,(size_t)n,&component)); free(bytes);
    wasmtime_component_linker_t *linker=wasmtime_component_linker_new(engine); CHECK(linker && !journal_wasmtime_link(linker));
    journal_wasmtime *peer=NULL; CHECK(!journal_wasmtime_open(&peer));
    V two={.kind=WASMTIME_COMPONENT_U32,.of.u32=2}, out={0};
    // Bypassing the guard must fail BEFORE running Lean, even with valid arguments.
    wasmtime_store_t *store=wasmtime_store_new(engine,NULL,NULL);
    wasmtime_context_t *ctx=wasmtime_store_context(store); wasmtime_component_instance_t instance;
    CHECK(!wasmtime_component_linker_instantiate(linker,ctx,component,&instance));
    wasmtime_component_func_t bump=find(&instance,ctx,argv[2],"bump");
    expect(wasmtime_component_func_call(&bump,ctx,&two,1,&out,1),"requires a guarded call");
    wasmtime_component_val_delete(&out); wasmtime_store_delete(store);
    CHECK(!journal_wasmtime_call(peer,"count",NULL,0,&out) && out.kind==WASMTIME_COMPONENT_U32 && !out.of.u32);
    wasmtime_component_val_delete(&out); store=wasmtime_store_new(engine,NULL,NULL);
    ctx=wasmtime_store_context(store); CHECK(!wasmtime_component_linker_instantiate(linker,ctx,component,&instance));
    bool discard=true; V wrong={.kind=WASMTIME_COMPONENT_BOOL,.of.boolean=true};
    out=(V){.kind=WASMTIME_COMPONENT_U8,.of.u8=97};
    expect(journal_wasmtime_call_instance(store,&instance,"bump",&wrong,1,&out,&discard),"invalid WIT input");
    CHECK(!discard && out.kind==WASMTIME_COMPONENT_U8 && out.of.u8==97);
    wasmtime_error_t *e=journal_wasmtime_call_instance(store,&instance,"bump",&two,1,&out,&discard);
    if (trap) {
        expect(e,"unreachable"); CHECK(discard && out.kind==WASMTIME_COMPONENT_U8 && out.of.u8==97);
        expect(journal_wasmtime_call(peer,"count",NULL,0,&out),"Native bridge failure");
        puts("custom-store:trap:discard:peer-retired");
    } else {
        CHECK(!e && !discard && out.kind==WASMTIME_COMPONENT_U32 && out.of.u32==2); wasmtime_component_val_delete(&out);
        CHECK(!journal_wasmtime_call(peer,"count",NULL,0,&out) && out.kind==WASMTIME_COMPONENT_U32 && out.of.u32==2);
        wasmtime_component_val_delete(&out); puts("custom-store:ready:peer-count:2");
    }
    journal_wasmtime_close(peer); wasmtime_store_delete(store); wasmtime_component_linker_delete(linker);
    wasmtime_component_delete(component); wasm_engine_delete(engine); return 0;
}
