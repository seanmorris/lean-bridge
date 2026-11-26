/** @file Generate C11 owners for records containing actual, separately leased application objects. */
import {cIdentifier} from "./generate.mjs";
import {canonicalJson, sha256} from "../../capsule/node.mjs";

const raw = v => "(lb_cr_ref){(" + v + ")._private[0],(" + v + ")._private[1]}";
const fresh = v => "(!(" + v + ")._private[0] && !(" + v + ")._private[1])";
const types = new Set(["primitive", "named"]);
// The input and owned buffer types have the same fields but different constness.
const ownedView = (c, v) => c.dyn ? "(" + c.arg + "){(" + v + ").data,(" + v + ").len" + (c.integer ? ",(" + v + ").negative" : "") + "}" : v;
const copyField = (c, dest, src, fail) => {
	if(c.nominal) return "{ int rc=" + c.type + "_clone(" + src + ",&(" + dest + ")); if(rc) { " + fail("rc") + " } }";
	if(!c.dyn) return dest + "=" + src + ";";
	const x = "(" + src + ")", y = "(" + dest + ")";
	return "if(" + x + ".len) { " + y + ".data=malloc(" + x + ".len*sizeof(*" + y + ".data)); if(!" + y + ".data) { "
		+ fail("LB_RECORD_LIMIT") + " } memcpy(" + y + ".data," + x + ".data," + x + ".len*sizeof(*" + y + ".data)); } "
		+ y + ".len=" + x + ".len;" + (c.integer ? y + ".negative=" + x + ".negative;" : "");
};

/**
 * A C struct assignment aliases an opaque ticket; clone requests a new one.
 * The registry checks stale aliases before looking at any payload. Fields own
 * their own copies/leases; they never point into a Lean heap or another record.
 *
 * @param o - Source-checked export rows, public prefix, codecs and emission sinks.
 * @param o.entries - Compiled Lean export descriptors.
 * @param o.p - Package's C identifier prefix.
 * @param o.byRef - Codec for a checked scalar or application class.
 * @param o.defs - Public declaration sink.
 * @param o.code - Private implementation sink.
 * @param o.reserve - Reject conflicting C symbols.
 * @param o.add - Emit one public function and its implementation.
 */
export const cHostRecords = ({entries, p, byRef, defs, code, reserve, add}) => {
	const records = new Map();
	for(const e of entries) for(const t of [...e.parameters.map(v => v.type), e.result])
	{
		if(t.kind !== "host-record" || records.has(t.declaration)) continue;
		const suffix = reserve(cIdentifier(t.declaration.split(".").at(-1))), name = p + suffix;
		const fs = t.fields.map((f, i) => {
			if(!types.has(f.type.kind)) throw new TypeError("C application record needs a scalar or imported class field");
			return {name: cIdentifier(f.name), c: byRef(f.type, suffix + "_field_" + i)};
		});
		if(!fs.length || fs.length > 64 || !fs.some(f => f.c.nominal)) throw new TypeError("Invalid C host record");
		const fields = fs.map(({name: field, c}) => [field, c.nominal ? c.key : c.tag]);
		const key = JSON.stringify(sha256(canonicalJson({
			layout: "c-host-record-v1", declaration: t.declaration, fields
		})));
		const row = "lb_row_" + suffix, destroy = row + "_destroy";
		defs.push("typedef struct { uint64_t _private[2]; } " + name + ";");
		code.push("typedef struct { " + fs.map(({c}, i) => c.type + " f" + i + ";").join(" ") + " } " + row + ";"
			+ "\nstatic void " + destroy + "(void *data) { " + row + " *r=data; " + fs.map(({c}, i) => c.clear("r->f" + i)).join(" ") + " free(r); }");
		const lookup = (v, dst, bad) => "void *" + dst + "_data=NULL; { int rc=LB_CR(get)(" + key + "," + raw(v) + ",&" + dst + "_data); if(rc){ " + bad("rc") + " } } const " + row + " *" + dst + "=" + dst + "_data;";
		const symbol = (label, args, body) => add(suffix + "_" + label, p + "status", args.join(", "), body.replaceAll("LB_RECORD_LIMIT", p + "LIMIT"));
		const input = fs.map(({c}, i) => c.arg + " v" + i);
		symbol("make", [...input, name + " *out"],
			"if(!out || !" + fresh("*out") + ") return " + p + "INVALID;\n    size_t budget=0; uint64_t w[3]={0};"
			+ fs.map(({c}, i) => c.pack("v" + i, "w", err => "return lb_status(" + err + ");")).join("\n    ")
			+ "\n    (void)w;(void)budget; " + row + " *r=calloc(1,sizeof(*r)); if(!r)return " + p + "LIMIT;"
			+ fs.map(({c}, i) => copyField(c, "r->f" + i, "v" + i, status => destroy + "(r);return " + status + ";")).join("\n    ")
			+ "\n    lb_cr_ref h={0}; int rc=LB_CR(adopt)(" + key + ",r,(lb_cr_fn)" + destroy + ",lb_dispose,&h);"
			+ " if(rc){" + destroy + "(r); return lb_status(rc);} *out=(" + name + "){{h.domain,h.ticket}};return " + p + "OK;");
		symbol("drop", [name + " *r"], "if(!r)return " + p + "INVALID; if(" + fresh("*r") + ")return " + p + "OK; lb_cr_ref h=" + raw("*r") + "; int rc=LB_CR(drop)(" + key + ",&h); if(!rc)*r=(" + name + "){0}; return lb_status(rc);");
		symbol("clone", [name + " r", name + " *out"], "if(!out || !" + fresh("*out") + ")return " + p + "INVALID; lb_cr_ref h={0}; int rc=LB_CR(clone)(" + key + "," + raw("r") + ",&h); if(!rc)*out=(" + name + "){{h.domain,h.ticket}};return lb_status(rc);");
		for(const [i, {name: field, c}] of fs.entries())
			symbol("get_" + field, [name + " r", c.type + " *out"],
				"if(!out || !" + c.empty("*out") + ")return " + p + "INVALID; "
				+ lookup("r", "v", rc => "return lb_status(" + rc + ");")
				+ copyField(c, "*out", "v->f" + i, rc => "return " + rc + ";") + "return " + p + "OK;");
		records.set(t.declaration, {
			arg: name, type: name, count: fs.length, empty: fresh, record: true
			, packAt: (v, offset, bad) => {
				const dst = "row_" + offset;
				return lookup(v, dst, bad) + fs.map(({c}, i) => c.pack(ownedView(c, dst + "->f" + i), "w+" + (offset+i)*3, bad)).join("\n    ");
			}
			, unpack: (v, w, bad) => {
				return "if(" + w + "[3]!=3 || " + w + "[1]!=" + fs.length + " || !" + w + "[0]) { " + bad("CR_INVALID") + " }"
					+ " const uint64_t *lanes=(const uint64_t *)(uintptr_t)" + w + "[0];"
					+ fs.map(({c}, i) => c.arg + " f" + i + "={0}; " + c.unpack("f" + i, "lanes+" + (4*i), bad, {borrowed: true})).join("\n    ")
					+ "\n    status=" + name + "_make(" + fs.map((_, i) => "f" + i).join(",") + ",&(" + v + "));";
			}
		});
	}
	return records;
};
