/** @file Generate C closures and typed factory/worker failures for a retained WIT task. */

/**
 * Emit one C registration type per signature. Multiple invocations and tasks
 * may hold the same registration without sharing their request identity.
 *
 * @param options - Authenticated world, C type mappings and output builders.
 */
export const callbackBindings=options=>{
	const {model,p,kinds,defs,code,add}=options;
	const types=new Map(),sites=new Map();
	for(const method of model.methods) for(const r of method.callbacks??[])
	{
		const sig=r.arg+"_to_"+r.reply;
		if(!types.has(sig))
		{
			const index=types.size,name=p+"callback_"+sig,fn=name+"_fn",payload=name+"_payload";
			const a=kinds[r.arg],b=kinds[r.reply],at=a[0]??p+(r.arg==="bytes"?"byte_view":"text"),bt=b[0]??p+(r.reply==="bytes"?"byte_view":"text");
			const read=r.arg==="string"?"("+p+"text){arg->of.string.data,arg->of.string.size}":"arg->of."+a[2];
			const lift=r.reply==="string"?"return lb_fn_message(value,out);"
				:r.reply==="bytes"?"lb_scope budget={.remaining=16u*1024u*1024u}; return lb_pack_bytes(value,out,&budget);"
					:(r.reply==="char"?"if (!lb_unicode(value)) return "+p+"INVALID; ":"")+"*out=(lb_val){.kind=WASMTIME_COMPONENT_"+b[1]+",.of."+b[2]+"=value}; return "+p+"OK;";
			const borrowed=r.arg==="bytes";
			defs.push("typedef struct { uint64_t _private[3]; } "+name+";",
				"typedef bool (*"+fn+")(void *context, "+at+" argument, "+bt+" *reply, "+p+"text *error);");
			code.push(`typedef struct { ${fn} fn; void *context; void (*destroy)(void *); } ${payload};
static void ${name}_destroy(void *data) { ${payload} *v=data; if (v->destroy) v->destroy(v->context); free(v); }
${borrowed?`static ${p}status ${name}_invoke(${payload} *v,${at} bytes,bool *failed,lb_val *out) {
    ${bt} value={0}; ${p}text error={0};
    *failed=!v->fn(v->context,bytes,&value,&error);
    if (*failed) return lb_fn_message(error,out);
    ${lift}
}`:""}
static ${p}status ${name}_call(void *data,const lb_val *arg,bool *failed,lb_val *out) {
    ${borrowed?`${p}bytes owned={0}; int decoded=lb_unpack_bytes(arg,&owned);
    if (decoded!=LB_GOOD) return decoded==LB_OVER_BUDGET?${p}LIMIT:${p}TRAPPED;
    ${p}status rc=${name}_invoke(data,(${at}){owned.data,owned.size},failed,out);
    ${p}bytes_dispose(&owned); return rc;`:`${payload} *v=data; ${bt} value={0}; ${p}text error={0};
    if (arg->kind!=WASMTIME_COMPONENT_${a[1]}) return ${p}TRAPPED;
    *failed=!v->fn(v->context,${read},&value,&error);
    if (*failed) return lb_fn_message(error,out);
    ${lift}`}
}`);
			add("make_callback_"+sig,[p+"session *s",fn+" function","void *context","void (*destroy)(void *)",name+" *out"],
				`    if (!function || !out || out->_private[0] || out->_private[1] || out->_private[2]) return ${p}INVALID;
    ${payload} *v=malloc(sizeof *v); if (!v) return ${p}LIMIT;
    *v=(${payload}){function,context,destroy};
    ${p}status rc=lb_fn_register(s,${index},${name}_call,v,${name}_destroy,out->_private);
    if (rc!=${p}OK) free(v);
    return rc;`);
			for(const op of ["drop","revoke"]) add(op+"_callback_"+sig,[p+"session *s",name+" *owner"],
				"    return lb_fn_drop(s,"+index+",owner?owner->_private:NULL,"+(op==="revoke")+");");
			types.set(sig,{name,index});
		}
		sites.set(r.resource,{...types.get(sig),site: sites.size,slot: r.slot});
	}
	return sites;
};

/**
 * A factory that can call back runs on a worker. Deliver its typed failures
 * through observation, not a fictitious synchronous error at start.
 *
 * @param options - Types, method descriptors and C generation helpers.
 */
export const retainedObservations=options=>{
	const {p,m,s,own,i,value,error,terminal,make,defs,add,occupied,receive}=options;
	const type=p+m.name+"_errors",callback=make("string",m.name+"_callback_error");
	const fields=[["factory",error],["worker",terminal],["callback",callback]].filter(([,c])=>c);
	defs.push("typedef struct { "+fields.map(([k,c])=>c.type+" "+k+";").join(" ")+" } "+type+";");
	const release=fields.flatMap(([k,c])=>c.kind!==undefined
		?["if (e->"+k+"._private[0]) (void)"+p+"drop_lease_"+c.slug+"(&e->"+k+");"]
		:c.paths.map(path=>"free(e->"+k+path+".data);")).join(" ");
	defs.push("static inline void "+type+"_dispose("+type+" *e) { if (e) { "+release+" memset(e,0,sizeof *e); } }");
	const fresh=fields.flatMap(([k,c])=>c.kind!==undefined
		?["errors->"+k+"._private[0]","errors->"+k+"._private[1]"]
		:c.paths.flatMap(path=>["errors->"+k+path+".data","errors->"+k+path+".size"])).join(" || ") || "false";
	for(const wait of [false,true])
	{
		const args=[s,own,p+"state *state",value.type+" *value",type+" *errors",...wait?[]:["int *fd"]];
		const arm=(label,c,k)=>c?" else if (next=="+p+label+") { "+receive(c,"(&errors->"+k+")")+" }":"";
		add((wait?"await_":"poll_")+m.name,args,`    if (!state || !errors || ${occupied(value,"value")} || ${fresh}${wait?"":" || !fd"}) return ${p}INVALID;
    lb_val v={0}; ${p}state next; int gate=-1;
    ${p}status rc=lb_observe(s,${i},task._private,${wait},&next,&gate,&v);
    if (rc!=${p}OK) return rc;
    if (next==${p}READY) { ${receive(value,"value")} }${arm("FACTORY_FAILED",error,"factory")}${arm("FAILED",terminal,"worker")}
    else if (next==${p}FACTORY_CALLBACK_FAILED || next==${p}WORKER_CALLBACK_FAILED) { ${receive(callback,"(&errors->callback)")} }
    wasmtime_component_val_delete(&v); *state=next; ${wait?"":"*fd=gate; "}return ${p}OK;`);
	}
};
