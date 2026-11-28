/** @file Bind nominal WIT requests to their authenticated native callback ports. */
/**
 * Reconcile invocation allowances per binder, not per callable type. Both
 * the pollable embedding and the canonical guest graph use this check.
 *
 * @param method - Component operations and nominal request identities.
 * @param native - Corresponding native wire entry from the compiler.
 */
export const checkedWitCallbackSites=(method,native)=>{
	if(!method || !native || method.declaration!==native.declaration)
		throw new TypeError("WIT method and native task wire disagree");
	const calls=method.callbacks??[],slots=native.callbacks??[];
	const once=calls.filter(r=>r.invocation==="once").map(r=>r.slot);
	if(calls.some(r=>r.invocation!==undefined && r.invocation!=="once") || native.once!==(once.length?true:undefined)
		|| (once.length ? !Array.isArray(native.onceSlots) || native.onceSlots.length!==once.length || once.some((slot,j)=>slot!==native.onceSlots[j]) : native.onceSlots!==undefined))
		throw new TypeError("WIT callback allowance differs from its native parameter");
	if(calls.length!==slots.length || calls.some((r,j)=>r.slot!==slots[j][0] || r.arg!==slots[j][1] || r.reply!==slots[j][2] || native.args[r.slot]!=="callback"))
		throw new TypeError("WIT request identity and native callback slot disagree");
	return calls;
};

/**
 * Emit and cross-check the private Wasmtime callback declarations.
 *
 * @param methods - Nominal request descriptors from the checked WIT world.
 * @param wire - Native entry points compiled for the same declarations.
 * @param prefix - Component's native status and symbol prefix.
 */
export const witCallbackTable = (methods,wire,prefix) => {
	const defs=[],ports=[],requests=[],budgeted=[];
	for(const [i,m] of wire.methods.entries())
	{
		const calls=checkedWitCallbackSites(methods[i],m);
		if(m.once) budgeted.push(i);
		if(!calls.length)
		{ ports.push("{0}"); continue; }
		const n=m.names, normal=m.args.flatMap((arg,slot)=>arg==="callback"?[]:[slot]);
		defs.push("extern int "+n.callbacks+"(uint64_t *,int *);",
			"extern int "+n.next+"(uint64_t *,uint32_t *);",
			"extern int "+n.arg+"(uint64_t *,uint32_t,uint64_t *);",
			"extern int "+n.reply+"(uint64_t *,uint32_t,const uint64_t *);",
			"extern int "+n.fail+"(uint64_t *,const uint64_t *,uint32_t *);");
		ports.push("{"+[normal.length?"(const size_t[]){"+normal.join(",")+"}":"NULL"
			, n.callbacks
			, n.next
			, n.arg
			, n.reply
			, n.fail
			, m.error?"lb_decode_"+i+"_start":"NULL"
			, m.effect==="IO"?"13":m.effect==="EIO"?prefix+"_TYPED_ERROR":"0"
			, m.effect==="IO"?"true":"false",m.terminal?"true":"false"].join(",")+"}");
		for(const r of calls) requests.push("{"+[i,r.slot
			, ...[r.resource,r.state,r.read,r.resolve,r.reject].map(v=>JSON.stringify(v))
			, "LB_"+r.arg.toUpperCase(),"LB_"+r.reply.toUpperCase()].join(",")+"}");
	}
	if(budgeted.length) defs.push("static bool lb_budgeted_method(size_t i) { return "+budgeted.map(i=>"i=="+i).join(" || ")+"; }");
	return {count: requests.length,declarations: defs.join("\n")
		, tables: requests.length
			?"static const lb_cb_port lb_cb_ports[]={"+ports.join(",")+"};\nstatic const lb_cb_method lb_cb_methods[]={"+requests.join(",")+"};":""
	};
};
