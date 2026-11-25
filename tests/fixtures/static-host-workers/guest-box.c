/* Integration fixture for the private Wasmtime adapter and compiled Lean
 * worker. Consumers of a released package must not implement this plumbing. */
#include "application-operations.h"
#include <assert.h>
#include <poll.h>
#include <stdio.h>
#include <stdlib.h>

typedef wasmtime_component_val_t V;
typedef struct {
    lwit_store store;
    lwit_members checked;
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
static V checked(session *s,const wasmtime_component_func_t *f,V *args,size_t n){
    assert(lwit_open(&s->store));V v={0};ok(wasmtime_component_func_call(f,s->store.ctx,args,n,&v,1));return v;
}
static V result(session *s,const wasmtime_component_func_t *f,V *args,size_t n){
    V v=checked(s,f,args,n);
    assert(v.kind==WASMTIME_COMPONENT_RESULT && v.of.result.is_ok);return v;
}
static void open_instance(session *s,wasmtime_context_t *ctx,wasmtime_component_linker_t *l,
                          wasmtime_component_t *c,const char *iface){
    s->store.ctx=ctx;
    ok(wasmtime_component_linker_instantiate(l,ctx,c,&s->store.instance));
    s->scope=wasmtime_component_instance_get_export_index(&s->store.instance,ctx,NULL,iface,strlen(iface));
    assert(s->scope);
    assert(lwit_members_bind(&s->store,&s->checked));
    assert(!lwit_members_bind(&s->store,&s->checked));
    assert(!lwit_class_bind(&s->store,s->scope,"same-box","retain-box",&s->box));
    assert(lwit_class_bind(&s->store,s->scope,"retain-box","same-box",&s->box));
    assert(lwit_class_bind(&s->store,s->scope,"retain-box","same-box",&s->second_binding));
}
static void close_instance(session *s){
    ok(lwit_shutdown(&s->store));
    lwit_members_clear(&s->checked);
    lwit_class_clear(&s->box);lwit_class_clear(&s->second_binding);
    wasmtime_component_export_index_delete(s->scope);
}
static uint32_t drops(session *s){V v=invoke(s,"drops",NULL,0,true);assert(v.kind==WASMTIME_COMPONENT_U32);return v.of.u32;}
#include "lean-consumer.h"
#ifdef LB_TEST_OBJECT_FUTURE
#include "lean-future-consumer.h"
#endif
static void new_box(session *s,uint32_t n,lwit_owner *out){
    V arg=u32(n),v=result(s,&s->checked.on_box.m_create,&arg,1);
    assert(lwit_take(&s->store,&s->box,v.of.result.val,out));wasmtime_component_val_delete(&v);
}
typedef struct {session *s;lwit_bridge *bridge;unsigned visits;} callback;
static workshop_status relay(void *ctx,workshop_box box,workshop_box *out,workshop_diagnostic *d){
    callback *c=ctx;uint32_t observed=0;
    assert(lwit_is(&c->s->second_binding,lwit_from_box(&c->bridge->members,box)));
    lwit_owner error={0};assert(lwit_sync_update(c->bridge,box,73,&observed,&error,d)==workshop_OK && observed==73 && !error.any);
    c->visits++;return workshop_box_clone(box,out);
}
static void multiple_errors(session *s,lwit_bridge *bridge){
    lwit_owner error={0};workshop_box out={0};workshop_diagnostic d={0};
    for(unsigned i=0;i<2;i++){
        uint32_t a=i?UINT32_MAX-1:UINT32_MAX,b=i?UINT32_MAX:UINT32_MAX-1,before=drops(s);
        assert(lwit_sync_first_error(bridge,a,b,&out,&error,&d)==workshop_HOST_ERROR);
        assert(error.any && !d.host_code && drops(s)==before+1);
        V arg=resource(&error),msg=checked(s,&bridge->members.message,&arg,1);
        assert(msg.kind==WASMTIME_COMPONENT_STRING && msg.of.string.size==11);
        assert(!memcmp(msg.of.string.data,i?"other error":"invalid box",11));
        wasmtime_component_val_delete(&msg);ok(lwit_drop(&error));assert(drops(s)==before+2);
    }
}
static void values(lwit_bridge *bridge,workshop_box a,workshop_box other){
    lwit_owner error={0};workshop_diagnostic d={0};workshop_buffer bytes={0};
    const uint8_t text[]="snow \xe2\x98\x83";workshop_view utf={text,sizeof text-1};
    assert(lwit_sync_text(bridge,a,utf,&bytes,&error,&d)==workshop_OK);
    assert(bytes.len==utf.len && !memcmp(bytes.data,text,utf.len));workshop_buffer_clear(&bytes);
    const uint8_t raw[]={255,0,1,0,7};workshop_view blob={raw,sizeof raw};
    assert(lwit_sync_bytes(bridge,a,blob,&bytes,&error,&d)==workshop_OK);
    assert(bytes.len==sizeof raw && !memcmp(bytes.data,raw,bytes.len));workshop_buffer_clear(&bytes);
    uint64_t limbs[7]={UINT64_MAX,42,0,0,0,0,1};workshop_integer_view large={limbs,7,true};workshop_integer result={0};
    assert(lwit_sync_shift(bridge,a,large,&result,&error,&d)==workshop_OK);
    assert(result.negative && result.len==7 && !memcmp(result.data,limbs,sizeof limbs));workshop_integer_clear(&result);
    workshop_box alias={0};bool same=false;
    assert(lwit_sync_keep_other(bridge,a,other,&alias,&error,&d)==workshop_OK);
    assert(workshop_box_same(other,alias,&same)==workshop_OK && same);workshop_box_drop(&alias);
    assert(lwit_sync_take_other(bridge,a,other,&alias,&error,&d)==workshop_OK);
    assert(workshop_box_same(other,alias,&same)==workshop_OK && same);workshop_box_drop(&alias);
    assert(lwit_sync_anchored(bridge,a,&alias,&error,&d)==workshop_OK);
    assert(workshop_box_same(a,alias,&same)==workshop_OK && same);workshop_box_drop(&alias);
    /* A valid native ticket can still refer to another integration. Reject
     * it before guest entry; do not interpret the payload as a WIT slot. */
    int opaque=0;workshop_box alien={0};uint32_t untouched=123;
    assert(workshop_box_adopt(&opaque,NULL,&alien)==workshop_OK);
    assert(lwit_sync_read(bridge,alien,&untouched,&error,&d)==workshop_INVALID && untouched==123 && !error.any);
    assert(workshop_box_drop(&alien)==workshop_OK);
    assert(lwit_sync_read(bridge,a,&untouched,&error,&d)==workshop_OK && untouched==42);
}
#define READY(fn,h) do { \
    workshop_status state;int fd=-1;unsigned attempts=0; \
    while((state=workshop_##fn##_poll(h,&fd))==workshop_PENDING){ \
        struct pollfd p={.fd=fd,.events=POLLIN};assert(fd>=0 && ++attempts<100 && poll(&p,1,5000)==1); \
    }assert(state==workshop_OK); \
} while(0)
static void workers(session *s){
    lwit_bridge bridge={0};assert(lwit_bridge_open(&s->store,&bridge));
    workshop_binding b=bridge.binding;workshop_box a={0},other={0},returned={0};workshop_diagnostic d={0};lwit_owner error={0};
    assert(lwit_sync_make(&bridge,UINT32_MAX,&returned,&error,&d)==workshop_HOST_ERROR && error.any && !d.host_code);
    V err=resource(&error),msg=checked(s,&s->checked.message,&err,1);
    assert(msg.kind==WASMTIME_COMPONENT_STRING && msg.of.string.size==11 && !memcmp(msg.of.string.data,"invalid box",11));
    wasmtime_component_val_delete(&msg);ok(lwit_drop(&error));
    multiple_errors(s,&bridge);
    assert(lwit_sync_make(&bridge,64206,&returned,&error,&d)==workshop_OK);
    uint32_t sentinel=12345;workshop_buffer mapped={0};uint32_t mark=drops(s);
    assert(lwit_sync_mapped(&bridge,returned,&sentinel,&mapped,&error,&d)==workshop_DECLARED_ERROR);
    assert(sentinel==12345 && !error.any && mapped.len==16 && !memcmp(mapped.data,"host read failed",16));
    assert(drops(s)==mark+1);workshop_buffer_clear(&mapped);workshop_box_drop(&returned);
    uint32_t before=drops(s);bool same=true;
    assert(lwit_sync_make(&bridge,42,&a,&error,&d)==workshop_OK && lwit_sync_make(&bridge,42,&other,&error,&d)==workshop_OK);
    ok(lwit_same(&s->box,lwit_from_box(&bridge.members,a),lwit_from_box(&bridge.members,other),&same));assert(!same);
    values(&bridge,a,other);assert(drops(s)==before+3);before=drops(s);
    workshop_echo_handle h={0};assert(workshop_echo_start(b,a,&h,&d)==workshop_OK);
    READY(echo,h);assert(workshop_echo_take(&h,&returned,&d)==workshop_OK);
    ok(lwit_same(&s->box,lwit_from_box(&bridge.members,a),lwit_from_box(&bridge.members,returned),&same));assert(same);
    assert(workshop_box_drop(&returned)==workshop_OK);
    workshop_relay_handle job={0};workshop_callback_box_to_box cb={0};callback state={.s=s,.bridge=&bridge};
    assert(workshop_callback_box_to_box_new(relay,&state,NULL,&cb)==workshop_OK);
    assert(workshop_relay_start(b,a,cb,&job,&d)==workshop_OK);assert(workshop_callback_box_to_box_drop(&cb)==workshop_OK);
    READY(relay,job);assert(workshop_relay_take(&job,&returned,&d)==workshop_OK && state.visits==1);
    assert(workshop_box_drop(&returned)==workshop_OK);
    uint32_t n=0;assert(lwit_sync_read(&bridge,a,&n,&error,&d)==workshop_OK && n==73);
    assert(lwit_sync_read(&bridge,other,&n,&error,&d)==workshop_OK && n==42);
    assert(lwit_sync_identity(&bridge,a,&returned,&error,&d)==workshop_OK);
    assert(workshop_box_same(a,returned,&same)==workshop_OK && same);
    assert(workshop_box_drop(&a)==workshop_OK && workshop_box_drop(&other)==workshop_OK);
    assert(drops(s)==before+2);assert(workshop_box_drop(&returned)==workshop_OK);
    assert(drops(s)==before+3 && !s->store.owners);
    assert(lwit_bridge_close(&bridge)==workshop_OK);
}
static wasmtime_component_t *load_component(wasm_engine_t *engine,const char *path){
    FILE *f=fopen(path,"rb");assert(f && !fseek(f,0,SEEK_END));long n=ftell(f);
    assert(n>0 && n<1024*1024 && !fseek(f,0,SEEK_SET));uint8_t *bytes=malloc((size_t)n);
    assert(bytes && fread(bytes,1,(size_t)n,f)==(size_t)n);fclose(f);
    wasmtime_component_t *component=NULL;ok(wasmtime_component_new(engine,bytes,(size_t)n,&component));free(bytes);
    return component;
}
int main(int argc,char **argv){
    assert(argc==6);
    wasm_config_t *config=wasm_config_new();wasmtime_config_wasm_component_model_set(config,true);
#ifdef LB_TEST_OBJECT_FUTURE
    wasmtime_config_wasm_component_model_async_set(config,true);
    wasmtime_config_wasm_component_model_more_async_builtins_set(config,true);
#endif
    wasm_engine_t *engine=wasm_engine_new_with_config(config);
    wasmtime_component_t *graph=load_component(engine,"client-graph.wasm");
    guest_calls_lean(engine,graph,false);guest_calls_lean(engine,graph,true);wasmtime_component_delete(graph);
#ifdef LB_TEST_OBJECT_FUTURE
    graph=load_component(engine,"future-graph.wasm");for(unsigned scenario=0;scenario<3;scenario++)guest_futures(engine,graph,scenario);wasmtime_component_delete(graph);
#endif
    wasmtime_component_t *component=load_component(engine,argv[1]);
    wasmtime_component_linker_t *linker=wasmtime_component_linker_new(engine);
    wasmtime_store_t *one=wasmtime_store_new(engine,NULL,NULL),*two=wasmtime_store_new(engine,NULL,NULL);
    for(int i=3;i<argc;i++){
        wasmtime_component_t *mismatch=load_component(engine,argv[i]);
        lwit_store rejected={.ctx=wasmtime_store_context(two)};lwit_members table={0};
        ok(wasmtime_component_linker_instantiate(linker,rejected.ctx,mismatch,&rejected.instance));
        assert(!lwit_members_bind(&rejected,&table) && !table.store && !table.error);
        assert(!rejected.failed && !rejected.owners);ok(lwit_shutdown(&rejected));wasmtime_component_delete(mismatch);
    }
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
    V invalid=u32(UINT32_MAX),v=checked(&s,&s.checked.on_box.m_create,&invalid,1);
    assert(v.kind==WASMTIME_COMPONENT_RESULT && !v.of.result.is_ok);
    lwit_owner untouched={0};assert(!lwit_take(&s.store,&s.box,v.of.result.val,&untouched));
    V msg=checked(&s,&s.checked.message,v.of.result.val,1);
    assert(msg.kind==WASMTIME_COMPONENT_STRING && msg.of.string.size==11 && !memcmp(msg.of.string.data,"invalid box",11));
    wasmtime_component_val_delete(&msg);ok(wasmtime_component_resource_any_drop(s.store.ctx,v.of.result.val->of.resource));
    wasmtime_component_val_delete(&v);
    uint32_t before=drops(&s);ok(lwit_drop(&first));ok(lwit_drop(&first));assert(drops(&s)==before+1);
    ok(lwit_drop(&alias));assert(drops(&s)==before+2);
    new_box(&s,11,&first);new_box(&s,12,&alias);
    wasmtime_component_func_t audit;assert(lwit_lookup(&s.store,NULL,"drops",&audit));
    before=drops(&s);close_instance(&s);assert(!first.any && !alias.any);
    /* Inspect the guest independently before deleting its underlying store.
     * Clearing the native slot alone does not prove its destructor ran. */
    V after={0};ok(wasmtime_component_func_call(&audit,wasmtime_store_context(one),NULL,0,&after,1));
    assert(after.kind==WASMTIME_COMPONENT_U32 && after.of.u32==before+2);
    close_instance(&sibling);
    lwit_bridge poisoned={0};assert(lwit_bridge_open(&other.store,&poisoned));
    workshop_box held={0},unchanged={0};workshop_diagnostic d={0};lwit_owner original_error={0},duplicate={0};
    assert(lwit_sync_make(&poisoned,15,&held,&original_error,&d)==workshop_OK);
    ok(lwit_export_box(&poisoned,held,&duplicate));
    new_box(&other,99,&alias);
    wasmtime_component_func_t arm;assert(lwit_lookup(&other.store,NULL,"arm-drop",&arm));
    ok(wasmtime_component_func_call(&arm,other.store.ctx,NULL,0,NULL,0));
    /* Duplicate interning tentatively obtains a native ticket, then drops
     * the redundant owner. A trap must roll back the provisional ticket. */
    assert(!lwit_import_box(&poisoned,&duplicate,&unchanged) && other.store.failed);
    assert(!duplicate.any && !unchanged._private[0] && !unchanged._private[1]);
    assert(workshop_box_drop(&held)==workshop_OK);
    for(lwit_owner *slot=other.store.owners;slot;slot=slot->next)assert(!slot->box);
    ok(lwit_drop(&alias));assert(!alias.any);
    refused(lwit_retain(&other.box,&foreign,&alias));assert(!lwit_lookup(&other.store,NULL,"drops",&arm));
    assert(lwit_bridge_close(&poisoned)==workshop_OK);
    close_instance(&other);assert(!foreign.any);
    wasmtime_store_delete(one);wasmtime_store_delete(two);ok(lwit_drop(&first));ok(lwit_drop(&wrong_kind));ok(lwit_drop(&foreign));
    wasmtime_component_linker_delete(linker);wasmtime_component_delete(component);wasm_engine_delete(engine);
    puts("guest-owned object survived a compiled Lean worker");
}
