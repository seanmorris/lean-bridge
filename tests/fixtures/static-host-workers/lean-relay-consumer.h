#include "relay-future.h"
#include "relay-late-future.h"
typedef struct {lwit_future_relay plain;lwit_future_relay_late late;} relay_workers;
static unsigned relay_rows(lb_cf_reactor *r,lb_cf_phase phase){
    unsigned n=0;for(unsigned i=0;i<r->capacity;i++)n+=r->rows[i].phase==phase;return n;
}
static unsigned public_relays(relay_workers *w,session *s,lwit_operations *ops,active_guest *guest){
    wasmtime_component_func_t start;assert(lwit_lookup(&s->store,NULL,"guest-relay-begin",&start));
    unsigned expected=0;
    for(unsigned step=0;step<4;step++)for(unsigned mode=0;mode<4;mode++){
        bool late=mode>=2,queued=step==2;
        lb_cf_reactor *r=late?&w->late.r:&w->plain.r;
        guest->binding=late?&w->late.cb:&w->plain.cb;
        unsigned visits=guest->visits,destructors=invoke(s,"callback-drops",NULL,0,true).of.u32;
        seed_input(ops,42);V arg=u32(mode);ok(wasmtime_component_func_call(&start,s->store.ctx,&arg,1,NULL,0));
        assert(guest->visits==visits && guest->binding->live==1 && relay_rows(r,LB_CF_NATIVE)==1);
        assert(invoke(s,"callback-drops",NULL,0,true).of.u32==destructors+1); /* caller already dropped its own registration */
        if(queued){
            for(unsigned i=0;i<r->capacity;i++)if(r->rows[i].phase==LB_CF_NATIVE){
                struct pollfd wake={.fd=r->rows[i].fd,.events=POLLIN};assert(wake.fd>=0 && poll(&wake,1,5000)==1);
            }
        }else{
            if(step==3)future_action(s,"guest-relay-request");
            for(unsigned steps=0;relay_rows(r,LB_CF_NATIVE);steps++){assert(steps<32);ok(lb_cf_advance(r,5000));}
            assert(relay_rows(r,LB_CF_WRITER)==(step==3?0u:1u));
        }
        future_action(s,step==3?"guest-relay-collect":step?"guest-relay-discard":"guest-relay-receive");ok(lb_cf_reap(r));
        assert(guest->visits==visits+!queued && !guest->binding->live && relay_rows(r,LB_CF_FREE)==r->capacity);
        assert(invoke(s,"callback-drops",NULL,0,true).of.u32==destructors+2);
        /* Seed ticket, original guest box and retained task input; successful
         * callbacks add the re-entry and canonical-alias owners, failures an
         * exception. Only the ordinary successful task exports another box. */
        expected+=3+(queued?0:(mode&1)?1:2)+(mode==0 && !queued);
    }
    /* Different clients, same reactor. Consume the exception before the
     * box regardless of native completion order, without swapping them. */
    guest->binding=&w->plain.cb;lb_cf_reactor *r=&w->plain.r;
    wasmtime_component_func_t second;assert(lwit_lookup(&s->store,NULL,"second-relay-begin",&second));
    V good=u32(0),bad=u32(1);seed_input(ops,42);ok(wasmtime_component_func_call(&start,s->store.ctx,&good,1,NULL,0));
    seed_input(ops,42);ok(wasmtime_component_func_call(&second,s->store.ctx,&bad,1,NULL,0));
    assert(guest->binding->live==2 && relay_rows(r,LB_CF_NATIVE)==2);
    for(unsigned steps=0;relay_rows(r,LB_CF_NATIVE);steps++){assert(steps<32);ok(lb_cf_advance(r,5000));}
    assert(relay_rows(r,LB_CF_WRITER)==2 && !guest->binding->live);
    future_action(s,"second-relay-receive");future_action(s,"guest-relay-receive");ok(lb_cf_reap(r));
    assert(relay_rows(r,LB_CF_FREE)==r->capacity);expected+=10;guest->binding=NULL;
    puts("Wasm started compiled Lean relays: box, original callback exception, terminal IO text; delivered, discarded and cancelled");
    return expected;
}
