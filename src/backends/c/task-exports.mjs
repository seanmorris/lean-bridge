/**
 * Generate a nonblocking C11 interface for compiler-checked Lean tasks and cursors.
 *
 * @file
 */
import { iteratorEntryLean, nativePullEntry, streamEntryLean } from "../native/pull-entry.mjs";
import { cTaskValues } from "./task-values.mjs";
import { emitRetainedTask, retainedLean, retainedPrototypes, retainedTask, wasmRetainedLean } from "./task-callback-exports.mjs";
import {nativeOnceC,nativeOnceLean,nativeOncePrototypes} from "../native/task-callback.mjs";
import { cResourceApi, cResourceSupport, taskResourceTypes } from "./task-resources.mjs";
import { cHostCallbacks } from "./task-host-callback.mjs";

const baseStatuses = "OK PENDING END TYPED_ERROR IO_ERROR INVALID CLOSED BUSY IDLE WRONG_CONTEXT UNAVAILABLE NO_MEMORY LIMIT".split(" ");
const qualified = /^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)*$/u;

// The CLR runs its managed shutdown event on a foreign thread. Normal
// process return runs libc exit handlers on the original native owner. This
// list belongs to a standalone component (no callbacks into managed code).
const clrCursorExit = `
static int lb_cursor_exit_armed;
static void lb_cursor_exit(void) {
    if (!lb_context()) return;
    while (lb_entries && !lb_entries->pulling) lb_drop(lb_entries);
}
static int lb_arm_cursor_exit(void) {
    if (!lb_cursor_exit_armed && atexit(lb_cursor_exit)) return 0;
    lb_cursor_exit_armed = 1;
    return 1;
}
`;

/**
 * Give each declaration a distinct handle type and reject stale or foreign IDs at runtime.
 *
 * @param options - Package name, captured modules, authenticated entries and native identity.
 */
