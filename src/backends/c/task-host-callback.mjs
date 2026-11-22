/**
 * Public C callbacks use typed function pointers, owned error payloads and one
 * polling descriptor. No callback queue, promise or Lean pointer is public.
 *
 * @file
 */
import { emitRetainedTask } from "./task-callback-exports.mjs";

/**
 * Generate reusable closure types followed by each concrete task's public entry points.
 *
 * @param config - Public namespace, value codecs and code-generation sinks.
 */
export const cHostCallbacks = config => {
	const { p, values, fn, types, prototypes, functions, symbols } = config;
	const header = [`typedef struct { uint32_t code; ${p}_buffer message; void *payload; void (*dispose_payload)(void *); } ${p}_callback_error;`];
	const helpers = [], shapes = new Map();
	header.push(`void ${p}_callback_error_dispose(${p}_callback_error *e);`);
	symbols.push(p + "_callback_error_dispose");
	fn(p + "_buffer_set", [p + "_buffer *out", p + "_view v"], `if (!out || out->data || out->len || (v.len && !v.data)) return LB(INVALID);
    return lb_copy(out, v.data, v.len);`);
	fn(p + "_callback_error_set", [p + "_callback_error *out", "uint32_t code", p + "_view text", "void *payload", "void (*dispose)(void *)"],
		`if (!lb_c_error_empty(out) || (text.len && !text.data)) return LB(INVALID);
    if (text.len > LB_MAX_BYTES) return LB(LIMIT);
    if (!lb_utf8(text)) return LB(INVALID);
    LB(status) s = lb_copy(&out->message, text.data, text.len); if (s != LB(OK)) return s;
    out->code = code; out->payload = payload; out->dispose_payload = dispose; return LB(CALLBACK_ERROR);`);
	const asArg = (c, v) => c.arg === p + "_view" ? `(LB(view)){${v}.data, ${v}.len}` : v;
	const addr = (c, v) => c.directMpz ? v : "&" + v;
	const shape = t => {
		if([t.argument, t.reply].some(v => v.kind !== "primitive")) throw new TypeError("C task callbacks require copied primitive inputs and replies");
		const key = t.argument.name + "_to_" + t.reply.name;
		if(shapes.has(key)) return shapes.get(key);
		const kind = shapes.size, base = `${p}_callback_${key}`, local = "lb_c_shape_" + kind;
		const input = values.codec(t.argument), reply = values.codec(t.reply);
		header.push(`typedef struct { uint64_t _private[2]; } ${base};`
			, `typedef ${p}_status (*${base}_fn)(void *context, ${input.arg} input, ${values.out(reply, "reply")}, ${p}_callback_error *error);`);
		helpers.push(`typedef struct { lb_c_closure base; ${base}_fn fn; } ${local};
static LB(status) ${local}_reply(lb_retained *r, ${reply.arg} v) {
    ${reply.buffer ? "size_t budget = 0;" : ""} ${reply.validate("v")}
    lb_retained_reply(r, 1, ${(reply.boxed ?? reply.argument)("v")}); return LB(OK);
}
static LB(status) ${local}_call(lb_c_closure *base, lb_c_owner *o) {
    ${input.type} arg = {0}; ${reply.type} result = {0};
    ${input.directMpz ? "mpz_init(arg);" : ""} ${reply.directMpz ? "mpz_init(result);" : ""}
    LB(callback_error) error = {0}; LB(status) s = ${input.read}(o->entry->retained.active->arg, ${addr(input, "arg")});
    if (s == LB(OK)) {
        s = ((${local} *)base)->fn(base->context, ${asArg(input, "arg")}, ${addr(reply, "result")}, &error);
        if (s != LB(OK) && s != LB(CALLBACK_ERROR) && s != LB(INVALID) && s != LB(LIMIT) && s != LB(NO_MEMORY)) {
            /* An undeclared callback status poisons even if it cancelled its own task. */
            lean_bridge_native_runtime_retire(); s = LB(CALLBACK_TRAP);
        } else if (!o->entry) s = LB(CLOSED);
        else if (!lean_bridge_native_component_ready(LB_COMPONENT)) s = LB(UNAVAILABLE);
        else if (s == LB(CALLBACK_ERROR)) s = lb_c_record(o, &error, s);
        else if (s == LB(OK)) s = lb_c_error_empty(&error) ? ${local}_reply(&o->entry->retained, ${asArg(reply, "result")}) : LB(INVALID);
    }
    LB(callback_error_dispose)(&error);
    ${input.dispose ? input.dispose + "(" + addr(input, "arg") + ");" : ""} ${reply.dispose ? reply.dispose + "(" + addr(reply, "result") + ");" : ""}
    return s;
}`);
		fn(base + "_make", [base + "_fn call", "void *context", "void (*dispose)(void *)", base + " *out"], `if (!call || !out || out->_private[0] || out->_private[1]) return LB(INVALID);
    LB(status) s = lb_prepare(); if (s != LB(OK)) return s;
    ${local} *f = calloc(1, sizeof *f); if (!f) return LB(NO_MEMORY);
    f->fn = call; f->base = (lb_c_closure){.kind=${kind}, .open=1, .context=context, .dispose=dispose, .call=${local}_call};
    s = lb_c_ticket_new(&f->base, out->_private); if (s != LB(OK)) free(f); return s;`);
		fn(base + "_retain", [base + " src", base + " *out"], `return lb_c_clone(src._private, ${kind}, out ? out->_private : NULL);`);
		for(const [action, revoke] of [["release", 0], ["close", 1]])
			fn(base + "_" + action, [base + " *h"], `return lb_c_remove(h ? h->_private : NULL, ${kind}, ${revoke});`);
		const record = { base, kind }; shapes.set(key, record); return record;
	};
	const emit = opts => {
		const { e, n, h, i } = opts, raw = "lb_c_private_" + i;
		const ps = e.parameters.map(({ type }, j) => type.kind === "io-callback" ? { j, cb: shape(type) } : { j, c: values.codec(type) });
		const value = values.codec(e.result), error = e.effect === "EIO" && values.codec(e.error);
		const privateFn = (name, args, body) => functions.push(`static LB(status) ${name}(${args.join(", ")}) {\n    ${body}\n}`);
		emitRetainedTask({ ...opts, n: raw, fn: privateFn, publicC: true });
		for(const [kind, c] of [["value", value], ["start_error", error]]) if(c)
		{
			const alias = n + "_" + kind; types.push(`typedef ${c.type} ${alias};`);
			if(c.dispose) prototypes.push(`static inline void ${alias}_dispose(${c.directMpz ? "mpz_ptr v" : alias + " *v"}) { ${c.dispose}(v); }`);
		}
		fn(n + "_start", [...ps.map(x => (x.cb?.base ?? x.c.arg) + " v" + x.j), h + " *out"],
			`if (!out || out->id) return LB(INVALID);
    lb_c_owner *o; LB(status) s = lb_c_new(${ps.length}, &o); if (s != LB(OK)) return s;
    ${ps.filter(x => x.cb).map(x => `if (s == LB(OK)) s = lb_c_bind(o, ${x.j}, v${x.j}._private, ${x.cb.kind});`).join("\n    ")}
    ${h} tmp = {0}; if (s == LB(OK)) s = ${raw}_start(${ps.filter(x => x.c).map(x => "v" + x.j + ", ").join("")}&tmp);
    if (s == LB(OK)) s = lb_c_attach(o, tmp.id, ${i});
    if (s == LB(OK)) *out = tmp; else if (tmp.id) lb_close(&tmp.id, tmp.domain, ${i});
    lb_c_unref(o); return s;`);
		fn(n + "_poll", [h + " h", "int *fd"], `return lb_c_poll(h.id, h.domain, ${i}, fd);`);
		fn(n + "_take", [h + " *h", values.out(value, "out"), ...error ? [values.out(error, "typed")] : [], p + "_callback_error *failure"],
			`if (!h || !out${value.resource ? " || out->_private[0] || out->_private[1]" : ""}${error ? " || !typed" + (error.resource ? " || typed->_private[0] || typed->_private[1]" : "") : ""} || !lb_c_error_empty(failure)) return LB(INVALID);
    lb_entry *e; LB(status) s = lb_lookup(h->id, h->domain, ${i}, &e, 1); if (s != LB(OK)) return s;
    lb_c_owner *o = e->host; o->refs++; int fd;
    s = lb_c_drive(o, &fd);
    if (s == LB(OK)) {
        if (o->fault != LB(OK) || !lean_bridge_native_component_ready(LB_COMPONENT)) {
            s = o->fault == LB(OK) ? LB(UNAVAILABLE) : o->fault; lb_close(&h->id, h->domain, ${i});
        } else {
            uint8_t phase = 0; uint32_t origin = 0;
            s = ${raw}_take(h, out, ${error ? "typed, " : ""}&failure->message, &origin, &phase);
            if (s == LB(IO_ERROR) && origin && origin <= o->failure_count) {
                lb_c_failure *f = &o->failures[origin - 1]; *failure = f->error; f->error = (LB(callback_error)){0}; s = f->status;
            } else if (s == LB(IO_ERROR) && origin) s = LB(UNAVAILABLE);
            else if (s == LB(IO_ERROR) && phase == 3) s = LB(TASK_IO_ERROR);
        }
    }
    lb_c_unref(o); return s;`);
		fn(n + "_close", [h + " *h"], `return h ? lb_close(&h->id, h->domain, ${i}) : LB(INVALID);`);
	};
	return { header, helpers, emit };
};
