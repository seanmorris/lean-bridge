/**
 * Pointer-only calls for native hosts whose FFI cannot pass C structs by value.
 * Each input occupies three 64-bit words. The result has three value words, an
 * ownership tag, and a separate byte per active Except tag. No Lean value escapes.
 *
 * @file
 */
import { cTaskValues } from "./task-values.mjs";
import { taskResourceTypes } from "./task-resources.mjs";
import { retainedWireEntry, taskWireEntry, taskWireWait } from "./task-wire.mjs";

const scalars = new Set("unit bool char uint8 uint16 uint32 uint64 usize int8 int16 int32 int64 isize float32 float64 string bytes nat int".split(" "));
const shape = t => {
	if(t?.kind === "primitive" && scalars.has(t.name)) return t.name;
	if(t?.kind === "apply" && t.constructor === "result" && t.arguments?.length === 2) return t.arguments.map(shape);
	throw new TypeError("The synchronous host wire requires a copied primitive or returned Except");
};
const depth = v => Array.isArray(v) ? 1 + Math.max(...v.map(depth)) : 0;
const buffer = s => s === "string" || s === "bytes", wide = s => s === "nat" || s === "int";
// On wasm32 the transport words are still 64-bit. Validate before a C cast
// can silently change a value, pointer or length and before Lean runs any IO.
const wasmArgument = (v, k) => {
	const [a, b, c] = [0, 1, 2].map(i => `args[${3 * k + i}]`);
	if(v.startsWith("lease:")) return `!${a} || !${b} || ${c}`;
	if(buffer(v) || wide(v)) return `!lb_wire_span(${a}, ${b}, ${wide(v) ? 8 : 1}) || ${c} > ${v === "int" ? 1 : 0}u`;
	const bits = { char: 32, usize: 32, float32: 32, uint8: 8, uint16: 16, uint32: 32 }[v];
	const signed = { isize: 32, int8: 8, int16: 16, int32: 32 }[v];
	const value = bits ? ` || ${a} > UINT${bits}_MAX`
		: signed ? ` || (${a} > INT${signed}_MAX && ${a} < (uint64_t)INT${signed}_MIN)` : "";
	return `${b} || ${c}${value}`;
};
const input = (c, v, i) => {
	const a = n => `args[${3 * i + n}]`;
	if(c.resource) return `(${c.arg}){{${a(0)},${a(1)}}}`;
	if(buffer(v)) return `(${c.arg}){(const uint8_t *)(uintptr_t)${a(0)}, ${a(1)}}`;
	if(wide(v)) return `(${c.arg}){(const uint64_t *)(uintptr_t)${a(0)}, ${a(1)}, ${a(2)} != 0}`;
	if(v === "float32" || v === "float64") return `lb_wire_${v}(${a(0)})`;
	return `(${c.arg})${a(0)}`;
};
const emit = (v, expr, p, index = 0) => {
	if(Array.isArray(v))
		return `if (${expr}.ok) { tags[${index}] = 1; ${emit(v[0], expr + ".as.value", p, index + 1)} }
        else { tags[${index}] = 0; ${emit(v[1], expr + ".as.error", p, index + 1)} }`;
	if(buffer(v)) return `out[0] = (uintptr_t)${expr}.data; out[1] = ${expr}.len; out[3] = 1; ${expr} = (${p}_buffer){0};`;
	if(wide(v)) return `out[0] = (uintptr_t)${expr}.words; out[1] = ${expr}.len; out[2] = ${expr}.negative; out[3] = 2; ${expr} = (${p}_integer){0};`;
	if(v === "float32" || v === "float64") return `memcpy(out, &${expr}, sizeof(${expr}));`;
	return `out[0] = (uint64_t)${expr};`;
};

/**
 * Generate the private compiled adapter and matching high-level method descriptors.
 *
 * @param prefix - Checked native component symbol prefix.
 * @param entries - Elaborated synchronous application declarations.
 * @param options - Enable native Task and pull descriptors for a task package.
 * @param options.tasks - Include task handles and scheduler wait operations.
 * @param options.resources - Nominal resource definitions authenticated by elaboration.
 * @param options.phpWasm - Check inputs for the synchronous wasm32 Zend transport.
 * @param options.wasm32 - Check inputs for a single-threaded wasm32 synchronous transport.
 * @param options.wasmTasks - Use owner notifications for threaded wasm32 task and pull handles.
 * @param options.wasmCallbacks - Enable owner-agent requests only for checked pthread task declarations.
 * @param options.witCallbacks - Preserve factory versus worker failures when dispatching on a Wasmtime store owner.
 */
