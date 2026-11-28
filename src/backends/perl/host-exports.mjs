/** @file Emit a Perl-independent Lean library and ABI-specific public XS operations. */
import { perlHostCarrier, perlNativeHostMembers } from "./host-native-members.mjs";
import { perlHostWorkerApi } from "./host-worker-api.mjs";
import { projectPerlNames } from "./naming.mjs";
import {perlHostRecords} from "./host-records.mjs";
import {lowerWordHostRecord} from "../native/word-host-records.mjs";

const fail = why => { throw new TypeError("Perl host exports: "+why); };
const qual = /^(?:[A-Za-z][A-Za-z0-9_]*\.)*[A-Za-z][A-Za-z0-9_]*$/u;
const sum = t => t?.kind==="apply" && t.constructor==="result" && t.arguments?.length===2;
const scalar = {unit: "Unit",bool: "Bool",bytes: "ByteArray",char: "Char",string: "String",nat: "Nat",int: "Int",usize: "USize",isize: "ISize",float32: "Float32",float64: "Float"};
for(const bits of [8,16,32,64]) for(const [n,k] of [["int","Int"],["uint","UInt"]]) scalar[n+bits]=k+bits;
const leanType = (types,t) => {
	if(sum(t)) return "(_root_.Except "+leanType(types,t.arguments[1])+" "+leanType(types,t.arguments[0])+")";
	const site=perlHostCarrier(types,t);
	return "_root_."+(site.i<0 ? scalar[t.name] : "LeanBridge.Host.Perl."+types[site.i].name);
};
const argsOf = (sites,names) => sites.map((s,i)=>s.c+(names?" v"+i:"")).join(", ");
const indices = sites => sites.map((_,i)=>"v"+i);
const reserved = new Set(["with_hosts","destroy","autoload","clone","clone_skip","import","unimport","isa","can","does","version"]);

/**
 * Generate both binary sides from the same checked host contract. Only the
 * XS side includes perl.h; the precompiled component has no libperl or XS
 * undefined symbols. Its thread-local dispatch exists only during a call.
 *
 * @param o - Verified source entries, modules, CPAN namespace and immutable component identity.
 * @param o.ir - Authored host contract.
 * @param o.entries - Compiler-selected public functions.
 * @param o.modules - Selected Lean entry modules.
 * @param o.name - CPAN namespace.
 * @param o.identity - Immutable component identity.
 * @param o.worker - Optional compiled worker namespace and ordered nominal kinds.
 */
