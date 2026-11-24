/**
 * Pointer-only entry points for real native tasks, cursor pulls and scheduler waits.
 *
 * @file
 */

/**
 * Build a per-declaration native handle adapter without passing structs by value.
 *
 * @param a - Authenticated entry, scalar codecs and owning conversion emitters.
 */
export const taskWireEntry = a => {
	const { p, n, symbol, e, args, codecs, values, shape, depth, input, emit, checks } = a;
	const stream = e.delivery === "async-iterator", item = values.codec(e.result), result = shape(e.result);
	const start = e.effect === "EIO" ? values.codec(e.error) : null, io = e.effect === "IO";
	const error = start ? shape(e.error) : io ? "string" : null;
	const step = e.stepError ? values.codec(e.stepError) : null;
	const ioTerminal=e.taskIO || e.stepIO;
	const terminal = step ? shape(e.stepError) : ioTerminal ? "string" : null;
	const names = Object.fromEntries(["start", "take", ...a.wasmTasks ? ["listen", "cancel"] : ["poll"], "close", ...stream ? ["pull"] : []].map(k => [k, symbol + "_" + k]));
	const pass = (declared, text) => declared || text ? ["&error"] : [];
	const slot = (c, t, alias) => c ? n + "_" + alias + " error = {0};" : t ? p + "_buffer error = {0};" : "";
	const clear = (c, t, alias) => c?.dispose ? n + "_" + alias + "_dispose(&error);" : !c && t ? p + "_buffer_dispose(&error);" : "";
	const failure = (c, t, v,phase) => v ? `if (s == ${p}_${c ? "TYPED_ERROR" : t ? "IO_ERROR" : "INVALID"}) { ${c?emit(v,"error",p):a.errorWord(emit(v,"error",p),phase)} }` : "";
	const save = "h[0] = owner.id; h[1] = owner.domain;";
	const owner = `${n}_handle owner = {h[0], h[1]};`;
	const startArgs = [...codecs.map((c, i) => input(c, args[i], i)), "&owner", ...pass(start, io)];
	const takeArgs = ["&owner", "&value", ...pass(step, ioTerminal)];
	const source = `int ${names.start}(const uint64_t *args, uint64_t *h, uint64_t *out, uint8_t *tags) {
    if (!h || h[0] || !out || !tags${args.length ? " || !args" : ""}) return ${p}_INVALID;
    (void)args; memset(out, 0, 4 * sizeof(*out)); ${checks.join("\n    ")}
    ${n}_handle owner = {0}; ${slot(start, io, "start_error")}
    ${p}_status s = ${n}_start(${startArgs.join(", ")}); ${save}
    ${failure(start, io, error,2)} ${clear(start, io, "start_error")} return (int)s;
}
int ${names.take}(uint64_t *h, uint64_t *out, uint8_t *tags) {
    if (!h || !out || !tags) return ${p}_INVALID;
    memset(out, 0, 4 * sizeof(*out)); ${owner}
    ${n}_value value = {0}; ${slot(step, ioTerminal, "step_error")}
    ${p}_status s = ${n}_take(${takeArgs.join(", ")}); ${save}
    if (s == ${p}_OK) { ${emit(result, "value", p)} }
    ${failure(step, ioTerminal, terminal,stream?4:3)}
    ${item.dispose ? n + "_value_dispose(&value);" : ""} ${clear(step, ioTerminal, "step_error")} return (int)s;
}
${a.wasmTasks ? `int ${names.listen}(uint64_t *h, uint32_t token) { if (!h) return ${p}_INVALID; ${owner} return ${n}_listen(owner, token); }
int ${names.cancel}(uint64_t *h) { if (!h) return ${p}_INVALID; ${owner} return ${n}_cancel(owner); }` : `int ${names.poll}(uint64_t *h, int *fd) { if (!h) return ${p}_INVALID; ${owner} return ${n}_poll(owner, fd); }`}
int ${names.close}(uint64_t *h) { if (!h) return ${p}_INVALID; ${owner} int s = ${n}_close(&owner); ${save} return s; }
${stream ? `int ${names.pull}(uint64_t *h) { if (!h) return ${p}_INVALID; ${owner} return ${n}_pull(owner); }` : ""}`;
	const method = { name: e.name, declaration: e.declaration
		, symbol, args, result, error, terminal
		, effect: e.effect, delivery: e.delivery
		, stepDeclaration: e.protocol?.next, names
		, tagBytes: Math.max(1, depth(result), depth(error), depth(terminal)) };
	return { names, source, method };
};

