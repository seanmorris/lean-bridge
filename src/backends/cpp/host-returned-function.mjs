/** @file Emit a move-only C++ callable for a compiled Lean IO function on a host binding. */

/**
 * The ticket does not own the binding. An active invocation holds the state,
 * and the C adapter takes its own Lean reference before entering the body.
 * Final destruction on another thread uses the binding profile's owner queue.
 *
 * @param o - Reconciled factory, generated C prefix and checked C++ codecs.
 */
export const cppHostReturnedFunction=o=>{
	const {e,p,name,id,ref,async}=o, cls="Returned_"+name,T=p+name+"_closure";
	const inputs=e.parameters.map(t=>ref(t.type,name+"_arg")),a=ref(e.result.argument,name+"_argument"),r=ref(e.result.reply,name+"_reply");
	const type=r.n==="unit"?"void":r.type,decl=JSON.stringify(e.declaration);
	const dispose=async?"if(v->loop.local())v->deliver();else if(v->loop.same_process())v->loop.post(*v);":"hd::retire(v);";
	const guard=async?"if(h->closing) throw sv::Busy{};":"";
	const errors=`if(rc==${p}HOST_ERROR) frame.rethrow(d.host_code);
            if(rc==${p}IO_ERROR) throw sv::IOError(${decl},hd::text(d.message));
            check(rc);`;
	const frame=`hd::Frame frame(h->frame); ${p}diagnostic d{}; hd::Finally diag_end([&]{${p}diagnostic_clear(&d);});`;
	return `class ${cls} {
        friend class Binding;
        struct Record final : hd::Pending${async?", av::detail::Deferred":""} {
            std::weak_ptr<State> owner; ${T} raw{}; bool armed=false;
            ${async?"av::detail::Loop& loop=av::detail::Loop::main(); void deliver() noexcept override { reclaim(this); }":""}
            static void reclaim(hd::Pending *base) noexcept {
                auto *v=static_cast<Record*>(base);
                if(v->armed) if(auto h=v->owner.lock(); h && h->open) (void)${p}${name}_drop(&v->raw);
                delete v;
            }
            explicit Record(const std::shared_ptr<State>& h):owner(h) { this->dispose=&reclaim; }
        };
        std::shared_ptr<Record> record;
        explicit ${cls}(const std::shared_ptr<State>& h):record(new Record(h),[](Record *v){${dispose}}) {}
    public:
        ${cls}(const ${cls}&)=delete; ${cls}& operator=(const ${cls}&)=delete;
        ${cls}(${cls}&&) noexcept=default; ${cls}& operator=(${cls}&&) noexcept=default;
        ${type} operator()(const ${a.type}& arg) const {
            hd::drain(); if(!record) throw sv::Closed{};
            if(record->pid!=getpid()) throw sv::WrongContext{};
            auto h=record->owner.lock(); if(!h || !h->open) throw sv::Closed{}; ${guard}
            auto raw=record->raw; ${frame}
            ${a.input("arg","input")}
            ${r.raw} value{}; ${r.clear("value")?"hd::Finally value_end([&]{ "+r.clear("value")+" });":""}
            auto rc=${p}${name}_call(&raw,input,&value,&d); ${errors}
            ${type==="void"?"return;":"return "+r.read("value")+";"}
        }
        void close() {
            hd::drain(); if(!record) return;
            if(record->pid!=getpid()) throw sv::WrongContext{};
            auto h=record->owner.lock();
            if(h && h->open) { ${guard} }
            // Detach the C++ alias before releasing a possibly last captured
            // object; its destructor can call back into the application.
            auto v=std::move(record);
            if(h && h->open) check(${p}${name}_drop(&v->raw));
            v->armed=false;
        }
    };
    ${cls} ${id(name)}(${inputs.map((k,i)=>"const "+k.type+"& v"+i).join(",")}) const {
        auto h=require(); ${frame}
        ${inputs.map((k,i)=>k.input("v"+i,"a"+i)).join("\n        ")}
        ${cls} fn(h);
        auto rc=${p}${name}(${["h->binding",...inputs.map((_,i)=>"a"+i),"&fn.record->raw","&d"].join(",")}); ${errors}
        fn.record->armed=true; return fn;
    }`;
};
