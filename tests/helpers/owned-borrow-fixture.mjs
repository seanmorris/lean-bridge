/**
 * Independently authored result anchors, including mixed consuming declarations.
 *
 * @file
 */
import { readFile } from "node:fs/promises";
import { ownedAggregateReviewedIr } from "./owned-aggregate-fixture.mjs";

export const ownedBorrowNames = [
	"retainTicket", "bundle", "primary", "echoArray", "echoList"
	, "echoOption", "echoResult", "echoTuple", "echoRecord", "echoVariant"
	, "echoAlias", "echoRow", "echoRecursive", "echoNested", "callbackRecord"
	, "callbackRecursive", "makeRecord", "makeRecursive"
];
/**
 * Describe a result whose lifetime follows one input owner.
 *
 * @param anchor - Authored input parameter name.
 */
export const borrowedResult = anchor => ({ ownership: "borrow", lifetime: { scope: "parameter", anchor } });
export const ownedBorrowContracts = Object.fromEntries(ownedBorrowNames.map(name => [
	`Owned.${name}`
	, { result: borrowedResult(name === "bundle" ? "arg2" : "arg0") }
]));
export const ownedBorrowSource = `
namespace Owned
def transferTicket (value : Ticket) : Ticket := value
def mixedTicket (owner : Ticket) (consumed : Ticket) : Ticket :=
  if consumed.serial == 0 then owner else consumed
end Owned
`;

/**
 * State the lifetime decisions independently of compiler metadata and layouts.
 *
 * @param options - Independent fixture configuration.
 * @param options.mixed - Include declarations that consume another input.
 * @param options.friendly - Use reviewed parameter names instead of compiler names.
 */
export const ownedBorrowReviewedIr = ({ mixed = false, friendly = true } = {}) => {
	const ir = ownedAggregateReviewedIr();
	if(mixed)
	{
		const template = ir.declarations.find(item => item.name === "retainTicket");
		for(const name of ["transferTicket", "mixedTicket"])
		{
			const item = structuredClone(template);
			item.id = `lean:Owned.${name}`; item.name = name; item.overloadKey = `Owned.${name}`;
			item.source.declaration = `Owned.${name}`;
			if(name === "mixedTicket") item.parameters.push({ ...structuredClone(item.parameters[0]), name: "arg1" });
			item.parameters.at(-1).ownership = "transfer";
			if(name === "mixedTicket") Object.assign(item.result, borrowedResult("arg0"));
			ir.declarations.push(item);
		}
	}
	for(const item of ir.declarations)
	{
		if(ownedBorrowNames.includes(item.name)) Object.assign(item.result, borrowedResult(item.name === "bundle" ? "arg2" : "arg0"));
		if(friendly)
		{
			item.parameters.forEach((parameter, index) => { parameter.name = `owner${index}`; });
			if(item.result.ownership === "borrow") item.result.lifetime.anchor = item.result.lifetime.anchor.replace("arg", "owner");
		}
	}
	return ir;
};

/**
 * Select the same contracts in an ordinary author configuration.
 *
 * @param options - Independent fixture configuration.
 * @param options.mixed - Include declarations that consume another input.
 */
export const ownedBorrowConfiguration = async ({ mixed = false } = {}) => {
	const config = JSON.parse(await readFile("tests/fixtures/onboarding/owned-aggregates/lean-bridge.exports.json", "utf8"));
	config.contracts = structuredClone(ownedBorrowContracts);
	if(mixed)
		for(const item of ownedBorrowReviewedIr({ mixed, friendly: false }).declarations.filter(item => ["transferTicket", "mixedTicket"].includes(item.name)))
		{
			config.exports.push(item.source.declaration);
			config.contracts[item.source.declaration] = {
				parameters: item.parameters.map(({ ownership, lifetime }) => ({ ownership, lifetime }))
				, ...item.result.ownership === "borrow" ? { result: borrowedResult("arg0") } : {}
			};
		}
	return config;
};
