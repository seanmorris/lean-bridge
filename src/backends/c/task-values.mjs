/**
 * Map task values to fixed-size C carriers and owned length-delimited buffers.
 *
 * @file
 */
const scalars = {
	unit: ["Unit", "uint8_t", "lean_object *", "0", "lean_box(0)"]
	, bool: ["Bool", "bool", "uint8_t", "lean_unbox(v)"]
	, char: ["Char", "uint32_t", "uint32_t", "lean_unbox_uint32(v)"]
	, usize: ["USize", "size_t", "size_t", "lean_unbox_usize(v)"]
	, isize: ["ISize", "intptr_t", "size_t", "lean_unbox_usize(v)"]
	, float32: ["Float32", "float", "float", "lean_unbox_float32(v)"]
	, float64: ["Float", "double", "double", "lean_unbox_float(v)"]
};
for(const bits of [8, 16, 32, 64])
	for(const signed of [false, true])
		scalars[`${signed ? "" : "u"}int${bits}`] = [
			`${signed ? "" : "U"}Int${bits}`
			, `${signed ? "" : "u"}int${bits}_t`
			, `uint${bits}_t`
			, bits <= 16 ? "lean_unbox(v)" : `lean_unbox_uint${bits}(v)`];

/**
 * Build each distinct copied output shape once, children before parents.
 *
 * @param p - Public component symbol prefix.
 */
export const cTaskValues = p => {
	const values = new Map(), types = [], bodies = [], symbols = [];
	const codec = t => {
		const key = JSON.stringify(t);
		if(values.has(key)) return values.get(key);
		let c;
		const scalar = t?.kind === "primitive" && Object.hasOwn(scalars, t.name) && scalars[t.name];
		if(scalar)
		{
			const [lean, type, abi, expr, constant] = scalar;
			c = { lean: `_root_.${lean}`, type, arg: type, abi
				, argument: v => constant ?? `(${abi})${v}`
				, validate: v => t.name === "unit" ? `if (${v} != 0) return LB(INVALID);`
					: t.name === "char" ? `if (${v} > 0x10ffff || (${v} >= 0xd800 && ${v} <= 0xdfff)) return LB(INVALID);` : ""
				, convert: `(void)v; *out = (${type})(${expr}); return LB(OK);` };
		} else if(t?.kind === "primitive" && ["string", "bytes"].includes(t.name))
		{
			const str = t.name === "string";
			c = { lean: str ? "_root_.String" : "_root_.ByteArray"
				, type: `${p}_buffer`
				, arg: `${p}_view`
				, abi: "lean_object *"
				, validate: v => `if (${v}.len > LB_MAX_BYTES - budget) return LB(LIMIT);
    budget += ${v}.len;
    if ((${v}.len && !${v}.data)${str ? ` || !lb_utf8(${v})` : ""}) return LB(INVALID);`
				, buffer: true
				, argument: v => str ? `lean_mk_string_from_bytes_unchecked(${v}.data ? (const char *)${v}.data : "", ${v}.len)` : `lb_input_bytes(${v})`
				, convert: `return lb_${t.name}(out, v);`, dispose: `${p}_buffer_dispose` };
		} else if(t?.kind === "apply" && t.constructor === "result" && t.arguments?.length === 2)
		{
			const [ok, err] = t.arguments.map(codec), type = `${p}_result_${values.size}`;
			types.push(`typedef struct { bool ok; union { ${ok.type} value; ${err.type} error; } as; } ${type};`);
			c = { lean: `(_root_.Except ${err.lean} ${ok.lean})`, type
				, convert: `bool ok = lean_obj_tag(v) == 1;
    ${type} tmp = {.ok = ok}; lean_object *payload = lean_ctor_get(v, 0);
    LB(status) s = ok ? ${ok.read}(payload, &tmp.as.value) : ${err.read}(payload, &tmp.as.error);
    if (s == LB(OK)) *out = tmp;
    return s;` };
			if(ok.dispose || err.dispose)
			{
				c.dispose = `${type}_dispose`;
				types.push(`void ${c.dispose}(${type} *v);`);
				symbols.push(c.dispose);
				bodies.push(`void ${c.dispose}(${type} *v) {
    if (!v) return;
    if (v->ok) { ${ok.dispose ? `${ok.dispose}(&v->as.value);` : ""} }
    else { ${err.dispose ? `${err.dispose}(&v->as.error);` : ""} }
    *v = (${type}){0};
}`);
			}
		} else throw new TypeError(`C task projection does not support ${t?.name ?? t?.constructor ?? t?.kind}; no implicit narrowing is allowed`);
		c.read = `lb_read_${values.size}`;
		bodies.push(`static LB(status) ${c.read}(lean_object *v, ${c.type} *out) { ${c.convert} }`);
		values.set(key, c); return c;
	};
	return { codec, types, bodies, symbols };
};
