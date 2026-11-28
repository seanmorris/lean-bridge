/**
 * Private byte-buffer ABI for native PHP FFI calls.
 * Applications never receive a Lean pointer or a public numeric handle.
 *
 * @file
 */

/**
 * Classify the independently owned bytes the C result must release.
 *
 * @param t - Primitive wire type at the active result branch.
 */
const shape=t=>t==="string"||t==="bytes"?1:t==="nat"?2:t==="int"?3:0;
const output=(t,kinds,depth=0)=>Array.isArray(t)
	? `(tags[${depth}] == 1 ? ${output(t[0],kinds,depth+1)} : tags[${depth}] == 0 ? ${output(t[1],kinds,depth+1)} : -1)` : String(kinds.get(t) ?? shape(t));
const scalarChecks = { unit: "v == 0", bool: "v <= 1"
	, char: "v <= 0x10ffff && !(v >= 0xd800 && v <= 0xdfff)"
	, uint8: "v <= UINT8_MAX", uint16: "v <= UINT16_MAX"
	, uint32: "v <= UINT32_MAX", float32: "v <= UINT32_MAX"
	, int8: "v == (uint64_t)(int64_t)(int8_t)v"
	, int16: "v == (uint64_t)(int64_t)(int16_t)v"
	, int32: "v == (uint64_t)(int64_t)(int32_t)v" };
const max=16*1024*1024;

/**
 * Generate a fixed native entry for every method, with checked allocation,
 * unaligned-safe reads and unconditional disposal of the original word result.
 *
 * @param model - Synchronous PHP surface regenerated from the compiler.
 * @param model.prefix - Coordinate-bound C symbol prefix.
 * @param model.methods - Reconciled method shapes in wire order.
 * @param model.wire - Underlying generated C calls and result disposer.
 * @param model.phpWasm - Require the synchronous wasm32 symbol family.
 * @param model.phpHostKinds - Ordered class keys from the native PHP import contract.
 */
