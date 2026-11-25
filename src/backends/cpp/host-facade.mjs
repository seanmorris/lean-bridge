/** @file Generate a C++20 binding to real application classes and original member exceptions. */
import {cIdentifier,cKeywords} from "../c/generate.mjs";
import {cppHostReturnedFunction} from "./host-returned-function.mjs";
import {hostDeclarationName} from "../../abi/host-member-names.mjs";
import {cppHostCodecs} from "./host-codecs.mjs";
import {cppHostWorkers} from "./host-worker-api.mjs";

const id=s=>cKeywords.has(s)?s+"_":s;
const bigSupport=[
	"using Big=boost::multiprecision::cpp_int;"
	, "static std::vector<uint64_t> limbs(const Big& v,bool nat) { if(nat && v<0) throw std::invalid_argument(\"negative Nat\"); constexpr size_t budget=16u*1024u*1024u; if(v.backend().size()>budget/sizeof(*v.backend().limbs())) throw std::length_error(\"C++ integer budget\"); std::vector<uint64_t> w; if(v<0) { Big a=-v; export_bits(a,std::back_inserter(w),64,false); } else if(v!=0) export_bits(v,std::back_inserter(w),64,false); return w; }"
	, "template<class V> static Big read_integer(V v) { Big n=0; if(v.len) import_bits(n,v.data,v.data+v.len,64,false); return v.negative?-n:n; }"
	, "template<class V> static void write_integer(V& out,const Big& n,bool nat) { auto w=limbs(n,nat); hd::copy_to(out,w); out.negative=n<0; }"
].join("\n");

/**
 * Bind application types as template parameters. RTTI and the domain's
 * shared_ptr owner ledger protect every erased conversion. Public callers
 * never implement a dispatch table or pass an exception through a C frame.
 *
 * @param o - Authenticated source, reconciled entries, ABI and private port.
 */
