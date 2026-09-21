/**
 * Named WIT cases and checked conversions through the public C value facade.
 *
 * @file
 */

/**
 * Allocate a case or field label without merging compiler-disambiguated names.
 *
 * @param value - Original Lean member name.
 * @param scope - Labels already used in this constructor or family.
 * @param fail - Source-located diagnostic callback.
 */
export const witVariantMember = (value, scope, fail) => {
	const kebab = value.replace(/([a-z0-9])([A-Z])/g, "$1-$2").replaceAll("_", "-").toLowerCase();
	const label = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(kebab) ? kebab
		: `lean-field-x${[...value].map(char => char.codePointAt(0).toString(16).padStart(6, "0")).join("")}`;
	if(scope.has(label)) fail(`WIT variant member is duplicated after projection: ${value}`);
	scope.add(label); return label;
};

/**
 * Give every nonempty constructor a payload record, retaining all field names.
 *
 * @param copies - Topologically ordered source types, including alias projections.
 * @param nextIndex - First unused Component Model type identifier.
 * @param admit - Allocate a globally unique payload record name.
 */
export const witVariantPayloads = (copies, nextIndex, admit) => {
	const types = [];
	for(const copy of copies)
	{
		if(copy.variant && !copy.aliasTarget) for(const branch of copy.cases)
		{
			branch.payload = null;
			if(!branch.fields.length) continue;
			const witName = admit(`${copy.witName}-${branch.witName}-fields`), witIndex = nextIndex++;
			branch.payload = { payloadRecord: true, fields: branch.fields, witName, wit: witName, witIndex, wat: `$t${witIndex}` };
			types.push(branch.payload);
		}
		types.push(copy);
	}
	return { types, nextIndex };
};

/**
 * Validate a named discriminant and selected record before accessing C fields.
 *
 * @param copy - Concrete variant with original WIT member labels.
 */
export const witVariantConversions = copy => ({
	input: ['if (value->kind != WASMTIME_COMPONENT_VARIANT) return false;'
		, ...copy.cases.flatMap((branch, index) => [
			`${index ? "else " : ""}if (lb_name(&value->of.variant.discriminant, "${branch.witName}")) {`
			, ...(branch.fields.length ? [
				'  const wasmtime_component_val_t *payload = value->of.variant.val;'
				, `  if (!payload || payload->kind != WASMTIME_COMPONENT_RECORD || payload->of.record.size != ${branch.fields.length} || !payload->of.record.data) return false;`
				, `  if (!lb_charge(scope, ${branch.fields.length}, sizeof(wasmtime_component_valrecord_entry_t))) return false;`
			] : ['  if (value->of.variant.val) return false;'])
			, `  if (out) out->kind = ${index};`
			, ...branch.fields.map((field, position) => `  if (!lb_name(&payload->of.record.data[${position}].name, "${field.witName}") || !lb_in_${field.type.index}(&payload->of.record.data[${position}].val, scope, out ? &out->cases.${branch.name}.${field.name} : NULL)) return false;`)
			, '}'])
		, 'else return false;'
	]
	, output: [`if (value->kind >= ${copy.cases.length}) return false;`
		, 'out->kind = WASMTIME_COMPONENT_VARIANT; out->of.variant = (wasmtime_component_valvariant_t){0};'
		, 'switch (value->kind) {'
		, ...copy.cases.flatMap((branch, index) => [`case ${index}: {`
			, `  wasm_name_new(&out->of.variant.discriminant, ${branch.witName.length}, "${branch.witName}");`
			, ...(branch.fields.length ? [
				`  if (!lb_charge(scope, ${branch.fields.length}, sizeof(wasmtime_component_valrecord_entry_t))) return false;`
				, '  wasmtime_component_val_t empty = {0}; out->of.variant.val = wasmtime_component_val_new(&empty);'
				, '  wasmtime_component_val_t *payload = out->of.variant.val; payload->kind = WASMTIME_COMPONENT_RECORD;'
				, `  wasmtime_component_valrecord_new_uninit(&payload->of.record, ${branch.fields.length});`
				, `  memset(payload->of.record.data, 0, ${branch.fields.length} * sizeof(*payload->of.record.data));`
			] : [])
			, ...branch.fields.flatMap((field, position) => [
				`  wasm_name_new(&payload->of.record.data[${position}].name, ${field.witName.length}, "${field.witName}");`
				, `  if (!lb_out_${field.type.index}(&value->cases.${branch.name}.${field.name}, scope, &payload->of.record.data[${position}].val)) return false;`])
			, '  break;', '}'])
		, '}'
	]
});

/**
 * Document the public constructor and payload contract in prepared archives.
 *
 * @param model - Admitted WIT projection with original source definitions.
 */
export const witVariantReadme = model => {
	const variants = model.manifest.contracts?.variants ?? [];
	if(!variants.length) return "";
	return `
## Copied Lean variants

Each Lean family becomes a named WIT variant. Empty constructors have no payload. Every nonempty constructor carries a named record, even a single Unit field, so an empty case and a present Unit remain distinct. Payload records retain field names and order. WIT labels use lowercase kebab-case; keywords use a percent escape in WIT source. Names that cannot use that spelling receive an unambiguous encoded label. binding-manifest.json records each original Lean name, field type and WIT spelling.

Use named Wasmtime variant discriminants and the selected payload record. Constructor numbers, native C union layouts and Lean object layouts are not the public WIT contract. Conversions reject unknown cases, missing or extra payloads, wrong field names, types and order. Returned variants own independent copies and remain valid after closing the session. Compare constructor names and selected fields recursively, not allocation addresses. Only the selected constructor's payload is read or released.

Variants compose with named aliases, arrays, Lists, records, options, results and products under the existing 32-level shape limit and conversion budgets. Callable payloads, recursive copied values and identity-bearing fields are not admitted by this profile yet. The compiler's own datatype limits still apply: Lean 4.32.2 supports boxed constructor tags through 243; empty constructors can use higher tags.

| Lean family | WIT name | Constructors |
| --- | --- | --- |
${variants.map(type => `| \`${type.name}\` | \`${type.witName}\` | ${type.cases.length} |`).join("\n")}
`;
};