export const generatePerlHostExports = ({ir,entries,modules,name,identity,worker=null}) => {
	if(!/^[a-f0-9]{64}$/u.test(identity) || !modules.length || modules.some(m=>!qual.test(m)) || (!entries.length && !worker)) fail("invalid component identity or modules");
	const model=perlNativeHostMembers(ir,name,identity,true), {prefix}=model, types=ir.types;
	const fields=[], trampolines=[], renames=[], initializers=[], header=[], interfaceDecl=[], native=[], leans=[], xs=[];
	const allowed=projectPerlNames(name,entries);
	const records=perlHostRecords(entries,types,name);
	if(worker && records.schemas.size) fail("record fields require a synchronous owner");
	// Perl's method lookup and the lexical binding API reserve these names
	// for both synchronous functions and event-loop entry points.
	for(const m of worker?.wire.methods??[]) if(reserved.has(m.name)) fail("unsupported operation "+m.name);
	for(const [i,m] of model.slots.entries())
	{
		const sites=m.sites.map(s=>perlHostCarrier(types,s.type)), params=argsOf(sites,true)||"void", argv=indices(sites);
		fields.push("lean_object *(*s"+i+")("+params+");");
		renames.push("#define "+m.symbol+" ph_impl_"+i); initializers.push("ph_impl_"+i);
		trampolines.push(`lean_object *${m.symbol}(${params}) {
  if (ph_table && lean_bridge_native_component_ready("${identity}")) {
    lean_object *result=ph_table->s${i}(${argv.join(",")});
    if (lean_bridge_native_component_ready("${identity}")) return result;
    lean_dec(result);
    return lean_io_result_mk_error(lean_mk_io_user_error(lean_mk_string("Perl host runtime retired during member call")));
  }
  ${sites.flatMap((s,j)=>s.c==="lean_object *" && m.sites[j].ownership!=="borrow" ? ["lean_dec(v"+j+");"] : []).join(" ")}
  return lean_io_result_mk_error(lean_mk_io_user_error(lean_mk_string("no active Perl host binding")));
}`);
	}
	const output = (t,v) => sum(t)
		? `(lean_obj_tag(${v})==1 ? lbp_branch(aTHX_ "${name}::Ok",${output(t.arguments[0],"lean_ctor_get("+v+",0)")}) : lbp_branch(aTHX_ "${name}::Err",${output(t.arguments[1],"lean_ctor_get("+v+",0)")}) )`
		: `ph_out(aTHX_ ph_session,${perlHostCarrier(types,t).tag},${v})`;
	const symbols=["nat_text","int_text","error_text","start"].map(s=>prefix+s);
	const functions=entries.flatMap((d,i)=>d.result.kind==="io-closure"?[{d,i}]:[]);
	const applyXS=[],closeXS=[],packages=[];
	const methods=entries.map((d,i)=>({d,i}));
	for(const {d,i} of functions)methods.push({d,i: entries.length+i,apply: i});
	const arrow=t=>"("+leanType(types,t.argument)+" → IO "+leanType(types,t.reply)+")";
	for(const {d,i,apply} of methods)
	{
		if(!qual.test(d.declaration) || !/^[a-z][a-z0-9_]*$/u.test(d.name) || reserved.has(d.name) || allowed[apply??i].publicName!==d.name
			|| d.parameters.length>64 || d.delivery || !["IO","EIO","pure","BaseIO"].includes(d.effect) || (d.effect==="pure" && !sum(d.result))) fail("unsupported operation "+d.name);
		const inside=apply!==undefined,factory=!inside && d.result.kind==="io-closure",result=inside?d.result.reply:d.result;
		if(d.result.kind==="io-closure" && d.effect!=="IO")fail("returned function requires a synchronous IO factory");
		const lowered=!inside && lowerWordHostRecord(d,"perl",t=>leanType(types,t));
		const pub=inside?[d.result,d.result.argument]:d.parameters.map(p=>p.type);
		const refs=lowered?lowered.flat:pub;
		const inputDecl=[], source=[];
		if(lowered) for(const [k,t] of pub.entries())
		{
			const desc=records.schemas.get(t.declaration);
			if(!desc)
			{source.push("v"+k);continue;}
			inputDecl.push("AV *row"+k+"=phr_borrow(aTHX_ &"+desc.symbol+",v"+k+");");
			for(const [j] of desc.fields.entries()) source.push("phr_field(aTHX_ row"+k+","+j+")");
		}
		const publicArgs=pub.map((_,j)=>"v"+j);
		const outputRow=records.schemas.get(result.declaration);
		const sites=refs.map(t=>t.kind==="io-closure"?{fn: true,i: -1,c: "lean_object *",unbox: x=>x}:perlHostCarrier(types,t)),argv=indices(sites),params=argsOf(sites,true);
		const eio=d.effect==="EIO",ret=outputRow?lowered.tuple:factory?arrow(result):leanType(types,result),pkg=name+"::Returned::"+d.name;
		const symbol=prefix+"call_"+i, inner="ph_lean_entry_"+i, call=inside?"(v0 v1)":lowered?lowered.call:"(_root_."+d.declaration+(sites.length?" "+argv.join(" "):"")+")";
		leans.push(`@[export ${inner}] def invoke${i} ${refs.map((t,j)=>"(v"+j+" : "+(t.kind==="io-closure"?arrow(t):leanType(types,t))+")").join(" ")} : IO ${eio?"(_root_.Except "+leanType(types,d.error)+" "+ret+")":ret} := ${({IO: "",EIO: "EIO.toIO' ",pure: "pure ",BaseIO: "liftM "})[d.effect]}${call}`);
		header.push(`extern lean_object *${inner}(${params||"void"});`);
		const signature=`lean_object *${symbol}(const ph_methods *tbl${params?", "+params:""})`;
		interfaceDecl.push(signature+";"); symbols.push(symbol);
		native.push(`${signature} {
  const ph_methods *previous=ph_table; ph_table=tbl;
  lean_object *io=${inner}(${argv.join(",")});
  ph_table=previous; return io;
}`);
		const start=inside?`XS_INTERNAL(phf_apply_${apply}) {
    dXSARGS; if (items!=1) croak("returned Perl function requires one argument");
    SV *v1=ST(0);`:`void
${d.name}(${publicArgs.join(", ")})
${publicArgs.map(v=>"    SV *"+v).join("\n")}
  PPCODE:`;
		const emitted=`${start}
    lbp_check_interpreter(aTHX);${factory||inside?"\n    SV *published=sv_2mortal(newSV(0));":""}
    ENTER; SAVETMPS; lbp_host_enter(aTHX_ ph_session);
    if (!ph_ready()) croak("Lean component unavailable");
    ph_frame *f=ph_enter(aTHX_ ph_slots); f->session=ph_session;
    ${lowered?["size_t budget=LBS_MAX;",...inputDecl].join("\n    ")+"\n    ":""}${sites.map((s,j)=>`SSGROW(4); lean_object *a${j}=${s.fn?"phf_retain(aTHX_ cv,"+apply+")":"ph_in(aTHX_ ph_session,"+s.tag+","+ (lowered?source[j]:"v"+j)+",NULL)"}; SAVEDESTRUCTOR_X(ph_drop_lean,a${j});${lowered?" phr_charge_value(aTHX_ &budget,"+s.tag+",a"+j+");":""}`).join("\n    ")}
    lbp_check_interpreter(aTHX);
    if (!ph_ready()) croak("Lean component unavailable after argument conversion");
    SSGROW(4);
    ${sites.flatMap((s,j)=>s.i<0?[]:[`lbp_host_admit(aTHX_ ph_session,${s.i},a${j});`]).join(" ")}
    ${sites.flatMap((s,j)=>s.c==="lean_object *"?["lean_inc(a"+j+");"]:[]).join(" ")}
    lean_object *io=${symbol}(&ph_local${sites.map((s,j)=>","+s.unbox("a"+j)).join("")}); SAVEDESTRUCTOR_X(ph_drop_lean,io);
    if (f->failed || !ph_ready()) croak("Perl host frame unavailable");
    lean_object *v=lean_ctor_get(io,0);
    if (!lean_io_result_is_ok(io)) {
      SV *original=ph_original(f,v);
      if (original) croak_sv(original);
      SSGROW(4); lean_inc(v); lean_object *msg=${prefix}error_text(v); SAVEDESTRUCTOR_X(ph_drop_lean,msg);
      croak_sv(lbs_failure(aTHX_ "${name}::IOError","${d.declaration}",ph_out(aTHX_ ph_session,PH_STRING,msg)));
    }
    ${eio?`int ok=lean_obj_tag(v)==1; v=lean_ctor_get(v,0);
    if (!ok) croak_sv(lbs_failure(aTHX_ "${name}::Error::${d.name}","${d.declaration}",${output(d.error,"v")}));`:""}
    ${factory?'sv_setsv(published,phf_publish(aTHX_ '+i+',"'+pkg+'",phf_apply_'+i+',v));':inside?"sv_setsv(published,"+output(result,"v")+");":"SV *answer=newSVsv("+(outputRow?"phr_result(aTHX_ &"+outputRow.symbol+",ph_session,v,&budget)":output(result,"v"))+");"}
    FREETMPS; LEAVE; SPAGAIN; SP=PL_stack_base+ax-1; XPUSHs(${factory||inside?"published":"sv_2mortal(answer)"});${inside?" PUTBACK;\n}":""}
`;
		(inside?applyXS:xs).push(emitted);
		if(factory)
		{
			closeXS.push(`MODULE = ${name}    PACKAGE = ${pkg}

void
close(self)
    SV *self
  PPCODE:
    phf_close(aTHX_ self,${i}); XSRETURN_EMPTY;
`);
			packages.push(`package ${pkg};
sub DESTROY { local $@; eval { $_[0]->close }; }
package ${name};`);
		}
	}
	const interfaceHeader=["#pragma once","#include <lean/lean.h>"
		, "typedef struct {",...fields,"} ph_methods;",...interfaceDecl
		, "int "+prefix+"start(void);"
		, ...["nat","int","error"].map(k=>"extern lean_object *"+prefix+k+"_text(lean_object *);")].join("\n");
	const leanHeader=[model.header,...header,"extern lean_object *initialize_BridgePerlExports(uint8_t);"].join("\n");
	const component=`#include "ph-interface.h"
#include "ph-lean.h"
#include <lean_bridge_native_runtime.h>
static _Thread_local const ph_methods *ph_table;
static int initialized;
static void *ph_init(uint8_t b) { lean_object *r=initialize_BridgePerlExports(b); initialized=lean_io_result_is_ok(r); return r; }
int ${prefix}start(void) { return lean_bridge_native_component_initialize("${identity}",ph_init) && initialized; }
${[...trampolines,...native].join("\n")}
`;
	const async=worker?perlHostWorkerApi({...worker,name}):null;
	let workerPrelude="";
	if(worker)
	{
		if(!/^lbpw_[a-f0-9]{64}_(?![\s\S])/u.test(worker.scope) || worker.kinds.length!==types.length
			|| worker.kinds.some((k,i)=>k.id!==types[i].id || !/^[a-f0-9]{64}$/u.test(k.hash))) fail("unverified Perl worker XS layout");
		const op=n=>worker.scope+n;
		workerPrelude=async.prelude+`extern int ${op("begin")}(void), ${op("end")}(void);
extern int ${op("create")}(const char *,lean_object *,uint64_t [2]), ${op("release")}(const char *,uint64_t [2]);
extern lean_object *${op("borrow")}(const char *,const uint64_t [2]);
${["begin","end","create","release","borrow"].map(n=>"#define PHW_"+n.toUpperCase()+" "+op(n)).join("\n")}
static const char *const phw_keys[]={${worker.kinds.map(k=>JSON.stringify(k.hash)).join(",")}};
`;
	}
	const xsSource=`#include "ph-interface.h"
${renames.join("\n")}
${model.native}
static const ph_methods ph_local={${initializers.join(",")}};
static const lbp_host_spec ph_specs[]={${model.kinds.map(k=>"{"+JSON.stringify(k.key)+","+Number(k.strong)+"}").join(",")}};
#define PH_KIND_COUNT ${types.length}
#define PH_SLOT_COUNT ${model.slots.length}
#define PH_CAPTURE "${name}::_HostMembers::_capture"
#define ph_start ${prefix}start
#define ph_ready() lean_bridge_native_component_ready("${identity}")
${records.header}${workerPrelude}#include "host-scope.h"
${applyXS.length?applyXS.join("\n")+"\n":""}
MODULE = ${name}    PACKAGE = ${name}
PROTOTYPES: DISABLE

void
${worker?"_with_hosts":"with_hosts"}(input,body)
    SV *input
    SV *body
  PPCODE:
    AV *out=ph_scope(aTHX_ input,body,GIMME_V);
    SSize_t n=av_top_index(out)+1; SPAGAIN; SP=PL_stack_base+ax-1; EXTEND(SP,n);
    for (SSize_t i=0;i<n;++i) PUSHs(sv_2mortal(SvREFCNT_inc(*av_fetch(out,i,0))));

${xs.join("\n")}${worker?"\n\nvoid\n_retire_scoped_workers()\n  PPCODE:\n    lbp_check_interpreter(aTHX); if (!ph_session) croak(\"no active Perl host binding\"); "+(functions.length?"phf_retire(); ":"")+"phw_retire_all(); XSRETURN_EMPTY;\n\n"+async.xs:""}${closeXS.length?"\n"+closeXS.join("\n"):""}`;
	const entryLean=[...modules.map(m=>"import "+m),"import LeanBridge.Host.Perl"
		, "namespace BridgePerlExports",model.helpers
		, "@[export "+prefix+"error_text] def errorText (e : IO.Error) : String := toString e"
		, ...leans
		, "end BridgePerlExports"
		, ""].join("\n");
	return {entryLean,interfaceHeader,leanHeader,component,xsSource: records.xs?xsSource+"\n"+records.xs:xsSource,symbols,implementation: model.implementation+(async?"\n"+async.module:"")+(packages.length?"\n"+packages.join("\n"):"")};
};
