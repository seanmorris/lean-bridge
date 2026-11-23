/**
 * Project authenticated native retained-callback operations into component-private XS.
 *
 * @file
 */

/**
 * Declare only the extra symbols used by this declaration's callback port.
 *
 * @param n - Certified word-wire symbols.
 */
export const retainedDeclarations = n => `extern int ${n.callbacks}(uint64_t *,int *);
extern int ${n.next}(uint64_t *,uint32_t *);
extern int ${n.arg}(uint64_t *,uint32_t,uint64_t *);
extern int ${n.reply}(uint64_t *,uint32_t,const uint64_t *);
extern int ${n.fail}(uint64_t *,const uint64_t *,uint32_t *);
extern void ${n.trap}(void);`;

/**
 * Match every retained argument against its exact compiled scalar request and reply.
 *
 * @param api - Reconciled Binding IR.
 * @param declaration - Source-authenticated task declaration.
 * @param method - Certified native word wire.
 * @param shape - Lower an admitted copied value type.
 */
export const retainedArguments = (api,declaration,method,shape) => {
	const slots=new Set();
	for(const [index,argument,reply] of method.callbacks??[])
	{
		const p=declaration.parameters[index], type=api.types.find(t=>t.id===p?.type?.id), c=type?.callable;
		if(!Number.isSafeInteger(index)||index<0||slots.has(index)||method.args[index]!=="callback"
			||method.delivery!=="task"||p?.ownership!=="lease"||p.lifetime?.scope!=="explicit"||p.lifetime.anchor!==null
			||type?.kind!=="callback"||type.source?.extensions?.["lean-bridge.dev/callback-scheduler"]!=="owner-event-loop"
			||c?.invocation!=="many"||c.reentry!=="same-agent"||c.selfDisposal!=="defer"||c.resultMode!=="value"
			||c.parameters.length!==1||c.parameters[0].ownership!=="copy"||c.result.ownership!=="copy"
			||shape(c.parameters[0].type)!==argument||shape(c.result.type)!==reply
			||c.failure?.mode!=="declared"||c.failure?.unexpected!=="poison-runtime"
			||c.failure.errors.length!==1||c.failure.errors[0]!=="error:PerlHostException")
			throw new TypeError("Unverified retained Perl callback slot on "+method.name);
		slots.add(index);
	}
	if(method.args.some((t,j)=>(t==="callback")!==slots.has(j))) throw new TypeError("Missing retained Perl callback slot");
	return declaration.parameters.map((p,j)=>slots.has(j)?"callback":shape(p.type));
};

/**
 * Bind this one Perl sub directly to its generated callback port operations.
 *
 * @param ns - Validated Perl component namespace.
 * @param m - Certified retained method.
 */
export const retainedModule = (ns,m) => {
	const ops="start ready next arg reply fail take close trap".split(" ")
		.map(k=>k+"=>\\&_lb_"+m.name+"_"+k).join(",");
	return `sub ${m.name} { return ${ns}::_Retained::start({${ops}},[${m.callbacks.map(x=>x[0]).join(",")}],\\@_) }`;
};

/**
 * Emit a callback owner with typed request and reply conversions. Worker
 * threads communicate through descriptors; they never call Perl or hold SVs.
 *
 * @param m - Certified method, including distinct factory/terminal errors and callback slots.
 * @param ns - Component's Perl namespace.
 * @param i - Local method identity.
 * @param input - Compile one input conversion into a word buffer.
 * @param value - Compile one output conversion from a word buffer.
 */