export const generateCTaskExports = options => {
	const { name, modules, entries, componentIdentity } = options;
	const synchronous = options.synchronousIO === true;
	const directCursors = entries.some(e => e.delivery === "iterator");
	const clrExit = options.dotnetCursorExit===true;
	if(clrExit && (!synchronous || !directCursors || options.wasmTasks || options.dotnetHostKinds?.length)) throw new TypeError("CLR cursor exit requires standalone direct cursors");
	if(directCursors && !synchronous) throw new TypeError("Immediate cursors require a synchronous C delivery contract");
	if(!/^[a-z][a-z0-9]*(?:[-_.][a-z0-9]+)*$/u.test(name) || !/^[0-9a-f]{64}$/u.test(componentIdentity)
		|| !modules?.length || !modules.every(m => qualified.test(m))
		|| (synchronous ? entries.some(e => (e.delivery && e.delivery !== "iterator") || e.taskIO) || !(directCursors || entries.some(e => ["IO", "BaseIO", "EIO"].includes(e.effect)))
			: !entries.some(e => e.delivery))) throw new TypeError("Invalid native C delivery contract");
	const wasmHost=!!options.wasmHostKinds?.length,phpHost=!!options.phpHostKinds?.length;
	const rubyHost=!!options.rubyHostKinds?.length, dotnetHost=!!options.dotnetHostKinds?.length;
	const jvmHost=!!options.jvmHostKinds?.length, perlHost=!!options.perlHostKinds?.length;
	const selected=options.staticHost;
	const hostKinds=(selected?selected.kinds:perlHost?options.perlHostKinds:jvmHost?options.jvmHostKinds:dotnetHost?options.dotnetHostKinds:rubyHost?options.rubyHostKinds:phpHost?options.phpHostKinds:options.wasmHostKinds)??[];
	if(options.wasmZendObjects && (!wasmHost || phpHost)) throw new TypeError("Zend worker objects require the Wasm host ABI");
	if(wasmHost && !options.wasmTasks) throw new TypeError("JavaScript host objects require the Wasm owner");
	const p = `lbc_${name.replaceAll(/[-.]/gu, "_")}`, gmp = options.integerMode !== "words", resources = taskResourceTypes(options.resources,hostKinds,selected?selected.owner:perlHost?"perl":jvmHost?"jvm":dotnetHost?"dotnet":rubyHost?"ruby":phpHost || options.wasmZendObjects?"php":"javascript");
	const values = cTaskValues(p, gmp, resources);
	const retained = entries.some(retainedTask);
	const terminal = entries.some(e => e.taskIO), publicC = options.cCallbacks === true;
	const wasm = options.wasmTasks === true;
	const functionTypes=(options.wasmFunctionDefinitions??[]).flatMap(({hash,argument,reply,owner})=>{
		const ns="BridgeHostFactory"+hash,type=ns+".Fn"+hash;
		if(!wasm || !wasmHost || owner!==(options.wasmZendObjects?"php-wasm-zend-binding":"javascript-host-binding") || !/^[a-f0-9]{64}$/u.test(hash)
			|| !resources.some(r=>r.lean===type && !r.host && r.hash===hash)
			|| [argument,reply].some(t=>t.kind!=="primitive" && !(t.kind==="named" && resources.some(r=>r.host && r.id===t.id))))
			throw new TypeError("Invalid private JavaScript worker function type");
		const a=values.codec(argument).lean,b=values.codec(reply).lean;
		return ["abbrev "+type+" := "+a+" → _root_.IO "+b
			, "def "+ns+".apply (f : "+type+") (v : "+a+") : _root_.IO "+b+" := f v"];
	});
	const hosts=[options.rustCallbacks, options.cppCallbacks, publicC, options.rubyDelivery, options.dotnetDelivery, options.jvmDelivery, options.perlDelivery, options.phpDelivery, options.witDelivery, Boolean(selected)];
	if(selected && (!["c","cpp","rust","wit-wasi"].includes(selected.owner) || !Array.isArray(selected.kinds) || !selected.kinds.length || hosts.filter(Boolean).length!==1 || synchronous || gmp || wasm || wasmHost || phpHost || rubyHost || dotnetHost || jvmHost || perlHost || options.wasmCallbacks || options.witCallbacks))
		throw new TypeError("Static host workers require one native owner and private word carriers");
	if(perlHost && (options.perlDelivery!==true || hosts.filter(Boolean).length!==1 || synchronous || gmp || wasm || wasmHost || phpHost || rubyHost || dotnetHost || jvmHost || options.wasmCallbacks || options.witCallbacks))
		throw new TypeError("Perl host objects require the exclusive native Perl task owner and word carriers");
	if(jvmHost && (options.jvmDelivery!==true || hosts.filter(Boolean).length!==1 || synchronous || gmp || wasm || wasmHost || phpHost || rubyHost || dotnetHost || options.wasmCallbacks || options.witCallbacks))
		throw new TypeError("JVM host objects require the exclusive native JVM task owner and word carriers");
	if(dotnetHost && (options.dotnetDelivery!==true || hosts.filter(Boolean).length!==1 || synchronous || gmp || wasm || wasmHost || phpHost || rubyHost || options.wasmCallbacks || options.witCallbacks))
		throw new TypeError("CLR host objects require the exclusive native CLR task owner and word carriers");
	if(rubyHost && (options.rubyDelivery!==true || hosts.filter(Boolean).length!==1 || synchronous || gmp || wasm || wasmHost || phpHost || options.wasmCallbacks || options.witCallbacks))
		throw new TypeError("Ruby host objects require the exclusive native Ruby task owner and word carriers");
	if(phpHost && (!options.phpDelivery || hosts.filter(Boolean).length!==1 || synchronous || gmp || wasm || wasmHost || options.wasmCallbacks || options.witCallbacks))
		throw new TypeError("PHP host objects require the exclusive native PHP task owner and word carriers");
	if((options.witCallbacks && !options.witDelivery) || (options.witDelivery
		&& (synchronous || wasm || options.wasmCallbacks || gmp || (retained && !options.witCallbacks) || hosts.filter(Boolean).length!==1)))
		throw new TypeError("WIT task delivery requires native word carriers, one store owner and an explicit retained callback adapter");
	if(wasm && (synchronous || gmp || (retained && !options.wasmCallbacks)
		|| [options.rustCallbacks, options.cppCallbacks, publicC, options.rubyDelivery, options.dotnetDelivery, options.jvmDelivery, options.perlDelivery, options.phpDelivery].some(Boolean)))
		throw new TypeError("Threaded Wasm tasks require word carriers, the Wasm delivery profile and an explicit retained callback adapter");
	if(!wasm && (retained || terminal) && (hosts.filter(Boolean).length !== 1 || publicC !== gmp))
		throw new TypeError(options.phpDelivery ? "The PHP task ABI requires word carriers; select exactly one host"
			: options.perlDelivery ? "The Perl task ABI requires word carriers; select exactly one host"
				: options.jvmDelivery ? "The JVM task ABI requires word carriers; select exactly one host"
					: options.dotnetDelivery ? "The .NET task ABI requires word carriers; select exactly one host"
						: "The task callback ABI requires Rust, C++ or Ruby word carriers, or the public C profile with GMP; select exactly one host");
	const budgets=options.onceByDeclaration, hasBudget=Boolean(budgets?.size);
	if(hasBudget && (wasm || hostKinds.length || !(publicC || options.cppCallbacks || options.rustCallbacks || options.rubyDelivery || options.dotnetDelivery || options.jvmDelivery || options.phpDelivery || options.perlDelivery) || !retained))
		throw new TypeError("Unsupported native callback budget host");
	for(const [name,slots] of budgets??[])
	{
		const entry=entries.find(e=>e.declaration===name);
		if(entry?.delivery!=="task" || !Array.isArray(slots) || !slots.length || new Set(slots).size!==slots.length
			|| slots.some(i=>!Number.isSafeInteger(i) || i<0 || entry.parameters[i]?.type.kind!=="io-callback"))
			throw new TypeError("Invalid native one-call callback slot");
	}
	const statuses = [...baseStatuses, ...publicC && (retained || terminal) ? ["TASK_IO_ERROR"] : [], ...publicC && retained ? ["CALLBACK_ERROR", "CALLBACK_CLOSED", "CALLBACK_TRAP"] : [], ...hasBudget?["CALLBACK_ALREADY_INVOKED"]:[]];
	if(options.integerMode && !["gmp", "words"].includes(options.integerMode)) throw new TypeError("Unknown task integer ABI");
	const types = [], prototypes = [], functions = [], symbols = [`${p}_buffer_dispose`];
	const module = wasm ? "BridgeTask" + componentIdentity : "BridgeCAsync";
	const namespace = wasm ? module : "LeanBridgeCAsync";
	const entryPrefix = wasm ? "lb_wtask_" + componentIdentity : "lb_c";
	const names = new Set(), declarations = [
		`extern lean_object *initialize_${module}(uint8_t);`
		, `extern lean_object *${entryPrefix}_error_text(lean_object *);`
		, ...retained ? retainedPrototypes.map(x => wasm ? x.replaceAll("lb_c_cb",entryPrefix+"_cb") : x) : []
		, ...hasBudget ? nativeOncePrototypes : []
		, ...wasm && retained ? [`extern lean_object *${entryPrefix}_cb_factory(lean_object *,lean_object *);`] : []];
	const lean = [...wasm ? ["prelude", "import Init.System.Promise"] : []
		, ...modules.map(m => `import ${m}`)
		, ...retained ? ["import Init.System.Promise"] : []
		, "set_option autoImplicit false"
		, ...functionTypes
		, "namespace " + namespace
		, `@[export ${entryPrefix}_error_text] def errorText (e : IO.Error) : String := toString e`
		, ...synchronous ? [] : [streamEntryLean]
		, ...directCursors ? [iteratorEntryLean] : []
		, ...retained ? [wasm ? wasmRetainedLean(entryPrefix+"_cb") : retainedLean] : []
		, ...hasBudget ? ["  | callbackDenied (error : IO.Error)\n"+nativeOnceLean] : []
		, ...wasm && retained ? [`@[extern "${entryPrefix}_cb_factory"] opaque cbTrackFactory {α : Type} (port : @& CallbackPort) (task : @& Task α) : BaseIO Unit`] : []];
	const fn = (name, args, body) => {
		const signature = `${p}_status ${name}(${args.join(", ") || "void"})`;
		symbols.push(name); prototypes.push(signature + ";"); functions.push(`${signature} {\n    ${body}\n}`);
	};
	const resourceHeader = cResourceApi(p, resources, fn);
	const host = publicC && retained && cHostCallbacks({ p, values, fn, types, prototypes, functions, symbols });
	if(retained && options.cppCallbacks) fn(p + "_callback_trap", ["void"], "if (!lb_context()) return LB(WRONG_CONTEXT); lean_bridge_native_runtime_retire(); return LB(OK);");
	const occupied = (t, v) => t?.resource ? ` || ${v}->_private[0] || ${v}->_private[1]` : "";
	for(const [i, e] of entries.entries())
	{
		if(!qualified.test(e.declaration) || !/^[a-z][a-z0-9_]*$/u.test(e.name) || names.has(e.name)
			|| e.hostMembers?.length) throw new TypeError("Invalid or duplicate C task export");
		names.add(e.name);
		const direct = e.delivery === "iterator", stream = e.delivery === "async-iterator", async = stream || e.delivery === "task", handle = async || direct;
		if(e.taskIO && e.delivery !== "task") throw new TypeError("Terminal IO errors require a real Task");
		if(e.delivery && !handle || !["pure", "BaseIO", "EIO", "IO"].includes(e.effect)) throw new TypeError("Unsupported C task effect or delivery");
		const n = `${p}_${e.name}`, h = `${n}_handle`;
		if(retainedTask(e))
		{
			(host ? host.emit : emitRetainedTask)({ e, i, n, h, p, onceSlots: budgets?.get(e.declaration), values, types, fn, lean, declarations, wasm, entryPrefix, wasmHost, hostValues: Boolean(hostKinds.length), witCallbacks: options.witCallbacks, wordAliases: Boolean(selected) || wasm || options.cppCallbacks || options.rubyDelivery || options.dotnetDelivery || options.jvmDelivery || options.perlDelivery || options.phpDelivery || options.witCallbacks, prototypes }); continue;
		}
		const args = e.parameters.map(a => values.codec(a.type));
		if(args.some(a => !a.arg)) throw new TypeError("C task arguments require scalar inputs");
		const item = values.codec(e.result), error = e.effect === "EIO" ? values.codec(e.error) : null;
		const step = e.stepError ? values.codec(e.stepError) : null;
		if((stream || direct) && (e.protocol?.open !== e.declaration || !qualified.test(e.protocol.next) || !qualified.test(e.protocol.close))) throw new TypeError("Invalid C pull protocol");
		if(direct && (!["BaseIO", "IO", "EIO"].includes(e.stepEffect) || (e.stepEffect === "IO") !== Boolean(e.stepIO) || (e.stepEffect === "EIO") !== Boolean(step))) throw new TypeError("Invalid immediate C pull effect");
		if(e.stepIO && ((!direct && ((!hostKinds.length && !options.witDelivery) || !stream)) || step)) throw new TypeError("Invalid cursor IO failure contract");
		const ioTerminal=e.taskIO || e.stepIO;
		const pull = stream || direct ? nativePullEntry(i, entryPrefix, e, item.lean, error?.lean, e.stepIO?"_root_.IO.Error":step?.lean) : null;
		if(pull)
		{
			lean.push(pull.helpers); declarations.push(pull.declarations);
		}
		const entry = `${entryPrefix}_invoke_${i}`, payload = e.taskIO ? `(_root_.Except _root_.IO.Error ${item.lean})` : item.lean;
		const rawOut = async ? `(_root_.Task ${payload})` : item.lean;
		const result = pull?.lean ?? (error ? `(_root_.Except ${error.lean} ${rawOut})` : rawOut);
		const call = `(_root_.${e.declaration} ${args.map((_, k) => `v${k}`).join(" ")})`;
		const app = pull ? pull.application(call) : call;
		const invoke = e.effect === "EIO" ? `_root_.EIO.toIO' ${app}` : e.effect === "BaseIO" ? `liftM ${app}` : e.effect === "pure" ? `pure ${app}` : app;
		lean.push(`@[export ${entry}] def invoke${i} ${args.map((a, k) => `(v${k} : ${a.lean})`).join(" ")} : IO ${result} := ${invoke}`);
		declarations.push(`extern lean_object *${entry}(${args.map(a => a.abi).join(", ") || "void"});`);
		if(handle) types.push(`typedef struct { uint64_t id, domain; } ${h};`);
		// Stable aliases: adding a different export must not change the consumer's
		// spelling for an anonymous returned Except or the way it is disposed.
		for(const [kind, c] of [["value", item], [synchronous ? "error" : "start_error", error], ["step_error", step]])
			if(c)
			{
				const alias = `${n}_${kind}`;
				types.push(`typedef ${c.type} ${alias};`);
				if(c.dispose) prototypes.push(`static inline void ${alias}_dispose(${c.directMpz ? "mpz_ptr v" : alias + " *v"}) { ${c.dispose}(v); }`);
			}
		const ioError = e.effect === "IO", checkedArgs = args.map((a, k) => a.validate(`v${k}`)).filter(Boolean).join("\n    ");
		fn(`${n}_${direct ? "open" : async ? "start" : "call"}`, [...args.map((a, k) => `${a.arg} v${k}`)
			, handle ? `${h} *out` : values.out(item, "out")
			, ...error ? [values.out(error, "error")] : ioError ? [`${p}_buffer *io_error`] : []],
		`if (!out${handle ? " || out->id" : occupied(item, "out")}${error ? " || !error" + occupied(error, "error") : ""}) return LB(INVALID);
    ${args.some(a => a.buffer) ? "size_t budget = 0;" : ""}
    ${checkedArgs}
    LB(status) s = lb_prepare(); if (s != LB(OK)) return s;${args.flatMap((a, k) => a.bind ? ["\n    " + a.bind(`v${k}`)] : []).join("")}
    ${direct && clrExit ? "if (!lb_arm_cursor_exit()) return LB(UNAVAILABLE);\n    " : ""}${handle ? `lb_entry *owner; s = lb_reserve(${i}, &owner); if (s != LB(OK)) return s;` : ""}
    lean_object *io = ${entry}(${args.map((a, k) => a.argument(`v${k}`)).join(", ")});
    if (!lean_io_result_is_ok(io)) s = lb_io_failure(io, ${ioError ? "io_error" : "NULL"});
    else {
        lean_object *v = lean_io_result_get_value(io);
        ${error ? `int ok = lean_obj_tag(v) == 1; v = lean_ctor_get(v, 0);
        if (!ok) { s = ${error.read}(v, error); if (s == LB(OK)) s = LB(TYPED_ERROR); }
        else ` : ""}{
            ${pull ? `lean_inc(v); owner->cursor = v; owner->pull = ${pull.next}; owner->close = ${pull.close};`
				: async ? "s = lb_subscribe(owner, v);" : `s = ${item.read}(v, out);`}
        }
    }
    lean_dec(io); ${handle ? "if (s == LB(OK)) { out->id = owner->id; out->domain = lb_domain; } else lb_drop(owner);" : ""} return s;`);
		if(direct)
		{
			fn(`${n}_next`, [`${h} *h`, values.out(item, "out"), ...step ? [values.out(step, "error")] : [], ...e.stepIO ? [`${p}_buffer *message`] : []],
				`if (!h || !out${occupied(item, "out")}${step ? " || !error" + occupied(step, "error") : ""}${e.stepIO ? " || !message" : ""}) return LB(INVALID);
    lb_entry *owner; LB(status) s = lb_lookup(h->id, h->domain, ${i}, &owner, 0);
    if (s != LB(OK)) return s;
    owner->pulling = 1; lean_inc(owner->cursor);
    lean_object *io = owner->pull(owner->cursor);
    if (!lean_io_result_is_ok(io)) s = LB(UNAVAILABLE);
    else {
        lean_object *v = lean_io_result_get_value(io);
        ${e.stepIO || step ? `if (!lean_obj_tag(v)) {
            lean_object *err = lean_ctor_get(v, 0);
            ${step ? `s = ${step.read}(err, error); if (s == LB(OK)) s = LB(TYPED_ERROR);` : `lean_inc(err); lean_object *text = lb_c_error_text(err);
            s = lb_string(message, text); lean_dec(text); if (s == LB(OK)) s = LB(IO_ERROR);`}
        } else { v = lean_ctor_get(v, 0);` : ""}
        if (!lean_obj_tag(v)) s = LB(END); else s = ${item.read}(lean_ctor_get(v, 0), out);
        ${e.stepIO || step ? "}" : ""}
    }
    lean_dec(io); owner->pulling = 0;
    if (s != LB(OK)) { h->id = 0; lb_drop(owner); }
    return s;`);
			fn(`${n}_close`, [`${h} *h`], `return !h ? LB(INVALID) : !h->id ? LB(OK) : lb_close(&h->id, h->domain, ${i});`);
		}
		if(!async) continue;
		if(stream) fn(`${n}_pull`, [`${h} h`], `return lb_request(h.id, h.domain, ${i});`);
		if(wasm)
		{
			const lookup = `lb_entry *e; LB(status) s = lb_lookup(h.id, h.domain, ${i}, &e, 0);
    if (s != LB(OK)) return s; if (!e->watch.source) return LB(IDLE);`;
			fn(`${n}_listen`, [`${h} h`, "uint32_t token"], lookup + `
    if (!token) return LB(INVALID); if (e->watch.listening) return LB(BUSY);
    e->watch.listening = 1; lean_bridge_wasm_task_subscribe_v1(e->watch.source, token); return LB(OK);`);
			fn(`${n}_cancel`, [`${h} h`], lookup + `
    lean_io_cancel_core(e->watch.source); return LB(OK);`);
		}
		else fn(`${n}_poll`, [`${h} h`, "int *fd"], `return lb_poll(h.id, h.domain, ${i}, fd);`);
		fn(`${n}_take`, [`${h} *h`, values.out(item, "out"), ...step ? [values.out(step, "error")] : [], ...ioTerminal ? [`${p}_buffer *message`] : []],
			`if (!h || !out${occupied(item, "out")}${step ? " || !error" + occupied(step, "error") : ""}${ioTerminal ? " || !message" : ""}) return LB(INVALID);
    lb_entry *e; LB(status) s = lb_lookup(h->id, h->domain, ${i}, &e, 0);
    if (s != LB(OK)) return s;
    if (!e->watch.source) return LB(IDLE);
    if (!lb_watch_ready(&e->watch)) return LB(PENDING);
    lean_object *v = lean_task_get(e->watch.source);
    ${ioTerminal ? `if (!lean_obj_tag(v)) {
        lean_object *err = lean_ctor_get(v, 0); ${wasmHost?"s = lb_host_io_error(err,message);":`lean_inc(err); lean_object *text = lb_c_error_text(err);
        s = lb_string(message, text); lean_dec(text); if (s == LB(OK)) s = LB(${publicC ? "TASK_IO_ERROR" : "IO_ERROR"});`}
    } else { v = lean_ctor_get(v, 0);` : ""}
    ${step ? `if (!lean_obj_tag(v)) { s = ${step.read}(lean_ctor_get(v, 0), error); if (s == LB(OK)) s = LB(TYPED_ERROR); }
    else { v = lean_ctor_get(v, 0);` : ""}
    ${stream ? `if (!lean_obj_tag(v)) s = LB(END);
    else s = ${item.read}(lean_ctor_get(v, 0), out);` : `s = ${item.read}(v, out);`}${step || ioTerminal ? " }" : ""}
    lb_watch_close(&e->watch, 0);
    ${stream ? "if (s != LB(OK)) " : ""}{ h->id = 0; lb_drop(e); }
    return s;`);
		fn(`${n}_close`, [`${h} *h`], `return h ? lb_close(&h->id, h->domain, ${i}) : LB(INVALID);`);
	}
	symbols.push(...values.symbols);
	const exact = values.hasIntegers();
	if(exact && !gmp) symbols.push(`${p}_integer_dispose`);
	const publicNames = [...symbols, ...statuses.map(s => `${p}_${s}`), ...types.map(s => s.split(" ").at(-1).slice(0, -1))];
	if(new Set(publicNames).size !== publicNames.length) throw new TypeError("Colliding generated C task names");
	const header = `#ifndef ${p.toUpperCase()}_H
#define ${p.toUpperCase()}_H
#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>${exact && gmp ? "\n#include <gmp.h>" : ""}
#ifdef __cplusplus
extern "C" {
#endif
typedef enum { ${statuses.flatMap((s, i) => synchronous ? (["PENDING", "IDLE"].includes(s) || (!directCursors && s === "END")) ? [] : [`${p}_${s} = ${i}`] : [`${p}_${s}`]).join(", ")} } ${p}_status;
typedef struct { const uint8_t *data; size_t len; } ${p}_view;
typedef struct { uint8_t *data; size_t len;${wasmHost?" uint32_t host_ticket;":""} } ${p}_buffer;
void ${p}_buffer_dispose(${p}_buffer *v);${exact && !gmp ? `
typedef struct { const uint64_t *words; size_t len; bool negative; } ${p}_integer_view;
typedef struct { uint64_t *words; size_t len; bool negative; } ${p}_integer;
void ${p}_integer_dispose(${p}_integer *v);` : ""}
${[...resourceHeader ? [resourceHeader] : [], ...values.types, ...host ? host.header : [], ...types, ...prototypes].join("\n")}
#ifdef __cplusplus
}
#endif
#endif
`;
	const source = `#include "${p}.h"
#include <lean/lean.h>${wasm ? `\n#define initialize_BridgeCAsync initialize_${module}\n#define lb_c_error_text ${entryPrefix}_error_text` : ""}
${wasm && retained ? "#include <pthread.h>\n#define LB_WASM_CALLBACK_PORT 1\n#define LB_CB_FACTORY "+entryPrefix+"_cb_factory\n#define lb_c_cb_request "+entryPrefix+"_cb_request\n#define lb_c_cb_track "+entryPrefix+"_cb_track\n" : ""}${declarations.join("\n")}
#define LB(x) ${p}_##x
#define LB_SYNC_ONLY ${Number(synchronous)}${directCursors ? "\n#define LB_DIRECT_CURSORS 1" : ""}
#define LB_COMPONENT "ctask:${componentIdentity}"
#define LB_MAX_BYTES (16u * 1024u * 1024u)${retained ? "\n#define LB_RETAINED_TASKS 1" : ""}${host ? "\n#define LB_PUBLIC_C_CALLBACKS 1" : ""}
${wasmHost?"#define LB_WASM_HOST_ERRORS 1\n":""}#include "task-delivery.h"${resources.length ? "\n" + cResourceSupport : ""}${exact ? `\n#define LB_TASK_GMP ${Number(gmp)}\n#include "task-integers.h"` : ""}
${hasBudget ? nativeOnceC : ""}${clrExit ? clrCursorExit : ""}${values.bodies.join("\n")}
${host ? '#include "task-host-callback.h"\n' + host.helpers.join("\n") : ""}
${functions.join("\n")}
`;
	return { prefix: p, header, source
		, ...hasBudget && options.rustCallbacks ? { onceStatus: statuses.indexOf("CALLBACK_ALREADY_INVOKED") } : {}
		, entryLean: [...lean, "end " + namespace, ""].join("\n")
		, ...wasm ? {entryModule: module} : {}
		, declarations: declarations.join("\n"), symbols
		, ...exact ? { integerMode: gmp ? "gmp" : "words" } : {} };
};
