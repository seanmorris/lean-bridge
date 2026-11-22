/**
 * Generate native declarations for tasks whose factory or body may call the host.
 *
 * @file
 */
import { taskCallbackLean } from "../native/task-callback.mjs";

/**
 * Identify a task that must run its factory off the owner thread.
 *
 * @param entry - Authenticated task export.
 */
export const retainedTask = entry => entry.parameters.some(x => x.type.kind === "io-callback");
export const retainedLean = taskCallbackLean("lb_c_cb") + `
inductive Outcome (ε α : Type) where
  | value (v : α)
  | startError (e : ε)
  | startIO (e : IO.Error)
  | taskIO (e : IO.Error)
`;
export const retainedPrototypes = ["extern lean_object *lb_c_cb_request(lean_object *, uint32_t, lean_object *, lean_object *);"
	, "extern lean_object *lb_c_cb_track(lean_object *, lean_object *);"];

/**
 * Add the concrete factory, typed request/reply accessors and outcome decoder.
 *
 * @param options - Checked entry, codec table and component generation buffers.
 */
export const emitRetainedTask = options => {
	const { e, i, n, h, p, values, types, fn, lean, declarations } = options;
	if(e.delivery !== "task") throw new TypeError("Retained callbacks require a compiled Task");
	const ps = e.parameters.map(({ type }, j) => type.kind === "io-callback"
		? { j, input: values.codec(type.argument), reply: values.codec(type.reply) } : { j, c: values.codec(type) });
	const args = ps.filter(x => x.c), callbacks = ps.filter(x => !x.c);
	const value = values.codec(e.result), error = e.effect === "EIO" && values.codec(e.error);
	const entry = "lb_c_invoke_" + i, call = `(_root_.${e.declaration} ${ps.map(x => x.c ? "v" + x.j : "(cbInvoke port " + x.j + ")").join(" ")})`;
	const factory = error ? "_root_.EIO.toIO' " + call : e.effect === "pure" ? "pure " + call : e.effect === "BaseIO" ? "liftM " + call : call;
	const payload = e.taskIO ? `(_root_.Except _root_.IO.Error ${value.lean})` : value.lean;
	const task = `(_root_.Task ${payload})`, start = error ? `(_root_.Except ${error.lean} ${task})` : task;
	// Even a factory that calls the host before returning its Task has to run
	// off the owner. cbTrack also cancels a late inner task after owner disposal.
	lean.push(`@[export ${entry}] def invoke${i} (port : CallbackPort) ${args.map(x => "(v" + x.j + " : " + x.c.lean + ")").join(" ")} : BaseIO (Task (Outcome ${error?.lean || "Unit"} ${value.lean})) := BaseIO.asTask do
  let factory : IO ${start} := ${factory}
  let finish (inner : ${task}) : BaseIO (Outcome ${error?.lean || "Unit"} ${value.lean}) := do
    cbTrack port inner
    let result ← IO.wait inner
    ${e.taskIO ? "match result with\n    | .ok v => return .value v\n    | .error e => return .taskIO e" : "return .value result"}
  match ← factory.toBaseIO with
  | .error e => return .startIO e
  ${error ? "| .ok (.error e) => return .startError e\n  | .ok (.ok inner) => finish inner" : "| .ok inner => finish inner"}`);
	declarations.push(`extern lean_object *${entry}(lean_object *${args.map(x => ", " + x.c.abi).join("")});`);
	types.push(`typedef struct { uint64_t id, domain; } ${h};`);
	if(options.cpp) for(const [kind, c] of [["value", value], ["start_error", error], ...callbacks.map(x => ["callback_arg_" + x.j, x.input])])
	{
		if(!c) continue;
		const alias = n + "_" + kind;
		types.push(`typedef ${c.type} ${alias};`);
		if(c.dispose) options.prototypes.push(`static inline void ${alias}_dispose(${alias} *v) { ${c.dispose}(v); }`);
	}
	const checked = (c, v) => c.validate(v);
	fn(n + "_start", [...args.map(x => x.c.arg + " v" + x.j), h + " *out"], `if (!out || out->id) return LB(INVALID);
    ${args.some(x => x.c.buffer) ? "size_t budget = 0;" : ""}
    ${args.map(x => checked(x.c, "v" + x.j)).join("\n    ")}
    LB(status) s = lb_prepare(); if (s != LB(OK)) return s;
    ${args.filter(x => x.c.bind).map(x => x.c.bind("v" + x.j)).join("\n    ")}
    lb_entry *e; s = lb_reserve(${i}, &e); if (s != LB(OK)) return s;
    int err = lb_cb_new(0, EFD_SEMAPHORE, &e->retained.token);
    if (err) { lb_drop(e); return err == ENOMEM ? LB(NO_MEMORY) : LB(UNAVAILABLE); }
    lean_inc(e->retained.token);
    /* BaseIO, unlike IO, returns the value directly at this ABI. All
       application failures are materialized inside the task's Outcome. */
    lean_object *task = ${entry}(e->retained.token${args.map(x => ", " + x.c.argument("v" + x.j)).join("")});
    s = lb_subscribe(e, task); lean_dec(task);
    if (s != LB(OK)) { lb_drop(e); return s; }
    out->id = e->id; out->domain = lb_domain; return LB(OK);`);
	const get = `lb_entry *e; LB(status) s = lb_lookup(h.id, h.domain, ${i}, &e, 0); if (s != LB(OK)) return s;`;
	fn(n + "_poll", [h + " h", "int *fd"], `return lb_poll(h.id, h.domain, ${i}, fd);`);
	fn(n + "_close", [h + " *h"], `return h ? lb_close(&h->id, h->domain, ${i}) : LB(INVALID);`);
	if(callbacks.length)
	{
		fn(n + "_callbacks", [h + " h", "int *fd"], `${get}
    if (!fd) return LB(INVALID); *fd = ((lb_port *)lean_get_external_data(e->retained.token))->fd; return LB(OK);`);
		fn(n + "_next", [h + " h", "uint32_t *slot"], get + " if (lb_watch_ready(&e->watch)) return LB(PENDING); return lb_retained_next(&e->retained, slot);");
		fn(n + "_fail", [h + " h", p + "_view msg", "uint32_t *id"], get + " return lb_retained_failure(&e->retained, msg, id);");
		fn(n + "_poison", [h + " h"], get + " lean_bridge_native_runtime_retire(); return LB(OK);");
		for(const { j, input, reply } of callbacks)
		{
			const active = `${get} lb_req *q = e->retained.active; if (!q || q->slot != ${j}) return LB(INVALID);`;
			fn(n + "_arg_" + j, [h + " h", values.out(input, "out")], `${active} return out ? ${input.read}(q->arg, out) : LB(INVALID);`);
			fn(n + "_reply_" + j, [h + " h", reply.arg + " v"], `${active}
    ${reply.buffer ? "size_t budget = 0;" : ""} ${checked(reply, "v")}
    lb_retained_reply(&e->retained, 1, ${(reply.boxed ?? reply.argument)("v")}); return LB(OK);`);
		}
	}
	fn(n + "_take", [h + " *h", values.out(value, "out"), ...error ? [values.out(error, "error")] : [], p + "_buffer *msg", "uint32_t *origin", "uint8_t *phase"], `if (!h || !out || !msg || !origin || !phase${error ? " || !error" : ""}) return LB(INVALID);
    lb_entry *e; LB(status) s = lb_lookup(h->id, h->domain, ${i}, &e, 0); if (s != LB(OK)) return s;
    if (!lb_watch_ready(&e->watch)) return LB(PENDING);
    lean_object *v = lean_task_get(e->watch.source), *x = lean_ctor_get(v, 0);
    switch (lean_obj_tag(v)) {
    case 0: s = ${value.read}(x, out); break;
    ${error ? `case 1: s = ${error.read}(x, error); if (s == LB(OK)) s = LB(TYPED_ERROR); break;` : ""}
    case 2: case 3:
        *phase = lean_obj_tag(v); *origin = lb_retained_origin(&e->retained, x);
        if (*origin) s = LB(IO_ERROR);
        else { lean_inc(x); lean_object *text = lb_c_error_text(x); s = lb_string(msg, text); lean_dec(text); if (s == LB(OK)) s = LB(IO_ERROR); }
        break;
    default: s = LB(UNAVAILABLE);
    }
    h->id = 0; lb_drop(e); return s;`);
};
