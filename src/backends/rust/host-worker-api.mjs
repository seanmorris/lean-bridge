/** @file Generate typed Rust futures and streams over the compiled, scoped host-object wire. */
import { canonicalJson, sha256 } from "../../capsule/node.mjs";

const fail=m=>{throw new TypeError("Invalid Rust host worker: "+m);};
const eq=(a,b)=>a!==undefined && b!==undefined && canonicalJson(a)===canonicalJson(b);
const quote=JSON.stringify;
const aliases={start: "Start",poll: "Poll",close: "Act",take: "Take",pull: "Act",callbacks: "Poll",next: "Next",arg: "Arg",reply: "Reply",fail: "Fail",trap: "Trap"};

/**
 * Resolve public types using elaborated entries and independently check the native
 * carriers, nominal class identities, callback sites and wire discriminators.
 *
 * @param pkg - Compiler output for the selected Cargo host.
 * @param c - Synchronous facade type and scalar codecs.
 */
export const rustHostWorkers=(pkg,c)=>{
	const {wire,entries,model,ir,prefix,domainId}=pkg, kinds=new Map(), symbols=new Map(), descriptors=[],methods=[];
	const symbol=(name,ty)=>{
		if(!/^[a-z][a-z0-9_]*$/u.test(name) || symbols.has(name)) fail("native symbol "+name);
		const field="f"+symbols.size;symbols.set(name,{field,ty});return field;
	};
	if(!/^lbwire_lbc_[a-z][a-z0-9_]*_v1_clear$/u.test(wire.clear)) fail("release symbol");
	const stem=wire.clear.slice(0,-6);
	if(wire.wait?.open!==stem+"_wait_open" || wire.wait.close!==stem+"_wait_close") fail("retirement subscription");
	const visit=symbol(prefix+"_visit","w::Visit"),object=symbol(prefix+"_object","w::Object"),clear=symbol(wire.clear,"p::Clear");
	const open=symbol(wire.wait.open,"w::WaitOpen"),shut=symbol(wire.wait.close,"w::WaitClose");
	if(wire.leases?.length!==model.kinds.length) fail("missing class leases");
	for(const [i,k] of model.kinds.entries())
	{
		const hash=sha256(canonicalJson(["static-worker-object/v1","rust",domainId,k.key])), lease=wire.leases[i];
		if(!lease.host || lease.hash!==hash || lease.type!=="host:"+hash || lease.tag!==3+i || lease.name!==k.name || lease.symbol!==stem+"_lease_"+i) fail(k.name);
		kinds.set(ir.types[i].id,lease.type);
	}
	const shape=t=>t.kind==="primitive"?t.name:t.kind==="named"?kinds.get(t.id):t.kind==="io-callback"?"callback"
		:t.kind==="apply" && t.constructor==="result" && t.arguments.length===2?t.arguments.map(shape):fail("unsupported carrier");
	const type=t=>t.kind==="apply"?"Result<"+t.arguments.map(type).join(",")+">":c.subject(c.track(c.ref(t)),"H","HostRef");
	const decode=(t,depth=0)=>{
		if(depth>64) fail("result depth");
		if(t.kind==="apply") return "if o.branch("+depth+")?{Ok("+decode(t.arguments[0],depth+1)+")}else{Err("+decode(t.arguments[1],depth+1)+")}";
		const n=c.ref(t);if(typeof n==="number") return "ctx.output::<H::Object"+n+">("+n+",o)?";
		const w="o.tagged("+ (["bytes","string"].includes(n)?1:c.isBig(n)?2:0) +")?";
		// The worker ABI uses C's sign-extended integer conversion; the
		// synchronous member ABI carries narrow signed values as unsigned bits.
		if(/^int(?:8|16|32)$/u.test(n)) return c.primitive(n)+"::try_from(p::single("+w+",u64::MAX)? as i64).map_err(|_|Fault::Protocol)?";
		return c.readScalar(n,w);
	};
	const encode=(t,v,reply=false)=>{
		const n=c.ref(t);if(typeof n==="number") return "ctx.input("+n+","+(reply?"&":"")+v+")?";
		return c.encode(n,reply && n==="bytes"?v+".as_slice()":v,"ctx.scratch()",false);
	};
	const workerEntries=entries.filter(e=>e.delivery);
	if(!workerEntries.length || workerEntries.length!==wire.methods.length) fail("method count");
	for(const [i,e] of workerEntries.entries())
	{
		const m=wire.methods[i], cb=e.parameters.flatMap(({type: t},j)=>t.kind==="io-callback"?[[j,shape(t.argument),shape(t.reply)]]:[]);
		const stream=e.delivery==="async-iterator", retained=cb.length>0, d=quote(e.declaration);
		if(m.symbol!==stem+"_"+i || e.name!==m.name || e.declaration!==m.declaration || e.effect!==m.effect || m.delivery!==e.delivery || !["task","async-iterator"].includes(e.delivery)
			|| !eq(m.args,e.parameters.map(p=>shape(p.type))) || !eq(m.result,shape(e.result)) || !eq(m.callbacks??[],cb)
			|| (e.effect==="EIO" && !eq(m.error,shape(e.error))) || (stream && (e.protocol.next!==m.stepDeclaration || Boolean(m.stepIO)!==Boolean(e.stepIO)))
			|| (e.stepError && !eq(m.terminal,shape(e.stepError))) || !Number.isInteger(m.tagBytes) || m.tagBytes<1 || m.tagBytes>65 || retained && stream) fail(e.declaration);
		const name=c.name(e.name);if(c.names.has(name)) fail("duplicate "+name);c.names.add(name);
		const f={};for(const op of ["start","take","poll","close",...stream?["pull"]:[],...retained?["callbacks","next","arg","reply","fail","trap"]:[]])
		{
			if(m.names[op]!==m.symbol+"_"+op) fail(op);f[op]=symbol(m.names[op],"w::"+aliases[op]);
		}
		descriptors.push("w::Methods{start:"+f.start+",take:"+f.take+",poll:"+f.poll+",close:"+f.close+",pull:"+(stream?"Some("+f.pull+")":"None")+",callbacks:"
			+(retained?"Some(w::CallbackFns{fd:"+f.callbacks+",next:"+f.next+",arg:"+f.arg+",reply:"+f.reply+",fail:"+f.fail+",trap:"+f.trap+"})":"None")+"}");
		const params=[],words=[],cases=[],generics=[];
		for(const [j,{type: t}] of e.parameters.entries())
		{
			const v="v"+j;
			if(t.kind==="io-callback")
			{
				const to=c.ref(t.reply), r=typeof to==="number"?"R"+j:type(t.reply);
				if(typeof to==="number") generics.push(r+":AsHost<H::Object"+to+">+'static");
				params.push(v+":impl Fn("+type(t.argument)+")->Result<"+r+",CallbackError>+'static");words.push("[0;3]");
				cases.push(j+"=>{let arg=s.arg(slot,|ctx,o|Ok("+decode(t.argument)+"))?;let v="+v+"(arg)?;unsafe{s.reply(slot,|ctx|Ok("+encode(t.reply,"v",true)+"))?;}Ok(())}");continue;
			}
			const n=c.track(c.ref(t));
			params.push(v+":"+(typeof n==="number"?"&impl AsHost<H::Object"+n+">":n==="string"?"&str":n==="bytes"?"&[u8]":(c.isBig(n)?"&":"")+c.primitive(n)));
			words.push(encode(t,v));
		}
		const factory=!retained && e.effect==="EIO"?type(e.error):"Infallible";
		const late=e.stepError?type(e.stepError):retained && e.effect==="EIO"?type(e.error):"Infallible";
		const host=retained?"CallbackError":"Infallible", out=type(e.result);
		const err=()=> "Err(lean_bridge_host_runtime::abi::status(rc).err().unwrap_or(Fault::Protocol).into())";
		const io=(phase,decl)=>"Err(Fault::"+phase+"{declaration:"+decl+",message:"+decode({kind: "primitive",name: "string"})+"}.into())";
		const bad=(!retained && e.effect==="EIO"?"3=>Err(Error::Start("+decode(e.error)+")),":"")+(!retained && e.effect==="IO"?"4=>"+io("Io",d)+",":"");
		const take=["0=>Ok(Some("+decode(e.result)+"))",...stream?["2=>Ok(None)"]:[]
			, ...e.stepError?["3=>Err(Error::Step("+decode(e.stepError)+"))"]:[]
			, ...retained && e.effect==="EIO"?["3=>Err(Error::Start("+decode(e.error)+"))"]:[]
			, ...e.stepIO || e.taskIO?["4=>"+io("TaskIo",e.stepIO?quote(e.protocol.next):d)]:[]
			, ...retained && e.effect==="IO"?["13=>"+io("Io",d)]:[]
			, ...retained?["14=>{let id=p::single(o.tagged(0)?,u32::MAX as u64)?;Err(Error::Callback{declaration:"+d+",error:errors.get(id.checked_sub(1).ok_or(Fault::Protocol)? as usize).cloned().ok_or(Fault::Protocol)?})}"]:[]
			, "_=>"+err()];
		const channel=stream?"Items<"+out+","+late+">":"Task<"+out+","+late+","+host+">";
		methods.push("#[allow(unused_variables)] pub fn "+name+(generics.length?"<"+generics.join(",")+">":"")+"(&self"+(params.length?","+params.join(","):"")+")->Result<"+channel+",Error<"+factory+">>{"
			+"let args=|ctx:&mut w::Scope<'_>|Ok(vec!["+words.join(",")+"]);"
			+"let bad:w::DecodeStart<"+factory+">=|ctx,o,rc|match rc{"+bad+"_=>"+err()+"};"
			+"let take:w::Decode<"+out+","+late+","+host+">=|ctx,o,rc,errors|match rc{"+take.join(",")+"};"
			+"let handler:Option<Box<w::Handler>>="+(retained?"Some(Box::new(move|s,slot|match slot{"+cases.join(",")+",_=>Err(Fault::Protocol.into())}))":"None")+";"
			+"let ch=unsafe{self.workers.start("+d+",self.methods["+i+"],args,bad,take,handler)?};Ok("+(stream?"Items":"Task")+"::from_source(ch))}");
	}
	const count=descriptors.length, sources=[...symbols];
	const nativeType="(w::Visit,w::Object,p::Clear,w::Wait,[w::Methods;"+count+"])";
	const load=pkg.embedded?"let h=component()? as *mut std::ffi::c_void; unsafe extern \"C\"{fn dlsym(h:*mut std::ffi::c_void,s:*const std::ffi::c_char)->*mut std::ffi::c_void;}":"";
	const read=sources.map(([s,{field,ty}])=>{
		const address=pkg.embedded?"unsafe{dlsym(h,c"+quote(s)+".as_ptr())}":field+"_symbol as *mut std::ffi::c_void";
		return (pkg.embedded?"":"unsafe extern \"C\"{#[link_name="+quote(s)+"] fn "+field+"_symbol();}")
			+"let p="+address+";if p.is_null(){return Err(Fault::Load("+quote("Missing Rust worker symbol "+s)+".into()))} let "+field+"=unsafe{std::mem::transmute::<*mut std::ffi::c_void,"+ty+">(p)};";
	});
	const functions="use p::worker as w;pub use lean_bridge_host_runtime::{Task,Items,Error,CallbackError,RetainedCallback};"
		+"fn worker_functions()->Result<"+nativeType+",Fault>{lean_bridge_host_runtime::owner::check_context()?;static F:std::sync::OnceLock<Result<"+nativeType+",Fault>>=std::sync::OnceLock::new();"
		+"F.get_or_init(||{"+load+read.join("")+"Ok(("+visit+","+object+","+clear+",w::Wait{open:"+open+",close:"+shut+"},["+descriptors.join(",")+"]))}).clone()}";
	return {functions,methods,count};
};
