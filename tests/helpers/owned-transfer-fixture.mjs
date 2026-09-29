/**
 * Author-selected input transfers for the real owned-value Lean fixture.
 * These decisions are independent of compiler extraction and generated layouts.
 *
 * @file
 */
import { readFile } from "node:fs/promises";
import { ownedAggregateReviewedIr } from "./owned-aggregate-fixture.mjs";

const selected = new Map([
	["retainTicket", [0]], ["bundle", [0, 2]]
	, ...["echoArray", "echoList", "echoOption", "echoResult", "echoTuple"
		, "echoRecord", "echoVariant", "echoAlias", "echoRow", "echoRecursive"
		, "echoNested", "callbackRecord", "callbackRecursive"
		, "makeRecord", "makeRecursive", "transferCallback"]
		.map(name => [name, [0]])
]);

export const ownedTransferSource = `
namespace Owned
def newRecordCallback : Bundle → Bundle := fun value => value
def transferCallback (callback : Bundle → Bundle) : Bundle → Bundle := callback
end Owned
`;

/** State the same explicit transfer choices in an independently reviewed API. */
export const ownedTransferReviewedIr = () => {
	const ir = ownedAggregateReviewedIr();
	const template = ir.declarations.find(item => item.name === "newTicket");
	const argument = ir.declarations.find(item => item.name === "callbackRecord").parameters[1];
	for(const [name, transfer] of [["newRecordCallback", false], ["transferCallback", true]])
		ir.declarations.push({ ...structuredClone(template)
			, id: `lean:Owned.${name}`, name
			, overloadKey: `Owned.${name}`
			, parameters: transfer ? [{ ...structuredClone(argument), name: "arg0" }] : []
			, result: { type: structuredClone(argument.type), ownership: "lease", lifetime: { scope: "explicit", anchor: null } }
			, effects: transfer ? ["reads-resource", "allocates", "host-call", "fails"] : ["allocates"]
			, failure: transfer ? ir.declarations.find(item => item.name === "callbackRecord").failure : template.failure
			, source: { ...template.source, declaration: `Owned.${name}` }
		});
	for(const declaration of ir.declarations)
		for(const index of selected.get(declaration.name) ?? [])
		{
			declaration.parameters[index].ownership = "transfer";
			declaration.parameters[index].lifetime = { scope: index === 0 ? "call" : "explicit", anchor: null };
		}
	return ir;
};

/** Add explicit author decisions to the ordinary Lean export configuration. */
export const ownedTransferConfiguration = async () => {
	const config = JSON.parse(await readFile("tests/fixtures/onboarding/owned-aggregates/lean-bridge.exports.json", "utf8"));
	config.exports.push("Owned.newRecordCallback", "Owned.transferCallback");
	Object.assign(config.arities, { "Owned.newRecordCallback": 0, "Owned.transferCallback": 1 });
	config.contracts = Object.fromEntries(ownedTransferReviewedIr().declarations
		.filter(item => selected.has(item.name))
		.map(item => [
			item.source.declaration
			, { parameters: item.parameters.map(({ ownership, lifetime }) => ({ ownership, lifetime })) }
		])
	);
	return config;
};
