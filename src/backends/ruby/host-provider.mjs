/** @file Generate a synchronous MRI extension for compiler-selected Lean calls and Ruby-owned members. */
import { hostMemberSymbol } from "../lean/host-object.mjs";
import { canonicalJson, sha256 } from "../../capsule/node.mjs";
import { isReservedRubyName } from "./copied-model.mjs";
import { readFileSync } from "node:fs";

const fail = m => { throw new TypeError("Ruby host provider: " + m); };
const simple = /^[A-Za-z][A-Za-z0-9_]*$/u, qualified = /^[A-Z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)+$/u;
const snake = s => s.replace(/([a-z0-9])([A-Z])/gu, "$1_$2").toLowerCase();
const text = JSON.stringify;
const domainKey = (ir, r) => JSON.stringify([ir.component.id, r.id, r.resource.kindId]);
/**
 * Derive worker keys from the same nominal coordinate as the shared MRI domain.
 *
 * @param ir - Authenticated Ruby import contract.
 */
export const rubyWorkerKinds = ir => {
	const resources = ir.types;
	if(!resources.length || resources.length > 64 || resources.some(r => r.kind !== "resource" || !r.host?.targets.includes("ruby") || r.host.dynamic || !/^[A-Z][A-Za-z0-9]*$/u.test(r.name))
		|| new Set(resources.map(r => r.resource.kindId)).size !== resources.length) fail("expected distinct statically declared host classes");
	return resources.map(r => ({name: r.name, id: r.id, hash: sha256(canonicalJson(["lean-bridge/ruby-host-lease/v1", domainKey(ir,r)]))}));
};
const scalar = {
	unit: ["Unit", "lean_object *", "lb_unit(x)", "unit", "x", "x"]
	, bool: ["Bool", "uint8_t", "lean_box(lb_bool(x))", "(lean_unbox(x)?Qtrue:Qfalse)", "lean_box(x)", "lean_unbox(x)"]
	, string: ["String", "lean_object *", "lb_string(x)", "rb_utf8_str_new(lean_string_cstr(x),lean_string_size(x)-1)", "x", "x"]
	, char: ["Char", "uint32_t", "lb_char(x)", "rb_enc_uint_chr(lean_unbox_uint32(x),rb_utf8_encoding())", "lean_box_uint32(x)", "lean_unbox_uint32(x)"]
	, bytes: ["ByteArray", "lean_object *", "lb_bytes(x)", "rb_str_new((const char*)lean_sarray_cptr(x),lean_sarray_size(x))", "x", "x"]
	, float32: ["Float32", "float", "lean_box_float32((float)lb_float(x))", "DBL2NUM(lean_unbox_float32(x))", "lean_box_float32(x)", "lean_unbox_float32(x)"]
	, float64: ["Float", "double", "lean_box_float(lb_float(x))", "DBL2NUM(lean_unbox_float(x))", "lean_box_float(x)", "lean_unbox_float(x)"]
	, nat: ["Nat", "lean_object *", "lb_big_in(x,0)", "lb_big_out(x,0)", "x", "x"]
	, int: ["Int", "lean_object *", "lb_big_in(x,1)", "lb_big_out(x,1)", "x", "x"]
	, usize: ["USize", "size_t", "lean_box_usize(lb_integer(x,64,0))", "ULL2NUM(lean_unbox_usize(x))", "lean_box_usize(x)", "lean_unbox_usize(x)"]
	, isize: ["ISize", "size_t", "lean_box_usize(lb_integer(x,64,1))", "LL2NUM((int64_t)lean_unbox_usize(x))", "lean_box_usize(x)", "lean_unbox_usize(x)"]
};
for(const signed of [false, true]) for(const bits of [8, 16, 32, 64])
{
	const l = (signed ? "Int" : "UInt") + bits, c = "uint" + bits + "_t", un = bits === 64 ? "lean_unbox_uint64" : bits === 32 ? "lean_unbox_uint32" : "lean_unbox";
	const box = bits === 64 ? "lean_box_uint64" : bits === 32 ? "lean_box_uint32" : "lean_box";
	const from = box + "((" + c + ")lb_integer(x," + bits + "," + Number(signed) + "))";
	scalar[l.toLowerCase()] = [l, c, from
		, (signed ? "LL2NUM((int" + bits + "_t)" : "ULL2NUM((" + c + ")") + un + "(x))"
		, box + "(x)"
		, un + "(x)"];
}
const subst = (s, x) => s.replace(/\bx\b/gu, () => x);
const project = (resources, t) => {
	if(t?.kind === "named")
	{
		const i = resources.findIndex(r => r.id === t.id);
		if(i < 0) fail("unknown host resource");
		return {
			lean: "LeanBridge.Host.Ruby." + resources[i].name, c: "lean_object *", i
			, from: (x, a = "Qnil") => "lb_rh_wrap(session," + i + "," + x + "," + a + ")"
			, to: x => "lb_rh_object(session," + i + "," + x + ")"
			, box: x => x
			, unbox: x => x
		};
	}
	if(t?.kind !== "primitive" || !Object.hasOwn(scalar, t.name)) fail("unsupported host carrier " + JSON.stringify(t));
	const [lean, c, from, to, box, unbox] = scalar[t.name];
	return { lean, c, from: x => subst(from, x), to: x => subst(to, x), box: x => subst(box, x), unbox: x => subst(unbox, x) };
};
const validSite = (s, k, result = false) => {
	if(k.i === undefined)
	{ if(s.ownership !== "copy" || s.lifetime !== null) fail("unsupported copied lifetime"); return; }
	if(s.ownership === "borrow" && result) return;
	if(!["borrow", "lease", "transfer"].includes(s.ownership) || !s.lifetime || s.lifetime.anchor !== null
		|| !(s.ownership === "borrow" ? s.lifetime.scope === "call" : s.lifetime.scope === "explicit" || (!result && s.lifetime.scope === "call"))) fail("unsupported host lifetime");
};
const member = (resources, r, d, i) => {
	if(!simple.test(d.name) || d.resultMode !== "value" || d.typeParameters.length || d.parameters.some(p => p.optional || p.default !== null)) fail("expected monomorphic synchronous member");
	const self = d.receiver !== null, owner = resources.indexOf(r), params = d.parameters, sites = self ? [d.receiver, ...params] : params;
	const kinds = sites.map(s => project(resources, s.type)), out = project(resources, d.result.type);
	if(!["method", "property", "static-method", "constructor"].includes(d.kind) || self !== ["property", "method"].includes(d.kind)
		|| (self && kinds[0].i !== owner) || (d.kind === "constructor" && out.i !== owner)
		|| (d.kind === "property" && (params.length > 1 || (params.length === 1 && out.lean !== "Unit")))) fail("invalid member shape");
	sites.forEach((s, j) => validSite(s, kinds[j])); validSite(d.result, out, true);
	let anchor = "Qnil";
	if(d.result.ownership === "borrow")
	{
		const life = d.result.lifetime;
		const j = life?.scope === "receiver" && life.anchor === "receiver" && self ? 0 : life?.scope === "parameter" ? sites.findIndex((s, k) => (!self || k !== 0) && s.name === life.anchor) : -1;
		if(j < 0 || kinds[j].i === undefined) fail("unanchored borrowed result"); anchor = "v[" + j + "]";
	}
	const name = d.kind === "constructor" ? "new" : snake(d.name) + (d.kind === "property" && params.length ? "=" : "");
	const sym = hostMemberSymbol("ruby", r, d), n = Number(self);
	const result = out.from("answer", anchor);
	const admitted = out.i === undefined ? result : "lb_rh_admit(" + result + ")";
	return {
		proto: "extern lean_object *" + sym + "(" + (kinds.map(k => k.c).join(",") || "void") + ");"
		, c: `static VALUE lb_member_${i}(VALUE arg) {
    lb_call *a=(lb_call *)arg; VALUE v[${Math.max(1, sites.length)}];
    ${kinds.map((k, j) => "v[" + j + "]=" + k.to("a->values[" + j + "]") + ";").join("\n    ")}
    VALUE answer=rb_funcallv_public(${self ? "v[0]" : "lb_rh_type(session," + owner + ")"},rb_intern(${text(name)}),${params.length},${params.length ? "v+" + n : "NULL"});
    ${d.kind === "property" && params.length ? "(void)answer; a->io=lean_io_result_mk_ok(lean_box(0));" : "a->io=lean_io_result_mk_ok(" + admitted + ");"} return Qnil;
}
lean_object *${sym}(${kinds.map((k, j) => k.c + " p" + j).join(",") || "void"}) {
    lb_call a={0}; int state=0;
    ${kinds.map((k, j) => "a.values[" + j + "]=" + k.box("p" + j) + ";").join(" ")}
    if (!top) a.io=lean_io_result_mk_error(lean_mk_io_user_error(lean_mk_string("no active Ruby call")));
    else { rb_protect(lb_member_${i},(VALUE)&a,&state); if(state) a.io=lb_rh_fault_result(top,state); }
    ${kinds.flatMap((k, j) => k.c !== "lean_object *" || sites[j].ownership !== "borrow" ? ["lean_dec(a.values[" + j + "]);"] : []).join(" ")}
    return a.io;
}`};
};
const output = (resources, t) => {
	if(t?.kind === "apply" && t.constructor === "result" && t.arguments?.length === 2)
	{
		const [ok, err] = t.arguments.map(v => output(resources, v));
		const wrap = (ctor, k, v) => "rb_structured(" + ctor + "," + k.to("lean_ctor_get(" + v + ",0)") + ")";
		return { lean: "(_root_.Except " + err.lean + " " + ok.lean + ")", to: v => "(lean_obj_tag(" + v + ")==1?" + wrap("ok_value", ok, v) + ":" + wrap("err_value", err, v) + ")" };
	}
	const k = project(resources, t); return { lean: "_root_." + k.lean, to: k.to };
};
const entry = (resources, e, i, immediate, custom={}) => {
	if(!qualified.test(e.declaration) || !simple.test(e.name) || e.delivery || !["IO", "EIO", "pure", ...immediate ? ["BaseIO"] : []].includes(e.effect) || (!immediate && e.effect === "pure" && e.result?.constructor !== "result")) fail("expected synchronous IO/EIO or a returned Except");
	const args = custom.args??e.parameters.map(p => project(resources, p.type)), out = custom.out??output(resources, e.result), err = e.effect === "EIO" ? output(resources, e.error) : null;
	const symbol = "lb_ruby_host_invoke_" + i, call = custom.call??("(_root_." + e.declaration + " " + args.map((_, j) => "v" + j).join(" ") + ")");
	const ret = err ? "(_root_.Except " + err.lean + " " + out.lean + ")" : out.lean;
	return {
		lean: `@[export ${symbol}] def invoke${i} ${args.map((k, j) => "(v" + j + " : " + (k.type??("_root_."+k.lean)) + ")").join(" ")} : IO ${ret} := ${err ? "EIO.toIO' " : e.effect === "pure" ? "pure " : e.effect === "BaseIO" ? "liftM " : ""}${call}`
		, proto: "extern lean_object *" + symbol + "(" + (args.map(k => k.c).join(",") || "void") + ");"
		, c: `static VALUE lb_entry_${i}(VALUE data) {
    lb_call *a=(lb_call *)data;
    ${args.map((k, j) => "a->values[" + j + "]=" + k.from("a->args[" + j + "]") + ";").join("\n    ")}
    ${args.flatMap((k, j) => k.i === undefined ? [] : ["lb_rh_admit(a->values[" + j + "]);"]).join(" ")}
    ${args.flatMap((k, j) => k.c === "lean_object *" ? ["lean_inc(a->values[" + j + "]);"] : []).join(" ")}
    a->io=${symbol}(${args.map((k, j) => k.unbox("a->values[" + j + "]")).join(",")});
    lean_object *v=lean_ctor_get(a->io,0);
    if (!lean_io_result_is_ok(a->io)) {
        VALUE original=lb_rh_original(top,v);
        if (!NIL_P(original)) rb_exc_raise(original);
        lean_inc(v); a->msg=lb_ruby_host_error_text(v);
        VALUE msg=rb_utf8_str_new(lean_string_cstr(a->msg),lean_string_size(a->msg)-1);
        VALUE fields[2]={rb_utf8_str_new_cstr(${text(e.declaration)}),msg}; rb_exc_raise(rb_class_new_instance(2,fields,io_error));
    }
    ${err ? `int ok=lean_obj_tag(v)==1; v=lean_ctor_get(v,0);
    if(!ok) { VALUE fields[2]={rb_utf8_str_new_cstr(${text(e.declaration)}),${err.to("v")}}; rb_exc_raise(rb_class_new_instance(2,fields,declared_error)); }` : ""}
    return ${out.to("v")};
}
${custom.invoke??`static VALUE lb_invoke_${i}(int argc,VALUE *argv,VALUE mod) { (void)mod; rb_check_arity(argc,${args.length},${args.length}); return lb_invoke(lb_entry_${i},argv); }`}`
		, method: `rb_define_singleton_method(mod,${text(e.name)},lb_invoke_${i},-1);`
	};
};
// Both the factory and its invocation use the ordinary protected MRI entry
// frame. The second Lean wrapper typechecks the captured function's exact ABI.
const closureEntry=(resources,e,i,immediate)=>{
	if(e.effect!=="IO" || e.delivery) fail("expected a synchronous IO factory");
	const arg=project(resources,e.result.argument),reply=project(resources,e.result.reply),apply="lb_ticket_apply_"+i;
	const type=`(_root_.${arg.lean} → _root_.IO _root_.${reply.lean})`;
	const ticket={type,lean: type,c: "lean_object *",from: v=>`borrow_ticket(${v},${apply})`,unbox: v=>v,to: v=>`new_ticket(${apply},${v})`};
	const factory=entry(resources,e,i,immediate,{out: ticket});
	const invoke=entry(resources,{...e,result: e.result.reply},"apply"+i,immediate,{
		args: [ticket,arg],call: "(v0 v1)"
		, invoke: `static VALUE ${apply}(VALUE self,VALUE arg) { VALUE args[]={self,arg}; return lb_invoke(lb_entry_apply${i},args); }`
	});
	return {...factory,lean: factory.lean+"\n"+invoke.lean,proto: factory.proto+"\n"+invoke.proto,c: "static VALUE "+apply+"(VALUE,VALUE);\n"+factory.c+"\n"+invoke.c};
};
/**
 * Generate both sides from the same verified import contract and application entries.
 *
 * @param options - Validated import contract, fresh entries and release coordinates.
 * @param options.ir - Authored and validated Ruby import contract.
 * @param options.entries - Freshly compiled public function signatures.
 * @param options.modules - Lean application modules defining those functions.
 * @param options.namespace - Public Ruby component module under LeanBridge.
 * @param options.extension - Native extension basename used by MRI's loader.
 * @param options.identity - Hash binding the component to its source and runtime.
 * @param options.workerObjects - Include fiber-owned task leases in this extension.
 */
