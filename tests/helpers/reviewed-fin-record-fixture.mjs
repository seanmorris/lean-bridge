/**
 * Independent reviewed API for the FinRecords Lean fixture (VO #1442). Field bounds sit on each
 * record and variant definition; declarations name the nominal types and carry no trees.
 *
 * @file
 */
import { corpusReviewedIr } from "./type-corpus-reviewed-ir.mjs";

/** Describe checked record and variant field decisions before Lean extraction. */
export const finRecordReviewedIr = () => {
	const fin = bound => ({ kind: "fin", bound });
	const tile = { record: "FinRecords.Tile", fields: { digit: "nat", count: "nat" } };
	const nest = { record: "FinRecords.Nest", fields: { inner: tile, tag: "nat" } };
	const late = { record: "FinRecords.Late", fields: { label: "string", items: { array: "nat" }, digit: "nat" } };
	const slot = { record: "FinRecords.Slot", fields: { maybe: { option: "nat" }, count: "nat" } };
	// corpusReviewedIr supplies the common copied-value envelope. These placeholders become the
	// explicitly authored variant definitions below, never runtime records.
	const shape = { record: "FinRecords.Shape", fields: {} };
	const gate = { record: "FinRecords.Gate", fields: {} };
	const signatures = [
		["bump", tile, tile]
		, ["gateOpen", gate, "nat"]
		, ["lateSum", late, "nat"]
		, ["makeShape", "nat", shape]
		, ["maybeShape", { option: shape }, "nat"]
		, ["nestSum", nest, "nat"]
		, ["shapeSize", shape, "nat"]
		, ["slotCount", slot, "nat"]
		, ["tileSum", tile, "nat"]
		, ["tiles", { array: tile }, "nat"]];
	const ir = corpusReviewedIr({ id: "finrecords" }, signatures.map(([name, parameter, result]) => ({ name: `FinRecords.${name}`, parameters: [parameter], result })));
	// Keep the public argument labels shared with the ordinary-source consumers.
	for(const declaration of ir.declarations) declaration.parameters.forEach((parameter, position) => { parameter.name = `arg${position}`; });
	const documentation = { summary: "Independent corpus contract.", details: "" };
	const field = (name, type) => ({ name, type, mutability: "immutable", documentation });
	const variant = (id, cases) => {
		const branches = cases.map(([name, fields]) => ({ name, fields: fields.map(([label, type]) => field(label, type)), documentation }));
		Object.assign(ir.types.find(type => type.id === id), { kind: "variant", fields: [], cases: branches });
	};
	const nat = { kind: "primitive", name: "nat" };
	variant("lean:FinRecords.Shape", [["circle", [["radius", nat]]], ["label", [["text", { kind: "primitive", name: "string" }]]], ["empty", []]]);
	variant("lean:FinRecords.Gate", [["closed", []], ["never", [["value", nat]]]]);
	const nominal = { "lean:FinRecords.Tile": { kind: "record", fields: [fin("5"), null] }
		, "lean:FinRecords.Nest": { kind: "record", fields: [null, fin("3")] }
		, "lean:FinRecords.Late": { kind: "record", fields: [null, null, fin("5")] }
		, "lean:FinRecords.Slot": { kind: "record", fields: [{ kind: "option", arguments: [fin("0")] }, null] }
		, "lean:FinRecords.Shape": { kind: "variant", cases: [[fin("10")], [null], []] }
		, "lean:FinRecords.Gate": { kind: "variant", cases: [[], [fin("0")]] } };
	for(const type of ir.types) type.source.extensions["lean-lang.org/nominal-refinements"] = nominal[type.id];
	return ir;
};
