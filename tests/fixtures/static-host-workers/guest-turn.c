/* A genuine async Wasm caller, a single native Lean owner, and the original
 * Workshop.update (setLevel then getLevel). No Wasmtime call runs on the Lean
 * owner. The mixed probe runs the full facade and the async task suite. */
#include "application-turn.h"
#include "public.h"
#include "application-turn-tasks.h"
#include "application-turn-sync-host.h"
#include <poll.h>
#include <wasmtime.h>
#include <assert.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

enum { UPDATE=1,SET=2,GET=3,RESULT=4,MEMBER_ERROR=5 };
typedef struct { lb_wit_turns turns; workshop_binding binding; bool bound,audit_aliases; unsigned drops,sets,gets,starts,pulls,closes;
    lb_tc_refs refs;lb_tg_native tasks;lb_ts_bus sync;bool sync_host; } session;
typedef struct { session *s; uint64_t ticket,fault; } box_arg;
static void dispose(void *p){++((box_arg *)p)->s->drops;}
static uint32_t member(void *ctx,workshop_box box,unsigned op,uint32_t arg,uint32_t *out){
    session *s=ctx;void *p=NULL;assert(workshop_box_data(box,&p)==workshop_OK && ((box_arg *)p)->s==s);
    lb_wit_message msg={0};
    if(op==GET)++s->gets;else ++s->sets;
    box_arg *owner=p;
    if(!lb_wit_turn_request(&s->turns,(lb_wit_message){op,{arg,owner->ticket}},&msg))return 97;
    if(msg.op==MEMBER_ERROR){assert(msg.words[1]);owner->fault=msg.words[1];return 77;}
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
    session *s=ctx;assert(turns==&s->turns);
    if(arg.op==242){
        assert(s->bound && workshop_close(&s->binding)==workshop_OK);s->bound=false;*out=(lb_wit_message){0};return true;
    }
    bool task=lb_tg_contains(arg.op);unsigned ch=task?(arg.op-LB_TG_BASE)/16:0,op=task?(arg.op-LB_TG_BASE)%16:0;
    bool cursor=task && lb_tg_specs[ch].kind==LB_TG_STREAM,drain=task && op==(cursor?LB_TC_DRAIN:LB_TF_DRAIN);
    if(s->sync_host && !drain && !s->bound){
        s->refs.turns=turns;s->sync.refs=&s->refs;assert(workshop_with_hosts(&lb_ts_hosts,&s->sync,&s->binding)==workshop_OK);s->bound=true;s->sync_host=true;
    }
    if(arg.op==LB_TS_ENTER){assert(s->sync_host);return lb_ts_dispatch(&s->sync,s->binding,arg,out);}
    if(!s->bound && !drain){
        workshop_hosts h={.box_read=get,.box_get_level=get,.box_set_level=set,.box_create=make,.box_identity=own,
            .box_anchored=own,.box_keep_other=pair,.box_take_other=pair,.box_echo_text=bytes,.box_echo_bytes=bytes,.box_shift=integer};
        assert(workshop_with_hosts(&h,s,&s->binding)==workshop_OK);s->bound=true;
    }
    if(arg.op==241){
        workshop_diagnostic d={0};uint64_t counts=0;
        assert(workshop_cursor_counts(s->binding,&counts,&d)==workshop_OK);
        workshop_diagnostic_clear(&d);*out=(lb_wit_message){.words={counts}};return true;
    }
    if(arg.op==240){
        workshop_diagnostic d={0};uint32_t outval=0;
        assert(workshop_cursor_gate(s->binding,arg.words[0]!=0,&outval,&d)==workshop_OK);
        workshop_diagnostic_clear(&d);*out=(lb_wit_message){0};return true;
    }
    if(task){
        s->refs.turns=turns;
        if(cursor){if(op==LB_TC_OPEN)++s->starts;else if(op==LB_TC_PULL)++s->pulls;else if(op==LB_TC_CLOSE)++s->closes;}
        bool ok=lb_tg_dispatch(&s->tasks,&s->refs,s->binding,arg,out);
        if(ok && cursor && op==LB_TC_OPEN && s->audit_aliases){
            unsigned live=0;for(unsigned i=0;i<256;i++)if(s->refs.rows[i].state==LB_TC_LIVE)++live;
            const unsigned counts[]={1,2,2,3};assert(s->starts<=4 && live==counts[s->starts-1]);
        }
        return ok;
    }
    assert(arg.op==UPDATE);
    box_arg borrowed={.s=s,.ticket=arg.words[1]};workshop_box box={0};workshop_diagnostic d={0};uint32_t n=0;
    assert(workshop_box_adopt(&borrowed,dispose,&box)==workshop_OK);
    workshop_status status=workshop_update(s->binding,box,(uint32_t)arg.words[0],&n,&d);
    assert(workshop_box_drop(&box)==workshop_OK);
    bool ok=status==workshop_OK || (status==workshop_HOST_ERROR && d.host_code==77);
    *out=(lb_wit_message){status==workshop_OK?RESULT:MEMBER_ERROR,{n,borrowed.fault}};
    workshop_diagnostic_clear(&d);return ok;
}
static void finish(void *ctx){
    session *s=ctx;assert(lb_tg_shutdown(&s->tasks));
    if(s->bound){assert(workshop_close(&s->binding)==workshop_OK);s->bound=false;}
}
static void check(wasmtime_error_t *e){
    if(!e)return;
    wasm_name_t m;wasmtime_error_message(e,&m);fprintf(stderr,"%.*s\n",(int)m.size,m.data);
    wasm_name_delete(&m);wasmtime_error_delete(e);abort();
}
typedef struct { session s; lb_wit_ticket current; lb_tg_store tasks;lb_ts_linker sync;bool waited; } host;
static wasmtime_error_t *bridge(void *ptr,wasmtime_context_t *ctx,const wasmtime_component_func_type_t *ft,
    wasmtime_component_val_t *in,size_t argc,wasmtime_component_val_t *out,size_t retc){
    (void)ctx;(void)ft;host *h=ptr;assert(argc==2 && retc==1 && in->kind==WASMTIME_COMPONENT_U64 && in[1].kind==WASMTIME_COMPONENT_U64);
    uint64_t word=in->of.u64;lb_wit_message m={(uint32_t)(word>>32),{(uint32_t)word,in[1].of.u64}};lb_wit_event e={0};
    bool ok=m.op==UPDATE?lb_wit_turn_begin(&h->s.turns,m,&e):lb_wit_turn_reply(&h->s.turns,h->current,m,&e);
    if(!ok)return wasmtime_error_new("invalid native owner turn");
    assert(e.done==(e.message.op==RESULT || e.message.op==MEMBER_ERROR));h->current=e.ticket;
    *out=(wasmtime_component_val_t){.kind=WASMTIME_COMPONENT_TUPLE};
    wasmtime_component_valtuple_new_uninit(&out->of.tuple,2);
    out->of.tuple.data[0]=(wasmtime_component_val_t){.kind=WASMTIME_COMPONENT_U64,.of.u64=((uint64_t)e.message.op<<32)|e.message.words[0]};
    out->of.tuple.data[1]=(wasmtime_component_val_t){.kind=WASMTIME_COMPONENT_U64,.of.u64=e.message.words[1]};
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
/* Native protocol regression. Deliberately enter the same Lean cursor factory
   while the outer open is parked in the defining owner's comparison. */
static unsigned finish_cursor_event(lb_wit_turns *s,lb_wit_event ev,unsigned *released){
    while(!ev.done){
        assert(ev.message.words[0]==0);
        unsigned reply=0;
        if(ev.message.op==LB_TC_RELEASE){
            uint64_t token=ev.message.words[1];assert(token>=1 && token<=3);
            unsigned bit=1u<<(token-1);assert(!(*released&bit));*released|=bit;reply=1;
        }else assert(ev.message.op==LB_TC_SAME && ev.message.words[1]!=ev.message.words[2]);
        assert(lb_wit_turn_reply(s,ev.ticket,(lb_wit_message){LB_TC_REPLY,{reply}},&ev));
    }
    assert(ev.message.op==LB_TC_DONE);return (unsigned)ev.message.words[0];
}
static bool nested_open(lb_wit_turns *s,void *ctx){
    (void)ctx;unsigned keys[3],released=0;lb_wit_event a={0},b={0},c={0};
    assert(lb_wit_turn_begin(s,(lb_wit_message){lb_tg_code(LB_TG_I_series,LB_TC_OPEN),{0,1}},&a));
    keys[0]=finish_cursor_event(s,a,&released);
    assert(lb_wit_turn_begin(s,(lb_wit_message){lb_tg_code(LB_TG_I_series,LB_TC_OPEN),{0,2}},&b));
    assert(!b.done && b.message.op==LB_TC_SAME);
    assert(lb_wit_turn_begin(s,(lb_wit_message){lb_tg_code(LB_TG_I_series,LB_TC_OPEN),{0,3}},&c));
    keys[2]=finish_cursor_event(s,c,&released);
    keys[1]=finish_cursor_event(s,b,&released);
    assert(keys[0] && keys[1] && keys[2] && keys[0]!=keys[1] && keys[0]!=keys[2] && keys[1]!=keys[2]);
    for(unsigned i=0;i<3;i++){
        assert(lb_wit_turn_begin(s,(lb_wit_message){lb_tg_code(LB_TG_I_series,LB_TC_CLOSE),{keys[i]}},&a));
        assert(finish_cursor_event(s,a,&released)==0);
    }
    assert(lb_wit_turn_begin(s,(lb_wit_message){.op=242},&a) && a.done);
    assert(lb_wit_turn_begin(s,(lb_wit_message){.op=lb_tg_code(LB_TG_I_series,LB_TC_DRAIN)},&a));
    assert(!finish_cursor_event(s,a,&released) && released==7);
    return lb_wit_turn_retire(s);
}
enum scenario {PROPERTY,TRAP,CURSORS,CANCEL,REGISTRATIONS,MIXED,FUTURE_ERROR,FUTURE_TRAP,SYNC_TRAP};
typedef struct {host *h;const char *wasm;enum scenario mode;} input;
static wasmtime_component_func_t lookup(wasmtime_component_instance_t *instance,wasmtime_context_t *ctx,const char *name){
    wasmtime_component_export_index_t *idx=wasmtime_component_instance_get_export_index(instance,ctx,NULL,name,strlen(name));
    wasmtime_component_func_t func;assert(idx && wasmtime_component_instance_get_func(instance,ctx,idx,&func));
    wasmtime_component_export_index_delete(idx);return func;
}
static void step(wasmtime_component_func_t *fn,wasmtime_context_t *ctx){
    wasmtime_error_t *err=NULL;wasmtime_call_future_t *f=wasmtime_component_func_call_async(fn,ctx,NULL,0,NULL,0,&err);
    assert(f);struct timespec delay={0,1000000};unsigned spins=0;
    while(!wasmtime_call_future_poll(f)){assert(++spins<20000);nanosleep(&delay,NULL);}
    wasmtime_call_future_delete(f);check(err);
}
static uint64_t counts(host *h){
    lb_wit_event ev={0};assert(lb_wit_turn_begin(&h->s.turns,(lb_wit_message){.op=241},&ev) && ev.done);return ev.message.words[0];
}
static void streams(host *h,wasmtime_component_instance_t *inst,wasmtime_context_t *ctx,bool cancel){
    wasmtime_component_func_t launch=lookup(inst,ctx,"launch"),tick=lookup(inst,ctx,"tick"),done=lookup(inst,ctx,"done"),take=lookup(inst,ctx,"take");
    lb_tc_port *ports[]={&h->tasks.rows[LB_TG_I_series].stream.port,&h->tasks.rows[LB_TG_I_finite].stream.port};
    wasmtime_component_func_t pumps[]={lookup(inst,ctx,"series-pump"),lookup(inst,ctx,"finite-pump")};
    wasmtime_component_func_t retire[]={lookup(inst,ctx,"series-retire"),lookup(inst,ctx,"finite-retire")};
    lb_wit_event ev={0};assert(lb_wit_turn_begin(&h->s.turns,(lb_wit_message){240,{1}},&ev) && ev.done);
    uint64_t before=counts(h);bool saw_park=false,closed_early=false;
    step(&launch,ctx);wasmtime_component_val_t got={0};struct timespec delay={0,1000000};
    for(unsigned i=0;;i++){
        assert(i<2000);step(&tick,ctx);check(wasmtime_component_func_call(&done,ctx,NULL,0,&got,1));
        assert(got.kind==WASMTIME_COMPONENT_BOOL);if(got.of.boolean)break;
        for(unsigned c=0;c<2;c++)for(unsigned k=0;k<64;k++)if(ports[c]->active[k]){
            int fd=ports[c]->fd[k];
            if(fd>=0){
                struct pollfd pfd={.fd=fd,.events=POLLIN};int ready=poll(&pfd,1,0);assert(ready>=0);
                if(c==1 && !h->waited && !cancel){
                    assert(!ready);bool other=false;for(unsigned j=0;j<64;j++)other|=ports[0]->active[j];
                    if(!other){
                        bool readable=true;check(lb_tg_wait(&h->tasks,0,&readable));assert(!readable);
                        assert(lb_wit_turn_begin(&h->s.turns,(lb_wit_message){.op=240},&ev) && ev.done);
                        check(lb_tg_wait(&h->tasks,5000,&readable));assert(readable);h->waited=true;
                    }
                }
                /* Even an unreadable native descriptor must not conceal a
                   guest cancellation/reader close after this guest turn. */
            }
            wasmtime_component_val_t key={.kind=WASMTIME_COMPONENT_U32,.of.u32=k+1};
            check(wasmtime_component_func_call(&pumps[c],ctx,&key,1,&got,1));
            if(c==1 && ports[c]->fd[k]>=0)saw_park=true;
        }
        if(cancel && saw_park && !closed_early){
            bool finite=false,series=false;for(unsigned k=0;k<64;k++){finite|=ports[1]->active[k];series|=ports[0]->active[k];}
            if(!finite && series){
                assert(counts(h)-before==UINT64_C(0x100000001));closed_early=true;
            }
        }
        nanosleep(&delay,NULL);
    }
    check(wasmtime_component_func_call(&take,ctx,NULL,0,&got,1));assert(got.kind==WASMTIME_COMPONENT_S64 && got.of.s64==73);
    for(unsigned c=0;c<2;c++)for(unsigned k=0;k<64;k++)if(ports[c]->active[k]){
        wasmtime_component_val_t key={.kind=WASMTIME_COMPONENT_U32,.of.u32=k+1};
        check(wasmtime_component_func_call(&retire[c],ctx,&key,1,NULL,0));
    }
    assert(!ports[0]->depth && !ports[1]->depth && saw_park);
    if(cancel){
        assert(closed_early && !h->waited);
        assert(lb_wit_turn_begin(&h->s.turns,(lb_wit_message){.op=240},&ev) && ev.done);
        assert(counts(h)-before==UINT64_C(0x100000001));
    }else assert(h->waited && counts(h)-before==UINT64_C(0x200000001));
    assert(lb_wit_turn_begin(&h->s.turns,(lb_wit_message){.op=242},&ev) && ev.done);
    wasmtime_component_func_t drain=lookup(inst,ctx,"finite-drain");
    check(wasmtime_component_func_call(&drain,ctx,NULL,0,NULL,0));
    wasmtime_component_func_t live=lookup(inst,ctx,"live-owners"),close=lookup(inst,ctx,"close-owners");
    check(wasmtime_component_func_call(&live,ctx,NULL,0,&got,1));assert(got.kind==WASMTIME_COMPONENT_U32 && !got.of.u32);
    check(wasmtime_component_func_call(&close,ctx,NULL,0,NULL,0));
}
#include "guest-turn-relay.h"
#include "guest-turn-members.h"
#include "guest-turn-plain.h"
static void future_cases(host *h,wasmtime_component_instance_t *inst,wasmtime_context_t *ctx,bool trap){
    relay_probe p={h,inst,ctx};wasmtime_component_func_t start=lookup(inst,ctx,"user-begin");
    for(unsigned stepno=0;stepno<(trap?1u:4u);stepno++)for(unsigned mode=trap?4:0;mode<(trap?5u:4u);mode++){
        lb_tf_driver *d=(mode==2 || mode==3)?&h->tasks.rows[LB_TG_I_relay_late].future:&h->tasks.rows[LB_TG_I_relay].future;
        unsigned before=rcount(&p,"visits"),drops=rcount(&p,"cb-drops"),changed=0;RV arg=ru32(mode);
        check(wasmtime_component_func_call(&start,ctx,&arg,1,NULL,0));assert(rcount(&p,"visits")==before && rcount(&p,"cb-drops")==drops+1);
        unsigned i=0;while(i<64 && !d->port.port.active[i])i++;assert(i<64);
        if(stepno==3){wasmtime_component_func_t request=lookup(inst,ctx,"user-request");step(&request,ctx);}
        for(unsigned n=0;;n++){
            assert(n<32 && d->port.port.fd[i]>=0);struct pollfd fd={.fd=d->port.port.fd[i],.events=POLLIN};
            assert(poll(&fd,1,5000)==1 && (fd.revents&(POLLIN|POLLHUP)));if(stepno==2)break;
            wasmtime_error_t *e=lb_tf_advance(d,&changed);
            if(trap){
                assert(e);wasm_name_t msg;wasmtime_error_message(e,&msg);const char cause[]="unreachable";bool found=false;
                for(size_t k=0;k+sizeof cause-1<=msg.size;k++)if(!memcmp(msg.data+k,cause,sizeof cause-1))found=true;
                assert(found);wasm_name_delete(&msg);wasmtime_error_delete(e);return; /* Never re-enter the poisoned store. */
            }
            check(e);if(!d->port.port.active[i] || d->port.delivered[i])break;
        }
        if(stepno!=2)assert(d->port.delivered[i]==(stepno!=3));
        wasmtime_component_func_t end=lookup(inst,ctx,stepno==3?"user-collect":stepno?"user-discard":"user-receive");step(&end,ctx);
        check(lb_tf_reap(d,&changed));assert(!d->port.port.active[i]);
        assert(rcount(&p,"visits")==before+(stepno!=2) && rcount(&p,"cb-drops")==drops+2+(stepno!=2));
    }
    check(lb_tf_retire(&h->tasks.rows[LB_TG_I_relay].future));check(lb_tf_retire(&h->tasks.rows[LB_TG_I_relay_late].future));lb_wit_event ev={0};
    assert(lb_wit_turn_begin(&h->s.turns,(lb_wit_message){.op=242},&ev) && ev.done);
    check(lb_tg_drain(&h->tasks));assert(!rcount(&p,"live-owners"));
    wasmtime_component_func_t close=lookup(inst,ctx,"close-owners");check(wasmtime_component_func_call(&close,ctx,NULL,0,NULL,0));
}
static void run_mixed(host *h,wasmtime_component_instance_t *inst,wasmtime_context_t *ctx){
    wasmtime_component_func_t launch=lookup(inst,ctx,"launch"),tick=lookup(inst,ctx,"tick"),done=lookup(inst,ctx,"done"),take=lookup(inst,ctx,"take");
    wasmtime_component_func_t close=lookup(inst,ctx,"close-owners");
    step(&launch,ctx);RV got={0};unsigned changed=0;
    for(unsigned i=0;;i++){
        assert(i<2000);step(&tick,ctx);check(wasmtime_component_func_call(&done,ctx,NULL,0,&got,1));
        assert(got.kind==WASMTIME_COMPONENT_BOOL);if(got.of.boolean)break;
        unsigned previous=changed;check(lb_tg_advance_all(&h->tasks,&changed));
        if(changed==previous){bool ready=false;check(lb_tg_wait(&h->tasks,5,&ready));}
    }
    check(wasmtime_component_func_call(&take,ctx,NULL,0,&got,1));assert(got.kind==WASMTIME_COMPONENT_S64 && got.of.s64==73 && changed);
    check(lb_tg_retire_all(&h->tasks));plain_cases(h,inst,ctx);
    relay_probe sync={h,inst,ctx};
    RV result=rcall(&sync,NULL,"sync-suite",NULL,0);assert(result.kind==WASMTIME_COMPONENT_U32 && result.of.u32==1);
    RV seeds[]={ru32(42),ru32(73)};
    result=rcall(&sync,NULL,"sync-exercise",seeds,2);assert(result.kind==WASMTIME_COMPONENT_U32 && result.of.u32==73);
    seeds[0]=ru32(UINT32_MAX);seeds[1]=ru32(UINT32_MAX-1);
    result=rcall(&sync,NULL,"sync-exercise",seeds,2);assert(result.kind==WASMTIME_COMPONENT_U32 && result.of.u32=='i');
    seeds[0]=ru32(UINT32_MAX-1);seeds[1]=ru32(UINT32_MAX);
    result=rcall(&sync,NULL,"sync-exercise",seeds,2);assert(result.of.u32=='o');
    result=rcall(&sync,NULL,"sync-counts",NULL,0);assert(result.kind==WASMTIME_COMPONENT_U64 && result.of.u64==counts(h));
    RV hold={.kind=WASMTIME_COMPONENT_BOOL,.of.boolean=false};result=rcall(&sync,NULL,"sync-gate",&hold,1);assert(result.kind==WASMTIME_COMPONENT_U32);
    puts("complete public synchronous facade: 19 compiled operations, 11 defining members, rethrown first failure and 17-argument identity");
    lb_wit_event ev={0};assert(lb_wit_turn_begin(&h->s.turns,(lb_wit_message){.op=242},&ev) && ev.done);
    check(lb_tg_drain(&h->tasks));
    relay_probe p={h,inst,ctx};assert(rcount(&p,"visits")==1 && rcount(&p,"cb-drops")==3 && !rcount(&p,"live-owners"));
    check(wasmtime_component_func_call(&close,ctx,NULL,0,NULL,0));
}
static bool application(lb_wit_turns *s,void *ptr){
    input *in=ptr;host *h=in->h;assert(s==&h->s.turns);
    wasm_config_t *cfg=wasm_config_new();wasmtime_config_wasm_component_model_set(cfg,true);
    wasmtime_config_wasm_component_model_async_set(cfg,true);wasmtime_config_wasm_component_model_more_async_builtins_set(cfg,true);
    wasm_engine_t *engine=wasm_engine_new_with_config(cfg);wasmtime_store_t *store=wasmtime_store_new(engine,NULL,NULL);
    wasmtime_component_linker_t *link=wasmtime_component_linker_new(engine);
    wasmtime_component_linker_instance_t *root=wasmtime_component_linker_root(link);
    if(in->mode>=MIXED){h->s.sync_host=true;check(lb_ts_link(&h->sync,&h->s.sync,s,root));}
    if(in->mode==CURSORS || in->mode==CANCEL || in->mode>=MIXED){
        check(lb_tg_link_all(&h->tasks,root,s));
    }
    if(in->mode!=CURSORS && in->mode!=CANCEL && in->mode<MIXED)check(wasmtime_component_linker_instance_add_func(root,"turn",4,bridge,h,NULL));
    wasmtime_component_linker_instance_delete(root);
    FILE *f=fopen(in->wasm,"rb");assert(f && !fseek(f,0,SEEK_END));long n=ftell(f);assert(n>0 && !fseek(f,0,SEEK_SET));
    uint8_t *b=malloc((size_t)n);assert(b && fread(b,1,(size_t)n,f)==(size_t)n);fclose(f);
    wasmtime_component_t *c=NULL;check(wasmtime_component_new(engine,b,n,&c));free(b);
    wasmtime_context_t *ctx=wasmtime_store_context(store);wasmtime_component_instance_t instance;
    check(wasmtime_component_linker_instantiate(link,ctx,c,&instance));
    wasmtime_component_func_t bind=lookup(&instance,ctx,"bind-owners");
    wasmtime_error_t *err=NULL;wasmtime_component_val_t value={0},domain={.kind=WASMTIME_COMPONENT_U32,.of.u32=19};
    check(wasmtime_component_func_call(&bind,ctx,&domain,1,&value,1));assert(value.kind==WASMTIME_COMPONENT_BOOL && value.of.boolean);
    if(in->mode>=MIXED)assert(lb_tg_open_all(&h->tasks,&instance,ctx));
    if(in->mode==CURSORS || in->mode==CANCEL){streams(h,&instance,ctx,in->mode==CANCEL);goto finished;}
    if(in->mode==REGISTRATIONS){check_members(h,&instance,ctx);run_relays(h,&instance,ctx);goto finished;}
    if(in->mode==MIXED){run_mixed(h,&instance,ctx);goto finished;}
    if(in->mode==SYNC_TRAP){
        wasmtime_component_func_t arm=lookup(&instance,ctx,"arm-sync-trap"),exercise=lookup(&instance,ctx,"sync-exercise");
        step(&arm,ctx);
        RV seeds[]={ru32(UINT32_MAX),ru32(UINT32_MAX-1)},r={0};
        wasmtime_error_t *e=wasmtime_component_func_call(&exercise,ctx,seeds,2,&r,1);
        assert(e && h->sync.ctl.depth==1 && !h->sync.ctl.frames[0].ev.done && h->s.sync.slots[0].occupied);
        wasm_name_t m;wasmtime_error_message(e,&m);bool found=false;const char reason[]="unreachable";
        for(size_t i=0;i+sizeof reason-1<=m.size;i++)if(!memcmp(m.data+i,reason,sizeof reason-1))found=true;
        assert(found);wasm_name_delete(&m);wasmtime_error_delete(e);goto finished;
    }
    if(in->mode>=FUTURE_ERROR){future_cases(h,&instance,ctx,in->mode==FUTURE_TRAP);goto finished;}
    wasmtime_component_func_t run=lookup(&instance,ctx,"run");
    wasmtime_call_future_t *fut=wasmtime_component_func_call_async(&run,ctx,NULL,0,&value,1,&err);
    assert(fut);struct timespec begin,now,pause={0,1000000};assert(!clock_gettime(CLOCK_MONOTONIC,&begin));
    while(!wasmtime_call_future_poll(fut)){
        assert(!clock_gettime(CLOCK_MONOTONIC,&now) && now.tv_sec-begin.tv_sec<20);nanosleep(&pause,NULL);
    }
    wasmtime_call_future_delete(fut);
    if(in->mode==TRAP){
        assert(err);wasm_name_t m;wasmtime_error_message(err,&m);
        const char reason[]="unreachable";bool found=false;
        for(size_t i=0;i+sizeof(reason)-1<=m.size;i++)if(!memcmp(m.data+i,reason,sizeof(reason)-1)){found=true;break;}
        assert(found);wasm_name_delete(&m);wasmtime_error_delete(err);
    }else{
        check(err);assert(value.kind==WASMTIME_COMPONENT_S64 && value.of.s64==73);
        wasmtime_component_func_t live=lookup(&instance,ctx,"live-owners"),close=lookup(&instance,ctx,"close-owners");
        check(wasmtime_component_func_call(&live,ctx,NULL,0,&value,1));assert(value.kind==WASMTIME_COMPONENT_U32 && !value.of.u32);
        wasmtime_component_func_t foreign=lookup(&instance,ctx,"bind-foreign"),audit=lookup(&instance,ctx,"audit");
        domain.of.u32=20;check(wasmtime_component_func_call(&foreign,ctx,&domain,1,&value,1));assert(value.kind==WASMTIME_COMPONENT_BOOL && value.of.boolean);
        check(wasmtime_component_func_call(&audit,ctx,NULL,0,&value,1));assert(value.kind==WASMTIME_COMPONENT_BOOL && value.of.boolean);
        check(wasmtime_component_func_call(&close,ctx,NULL,0,NULL,0));
        check(wasmtime_component_func_call(&bind,ctx,&domain,1,&value,1));assert(value.kind==WASMTIME_COMPONENT_BOOL && !value.of.boolean);
    }
finished:
    if(in->mode>=MIXED)assert(lb_ts_retire(&h->sync.ctl));
    else assert(lb_wit_turn_retire(s));
    wasmtime_component_delete(c);wasmtime_component_linker_delete(link);wasmtime_store_delete(store);wasm_engine_delete(engine);
    return true;
}
int main(int argc,char **argv){
    assert(argc==7);session trial={0};assert(lb_wit_turn_run(&trial.turns,enter,finish,&trial,protocol,NULL));
    assert(!trial.bound && trial.drops==3 && trial.sets==3 && trial.gets==2);
    host h={0};input in={&h,argv[1],PROPERTY};assert(lb_wit_turn_run(&h.s.turns,enter,finish,&h.s,application,&in));
    assert(!h.s.bound && h.s.drops==2 && h.s.sets==2 && h.s.gets==2);
    puts("async guest: original box 42 -> 73; original getter error; two Lean frames disposed");
    host failed={0};input trap={&failed,argv[2],TRAP};
    assert(lb_wit_turn_run(&failed.s.turns,enter,finish,&failed.s,application,&trap));
    assert(!failed.s.bound && failed.s.drops==1 && failed.s.sets==1 && !failed.s.gets);
    puts("trapped async guest: parked Lean call unwound once on its owner before store destruction");
    host cursors={.s={.audit_aliases=true}};input run_cursors={&cursors,argv[3],CURSORS};
    assert(lb_wit_turn_run(&cursors.s.turns,enter,finish,&cursors.s,application,&run_cursors));
    assert(cursors.s.starts==4 && cursors.s.pulls==6 && cursors.s.closes==4 && !cursors.s.bound);
    for(unsigned k=0;k<256;k++)assert(cursors.s.refs.rows[k].state==LB_TC_FREE);
    puts("canonical guest-owned cursors: four open, six pulls, one abandoned before demand, four closed");
    host cancelled={.s={.audit_aliases=true}};input cancel={&cancelled,argv[4],CANCEL};
    assert(lb_wit_turn_run(&cancelled.s.turns,enter,finish,&cancelled.s,application,&cancel));
    assert(cancelled.s.starts==4 && cancelled.s.pulls==5 && cancelled.s.closes==4);
    for(unsigned k=0;k<256;k++)assert(cancelled.s.refs.rows[k].state==LB_TC_FREE);
    puts("parked read cancelled before Lean resolved; no late item or second close");
    session nested={0};
    assert(lb_wit_turn_run(&nested.turns,enter,finish,&nested,nested_open,NULL));
    assert(nested.starts==3 && nested.closes==3 && !nested.pulls && !nested.bound);
    puts("reentrant cursor open during owner comparison: three independent cursors, three releases");
    host relay={0};input callbacks={&relay,argv[5],REGISTRATIONS};
    assert(lb_wit_turn_run(&relay.s.turns,enter,finish,&relay.s,application,&callbacks));
    assert(!relay.s.bound && relay.s.sets==1 && relay.s.gets==1);
    for(unsigned i=0;i<256;i++)assert(relay.s.refs.rows[i].state==LB_TC_FREE);
    puts("retained native tasks: reentrant original object, owned callback exception, caught exception then independent IO error, cancelled pending callback");
    host mixed={0};input app={&mixed,argv[6],MIXED};
    assert(lb_wit_turn_run(&mixed.s.turns,enter,finish,&mixed.s,application,&app));
    assert(!mixed.s.bound && mixed.s.starts==1 && mixed.s.pulls==2 && mixed.s.closes==1 && !mixed.sync.ctl.depth && !mixed.s.sync.poisoned);
    for(unsigned i=0;i<256;i++)assert(mixed.s.refs.rows[i].state==LB_TC_FREE);
    puts("unchanged downstream application: series to retained relay to nested Lean update to canonical future: 73");
    host errors={0};input cases={&errors,argv[6],FUTURE_ERROR};
    assert(lb_wit_turn_run(&errors.s.turns,enter,finish,&errors.s,application,&cases));
    for(unsigned i=0;i<256;i++)assert(errors.s.refs.rows[i].state==LB_TC_FREE);
    host trapped={0};input traps={&trapped,argv[6],FUTURE_TRAP};
    assert(lb_wit_turn_run(&trapped.s.turns,enter,finish,&trapped.s,application,&traps) && !trapped.s.bound);
    for(unsigned i=0;i<256;i++)assert(trapped.s.refs.rows[i].state!=LB_TC_LIVE && !trapped.s.refs.rows[i].pins);
    puts("canonical callback futures: sixteen scheduling/error combinations and native teardown on a guest trap");
    host sync_trap={0};input sync_case={&sync_trap,argv[6],SYNC_TRAP};
    assert(lb_wit_turn_run(&sync_trap.s.turns,enter,finish,&sync_trap.s,application,&sync_case));
    assert(!sync_trap.s.bound && !sync_trap.sync.ctl.depth && !sync_trap.s.sync.frame);
    for(unsigned i=0;i<LB_WIT_TURN_DEPTH;i++)assert(!sync_trap.s.sync.slots[i].occupied);
    puts("trapped synchronous member cleanup: native frame retired and copied slots released without guest reentry");
}
