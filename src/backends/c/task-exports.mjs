/**
 * Generate a nonblocking C11 interface for compiler-checked Lean tasks and cursors.
 *
 * @file
 */
import { nativePullEntry, streamEntryLean } from "../native/pull-entry.mjs";
import { cTaskValues } from "./task-values.mjs";
import { emitRetainedTask, retainedLean, retainedPrototypes, retainedTask, wasmRetainedLean } from "./task-callback-exports.mjs";
import { cResourceApi, cResourceSupport, taskResourceTypes } from "./task-resources.mjs";
import { cHostCallbacks } from "./task-host-callback.mjs";

const baseStatuses = "OK PENDING END TYPED_ERROR IO_ERROR INVALID CLOSED BUSY IDLE WRONG_CONTEXT UNAVAILABLE NO_MEMORY LIMIT".split(" ");
const qualified = /^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)*$/u;

/**
 * Give each declaration a distinct handle type and reject stale or foreign IDs at runtime.
 *
 * @param options - Package name, captured modules, authenticated entries and native identity.
 */
export const generateCTaskExports = options => {
	const { name, modules, entries, componentIdentity } = options;
	const synchronous = options.synchronousIO === true;
	if(!/^[a-z][a-z0-9]*(?:[-_.][a-z0-9]+)*$/u.test(name) || !/^[0-9a-f]{64}$/u.test(componentIdentity)
		|| !modules?.length || !modules.every(m => qualified.test(m))
		|| (synchronous ? entries.some(e => e.delivery || e.taskIO) || !entries.some(e => ["IO", "BaseIO", "EIO"].includes(e.effect))
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
	const statuses = [...baseStatuses, ...publicC && (retained || terminal) ? ["TASK_IO_ERROR"] : [], ...publicC && retained ? ["CALLBACK_ERROR", "CALLBACK_CLOSED", "CALLBACK_TRAP"] : []];
	if(options.integerMode && !["gmp", "words"].includes(options.integerMode)) throw new TypeError("Unknown task integer ABI");
	const types = [], prototypes = [], functions = [], symbols = [`${p}_buffer_dispose`];
	const module = wasm ? "BridgeTask" + componentIdentity : "BridgeCAsync";
	const namespace = wasm ? module : "LeanBridgeCAsync";
	const entryPrefix = wasm ? "lb_wtask_" + componentIdentity : "lb_c";
	const names = new Set(), declarations = [
		`extern lean_object *initialize_${module}(uint8_t);`
		, `extern lean_object *${entryPrefix}_error_text(lean_object *);`
		, ...retained ? retainedPrototypes.map(x => wasm ? x.replaceAll("lb_c_cb",entryPrefix+"_cb") : x) : []
		, ...wasm && retained ? [`extern lean_object *${entryPrefix}_cb_factory(lean_object *,lean_object *);`] : []];
	const lean = [...wasm ? ["prelude", "import Init.System.Promise"] : []
		, ...modules.map(m => `import ${m}`)
		, ...retained ? ["import Init.System.Promise"] : []
		, "set_option autoImplicit false"
		, "namespace " + namespace
		, `@[export ${entryPrefix}_error_text] def errorText (e : IO.Error) : String := toString e`
		, ...synchronous ? [] : [streamEntryLean]
		, ...retained ? [wasm ? wasmRetainedLean(entryPrefix+"_cb") : retainedLean] : []
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
		const stream = e.delivery === "async-iterator", async = stream || e.delivery === "task";
		if(e.taskIO && e.delivery !== "task") throw new TypeError("Terminal IO errors require a real Task");
		if(e.delivery && !async || !["pure", "BaseIO", "EIO", "IO"].includes(e.effect)) throw new TypeError("Unsupported C task effect or delivery");
		const n = `${p}_${e.name}`, h = `${n}_handle`;
		if(retainedTask(e))
		{
			(host ? host.emit : emitRetainedTask)({ e, i, n, h, p, values, types, fn, lean, declarations, wasm, entryPrefix, wasmHost, hostValues: Boolean(hostKinds.length), witCallbacks: options.witCallbacks, wordAliases: Boolean(selected) || wasm || options.cppCallbacks || options.rubyDelivery || options.dotnetDelivery || options.jvmDelivery || options.perlDelivery || options.phpDelivery || options.witCallbacks, prototypes }); continue;
		}
		const args = e.parameters.map(a => values.codec(a.type));
		if(args.some(a => !a.arg)) throw new TypeError("C task arguments require scalar inputs");
		const item = values.codec(e.result), error = e.effect === "EIO" ? values.codec(e.error) : null;
		const step = e.stepError ? values.codec(e.stepError) : null;
		if(stream && (e.protocol?.open !== e.declaration || !qualified.test(e.protocol.next) || !qualified.test(e.protocol.close))) throw new TypeError("Invalid C pull protocol");
		if(e.stepIO && ((!hostKinds.length && !options.witDelivery) || !stream || step)) throw new TypeError("Invalid cursor IO failure contract");
		const ioTerminal=e.taskIO || e.stepIO;
		const pull = stream ? nativePullEntry(i, entryPrefix, e, item.lean, error?.lean, e.stepIO?"_root_.IO.Error":step?.lean) : null;
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
		if(async) types.push(`typedef struct { uint64_t id, domain; } ${h};`);
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
		fn(`${n}_${async ? "start" : "call"}`, [...args.map((a, k) => `${a.arg} v${k}`)
			, async ? `${h} *out` : values.out(item, "out")
			, ...error ? [values.out(error, "error")] : ioError ? [`${p}_buffer *io_error`] : []],
		`if (!out${async ? " || out->id" : occupied(item, "out")}${error ? " || !error" + occupied(error, "error") : ""}) return LB(INVALID);
    ${args.some(a => a.buffer) ? "size_t budget = 0;" : ""}
    ${checkedArgs}
    LB(status) s = lb_prepare(); if (s != LB(OK)) return s;${args.flatMap((a, k) => a.bind ? ["\n    " + a.bind(`v${k}`)] : []).join("")}
    ${async ? `lb_entry *owner; s = lb_reserve(${i}, &owner); if (s != LB(OK)) return s;` : ""}
    lean_object *io = ${entry}(${args.map((a, k) => a.argument(`v${k}`)).join(", ")});
    if (!lean_io_result_is_ok(io)) s = lb_io_failure(io, ${ioError ? "io_error" : "NULL"});
    else {
        lean_object *v = lean_io_result_get_value(io);
        ${error ? `int ok = lean_obj_tag(v) == 1; v = lean_ctor_get(v, 0);
        if (!ok) { s = ${error.read}(v, error); if (s == LB(OK)) s = LB(TYPED_ERROR); }
        else ` : ""}{
            ${stream ? `lean_inc(v); owner->cursor = v; owner->pull = ${pull.next}; owner->close = ${pull.close};`
				: async ? "s = lb_subscribe(owner, v);" : `s = ${item.read}(v, out);`}
        }
    }
    lean_dec(io); ${async ? "if (s == LB(OK)) { out->id = owner->id; out->domain = lb_domain; } else lb_drop(owner);" : ""} return s;`);
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
typedef enum { ${statuses.flatMap((s, i) => synchronous ? ["PENDING", "END", "IDLE"].includes(s) ? [] : [`${p}_${s} = ${i}`] : [`${p}_${s}`]).join(", ")} } ${p}_status;
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
#define LB_SYNC_ONLY ${Number(synchronous)}
#define LB_COMPONENT "ctask:${componentIdentity}"
#define LB_MAX_BYTES (16u * 1024u * 1024u)${retained ? "\n#define LB_RETAINED_TASKS 1" : ""}${host ? "\n#define LB_PUBLIC_C_CALLBACKS 1" : ""}
${wasmHost?"#define LB_WASM_HOST_ERRORS 1\n":""}#include "task-delivery.h"${resources.length ? "\n" + cResourceSupport : ""}${exact ? `\n#define LB_TASK_GMP ${Number(gmp)}\n#include "task-integers.h"` : ""}
${values.bodies.join("\n")}
${host ? '#include "task-host-callback.h"\n' + host.helpers.join("\n") : ""}
${functions.join("\n")}
`;
	return { prefix: p, header, source
		, entryLean: [...lean, "end " + namespace, ""].join("\n")
		, ...wasm ? {entryModule: module} : {}
		, declarations: declarations.join("\n"), symbols
		, ...exact ? { integerMode: gmp ? "gmp" : "words" } : {} };
};
