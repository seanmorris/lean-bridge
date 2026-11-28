/** @file Marshal synchronous application-owned record fields through an MRI extension. */
import {isReservedRubyName} from "./copied-model.mjs";

const snake = s => s.replace(/([A-Z]+)([A-Z][a-z])/gu, "$1_$2").replace(/([a-z0-9])([A-Z])/gu, "$1_$2").toLowerCase();
const qualified = s => typeof s === "string" && s.split(".").every(part => /^[A-Za-z][A-Za-z0-9_]*$/u.test(part));
const reject = message => { throw new TypeError("Ruby host record: " + message); };

/**
 * Rebuild the Lean constructor from borrowed inputs, and project output
 * via a polymorphic product rather than guessing the structure's C layout.
 *
 * @param entries - Application functions derived from elaborated source.
 * @param codec - Established MRI conversion for each admitted leaf.
 * @param classes - Names already reserved by host imports or generated APIs.
 */
export const rubyHostRecords = (entries, codec, classes) => {
	const records = new Map(), reserved = new Set([...classes, "UNIT", "Ok", "Err", "IOError", "DeclaredError", "LeanClosure"]);
	for(const e of entries) for(const t of [e.result, ...e.parameters.map(p => p.type)])
	{
		if(t?.kind !== "host-record") continue;
		if(e.delivery || e.effect !== "IO" || !qualified(t.declaration) || !qualified(t.constructor) || !t.constructor.startsWith(t.declaration + "."))
			reject("expected a synchronous IO call and a public record constructor");
		if(records.has(t.declaration)) continue;
		const name = t.declaration.split(".").at(-1), label = "lb_ruby_record_" + records.size;
		if(!/^[A-Z][A-Za-z0-9_]*$/u.test(name) || isReservedRubyName(name) || reserved.has(name) || name === "ArgumentError"
			|| !Array.isArray(t.fields) || !t.fields.length || t.fields.length > 64)
			reject("reserved name or unsupported field count");
		reserved.add(name);
		const fields = t.fields.map(f => {
			const pub = snake(f.name);
			if(!/^[a-z][a-z0-9_]*$/u.test(pub) || !qualified(f.projection) || f.projection !== t.declaration + "." + f.name
				|| isReservedRubyName(pub) || ["close", "with", "initialize"].includes(pub)) reject("reserved or invalid field " + pub);
			return {pub, projection: f.projection, codec: codec(f.type)};
		});
		if(!fields.some(f => f.codec.i !== undefined) || new Set(fields.map(f => f.pub)).size !== fields.length) reject("ambiguous fields or missing host class");
		const type = fields.reduceRight((tail, f) => "(_root_." + f.codec.lean + " × " + tail + ")", "_root_.Unit");
		const value = fields.reduceRight((tail, f) => "(_root_." + f.projection + " row, " + tail + ")", "()");
		const out = {lean: type, to: v => label + "_result(" + v + ")"};
		const c = `static VALUE ${label};
static VALUE ${label}_result(lean_object *v) {
    VALUE items[${fields.length}];
${fields.map((f, i) => "    items[" + i + "]=" + f.codec.to("lean_ctor_get(v,0)") + ";" + (i + 1 < fields.length ? "\n    v=lean_ctor_get(v,1);" : "")).join("\n")}
    return rb_class_new_instance(${fields.length},items,${label});
}`;
		const args = fields.map(f => f.pub).join(", ");
		const ruby = `    class ${name}
      def initialize(${args})
        @slot = [[${args}].freeze]
      end
      def initialize_copy(source)
        super
        @slot = @slot.dup
      end
      private :initialize_copy
      def closed? = @slot.nil? || @slot.empty?
      def close
        return false if closed?
        @slot.clear
        true
      end
      def with
        raise ::ArgumentError, "a block is required" unless block_given?
        raise ::IOError, "host record is closed" if closed?
        begin
          yield self
        ensure
          close
        end
      end
${fields.map((f, i) => "      def " + f.pub + "\n        raise ::IOError, 'host record is closed' if closed?\n        @slot.first.fetch(" + i + ")\n      end").join("\n")}
    end
`;
		records.set(t.declaration, {name, label, fields, value, out, c, ruby});
	}
	const lower = (e, i) => {
		if(e.result?.kind !== "host-record" && !e.parameters.some(p => p.type.kind === "host-record")) return null;
		const args = [], passed = [], setup = [];
		for(const [j, p] of e.parameters.entries())
		{
			const rec = records.get(p.type.declaration);
			if(!rec || p.type.kind !== "host-record")
			{
				passed.push("v" + args.length); setup.push("flat[" + args.length + "]=argv[" + j + "];"); args.push(codec(p.type)); continue;
			}
			const a = "a" + j, params = [];
			setup.push(`VALUE ${a}=lb_ruby_record_fields(argv[${j}],${rec.label},${rec.fields.length});`);
			for(const [n, f] of rec.fields.entries())
			{
				params.push("v" + args.length); setup.push(`flat[${args.length}]=rb_ary_entry(${a},${n});`); args.push(f.codec);
			}
			passed.push("(_root_." + p.type.constructor + " " + params.join(" ") + ")");
		}
		const r = records.get(e.result.declaration);
		const body = "(_root_." + e.declaration + " " + passed.join(" ") + ")";
		const call = r ? "(do let row ← " + body + "; pure " + r.value + ")" : body;
		const invoke = `static VALUE lb_invoke_${i}(int argc,VALUE *argv,VALUE mod) {
    (void)mod; rb_check_arity(argc,${e.parameters.length},${e.parameters.length}); VALUE flat[${Math.max(args.length, 1)}];
    ${setup.join("\n    ")}
    return lb_invoke(lb_entry_${i},flat);
}`;
		return {args, out: r?.out, call, invoke};
	};
	const list = [...records.values()];
	const c = list.length ? `static VALUE lb_ruby_record_fields(VALUE data,VALUE cls,long size) {
    if (!rb_obj_is_instance_of(data,cls)) rb_raise(rb_eTypeError,"expected the declared host record class");
    VALUE slot=rb_ivar_get(data,rb_intern("@slot"));
    if (NIL_P(slot) || (RB_TYPE_P(slot,T_ARRAY) && !RARRAY_LEN(slot))) rb_raise(rb_eIOError,"host record is closed");
    if (!RB_TYPE_P(slot,T_ARRAY) || RARRAY_LEN(slot)!=1) rb_raise(rb_eTypeError,"invalid host record");
    VALUE fields=rb_ary_entry(slot,0);
    if (!RB_TYPE_P(fields,T_ARRAY) || RARRAY_LEN(fields)!=size) rb_raise(rb_eTypeError,"invalid host record fields");
    return fields;
}
${list.map(r => r.c).join("\n")}
` : "";
	return {lower, c, ruby: list.map(r => r.ruby).join("")
		, init: list.map(r => r.label + "=rb_const_get_at(mod,rb_intern(" + JSON.stringify(r.name) + ")); rb_global_variable(&" + r.label + ");").join("\n    ")};
};