export const generateSyncWire = (prefix, entries, { tasks = false, resources = [], phpWasm = false, wasm32 = false, wasmTasks = false, wasmCallbacks = false, witCallbacks = false } = {}) => {
	const checkedWasm = phpWasm || wasm32 || wasmTasks, host = phpWasm ? "PHP-Wasm" : "JavaScript-Wasm";
	if(witCallbacks && (!tasks || checkedWasm || wasmCallbacks)) throw new TypeError("Wasmtime callbacks require a native task wire");
	if((phpWasm || wasm32) && (tasks || resources.length)) throw new TypeError(`The ${host} sync wire does not admit task or resource handles`);
	if(wasmTasks && (!tasks || phpWasm || wasm32 || !wasmCallbacks && entries?.some(e => e.parameters.some(a => a.type.kind === "io-callback"))))
		throw new TypeError("Threaded Wasm requires task delivery without host callback arguments");
	if(!/^lbc_[a-z][a-z0-9_]*$/u.test(prefix) || !entries?.length) throw new TypeError("Invalid synchronous host wire identity");
	const p = prefix, stem = "lbwire_" + p + "_v1", kinds = taskResourceTypes(resources), values = cTaskValues(p, false, kinds);
	const leases = kinds.map((r, i) => ({ ...r, type: "lease:" + r.hash, tag: 3 + i, symbol: stem + "_lease_" + i }));
	const wireShape = t => leases.find(r => t?.kind === "named" && t.id === r.id)?.type ?? shape(t);
	const move = (t, v, prefix) => {
		const r = leases.find(x => x.type === t);
		return r ? `out[0] = ${v}._private[0]; out[1] = ${v}._private[1]; out[3] = ${r.tag}; ${v} = (${r.raw}){0};` : emit(t, v, prefix);
	};
	const symbols = [stem + "_clear"], methods = [];
	const functions = entries.map((e, i) => {
		if((!tasks && (e.delivery || e.taskIO)) || (e.delivery && !["task", "async-iterator"].includes(e.delivery)) || !["pure", "BaseIO", "EIO", "IO"].includes(e.effect)
			|| !/^[a-z][a-z0-9_]*$/u.test(e.name)) throw new TypeError("Expected an authenticated synchronous function");
		const n = p + "_" + e.name, symbol = stem + "_" + i;
		if(e.parameters.some(a => a.type.kind === "io-callback"))
		{
			if(!tasks || e.delivery !== "task") throw new TypeError("Retained host callbacks require a task");
			const wire = retainedWireEntry({ p, n, symbol, e, values, shape: wireShape, depth, input, emit: move, wasmTasks, wasmArgument, witCallbacks });
			methods.push(wire.method); symbols.push(...Object.values(wire.names)); return wire.source;
		}
		const args = e.parameters.map(a => wireShape(a.type));
		if(args.some(Array.isArray)) throw new TypeError("The host wire accepts copied scalar arguments");
		const codecs = e.parameters.map(a => values.codec(a.type)), result = wireShape(e.result), item = values.codec(e.result);
		const err = e.effect === "EIO" ? wireShape(e.error) : e.effect === "IO" ? "string" : null;
		const ec = e.effect === "EIO" ? values.codec(e.error) : null;
		const checks = args.map((v, k) => (v === "bool" || v === "unit") ? `if (args[${3 * k}] > ${v === "bool" ? 1 : 0}u) return ${p}_INVALID;` : "").filter(Boolean);
		if(checkedWasm) for(const [k, v] of args.entries()) checks.push(`if (${wasmArgument(v, k)}) return ${p}_INVALID;`);
		if(e.delivery)
		{
			const wire = taskWireEntry({ p, n, symbol, e, args, codecs, values, shape: wireShape, depth, input, emit: move, checks, wasmTasks });
			methods.push(wire.method); symbols.push(...Object.values(wire.names)); return wire.source;
		}
		methods.push({ name: e.name, declaration: e.declaration
			, symbol, args, result, error: err, effect: e.effect
			, tagBytes: Math.max(1, depth(result), depth(err)) }); symbols.push(symbol);
		const call = [...codecs.map((c, k) => input(c, args[k], k)), "&value", ...err ? ["&error"] : []];
		const alias = n + (tasks ? "_start_error" : "_error");
		return `int ${symbol}(const uint64_t *args, uint64_t *out, uint8_t *tags) {
    if (!out || !tags${args.length ? " || !args" : ""}) return ${p}_INVALID;
    (void)args; memset(out, 0, 4 * sizeof(*out));
    ${checks.join("\n    ")}
    ${n}_value value = {0}; ${err ? (ec ? alias : p + "_buffer") + " error = {0};" : ""}
    ${p}_status s = ${n}_call(${call.join(", ")});
    if (s == ${p}_OK) { ${move(result, "value", p)} }
    ${err ? `else if (s == ${p}_${ec ? "TYPED_ERROR" : "IO_ERROR"}) { ${move(err, "error", p)} }` : ""}
    ${item.dispose ? `${n}_value_dispose(&value);` : ""} ${ec?.dispose ? `${alias}_dispose(&error);` : e.effect === "IO" ? `${p}_buffer_dispose(&error);` : ""}
    return (int)s;
}`;
	});
	const leaseHelpers = leases.map(r => {
		const base = p + "_resource_" + r.slug, sym = r.symbol, t = r.raw;
		symbols.push(sym + "_close", sym + "_retain", sym + "_same");
		return `int ${sym}_close(uint64_t *h) {
    if (!h) return ${p}_INVALID; ${t} v = {{h[0],h[1]}}; int s = ${base}_release(&v);
    h[0] = v._private[0]; h[1] = v._private[1]; return s;
}
int ${sym}_retain(const uint64_t *h, uint64_t *out) {
    if (!h || !out || out[0] || out[1]) return ${p}_INVALID;
    ${t} v = {{h[0],h[1]}}, tmp = {0}; int s = ${base}_retain(v, &tmp);
    out[0] = tmp._private[0]; out[1] = tmp._private[1]; return s;
}
int ${sym}_same(const uint64_t *a, const uint64_t *b, uint8_t *out) {
    if (!a || !b || !out) return ${p}_INVALID; bool equal = false;
    int s = ${base}_same((${t}){{a[0],a[1]}}, (${t}){{b[0],b[1]}}, &equal); *out = equal; return s;
}`;
	}).join("\n");
	const source = `#include "${p}.h"
#include <string.h>
#include <limits.h>
${checkedWasm ? `#if !defined(__wasm32__) || !defined(__EMSCRIPTEN__) || ${wasmTasks ? "!" : ""}defined(__EMSCRIPTEN_PTHREADS__)
#error Expected the ${wasmTasks ? "threaded" : "single-threaded"} ${host} host
#endif
_Static_assert(sizeof(uintptr_t) == 4 && sizeof(size_t) == 4 && sizeof(float) == 4 && sizeof(double) == 8 && CHAR_BIT == 8, "${phpWasm ? "PHP" : "JavaScript"} wasm32 host wire");
static inline int lb_wire_span(uint64_t ptr, uint64_t count, unsigned stride) {
    uint64_t size = (uint64_t)__builtin_wasm_memory_size(0) * 65536u;
    return ptr <= UINT32_MAX && count <= UINT32_MAX && ptr <= size &&
        (!count || (ptr && ptr % stride == 0)) && count <= (size - ptr) / stride;
}` : '_Static_assert(sizeof(uintptr_t) == 8 && sizeof(size_t) == 8 && sizeof(float) == 4 && sizeof(double) == 8 && CHAR_BIT == 8, "Linux x86-64 host wire");'}
static inline float lb_wire_float32(uint64_t bits) { uint32_t u = (uint32_t)bits; float f; memcpy(&f, &u, 4); return f; }
static inline double lb_wire_float64(uint64_t bits) { double f; memcpy(&f, &bits, 8); return f; }${leaseHelpers && "\n" + leaseHelpers}
void ${stem}_clear(uint64_t *out) {
    if (!out) return;
    if (out[3] == 1) { ${p}_buffer v = {(uint8_t *)(uintptr_t)out[0], out[1]}; ${p}_buffer_dispose(&v); }
    ${values.hasIntegers() ? `else if (out[3] == 2) { ${p}_integer v = {(uint64_t *)(uintptr_t)out[0], out[1], out[2] != 0}; ${p}_integer_dispose(&v); }` : ""}
    ${leases.map(r => `else if (out[3] == ${r.tag} && out[0]) { ${r.symbol}_close(out); }`).join("\n    ")}memset(out, 0, 4 * sizeof(*out));
}
${functions.join("\n")}
`;
	const extra = leases.length ? { leases: leases.map(({ type, name, hash, tag, symbol }) => ({ type, name, hash, tag, symbol })) } : {};
	if(tasks && !wasmTasks)
	{
		const wait = taskWireWait(stem, p);
		return { source: source + wait.source + "\n", methods, symbols: [...symbols, ...Object.values(wait.names)], clear: symbols[0], wait: wait.names, ...extra };
	}
	return { source, methods, symbols, clear: symbols[0], ...extra };
};
