#include "finite-stream.h"
#include "series-stream.h"
typedef struct {lwit_stream_finite finite;lwit_stream_series series;} stream_workers;
typedef struct {session *s;stream_workers *w;lb_cf_reactor *r;unsigned key;bool typed,second;} stream_client;
static stream_client open_stream(stream_workers *w,session *s,lwit_operations *ops,bool typed,bool second){
    stream_client c={.s=s,.w=w,.r=typed?&w->series.r:&w->finite.r,.typed=typed,.second=second};
    bool free_before[64];assert(c.r->capacity==64);
    for(unsigned i=0;i<64;i++)free_before[i]=c.r->rows[i].phase==LB_CF_FREE;
    seed_input(ops,42);V mode=u32(typed);wasmtime_component_func_t f;
    assert(lwit_lookup(&s->store,NULL,second?"sc2-start":"sc-start",&f));
    ok(wasmtime_component_func_call(&f,s->store.ctx,&mode,1,NULL,0));
    for(unsigned i=0;i<64;i++)if(free_before[i] && c.r->rows[i].phase==LB_CF_STREAM){assert(!c.key);c.key=i+1;}
    assert(c.key && !c.r->rows[c.key-1].requested);return c;
}
static void demand(stream_client *c){future_action(c->s,c->second?"sc2-request":"sc-request");}
static void end_stream(stream_client *c){future_action(c->s,c->second?"sc2-finish":"sc-finish");}
static void pump_stream_client(stream_client *c,bool wait){
    lb_cf_row *row=&c->r->rows[c->key-1];if(row->phase==LB_CF_FREE)return;
    if(wait && row->wait_native && row->fd>=0){
        struct pollfd fd={.fd=row->fd,.events=POLLIN};assert(poll(&fd,1,5000)==1 && fd.revents&POLLIN);
    }
    unsigned state=3;
    ok(c->typed?lwit_stream_series_pump(&c->w->series,c->key,&state):lwit_stream_finite_pump(&c->w->finite,c->key,&state));
    assert(state<=2 && row->wait_native==(state==1));
}
static void frame(stream_client *c,unsigned expect){
    if(expect==3)future_action(c->s,c->second?"sc2-probe":"sc-probe");else demand(c);
    V arg=u32(expect);
    for(unsigned i=0;;i++){
        assert(i<32);V v=invoke(c->s,c->second?"sc2-collect":"sc-collect",&arg,1,true);
        assert(v.kind==WASMTIME_COMPONENT_BOOL);if(v.of.boolean)break;
        pump_stream_client(c,true);
    }
}
static uint64_t cursor_counts(session *s){V v=invoke(s,"counts",NULL,0,true);assert(v.kind==WASMTIME_COMPONENT_U64);return v.of.u64;}
/* Zero-length reads acknowledge readiness, never the payload. Pump through a
   possibly asynchronous native pull so the next write owns a real guest box. */
static void pin_frame(stream_client *c){
    frame(c,3);lb_cf_row *r=&c->r->rows[c->key-1];
    for(unsigned i=0;r->requested;i++){assert(i<8);pump_stream_client(c,true);}
    assert(r->phase==LB_CF_STREAM && r->fd==-1 && !c->r->staged_key);
}
static void gate_cursor(session *s,bool hold){
    V arg={.kind=WASMTIME_COMPONENT_BOOL,.of.boolean=hold};V v=invoke(s,"gate",&arg,1,true);assert(v.kind==WASMTIME_COMPONENT_U32 && !v.of.u32);
}
static unsigned public_streams(stream_workers *w,session *s,lwit_operations *ops){
    const uint64_t pull=UINT64_C(1)<<32;uint64_t base=cursor_counts(s);unsigned owners=0;
    stream_client c=open_stream(w,s,ops,false,false);
    for(int i=0;i<3;i++)pump_stream_client(&c,false);
    assert(cursor_counts(s)==base);demand(&c);future_action(s,"sc-cancel");
    pump_stream_client(&c,false);assert(cursor_counts(s)==base);
    frame(&c,0);assert(cursor_counts(s)==base+pull);
    pump_stream_client(&c,false);assert(cursor_counts(s)==base+pull); /* no prefetch */
    frame(&c,2);assert(cursor_counts(s)==base+2*pull+1);end_stream(&c);owners+=4;
    assert(c.r->rows[c.key-1].phase==LB_CF_FREE);
    /* Same numeric value, different guest objects and independent cursors. */
    c=open_stream(w,s,ops,true,false);stream_client other=open_stream(w,s,ops,true,true);
    assert(c.key!=other.key);frame(&other,0);frame(&c,0);frame(&c,1);frame(&c,2);end_stream(&c);
    end_stream(&other);pump_stream_client(&other,false);owners+=9;
    assert(c.r->rows[c.key-1].phase==LB_CF_FREE && other.r->rows[other.key-1].phase==LB_CF_FREE);
    /* Closing a reader before the first demand still runs Lean close, not next. */
    base=cursor_counts(s);c=open_stream(w,s,ops,false,false);end_stream(&c);pump_stream_client(&c,false);
    assert(cursor_counts(s)==base+1 && c.r->rows[c.key-1].phase==LB_CF_FREE);owners+=3;
    /* A genuinely pending task: cancellation must not block on its native fd. */
    base=cursor_counts(s);gate_cursor(s,true);c=open_stream(w,s,ops,false,false);demand(&c);
    pump_stream_client(&c,false);assert(c.r->rows[c.key-1].wait_native && c.r->rows[c.key-1].fd>=0);
    assert(cursor_counts(s)==base+pull);future_action(s,"sc-cancel");end_stream(&c);pump_stream_client(&c,false);
    assert(cursor_counts(s)==base+pull+1 && c.r->rows[c.key-1].phase==LB_CF_FREE);gate_cursor(s,false);owners+=3;
    /* The reader disappears after asking for data but accepting zero owners. */
    base=cursor_counts(s);c=open_stream(w,s,ops,false,false);pin_frame(&c);
    assert(cursor_counts(s)==base+pull);end_stream(&c);pump_stream_client(&c,false);
    assert(cursor_counts(s)==base+pull+1 && c.r->rows[c.key-1].phase==LB_CF_FREE);owners+=4;
    c=open_stream(w,s,ops,true,false);frame(&c,0);pin_frame(&c);end_stream(&c);pump_stream_client(&c,false);
    assert(c.r->rows[c.key-1].phase==LB_CF_FREE);owners+=5;
    /* Shutdown owns two distinct writers: one with a pending item, the other
       with a pending step error. Neither reader has accepted that frame. */
    c=open_stream(w,s,ops,true,false);other=open_stream(w,s,ops,true,true);
    frame(&other,0);pin_frame(&other);pin_frame(&c);
    ok(lwit_stream_series_shutdown(&w->series));
    assert(c.r->rows[c.key-1].phase==LB_CF_FREE && other.r->rows[other.key-1].phase==LB_CF_FREE);
    frame(&other,2);frame(&c,2);end_stream(&c);end_stream(&other);owners+=9;
    /* Shutdown retires a zero-length demand probe with a live reader. */
    base=cursor_counts(s);c=open_stream(w,s,ops,false,false);pump_stream_client(&c,false);
    ok(lwit_stream_finite_shutdown(&w->finite));assert(cursor_counts(s)==base+1);
    frame(&c,2);end_stream(&c);owners+=3;
    puts("Wasm pulled its original boxes, distinguished a typed final error from EOF, and closed parked or abandoned Lean cursors once");
    return owners;
}
