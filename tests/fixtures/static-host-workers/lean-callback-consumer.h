#include "application-callbacks.h"
typedef struct {
    workshop_callback_box_to_box *revoke;
    lwit_callback_box_to_box *binding;
    unsigned visits;
} active_guest;
static wasmtime_error_t *inside_guest(void *p,wasmtime_context_t *ctx,const wasmtime_component_func_type_t *ft,
    V *args,size_t argc,V *results,size_t resultc){
    (void)ft;(void)args;(void)results;active_guest *g=p;
    assert(!argc && !resultc && g->binding && ctx==g->binding->type.store->ctx);
    ++g->visits;
    if(g->revoke){
        assert(workshop_callback_box_to_box_close(g->revoke)==workshop_OK);
        assert(g->binding->live); /* deferred until this guest returns */
    }
    return NULL;
}
typedef struct {workshop_relay_handle *job;workshop_box *value;workshop_diagnostic *diag;workshop_status status;} relay_result;
static void close_relay(void *data){relay_result *v=data;assert(workshop_relay_close(v->job)==workshop_OK);}
static bool take_relay(void *data,V *marker){
    relay_result *v=data;v->status=workshop_relay_take(v->job,v->value,v->diag);*marker=u32(0);
    return v->status==workshop_OK || v->status==workshop_CALLBACK_ERROR;
}
static workshop_status finish_relay(workshop_relay_handle *job,workshop_box *value,workshop_diagnostic *d){
    relay_result v={.job=job,.value=value,.diag=d};lb_cf_row row={0};
    lb_cf_reactor r={.rows=&row,.capacity=1};unsigned key=lb_cf_reserve(&r);
    assert(lwit_arm_relay(&r,key,job,&v,take_relay,close_relay) && row.fd>=0);
    for(unsigned steps=0;;steps++){
        assert(steps<32);
        struct pollfd wake={.fd=row.fd,.events=POLLIN};assert(poll(&wake,1,5000)==1 && (wake.revents&POLLIN));
        int ready=lb_cf_ready(&row);assert(ready>=0);if(ready)break;
    }
    V marker={0};assert(row.take(row.owner,&marker));return v.status;
}
static uint32_t guest_callbacks(session *s,lwit_operations *ops,active_guest *calls,const char *iface,bool cancel_only){
    lwit_callback_box_to_box binding={0};assert(lwit_callback_box_to_box_open(&binding,ops));
    calls->binding=&binding;
    wasmtime_component_export_index_t *scope=wasmtime_component_instance_get_export_index(&s->store.instance,s->store.ctx,NULL,iface,strlen(iface));
    assert(scope);wasmtime_component_func_t make;
    assert(lwit_lookup(&s->store,scope,"[static]call-box-to-box.make",&make));wasmtime_component_export_index_delete(scope);
    uint32_t final_box_drops=drops(s); /* owner releases expected by binding teardown */
    for(unsigned mode=cancel_only?4:0;mode<(cancel_only?5u:4u);mode++){
        unsigned start=calls->visits,cb_drops=invoke(s,"callback-drops",NULL,0,true).of.u32;
        V behavior=u32(mode==1),v={0};ok(wasmtime_component_func_call(&make,s->store.ctx,&behavior,1,&v,1));
        lwit_owner reg={0},outfault={0};assert(lwit_take(&s->store,&binding.type,&v,&reg));wasmtime_component_val_delete(&v);
        workshop_box original={0},received={0};workshop_diagnostic d={0};
        assert(lwit_sync_make(&ops->bridge,42,&original,&outfault,&d)==workshop_OK);
        workshop_callback_box_to_box cb={0};workshop_relay_handle job={0},second={0};
        assert(!lwit_callback_box_to_box_adopt(&binding,lwit_from_box(&ops->bridge.members,original),&cb));
        lwit_owner copied=reg; /* copying the wrapper is not an ownership transfer */
        assert(!lwit_callback_box_to_box_adopt(&binding,&copied,&cb) && reg.any && !binding.live);
        assert(lwit_callback_box_to_box_adopt(&binding,&reg,&cb) && !reg.any && binding.live==1);
        assert(!lwit_callback_box_to_box_clear(&binding));
        assert(workshop_relay_start(ops->bridge.binding,original,cb,&job,&d)==workshop_OK);
        if(mode==3)assert(workshop_relay_start(ops->bridge.binding,original,cb,&second,&d)==workshop_OK);
        if(mode==2)calls->revoke=&cb;
        else assert(workshop_callback_box_to_box_drop(&cb)==workshop_OK);
        assert(binding.live==1 && calls->visits==start); /* factory has not entered the guest */
        if(mode==4){
            relay_result v={.job=&job};lb_cf_row row={0};lb_cf_reactor r={.rows=&row,.capacity=1};
            unsigned key=lb_cf_reserve(&r);assert(lwit_arm_relay(&r,key,&job,&v,take_relay,close_relay) && row.fd>=0);
            struct pollfd wake={.fd=row.fd,.events=POLLIN};assert(poll(&wake,1,5000)==1 && (wake.revents&POLLIN));
            /* A genuine published callback request is waiting, not just a
             * scheduled task. Readiness registration did not run the guest. */
            assert(calls->visits==start);
            lb_cf_shutdown(&r);assert(calls->visits==start && row.phase==LB_CF_FREE);
        }else{
            if(mode==3){
                bool same=false;
                assert(finish_relay(&second,&received,&d)==workshop_OK && binding.live==1 && calls->visits==start+1);
                assert(workshop_box_same(original,received,&same)==workshop_OK && same && workshop_box_drop(&received)==workshop_OK);
            }
            workshop_status state=finish_relay(&job,&received,&d);
            assert(calls->visits==start+(mode==3?2:1) && !binding.live);
            if(mode==1){
                assert(state==workshop_CALLBACK_ERROR && lwit_callback_take_fault(ops,&d,&outfault));
                assert(!lwit_callback_take_fault(ops,&d,&reg));
                V e=resource(&outfault),msg=checked(s,&ops->bridge.members.message,&e,1);
                assert(msg.kind==WASMTIME_COMPONENT_STRING && msg.of.string.size==11 && !memcmp(msg.of.string.data,"other error",11));
                wasmtime_component_val_delete(&msg);uint32_t before=drops(s);ok(lwit_drop(&outfault));assert(drops(s)==before+1);
            }else{
                bool same=false;uint32_t value=0;
                assert(state==workshop_OK && workshop_box_same(original,received,&same)==workshop_OK && same);
                assert(lwit_sync_read(&ops->bridge,received,&value,&outfault,&d)==workshop_OK && value==73);
                assert(workshop_box_drop(&received)==workshop_OK);
            }
        }
        calls->revoke=NULL;
        assert(!binding.live && invoke(s,"callback-drops",NULL,0,true).of.u32==cb_drops+1);
        assert(invoke(s,"callback-visits",NULL,0,true).of.u32==calls->visits);
        workshop_diagnostic_clear(&d);assert(workshop_box_drop(&original)==workshop_OK);
        /* Final worker references to Lean boxes can outlive delivery until
         * the next owner-domain sweep. Guest callbacks/errors cannot. Closing
         * the last binding sweeps the entire domain, even on cancellation. */
        for(lwit_owner *v=s->store.owners;v;v=v->next)assert(v->box);
        final_box_drops+=mode==4?1:mode==1?2:mode==3?5:3;
    }
    assert(lwit_callback_box_to_box_clear(&binding));calls->binding=NULL;
    puts("compiled relay retained a guest callback, reentered Lean, propagated its original exception and deferred self-disposal");
    return final_box_drops;
}
