/** @file Lower application records through their Lean constructors and projections. */
const ident = /^[A-Za-z][A-Za-z0-9_]*$/u;
const leanName = name => typeof name === "string" && name.split(".").every(part => ident.test(part));
const snake = s => s.replace(/([A-Z]+)([A-Z][a-z])/gu, "$1_$2").replace(/([a-z0-9])([A-Z])/gu, "$1_$2").toLowerCase();
const reserved = new Set(["close", "closed", "self"]);
const parts = (items, end, combine) => items.reduceRight((rhs, lhs) => combine(lhs, rhs), end);

/**
 * Build one ordinary public Python class per compiler-described record and
 * lower each field through the same staged codecs as a top-level argument.
 *
 * @param entries - Compiler-checked private entries.
 * @param codec - Existing scalar or host-object codec.
 * @param render - Python type name for a leaf.
 * @param keywords - Names that cannot appear in generated signatures.
 */
export const pythonHostRecords = (entries, codec, render, keywords) => {
	const byName = new Map();
	for(const e of entries) for(const t of [e.result, ...e.parameters.map(p => p.type)])
	{
		if(t?.kind !== "host-record") continue;
		if(!leanName(t.declaration) || !leanName(t.constructor) || !t.constructor.startsWith(t.declaration + ".")
			|| e.delivery || e.effect !== "IO") throw new TypeError("Invalid Python host record source or delivery");
		if(byName.has(t.declaration)) continue;
		const name = t.declaration.split(".").at(-1);
		if(!Array.isArray(t.fields) || !t.fields.length || keywords.has(name)) throw new TypeError("Invalid Python host record");
		const fields = t.fields.map(f => {
			const pub = snake(f.name);
			if(!ident.test(f.name) || f.projection !== t.declaration + "." + f.name || keywords.has(pub) || reserved.has(pub))
				throw new TypeError("Invalid Python host record field " + f.name);
			return {pub, projection: "_root_." + f.projection, codec: codec(f.type), hint: render(f.type)};
		});
		if(new Set(fields.map(f => f.pub)).size !== fields.length || !fields.some(f => f.codec.hostIndex !== undefined))
			throw new TypeError("Expected distinct record fields including a declared Python host class");
		const fn = "lb_py_host_record_" + byName.size;
		const tag = "_lb_host_record_" + byName.size;
		const pairType = parts(fields, "_root_.Unit", (f, rhs) => "(" + f.codec.lean + " × " + rhs + ")");
		const expression = parts(fields, "()", (f, rhs) => "(" + f.projection + " row, " + rhs + ")");
		const out = {lean: pairType, toPython: v => fn + "(" + v + ")", decode: raw => tag + "(*" + raw + ")"};
		const c = `static PyObject *${fn}(lean_object *pair) {
    PyObject *result = PyTuple_New(${fields.length});
    if (!result) return NULL;
${fields.map((f, i) => `    PyObject *item${i} = ${f.codec.toPython("lean_ctor_get(pair, 0)")};
    if (!item${i}) { Py_DECREF(result); return NULL; }
    PyTuple_SET_ITEM(result, ${i}, item${i});${i + 1 === fields.length ? "" : "\n    pair = lean_ctor_get(pair, 1);"}`).join("\n")}
    return result;
}`;
		const args = fields.map(f => f.pub).join(", ");
		const python = `class ${name}:
    __slots__ = ("_values",)
    def __init__(self, ${args}):
        self._values = (${args},)
    @_lb_record_property
    def closed(self):
        return self._values is None
    def close(self):
        if self.closed: return False
        self._values = None
        return True
    def __enter__(self):
        _lb_host_fields(self, ${name})
        return self
    def __exit__(self, *exc):
        self.close()
${fields.map((f, i) => `    @_lb_record_property
    def ${f.pub}(self):
        return _lb_host_fields(self, ${name})[${i}]
`).join("")}
${tag} = ${name}
`;
		const conflicts = fields.map(f => f.pub).filter(p => ["bool", "bytes", "float", "int", "object", "property", "str"].includes(p)).sort();
		const hint = s => conflicts.includes(s) ? "_lb_record_" + s : s;
		const stub = conflicts.map(p => "from builtins import " + p + " as " + hint(p) + "\n").join("") + `class ${name}:
    def __init__(self, ${fields.map(f => f.pub + ": " + hint(f.hint)).join(", ")}) -> None: ...
    @${hint("property")}
    def closed(self) -> ${hint("bool")}: ...
    def close(self) -> ${hint("bool")}: ...
    def __enter__(self) -> ${name}: ...
    def __exit__(self, *exc: ${hint("object")}) -> None: ...
${fields.map(f => "    @" + hint("property") + "\n    def " + f.pub + "(self) -> " + hint(f.hint) + ": ...\n").join("")}`;
		byName.set(t.declaration, {name, tag, c, out, python, stub, fields, expression});
	}
	const records = [...byName.values()];
	const lower = e => {
		let next = 0;
		const args = [], passed = [], pythonArgs = [];
		for(const p of e.parameters)
		{
			const t = p.type;
			if(t.kind === "host-record")
			{
				const rec = byName.get(t.declaration);
				args.push(...rec.fields.map(f => f.codec));
				passed.push("(_root_." + t.constructor + " " + rec.fields.map(() => "v" + next++).join(" ") + ")");
				pythonArgs.push("*_lb_host_fields(" + p.name + ", " + rec.tag + ")");
			}
			else
			{ args.push(codec(t)); passed.push("v" + next++); pythonArgs.push(p.name); }
		}
		const call = "(_root_." + e.declaration + " " + passed.join(" ") + ")";
		const r = byName.get(e.result?.declaration);
		return {args, pythonArgs: pythonArgs.join(", "), call: r ? "(do let row ← " + call + "; pure " + r.expression + ")" : call, out: r?.out};
	};
	return {names: records.map(r => r.name)
		, c: records.map(r => r.c).join("\n"), stubs: records.map(r => r.stub)
		, python: records.length ? `_lb_record_property = property
def _lb_host_fields(value, kind):
    if type(value) is not kind: raise TypeError("expected " + kind.__name__)
    fields = value._values
    if fields is None: raise RuntimeError("host record is closed")
    return fields
${records.map(r => r.python).join("\n")}\n` : ""
		, lower: e => e.result?.kind === "host-record" || e.parameters.some(p => p.type.kind === "host-record") ? lower(e) : {}};
};