/**
 * Adapt the private typed callback port. Workers see Lean promises, never host objects.
 * Status 13 is a factory IO error; 14 carries the original host failure's one-based ID.
 *
 * @param a - Compiler-authenticated declaration, word codecs and copy emitters.
 */
export const retainedWireEntry = a => {
	const { p, n, symbol, e, values, shape, depth, input, emit } = a;
	const callbacks = [], args = [], checked = [], pass = [];
	const valid = (type, word) => a.wasmTasks ? `if (${a.wasmArgument(type,word/3)}${["unit","bool"].includes(type) ? " || args["+word+"] > "+(type==="bool" ? 1 : 0)+"u" : ""}) return ${p}_INVALID;` : ["unit", "bool"].includes(type)
		? `if (args[${word}] > ${type === "bool" ? 1 : 0}u) return ${p}_INVALID;` : "";
	for(const [j, { type }] of e.parameters.entries())
	{
		if(type.kind === "io-callback")
		{
			if(![type.argument,type.reply].every(t=>t.kind==="primitive" || a.hostValues && t.kind==="named" && values.codec(t).host))
				throw new TypeError("Retained callbacks require copied scalars or checked host objects");
			callbacks.push({ j, arg: shape(type.argument), reply: shape(type.reply), from: values.codec(type.argument), to: values.codec(type.reply) });
			args.push("callback");
			if(a.wasmTasks) checked.push(`if (args[${j*3}] || args[${j*3+1}] || args[${j*3+2}]) return ${p}_INVALID;`);
		}
		else
		{
			const t = shape(type); if(Array.isArray(t)) throw new TypeError("Retained task arguments must be copied scalars");
			args.push(t); checked.push(valid(t, j * 3)); pass.push(input(values.codec(type), t, j));
		}
	}
	const result = shape(e.result), value = values.codec(e.result);
	const err = e.effect === "EIO" ? shape(e.error) : null, ec = err && values.codec(e.error);
	const names = Object.fromEntries((a.wasmTasks ? "start listen cancel arm close take next arg reply fail" : "start poll close take callbacks next arg reply fail trap").split(" ").map(k => [k, symbol + "_" + k]));
	const owner = `${n}_handle o = {h[0], h[1]};`, save = "h[0] = o.id; h[1] = o.domain;";
	const source = `#include "lean_bridge_native_runtime.h"
int ${names.start}(const uint64_t *args, uint64_t *h, uint64_t *out, uint8_t *tags) {
    if (!args || !h || h[0] || !out || !tags) return ${p}_INVALID;
    ${checked.join(" ")} ${n}_handle o = {0}; int s = ${n}_start(${[...pass, "&o"].join(", ")}); ${save} return s;
}
${a.wasmTasks ? `int ${names.listen}(uint64_t *h,uint32_t t) { ${owner} return ${n}_listen(o,t); }
int ${names.arm}(uint64_t *h,uint32_t t) { ${owner} return ${n}_arm(o,t); }
int ${names.cancel}(uint64_t *h) { ${owner} return ${n}_cancel(o); }` : `int ${names.poll}(uint64_t *h, int *fd) { if (!h) return ${p}_INVALID; ${owner} return ${n}_poll(o, fd); }`}
int ${names.close}(uint64_t *h) { if (!h) return ${p}_INVALID; ${owner} int s = ${n}_close(&o); ${save} return s; }
${a.wasmTasks ? "" : `int ${names.callbacks}(uint64_t *h, int *fd) { if (!h) return ${p}_INVALID; ${owner} return ${n}_callbacks(o, fd); }`}
int ${names.next}(uint64_t *h, uint32_t *slot) { if (!h) return ${p}_INVALID; ${owner} return ${n}_next(o, slot); }
int ${names.arg}(uint64_t *h, uint32_t slot, uint64_t *out) {
    if (!h || !out) return ${p}_INVALID; ${owner} memset(out, 0, 4 * sizeof(*out));
    switch (slot) {
    ${callbacks.map(x => `case ${x.j}: { ${n}_callback_arg_${x.j} v = {0}; int s = ${n}_arg_${x.j}(o, &v);
        if (s == ${p}_OK) { ${emit(x.arg, "v", p)} } ${x.from.dispose ? n + "_callback_arg_" + x.j + "_dispose(&v);" : ""} return s; }`).join("\n    ")}
    default: return ${p}_INVALID; }
}
int ${names.reply}(uint64_t *h, uint32_t slot, const uint64_t *args) {
    if (!h || !args) return ${p}_INVALID; ${owner}
    switch (slot) { ${callbacks.map(x => `case ${x.j}: ${valid(x.reply, 0)} return ${n}_reply_${x.j}(o, ${input(x.to, x.reply, 0)});`).join("\n    ")}
    default: return ${p}_INVALID; }
}
int ${names.fail}(uint64_t *h, const uint64_t *args, uint32_t *id) {
    if (!h || !args || !id) return ${p}_INVALID; ${a.wasmTasks ? valid("string",0) : ""} ${owner} return ${n}_fail(o, (${p}_view){(const uint8_t *)(uintptr_t)args[0],args[1]}, id);
}
${a.wasmTasks ? "" : `void ${names.trap}(void) { lean_bridge_native_runtime_retire(); }`}
int ${names.take}(uint64_t *h, uint64_t *out, uint8_t *tags) {
    if (!h || !out || !tags) return ${p}_INVALID;
    ${owner} memset(out, 0, 4 * sizeof(*out)); ${n}_value v = {0}; ${ec ? n + "_start_error er = {0};" : ""}
    ${p}_buffer msg = {0}; uint32_t origin = 0; uint8_t phase = 0;
    int s = ${n}_take(&o, &v, ${ec ? "&er, " : ""}&msg, &origin, &phase); ${save}
    if (s == ${p}_OK) { ${emit(result, "v", p)} }
    ${ec ? `else if (s == ${p}_TYPED_ERROR) { ${emit(err, "er", p)} }` : ""}
    else if (s == ${p}_IO_ERROR) {
        if (origin) { ${a.witCallbacks ? emit("string","msg",p)+" out[2] = origin; tags[0] = phase; " : "out[0] = origin; "+(a.wasmTasks ? "out[1] = phase; " : "")}s = 14; }
        ${a.wasmHost?"else if (msg.host_ticket) { out[0]=msg.host_ticket; out[1]=phase; s=15; }":""}
        else { ${emit("string", "msg", p)} if (phase == 2) s = 13; }
    }
    ${value.dispose ? n + "_value_dispose(&v);" : ""} ${ec?.dispose ? n + "_start_error_dispose(&er);" : ""} ${p}_buffer_dispose(&msg); return s;
}`;
	const method = { name: e.name, declaration: e.declaration, symbol, names
		, args
		, result
		, error: err ?? ((a.wasmTasks || a.witCallbacks) && e.effect==="IO" ? "string" : null)
		, effect: e.effect
		, delivery: e.delivery
		, ...(a.wasmTasks || a.witCallbacks) ? {terminal: e.taskIO ? "string" : null} : {}
		, callbacks: callbacks.map(({ j, arg, reply }) => [j, arg, reply])
		, tagBytes: Math.max(1, depth(err), depth(result)) };
	return { source, names, method };
};

