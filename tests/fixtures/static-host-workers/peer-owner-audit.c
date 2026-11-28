/* Private native supervisor probe. Only the graph owns the defining table;
 * two independent guest instances define their nominal callback resources. */
#include <assert.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <wasmtime.h>
typedef wasmtime_component_val_t val;
typedef struct {wasmtime_context_t *ctx;wasmtime_component_instance_t i;} probe;
static void check(wasmtime_error_t *e){
    if(e){wasm_name_t msg;wasmtime_error_message(e,&msg);fprintf(stderr,"%.*s\n",(int)msg.size,msg.data);
        wasm_name_delete(&msg);wasmtime_error_delete(e);exit(1);}
}
static val call(probe *p,const char *iface,const char *name,val *args,size_t n,size_t results){
    wasmtime_component_export_index_t *scope=NULL;
    if(iface){scope=wasmtime_component_instance_get_export_index(&p->i,p->ctx,NULL,iface,strlen(iface));assert(scope);}
    wasmtime_component_export_index_t *idx=wasmtime_component_instance_get_export_index(&p->i,p->ctx,scope,name,strlen(name));
    wasmtime_component_func_t fn;assert(idx && wasmtime_component_instance_get_func(&p->i,p->ctx,idx,&fn));
    wasmtime_component_export_index_delete(idx);if(scope)wasmtime_component_export_index_delete(scope);
    val out={0};check(wasmtime_component_func_call(&fn,p->ctx,args,n,results?&out:NULL,results));return out;
}
static val u32(unsigned n){return (val){.kind=WASMTIME_COMPONENT_U32,.of.u32=n};}
static val u64(uint64_t n){return (val){.kind=WASMTIME_COMPONENT_U64,.of.u64=n};}
static bool boolean(val v){assert(v.kind==WASMTIME_COMPONENT_BOOL);return v.of.boolean;}
static bool bind_table(probe *p,const char *iface,unsigned domain){
    val d=u32(domain);return boolean(call(p,iface,iface?"bind":"bind-owners",&d,1,1));
}
static void close_table(probe *p,const char *iface){call(p,iface,iface?"close":"close-owners",NULL,0,0);}
static const char *provider[]={"objects","provider-a","provider-b"},*table[]={NULL,"table-a","table-b"};
static uint64_t hold(probe *p,unsigned i){
    val id=u32(17),obj=call(p,provider[i],"make",&id,1,1);
    assert(obj.kind==WASMTIME_COMPONENT_RESOURCE);
    val token=call(p,i?table[i]:table[1],i?"hold-k2":"hold-k0",&obj,1,1);
    wasmtime_component_val_delete(&obj);assert(token.kind==WASMTIME_COMPONENT_U64);return token.of.u64;
}
static void drops(probe *p,unsigned i,unsigned expected){
    val v=call(p,provider[i],"drops",NULL,0,1);assert(v.kind==WASMTIME_COMPONENT_U32 && v.of.u32==expected);
}
static bool same(probe *p,unsigned i,uint64_t k){
    val v[]={u64(k),u64(k)};return boolean(call(p,i?table[i]:table[2],i?"same-k2":"same-k0",v,2,1));
}
static bool release(probe *p,unsigned i,uint64_t k){
    val v=u64(k);return boolean(call(p,table[i],"release-k2",&v,1,1));
}
static void audit(probe *p,unsigned first){
    assert(!bind_table(p,table[1],42) && !bind_table(p,NULL,0));
    if(!first){
        close_table(p,table[2]);assert(!bind_table(p,NULL,42) && !bind_table(p,NULL,42));
        for(unsigned i=0;i<3;i++){assert(!hold(p,i));drops(p,i,1);}return;
    }
    assert(bind_table(p,NULL,42) && !bind_table(p,NULL,43));
    uint64_t k[3]={0};for(unsigned i=0;i<3;i++){k[i]=hold(p,i);assert(k[i] && (k[i]>>32)==42);}
    assert(k[1]!=k[2] && k[0]!=k[1] && k[0]!=k[2] && same(p,0,k[0]));
    assert(!release(p,1,k[2]) && !release(p,2,k[1]));
    unsigned other=3-first;close_table(p,table[first]);close_table(p,table[first]);
    drops(p,first,1);drops(p,other,0);drops(p,0,0);
    assert(!same(p,first,k[first]) && !bind_table(p,table[first],42));
    assert(same(p,other,k[other]) && same(p,0,k[0]));
    assert(!hold(p,first));drops(p,first,2);
    close_table(p,NULL);close_table(p,NULL);assert(!bind_table(p,NULL,42));
    drops(p,first,2);drops(p,other,1);drops(p,0,1);
}
int main(void){
    wasm_config_t *cfg=wasm_config_new();assert(cfg);
    wasmtime_config_wasm_component_model_set(cfg,true);wasmtime_config_wasm_component_model_async_set(cfg,true);
    wasm_engine_t *e=wasm_engine_new_with_config(cfg);assert(e);
    FILE *f=fopen("audit.wasm","rb");assert(f && !fseek(f,0,SEEK_END));long len=ftell(f);assert(len>0 && len<1000000);
    rewind(f);uint8_t *bytes=malloc((size_t)len);assert(bytes && fread(bytes,1,(size_t)len,f)==(size_t)len);fclose(f);
    wasmtime_component_t *c=NULL;check(wasmtime_component_new(e,bytes,(size_t)len,&c));free(bytes);
    for(unsigned mode=0;mode<3;mode++){
        wasmtime_store_t *s=wasmtime_store_new(e,NULL,NULL);wasmtime_component_linker_t *l=wasmtime_component_linker_new(e);
        assert(s && l);probe p={.ctx=wasmtime_store_context(s)};check(wasmtime_component_linker_instantiate(l,p.ctx,c,&p.i));
        audit(&p,mode);wasmtime_component_linker_delete(l);wasmtime_store_delete(s);
    }
    wasmtime_component_delete(c);wasm_engine_delete(e);
    puts("closed both orders; failed group bind rolled back; destructor counts balanced");return 0;
}
