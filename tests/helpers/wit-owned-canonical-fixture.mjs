/**
 * Independent canonical-ABI shapes for nested resource lifetime probes.
 * These synthetic imports do not constitute compiled Lean acceptance.
 *
 * @file
 */
import { renderCopiedWitComponent } from "../../src/backends/wit/copied-component.mjs";

export const ownedCanonicalCases = [
	"record", "list", "option-list", "variant", "indirect-variant"
	, "wide-record", "alias", "result", "indirect-result", "tuple"
	, "indirect-option-list", "mixed", "indirect-mixed", "list-mixed"
	, "wide-variant"
];

/**
 * Build one finite WIT shape with resource inputs and an owned result.
 *
 * @param mode - Independent probe shape, including mixed borrows and transfers.
 */
export const ownedCanonicalFixture = mode => {
	if(!ownedCanonicalCases.includes(mode)) throw new TypeError("Unknown canonical ownership probe");
	const resourceIndex = 10000;
	const borrowed = { resource: true, resourceIndex, borrowed: true, wat: `$borrow${resourceIndex}` };
	const owned = { resource: true, resourceIndex, borrowed: false, wat: `$own${resourceIndex}` };
	const word = { scalarName: "uint32", wat: "u32" }, wide = { scalarName: "uint64", wat: "u64" }, float = { scalarName: "float64", wat: "f64" };
	const types = [];
	const named = (name, copy) => {
		const index = types.length, result = { ...copy, index, witName: name, wat: `$t${index}` };
		types.push(result); return result;
	};
	const field = (name, type) => ({ name, witName: name, type });
	const record = named("ticket-input", { record: true, fields: [field("ticket", borrowed), field("value", word)] });
	const output = named("ticket-output", { record: true, fields: [field("ticket", owned), field("value", word)] });
	let input;
	if(mode === "record") input = record;
	if(mode === "alias") input = named("ticket-alias", { ...record, aliasTarget: record });
	if(mode === "list") input = named("ticket-list", { element: record, fields: [] });
	if(mode.endsWith("option-list"))
	{
		const list = named("ticket-list", { element: borrowed, fields: [] });
		input = named("ticket-option", { compound: "option", fields: [field("some", list)] });
	}
	if(mode.endsWith("variant"))
	{
		const pair = named("pair-fields", { payloadRecord: true, fields: [field("left", borrowed), field("right", borrowed)] });
		const scalar = named("wide-fields", { payloadRecord: true, fields: [field("a", wide), field("b", float)] });
		const cases = [
			{ witName: "empty", fields: [], payload: null }
			, { witName: "pair", fields: pair.fields, payload: pair }
			, { witName: "wide", fields: scalar.fields, payload: scalar }
		];
		if(mode === "wide-variant") cases.splice(0, cases.length
			, ...Array.from({ length: 256 }, (_, index) => ({ witName: `empty${index}`, fields: [], payload: null }))
			, { witName: "pair", fields: pair.fields, payload: pair });
		input = named("ticket-choice", { variant: true, fields: [], cases });
	}
	if(mode.endsWith("result")) input = named("ticket-result", { compound: "result", fields: [field("ok", record), field("error", wide)] });
	if(mode === "tuple") input = named("ticket-tuple", { compound: "tuple", fields: [field("left", borrowed), field("value", record)] });
	if(mode.endsWith("mixed"))
	{
		input = named("mixed-input", { record: true, fields: [field("borrowed", borrowed), field("moved", owned)] });
		if(mode === "list-mixed") input = named("mixed-list", { element: input, fields: [] });
	}
	if(mode === "wide-record") input = named("wide-input", { record: true
		, fields: [...Array.from({ length: 8 }, (_, index) => field(`padding${index}`, wide)), field("left", borrowed), field("right", borrowed)] });
	const parameters = mode.startsWith("indirect-") || mode === "wide-variant" ? [...Array.from({ length: 16 }, (_, index) => ({ witName: `padding${index}`, copy: word })), { witName: "value", copy: input }]
		: [{ witName: "value", copy: input }];
	const functions = [{ witName: "inspect", parameters, resultCopy: output }];
	const shape = copy => copy.variant ? `(variant ${copy.cases.map(branch => `(case "${branch.witName}"${branch.payload ? ` ${branch.payload.wat}` : ""})`).join(" ")})`
		: copy.element ? `(list ${copy.element.wat})`
			: copy.compound === "option" ? `(option ${copy.fields[0].type.wat})`
				: copy.compound === "result" ? `(result ${copy.fields[0].type.wat} (error ${copy.fields[1].type.wat}))`
					: copy.compound === "tuple" ? `(tuple ${copy.fields.map(field => field.type.wat).join(" ")})`
						: `(record ${copy.fields.map(field => `(field "${field.name}" ${field.type.wat})`).join(" ")})`;
	const typeBody = `    (export "ticket" (type $resource${resourceIndex} (sub resource)))
    (type $borrow${resourceIndex} (borrow $resource${resourceIndex}))
    (type $own${resourceIndex} (own $resource${resourceIndex}))
${types.map(copy => copy.aliasTarget ? `    (export "${copy.witName}" (type ${copy.wat} (eq ${copy.aliasTarget.wat})))`
	: `    (type $base${copy.index} ${shape(copy)})\n    (export "${copy.witName}" (type ${copy.wat} (eq $base${copy.index})))`).join("\n")}
    (export "inspect" (func ${parameters.map(parameter => `(param "${parameter.witName}" ${parameter.copy.wat})`).join(" ")} (result ${output.wat})))`;
	return renderCopiedWitComponent({ surface: { functions }, functions, types
		, resources: [{ index: resourceIndex, witName: "ticket" }]
		, typeBody, importName: "probe:ownership/native@1.0.0"
		, exportName: "probe:ownership/api@1.0.0", preserveTypes: true });
};