export const cppHostFacade=o=>{
	const {ir,model,entries,facade,identity,ownerPrefix: owner,abi}=o,p=facade.prefix;
	const {scalar,ref,integers}=cppHostCodecs({ir,model,p});
	const classes=model.kinds.map(k=>"Host_"+k.name),keys=model.kinds.map(k=>JSON.stringify(k.key));
	const adapt=model.kinds.map((k,i)=>{
		const raw=scalar(i).raw,T=classes[i];
		return "static "+raw+" pin"+i+"(const std::shared_ptr<"+T+">& x) { "+raw+" r{}; std::shared_ptr<void> erased=x; hd::registry("+owner+"pin_typed("+keys[i]+",&typeid("+T+"),&erased,r._private)); return r; }\n"
			+"static std::shared_ptr<"+T+"> share"+i+"("+raw+" r) { std::shared_ptr<void> x; hd::registry("+owner+"share_typed("+keys[i]+",&typeid("+T+"),r._private,&x)); return std::static_pointer_cast<"+T+">(x); }";
	});
	const table=[],handlers=[];
	for(const [i,m] of model.members.entries())
	{
		const decl=ir.declarations.find(d=>d.id===m.id),member=hostDeclarationName(decl);
		const label=cIdentifier(model.kinds[m.owner].name)+"_"+cIdentifier(member),args=m.args.map(scalar),r=scalar(m.result);
		const self=["method","get","set"].includes(m.op),T=classes[m.owner],unit=r.n==="unit";
		const values=args.map((v,j)=>"auto v"+j+"="+v.read("a"+j)+";");
		const params=args.map((_,j)=>"std::move(v"+j+")").slice(self?1:0).join(",");
		const call=m.op==="constructor"?"std::make_shared<"+T+">("+params+")":(self?"v0->":T+"::")+id(member)+"("+params+")";
		const borrowed=m.resultOwnership==="borrow";
		table.push("methods."+label+"=&member"+i+";");
		handlers.push("static uint32_t member"+i+"("+["void *ctx",...args.map((v,j)=>v.arg+" a"+j),...unit?[]:[r.raw+" *out"]].join(",")+") noexcept {"
			+" auto &s=*static_cast<State*>(ctx);"
			+args.flatMap((v,j)=>v.k && m.inputOwnership[j]!=="borrow"?["hd::Finally release"+j+"([&]{ "+v.clear("a"+j)+" });"]:[]).join(" ")
			+" try { "+values.join(" ")+(borrowed?" auto anchor=v"+m.anchor+"; ":" ")+(unit?"":r.type+" value{};")
			+" try { "+(unit?"":"value=")+call+"; } catch(...) { return s.frame->remember(); } "
			+(borrowed?"if(!hd::anchored(value,anchor)) return UINT32_MAX; ":"")
			+(unit?"":r.write("value","*out"))+" return 0; } catch(...) { return UINT32_MAX; } }");
	}
	const names=new Set([
		"close","binding","require","state","pin","share","reset","methods"
		, "frame","check","limbs","read_integer","write_integer","dispose"
		, "release_types"
		, ...o.workerEntries?.length?["worker_check"]:[]
		, ...classes.flatMap((_,i)=>["pin"+i,"share"+i])
		, ...model.members.map((_,i)=>"member"+i)
	]);
	for(const e of [...entries,...o.workerEntries??[]])
	{
		const n=id(cIdentifier(e.name));
		if(names.has(n)) throw new TypeError("C++ binding member name is reserved: "+n);
		names.add(n);
	}
	const exports=entries.map(e=>{
		const name=cIdentifier(e.name);
		if(e.result.kind==="io-closure")return cppHostReturnedFunction({e,p,name,id,ref,async: !!o.workerEntries?.length});
		const args=e.parameters.map(t=>ref(t.type,name+"_arg")),value=ref(e.result,name+"_value"),error=e.effect==="EIO"?ref(e.error,name+"_failure"):null;
		const unit=value.n==="unit",guard=(v,n)=>v.clear(n)?"hd::Finally "+n+"_end([&]{ "+v.clear(n)+" });":"";
		return (unit?"void":value.type)+" "+id(name)+"("+args.map((a,j)=>"const "+a.type+"& v"+j).join(",")+") const {\n"
			+"auto hold=require(); hd::Frame frame(hold->frame); "+p+"diagnostic d{}; hd::Finally d_end([&]{ "+p+"diagnostic_clear(&d); });\n"
			+args.map((a,j)=>a.input("v"+j,"a"+j)).join("\n")+"\n"
			+value.raw+" value{}; "+guard(value,"value")+"\n"+(error?error.raw+" err{}; "+guard(error,"err")+"\n":"")
			+"auto rc="+p+name+"("+["hold->binding",...args.map((_,j)=>"a"+j),"&value",...error?["&err"]:[],"&d"].join(",")+");\n"
			+"if(rc=="+p+"HOST_ERROR) frame.rethrow(d.host_code);\n"
			+"if(rc=="+p+"IO_ERROR) throw sv::IOError("+JSON.stringify(e.declaration)+",hd::text(d.message));\n"
			+(error?"if(rc=="+p+"DECLARED_ERROR) throw sv::DeclaredError<"+error.type+">("+JSON.stringify(e.declaration)+","+error.read("err")+");\n":"")
			+"check(rc); "+(unit?"return;":"return "+value.read("value")+";")+"\n}";
	});
	const stdlib=Object.entries(abi).map(([k,v])=>"!defined("+k+") || "+(k==="__GLIBCXX__"?k+" < "+v:k+" != "+v)).join(" || ");
	const workers=o.workerEntries?.length?cppHostWorkers({entries: o.workerEntries,ir,p,ref,id}):[];
	const async=workers.length>0;
	const guard="LB_CPP_BINDING_"+identity.toUpperCase(), ns=id(cIdentifier(o.name));
	return [
		"#ifndef "+guard
		, "#define "+guard
		, "#include <lean_bridge/sync_v1/host-binding.hpp>"
		, ...async?["#include <lean_bridge/host_async_v1/host-async.hpp>"]:[]
		, ...integers()?["#include <boost/multiprecision/cpp_int.hpp>"]:[]
		, "#if "+stdlib
		, '#error "C++ host package needs its compatible Linux libstdc++ ABI"'
		, "#endif"
		, facade.header
		, 'extern "C" {'
		, "int "+owner+"pin_typed(const char*,const std::type_info*,const std::shared_ptr<void>*,uint64_t*) noexcept;"
		, "int "+owner+"share_typed(const char*,const std::type_info*,const uint64_t*,std::shared_ptr<void>*) noexcept;"
		, "int "+owner+"bind_type(const char*,const std::type_info*) noexcept;"
		, "int "+owner+"unbind_type(const char*,const std::type_info*) noexcept;","}"
		, "namespace lean_bridge::"+ns+" { namespace sv=::lean_bridge::sync_v1; namespace hd=sv::host_detail;"
		, ...async?["namespace av=::lean_bridge::async_v2; namespace ha=::lean_bridge::host_async_v1;"]:[]
		, "template<"+classes.map(T=>"class "+T).join(",")+"> class Binding {"
		, "struct State"+(async?" final":"")+" : hd::Pending"+(async?", av::detail::Deferred":"")+" { "+p+"binding binding{}; hd::Frame *frame=nullptr; size_t claimed=0; bool open=false; "+(async?"bool closing=false; ha::Group jobs; av::detail::Loop& loop=av::detail::Loop::main(); void deliver() noexcept override { dispose(this); }":"")+"};"
		, "std::shared_ptr<State> state;"
		, "static void check("+p+"status rc) { switch(rc) {case "+p+"OK:return; case "+p+"INVALID:throw std::invalid_argument(\"invalid C++ host value\"); case "+p+"STALE:throw sv::Closed{}; case "+p+"LIMIT:throw std::length_error(\"C++ host budget\"); case "+p+"BUSY:throw sv::Busy{}; default:throw sv::Unavailable{};} }"
		, "static void release_types(State& s) noexcept { while(s.claimed) switch(--s.claimed) { "+classes.map((T,i)=>'case '+i+': (void)'+owner+'unbind_type('+keys[i]+',&typeid('+T+')); break;').join(" ")+" } }"
		, "static void dispose(hd::Pending *ptr) noexcept { auto *s=static_cast<State*>(ptr); "+(async?"s->closing=true; s->jobs.close(); ":"")+"if(s->open && "+p+"close(&s->binding)!="+p+"OK) return; release_types(*s); delete s; }"
		, "std::shared_ptr<State> require() const { hd::drain(); if(!state || !state->open) throw sv::Closed{}; if(state->pid!=getpid()) throw sv::WrongContext{}; "+(async?"if(state->closing) throw sv::Busy{}; ":"")+"return state; }"
		, ...adapt,...integers()?[bigSupport]:[],...handlers
		, ...async?["static void worker_check("+p+"status rc){ switch(rc){case "+p+"OK:return;case "+p+"CANCELLED:throw av::Cancelled{};case "+p+"CALLBACK_CLOSED:throw av::CallbackClosed{};case "+p+"STALE:throw av::Closed{};case "+p+"BUSY:throw av::Busy{};case "+p+"UNAVAILABLE:throw av::Unavailable{};default:check(rc);}}"]:[]
		, "public: Binding() { hd::drain(); auto *raw=new State{}; raw->dispose=&dispose; state=std::shared_ptr<State>(raw,[](State *s){ "+(async?"if(s->loop.local())s->deliver();else if(s->loop.same_process())s->loop.post(*s);":"hd::retire(s);")+" });"
		, ...classes.map((T,i)=>"hd::registry("+owner+"bind_type("+keys[i]+",&typeid("+T+"))); ++state->claimed;")
		, p+"hosts methods{}; "+table.join(" ")+" check("+p+"with_hosts(&methods,state.get(),&state->binding)); state->open=true; }"
		, "Binding(const Binding&)=delete; Binding& operator=(const Binding&)=delete; Binding(Binding&&) noexcept=default; Binding& operator=(Binding&&) noexcept=default;"
		, "void close() { if(!state) return; auto s=require(); "+(async?"if(s->frame) throw sv::Busy{}; s->closing=true; hd::Finally restore([&]{s->closing=false;}); s->jobs.close(); ":"")+"check("+p+"close(&s->binding)); s->open=false; release_types(*s); state.reset(); }"
		, ...exports,...workers,"}; }","#endif",""
	].join("\n");
};
