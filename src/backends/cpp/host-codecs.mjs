/** @file Translate checked C++ host member values, including nested result ownership. */
import {cIdentifier} from "../c/generate.mjs";

/**
 * Model each public C++ type alongside its component-private C argument and
 * result. Generate guards before any conversion that can throw.
 *
 * @param o - Captured host IR, kinds, and private C prefix.
 */
export const cppHostCodecs=o=>{
	const {ir,model,p}=o;
	const primitive={bool:"bool",char:"char32_t",usize:"size_t",isize:"intptr_t",float32:"float",float64:"double",unit:"std::monostate",string:"std::string",bytes:"std::vector<uint8_t>",int:"boost::multiprecision::cpp_int",nat:"boost::multiprecision::cpp_int"};
	for(const w of [8,16,32,64]) for(const s of ["","u"]) primitive[s+"int"+w]=s+"int"+w+"_t";
	let big=false;
	const scalar=n=>{
		const k=typeof n==="number",buf=n==="string"||n==="bytes",integer=n==="int"||n==="nat";
		if(integer) big=true;
		const nominal=k?p+cIdentifier(model.kinds[n].name):null;
		const type=k?"std::shared_ptr<T"+n+">":primitive[n];
		if(!type) throw new TypeError("No C++ host value for "+n);
		const raw=k?nominal:buf?p+"buffer":integer?p+"integer":n==="unit"?"uint8_t":n==="char"?"uint32_t":type;
		const arg=buf?p+"view":integer?p+"integer_view":raw;
		const clear=v=>k?nominal+"_drop(&("+v+"));":buf?p+"buffer_clear(&("+v+"));":integer?p+"integer_clear(&("+v+"));":"";
		const read=v=>k?"share"+n+"("+v+")":buf?"hd::"+(n==="string"?"text":"bytes")+"("+v+")":integer?"read_integer("+v+")":n==="unit"?"std::monostate{}":"static_cast<"+type+">("+v+")";
		const write=(src,out)=>k?"if(!"+src+") return 0; "+out+"=pin"+n+"("+src+");":buf?"hd::copy_to("+out+","+src+");":integer?"write_integer("+out+","+src+","+(n==="nat")+");":out+"=static_cast<"+raw+">("+src+");";
		const input=(v,a)=>k?"auto "+a+"=pin"+n+"("+v+"); hd::Finally "+a+"_end([&]{ "+clear(a)+" });"
			:buf?"const "+arg+" "+a+"{reinterpret_cast<const uint8_t*>("+v+".data()),"+v+".size()};"
			:integer?"auto "+a+"_words=limbs("+v+","+(n==="nat")+"); const "+arg+" "+a+"{"+a+"_words.data(),"+a+"_words.size(),"+v+"<0};"
			:n==="unit"?"(void)"+v+"; uint8_t "+a+"=0;":"const auto "+a+"=static_cast<"+arg+">("+v+");";
		return {n,type,raw,arg,k,read,clear,write,input};
	};
	const ref=(t,name,depth=0)=>{
		if(depth>64) throw new TypeError("C++ host result nesting limit");
		if(t.kind==="primitive") return scalar(t.name);
		if(t.kind==="named")
		{
			const i=ir.types.findIndex(k=>k.id===t.id);
			if(i>=0) return scalar(i);
		}
		if(t.kind!=="apply" || t.constructor!=="result" || t.arguments.length!==2) throw new TypeError("Unsupported C++ host result");
		const a=ref(t.arguments[0],name+"_value",depth+1),b=ref(t.arguments[1],name+"_error",depth+1),type="sv::Result<"+a.type+","+b.type+">";
		return {type,raw:p+name,clear:v=>p+name+"_clear(&("+v+"));",read:v=>"("+v+".ok ? "+type+"{sv::Ok<"+a.type+">{"+a.read(v+".value")+"}} : "+type+"{sv::Err<"+b.type+">{"+b.read(v+".error")+"}})"};
	};
	return {scalar,ref,integers:()=>big};
};
