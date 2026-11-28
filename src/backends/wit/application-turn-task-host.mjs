/** @file Bind the same checked task inventory on both threads of a native WIT host. */
import {cIdentifier} from "../c/generate.mjs";

/**
 * The owner dispatches to the typed compiled C facade. The store thread binds
 * only opaque turn channels. Both tables use the same declaration order.
 *
 * @param p - Native package prefix.
 * @param methods - Complete supported WIT inventory.
 * @param entries - Source entries with their actual C export names.
 */
export const witTurnTaskHost=(p,methods,entries)=>{
	const names=new Map(entries.map(e=>[e.declaration,cIdentifier(e.name)]));
	const rows=methods.map(m=>{
		const n=names.get(m.declaration),stream=m.shape==="stream";
		if(!n)throw new TypeError("Missing native task declaration: "+m.declaration);
		return {n,stream,copied: m.copied,name: m.name,f: (m.copied?"lb_cp_":stream?"lb_tc_":"lb_tf_")+n,kind: stream?"LB_TG_STREAM":m.shape==="factory"?"LB_TF_FACTORY":m.shape==="callback"?"LB_TF_RETAINED":"LB_TF_SINGLE"};
	});
	if(!rows.length || new Set(rows.map(r=>r.n)).size!==rows.length || rows.length!==entries.length)throw new TypeError("Incomplete native task inventory");
	return `/* Generated: scheduler bindings for every source-selected task and cursor. */
#ifndef LB_WIT_APPLICATION_TURN_TASKS_H
#define LB_WIT_APPLICATION_TURN_TASKS_H
#include "application-turn-channels.h"
#include "application-turn-wait.h"
${rows.map(r=>'#include "'+r.name+(r.copied?'-turn-copied.h"':r.stream?'-turn-stream.h"':'-turn-future.h"')).join("\n")}
enum {${rows.map(r=>"LB_TG_I_"+r.n).join(",")},LB_TG_COUNT};
static const lb_tg_spec lb_tg_specs[LB_TG_COUNT]={
    ${rows.map(r=>'{"turn-'+r.name+'",'+r.kind+'}').join(",\n    ")}
};
typedef struct {${rows.map(r=>r.f+" c_"+r.n+";").join("")}} lb_tg_native;
typedef struct {lb_tg_port rows[LB_TG_COUNT];struct pollfd fds[64*LB_TG_COUNT];${rows.filter(r=>r.copied).map(r=>"lb_cp_linker copy_"+r.n+";").join("")}} lb_tg_store;
static inline bool lb_tg_contains(uint32_t op){return op>=LB_TG_BASE && (op-LB_TG_BASE)/16<LB_TG_COUNT;}
static inline bool lb_tg_dispatch(lb_tg_native *s,lb_tc_refs *refs,${p}binding binding,lb_wit_message in,lb_wit_message *out){
    if(!lb_tg_contains(in.op))return false;
    unsigned channel=(in.op-LB_TG_BASE)/16;in.op=(in.op-LB_TG_BASE)%16;
    switch(channel){
    ${rows.map(r=>`case LB_TG_I_${r.n}:return ${r.f}_call(&s->c_${r.n},refs,binding,in,out);`).join("\n    ")}
    default:return false;}
}
static inline bool lb_tg_shutdown(lb_tg_native *s){
    bool ok=true;${rows.map(r=>`if(!${r.f}_shutdown(&s->c_${r.n}))ok=false;`).join("\n    ")}
    return ok;
}
static inline wasmtime_error_t *lb_tg_link_all(lb_tg_store *g,lb_tg_native *native,wasmtime_component_linker_instance_t *root,lb_wit_turns *turns){
    (void)native;
    for(unsigned i=0;i<LB_TG_COUNT;i++){
        wasmtime_error_t *e=lb_tg_link_one(&g->rows[i],lb_tg_specs+i,i,root,turns);if(e)return e;
    }${rows.filter(r=>r.copied).map(r=>`{wasmtime_error_t *e=lb_cp_link(&g->copy_${r.n},&native->c_${r.n}.wire,&g->rows[LB_TG_I_${r.n}],${r.stream},"copied-${r.name}",root);if(e)return e;}`).join("\n    ")}return NULL;
}
static inline bool lb_tg_open_all_at(lb_tg_store *g,wasmtime_component_instance_t *inst,wasmtime_context_t *ctx,const char *scope){
    for(unsigned i=0;i<LB_TG_COUNT;i++)if(!lb_tg_open_one_at(&g->rows[i],lb_tg_specs+i,inst,ctx,scope))return false;
    return true;
}
static inline bool lb_tg_open_all(lb_tg_store *g,wasmtime_component_instance_t *inst,wasmtime_context_t *ctx){return lb_tg_open_all_at(g,inst,ctx,"");}
static inline wasmtime_error_t *lb_tg_advance_all(lb_tg_store *g,unsigned *changed){
    for(unsigned i=0;i<LB_TG_COUNT;i++){
        wasmtime_error_t *e=lb_tg_advance_one(&g->rows[i],lb_tg_specs+i,changed);if(e)return e;
    }return NULL;
}
/* Each package can append its interests before the shared store blocks. */
static inline wasmtime_error_t *lb_tg_collect(lb_tg_store *g,lb_wit_wait_set *set){
    if(!g || !set)return wasmtime_error_new("invalid scheduler wait set");
    for(unsigned i=0;i<LB_TG_COUNT;i++){
        bool stream=lb_tg_specs[i].kind==LB_TG_STREAM;lb_tg_port *c=&g->rows[i];
        lb_tc_port *p=stream?&c->stream.port:&c->future.port.port;
        if(lb_wit_wait_collect(set,p->active,p->fd,stream?NULL:c->future.port.delivered,64))
            return wasmtime_error_new("invalid or full scheduler wait set");
    }
    return NULL;
}
static inline wasmtime_error_t *lb_tg_wait(lb_tg_store *g,int timeout,bool *ready){
    if(!g || !ready || timeout<0)return wasmtime_error_new("invalid scheduler wait");
    lb_wit_wait_set set={.fds=g->fds,.capacity=sizeof g->fds/sizeof g->fds[0]};
    wasmtime_error_t *e=lb_tg_collect(g,&set);if(e)return e;
    int rc=lb_wit_wait_poll(&set,timeout,ready);
    return rc?wasmtime_error_new(rc==EBADF?"invalid scheduler descriptor":"native scheduler poll failed"):NULL;
}
static inline wasmtime_error_t *lb_tg_drain(lb_tg_store *g){
    /* Every channel shares the same native lease pool. */
    lb_tg_port *c=g->rows;bool stream=lb_tg_specs[0].kind==LB_TG_STREAM;
    return stream?wasmtime_component_func_call(&c->stream.drain,c->stream.ctx,NULL,0,NULL,0):
        wasmtime_component_func_call(&c->future.drain,c->future.ctx,NULL,0,NULL,0);
}
static inline wasmtime_error_t *lb_tg_retire_all(lb_tg_store *g){
    for(unsigned i=0;i<LB_TG_COUNT;i++){
        wasmtime_error_t *e=lb_tg_retire_one(&g->rows[i],lb_tg_specs+i);if(e)return e;
    }return NULL;
}
#endif
`;
};
