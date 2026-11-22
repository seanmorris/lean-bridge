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
	const terminal = step ? shape(e.stepError) : e.taskIO ? "string" : null;
	const names = Object.fromEntries(["start", "take", "poll", "close", ...stream ? ["pull"] : []].map(k => [k, symbol + "_" + k]));
	const pass = (declared, text) => declared || text ? ["&error"] : [];
	const slot = (c, t, alias) => c ? n + "_" + alias + " error = {0};" : t ? p + "_buffer error = {0};" : "";
	const clear = (c, t, alias) => c?.dispose ? n + "_" + alias + "_dispose(&error);" : !c && t ? p + "_buffer_dispose(&error);" : "";
	const failure = (c, t, v) => v ? `if (s == ${p}_${c ? "TYPED_ERROR" : t ? "IO_ERROR" : "INVALID"}) { ${emit(v, "error", p)} }` : "";
	const save = "h[0] = owner.id; h[1] = owner.domain;";
	const owner = `${n}_handle owner = {h[0], h[1]};`;
	const startArgs = [...codecs.map((c, i) => input(c, args[i], i)), "&owner", ...pass(start, io)];
	const takeArgs = ["&owner", "&value", ...pass(step, e.taskIO)];
	const source = `int ${names.start}(const uint64_t *args, uint64_t *h, uint64_t *out, uint8_t *tags) {
    if (!h || h[0] || !out || !tags${args.length ? " || !args" : ""}) return ${p}_INVALID;
    (void)args; memset(out, 0, 4 * sizeof(*out)); ${checks.join("\n    ")}
    ${n}_handle owner = {0}; ${slot(start, io, "start_error")}
    ${p}_status s = ${n}_start(${startArgs.join(", ")}); ${save}
    ${failure(start, io, error)} ${clear(start, io, "start_error")} return (int)s;
}
int ${names.take}(uint64_t *h, uint64_t *out, uint8_t *tags) {
    if (!h || !out || !tags) return ${p}_INVALID;
    memset(out, 0, 4 * sizeof(*out)); ${owner}
    ${n}_value value = {0}; ${slot(step, e.taskIO, "step_error")}
    ${p}_status s = ${n}_take(${takeArgs.join(", ")}); ${save}
    if (s == ${p}_OK) { ${emit(result, "value", p)} }
    ${failure(step, e.taskIO, terminal)}
    ${item.dispose ? n + "_value_dispose(&value);" : ""} ${clear(step, e.taskIO, "step_error")} return (int)s;
}
int ${names.poll}(uint64_t *h, int *fd) { if (!h) return ${p}_INVALID; ${owner} return ${n}_poll(owner, fd); }
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
 * Combine completion, retirement and cancellation into one Ruby io_wait descriptor.
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
int ${open}(int source, int *gate) {
    if (!gate || source < 0) return ${p}_INVALID;
    gate[0] = gate[1] = -1;
    int retired = lean_bridge_native_retirement_watch();
    if (retired < 0) return ${p}_UNAVAILABLE;
    int mux = epoll_create1(EPOLL_CLOEXEC), cancel = eventfd(0, EFD_CLOEXEC | EFD_NONBLOCK);
    struct epoll_event event = {.events = EPOLLIN}; int fds[] = {source, retired, cancel};
    if (mux >= 0 && cancel >= 0) {
        unsigned i = 0; for (; i < 3; i++) if (epoll_ctl(mux, EPOLL_CTL_ADD, fds[i], &event) != 0) break;
        if (i == 3) { gate[0] = mux; gate[1] = cancel; return ${p}_OK; }
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
