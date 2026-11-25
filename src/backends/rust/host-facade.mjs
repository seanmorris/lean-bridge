/** @file Generate safe Rust methods over source-checked Lean entries and application Rc objects. */
import { hostDeclarationName } from "../../abi/host-member-names.mjs";
import { cIdentifier } from "../c/generate.mjs";
import { rustHostWorkers } from "./host-worker-api.mjs";

const reserved = new Set("as async await box break const continue dyn else enum extern false fn for gen if impl in let loop match mod move mut pub ref return static struct trait true type unsafe use where while yield abstract become do final macro override priv try typeof unsized virtual".split(" "));
const ident = s => {
	if(!/^[a-zA-Z][a-zA-Z0-9_]*$/u.test(s)) throw new TypeError("Invalid Rust host identifier: " + s);
	return ["Self","self","super","crate"].includes(s) ? s + "_" : reserved.has(s) ? "r#" + s : s;
};
const ints = n => /^(u?)int(8|16|32|64)$/u.exec(n);
const isBig = n => n === "int" || n === "nat";
const primitive = n => {
	const i = ints(n);
	if(i) return (i[1] ? "u" : "i") + i[2];
	const t = {unit: "()",bool: "bool",char: "char",usize: "usize",isize: "isize",float32: "f32",float64: "f64",string: "String",bytes: "Vec<u8>",int: "BigInt",nat: "BigUint"}[n];
	if(!t) throw new TypeError("Unsupported Rust host carrier " + n); return t;
};
const readScalar = (n,w) => {
	const i=ints(n),single=max=>"p::single("+w+","+max+")?";
	if(i) return single("u"+i[2]+"::MAX as u64")+" as "+primitive(n);
	if(n==="string") return "String::from_utf8(unsafe{p::bytes("+w+")?}).map_err(|_|Fault::Protocol)?";
	if(n==="bytes") return "unsafe{p::bytes("+w+")?}";
	if(isBig(n)) return (n==="nat"?"magnitude("+w+",true)?":"signed("+w+")?");
	if(n==="unit") return "{"+single("0")+";()}";
	if(n==="bool") return single("1")+"!=0";
	if(n==="char") return "char::from_u32("+single("u32::MAX as u64")+" as u32).ok_or(Fault::Protocol)?";
	if(n==="float32" || n==="float64") return primitive(n)+"::from_bits("+single(n==="float32"?"u32::MAX as u64":"u64::MAX")+" as _)";
	return single("u64::MAX")+" as "+primitive(n);
};
const encode = (n,v,s,reply) => {
	const i=ints(n);
	if(n==="string" || n==="bytes") return reply?s+".reply_bytes("+v+(n==="string"?".into_bytes()":"")+")?":s+".copy_bytes("+v+(n==="string"?".as_bytes()":"")+")?";
	if(isBig(n))
	{
		const mag=n==="int"?v+".magnitude()":v;
		return "{if "+mag+".bits()>16*1024*1024*8{return Err(Fault::Limit.into())} "+s+"."+(reply?"reply_integer":"integer")+"("+mag+".to_u64_digits(),"+(n==="int"?v+".sign()==Sign::Minus":"false")+")?}";
	}
	const x=i?v+" as u"+i[2]+" as u64":n==="unit"?"{let _="+v+";0}":n.startsWith("float")?v+".to_bits() as u64":v+" as u64";
	return "["+x+",0,0]";
};

/**
 * Emit the typed call surface and application-member forwarding macro.
 *
 * @param pkg - Compiled Rust host pair model; the symbol names are content-qualified.
 */
