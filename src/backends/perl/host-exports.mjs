/** @file Emit a Perl-independent Lean library and ABI-specific public XS operations. */
import { perlHostCarrier, perlNativeHostMembers } from "./host-native-members.mjs";
import { projectPerlNames } from "./naming.mjs";

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
 */
export const generatePerlHostExports = ({ir,entries,modules,name,identity}) => {
	if(!/^[a-f0-9]{64}$/u.test(identity) || !modules.length || modules.some(m=>!qual.test(m)) || !entries.length) fail("invalid component identity or modules");
	const model=perlNativeHostMembers(ir,name,identity,true), {prefix}=model, types=ir.types;
	const fields=[], trampolines=[], renames=[], initializers=[], header=[], interfaceDecl=[], native=[], leans=[], xs=[];
	const allowed=projectPerlNames(name,entries);
	for(const [i,m] of model.slots.entries())
	{
		const sites=m.sites.map(s=>perlHostCarrier(types,s.type)), params=argsOf(sites,true)||"void", argv=indices(sites);
		fields.push("lean_object *(*s"+i+")("+params+");");
		renames.push("#define "+m.symbol+" ph_impl_"+i); initializers.push("ph_impl_"+i);
		trampolines.push(`lean_object *${m.symbol}(${params}) {
  if (ph_table) return ph_table->s${i}(${argv.join(",")});
  ${sites.flatMap((s,j)=>s.c==="lean_object *" && m.sites[j].ownership!=="borrow" ? ["lean_dec(v"+j+");"] : []).join(" ")}
  return lean_io_result_mk_error(lean_mk_io_user_error(lean_mk_string("no active Perl host binding")));
}`);
	}
	const output = (t,v) => sum(t)
		? `(lean_obj_tag(${v})==1 ? lbp_branch(aTHX_ "${name}::Ok",${output(t.arguments[0],"lean_ctor_get("+v+",0)")}) : lbp_branch(aTHX_ "${name}::Err",${output(t.arguments[1],"lean_ctor_get("+v+",0)")}) )`
		: `ph_out(aTHX_ ph_session,${perlHostCarrier(types,t).tag},${v})`;
	const symbols=["nat_text","int_text","error_text","start"].map(s=>prefix+s);
	for(const [i,d] of entries.entries())
	{
		if(!qual.test(d.declaration) || !/^[a-z][a-z0-9_]*$/u.test(d.name) || reserved.has(d.name) || allowed[i].publicName!==d.name
			|| d.parameters.length>64 || d.delivery || !["IO","EIO","pure","BaseIO"].includes(d.effect) || (d.effect==="pure" && !sum(d.result))) fail("unsupported operation "+d.name);
		const sites=d.parameters.map(p=>perlHostCarrier(types,p.type)), argv=indices(sites), params=argsOf(sites,true), eio=d.effect==="EIO", ret=leanType(types,d.result);
		const symbol=prefix+"call_"+i, inner="ph_lean_entry_"+i, call="(_root_."+d.declaration+(sites.length?" "+argv.join(" "):"")+")";
		leans.push(`@[export ${inner}] def invoke${i} ${d.parameters.map((p,j)=>"(v"+j+" : "+leanType(types,p.type)+")").join(" ")} : IO ${eio?"(_root_.Except "+leanType(types,d.error)+" "+ret+")":ret} := ${({IO: "",EIO: "EIO.toIO' ",pure: "pure ",BaseIO: "liftM "})[d.effect]}${call}`);
		header.push(`extern lean_object *${inner}(${params||"void"});`);
		const signature=`lean_object *${symbol}(const ph_methods *tbl${params?", "+params:""})`;
		interfaceDecl.push(signature+";"); symbols.push(symbol);
		native.push(`${signature} {
  const ph_methods *previous=ph_table; ph_table=tbl;
  lean_object *io=${inner}(${argv.join(",")});
  ph_table=previous; return io;
}`);
		xs.push(`void
${d.name}(${argv.join(", ")})
${argv.map(v=>"    SV *"+v).join("\n")}
  PPCODE:
    lbp_check_interpreter(aTHX);
    ENTER; SAVETMPS; lbp_host_enter(aTHX_ ph_session);
    if (!ph_ready()) croak("Lean component unavailable");
    ph_frame *f=ph_enter(aTHX_ ph_slots); f->session=ph_session;
    ${sites.map((s,j)=>`SSGROW(4); lean_object *a${j}=ph_in(aTHX_ ph_session,${s.tag},v${j},NULL); SAVEDESTRUCTOR_X(ph_drop_lean,a${j});`).join("\n    ")}
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
    SV *answer=newSVsv(${output(d.result,"v")});
    FREETMPS; LEAVE; SPAGAIN; SP=PL_stack_base+ax-1; XPUSHs(sv_2mortal(answer));
`);
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
#include "host-scope.h"

MODULE = ${name}    PACKAGE = ${name}
PROTOTYPES: DISABLE

void
with_hosts(input,body)
    SV *input
    SV *body
  PPCODE:
    AV *out=ph_scope(aTHX_ input,body,GIMME_V);
    SSize_t n=av_top_index(out)+1; SPAGAIN; SP=PL_stack_base+ax-1; EXTEND(SP,n);
    for (SSize_t i=0;i<n;++i) PUSHs(sv_2mortal(SvREFCNT_inc(*av_fetch(out,i,0))));

${xs.join("\n")}`;
	const entryLean=[...modules.map(m=>"import "+m),"import LeanBridge.Host.Perl"
		, "namespace BridgePerlExports",model.helpers
		, "@[export "+prefix+"error_text] def errorText (e : IO.Error) : String := toString e"
		, ...leans
		, "end BridgePerlExports"
		, ""].join("\n");
	return {entryLean,interfaceHeader,leanHeader,component,xsSource,symbols,implementation: model.implementation};
};
