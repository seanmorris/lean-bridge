/**
 * Generate a nonblocking C11 interface for compiler-checked Lean tasks and cursors.
 *
 * @file
 */
import { nativePullEntry, streamEntryLean } from "../native/pull-entry.mjs";
import { cTaskValues } from "./task-values.mjs";
import { emitRetainedTask, retainedLean, retainedPrototypes, retainedTask } from "./task-callback-exports.mjs";
import { cResourceApi, cResourceSupport, taskResourceTypes } from "./task-resources.mjs";

const statuses = "OK PENDING END TYPED_ERROR IO_ERROR INVALID CLOSED BUSY IDLE WRONG_CONTEXT UNAVAILABLE NO_MEMORY LIMIT".split(" ");
const qualified = /^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)*$/u;

/**
 * Give each declaration a distinct handle type and reject stale or foreign IDs at runtime.
 *
 * @param options - Package name, captured modules, authenticated entries and native identity.
 */
export const generateCTaskExports = options => {
	const { name, modules, entries, componentIdentity } = options;
	if(!/^[a-z][a-z0-9]*(?:[-_.][a-z0-9]+)*$/u.test(name) || !/^[0-9a-f]{64}$/u.test(componentIdentity)
		|| !modules?.length || !modules.every(m => qualified.test(m)) || !entries.some(e => e.delivery)) throw new TypeError("Invalid C task component");
	const p = `lbc_${name.replaceAll(/[-.]/gu, "_")}`, gmp = options.integerMode !== "words", resources = taskResourceTypes(options.resources);
	const values = cTaskValues(p, gmp, resources);
	const retained = entries.some(retainedTask);
	if((retained || entries.some(e => e.taskIO)) && (Boolean(options.rustCallbacks) === Boolean(options.cppCallbacks) || gmp)) throw new TypeError("This task callback ABI requires Rust or C++ word carriers");
	if(options.integerMode && !["gmp", "words"].includes(options.integerMode)) throw new TypeError("Unknown task integer ABI");
	const types = [], prototypes = [], functions = [], symbols = [`${p}_buffer_dispose`];
	const names = new Set(), declarations = [
		"extern lean_object *initialize_BridgeCAsync(uint8_t);"
		, "extern lean_object *lb_c_error_text(lean_object *);"
		, ...retained ? retainedPrototypes : []];
	const lean = [...modules.map(m => `import ${m}`)
		, ...retained ? ["import Init.System.Promise"] : []
		, "set_option autoImplicit false"
		, "namespace LeanBridgeCAsync"
		, "@[export lb_c_error_text] def errorText (e : IO.Error) : String := toString e"
		, streamEntryLean, ...retained ? [retainedLean] : []];
	const fn = (name, args, body) => {
		const signature = `${p}_status ${name}(${args.join(", ") || "void"})`;
		symbols.push(name); prototypes.push(signature + ";"); functions.push(`${signature} {\n    ${body}\n}`);
	};
	const resourceHeader = cResourceApi(p, resources, fn);
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
			emitRetainedTask({ e, i, n, h, p, values, types, fn, lean, declarations, cpp: options.cppCallbacks, prototypes }); continue;
		}
		const args = e.parameters.map(a => values.codec(a.type));
		if(args.some(a => !a.arg)) throw new TypeError("C task arguments require scalar inputs");
		const item = values.codec(e.result), error = e.effect === "EIO" ? values.codec(e.error) : null;
		const step = e.stepError ? values.codec(e.stepError) : null;
		if(stream && (e.protocol?.open !== e.declaration || !qualified.test(e.protocol.next) || !qualified.test(e.protocol.close))) throw new TypeError("Invalid C pull protocol");
		const pull = stream ? nativePullEntry(i, "lb_c", e, item.lean, error?.lean, step?.lean) : null;
		if(pull)
		{
			lean.push(pull.helpers); declarations.push(pull.declarations);
		}
		const entry = `lb_c_invoke_${i}`, payload = e.taskIO ? `(_root_.Except _root_.IO.Error ${item.lean})` : item.lean;
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
		for(const [kind, c] of [["value", item], ["start_error", error], ["step_error", step]])
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
		fn(`${n}_poll`, [`${h} h`, "int *fd"], `return lb_poll(h.id, h.domain, ${i}, fd);`);
		fn(`${n}_take`, [`${h} *h`, values.out(item, "out"), ...step ? [values.out(step, "error")] : [], ...e.taskIO ? [`${p}_buffer *message`] : []],
			`if (!h || !out${occupied(item, "out")}${step ? " || !error" + occupied(step, "error") : ""}${e.taskIO ? " || !message" : ""}) return LB(INVALID);
    lb_entry *e; LB(status) s = lb_lookup(h->id, h->domain, ${i}, &e, 0);
    if (s != LB(OK)) return s;
    if (!e->watch.source) return LB(IDLE);
    if (!lb_watch_ready(&e->watch)) return LB(PENDING);
    lean_object *v = lean_task_get(e->watch.source);
    ${e.taskIO ? `if (!lean_obj_tag(v)) {
        lean_object *err = lean_ctor_get(v, 0); lean_inc(err); lean_object *text = lb_c_error_text(err);
        s = lb_string(message, text); lean_dec(text); if (s == LB(OK)) s = LB(IO_ERROR);
    } else { v = lean_ctor_get(v, 0);` : ""}
    ${step ? `if (!lean_obj_tag(v)) { s = ${step.read}(lean_ctor_get(v, 0), error); if (s == LB(OK)) s = LB(TYPED_ERROR); }
    else { v = lean_ctor_get(v, 0);` : ""}
    ${stream ? `if (!lean_obj_tag(v)) s = LB(END);
    else s = ${item.read}(lean_ctor_get(v, 0), out);` : `s = ${item.read}(v, out);`}${step || e.taskIO ? " }" : ""}
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
typedef enum { ${statuses.map(s => `${p}_${s}`).join(", ")} } ${p}_status;
typedef struct { const uint8_t *data; size_t len; } ${p}_view;
typedef struct { uint8_t *data; size_t len; } ${p}_buffer;
void ${p}_buffer_dispose(${p}_buffer *v);${exact && !gmp ? `
typedef struct { const uint64_t *words; size_t len; bool negative; } ${p}_integer_view;
typedef struct { uint64_t *words; size_t len; bool negative; } ${p}_integer;
void ${p}_integer_dispose(${p}_integer *v);` : ""}
${[...resourceHeader ? [resourceHeader] : [], ...values.types, ...types, ...prototypes].join("\n")}
#ifdef __cplusplus
}
#endif
#endif
`;
	const source = `#include "${p}.h"
#include <lean/lean.h>
${declarations.join("\n")}
#define LB(x) ${p}_##x
#define LB_COMPONENT "ctask:${componentIdentity}"
#define LB_MAX_BYTES (16u * 1024u * 1024u)${retained ? "\n#define LB_RETAINED_TASKS 1" : ""}
#include "task-delivery.h"${resources.length ? "\n" + cResourceSupport : ""}${exact ? `\n#define LB_TASK_GMP ${Number(gmp)}\n#include "task-integers.h"` : ""}
${values.bodies.join("\n")}
${functions.join("\n")}
`;
	return { prefix: p, header, source
		, entryLean: [...lean, "end LeanBridgeCAsync", ""].join("\n")
		, declarations: declarations.join("\n"), symbols
		, ...exact ? { integerMode: gmp ? "gmp" : "words" } : {} };
};
