/**
 * Pointer-only calls for native hosts whose FFI cannot pass C structs by value.
 * Each input occupies three 64-bit words. The result has three value words, an
 * ownership tag, and a separate byte per active Except tag. No Lean value escapes.
 *
 * @file
 */
import { cTaskValues } from "./task-values.mjs";

const scalars = new Set("unit bool char uint8 uint16 uint32 uint64 usize int8 int16 int32 int64 isize float32 float64 string bytes nat int".split(" "));
const shape = t => {
	if(t?.kind === "primitive" && scalars.has(t.name)) return t.name;
	if(t?.kind === "apply" && t.constructor === "result" && t.arguments?.length === 2) return t.arguments.map(shape);
	throw new TypeError("The synchronous host wire requires a copied primitive or returned Except");
};
const depth = v => Array.isArray(v) ? 1 + Math.max(...v.map(depth)) : 0;
const buffer = s => s === "string" || s === "bytes", wide = s => s === "nat" || s === "int";
const input = (c, v, i) => {
	const a = n => `args[${3 * i + n}]`;
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
 */
export const generateSyncWire = (prefix, entries) => {
	if(!/^lbc_[a-z][a-z0-9_]*$/u.test(prefix) || !entries?.length) throw new TypeError("Invalid synchronous host wire identity");
	const p = prefix, stem = "lbwire_" + p + "_v1", values = cTaskValues(p, false);
	const symbols = [stem + "_clear"], methods = [];
	const functions = entries.map((e, i) => {
		if(e.delivery || e.taskIO || !["pure", "BaseIO", "EIO", "IO"].includes(e.effect)
			|| !/^[a-z][a-z0-9_]*$/u.test(e.name)) throw new TypeError("Expected an authenticated synchronous function");
		const args = e.parameters.map(a => shape(a.type));
		if(args.some(Array.isArray)) throw new TypeError("The host wire accepts copied scalar arguments");
		const codecs = e.parameters.map(a => values.codec(a.type)), result = shape(e.result), item = values.codec(e.result);
		const err = e.effect === "EIO" ? shape(e.error) : e.effect === "IO" ? "string" : null;
		const ec = e.effect === "EIO" ? values.codec(e.error) : null;
		const n = p + "_" + e.name, symbol = stem + "_" + i;
		const checks = args.map((v, k) => (v === "bool" || v === "unit") ? `if (args[${3 * k}] > ${v === "bool" ? 1 : 0}u) return ${p}_INVALID;` : "").filter(Boolean);
		methods.push({ name: e.name, declaration: e.declaration
			, symbol, args, result, error: err, effect: e.effect
			, tagBytes: Math.max(1, depth(result), depth(err)) }); symbols.push(symbol);
		const call = [...codecs.map((c, k) => input(c, args[k], k)), "&value", ...err ? ["&error"] : []];
		return `int ${symbol}(const uint64_t *args, uint64_t *out, uint8_t *tags) {
    if (!out || !tags${args.length ? " || !args" : ""}) return ${p}_INVALID;
    (void)args; memset(out, 0, 4 * sizeof(*out));
    ${checks.join("\n    ")}
    ${n}_value value = {0}; ${err ? (ec ? n + "_error" : p + "_buffer") + " error = {0};" : ""}
    ${p}_status s = ${n}_call(${call.join(", ")});
    if (s == ${p}_OK) { ${emit(result, "value", p)} }
    ${err ? `else if (s == ${p}_${ec ? "TYPED_ERROR" : "IO_ERROR"}) { ${emit(err, "error", p)} }` : ""}
    ${item.dispose ? `${n}_value_dispose(&value);` : ""} ${ec?.dispose ? `${n}_error_dispose(&error);` : e.effect === "IO" ? `${p}_buffer_dispose(&error);` : ""}
    return (int)s;
}`;
	});
	const source = `#include "${p}.h"
#include <string.h>
#include <limits.h>
_Static_assert(sizeof(uintptr_t) == 8 && sizeof(size_t) == 8 && sizeof(float) == 4 && sizeof(double) == 8 && CHAR_BIT == 8, "Linux x86-64 host wire");
static inline float lb_wire_float32(uint64_t bits) { uint32_t u = (uint32_t)bits; float f; memcpy(&f, &u, 4); return f; }
static inline double lb_wire_float64(uint64_t bits) { double f; memcpy(&f, &bits, 8); return f; }
void ${stem}_clear(uint64_t *out) {
    if (!out) return;
    if (out[3] == 1) { ${p}_buffer v = {(uint8_t *)(uintptr_t)out[0], out[1]}; ${p}_buffer_dispose(&v); }
    ${values.hasIntegers() ? `else if (out[3] == 2) { ${p}_integer v = {(uint64_t *)(uintptr_t)out[0], out[1], out[2] != 0}; ${p}_integer_dispose(&v); }` : ""}
    memset(out, 0, 4 * sizeof(*out));
}
${functions.join("\n")}
`;
	return { source, methods, symbols, clear: symbols[0] };
};
