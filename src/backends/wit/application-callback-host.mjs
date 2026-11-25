/** @file Bind real guest registrations to typed callbacks owned by compiled Lean tasks. */

/**
 * A C callback only runs from the native worker's owner-thread poll. Its
 * diagnostic may carry the original guest exception through Lean; dropping
 * or catching an error releases that owner even if no caller takes it.
 *
 * @param o - Nominal signatures, checked resource slots and provider coordinate.
 */
export const objectCallbackBinding=o=>{
	const {sigs,jobs,prefix: p,iface,rs,exchange}=o;
	const entries=sigs.map(({label,a,z,input,output,callback},i)=>{
		const k="lwit_"+callback,n=p+callback,from=rs[a].name.replaceAll("-","_"),to=rs[z].name.replaceAll("-","_");
		return `typedef struct {lwit_operations *ops; lwit_class type; wasmtime_component_func_t invoke; unsigned live;} ${k};
typedef struct {${k} *binding; lwit_owner registration;} ${k}_closure;
static inline bool ${k}_open(${k} *out,lwit_operations *ops){
    if(!out || out->ops || !ops || !lwit_open(ops->bridge.members.store))return false;
    lwit_store *s=ops->bridge.members.store;
    wasmtime_component_export_index_t *scope=wasmtime_component_instance_get_export_index(&s->instance,s->ctx,NULL,"${iface}",${iface.length});
    if(!scope)return false;
    ${k} b={.ops=ops};bool ok=lwit_class_bind(s,scope,"retain-${label}","same-${label}",&b.type);
    if(ok){
        lwit_param args[]={{"self",{WASMTIME_COMPONENT_VALTYPE_BORROW,b.type.type}},
            {"value",{WASMTIME_COMPONENT_VALTYPE_BORROW,ops->bridge.members.kinds[${a}].type}}};
        ok=lwit_member_bind(s,scope,"[method]${label}.invoke",args,2,
            (lwit_shape){WASMTIME_COMPONENT_VALTYPE_OWN,ops->bridge.members.kinds[${z}].type},ops->bridge.members.error,&b.invoke);
    }
    wasmtime_component_export_index_delete(scope);if(!ok){lwit_class_clear(&b.type);return false;}*out=b;return true;
}
static inline bool ${k}_clear(${k} *b){
    if(!b || b->live)return false;
    lwit_class_clear(&b->type);*b=(${k}){0};return true;
}
static inline bool ${k}_exchange(${k} *b,lwit_exchange *out){
    if(!b || !lwit_open(b->type.store))return false;
    lwit_store *s=b->type.store;
    wasmtime_component_export_index_t *scope=wasmtime_component_instance_get_export_index(&s->instance,s->ctx,NULL,"${exchange.name}",${exchange.name.length});
    if(!scope)return false;
    bool ok=lwit_exchange_bind(s,scope,b->type.type,"${exchange.slots[i].put}","${exchange.slots[i].take}",out);
    wasmtime_component_export_index_delete(scope);return ok;
}
static void ${k}_dispose(void *data){
    ${k}_closure *c=data;(void)lwit_no_error(lwit_drop(&c->registration));--c->binding->live;free(c);
}
static ${p}status ${k}_call(void *data,${p}${input} arg,${p}${output} *reply,${p}diagnostic *diag){
    ${k}_closure *c=data;lwit_bridge *b=&c->binding->ops->bridge;lwit_store *s=b->members.store;
    const lwit_owner *input=lwit_from_${from}(&b->members,arg);
    if(!lwit_is(&c->binding->type,&c->registration) || !lwit_is(&b->members.kinds[${a}],input))return ${p}INVALID;
    lb_val args[]={{.kind=WASMTIME_COMPONENT_RESOURCE,.of.resource=c->registration.any},{.kind=WASMTIME_COMPONENT_RESOURCE,.of.resource=input->any}},v={0};
    wasmtime_error_t *e=wasmtime_component_func_call(&c->binding->invoke,s->ctx,args,2,&v,1);
    if(e){wasmtime_error_delete(e);s->failed=true;return ${p}INVALID;}
    ${p}status state=${p}INVALID;lwit_owner moved={0};
    if(v.kind==WASMTIME_COMPONENT_RESULT && v.of.result.val){
        if(v.of.result.is_ok){
            if(lwit_take_type(s,b->members.kinds[${z}].type,v.of.result.val,&moved) && lwit_import_${to}(b,&moved,reply))state=${p}OK;
        }else if(lwit_take_type(s,b->members.error,v.of.result.val,&moved)){
            lwit_owner *fault=calloc(1,sizeof *fault);
            if(fault && lwit_move_owner(fault,&moved)){diag->payload=fault;diag->dispose_payload=lwit_callback_fault_free;state=${p}CALLBACK_ERROR;}
            else{free(fault);state=${p}LIMIT;}
        }
    }
    if(!lwit_no_error(lwit_drop(&moved)))state=${p}INVALID;
    wasmtime_component_val_delete(&v);if(state==${p}INVALID)s->failed=true;return state;
}
/* Transfer only after callback registration succeeds; on refusal the guest
 * owner is untouched. The worker keeps this closure alive independently. */
static inline bool ${k}_adopt(${k} *b,lwit_owner *owner,${n} *out){
    if(!b || !b->ops || !lwit_is(&b->type,owner) || owner->box || !out || b->live>=65536)return false;
    ${k}_closure *c=calloc(1,sizeof *c);if(!c)return false;c->binding=b;
    if(${n}_new(${k}_call,c,${k}_dispose,out)!=${p}OK){free(c);return false;}
    ++b->live;if(!lwit_move_owner(&c->registration,owner)){(void)${n}_drop(out);return false;}
    return true;
}`;
	});
	return `/* Include after application-operations.h. */
#ifndef LB_WIT_APPLICATION_CALLBACKS_H
#define LB_WIT_APPLICATION_CALLBACKS_H
#include "canonical-future-reactor.h"
static inline void lwit_callback_fault_free(void *p){lwit_owner *v=p;if(v){(void)lwit_no_error(lwit_drop(v));free(v);}}
static inline bool lwit_callback_take_fault(lwit_operations *ops,${p}diagnostic *d,lwit_owner *out){
    if(!ops || !d || d->dispose_payload!=lwit_callback_fault_free || !d->payload)return false;
    lwit_owner *original=d->payload;
    if(!lwit_has_type(ops->bridge.members.store,ops->bridge.members.error,original) || !lwit_move_owner(out,original))return false;
    d->payload=NULL;d->dispose_payload=NULL;free(original);return true;
}
${entries.join("\n")}
${jobs.map(n=>`static bool lwit_drive_${n}(void *driver,int *fd){
    ${p}status s=${p}${n}_poll(*(${p}${n}_handle*)driver,fd);
    return (s==${p}OK && *fd<0) || (s==${p}PENDING && *fd>=0);
}
static inline bool lwit_arm_${n}(lb_cf_reactor *r,unsigned key,${p}${n}_handle *job,void *owner,lb_cf_take_fn take,lb_cf_close_fn close){
    int fd=-1;${p}status state=${p}${n}_wakeup(*job,&fd);
    return ((state==${p}OK && fd==-1) || (state==${p}PENDING && fd>=0)) &&
        lb_cf_arm_driven(r,key,fd,owner,job,lwit_drive_${n},take,close);
}`).join("\n")}
#endif
`;
};