export const retainedXs = (m,ns,i,input,value) => {
	const n=m.names, fn="_lb_"+m.name, decl=JSON.stringify(m.declaration);
	const owner=`lbs_owner_for(aTHX_ token,${i})`, args=m.args.map((_,k)=>"v"+k);
	const reset="FREETMPS; LEAVE; SPAGAIN; SP=PL_stack_base+ax-1;";
	const frame=`uint8_t tags[${m.tagBytes}]={0}; uint64_t *out; Newxz(out,4,uint64_t); SAVEDESTRUCTOR_X(lbs_clear,out);`;
	const fail=status=>`if (status) croak("Lean bridge failure in %s (${status} status %d)",${decl},status);`;
	const push=expr=>`SV *ret=newSVsv(${expr}); ${reset} XPUSHs(sv_2mortal(ret));`;
	return `void
${fn}_start(${args.join(", ")})
${args.map(a=>"    SV *"+a+"\n").join("")}  PPCODE:
    lbp_check_interpreter(aTHX); ENTER; SAVETMPS;
    uint64_t a[${Math.max(1,m.args.length*3)}]={0}; ${frame}
    ${m.args.map((t,k)=>t==="callback"?"":`if (SvGMAGICAL(v${k})) v${k}=sv_mortalcopy(v${k});\n    ${input(t,k)}`).join("\n    ")}
    lbs_owner *o; SV *rv=lbs_new_owner(aTHX_ "${ns}::_Owner",${i},${n.close},&o);
    int status=${n.start}(a,o->handle,out,tags); ${fail("start")}
    if (!o->handle[0]) croak("Missing native callback owner");
    ${push("rv")}

void
${fn}_ready(token)
    SV *token
  PPCODE:
    lbs_owner *o=${owner}; int source=-1, cb=-1, status=${n.poll}(o->handle,&source);
    if (!status) XSRETURN_UNDEF;
    if (status!=1 || source<0) croak("Lean bridge failure in %s (readiness status %d)",${decl},status);
    if (o->gate[0]<0) {
        status=${n.callbacks}(o->handle,&cb); ${fail("callback descriptor")}
        if (cb<0) croak("Missing native callback descriptor");
        status=LBS_WAIT_OPEN(source,cb,o->gate); ${fail("callback watch")}
    }
    XPUSHs(sv_2mortal(newSViv(o->gate[0])));

void
${fn}_close(token)
    SV *token
  PPCODE:
    lbs_drop(${owner}); XSRETURN_EMPTY;

void
${fn}_next(token)
    SV *token
  PPCODE:
    lbs_owner *o=${owner}; uint32_t slot=0; int status=${n.next}(o->handle,&slot);
    if (status==1) XSRETURN_UNDEF; ${fail("request")}
    XPUSHs(sv_2mortal(newSVuv(slot)));

void
${fn}_arg(token, slot)
    SV *token
    UV slot
  PPCODE:
    lbs_owner *o=${owner}; ENTER; SAVETMPS; ${frame}
    if (slot>UINT32_MAX) croak("Invalid callback slot");
    int status=${n.arg}(o->handle,(uint32_t)slot,out); ${fail("callback argument")}
    SV *v=NULL; switch (slot) {
    ${m.callbacks.map(([slot,arg])=>`case ${slot}: v=${value(arg,ns)}; break;`).join("\n    ")}
    default: croak("Unknown retained callback slot");
    } ${push("v")}

void
${fn}_reply(token, slot, v0, stopped)
    SV *token
    UV slot
    SV *v0
    SV *stopped
  PPCODE:
    lbs_owner *o=${owner};
    if (!SvROK(stopped)) croak("Invalid private cancellation state");
    if (SvOK(SvRV(stopped))) XSRETURN_EMPTY;
    ENTER; SAVETMPS; uint64_t a[3]={0};
    if (SvGMAGICAL(v0)) v0=sv_mortalcopy(v0);
    switch (slot) {
    ${m.callbacks.map(([slot,,reply])=>`case ${slot}: { ${input(reply,0)} } break;`).join("\n    ")}
    default: croak("Unknown retained callback reply slot");
    }
    if (!SvOK(SvRV(stopped))) { int status=${n.reply}(o->handle,(uint32_t)slot,a); ${fail("callback reply")} }
    ${reset} XSRETURN_EMPTY;

void
${fn}_fail(token, message)
    SV *token
    SV *message
  PPCODE:
    lbs_owner *o=${owner}; ENTER; SAVETMPS; uint64_t a[3]={0}; uint32_t id=0;
    lbs_text(aTHX_ message,a,1,0); int status=${n.fail}(o->handle,a,&id); ${fail("callback failure")}
    ${reset} XPUSHs(sv_2mortal(newSVuv(id)));

void
${fn}_trap(token)
    SV *token
  PPCODE:
    (void)${owner}; ${n.trap}(); XSRETURN_EMPTY;

void
${fn}_take(token, faults)
    SV *token
    SV *faults
  PPCODE:
    lbs_owner *o=${owner}; ENTER; SAVETMPS; ${frame}
    LBS_WAIT_CLOSE(o->gate);
    int status=${n.take}(o->handle,out,tags);
    if (status==14) {
        SV **original=NULL;
        if (SvROK(faults) && SvTYPE(SvRV(faults))==SVt_PVAV && out[0]>0 && out[0]<=INT32_MAX)
            original=av_fetch((AV *)SvRV(faults),(SSize_t)out[0]-1,0);
        if (!original) { ${n.trap}(); croak("Unrecognized retained Perl failure identity"); }
        /* Future::fail rejects false exceptions and decomposes Future::Exception.
           Transport this exact original without running its truth/string overloads. */
        AV *saved=newAV(); SV *carrier=sv_2mortal(newRV_noinc((SV *)saved));
        av_push(saved,newSVsv(*original));
        croak_sv(sv_bless(carrier,gv_stashpv("${ns}::_Cause",GV_ADD)));
    }
    ${m.effect==="EIO"?`if (status==3) croak_sv(lbs_failure(aTHX_ "${ns}::Error::${m.name}",${decl},${value(m.error,ns)}));`:""}
    if (status==13) croak_sv(lbs_failure(aTHX_ "${ns}::IOError",${decl},lbs_bytes(aTHX_ out,1)));
    if (status==4) croak_sv(lbs_failure(aTHX_ "${ns}::TaskIOError",${decl},lbs_bytes(aTHX_ out,1)));
    ${fail("delivery")}
    ${push(value(m.result,ns))}
`;
};
