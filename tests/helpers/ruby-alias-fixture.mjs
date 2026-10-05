/**
 * Independent Ruby alias contract with an explicit, source-authenticated wrapper.
 *
 * @file
 */
import { nativeAliasReviewedIr, nativeAliasSignatures } from "./native-alias-fixture.mjs";

const name = value => value.replace(/Aliases\.inspect$/, "Aliases.inspect_scalars");
export const rubyAliasSignatures = nativeAliasSignatures.map(item => ({ ...item, name: name(item.name) }));

/** Preserve all alias targets, changing only the selected wrapper declaration. */
export const rubyAliasReviewedIr = () => {
	const ir = nativeAliasReviewedIr(), entry = ir.declarations.find(item => item.name === "inspect");
	entry.name = "inspect_scalars"; entry.id = name(entry.id); entry.overloadKey = name(entry.overloadKey);
	entry.source.declaration = name(entry.source.declaration);
	return ir;
};

/** Independent installed value catalog, not derived from generated bindings. */
export const rubyAliasValueTypes = {
	AUnit: "LeanBridge::Aliases::UNIT", ABool: "true | false"
	, AU8: "Integer", AU16: "Integer", AU32: "Integer", AU64: "Integer"
	, AI8: "Integer", AI16: "Integer", AI32: "Integer", AI64: "Integer"
	, ANat: "Integer", AInt: "Integer", AWord: "Integer", ASignedWord: "Integer"
	, AF32: "Float", AF64: "Float", AText: "UTF-8 String", ABytes: "binary String"
	, AChar: "single-scalar String", Count: "Integer", OtherCount: "Integer"
	, ScalarsView: "LeanBridge::Aliases::Scalars", Rows: "Array<Array<Integer>>"
	, Maybe: "nil | Some<nil | Some<LeanBridge::Aliases::UNIT>>"
	, Outcome: "Ok<[Integer, binary String]> | Err<UTF-8 String>"
	, PacketView: "LeanBridge::Aliases::Packet"
	, Packets: "Array<LeanBridge::Aliases::Packet>"
};
