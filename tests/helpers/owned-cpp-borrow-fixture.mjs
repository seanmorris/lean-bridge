/**
 * Original-owner C++ borrows combined with empty and reentrant consuming calls.
 *
 * @file
 */
import { ownedBorrowReviewedIr, ownedBorrowConfiguration, ownedBorrowSource } from "./owned-borrow-fixture.mjs";

export const ownedCppBorrowSource = ownedBorrowSource + `
namespace Owned
def moveRecord (value : Bundle) (callback : Bundle → Bundle) : Bundle := callback value
def moveArray (value : Array Ticket) : Array Ticket := value
end Owned
`;

/**
 * Retain the independently authored anchor decisions and add consuming exports.
 *
 * @param options - Authored parameter naming selection.
 * @param options.friendly - Preserve reviewed names instead of compiler argN names.
 */
export const ownedCppBorrowReviewedIr = ({ friendly = true } = {}) => {
	const ir = ownedBorrowReviewedIr({ mixed: true, friendly });
	for(const [name, original] of [["moveRecord", "callbackRecord"], ["moveArray", "echoArray"]])
	{
		const item = structuredClone(ir.declarations.find(value => value.name === original));
		item.id = `lean:Owned.${name}`; item.name = name; item.overloadKey = `Owned.${name}`;
		item.source.declaration = `Owned.${name}`;
		item.parameters[0].ownership = "transfer";
		item.result.ownership = "lease"; item.result.lifetime = { scope: "explicit", anchor: null };
		ir.declarations.push(item);
	}
	return ir;
};

/**
 * State the same contracts through an ordinary author configuration.
 */
export const ownedCppBorrowConfiguration = async () => {
	const configuration = await ownedBorrowConfiguration({ mixed: true });
	for(const item of ownedCppBorrowReviewedIr({ friendly: false }).declarations.filter(value => ["moveRecord", "moveArray"].includes(value.name)))
	{
		configuration.exports.push(item.source.declaration);
		configuration.arities[item.source.declaration] = item.parameters.length;
		configuration.contracts[item.source.declaration] = {
			parameters: item.parameters.map(({ ownership, lifetime }) => ({ ownership, lifetime }))
		};
	}
	return configuration;
};
