/**
 * Emit and cross-check the private Wasmtime callback declarations.
 *
 * @param methods - Nominal request descriptors from the checked WIT world.
 * @param wire - Native entry points compiled for the same declarations.
 * @param prefix - Component's native status and symbol prefix.
 * @file Bind each nominal WIT request to its authenticated native callback port and parameter.
 */
export const witCallbackTable = (methods,wire,prefix) => {
	const defs=[],ports=[],requests=[];
	for(const [i,m] of wire.methods.entries())
	{
		const calls=methods[i]?.callbacks??[],native=m.callbacks??[];
		if(calls.length!==native.length || calls.some((r,j)=>r.slot!==native[j][0] || r.arg!==native[j][1] || r.reply!==native[j][2] || m.args[r.slot]!=="callback"))
			throw new TypeError("WIT request identity and native callback slot disagree");
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
	return {count: requests.length,declarations: defs.join("\n")
		, tables: requests.length
			?"static const lb_cb_port lb_cb_ports[]={"+ports.join(",")+"};\nstatic const lb_cb_method lb_cb_methods[]={"+requests.join(",")+"};":""
	};
};
