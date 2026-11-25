/** @file Typed C11 operations on worker-owned application objects. */
import {canonicalJson,sha256} from "../../capsule/node.mjs";
import {cIdentifier} from "./generate.mjs";

const fail=s=>{throw new TypeError("Invalid C host worker: "+s);};
const eq=(a,b)=>a!==undefined && b!==undefined && canonicalJson(a)===canonicalJson(b);
const roles={start:"const uint64_t *,uint64_t *,uint64_t *,uint8_t *",take:"uint64_t *,uint64_t *,uint8_t *",poll:"uint64_t *,int *",close:"uint64_t *",pull:"uint64_t *",
	callbacks:"uint64_t *,int *",next:"uint64_t *,uint32_t *",arg:"uint64_t *,uint32_t,uint64_t *",reply:"uint64_t *,uint32_t,const uint64_t *",fail:"uint64_t *,const uint64_t *,uint32_t *"};

/**
 * Generate callback lifetimes and concrete start/poll/take/close methods.
 * Native symbols and class keys are verified against the actual compiled wire.
 *
 * @param o - C host compilation and worker method descriptors.
 * @param api - Shared C header, member codec and symbol generators.
 */
export const cHostWorkers=(o,api)=>{
	const {workerWire:w,domainId,model,ir,identity,prefix,workerEntries}=o;
	const {p,byRef,add,reserve,defs}=api, priv=[],cbTypes=new Map();
	if(!/^lbwire_lbc_[a-z][a-z0-9_]*_v1_clear$/u.test(w.clear) || !workerEntries.length || workerEntries.length!==w.methods.length)fail("wire");
	const stem=w.clear.slice(0,-6),owner=o.cpp?"cpp":"c";
	const key=(...v)=>JSON.stringify(sha256(canonicalJson(["c-public-host-worker/v1",identity,...v])));
	const kinds=new Map(ir.types.map((t,i)=>{
		const lease=w.leases[i],hash=sha256(canonicalJson(["static-worker-object/v1",owner,domainId,model.kinds[i].key]));
		if(!lease?.host || lease.type!=="host:"+hash || lease.hash!==hash || lease.name!==t.name || lease.tag!==3+i || lease.symbol!==stem+"_lease_"+i)fail(t.id);
		return [t.id,lease.type];
	}));
	const shape=t=>t.kind==="io-callback"?"callback":t.kind==="primitive"?t.name:t.kind==="named"?kinds.get(t.id):
		t.kind==="apply" && t.constructor==="result" && t.arguments.length===2?t.arguments.map(shape):fail("carrier");
	if(w.leases.length!==kinds.size || w.wait.open!==stem+"_wait_open" || w.wait.close!==stem+"_wait_close")fail("ownership");
	priv.push("extern void "+w.clear+"(uint64_t *);","extern int "+w.wait.open+"(int,int,int *);","extern void "+w.wait.close+"(int *);",
		"#define LBW(n) "+p+"##n","#define LBW_VISIT "+prefix+"_visit","#define LBW_OBJECT "+prefix+"_object",
		"#define LBW_CLEAR "+w.clear,"#define LBW_WAIT_OPEN "+w.wait.open,"#define LBW_WAIT_CLOSE "+w.wait.close,'#include "host-worker.h"');
	const declOpaque=name=>{
		reserve(name);defs.push("typedef struct { uint64_t _private[2]; } "+p+name+";");
	};
	const unpack=(v,target,bad)=>`if(q.out[3]!=(uint64_t)(${v.wireTag})){ ${bad} } ${v.unpack(target,"q.out",()=>bad)} q.out[3]=0;`;
	const internal="lean_bridge_native_runtime_retire();s="+p+"UNAVAILABLE;goto done;";
	const asArg=(v,exp)=>v.dyn?"("+v.arg+"){"+exp+".data,"+exp+".len"+(v.integer?","+exp+".negative":"")+"}":exp;
	const callback=t=>{
		const label=x=>cIdentifier(x.kind==="primitive"?x.name:ir.types.find(n=>n.id===x.id)?.name??fail("callback class"));
		const name="callback_"+label(t.argument)+"_to_"+label(t.reply),shapeKey=canonicalJson([t.argument,t.reply]);
		if(cbTypes.has(shapeKey))return cbTypes.get(shapeKey);
		const v=byRef(t.argument,name+"_input"),r=byRef(t.reply,name+"_result"),k=key("callback",shapeKey),local="lwc_"+cbTypes.size;
		const fn=p+name+"_fn";declOpaque(name);reserve(name+"_fn");
		defs.push("typedef "+p+"status (*"+fn+")(void *context,"+v.arg+" arg,"+r.type+" *reply,"+p+"diagnostic *error);");
		priv.push(`typedef struct {lw_callback base;${fn} fn;} ${local};
static lw_status ${local}_invoke(lw_callback *cb,lw_job *j,unsigned slot){
    lw_call q={.slot=slot}; int rc=lw_run(j,&q,LW_ARG);lw_status s=lw_status_of(rc);
    ${v.type} arg={0};${r.type} reply={0}; lw_error error={0}; size_t budget=0;
    if(s)goto done;
    ${unpack(v,"arg",internal)}
    s=((${local}*)cb)->fn(cb->context,${asArg(v,"arg")},&reply,&error);
    if(s!=LBW(OK) && s!=LBW(CALLBACK_ERROR) && s!=LBW(INVALID) && s!=LBW(LIMIT)){ ${internal} }
    if(j->cancel){s=LBW(CANCELLED);goto done;}
    if(s==LBW(CALLBACK_ERROR)){s=lw_failure_record(j,&error,s);goto done;}
    if(s || !lw_empty(&error)){if(!s)s=LBW(INVALID);goto done;}
    uint64_t words[3]={0};int kind=${r.nominal?r.tag:-1};
    ${r.pack("reply","words",c=>"s=lb_status("+c+");goto done;")}
    q=(lw_call){.args=words,.kinds=&kind,.argc=1,.slot=slot};s=lw_status_of(lw_run(j,&q,LW_REPLY));
done: lw_discard(q.out); ${v.clear("arg")} ${r.clear("reply")} LBW(diagnostic_clear)(&error);(void)budget;return s;
}`);
		add(name+"_new",p+"status",fn+" fn, void *context, void (*dispose)(void *), "+p+name+" *out",
			`if(!fn || !out || !lw_fresh(out->_private))return LBW(INVALID); ${local} *c=calloc(1,sizeof(*c));if(!c)return LBW(LIMIT);
    c->fn=fn;c->base.context=context;c->base.dispose=dispose;c->base.invoke=${local}_invoke;
    lw_status s=lw_callback_ticket(${k},&c->base,out->_private);if(s)free(c);return s;`);
		for(const [suffix,revoke] of [["drop",0],["close",1]])add(name+"_"+suffix,p+"status",p+name+" *v","return v?lw_callback_drop("+k+",v->_private,"+revoke+"):LBW(INVALID);");
		const def={type:p+name,key:k};cbTypes.set(shapeKey,def);return def;
	};
	for(const [i,e] of workerEntries.entries()){
		const m=w.methods[i],name=cIdentifier(e.name),ops="lwo_"+i,stream=e.delivery==="async-iterator";
		const cb=e.parameters.flatMap(({type:t},j)=>t.kind==="io-callback"?[[j,shape(t.argument),shape(t.reply)]]:[]);
		const error=e.effect==="EIO"?shape(e.error):e.effect==="IO" && !cb.length?"string":null;
		const terminal=e.stepError?shape(e.stepError):e.taskIO || e.stepIO?"string":null;
		if(!["task","async-iterator"].includes(e.delivery) || e.name!==m.name || e.declaration!==m.declaration || e.effect!==m.effect || e.delivery!==m.delivery
			|| m.symbol!==stem+"_"+i || !Number.isInteger(m.tagBytes) || m.tagBytes<1 || m.tagBytes>65 || (cb.length && stream) || !eq(m.args,e.parameters.map(a=>shape(a.type))) || !eq(m.callbacks??[],cb) || !eq(m.result,shape(e.result))
			|| !eq(m.error,error) || (cb.length?m.terminal!==undefined:!eq(m.terminal,terminal))
			|| (stream && (e.protocol.next!==m.stepDeclaration || Boolean(e.stepIO)!==Boolean(m.stepIO))))fail(e.name);
		const opFields=[];
		for(const f of ["start","take","poll","close",...stream?["pull"]:[],...cb.length?["callbacks","next","arg","reply","fail"]:[]]){
			if(m.names[f]!==m.symbol+"_"+f)fail(f);
			priv.push("extern int "+m.names[f]+"("+roles[f]+");");opFields.push("."+f+"="+m.names[f]);
		}
		priv.push("static const lw_ops "+ops+"={.key="+key("job",e.declaration)+","+opFields.join(",")+"};");
		const args=e.parameters.map(({type:t})=>t.kind==="io-callback"?{cb:callback(t)}:byRef(t,name+"_arg"));
		const value=byRef(e.result,name+"_value"),err=e.effect==="EIO"?byRef(e.error,name+"_failure"):null,step=e.stepError?byRef(e.stepError,name+"_step_failure"):null;
		for(const [suffix,t,v] of [["value",e.result,value],["failure",e.error,err],["step_failure",e.stepError,step]])
			if(v && t.kind==="apply")add(name+"_"+suffix+"_clear","void",v.type+" *v","if(v){"+v.clear("*v")+" *v=("+v.type+"){0};}");
		const h=p+name+"_handle";declOpaque(name+"_handle");
		const startError=err && !cb.length?err:null, lateError=step??(cb.length?err:null);
		const cleanErr=v=>v?" || !failure || !"+v.empty("*failure"):"";
		const common="if(!lw_empty(diag)",diag=p+"diagnostic *diag";
		const io='if(q.out[3]!=1){'+internal+'} diag->message=(LBW(buffer)){(uint8_t *)(uintptr_t)q.out[0],q.out[1]};q.out[3]=0;';
		add(name+"_start",p+"status",[p+"binding binding",...args.map((v,j)=>(v.cb?.type??v.arg)+" a"+j),h+" *out",...startError?[startError.type+" *failure"]:[],diag].join(", "),
			`${common} || !out || !lw_fresh(out->_private)${cleanErr(startError)})return LBW(INVALID);
    lw_job *j=NULL;lw_status s=lw_new((lb_cr_ref){binding._private[0],binding._private[1]},&${ops},${args.length},&j);if(s)return s;
    lw_begin(j);size_t budget=0;uint64_t words[${Math.max(1,args.length*3)}]={0};
    const int kinds[]={${args.map(a=>a.nominal?a.tag:-1).join(",")||"-1"}};lw_call q={.args=words,.kinds=kinds,.argc=${args.length}};
    uint8_t *tags=q.tags;(void)tags;(void)budget;
    ${args.map((v,j)=>v.cb?`if((s=lw_keep(j,${j},${v.cb.key},a${j}._private)))goto done;`:v.pack("a"+j,"words+"+3*j,c=>"s=lb_status("+c+");goto done;")).join("\n    ")}
    int rc=lw_run(j,&q,LW_START);s=lw_status_of(rc);
    if(!rc){if(!j->h[0]){${internal}}out->_private[0]=j->ticket.domain;out->_private[1]=j->ticket.ticket;}
    ${startError?"else if(rc==3){"+unpack(startError,"*failure",internal)+"}":""}
    ${e.effect==="IO"&&!cb.length?"else if(rc==4){"+io+"}":""}
done:lw_discard(q.out);lw_end(j);if(s)lw_finish(j);return s;`);
		add(name+"_poll",p+"status",h+" handle, int *fd","return lw_poll(&"+ops+",handle._private,fd);");
		add(name+"_close",p+"status",h+" *handle","return handle?lw_close(&"+ops+",handle->_private):LBW(INVALID);");
		if(stream)add(name+"_pull",p+"status",h+" handle",`lw_job *j=NULL;lw_status s=lw_lookup(&${ops},handle._private,&j);if(s || (s=lw_begin(j)))return s;
    lw_call q={0};s=lw_status_of(lw_run(j,&q,LW_PULL));lw_end(j);if(j->cancel){lw_finish(j);return LBW(CANCELLED);}return s;`);
		add(name+"_take",p+"status",[h+" *handle",value.type+" *value",...lateError?[lateError.type+" *failure"]:[],diag].join(", "),
			`${common} || !handle || !value || !${value.empty("*value")}${cleanErr(lateError)})return LBW(INVALID);
    lw_job *j=NULL;lw_status s=lw_lookup(&${ops},handle->_private,&j);if(s || (s=lw_begin(j)))return s;
    if(j->fault){s=j->fault;lw_end(j);lw_finish(j);memset(handle,0,sizeof(*handle));return s;}
    lw_call q={0};int rc=lw_run(j,&q,LW_TAKE);uint8_t *tags=q.tags;(void)tags;s=lw_status_of(rc);
    if(!rc){${unpack(value,"*value",internal)}}
    ${lateError?"else if(rc==3){"+unpack(lateError,"*failure",internal)+(step?"s=LBW(STEP_ERROR);":"")+"}":""}
    ${e.taskIO||e.stepIO?"else if(rc==4){"+io+"s=LBW("+(e.stepIO?"STEP_IO_ERROR":"TASK_IO_ERROR")+");}":""}
    ${cb.length&&e.effect==="IO"?"else if(rc==13){"+io+"}":""}
    ${cb.length?`else if(rc==14){uint64_t id=q.out[0];if(!id || id>j->count){${internal}}
        lw_failure *f=&j->failures[id-1];*diag=f->error;f->error=(lw_error){0};s=f->status;}`:""}
done:lw_discard(q.out);if(rc!=1 && rc!=8)LBW_WAIT_CLOSE(j->gate);
    if(j->cancel){${value.clear("*value")} *value=(${value.type}){0};${lateError?lateError.clear("*failure")+" *failure=("+lateError.type+"){0};":""} LBW(diagnostic_clear)(diag);s=LBW(CANCELLED);}\n    lw_end(j);if(!j->h[0] || j->cancel){lw_finish(j);memset(handle,0,sizeof(*handle));}return s;`);
	}
	return priv.join("\n");
};
