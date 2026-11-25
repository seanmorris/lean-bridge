/* Integration fixture for the private Wasmtime adapter and compiled Lean
 * worker. Consumers of a released package must not implement this plumbing. */
#include "public.h"
#include "application-object-store.h"
#include <assert.h>
#include <poll.h>
#include <stdio.h>
#include <stdlib.h>

typedef wasmtime_component_val_t V;
typedef struct {
    lwit_store store;
    lwit_class box,second_binding;
    wasmtime_component_export_index_t *scope;
} session;
static void ok(wasmtime_error_t *e) {
    if(e){wasm_name_t text;wasmtime_error_message(e,&text);
        fprintf(stderr,"Wasmtime: %.*s\n",(int)text.size,text.data);
        wasm_name_delete(&text);wasmtime_error_delete(e);abort();}
}
static void refused(wasmtime_error_t *e){assert(e);wasmtime_error_delete(e);}
static V u32(uint32_t v){return (V){.kind=WASMTIME_COMPONENT_U32,.of.u32=v};}
static V resource(const lwit_owner *v){return (V){.kind=WASMTIME_COMPONENT_RESOURCE,.of.resource=v->any};}
static V invoke(session *s,const char *name,V *args,size_t n,bool top){
    wasmtime_component_func_t fn;
    assert(lwit_lookup(&s->store,top?NULL:s->scope,name,&fn));
    V result={0};ok(wasmtime_component_func_call(&fn,s->store.ctx,args,n,&result,1));return result;
}
static V result(session *s,const char *name,V *args,size_t n){
    V v=invoke(s,name,args,n,false);
    assert(v.kind==WASMTIME_COMPONENT_RESULT && v.of.result.is_ok);return v;
}
static void open_instance(session *s,wasmtime_context_t *ctx,wasmtime_component_linker_t *l,
                          wasmtime_component_t *c,const char *iface){
    s->store.ctx=ctx;
    ok(wasmtime_component_linker_instantiate(l,ctx,c,&s->store.instance));
    s->scope=wasmtime_component_instance_get_export_index(&s->store.instance,ctx,NULL,iface,strlen(iface));
    assert(s->scope);
    assert(!lwit_class_bind(&s->store,s->scope,"same-box","retain-box",&s->box));
    assert(lwit_class_bind(&s->store,s->scope,"retain-box","same-box",&s->box));
    assert(lwit_class_bind(&s->store,s->scope,"retain-box","same-box",&s->second_binding));
}
static void close_instance(session *s){
    ok(lwit_shutdown(&s->store));
    lwit_class_clear(&s->box);lwit_class_clear(&s->second_binding);
    wasmtime_component_export_index_delete(s->scope);
}
static uint32_t drops(session *s){V v=invoke(s,"drops",NULL,0,true);assert(v.kind==WASMTIME_COMPONENT_U32);return v.of.u32;}
static void new_box(session *s,uint32_t n,lwit_owner *out){
    V arg=u32(n),v=result(s,"[static]box.create",&arg,1);
    assert(lwit_take(&s->store,&s->box,v.of.result.val,out));wasmtime_component_val_delete(&v);
}
static lwit_owner *unbox(workshop_box box){
    void *p=NULL;assert(workshop_box_data(box,&p)==workshop_OK);return p;
}
static void dispose(void *p){ok(lwit_drop(p));free(p);}
static uint32_t make(void *ctx,uint32_t n,workshop_box *out){
    lwit_owner *owner=calloc(1,sizeof *owner);assert(owner);
    new_box(ctx,n,owner);assert(workshop_box_adopt(owner,dispose,out)==workshop_OK);return 0;
}
static uint32_t read_box(void *ctx,workshop_box box,uint32_t *out){
    session *s=ctx;lwit_owner *o=unbox(box);assert(lwit_is(&s->box,o));
    V a=resource(o),v=result(s,"[method]box.read",&a,1);
    assert(v.of.result.val->kind==WASMTIME_COMPONENT_U32);*out=v.of.result.val->of.u32;
    wasmtime_component_val_delete(&v);return 0;
}
static uint32_t set_box(void *ctx,workshop_box box,uint32_t n){
    session *s=ctx;V a[]={resource(unbox(box)),u32(n)},v=result(s,"[method]box.set-level",a,2);
    assert(!v.of.result.val);wasmtime_component_val_delete(&v);return 0;
}
static uint32_t identity(void *ctx,workshop_box box,workshop_box *out){
    session *s=ctx;lwit_owner *original=unbox(box),alias={0};bool equal=false;
    V a=resource(original),v=result(s,"[method]box.identity",&a,1);
    assert(lwit_take(&s->store,&s->box,v.of.result.val,&alias));wasmtime_component_val_delete(&v);
    ok(lwit_same(&s->second_binding,original,&alias,&equal));assert(equal);ok(lwit_drop(&alias));
    assert(workshop_box_clone(box,out)==workshop_OK);return 0;
}
typedef struct {session *s;workshop_binding b;unsigned visits;} callback;
static workshop_status relay(void *ctx,workshop_box box,workshop_box *out,workshop_diagnostic *d){
    callback *c=ctx;uint32_t observed=0;
    assert(lwit_is(&c->s->second_binding,unbox(box)));
    assert(workshop_update(c->b,box,73,&observed,d)==workshop_OK && observed==73);
    c->visits++;return workshop_box_clone(box,out);
}
#define READY(fn,h) do { \
    workshop_status state;int fd=-1;unsigned attempts=0; \
    while((state=workshop_##fn##_poll(h,&fd))==workshop_PENDING){ \
        struct pollfd p={.fd=fd,.events=POLLIN};assert(fd>=0 && ++attempts<100 && poll(&p,1,5000)==1); \
    }assert(state==workshop_OK); \
} while(0)
static void workers(session *s){
    workshop_hosts hosts={.box_create=make,.box_read=read_box,.box_get_level=read_box,.box_set_level=set_box,.box_identity=identity};
    workshop_binding b={0};workshop_box a={0},other={0},returned={0};workshop_diagnostic d={0};
    assert(workshop_with_hosts(&hosts,s,&b)==workshop_OK);
    uint32_t before=drops(s);bool same=true;
    assert(workshop_make(b,42,&a,&d)==workshop_OK && workshop_make(b,42,&other,&d)==workshop_OK);
    ok(lwit_same(&s->box,unbox(a),unbox(other),&same));assert(!same);
    workshop_echo_handle h={0};assert(workshop_echo_start(b,a,&h,&d)==workshop_OK);
    READY(echo,h);assert(workshop_echo_take(&h,&returned,&d)==workshop_OK);
    ok(lwit_same(&s->box,unbox(a),unbox(returned),&same));assert(same);
    assert(workshop_box_drop(&returned)==workshop_OK);
    workshop_relay_handle job={0};workshop_callback_box_to_box cb={0};callback state={.s=s,.b=b};
    assert(workshop_callback_box_to_box_new(relay,&state,NULL,&cb)==workshop_OK);
    assert(workshop_relay_start(b,a,cb,&job,&d)==workshop_OK);assert(workshop_callback_box_to_box_drop(&cb)==workshop_OK);
    READY(relay,job);assert(workshop_relay_take(&job,&returned,&d)==workshop_OK && state.visits==1);
    assert(workshop_box_drop(&returned)==workshop_OK);
    uint32_t n=0;assert(workshop_read(b,a,&n,&d)==workshop_OK && n==73);
    assert(workshop_read(b,other,&n,&d)==workshop_OK && n==42);
    assert(workshop_identity(b,a,&returned,&d)==workshop_OK);
    assert(workshop_box_drop(&a)==workshop_OK && workshop_box_drop(&other)==workshop_OK);
    assert(drops(s)==before+2);assert(workshop_box_drop(&returned)==workshop_OK);
    assert(drops(s)==before+3 && !s->store.owners);
    assert(workshop_close(&b)==workshop_OK);
}
int main(int argc,char **argv){
    assert(argc==3);
    FILE *f=fopen(argv[1],"rb");assert(f && !fseek(f,0,SEEK_END));long n=ftell(f);
    assert(n>0 && n<1024*1024 && !fseek(f,0,SEEK_SET));uint8_t *bytes=malloc((size_t)n);
    assert(bytes && fread(bytes,1,(size_t)n,f)==(size_t)n);fclose(f);
    wasm_config_t *config=wasm_config_new();wasmtime_config_wasm_component_model_set(config,true);
    wasm_engine_t *engine=wasm_engine_new_with_config(config);
    wasmtime_component_t *component=NULL;ok(wasmtime_component_new(engine,bytes,(size_t)n,&component));free(bytes);
    wasmtime_component_linker_t *linker=wasmtime_component_linker_new(engine);
    wasmtime_store_t *one=wasmtime_store_new(engine,NULL,NULL),*two=wasmtime_store_new(engine,NULL,NULL);
    session s={0},sibling={0},other={0};open_instance(&s,wasmtime_store_context(one),linker,component,argv[2]);
    open_instance(&sibling,wasmtime_store_context(one),linker,component,argv[2]);
    open_instance(&other,wasmtime_store_context(two),linker,component,argv[2]);
    workers(&s);
    lwit_owner first={0},alias={0},foreign={0},wrong_kind={0};bool equal=false;
    new_box(&s,7,&first);new_box(&sibling,7,&wrong_kind);new_box(&other,7,&foreign);
    refused(lwit_same(&s.box,&first,&foreign,&equal));refused(lwit_retain(&s.box,&wrong_kind,&alias));
    assert(!equal && !s.store.failed && !alias.any);
    ok(lwit_retain(&s.second_binding,&first,&alias));ok(lwit_same(&s.box,&alias,&first,&equal));assert(equal);
    V borrowed=resource(&first),peer_reply=invoke(&s,"relay-box",&borrowed,1,true);
    lwit_owner peer_alias={0};assert(lwit_take(&s.store,&s.box,&peer_reply,&peer_alias));
    ok(lwit_same(&s.box,&first,&peer_alias,&equal));assert(equal);ok(lwit_drop(&peer_alias));
    V invalid=u32(UINT32_MAX),v=invoke(&s,"[static]box.create",&invalid,1,false);
    assert(v.kind==WASMTIME_COMPONENT_RESULT && !v.of.result.is_ok);
    lwit_owner untouched={0};assert(!lwit_take(&s.store,&s.box,v.of.result.val,&untouched));
    V msg=invoke(&s,"[method]member-error.message",v.of.result.val,1,false);
    assert(msg.kind==WASMTIME_COMPONENT_STRING && msg.of.string.size==11 && !memcmp(msg.of.string.data,"invalid box",11));
    wasmtime_component_val_delete(&msg);ok(wasmtime_component_resource_any_drop(s.store.ctx,v.of.result.val->of.resource));
    wasmtime_component_val_delete(&v);
    uint32_t before=drops(&s);ok(lwit_drop(&first));ok(lwit_drop(&first));assert(drops(&s)==before+1);
    ok(lwit_drop(&alias));assert(drops(&s)==before+2);
    new_box(&s,11,&first);new_box(&s,12,&alias);close_instance(&s);assert(!first.any && !alias.any);
    close_instance(&sibling);
    new_box(&other,99,&alias);
    wasmtime_component_func_t arm;assert(lwit_lookup(&other.store,NULL,"arm-drop",&arm));
    ok(wasmtime_component_func_call(&arm,other.store.ctx,NULL,0,NULL,0));
    refused(lwit_drop(&alias));assert(other.store.failed && !alias.any);
    refused(lwit_retain(&other.box,&foreign,&alias));assert(!lwit_lookup(&other.store,NULL,"drops",&arm));
    close_instance(&other);assert(!foreign.any);
    wasmtime_store_delete(one);wasmtime_store_delete(two);ok(lwit_drop(&first));ok(lwit_drop(&wrong_kind));ok(lwit_drop(&foreign));
    wasmtime_component_linker_delete(linker);wasmtime_component_delete(component);wasm_engine_delete(engine);
    puts("guest-owned object survived a compiled Lean worker");
}
