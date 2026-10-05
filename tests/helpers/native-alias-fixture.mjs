/**
 * Independent copied alias signatures with distinct C type/function identifiers.
 *
 * @file
 */
import { aliasReviewedIr, aliasSignatures } from "./alias-fixture.mjs";
export { aliasPrimitives } from "./alias-fixture.mjs";

const renamed = { scalars: "echo_scalars"
	, packet: "change_packet", packets: "reverse_packets"
	, rows: "reverse_rows", maybe: "echo_maybe", outcome: "echo_outcome" };
const name = value => value.replace(/Aliases\.(\w+)$/, (_, short) => `Aliases.${renamed[short] ?? short}`);

export const nativeAliasSignatures = aliasSignatures.filter(item => item.name !== "Aliases.mode").map(item => ({ ...item, name: name(item.name) }));

/** Preserve the same independent alias contracts, excluding unimplemented variants. */
export const nativeAliasReviewedIr = () => {
	const ir = aliasReviewedIr();
	ir.types = ir.types.filter(type => !["Mode", "ModeView"].includes(type.name));
	ir.declarations = ir.declarations.filter(item => item.name !== "mode");
	for(const item of ir.declarations)
	{
		item.name = renamed[item.name] ?? item.name;
		item.id = name(item.id); item.overloadKey = name(item.overloadKey);
		item.source.declaration = name(item.source.declaration);
	}
	return ir;
};
