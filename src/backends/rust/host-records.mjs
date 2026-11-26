/** @file Generate Rust record values from elaborated fields, not guessed Lean memory layouts. */
import {cIdentifier} from "../c/generate.mjs";

/**
 * Construct public record types plus their private field encoders and decoders.
 *
 * @param entries - Compiled synchronous declarations.
 * @param o - Existing Rust scalar, class, ownership, and identifier codecs.
 */
export const rustHostRecords = (entries, o) => {
	const {ident, ref, track, subject, encode, readScalar, typeNames} = o;
	const records = new Map(), definitions = [];
	for(const e of entries) for(const t of [...e.parameters.map(p => p.type), e.result])
	{
		if(t.kind !== "host-record" || records.has(t.declaration)) continue;
		const name = ident(t.declaration.split(".").at(-1)), names = new Set(["new", "clone", "fmt"]);
		if(typeNames.has(name)) throw new TypeError("Reserved Rust host record: " + name);
		typeNames.add(name);
		const fields = t.fields.map((f, i) => {
			const getter = ident(cIdentifier(f.name)), n = track(ref(f.type)), object = typeof n === "number";
			if(names.has(getter) || /^lb_field_[0-9]+$/u.test(getter)) throw new TypeError("Colliding Rust host record getter: " + getter);
			names.add(getter);
			return {key: "lb_field_" + i, getter, n, object, type: subject(n, "H", "HostRef")};
		});
		const values = fields.map(f => f.key + ":" + f.type).join(",");
		const params = fields.map((f, i) => "x" + i + ":" + (f.object ? "&impl AsHost<H::Object" + f.n + ">" : f.type)).join(",");
		const init = fields.map((f, i) => f.key + ":x" + i + (f.object ? ".host_ref()" : "")).join(",");
		const clone = fields.map(f => f.key + ":self." + f.key + ".clone()").join(",");
		const getters = fields.map(f => "pub fn " + f.getter + "(&self)->" + f.type + "{self." + f.key + ".clone()}").join("\n");
		definitions.push("pub struct " + name + "<H:Host>{" + values + "} impl<H:Host> " + name + "<H>{pub fn new(" + params + ")->Self{Self{" + init + "}}" + getters + "}"
			+ "impl<H:Host> Clone for " + name + "<H>{fn clone(&self)->Self{Self{" + clone + "}}}"
			+ "impl<H:Host> std::fmt::Debug for " + name + "<H>{fn fmt(&self,f:&mut std::fmt::Formatter<'_>)->std::fmt::Result{f.debug_struct(" + JSON.stringify(name) + ")"
			+ fields.map(f => ".field(" + JSON.stringify(f.getter) + ",&self." + f.key + ")").join("") + ".finish()}}");
		const input = v => fields.map(f => {
			const arg = v + "." + f.key;
			return f.object ? "self.port.input(" + f.n + ",&" + arg + ",&mut scratch)?" : encode(f.n, arg + (f.n === "bytes" ? ".as_slice()" : ""), "scratch", false);
		});
		const result = name + "::<H>{" + fields.map((f, i) => {
			const storage = ["string", "bytes"].includes(f.n) ? 1 : ["int", "nat"].includes(f.n) ? 2 : 0;
			const w = "o.field(" + fields.length + "," + i + "," + storage + ")?";
			return f.key + ":" + (f.object ? "o.object::<H::Object" + f.n + ">(" + f.n + "," + w + ")?" : readScalar(f.n, w));
		}).join(",") + "}";
		records.set(t.declaration, {ty: name + "<H>", input, result});
	}
	return {records, definitions};
};