export const generateRubyHostProvider = ({ ir, entries, modules, namespace, extension, identity, workerObjects = false }) => {
	if(!/^[A-Z][A-Za-z0-9]*$/u.test(namespace) || !/^[a-z][a-z0-9_]*$/u.test(extension) || !/^[a-f0-9]{64}$/u.test(identity)
		|| !modules.length || modules.some(m => !/^([A-Z][A-Za-z0-9_]*)(\.[A-Z][A-Za-z0-9_]*)*$/u.test(m))) fail("invalid extension coordinates");
	const resources = ir.types;
	const kinds = rubyWorkerKinds(ir);
	if(entries.some(e => isReservedRubyName(e.name) || ["bind_hosts", "__bind", "__unbind", "__live", "singleton_class", "name", "block_given"].includes(e.name))) fail("reserved public operation");
	const keywords = resources.map(r => snake(r.name));
	if(keywords.some(isReservedRubyName) || new Set(keywords).size !== keywords.length) fail("reserved or duplicate Ruby binder keyword");
	if(new Set(entries.map(e => e.name)).size !== entries.length) fail("duplicate Ruby public operation");
	const dispatch = new Set();
	for(const d of ir.declarations)
	{
		const name = d.kind === "constructor" ? "new" : snake(d.name) + (d.kind === "property" && d.parameters.length ? "=" : "");
		const key = JSON.stringify([d.owner, d.receiver === null, name]);
		if(dispatch.has(key)) fail("ambiguous Ruby member " + name);
		dispatch.add(key);
	}
	const closures=entries.some(e=>e.result?.kind==="io-closure");
	if(closures && resources.some(r=>r.name==="LeanClosure")) fail("reserved Ruby LeanClosure type");
	const members = ir.declarations.map((d, i) => member(resources, resources.find(r => r.id === d.owner), d, i)), exports = entries.map((e, i) => (e.result?.kind==="io-closure"?closureEntry:entry)(resources,e,i,workerObjects));
	const arity = Math.max(closures?2:1, ...ir.declarations.map(d => d.parameters.length + Number(d.receiver !== null)), ...entries.map(e => e.parameters.length));
	if(arity > 64) fail("too many arguments");
	return {
		entryLean: [...modules.map(m => "import " + m)
			, "import LeanBridge.Host.Ruby", "namespace BridgeRubyHost"
			, "@[export lb_ruby_host_error_text] def errorText (e : IO.Error) : String := toString e"
			, ...["Nat", "Int"].map(k => "@[export lb_ruby_host_" + k.toLowerCase() + "_text] def text" + k + " (v : " + k + ") : String := toString v")
			, ...exports.map(e => e.lean), "end BridgeRubyHost", ""].join("\n")
		, ...workerObjects ? {workerKinds: kinds} : {}
		, header: [...members, ...exports].map(x => x.proto).concat(["extern lean_object *lb_ruby_host_error_text(lean_object *);", "extern lean_object *lb_ruby_host_nat_text(lean_object *);", "extern lean_object *lb_ruby_host_int_text(lean_object *);", "extern lean_object *initialize_BridgeRubyExports(uint8_t);"]).join("\n")
		, source: `#include "host-domain.h"
#include "lean_bridge_native_runtime.h"
#include <ruby/encoding.h>
#include <limits.h>
#include "entry-declarations.h"${workerObjects ? '\n#include "worker-ledger.h"' : ""}
static lb_rh_session *session;${workerObjects ? `
static VALUE binding_fiber;
static void lb_worker_sweep(void) {
    lb_rh_owner();
    if (session && binding_fiber==rb_fiber_current()) {
        lb_rh_frame f; lb_rh_enter(session,&f); lb_rh_leave(&f);
    }
}` : ""}
static _Thread_local lb_rh_frame *top;
static VALUE declared_error,io_error,unit,ok_value,err_value;
static VALUE rb_structured(VALUE klass,VALUE value) { return rb_funcallv_public(klass,rb_intern("new"),1,&value); }
static const lb_rh_spec specs[]={${resources.map(r => "{" + text(domainKey(ir, r)) + "," + Number(r.host.identity === "strong-canonical") + "}").join(",")}};
typedef struct { VALUE *args; lean_object *values[${arity}], *io, *msg; } lb_call;
#include "host-scalars.h"${closures?"\n"+readFileSync(new URL("./host-closures.h",import.meta.url),"utf8"):""}
static void *init_component(uint8_t b) { return initialize_BridgeRubyExports(b); }
static VALUE bind(int argc,VALUE *argv,VALUE mod) {
    (void)mod; lb_rh_owner();
    if(!lean_bridge_native_process_valid() || !lean_bridge_native_component_initialize("rubyhost:${identity}",init_component)) rb_raise(rb_eRuntimeError,"Lean runtime unavailable");
    if(session) rb_raise(rb_eRuntimeError,"component already bound"); session=lb_rh_bind(specs,sizeof(specs)/sizeof(*specs),argc,argv);${workerObjects ? " binding_fiber=rb_fiber_current(); lb_ruby_worker_begin();" : ""} return Qnil;
}
static VALUE unbind(VALUE mod) { (void)mod;${workerObjects || closures ? `
    (void)lb_rh_type(session,0);
    if (top) rb_raise(rb_eRuntimeError,"cannot unbind inside an active Lean call");
    ${workerObjects?"lb_ruby_worker_end(); lb_worker_sweep(); binding_fiber=Qnil;":""}${closures?" collect_tickets(1);":""}` : ""} lb_rh_unbind(&session); return Qnil; }
static VALUE count(VALUE mod) { (void)mod; return SIZET2NUM(lb_rh_live()); }
static VALUE lb_invoke(VALUE (*fn)(VALUE),VALUE *args) {
    lb_rh_owner(); if(!lean_bridge_native_component_ready("rubyhost:${identity}")) rb_raise(rb_eRuntimeError,"Lean component unavailable");
    lb_rh_frame f,*previous=top; lb_rh_enter(session,&f); top=&f;${closures?" collect_tickets(0);":""}
    int state=0; lb_call a={.args=args}; VALUE result=rb_protect(fn,(VALUE)&a,&state);
    if(a.msg) lean_dec(a.msg); if(a.io) lean_dec(a.io); for(unsigned i=0;i<${arity};i++) if(a.values[i]) lean_dec(a.values[i]);
    top=previous; lb_rh_leave(&f); if(state) rb_jump_tag(state); return result;
}
${members.map(m => m.c).concat(exports.map(e => e.c)).join("\n")}${workerObjects ? '\nstatic const char *const worker_keys[]={' + kinds.map(r => text(r.hash)).join(",") + '};\n#include "worker-host-leases.h"' : ""}
__attribute__((visibility("default"))) void Init_${extension}(void) {
    lb_rh_owner(); VALUE parent=rb_define_module("LeanBridge"), mod=rb_define_module_under(parent,"${namespace}");
    declared_error=rb_const_get_at(mod,rb_intern("DeclaredError")); rb_global_variable(&declared_error);
    io_error=rb_const_get_at(mod,rb_intern("IOError")); rb_global_variable(&io_error);
    unit=rb_const_get_at(mod,rb_intern("UNIT")); rb_global_variable(&unit);
    ok_value=rb_const_get_at(mod,rb_intern("Ok")); rb_global_variable(&ok_value);
    err_value=rb_const_get_at(mod,rb_intern("Err")); rb_global_variable(&err_value);
    rb_define_singleton_method(mod,"__bind",bind,-1); rb_define_singleton_method(mod,"__unbind",unbind,0);
    rb_define_singleton_method(mod,"__live",count,0);${closures?" init_tickets(mod);":""}${workerObjects ? "\n    binding_fiber=Qnil; rb_global_variable(&binding_fiber); lb_rh_worker_methods(mod);" : ""}
    ${exports.map(e => e.method).join("\n    ")}
}
`
		, ruby: `module LeanBridge
  module RubyHostValuesV1
    UNIT = ::Object.new.freeze unless const_defined?(:UNIT, false)
  end
  private_constant :RubyHostValuesV1
  module ${namespace}
    UNIT = RubyHostValuesV1::UNIT
    Ok = ::Data.define(:value)
    Err = ::Data.define(:value)
    class IOError < ::IOError
      attr_reader :declaration
      def initialize(declaration, message)
        @declaration = declaration
        super(message)
      end
    end
    class DeclaredError < ::StandardError
      attr_reader :declaration, :payload
      def initialize(declaration, payload)
        @declaration, @payload = declaration, payload
        super("Lean EIO failed in #{declaration}")
      end
    end
    def self.bind_hosts(${resources.map(r => snake(r.name) + ":").join(", ")})
      raise ArgumentError, "bind_hosts requires a block" unless block_given?
      ::Thread.handle_interrupt(::Exception => :never) do
        __bind(${resources.map(r => snake(r.name)).join(", ")})
        begin${workerObjects ? "\n          TaskRuntimeV1.bind_scope" : ""}
          ::Thread.handle_interrupt(::Exception => :immediate) { yield }
        ensure
${workerObjects ? "          begin\n            TaskRuntimeV1.end_scope\n          ensure\n            __unbind\n          end" : "          __unbind"}
        end
      end
    end
  end
end
`
		, privateMethods: `LeanBridge::${namespace}.singleton_class.send(:private, :__bind, :__unbind, :__live${workerObjects ? ", :__worker_collect, :__worker_call, :__worker_pin, :__worker_resolve, :__worker_admit, :__worker_drop" : ""})\n`
	};
};
