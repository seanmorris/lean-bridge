/** @file Project checked host records as C++ values owning their original shared objects. */
import {cIdentifier, cKeywords} from "../c/generate.mjs";

/**
 * Each public record owns its shared_ptrs and copied scalar values. Only the
 * synchronous call boundary needs temporary C tickets. Every getter and pin
 * is guarded before the next conversion so partial conversion is reversible.
 *
 * @param entries - Compiler-checked synchronous exports.
 * @param p - Private C API prefix.
 * @param ref - C++ scalar and host-class codecs.
 * @param occupied - Names already reserved by the binding.
 */
export const cppHostRecords = (entries, p, ref, occupied) => {
	const types = new Map(), declarations = [], conversions = [];
	const reserve = name => {
		if(occupied.has(name) || cKeywords.has(name)) throw new TypeError("Colliding C++ host record name: " + name);
		occupied.add(name);
	};
	for(const e of entries) for(const t of [...e.parameters.map(a => a.type), e.result])
	{
		if(t.kind !== "host-record" || types.has(t.declaration)) continue;
		const name = t.declaration.split(".").at(-1), raw = p + cIdentifier(name);
		const encode = "lb_make_record_" + types.size, decode = "lb_read_record_" + types.size;
		[name, encode, decode].forEach(reserve);
		const labels = new Set([name]), fs = t.fields.map((f, i) => {
			const label = cIdentifier(f.name), member = cKeywords.has(label) ? label + "_" : label;
			if(labels.has(member) || /^lb_field_[0-9]+$/u.test(member)) throw new TypeError("Colliding C++ host record field: " + member);
			labels.add(member);
			return {member, label, codec: ref(f.type, name + "_field_" + i)};
		});
		const field = i => "lb_field_" + i;
		declarations.push("class " + name + " { friend class Binding; "
			+ fs.map(({codec: c}, i) => c.type + " " + field(i) + ";").join(" ")
			+ " public: explicit " + name + "(" + fs.map(({codec: c}, i) => c.type + " x" + i).join(",") + ") : "
			+ fs.map((_, i) => field(i) + "(std::move(x" + i + "))").join(",") + " {"
			+ fs.flatMap(({codec: c}, i) => c.k ? ['if(!' + field(i) + ') throw std::invalid_argument("null C++ record member");'] : []).join(" ") + "} "
			+ fs.map(({codec: c, member}, i) => c.type + " " + member + "() const { return " + field(i) + "; }").join(" ") + " };");
		conversions.push("static " + raw + " " + encode + "(const " + name + "& v) { "
			+ fs.map(({codec: c}, i) => c.input("v." + field(i), "a" + i)).join(" ")
			+ raw + " out{}; check(" + raw + "_make(" + fs.map((_, i) => "a" + i).join(",") + ",&out)); return out; }"
			+ "\nstatic " + name + " " + decode + "(" + raw + " v) { return " + name + "{"
			+ fs.map(({codec: c, label}) => "[&]{ " + c.raw + " tmp{}; "
				+ (c.clear("tmp") ? "hd::Finally release([&]{ " + c.clear("tmp") + " }); " : "")
				+ "check(" + raw + "_get_" + label + "(v,&tmp)); return " + c.read("tmp") + "; }()").join(",")
			+ "}; }");
		const clear = v => "(void)" + raw + "_drop(&(" + v + "));";
		const read = v => decode + "(" + v + ")";
		const input = (v, a) => "auto " + a + "=" + encode + "(" + v + "); hd::Finally " + a + "_end([&]{ " + clear(a) + " });";
		types.set(t.declaration, {type: name, raw, clear, read, input});
	}
	return {types, declarations, conversions};
};
