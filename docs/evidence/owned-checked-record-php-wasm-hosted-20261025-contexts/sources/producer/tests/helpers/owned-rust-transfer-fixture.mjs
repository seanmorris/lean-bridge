/**
 * Extend the shared move fixture with boxed recursion and mixed copied fields.
 *
 * @file
 */
import { ownedCppCompositionReviewedIr } from "./owned-cpp-composition-fixture.mjs";
import { ownedTransferReviewedIr, ownedTransferConfiguration, ownedTransferSource } from "./owned-transfer-fixture.mjs";

export const ownedRustTransferSource = ownedTransferSource + `
namespace Owned
inductive Chain where
  | stop
  | link (ticket : Ticket) (next : Option Chain)
structure Mixed where
  ticket : Ticket
  markers : Array (Option (Option Bool))
  unit : Option Unit
  result : Except Ticket Bundle
  signed : Int
  unsigned : Nat
  scalar : Char
  precise : Float
  approximate : Float32
  bytes : ByteArray
  words : List UInt64
  product : Ticket × (Option Ticket × Payload)
  chain : Chain
def echoChain (value : Chain) : Chain := value
def echoMixed (value : Mixed) : Mixed := value
end Owned
`;

/** Select transfers independently of the compiler's extracted layout. */
export const ownedRustTransferReviewedIr = () => {
	const ir = ownedTransferReviewedIr(), composition = ownedCppCompositionReviewedIr();
	ir.types.push(...composition.types.filter(type => ["Chain", "Mixed"].includes(type.name)));
	for(const declaration of composition.declarations.filter(item => ["echoChain", "echoMixed"].includes(item.name)))
	{
		declaration.parameters[0].ownership = "transfer";
		ir.declarations.push(declaration);
	}
	return ir;
};

/** Apply the same decisions through ordinary author configuration. */
export const ownedRustTransferConfiguration = async () => {
	const config = await ownedTransferConfiguration();
	for(const declaration of ownedRustTransferReviewedIr().declarations.filter(item => ["echoChain", "echoMixed"].includes(item.name)))
	{
		config.exports.push(declaration.source.declaration);
		config.contracts[declaration.source.declaration] = {
			parameters: declaration.parameters.map(({ ownership, lifetime }) => ({ ownership, lifetime }))
		};
	}
	return config;
};