export const generatePhpIOPort=({prefix,methods,wire,phpWasm=false,phpHostKinds=[]})=>{
	if(!(phpWasm ? /^lbc_php_wasm_[0-9a-f]{64}$/u : /^lbc_php_[0-9a-f]{64}$/u).test(prefix)
		|| (phpWasm && (wire.wait || wire.leases)) || wire.clear!=="lbwire_"+prefix+"_v1_clear" || !methods.length)
		throw new TypeError("Expected checked PHP IO wire");
	const stem="lbphp_"+prefix.slice(8), dispose=stem+"_dispose";
	const symbols=[dispose], type="lbphp_buffer";
	const signature=(symbol,types,async)=>`int ${symbol}(const ${type} *args, uint64_t argc, ${type} *out, uint8_t *tags, uint64_t tagcap${async ? ", uint64_t *h" : ""})${types}`;
	const leases = wire.leases ?? [], has = leases.length > 0;
	if(phpHostKinds.length && (phpWasm || !wire.wait || phpHostKinds.length!==leases.length))
		throw new TypeError("PHP host leases require the matching native owner");
	const kinds = new Map(leases.map((r,i) => {
		const host=phpHostKinds[i];
		if(Boolean(host)!==Boolean(r.host) || host && (host.hash!==r.hash || host.name!==r.name)
			|| r.type !== (host?"host:":"lease:")+r.hash || !/^[a-f0-9]{64}$/u.test(r.hash) || r.tag !== i+3 || r.symbol !== wire.clear.slice(0,-6)+"_lease_"+i)
			throw new TypeError("Invalid PHP resource wire");
		return [r.type,16+r.tag];
	}));
	const fields = has ? " uint64_t lease[4];" : "";
	const declarations=[`typedef struct { uint8_t *data; uint64_t length;${fields} } ${type};`,`void ${dispose}(${type} *out);`];
	const taskSymbols=[], taskDeclarations=[];
	const occupied = `!out || out->data || out->length${has ? " || out->lease[0] || out->lease[1] || out->lease[2] || out->lease[3]" : ""}`;
	const move = has ? `
    if (kind >= 16) {
        if (!words[0] || !words[1] || words[2] || words[3]!=(uint64_t)(kind-16)) return ${prefix}_INVALID;
        memcpy(out->lease,words,sizeof out->lease); memset(words,0,sizeof out->lease); return 0;
    }` : "";
	const source=[`#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include "php-io-port.h"
#include "${prefix}.h"
#define LIMIT ${max}u
${phpWasm ? '_Static_assert(sizeof(void*)==4 && sizeof(size_t)==4,"PHP-Wasm needs a 32-bit target");' : '_Static_assert(sizeof(void*)==8 && sizeof(size_t)==8,"native PHP needs a 64-bit target");'}
extern void ${wire.clear}(uint64_t *);
void ${dispose}(${type} *out) { if (out) {${has ? " "+wire.clear+"(out->lease);" : ""} free(out->data); out->data=NULL; out->length=0; } }
static int lbphp_pack(int kind, ${has ? "" : "const "}uint64_t *words, ${type} *out) {
    uint64_t n=0; const void *p=NULL;${move}
    if (kind==0) {
        if (words[1]||words[2]||words[3]) return ${prefix}_INVALID;
        n=8; p=words;
    } else if (kind==1) {
        if (words[3]!=1||words[2]||(!words[0]&&words[1])) return ${prefix}_INVALID;
        n=words[1]; p=(const void *)(uintptr_t)words[0];
    } else if (kind==2||kind==3) {
        if (words[3]!=2 || words[2]>(kind==3?1u:0u) || (!words[0]&&words[1]) || (!words[1]&&words[2])) return ${prefix}_INVALID;
        if (words[1]>(LIMIT-8)/8) return ${prefix}_LIMIT;
        n=8+8*words[1]; p=(const void *)(uintptr_t)words[0];
    } else return ${prefix}_INVALID;
    if (n>LIMIT) return ${prefix}_LIMIT;
    if (!n) return 0;
    uint8_t *data=malloc((size_t)n); if (!data) return ${prefix}_NO_MEMORY;
    if (kind>=2) { memcpy(data,words+2,8); if (n>8) memcpy(data+8,p,(size_t)n-8); }
    else memcpy(data,p,(size_t)n);
    out->data=data; out->length=n; return 0;
}`];
	const input=(t,j)=>{
		if(t==="callback") return `    if (args[${j}].length || args[${j}].data) goto finish;`;
		const a=3*j, k=kinds.get(t) ?? shape(t);
		const base=`const uint8_t *p=args[${j}].data; uint64_t n=args[${j}].length;
        if (n>LIMIT-total) { status=${prefix}_LIMIT; goto finish; } total+=n;
        if (n&&!p) goto finish;`;
		const step=k===0?`if (n!=8) goto finish;
        uint64_t v; memcpy(&v,p,8); ${scalarChecks[t]?"if (!("+scalarChecks[t]+")) goto finish; ":""}a[${a}]=v;`
			:k>=16?`if (n!=16) goto finish; memcpy(a+${a},p,16); if (!a[${a}] || !a[${a+1}]) goto finish;`
				:k===1?`a[${a}]=(uintptr_t)p; a[${a+1}]=n;`
					:`if (n<8 || n%8) goto finish;
        uint64_t sign; memcpy(&sign,p,8); if (sign>${k===3?1:0}u || (n==8&&sign)) goto finish;
        if (n>8) {
            uint64_t high; memcpy(&high,p+n-8,8); if (!high) goto finish;
            owned[${j}]=malloc((size_t)n-8);
            if (!owned[${j}]) { status=${prefix}_NO_MEMORY; goto finish; }
            memcpy(owned[${j}],p+8,(size_t)n-8);
        }
        a[${a}]=(uintptr_t)owned[${j}]; a[${a+1}]=n/8-1; a[${a+2}]=sign;`;
		return "    { "+base+"\n        "+step+" }";
	};
	for(const [i,m] of methods.entries())
	{
		if(m.symbol!=="lbwire_"+prefix+"_v1_"+i||m.tagBytes<1||!Number.isSafeInteger(m.tagBytes)) throw new TypeError("Invalid PHP fixed entry");
		const fn=stem+"_"+i, slots=Math.max(1,m.args.length);
		const direct=m.delivery==="iterator", async=Boolean(m.delivery) && !direct, handle=async || direct;
		if(direct && (wire.wait || m.callbacks || Object.keys(m.names).sort().join()!=="close,next,open"))
			throw new TypeError("Invalid checked PHP immediate iterator protocol");
		if(async && (!wire.wait || !["task","async-iterator"].includes(m.delivery) || (m.callbacks && m.delivery!=="task")))
			throw new TypeError("Invalid PHP delivery protocol");
		symbols.push(fn); declarations.push(signature(fn,";",handle));
		const inputs=m.args.map(input);
		const error=m.error===null?"":`else if (status==${prefix}_${m.effect==="IO"?"IO_ERROR":"TYPED_ERROR"}) kind=${output(m.error,kinds)};`;
		const start=direct ? m.names.open : async ? m.names.start : m.symbol;
		source.push(`extern int ${start}(const uint64_t *,${handle ? "uint64_t *," : ""}uint64_t *,uint8_t *);
${signature(fn,"",handle)} {
    if (${occupied} || !tags || tagcap!=${m.tagBytes} || argc!=${m.args.length} || (argc&&!args)${handle ? " || !h || h[0] || h[1]" : ""}) return ${prefix}_INVALID;
    memset(tags,0,(size_t)tagcap);
    uint64_t a[${3*slots}]={0}, w[4]={0}, total=0; void *owned[${slots}]={0};
    int status=${prefix}_INVALID, kind=-1; (void)total;
${inputs.join("\n")}
    status=${start}(a,${handle ? "h," : ""}w,tags);
    if (status==${prefix}_OK) ${handle ? "goto finish" : "kind="+output(m.result,kinds)}; ${error}
    else goto finish;
    { int packed=lbphp_pack(kind,w,out); if (packed) status=${phpWasm ? `packed==${prefix}_INVALID ? -1 : packed` : "packed"}; }
finish:
    ${wire.clear}(w); for (unsigned int j=0;j<${slots};j++) free(owned[j]); return status;
}`);
		if(handle)
		{
			const names=m.names;
			for(const k of (direct ? ["open","next","close"] : ["start","take","poll","close",...m.delivery==="async-iterator" ? ["pull"] : []]))
				if(names[k]!==m.symbol+"_"+k) throw new TypeError("Invalid checked PHP task entry");
			const take=fn+(direct ? "_next" : "_take"), from=direct ? names.next : names.take;
			const prototype=`int ${take}(uint64_t *h, ${type} *out, uint8_t *tags, uint64_t tagcap)`;
			taskSymbols.push(take,...direct ? [] : [names.poll],names.close);
			taskDeclarations.push(prototype+";",...direct ? [] : [`int ${names.poll}(uint64_t *h, int *fd);`],`int ${names.close}(uint64_t *h);`);
			if(names.pull)
			{
				taskSymbols.push(names.pull); taskDeclarations.push(`int ${names.pull}(uint64_t *h);`);
			}
			const terminal=m.delivery==="task" || m.stepIO ? "IO_ERROR" : "TYPED_ERROR";
			source.push(`extern int ${from}(uint64_t *,uint64_t *,uint8_t *);
${prototype} {
    if (!h || ${occupied} || !tags || tagcap!=${m.tagBytes}) return ${prefix}_INVALID;
    uint64_t w[4]={0}; memset(tags,0,(size_t)tagcap);
    int status=${from}(h,w,tags), kind=-1;
    if (status==${prefix}_OK) kind=${output(m.result,kinds)};
    ${m.terminal ? `else if (status==${prefix}_${terminal}) kind=${output(m.terminal,kinds)};` : ""}${m.callbacks ? `
    else if (status==14) kind=0;
    else if (status==13) kind=1;${m.effect==="EIO" ? `
    else if (status==${prefix}_TYPED_ERROR) kind=${output(m.error,kinds)};` : ""}` : ""}
    else goto finish;
    { int packed=lbphp_pack(kind,w,out); if (packed) status=${phpWasm ? `packed==${prefix}_INVALID ? -1 : packed` : "packed"}; }
finish:
    ${wire.clear}(w); return status;
}`);
			if(m.callbacks)
			{
				for(const k of ["arg","reply","next","callbacks","fail","trap"])
					if(names[k]!==m.symbol+"_"+k) throw new TypeError("Invalid checked PHP callback entry");
				const slots=new Set(), args=[], replies=[];
				for(const [slot,from,to] of m.callbacks)
				{
					if(!Number.isSafeInteger(slot)||slot<0||slots.has(slot)||m.args[slot]!=="callback") throw new TypeError("Invalid PHP callback slot");
					slots.add(slot); args.push(`case ${slot}: kind=${kinds.get(from) ?? shape(from)}; break;`);
					replies.push(`case ${slot}: ${input(to,0)} break;`);
				}
				const get=fn+"_arg", put=fn+"_reply", reject=fn+"_fail";
				const getProto=`int ${get}(uint64_t *h, uint32_t slot, ${type} *out)`;
				const putProto=`int ${put}(uint64_t *h, uint32_t slot, const ${type} *args)`;
				const failProto=`int ${reject}(uint64_t *h, const char *msg, uint64_t len, uint32_t *id)`;
				taskSymbols.push(get,put,reject,names.callbacks,names.next,names.trap);
				taskDeclarations.push(getProto+";",putProto+";",failProto+";",`int ${names.callbacks}(uint64_t *h, int *fd);`,`int ${names.next}(uint64_t *h, uint32_t *slot);`,`void ${names.trap}(void);`);
				source.push(`extern int ${names.arg}(uint64_t *,uint32_t,uint64_t *);
extern int ${names.reply}(uint64_t *,uint32_t,const uint64_t *);
extern int ${names.fail}(uint64_t *,const uint64_t *,uint32_t *);
${getProto} {
    if (!h || ${occupied}) return ${prefix}_INVALID;
    int kind; switch (slot) { ${args.join(" ")} default: return ${prefix}_INVALID; }
    uint64_t w[4]={0}; int status=${names.arg}(h,slot,w);
    if (!status) status=lbphp_pack(kind,w,out);
    ${wire.clear}(w); return status;
}
${putProto} {
    if (!h || !args) return ${prefix}_INVALID;
    uint64_t a[3]={0}, total=0; void *owned[1]={0};
    int status=${prefix}_INVALID;
    switch (slot) { ${replies.join("\n")} default: goto finish; }
    status=${names.reply}(h,slot,a);
finish:
    free(owned[0]); return status;
}
${failProto} {
    if (!h || !id || len>LIMIT || (len&&!msg)) return ${prefix}_INVALID;
    uint64_t words[3]={(uintptr_t)msg,len,0}; return ${names.fail}(h,words,id);
}`);
			}
		}
	}
	if(wire.wait)
	{
		const {open,close}=wire.wait;
		if(open!==wire.clear.slice(0,-5)+"wait_open" || close!==wire.clear.slice(0,-5)+"wait_close" || !taskSymbols.length)
			throw new TypeError("Invalid checked PHP readiness port");
		symbols.push(...taskSymbols,open,close);
		declarations.push(...taskDeclarations,`int ${open}(int source, int callback, int *gate);`,`void ${close}(int *gate);`);
	} else if(taskSymbols.length)
	{
		symbols.push(...taskSymbols);
		declarations.push(...taskDeclarations);
	}
	for(const {symbol} of leases)
	{
		symbols.push(symbol+"_same",symbol+"_retain");
		declarations.push(`int ${symbol}_same(const uint64_t *a,const uint64_t *b,uint8_t *out);`);
		declarations.push(`int ${symbol}_retain(const uint64_t *h,uint64_t *out);`);
	}
	const definitions=declarations.join("\n")+"\n";
	return {stem,dispose,symbols,definitions,header: "#pragma once\n#include <stdint.h>\n"+definitions,source: source.join("\n")+"\n"};
};
