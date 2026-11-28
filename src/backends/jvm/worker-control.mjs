/** @file Bind the native JVM task operations to the compiler's nominal argument layout. */
import { jvmWorkerKinds } from "./host-members.mjs";

/**
 * The small signed tables contain class indexes, never Java class names or
 * application-provided addresses. Only real callback slots can send a reply.
 *
 * @param ir - Authenticated import source used for the synchronous provider.
 * @param wire - Compiled JVM worker wire linked to the same component.
 * @param prefix - Content-addressed synchronous host provider prefix.
 */
export const jvmWorkerControl = (ir, wire, prefix) => {
	const kinds = jvmWorkerKinds(ir), seen = new Map();
	const fail = () => { throw new TypeError("Unverified JVM worker control layout"); };
	const p = /^lbwire_(lbc_[a-z0-9_]+)_v1_clear$/u.exec(wire.clear)?.[1];
	if(!p || !wire.wait || !wire.methods.length || wire.leases?.length !== kinds.length || !/^lb_jvm_host_[a-f0-9]{64}$/u.test(prefix)) fail();
	for(const [i,k] of kinds.entries())
	{
		const w = wire.leases[i];
		if(!w.host || w.tag !== 3+i || w.name !== k.name || w.hash !== k.hash || w.type !== "host:"+k.hash
			|| w.symbol !== wire.clear.slice(0,-6)+"_lease_"+i) fail();
		seen.set(w.type,i);
	}
	const index = t => seen.has(t) ? seen.get(t) : typeof t === "string" && !t.includes(":") ? -1 : fail();
	const vector = xs => "(const signed char[]){" + (xs.join(",") || "-1") + "}";
	const checks = [];
	const kind = (t, depth, limit) => {
		if(!Array.isArray(t)) return t == null ? "-1" : String(index(t));
		if(t.length !== 2 || depth >= limit) fail();
		return `(tags[${depth}]==1?${kind(t[0],depth+1,limit)}:tags[${depth}]==0?${kind(t[1],depth+1,limit)}:-2)`;
	};
	const rows = wire.methods.map((m,i) => {
		if(!["task","async-iterator"].includes(m.delivery) || m.symbol !== wire.clear.slice(0,-6)+"_"+i
			|| m.args.length > 64 || !Number.isInteger(m.tagBytes) || m.tagBytes < 1 || m.tagBytes > 65) fail();
		const args=m.args.map(index), reads=args.map(()=>-2), replies=args.map(()=>-2);
		for(const [j,arg,reply] of m.callbacks ?? [])
		{
			if(!Number.isInteger(j) || m.args[j]!=="callback" || replies[j]!==-2) fail();
			reads[j]=index(arg); replies[j]=index(reply);
		}
		if(m.args.some((arg,j)=>arg==="callback" && replies[j]===-2)) fail();
		const result = kind(m.result,0,m.tagBytes), startError = kind(m.error,0,m.tagBytes);
		const terminal = kind(m.delivery==="async-iterator"?m.terminal:m.error,0,m.tagBytes);
		checks.push(`case ${i}: if(op==0 && status==3) return ${startError};
        if(op==2 && status==0) return ${result};
        if(op==2 && status==3) return ${terminal};
        break;`);
		return "    {"+[args.length,m.tagBytes,vector(args),vector(reads),vector(replies)].join(",")+"}";
	});
	return `#define LB_JW_CALL ${prefix}_work
#define LB_JW_TASK ${p}_jvm_task
#define LB_JW_CLEAR ${wire.clear}
static const char *const worker_keys[]={${kinds.map(k=>JSON.stringify(k.hash)).join(",")}};
typedef struct { unsigned slots,tags; const signed char *args,*reads,*replies; } lb_jw_layout;
static const lb_jw_layout worker_methods[]={
${rows.join(",\n")}
};
static int worker_result_kind(int method,int op,int status,int arg_kind,const uint8_t *tags) {
    if(op==7 && !status) return arg_kind;
    switch(method) { ${checks.join("\n")} }
    return -1;
}
#include "worker-control.h"`;
};
