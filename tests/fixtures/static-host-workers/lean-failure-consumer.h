#include "accept-future.h"
#include "completed-future.h"
#include "outcome-future.h"
#include "reject-future.h"
typedef struct {
    lwit_future_accept accept; lwit_future_completed completed; lwit_future_outcome outcome; lwit_future_reject reject;
} result_workers;
static void link_results(result_workers *w,wasmtime_component_linker_t *l){
    ok(lwit_future_accept_link(l,&w->accept));ok(lwit_future_completed_link(l,&w->completed));
    ok(lwit_future_outcome_link(l,&w->outcome));ok(lwit_future_reject_link(l,&w->reject));
}
static void open_results(result_workers *w,lwit_operations *ops){
    assert(lwit_future_accept_open(&w->accept,ops) && lwit_future_completed_open(&w->completed,ops));
    assert(lwit_future_outcome_open(&w->outcome,ops) && lwit_future_reject_open(&w->reject,ops));
}
static void close_results(result_workers *w){
    ok(lwit_future_accept_shutdown(&w->accept));ok(lwit_future_completed_shutdown(&w->completed));
    ok(lwit_future_outcome_shutdown(&w->outcome));ok(lwit_future_reject_shutdown(&w->reject));
}
static void seed_input(lwit_operations *ops,uint32_t value){
    workshop_box native={0};lwit_owner input={0},fault={0};workshop_diagnostic d={0};
    assert(lwit_sync_make(&ops->bridge,value,&native,&fault,&d)==workshop_OK);
    ok(lwit_export_box(&ops->bridge,native,&input));assert(workshop_box_drop(&native)==workshop_OK);
    ok(lwit_exchange_put(&ops->slots[0],&input));
}
static void result_cases(result_workers *w,session *s,lwit_operations *ops,uint32_t *observed){
    /* More errors than available writer slots. A failed factory never
     * publishes a reader or consumes a slot, and the guest receives its box. */
    for(unsigned i=0;i<=w->reject.r.capacity;i++){
        seed_input(ops,100+i);uint32_t before=*observed;
        future_action(s,"reject");
        assert(*observed==before+3 && !s->store.owners && !w->reject.r.poisoned);
        for(unsigned j=0;j<w->reject.r.capacity;j++)assert(w->reject.rows[j].phase==LB_CF_FREE);
    }
    lb_cf_reactor *rs[]={&w->outcome.r,&w->completed.r,&w->accept.r};
    wasmtime_component_func_t start;assert(lwit_lookup(&s->store,NULL,"start-case",&start));
    for(unsigned discard=0;discard<2;discard++)for(unsigned mode=0;mode<3;mode++){
        lb_cf_reactor *r=rs[mode];seed_input(ops,42);uint32_t before=*observed;V arg=u32(mode);
        ok(wasmtime_component_func_call(&start,s->store.ctx,&arg,1,NULL,0));
        ok(lb_cf_advance(r,5000));unsigned writers=0;
        for(unsigned j=0;j<r->capacity;j++)writers+=r->rows[j].phase==LB_CF_WRITER;
        assert(writers==1);
        future_action(s,discard?"discard-case":"receive-case");ok(lb_cf_reap(r));
        assert(*observed==before+(mode==0?3:2) && drops(s)==*observed && !s->store.owners);
        for(unsigned j=0;j<r->capacity;j++)assert(r->rows[j].phase==LB_CF_FREE);
    }
    /* Two distinct boxes of equal value, two independent component instances,
     * one producer. Each must receive its original object, in either order. */
    wasmtime_component_func_t second;assert(lwit_lookup(&s->store,NULL,"second-start-case",&second));
    for(unsigned last_first=0;last_first<2;last_first++){
        uint32_t before=*observed;V mode=u32(0);
        seed_input(ops,17);ok(wasmtime_component_func_call(&start,s->store.ctx,&mode,1,NULL,0));
        seed_input(ops,17);ok(wasmtime_component_func_call(&second,s->store.ctx,&mode,1,NULL,0));
        ok(lb_cf_advance(&w->outcome.r,5000));unsigned writers=0;
        for(unsigned j=0;j<w->outcome.r.capacity;j++)writers+=w->outcome.rows[j].phase==LB_CF_WRITER;
        assert(writers==2);
        future_action(s,last_first?"second-receive-case":"receive-case");
        future_action(s,last_first?"receive-case":"second-receive-case");ok(lb_cf_reap(&w->outcome.r));
        /* seed_input also destroys one native owner for each input. */
        assert(*observed==before+8 && !s->store.owners);
        for(unsigned j=0;j<w->outcome.r.capacity;j++)assert(w->outcome.rows[j].phase==LB_CF_FREE);
    }
    puts("guest distinguished immediate EIO errors from delivered Except values and released each selected branch");
}