/**
 * Combine completion, retirement, optional callback requests and cancellation
 * into one readable descriptor for the host event loop.
 *
 * @param stem - Component-private wire prefix.
 * @param p - Native status prefix.
 */
export const taskWireWait = (stem, p) => {
	const open = stem + "_wait_open", wake = stem + "_wait_wake", close = stem + "_wait_close";
	const source = `#include <sys/epoll.h>
#include <sys/eventfd.h>
#include <unistd.h>
#include <errno.h>
#include "lean_bridge_native_runtime.h"
int ${open}(int source, int callback, int *gate) {
    if (!gate || source < 0) return ${p}_INVALID;
    gate[0] = gate[1] = -1;
    int retired = lean_bridge_native_retirement_watch();
    if (retired < 0) return ${p}_UNAVAILABLE;
    int mux = epoll_create1(EPOLL_CLOEXEC), cancel = eventfd(0, EFD_CLOEXEC | EFD_NONBLOCK);
    struct epoll_event event = {.events = EPOLLIN}; int fds[] = {source, retired, cancel, callback};
    unsigned count = callback < 0 ? 3u : 4u;
    if (mux >= 0 && cancel >= 0) {
        unsigned i = 0; for (; i < count; i++) if (epoll_ctl(mux, EPOLL_CTL_ADD, fds[i], &event) != 0) break;
        if (i == count) { gate[0] = mux; gate[1] = cancel; return ${p}_OK; }
    }
    if (mux >= 0) close(mux);
    if (cancel >= 0) close(cancel);
    lean_bridge_native_retirement_unwatch(); return ${p}_UNAVAILABLE;
}
void ${wake}(int *gate) {
    if (!gate || gate[1] < 0) return;
    uint64_t one = 1; while (write(gate[1], &one, sizeof(one)) < 0 && errno == EINTR) {}
}
void ${close}(int *gate) {
    if (!gate || gate[0] < 0) return;
    close(gate[0]); close(gate[1]); gate[0] = gate[1] = -1;
    lean_bridge_native_retirement_unwatch();
}`;
	return { names: { open, wake, close }, source };
};
