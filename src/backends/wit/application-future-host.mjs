/** @file Bridge graph-local canonical future ownership to typed compiled Lean tasks. */

/**
 * Generate one per-instance readiness reactor. An owned result stays in its
 * address-stable slot until the graph takes it; a Wasmtime value wrapper alone
 * cannot stand in for the defining component's resource destructor.
 *
 * @param m - Reconciled nominal input, output, native declarations and row limit.
 */
export const objectFutureHost=m=>{
	const {p,n,label,capacity,a,z,from,to,input,output,fault,shape}=m,f="lwit_future_"+n,j=p+n;
	const returned=shape==="returned",factory=shape==="factory",relay=shape==="callback";
	const cb="lwit_"+m.callback,reg=p+m.callback;
	return `/* Include after application-operations.h. */
#include "canonical-future-reactor.h"
${relay?'#include "application-callbacks.h"':""}
typedef struct {${j}_handle job; lwit_owner result; lwit_operations *ops;} ${f}_slot;
typedef struct {
    lwit_operations *ops; lb_cf_reactor r; wasmtime_component_func_t retire; lb_cf_row rows[${capacity}];
    struct pollfd fds[${capacity}]; ${f}_slot slots[${capacity}];
    ${relay?`${cb} cb; lwit_exchange registrations;`:""}
} ${f};
static void ${f}_release(void *data){
    ${f}_slot *s=data;
    bool ok=${j}_close(&s->job)==${p}OK;
    if(!lwit_no_error(lwit_drop(&s->result)) || !ok)s->ops->bridge.members.store->failed=true;
}
static bool ${f}_take(void *data,wasmtime_component_val_t *marker){
    ${f}_slot *s=data; ${output} out={0}; ${p}diagnostic d={0};
    ${p}status status=${j}_take(&s->job,&out,&d);bool ok=status==${p}OK;
    uint32_t copy=0;
    ${relay?`if(ok){
        ok=lwit_no_error(lwit_export_${to}(&s->ops->bridge,out,&s->result));
        if(${output}_drop(&out)!=${p}OK)ok=false;
    }else if(status==${p}CALLBACK_ERROR){
        ok=lwit_callback_take_fault(s->ops,&d,&s->result);copy=1;
    }else if(status==${p}TASK_IO_ERROR && !d.payload && d.message.len<=16777216 && lb_utf8((const char*)d.message.data,d.message.len)){
        marker->kind=WASMTIME_COMPONENT_STRING;
        wasm_name_new(&marker->of.string,d.message.len,d.message.len?(const char*)d.message.data:"");
        ${p}diagnostic_clear(&d);return true;
    }`:factory?"copy=out;":returned?`if(ok && out.ok)copy=out.value;
    else if(ok)ok=lwit_no_error(lwit_export_${to}(&s->ops->bridge,out.error,&s->result));
    ${j}_value_clear(&out);`:`if(ok)ok=lwit_no_error(lwit_export_${to}(&s->ops->bridge,out,&s->result));
    if(${output}_drop(&out)!=${p}OK)ok=false;`}
    ${p}diagnostic_clear(&d);
    if(ok)*marker=(wasmtime_component_val_t){.kind=WASMTIME_COMPONENT_U32,.of.u32=copy};
    return ok;
}
static wasmtime_error_t *${f}_start(void *data,wasmtime_context_t *ctx,const wasmtime_component_func_type_t *ft,
    lb_val *args,size_t argc,lb_val *result,size_t resultc){
    (void)ft;(void)args;${f} *s=data;lwit_operations *ops=s->ops;
    if(!ops || !lwit_open(ops->bridge.members.store) || ctx!=s->r.ctx || argc || resultc!=1)
        return wasmtime_error_new("invalid object future start");
    lwit_owner owner={0}; ${input} arg={0}; ${p}diagnostic d={0};
    ${factory?`${fault} failure={0};lwit_owner declared={0};bool has_failure=false;`:""}
    bool ok=false,imported=false;unsigned key=0; ${f}_slot *slot=NULL;
    ${relay?`lwit_owner registration={0};${reg} cb={0};bool adopted=false;`:"int fd=-1;"}
    const char *problem="${label}: taking the staged input";
    if(!lwit_no_error(lwit_exchange_take(&ops->slots[${a}],&owner)))goto done;
    ${relay?'if(!lwit_no_error(lwit_exchange_take(&s->registrations,&registration)))goto done;':""}
    problem="${label}: reserving and importing the input";
    key=lb_cf_reserve(&s->r);if(!key || !lwit_import_${from}(&ops->bridge,&owner,&arg))goto done;
    imported=true;
    slot=&s->slots[key-1];slot->ops=ops;
    ${relay?`if(!${cb}_adopt(&s->cb,&registration,&cb))goto done;
    adopted=true;`:""}
    problem="${label}: starting compiled Lean task";
    ${p}status opened=${j}_start(ops->bridge.binding,arg,${relay?"cb,":""}&slot->job,${factory?"&failure,":""}&d);
    ${factory?`if(opened==${p}DECLARED_ERROR){
        has_failure=true;problem="${label}: exporting the declared error";ok=lwit_no_error(lwit_export_${to}(&ops->bridge,failure,&declared));goto done;
    }`:""}
    if(opened!=${p}OK)goto done;
    problem="${label}: registering native readiness";
    ${relay?`ok=lwit_arm_${n}(&s->r,key,&slot->job,slot,${f}_take,${f}_release);`:`${p}status state=${j}_poll(slot->job,&fd);
    if(state!=${p}OK && (state!=${p}PENDING || fd<0))goto done;
    ok=lb_cf_arm(&s->r,key,state==${p}OK?-1:fd,slot,${f}_take,${f}_release);`}
done:
    ${p}diagnostic_clear(&d);
    ${relay?`if(adopted && ${reg}_drop(&cb)!=${p}OK)ok=false;
    if(!lwit_no_error(lwit_drop(&registration)))ok=false;`:""}
    if(imported && ${input}_drop(&arg)!=${p}OK){ok=false;problem="${label}: dropping the input ticket";}
    if(!lwit_no_error(lwit_drop(&owner)))ok=false;
    ${factory?`if(has_failure && ${fault}_drop(&failure)!=${p}OK){ok=false;problem="${label}: dropping the declared error ticket";}
    if(declared.any){
        if(ok && lwit_open(ops->bridge.members.store)){problem="${label}: transferring the declared error";ok=lwit_no_error(lwit_exchange_put(&ops->slots[${z}],&declared));}
        if(!lwit_no_error(lwit_drop(&declared)))ok=false;
        /* No job or writable future was created. Only zero signals a declared
         * error; malformed frames and unexpected native failures still trap. */
        s->rows[key-1]=(lb_cf_row){0};key=0;slot=NULL;
    }`:""}
    if(!ok || !lwit_open(ops->bridge.members.store)){
        if(slot)${f}_release(slot);
        if(key)s->rows[key-1]=(lb_cf_row){0};
        ops->bridge.members.store->failed=true;return lb_cf_fail(&s->r,problem);
    }
    *result=(lb_val){.kind=WASMTIME_COMPONENT_U32,.of.u32=key};return NULL;
}
static wasmtime_error_t *${f}_stage(void *data,wasmtime_context_t *ctx,const wasmtime_component_func_type_t *ft,
    lb_val *args,size_t argc,lb_val *result,size_t resultc){
    (void)ft;(void)result;${f} *s=data;unsigned key=s->r.staged_key;
    if(!s->ops || ctx!=s->r.ctx || !lwit_open(s->ops->bridge.members.store) ||
        !s->r.staged || !key || key>${capacity} || argc!=1 || resultc!=${relay||factory||returned?1:0} ||
        args->kind!=WASMTIME_COMPONENT_U32 || args->of.u32!=key${relay?"":` ||
        s->r.staged->kind!=WASMTIME_COMPONENT_U32${factory||returned?"":" || s->r.staged->of.u32"}`})
        return lb_cf_fail(&s->r,"invalid object future payload claim");
    ${relay?`lb_val *value=s->r.staged;bool nominal=value->kind==WASMTIME_COMPONENT_U32;
    if(nominal){
        if(value->of.u32>1)return lb_cf_fail(&s->r,"invalid relay nominal arm");
        wasmtime_error_t *err=lwit_exchange_put(&s->ops->slots[value->of.u32?${m.err}:${z}],&s->slots[key-1].result);
        if(err)return err;
    }else if(value->kind!=WASMTIME_COMPONENT_STRING || s->slots[key-1].result.any)return lb_cf_fail(&s->r,"invalid relay error");
    *result=(lb_val){.kind=WASMTIME_COMPONENT_RESULT};
    result->of.result.is_ok=nominal;result->of.result.val=wasmtime_component_val_new(value);
    *value=(lb_val){0};s->r.staged=NULL;return NULL;`:factory?`*result=*s->r.staged;s->r.staged=NULL;return NULL;`:returned?`*result=(lb_val){.kind=WASMTIME_COMPONENT_OPTION};
    if(!s->slots[key-1].result.any){
        result->of.option=wasmtime_component_val_new(s->r.staged);
        s->r.staged=NULL;return NULL;
    }
    if(s->r.staged->of.u32)return lb_cf_fail(&s->r,"invalid nominal result marker");`:""}
    ${factory||relay?"":`wasmtime_error_t *e=lwit_exchange_put(&s->ops->slots[${z}],&s->slots[key-1].result);
    if(!e)s->r.staged=NULL;
    return e;`}
}
static inline wasmtime_error_t *${f}_link(wasmtime_component_linker_t *l,${f} *s){
    wasmtime_component_linker_instance_t *root=wasmtime_component_linker_root(l);
    wasmtime_error_t *e=wasmtime_component_linker_instance_add_func(root,"${label}-native-start",${label.length+13},${f}_start,s,NULL);
    if(!e)e=wasmtime_component_linker_instance_add_func(root,"${label}-native-stage",${label.length+13},${f}_stage,s,NULL);
    wasmtime_component_linker_instance_delete(root);return e;
}
static inline bool ${f}_open(${f} *s,lwit_operations *ops){
    if(!s || !ops || s->r.rows || !lwit_open(ops->bridge.members.store))return false;
    lwit_store *g=ops->bridge.members.store;
    lb_cf_reactor r={.capacity=${capacity},.rows=s->rows,.fds=s->fds,.ctx=g->ctx,.pull_payload=true};
    if(!lwit_lookup(g,NULL,"${label}-deliver",&r.deliver) || !lwit_lookup(g,NULL,"${label}-reap",&r.reap) ||
        !lwit_lookup(g,NULL,"${label}-retire",&s->retire))return false;
    ${relay?`if(!${cb}_open(&s->cb,ops))return false;
    if(!${cb}_exchange(&s->cb,&s->registrations)){(void)${cb}_clear(&s->cb);return false;}`:""}
    s->r=r;s->ops=ops;return true;
}
static inline wasmtime_error_t *${f}_shutdown(${f} *s){
    if(!s || !s->ops)return NULL;
    if(!lwit_open(s->ops->bridge.members.store))s->r.poisoned=true;
    wasmtime_error_t *e=s->r.poisoned?NULL:lb_cf_reap(&s->r);
    for(unsigned i=0;!e && !s->r.poisoned && i<${capacity};i++){
        if(s->rows[i].phase!=LB_CF_WRITER)continue;
        lb_val key={.kind=WASMTIME_COMPONENT_U32,.of.u32=i+1};
        e=wasmtime_component_func_call(&s->retire,s->r.ctx,&key,1,NULL,0);
    }
    lb_cf_shutdown(&s->r);
    for(unsigned i=0;i<${capacity};i++)if(!lwit_no_error(lwit_drop(&s->slots[i].result)))s->ops->bridge.members.store->failed=true;
    ${relay?`if(!${cb}_clear(&s->cb) && !e)e=lb_cf_fail(&s->r,"live registration at relay shutdown");`:""}
    s->ops=NULL;return e;
}
`;
};
