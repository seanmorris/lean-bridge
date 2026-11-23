/**
 * Private byte-buffer ABI for native PHP FFI calls.
 * PHP never receives a Lean object, ledger key or ownership flag.
 *
 * @file
 */

/**
 * Classify the independently owned bytes the C result must release.
 *
 * @param t - Primitive wire type at the active result branch.
 */
const shape=t=>t==="string"||t==="bytes"?1:t==="nat"?2:t==="int"?3:0;
const output=(t,depth=0)=>Array.isArray(t)
	? `(tags[${depth}] == 1 ? ${output(t[0],depth+1)} : tags[${depth}] == 0 ? ${output(t[1],depth+1)} : -1)` : String(shape(t));
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
 */
export const generatePhpIOPort=({prefix,methods,wire})=>{
	if(!/^lbc_php_[0-9a-f]{64}$/u.test(prefix)||wire.clear!=="lbwire_"+prefix+"_v1_clear"||!methods.length)
		throw new TypeError("Expected checked PHP IO wire");
	const stem="lbphp_"+prefix.slice(8), dispose=stem+"_dispose";
	const symbols=[dispose], type="lbphp_buffer";
	const signature=(symbol,types)=>`int ${symbol}(const ${type} *args, uint64_t argc, ${type} *out, uint8_t *tags, uint64_t tagcap)${types}`;
	const declarations=[`typedef struct { uint8_t *data; uint64_t length; } ${type};`,`void ${dispose}(${type} *out);`];
	const source=[`#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include "php-io-port.h"
#include "${prefix}.h"
#define LIMIT ${max}u
_Static_assert(sizeof(void*)==8 && sizeof(size_t)==8,"native PHP needs a 64-bit target");
extern void ${wire.clear}(uint64_t *);
void ${dispose}(${type} *out) { if (out) { free(out->data); out->data=NULL; out->length=0; } }
static int lbphp_pack(int kind, const uint64_t *words, ${type} *out) {
    uint64_t n=0; const void *p=NULL;
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
	for(const [i,m] of methods.entries())
	{
		if(m.symbol!=="lbwire_"+prefix+"_v1_"+i||m.delivery||m.tagBytes<1||!Number.isSafeInteger(m.tagBytes)) throw new TypeError("Invalid PHP fixed entry");
		const fn=stem+"_"+i, slots=Math.max(1,m.args.length);
		symbols.push(fn); declarations.push(signature(fn,";"));
		const inputs=m.args.map((t,j)=>{
			const a=3*j, k=shape(t);
			const base=`const uint8_t *p=args[${j}].data; uint64_t n=args[${j}].length;
        if (n>LIMIT-total) { status=${prefix}_LIMIT; goto finish; } total+=n;
        if (n&&!p) goto finish;`;
			const step=k===0?`if (n!=8) goto finish;
        uint64_t v; memcpy(&v,p,8); ${scalarChecks[t]?"if (!("+scalarChecks[t]+")) goto finish; ":""}a[${a}]=v;`
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
		});
		const error=m.error===null?"":`else if (status==${prefix}_${m.effect==="IO"?"IO_ERROR":"TYPED_ERROR"}) kind=${output(m.error)};`;
		source.push(`extern int ${m.symbol}(const uint64_t *,uint64_t *,uint8_t *);
${signature(fn,"")} {
    if (!out || out->data || out->length || !tags || tagcap!=${m.tagBytes} || argc!=${m.args.length} || (argc&&!args)) return ${prefix}_INVALID;
    memset(tags,0,(size_t)tagcap);
    uint64_t a[${3*slots}]={0}, w[4]={0}, total=0; void *owned[${slots}]={0};
    int status=${prefix}_INVALID, kind=-1; (void)total;
${inputs.join("\n")}
    status=${m.symbol}(a,w,tags);
    if (status==${prefix}_OK) kind=${output(m.result)}; ${error}
    else goto finish;
    { int packed=lbphp_pack(kind,w,out); if (packed) status=packed; }
finish:
    ${wire.clear}(w); for (unsigned int j=0;j<${slots};j++) free(owned[j]); return status;
}`);
	}
	const definitions=declarations.join("\n")+"\n";
	return {stem,dispose,symbols,definitions,header: "#pragma once\n#include <stdint.h>\n"+definitions,source: source.join("\n")+"\n"};
};
