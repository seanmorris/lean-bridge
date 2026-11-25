/** @file Generate typed C conversions for synchronous application host bindings. */
import {cIdentifier} from "./generate.mjs";

/**
 * Derive copied, nominal and returned-Except codecs from compiler-checked type references.
 *
 * @param ir - Authenticated host imports.
 * @param kinds - Native nominal keys in compiler order.
 * @param p - Public C name prefix, including its trailing underscore.
 * @param defs - Collected header declarations.
 */
export const cHostCodecs=(ir,kinds,p,defs)=>{
	const native={unit: "uint8_t",bool: "bool",char: "uint32_t",usize: "size_t",isize: "intptr_t",float32: "float",float64: "double"};
	for(const w of [8,16,32,64]) for(const sign of ["u",""]) native[sign+"int"+w]=sign+"int"+w+"_t";
	const encode=(n,v)=>n==="float32"?"lb_f32("+v+")":n==="float64"?"lb_f64("+v+")"
		:/^int(8|16|32|64)$/u.test(n)?"(uint"+n.slice(3)+"_t)"+v:n==="isize"?"(uintptr_t)"+v:v;
	const simple=(n,tag,kind=null)=>{
		const nominal=kind!==null,buf=n==="string"||n==="bytes",integer=n==="nat"||n==="int",dyn=buf||integer;
		const type=nominal?p+cIdentifier(kinds[kind].name):buf?p+"buffer":integer?p+"integer":native[n];
		if(!type) throw new TypeError("C host value lacks a native representation: "+n);
		const arg=buf?p+"view":integer?p+"integer_view":type;
		const key=nominal?JSON.stringify(kinds[kind].key):null;
		const raw=v=>"(lb_cr_ref){("+v+")._private[0],("+v+")._private[1]}";
		const clear=v=>nominal?"(void)"+type+"_drop(&("+v+"));":dyn?"free(("+v+").data);":"";
		const empty=v=>nominal?"(!("+v+")._private[0] && !("+v+")._private[1])":dyn?"(!("+v+").data && !("+v+").len"+(integer?" && !("+v+").negative":"")+")":"1";
		const pack=(v,w,bad)=>{
			const dest="("+w+")";
			if(nominal) return `{ void *ptr=NULL; int c=LB_CR(get)(${key},${raw(v)},&ptr); if(c) { ${bad("c")} } ${dest}[0]=(${v})._private[1]; }`;
			if(dyn) return `if(!lb_charge((${v}).data,(${v}).len,${integer?8:1},&budget)${n==="string"?" || !lb_utf8((const uint8_t *)("+v+").data,("+v+").len)":""}${integer?" || (("+v+").len && !("+v+").data[("+v+").len-1]) || (("+v+").negative && "+(n==="nat"?"1":"!("+v+").len")+")":""}) { ${bad("CR_INVALID")} }
    ${dest}[0]=(uintptr_t)(${v}).data; ${dest}[1]=(${v}).len;${integer?" "+dest+"[2]=("+v+").negative;":""}`;
			const valid=n==="char"?"("+v+"<=0x10ffff && !("+v+">=0xd800 && "+v+"<=0xdfff))":n==="unit"?v+"==0":null;
			return (valid?"if(!("+valid+")) { "+bad("CR_INVALID")+" }\n    ":"")+dest+"[0]="+encode(n,v)+";";
		};
		const unpack=(v,w,bad,{borrowed=false}={})=>{
			const x="("+w+")";
			if(nominal) return `{ lb_cr_ref r={0}; int c=LB_CR(lift)(${key},${x}[0],&r); if(c) { ${bad("c")} } ${v}=(${type}){{r.domain,r.ticket}}; }`;
			if(dyn) return v+"=("+ (borrowed?arg:type)+"){("+(borrowed?"const ":"")+(integer?"uint64_t":"uint8_t")+" *)(uintptr_t)"+x+"[0],(size_t)"+x+"[1]"+(integer?",(bool)"+x+"[2]":"")+"};";
			return v+"="+(n==="float32"?"lb_get_f32("+x+"[0])":n==="float64"?"lb_get_f64("+x+"[0])":"("+type+")"+x+"[0]")+";";
		};
		return {type,arg,key,raw,clear,empty,pack,unpack,nominal,dyn,integer,tag};
	};
	const scalar=tag=>typeof tag==="number"?simple(null,tag,tag):simple(tag,tag);
	const byRef=(t,name,depth=0)=>{
		if(depth>64) throw new TypeError("C host result exceeds 64 layers");
		if(t.kind==="primitive") return scalar(t.name);
		if(t.kind==="named")
		{
			const k=ir.types.findIndex(v=>v.id===t.id);
			if(k>=0) return scalar(k);
		}
		if(t.kind!=="apply" || t.constructor!=="result" || t.arguments.length!==2)
			throw new TypeError("Unsupported C application host type: "+t.kind);
		const a=byRef(t.arguments[0],name+"_value",depth+1),b=byRef(t.arguments[1],name+"_error",depth+1);
		const type=p+name;
		defs.push("typedef struct { bool ok; "+a.type+" value; "+b.type+" error; } "+type+";");
		return {
			type
			, empty: v=>"("+a.empty("("+v+").value")+" && "+b.empty("("+v+").error")+")"
			, clear: v=>"if(("+v+").ok) { "+a.clear("("+v+").value")+" } else { "+b.clear("("+v+").error")+" }"
			, unpack: (v,w,bad)=>"if(tags["+depth+"]>1) { "+bad("CR_INVALID")+" } ("+v+").ok=tags["+depth+"]!=0; if(("+v+").ok) { "+a.unpack("("+v+").value",w,bad)+" } else { "+b.unpack("("+v+").error",w,bad)+" }"
		};
	};
	return {scalar,byRef};
};
