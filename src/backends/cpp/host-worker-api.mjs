/** @file Project checked workers on a C++ application-object binding. */
import {cIdentifier} from "../c/generate.mjs";

/**
 * Render member futures and pull streams over the private typed C port.
 * A host callback only runs on the dispatcher thread, never in a native visit.
 *
 * @param o - Elaborated entries, public C++ codecs, private typed port prefix.
 */
export const cppHostWorkers=o=>{
	const {entries,ir,p,ref,id}=o;
	const guard=(v,k)=>v.clear(k)?"hd::Finally "+k+"_end([&]{ "+v.clear(k)+" });":"";
	const diag=p+"diagnostic d{}; hd::Finally clear_d([&]{ "+p+"diagnostic_clear(&d); });";
	const label=t=>cIdentifier(t.kind==="named"?ir.types.find(k=>k.id===t.id).name:t.name);
	return entries.map(e=>{
		const name=cIdentifier(e.name),c=p+name,decl=JSON.stringify(e.declaration);
		const stream=e.delivery==="async-iterator",v=ref(e.result,name+"_value"),unit=v.n==="unit" && !stream;
		const type=unit?"void":v.type,late=e.stepError?ref(e.stepError,name+"_step_failure"):null;
		const err=e.effect==="EIO"?ref(e.error,name+"_failure"):null,args=[],params=[],lines=[];let callbacks=0;
		for(const [i,{type:t}] of e.parameters.entries()){
			const a="a"+i,s="v"+i;args.push(a);
			if(t.kind!=="io-callback"){
				const x=ref(t,name+"_arg");params.push("const "+x.type+"& "+s);lines.push(x.input(s,a));continue;
			}
			callbacks++;const x=ref(t.argument,name+"_in"),r=ref(t.reply,name+"_out");
			const from=x.n==="unit"?"":x.type,to=r.n==="unit"?"void":r.type,fn="av::RetainedCallback<"+to+"("+from+")>";
			const cb=p+"callback_"+label(t.argument)+"_to_"+label(t.reply);
			params.push(fn+" "+s);
			lines.push(`using F${i}=ha::Callback<${fn}>;auto cell${i}=std::make_unique<F${i}>(F${i}{std::move(${s}),trapped});
${cb} ${a}{}; hd::Finally end_${a}([&]{(void)${cb}_drop(&${a});});
check(${cb}_new([](void *ctx,${x.arg} arg,${r.raw} *reply,${p}diagnostic *failure) noexcept -> ${p}status {
    auto& cell=*static_cast<F${i}*>(ctx);(void)arg;
    try { ${from?"auto input="+x.read("arg")+"; ":""} ${to==="void"?"":to+" value{};"}
        try { ${to==="void"?"":"value="}cell.fn(${from?"std::move(input)":""}); }
        catch(const std::exception& ex){ha::remember(*failure,ex);return ${p}CALLBACK_ERROR;}
        ${to==="void"?"*reply=0;":r.k?"if(!value){throw std::invalid_argument(\"null callback result\");} *reply=pin"+r.n+"(value);":r.write("value","*reply")}
        return ${p}OK; }
    catch(...){} *cell.trapped=true;return ${p}UNAVAILABLE;
},cell${i}.get(),F${i}::dispose,&${a}));cell${i}.release();`);
		}
		const first=callbacks?null:err,fail=late??(callbacks?err:null);
		const slot=(x,k)=>x?x.raw+" "+k+"{}; "+guard(x,k):"";
		const typed=(x,status,cls,k)=>x?"if(s=="+p+status+")throw av::"+cls+"<"+x.type+">{"+decl+","+x.read(k)+"};":"";
		const out=stream?"av::Stream<"+type+">":"av::Future<"+type+">",item=stream?"std::optional<"+type+">":unit?"std::monostate":type;
		return `${out} ${id(name)}(${params.join(",")}) const {
    auto binding=require();hd::Frame starting(binding->frame);auto& loop=av::detail::Loop::main();loop.enter();
    using Port=ha::Port<${c}_handle,${c}_close>;auto port=std::make_shared<Port>();
    ${callbacks?"auto trapped=std::make_shared<bool>(false);":""}
    ${lines.join("\n    ")} ${diag} ${slot(first,"early")}
    auto s=${c}_start(${["binding->binding",...args,"&port->handle",...first?["&early"]:[],"&d"].join(",")});
    ${typed(first,"DECLARED_ERROR","StartError","early")}
    if(s==${p}IO_ERROR){throw av::IOError{${decl},hd::text(d.message)};} worker_check(s);
    auto interest=[port]{int fd=-1;auto status=${c}${callbacks?"_interest":"_poll"}(port->handle,&fd);
        if(status!=${p}PENDING){worker_check(status);}return fd;};
    auto take=[port]() -> ${item} { ${diag} ${slot(v,"value")} ${slot(fail,"failure")}
        auto s=${c}_take(&port->handle,&value,${fail?"&failure,":""}&d);
        ${stream?"if(s=="+p+"END)return {};":""}
        ${typed(fail,late?"STEP_ERROR":"DECLARED_ERROR",late?"StepError":"StartError","failure")}
        if(s==${p}TASK_IO_ERROR)throw av::TaskIOError{${decl},hd::text(d.message)};
        if(s==${p}STEP_IO_ERROR)throw ha::StepIOError{${decl},hd::text(d.message)};
        if(s==${p}IO_ERROR)throw av::IOError{${decl},hd::text(d.message)};
        if(s==${p}CALLBACK_ERROR && d.payload)std::rethrow_exception(*static_cast<std::exception_ptr*>(d.payload));
        worker_check(s);return ${unit?"{}":v.read("value")};};
    auto cancel=[port]{port->close();};
    ${callbacks?`int cfd=-1;worker_check(${c}_callback_fd(port->handle,&cfd));
    auto pump=[port,trapped,weak=std::weak_ptr<State>(binding)]{auto hold=weak.lock();if(!hold)throw av::Closed{};hd::Frame servicing(hold->frame);
        int ignored=-1;auto s=${c}_poll(port->handle,&ignored);if(*trapped)throw av::CallbackTrap{${decl}};
        if(s!=${p}PENDING)worker_check(s);};`:""}
    return binding->jobs.template ${stream?"stream<"+type+">([port]{worker_check("+c+"_pull(port->handle));},":"future<"+type+">("}interest,take,cancel${callbacks?",cfd,pump":""});
}`;
	});
};