export const rustHostFacade = pkg => {
	const {ir,model,entries,domainId,prefix}=pkg;
	if(!/^[a-f0-9]{64}$/u.test(domainId) || !/^lb_rust_host_[a-f0-9]{64}$/u.test(prefix)) throw new TypeError("Invalid Rust native host identity");
	const nominal=n=>typeof n==="number", ref=t=>{
		if(t.kind==="primitive") return t.name;
		const i=ir.types.findIndex(x=>x.id===t.id); if(t.kind==="named" && i>=0) return i;
		throw new TypeError("Unknown Rust host value");
	};
	const assoc=(i,base)=>base==="macro"?"$t"+i:base+"::Object"+i;
	const subject=(n,base,shape)=>nominal(n)?(base==="macro"?"$crate::":"")+shape+"<"+assoc(n,base)+">":(base==="macro" && isBig(n)?"$crate::":"")+primitive(n);
	const types=[],methods=[],impl=[],cases=[],exports=[],kindArgs=[],patterns=[];
	let needsBig=false;
	const track=n=>{if(isBig(n)) needsBig=true;return n;};
	for(const [i,k] of model.kinds.entries())
	{
		types.push("type Object"+i+":'static;"); impl.push("type Object"+i+"=$t"+i+";");
		patterns.push(ident(k.name)+"=$t"+i+":ty");kindArgs.push("Kind::of::<H::Object"+i+">("+JSON.stringify(k.key)+")");
	}
	for(const [j,m] of model.members.entries())
	{
		const args=m.args.map(track),r=track(m.result),self=["method","get","set"].includes(m.op),borrow=m.resultOwnership==="borrow";
		const name=ident(cIdentifier(hostDeclarationName(ir.declarations.find(d=>d.id===m.id))));
		const sig=base=>"fn member"+j+"("+args.map((v,i)=>"v"+i+":"+subject(v,base,"HostRef")).join(",")+")->"+(base==="macro"?"$crate::":"")+"MemberResult<"+subject(r,base,borrow?"Borrowed":"Rc")+">";
		methods.push(sig("Self")+";");
		const actual=args.map((v,i)=>"v"+i+(nominal(v)?".as_rc()"+(m.inputOwnership[i]==="borrow"?"":".clone()"):""));
		const call=(self?actual[0]+".":"<$t"+m.owner+">::")+name+"("+actual.slice(self?1:0).join(",")+")";
		impl.push(sig("macro")+"{$crate::__port::IntoReply::into_reply("+call+")}");
		const vs=args.map((v,i)=>"let v"+i+"="+(nominal(v)?"f.object::<H::Object"+v+">("+v+",arg["+i+"])?":readScalar(v,"arg["+i+"]"))+";");
		const out=nominal(r)?(borrow?"f.reply_borrow("+r+",value,&anchor)?":"f.reply_object("+r+",value)?"):encode(r,"value","f",true);
		cases.push(j+"=>{if arg.len()!="+args.length+"{return Err(Fault::Protocol.into())}"+vs.join("")+(borrow?"let anchor=v"+m.anchor+".clone();":"")+" let value=H::member"+j+"("+args.map((_,i)=>"v"+i).join(",")+")?;Ok("+out+")}");
	}
	const sum=t=>t.kind==="apply" && t.constructor==="result" && t.arguments.length===2;
	const decode=(t,depth=0,port="self.port")=>{
		if(depth>64) throw new TypeError("Rust host result depth exceeded");
		if(sum(t))
		{
			const [a,b]=t.arguments.map(k=>decode(k,depth+1,port)); return {ty: "Result<"+a.ty+","+b.ty+">",expr: "if o.branch("+depth+")? {Ok("+a.expr+")}else{Err("+b.expr+")}"};
		}
		const v=track(ref(t));return {ty: subject(v,"H","HostRef"),expr: nominal(v)?port+".output::<H::Object"+v+">("+v+",o.word())?":readScalar(v,"o.word()")};
	};
	const names=new Set(["new","close"]),returned=[],typeNames=new Set(),sync=entries.filter(e=>!e.delivery);
	const parameter=v=>nominal(v)?"&impl AsHost<H::Object"+v+">":v==="string"?"&str":v==="bytes"?"&[u8]":(isBig(v)?"&":"")+primitive(v);
	const input=(v,i,port)=>nominal(v)?port+".input("+v+",v"+i+",&mut scratch)?":encode(v,"v"+i,"scratch",false);
	const scratch=vs=>vs.some(v=>nominal(v)||["string","bytes","int","nat"].includes(v))?"let mut scratch=Scratch::default();":"";
	for(const [j,e] of sync.entries())
	{
		const n=ident(cIdentifier(e.name)),args=e.parameters.map(p=>track(ref(p.type)));
		if(names.has(n)) throw new TypeError("Reserved Rust host binding entry: "+n); names.add(n);
		const ps=args.map((v,i)=>"v"+i+":"+parameter(v)),ws=args.map((v,i)=>input(v,i,"self.port"));
		if(e.result.kind==="io-closure")
		{
			if(e.effect!=="IO") throw new TypeError("Rust returned functions require an IO factory");
			const cls="Returned"+cIdentifier(e.name).split("_").filter(Boolean).map(s=>s[0].toUpperCase()+s.slice(1)).join("");
			if(typeNames.has(cls) || cls==="ReturnedOwner") throw new TypeError("Reserved Rust returned-function type: "+cls);typeNames.add(cls);
			const a=track(ref(e.result.argument)),r=decode(e.result.reply,0,"h.port"),decl=JSON.stringify(e.declaration);
			returned.push("pub struct "+cls+"<H:Host>{owner:std::rc::Weak<ReturnedOwner>,ticket:std::cell::Cell<u64>,_types:PhantomData<H>} impl<H:Host> "+cls+"<H>{"
				+"pub fn call(&self,v0:"+parameter(a)+")->Result<"+r.ty+",HostCallError>{"
				+"let h=self.owner.upgrade().ok_or(Fault::Closed)?;let id=self.ticket.get();if id==0{return Err(Fault::Closed.into())}"
				+scratch([a])+"let ws=[[id,0,0],"+input(a,0,"h.port")+"];let (o,failed)=unsafe{h.port.execute("+(sync.length+j)+",&ws,"+decl+")?};"
				+"if failed{return Err(Fault::Protocol.into())}Ok("+r.expr+")}"
				+"pub fn close(&self)->Result<(),Fault>{let Some(h)=self.owner.upgrade()else{return Ok(())};lean_bridge_host_runtime::owner::check_context()?;"
				+"let id=self.ticket.replace(0);if id==0{return Ok(())}match unsafe{h.port.execute::<Infallible>("+(2*sync.length+j)+",&[[id,0,0]],"+decl+")}{"
				+"Ok((_,false))|Err(HostCallError::Boundary(Fault::Closed))=>Ok(()),Err(HostCallError::Boundary(e))=>{self.ticket.set(id);Err(e)},_=>Err(Fault::Protocol)}}}"
				+"impl<H:Host> Drop for "+cls+"<H>{fn drop(&mut self){let _=self.close();}}");
			exports.push("pub fn "+n+"(&self"+(ps.length?","+ps.join(","):"")+")->Result<"+cls+"<H>,HostCallError>{"+scratch(args)+"let ws=["+ws.join(",")+"];"
				+"let (o,failed)=unsafe{self.port.execute("+j+",&ws,"+decl+")?};let id=p::single(o.word(),u64::MAX)?;if failed || id==0{return Err(Fault::Protocol.into())}"
				+"Ok("+cls+"{owner:Rc::downgrade(&self.owner),ticket:std::cell::Cell::new(id),_types:PhantomData})}");
			continue;
		}
		const ret=decode(e.result),err=e.effect==="EIO"?decode(e.error):null;
		exports.push("pub fn "+n+"(&self"+(ps.length?","+ps.join(","):"")+")->Result<"+ret.ty+",HostCallError<"+(err?err.ty:"Infallible")+">>{"
			+scratch(args)+"let ws=["+ws.join(",")+"];"
			+"let (o,failed)=unsafe{self.port.execute("+j+",&ws,"+JSON.stringify(e.declaration)+")?};if failed {"
			+(err?"return Err(HostCallError::Declared{declaration:"+JSON.stringify(e.declaration)+",payload:"+err.expr+"});":"return Err(Fault::Protocol.into());")+"} Ok("+ret.expr+")}");
	}
	const workers=pkg.wire?rustHostWorkers(pkg,{track,ref,subject,readScalar,encode,primitive,isBig,names,name: s=>ident(cIdentifier(s))}):null;
	if(!workers && entries.some(e=>e.delivery)) throw new TypeError("Missing Rust host worker wire");
	return [
		...pkg.embedded?["extern crate lean_bridge_task_runtime as lean_bridge_host_runtime; mod assets;"]:[]
		, "pub use lean_bridge_host_runtime::{Fault,owner::{HostRef,Borrowed},port::{MemberResult,HostError,HostCallError}};"
		, "#[doc(hidden)] pub use lean_bridge_host_runtime::port as __port; pub use std::rc::Rc;"
		, "use lean_bridge_host_runtime::{owner::Kind,port::{self as p,AsHost,Connection,Scratch,Frame,Failure,Word}}; use std::{convert::Infallible,marker::PhantomData};"
		, ...needsBig?["pub use num_bigint::{BigInt,BigUint}; use num_bigint::Sign;"
			, "fn magnitude(w:Word,nat:bool)->Result<BigUint,Fault>{let limbs=unsafe{p::limbs(w,nat)?}; let digits:Vec<u32>=limbs.into_iter().flat_map(|n|[n as u32,(n>>32) as u32]).collect();Ok(BigUint::new(digits))}"
			, "fn signed(w:Word)->Result<BigInt,Fault>{Ok(BigInt::from_biguint(if w[2]==1{Sign::Minus}else{Sign::Plus},magnitude(w,false)?))}"]:[]
		, "#[doc(hidden)] pub trait Host:'static {"+types.join("\n")+methods.join("\n")+"}"
		, "#[macro_export] macro_rules! bind_objects {($vis:vis $marker:ident {"+patterns.join(",")+" $(,)?})=>{$vis struct $marker; impl $crate::Host for $marker {"+impl.join("\n")+"}};}"
		, "unsafe fn member<H:Host>(f:&Frame,op:i32,arg:&[Word])->Result<Word,Failure>{match op{"+cases.join(",")+",_=>Err(Fault::Protocol.into())}}"
		, pkg.embedded?[
			"fn component()->Result<usize,Fault>{static C:std::sync::OnceLock<Result<usize,Fault>>=std::sync::OnceLock::new();lean_bridge_host_runtime::owner::check_context()?;C.get_or_init(assets::load).clone()}"
			, "fn functions()->Result<(p::Call,p::Clear),Fault>{use std::ffi::{c_char,c_void}; use std::sync::OnceLock;"
			, "#[link(name=\"dl\")] extern \"C\" {fn dlsym(h:*mut c_void,s:*const c_char)->*mut c_void;}"
			, "static F:OnceLock<Result<(p::Call,p::Clear),Fault>>=OnceLock::new(); lean_bridge_host_runtime::owner::check_context()?;"
			, "F.get_or_init(||{let h=component()? as *mut c_void;unsafe{let a=dlsym(h,c\""+prefix+"_call\".as_ptr());let b=dlsym(h,c\""+prefix+"_clear\".as_ptr());"
			, "if a.is_null() || b.is_null(){return Err(Fault::Load(\"Missing checked Rust host entry\".into()))}Ok((std::mem::transmute::<*mut c_void,p::Call>(a),std::mem::transmute::<*mut c_void,p::Clear>(b)))}}).clone()}"
		].join("\n"):"#[link(name="+JSON.stringify(prefix)+")] extern \"C\" {#[link_name="+JSON.stringify(prefix+"_call")+"] fn entry(cookie:usize,id:u64,d:p::Dispatch,op:i32,a:*const u64,n:usize,o:*mut u64,t:*mut u8,e:*mut u32)->i32; #[link_name="+JSON.stringify(prefix+"_clear")+"] fn clear(o:*mut u64);}"
		, ...workers?[workers.functions]:[]
		, ...returned.length?["struct ReturnedOwner{port:Rc<Connection>"+(workers?",workers:Rc<w::Workers>":"")+"} impl Drop for ReturnedOwner{fn drop(&mut self){"+(workers?"self.workers.shutdown();":"let _=self.port.close();")+"}}",...returned]:[]
		, "pub struct Binding<H:Host>{port:"+(workers || returned.length?"Rc<Connection>":"Connection")+(returned.length?",owner:Rc<ReturnedOwner>":"")+(workers?",workers:Rc<w::Workers>,methods:[w::Methods;"+workers.count+"]":"")+",_types:PhantomData<H>} impl<H:Host> Binding<H>{"
		, "pub fn new()->Result<Self,Fault>{"+(pkg.embedded?"let(entry,clear)=functions()?;":"")+(workers?"let(visit,object,release,wait,methods)=worker_functions()?;":"")+"let port=unsafe{Connection::"+(returned.length?"open_with_returned_functions":"open")+"("+JSON.stringify(domainId)+",vec!["+kindArgs.join(",")+"],entry,clear,member::<H>)?};"+(workers || returned.length?"let port=Rc::new(port);":"")+(workers?"let workers=unsafe{w::Workers::new(port.clone(),visit,object,release,wait)};":"")+(returned.length?"let owner=Rc::new(ReturnedOwner{port:port.clone()"+(workers?",workers:workers.clone()":"")+"});":"")+"Ok(Self{port,"+(returned.length?"owner,":"")+(workers?"workers,methods,":"")+"_types:PhantomData})}"
		, "pub fn close(&self)->Result<(),Fault>{self."+(workers?"workers":"port")+".close()}"
		, ...exports
		, ...workers?.methods??[]
		, "}"
		, ...workers && !returned.length?["impl<H:Host> Drop for Binding<H>{fn drop(&mut self){self.workers.shutdown();}}"]:[]
		, ""
	].join("\n");
};
