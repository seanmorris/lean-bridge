/* A genuine async Wasm caller, a single native Lean owner, and the original
 * Workshop.update (setLevel then getLevel). No Wasmtime call runs on the Lean
 * owner. This probe covers one signature, not the installed async API. */
#include "application-turn.h"
#include "public.h"
#include <wasmtime.h>
#include <assert.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

enum { UPDATE=1,SET=2,GET=3,RESULT=4,MEMBER_ERROR=5 };
typedef struct { lb_wit_turns turns; workshop_binding binding; bool bound; unsigned drops,sets,gets; } session;
typedef struct { session *s; } box_arg;
static void dispose(void *p){++((box_arg *)p)->s->drops;}
static uint32_t member(void *ctx,workshop_box box,unsigned op,uint32_t arg,uint32_t *out){
    session *s=ctx;void *p=NULL;assert(workshop_box_data(box,&p)==workshop_OK && ((box_arg *)p)->s==s);
    lb_wit_message msg={0};
    if(op==GET)++s->gets;else ++s->sets;
    if(!lb_wit_turn_request(&s->turns,(lb_wit_message){op,{arg}},&msg))return 97;
    if(msg.op==MEMBER_ERROR)return 77;
    assert(msg.op==RESULT);
    if(out)*out=(uint32_t)msg.words[0];
    return 0;
}
static uint32_t get(void *c,workshop_box b,uint32_t *o){return member(c,b,GET,0,o);}
static uint32_t set(void *c,workshop_box b,uint32_t a){return member(c,b,SET,a,NULL);}
/* Well-typed sentinels for methods the source never calls. */
static uint32_t make(void *c,uint32_t a,workshop_box *o){(void)c;(void)a;(void)o;abort();}
static uint32_t own(void *c,workshop_box a,workshop_box *o){(void)c;(void)a;(void)o;abort();}
static uint32_t pair(void *c,workshop_box a,workshop_box b,workshop_box *o){(void)b;return own(c,a,o);}
static uint32_t bytes(void *c,workshop_box a,workshop_view v,workshop_buffer *o){(void)c;(void)a;(void)v;(void)o;abort();}
static uint32_t integer(void *c,workshop_box a,workshop_integer_view v,workshop_integer *o){(void)c;(void)a;(void)v;(void)o;abort();}
static bool enter(lb_wit_turns *turns,void *ctx,lb_wit_message arg,lb_wit_message *out){
    session *s=ctx;assert(turns==&s->turns && arg.op==UPDATE);
    if(!s->bound){
        workshop_hosts h={.box_read=get,.box_get_level=get,.box_set_level=set,.box_create=make,.box_identity=own,
            .box_anchored=own,.box_keep_other=pair,.box_take_other=pair,.box_echo_text=bytes,.box_echo_bytes=bytes,.box_shift=integer};
        assert(workshop_with_hosts(&h,s,&s->binding)==workshop_OK);s->bound=true;
    }
    box_arg borrowed={s};workshop_box box={0};workshop_diagnostic d={0};uint32_t n=0;
    assert(workshop_box_adopt(&borrowed,dispose,&box)==workshop_OK);
    workshop_status status=workshop_update(s->binding,box,(uint32_t)arg.words[0],&n,&d);
    assert(workshop_box_drop(&box)==workshop_OK);
    bool ok=status==workshop_OK || (status==workshop_HOST_ERROR && d.host_code==77);
    *out=(lb_wit_message){status==workshop_OK?RESULT:MEMBER_ERROR,{n}};
    workshop_diagnostic_clear(&d);return ok;
}
static void finish(void *ctx){
    session *s=ctx;if(s->bound){assert(workshop_close(&s->binding)==workshop_OK);s->bound=false;}
}
static void check(wasmtime_error_t *e){
    if(!e)return;
    wasm_name_t m;wasmtime_error_message(e,&m);fprintf(stderr,"%.*s\n",(int)m.size,m.data);
    wasm_name_delete(&m);wasmtime_error_delete(e);abort();
}
typedef struct { session s; lb_wit_ticket current; } host;
static wasmtime_error_t *bridge(void *ptr,wasmtime_context_t *ctx,const wasmtime_component_func_type_t *ft,
    wasmtime_component_val_t *in,size_t argc,wasmtime_component_val_t *out,size_t retc){
    (void)ctx;(void)ft;host *h=ptr;assert(argc==1 && retc==1 && in->kind==WASMTIME_COMPONENT_U64);
    uint64_t word=in->of.u64;lb_wit_message m={(uint32_t)(word>>32),{(uint32_t)word}};lb_wit_event e={0};
    bool ok=m.op==UPDATE?lb_wit_turn_begin(&h->s.turns,m,&e):lb_wit_turn_reply(&h->s.turns,h->current,m,&e);
    if(!ok)return wasmtime_error_new("invalid native owner turn");
    assert(e.done==(e.message.op==RESULT || e.message.op==MEMBER_ERROR));h->current=e.ticket;
    *out=(wasmtime_component_val_t){.kind=WASMTIME_COMPONENT_U64,.of.u64=((uint64_t)e.message.op<<32)|e.message.words[0]};
    return NULL;
}
static bool protocol(lb_wit_turns *s,void *arg){
    (void)arg;lb_wit_turns foreign={0};lb_wit_event p={0},child={0},v={0};
    lb_wit_message call={UPDATE,{73}},reply={RESULT,{73}};
    assert(lb_wit_turn_begin(s,call,&p) && p.message.op==SET);
    assert(lb_wit_turn_begin(s,call,&child) && child.message.op==SET);
    assert(!lb_wit_turn_reply(s,p.ticket,reply,&v));
    assert(!lb_wit_turn_reply(s,(lb_wit_ticket){&foreign,child.ticket.id},reply,&v));
    assert(lb_wit_turn_reply(s,child.ticket,reply,&v) && v.message.op==GET);
    assert(lb_wit_turn_reply(s,child.ticket,reply,&v) && v.done && v.message.words[0]==73);
    assert(!lb_wit_turn_reply(s,child.ticket,reply,&v));
    assert(lb_wit_turn_reply(s,p.ticket,reply,&v) && v.message.op==GET);
    /* Stop in a second nested setter, before either frame can resume. */
    assert(lb_wit_turn_begin(s,call,&v) && v.message.op==SET);
    return lb_wit_turn_retire(s);
}
typedef struct {host *h;const char *wasm;bool trap;} input;
static bool application(lb_wit_turns *s,void *ptr){
    input *in=ptr;host *h=in->h;assert(s==&h->s.turns);
    wasm_config_t *cfg=wasm_config_new();wasmtime_config_wasm_component_model_set(cfg,true);
    wasmtime_config_wasm_component_model_async_set(cfg,true);wasmtime_config_wasm_component_model_more_async_builtins_set(cfg,true);
    wasm_engine_t *engine=wasm_engine_new_with_config(cfg);wasmtime_store_t *store=wasmtime_store_new(engine,NULL,NULL);
    wasmtime_component_linker_t *link=wasmtime_component_linker_new(engine);
    wasmtime_component_linker_instance_t *root=wasmtime_component_linker_root(link);
    check(wasmtime_component_linker_instance_add_func(root,"turn",4,bridge,h,NULL));wasmtime_component_linker_instance_delete(root);
    FILE *f=fopen(in->wasm,"rb");assert(f && !fseek(f,0,SEEK_END));long n=ftell(f);assert(n>0 && !fseek(f,0,SEEK_SET));
    uint8_t *b=malloc((size_t)n);assert(b && fread(b,1,(size_t)n,f)==(size_t)n);fclose(f);
    wasmtime_component_t *c=NULL;check(wasmtime_component_new(engine,b,n,&c));free(b);
    wasmtime_context_t *ctx=wasmtime_store_context(store);wasmtime_component_instance_t instance;
    check(wasmtime_component_linker_instantiate(link,ctx,c,&instance));
    wasmtime_component_export_index_t *idx=wasmtime_component_instance_get_export_index(&instance,ctx,NULL,"run",3);
    wasmtime_component_func_t run;assert(idx && wasmtime_component_instance_get_func(&instance,ctx,idx,&run));
    wasmtime_component_export_index_delete(idx);wasmtime_error_t *err=NULL;wasmtime_component_val_t value={0};
    wasmtime_call_future_t *fut=wasmtime_component_func_call_async(&run,ctx,NULL,0,&value,1,&err);
    assert(fut);struct timespec begin,now,pause={0,1000000};assert(!clock_gettime(CLOCK_MONOTONIC,&begin));
    while(!wasmtime_call_future_poll(fut)){
        assert(!clock_gettime(CLOCK_MONOTONIC,&now) && now.tv_sec-begin.tv_sec<20);nanosleep(&pause,NULL);
    }
    wasmtime_call_future_delete(fut);
    if(in->trap){
        assert(err);wasm_name_t m;wasmtime_error_message(err,&m);
        const char reason[]="unreachable";bool found=false;
        for(size_t i=0;i+sizeof(reason)-1<=m.size;i++)if(!memcmp(m.data+i,reason,sizeof(reason)-1)){found=true;break;}
        assert(found);wasm_name_delete(&m);wasmtime_error_delete(err);
    }else{
        check(err);assert(value.kind==WASMTIME_COMPONENT_S64 && value.of.s64==73);
    }
    assert(lb_wit_turn_retire(s));
    wasmtime_component_delete(c);wasmtime_component_linker_delete(link);wasmtime_store_delete(store);wasm_engine_delete(engine);
    return true;
}
int main(int argc,char **argv){
    assert(argc==3);session trial={0};assert(lb_wit_turn_run(&trial.turns,enter,finish,&trial,protocol,NULL));
    assert(!trial.bound && trial.drops==3 && trial.sets==3 && trial.gets==2);
    host h={0};input in={&h,argv[1],false};assert(lb_wit_turn_run(&h.s.turns,enter,finish,&h.s,application,&in));
    assert(!h.s.bound && h.s.drops==2 && h.s.sets==2 && h.s.gets==2);
    puts("async guest: original box 42 -> 73; original getter error; two Lean frames disposed");
    host failed={0};input trap={&failed,argv[2],true};
    assert(lb_wit_turn_run(&failed.s.turns,enter,finish,&failed.s,application,&trap));
    assert(!failed.s.bound && failed.s.drops==1 && failed.s.sets==1 && !failed.s.gets);
    puts("trapped async guest: parked Lean call unwound once on its owner before store destruction");
}
