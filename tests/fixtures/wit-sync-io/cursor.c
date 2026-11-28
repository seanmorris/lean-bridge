#include "dials_wasmtime.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
typedef wasmtime_component_val_t V;
static void good(wasmtime_error_t *e) {
    if (!e) return;
    wasm_name_t msg; wasmtime_error_message(e,&msg);
    fprintf(stderr,"%.*s\n",(int)msg.size,msg.data); wasm_name_delete(&msg); wasmtime_error_delete(e); exit(1);
}
#define CHECK(x) do { if (!(x)) { fprintf(stderr,"failed at %d: %s\n",__LINE__,#x); exit(1); } } while (0)
static V call(dials_wasmtime *s,const char *n,const V *v) {
    V out={0}; good(dials_wasmtime_call(s,n,v,v?1:0,&out)); return out;
}
static void reject(wasmtime_error_t *err) { CHECK(err); wasmtime_error_delete(err); }
static bool contains(const wasm_name_t *message,const char *word) {
    size_t n=strlen(word);
    for (size_t i=0;i+n<=message->size;i++) if (!memcmp(message->data+i,word,n)) return true;
    return false;
}
static V *arm(V *v,bool ok) {
    CHECK(v->kind==WASMTIME_COMPONENT_RESULT && v->of.result.is_ok==ok && v->of.result.val); return v->of.result.val;
}
static void text(V *v,const char *str) {
    CHECK(v->kind==WASMTIME_COMPONENT_STRING && v->of.string.size==strlen(str) && !memcmp(v->of.string.data,str,strlen(str)));
}
static void count(dials_wasmtime *s,unsigned n) {
    V v=call(s,"counts",NULL); CHECK(v.kind==WASMTIME_COMPONENT_U32 && v.of.u32==n); wasmtime_component_val_delete(&v);
}
int main(int argc,char **argv) {
    dials_wasmtime *a=NULL,*b=NULL;
    wasm_engine_t *engine=NULL; wasmtime_store_t *store=NULL; wasmtime_component_t *component=NULL;
    wasmtime_component_linker_t *linker=NULL;
    bool abandon=argc==2 && !strcmp(argv[1],"exit"),trap=argc==3 && !strcmp(argv[2],"trap");
    if (argc==1 || abandon) good(dials_wasmtime_open(&a));
    else {
        CHECK(argc==2 || trap); FILE *file=fopen(argv[1],"rb"); CHECK(file && !fseek(file,0,SEEK_END));
        long n=ftell(file); CHECK(n>0 && !fseek(file,0,SEEK_SET)); uint8_t *bytes=malloc((size_t)n);
        CHECK(bytes && fread(bytes,1,(size_t)n,file)==(size_t)n); fclose(file);
        wasm_config_t *cfg=wasm_config_new(); wasmtime_config_wasm_component_model_set(cfg,true);
        engine=wasm_engine_new_with_config(cfg); store=wasmtime_store_new(engine,NULL,NULL); linker=wasmtime_component_linker_new(engine);
        good(wasmtime_component_new(engine,bytes,(size_t)n,&component)); free(bytes);
        good(dials_wasmtime_link_cursors(store,linker,&a)); good(dials_wasmtime_instantiate(a,component));
    }
    good(dials_wasmtime_open(&b));
    V one={.kind=WASMTIME_COMPONENT_U32,.of.u32=1},zero={.kind=WASMTIME_COMPONENT_U32},tmp={0};
    if (abandon) {
        (void)call(a,"sequence",&one); count(b,10000); puts("direct-wit:abandoned-at-exit"); return 0;
    }
    if (trap) {
        tmp=(V){.kind=WASMTIME_COMPONENT_U32,.of.u32=97};
        wasmtime_error_t *err=dials_wasmtime_call(a,"sequence",&one,1,&tmp); CHECK(err);
        wasm_name_t msg; wasmtime_error_message(err,&msg); CHECK(contains(&msg,"unreachable"));
        wasm_name_delete(&msg); wasmtime_error_delete(err); CHECK(tmp.kind==WASMTIME_COMPONENT_U32 && tmp.of.u32==97);
        reject(dials_wasmtime_call(b,"counts",NULL,0,&tmp)); CHECK(tmp.of.u32==97);
        dials_wasmtime_close(a); dials_wasmtime_close(b); wasmtime_store_delete(store);
        wasmtime_component_linker_delete(linker); wasmtime_component_delete(component); wasm_engine_delete(engine);
        puts("direct-wit:trapped;output-unchanged;peer-retired"); return 0;
    }
    V seq=call(a,"sequence",&one); count(a,10000);
    reject(dials_wasmtime_call(b,"next-sequence",&seq,1,&tmp));
    reject(dials_wasmtime_call(a,"next-checked",&seq,1,&tmp)); reject(dials_wasmtime_drop(b,&seq));
    V v=call(a,"next-sequence",&seq); CHECK(v.kind==WASMTIME_COMPONENT_OPTION && v.of.option && !v.of.option->of.u32);
    wasmtime_component_val_delete(&v); v=call(a,"next-sequence",&seq); CHECK(v.kind==WASMTIME_COMPONENT_OPTION && !v.of.option);
    wasmtime_component_val_delete(&v); v=call(a,"next-sequence",&seq); CHECK(!v.of.option); wasmtime_component_val_delete(&v);
    good(dials_wasmtime_drop(a,&seq)); reject(dials_wasmtime_drop(a,&seq)); count(b,10201);
    V checked=call(a,"checked",&zero); text(arm(&checked,false),"factory"); wasmtime_component_val_delete(&checked);
    checked=call(a,"checked",&one); V *cursor=arm(&checked,true);
    v=call(a,"next-checked",cursor); CHECK(arm(&v,true)->of.option); wasmtime_component_val_delete(&v);
    v=call(a,"next-checked",cursor); text(arm(&v,false),"step"); wasmtime_component_val_delete(&v);
    good(dials_wasmtime_drop(a,cursor)); wasmtime_component_val_delete(&checked); count(b,20402);
    V units=call(a,"units",&one); cursor=arm(&units,true); v=call(a,"next-units",cursor);
    V *item=arm(&v,true); CHECK(item->kind==WASMTIME_COMPONENT_OPTION && item->of.option && item->of.option->kind==WASMTIME_COMPONENT_ENUM);
    wasmtime_component_val_delete(&v); v=call(a,"next-units",cursor); text(arm(&v,false),"unit step"); wasmtime_component_val_delete(&v);
    good(dials_wasmtime_drop(a,cursor)); wasmtime_component_val_delete(&units); count(b,30603);
    seq=call(a,"sequence",&one); v=call(a,"next-sequence",&seq); wasmtime_component_val_delete(&v);
    good(dials_wasmtime_drop(a,&seq)); count(b,40704);
    seq=call(a,"sequence",&one); units=call(a,"units",&one);
    v=call(a,"next-sequence",&seq); wasmtime_component_val_delete(&v); count(b,60804);
    dials_wasmtime_close(a); count(b,60806);
    wasmtime_component_val_delete(&seq); wasmtime_component_val_delete(&units);
    if (engine) {
        /* A caller-owned linker may survive our closed scope. Even a new
         * instance of the component cannot open a cursor through its old imports. */
        wasmtime_context_t *ctx=wasmtime_store_context(store); wasmtime_component_instance_t other;
        good(wasmtime_component_linker_instantiate(linker,ctx,component,&other));
        const char *iface="lean-bridge:dials/api@1.0.0";
        wasmtime_component_export_index_t *api=wasmtime_component_instance_get_export_index(&other,ctx,NULL,iface,strlen(iface));
        CHECK(api); wasmtime_component_export_index_t *ix=wasmtime_component_instance_get_export_index(&other,ctx,api,"sequence",8);
        CHECK(ix); wasmtime_component_func_t fn; CHECK(wasmtime_component_instance_get_func(&other,ctx,ix,&fn));
        wasmtime_component_export_index_delete(ix); wasmtime_component_export_index_delete(api);
        reject(wasmtime_component_func_call(&fn,ctx,&one,1,&tmp,1)); count(b,60806);
        wasmtime_store_delete(store); wasmtime_component_linker_delete(linker); wasmtime_component_delete(component); wasm_engine_delete(engine);
    }
    dials_wasmtime_close(b);
    puts("direct-wit:6 opens;8 pulls;6 closes"); return 0;
}
