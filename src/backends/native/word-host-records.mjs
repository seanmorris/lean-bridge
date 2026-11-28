/** @file Lower flat host-object records without depending on Lean structure layout. */
/**
 * Identify a compiler-observed public record.
 *
 * @param t - Carrier at one argument or result site.
 */
const isRecord = t => t?.kind === "host-record";
const qualified = s => typeof s === "string" && /^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)*$/u.test(s);
const reject = why => { throw new TypeError("Invalid native host record: " + why); };

/**
 * The application constructor and projections come from the checked Lean
 * environment. A nested Prod boxes even unboxed scalar fields at this private
 * boundary; the normal word codecs perform all per-leaf conversions.
 *
 * @param entry - One reconciled synchronous application declaration.
 * @param target - The owner of the public projection.
 * @param lean - Lean type name for a flat scalar or host-class leaf.
 */
export const lowerWordHostRecord = (entry, target, lean) => {
	const parameters = entry.parameters.map(p => p.type), result = entry.result;
	if(![...parameters, result].some(isRecord)) return null;
	if(!["php", "dotnet", "jvm", "c", "cpp", "rust", "javascript", "perl", "wit-wasi"].includes(target) || entry.effect !== "IO" || entry.delivery) reject("expected a synchronous record-capable host");
	for(const t of [...parameters, result].filter(isRecord))
	{
		if(!qualified(t.declaration) || !qualified(t.constructor) || !t.constructor.startsWith(t.declaration + ".")
			|| !Array.isArray(t.fields) || !t.fields.length || t.fields.length > 64
			|| !t.fields.some(f => f.type?.kind === "named")
			|| t.fields.some(f => !qualified(f.name) || f.name.includes(".") || f.projection !== t.declaration + "." + f.name
				|| !["primitive", "named"].includes(f.type?.kind))) reject("invalid fields or projections");
	}
	const flat = [];
	const arg = t => { const n = flat.length; flat.push(t); return "v" + n; };
	const args = parameters.map(t => isRecord(t) ? "(_root_." + t.constructor + " " + t.fields.map(f => arg(f.type)).join(" ") + ")" : arg(t));
	if(["c", "cpp", "rust", "javascript", "perl", "wit-wasi"].includes(target) && flat.length > 64) reject("host exports support at most 64 flattened input fields");
	const body = "(_root_." + entry.declaration + (args.length ? " " + args.join(" ") : "") + ")";
	if(!isRecord(result)) return {flat, call: body};
	const tuple = result.fields.reduceRight((tail, f) => "(" + lean(f.type) + " × " + tail + ")", "_root_.Unit");
	const value = result.fields.reduceRight((tail, f) => "(_root_." + f.projection + " row, " + tail + ")", "()");
	return {flat, tuple, call: "(do let row ← " + body + "; pure " + value + ")", fields: result.fields.map(f => f.type)};
};

/**
 * Return a separately owned vector of four-word leaf outputs. Publish its
 * cleanup metadata before converting the first leaf: failed conversions and
 * successful ones go through the same clear call. Host IDs are held by the
 * dispatch frame, not by this buffer.
 *
 * @param fields - Ordered compiler-checked leaf types.
 * @param carrier - Existing target word codec for a leaf.
 * @param label - Private function name for this result.
 */
export const wordHostRecordWriter = (fields, carrier, label) => {
	const writes = fields.map((t, i) => {
		const c = carrier(t), offset = 4 * i, value = "lean_ctor_get(v,0)";
		const write = c.index === undefined ? "if((status=dn_output_budget(" + c.tag + "," + value + ",lanes+" + offset + ",&budget))) return status;"
			: "if(!(lanes[" + offset + "]=LB_DND(export)(f,s," + c.index + "," + value + "))) return 14;";
		return "    " + write + (i + 1 < fields.length ? "\n    v=lean_ctor_get(v,1);" : "");
	});
	return `static int ${label}(lb_dn_frame *f,lb_dnd_session *s,lean_object *v,uint64_t *out) {
    uint64_t *lanes=calloc(${fields.length},4*sizeof(*lanes)); if(!lanes) return 11;
    out[0]=(uintptr_t)lanes; out[1]=${fields.length}; out[2]=0; out[3]=3;
    ${fields.some(t => carrier(t).index === undefined) ? "int status; size_t budget=0;" : ""}
${writes.join("\n")}
    return 0;
}`;
};

export const clearWordHostRecord = `if(out && out[3]==3) {
        uint64_t *lanes=(uint64_t *)(uintptr_t)out[0];
        for(size_t i=0;i<out[1];i++) if(lanes[4*i+3]==1 || lanes[4*i+3]==2) free((void *)(uintptr_t)lanes[4*i]);
        free(lanes); memset(out,0,4*sizeof(*out)); return;
    }
    `;
