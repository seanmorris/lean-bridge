/**
 * Authored receivers over real Lean functions, independent of native layouts.
 *
 * @file
 */
import { ownedBorrowConfiguration, ownedBorrowReviewedIr, ownedBorrowSource, borrowedResult } from "./owned-borrow-fixture.mjs";
import { readFile } from "node:fs/promises";

export const ownedReceiverKinds = Object.freeze({
	serial: "property", label: "property", payload: "property"
	, retainTicket: "method", primary: "property", echoRecord: "method"
	, echoVariant: "method", echoRecursive: "method", callbackRecord: "method"
	, callbackRecursive: "method", makeRecord: "method", makeRecursive: "method"
	, mixedTicket: "method", transferTicket: "method", chooseTicket: "method"
});
export const ownedReceiverSource = ownedBorrowSource + `
namespace Owned
def chooseTicket (_receiver : Ticket) (source : Ticket) : Ticket := source
end Owned
`;
const receiverResult = () => ({ ownership: "borrow", lifetime: { scope: "receiver", anchor: "receiver" } });

/** Select first-argument receivers without supplying any runtime type. */
export const ownedReceiverConfiguration = async () => {
	const configuration = await ownedBorrowConfiguration({ mixed: true });
	configuration.exports.push("Owned.chooseTicket");
	configuration.contracts["Owned.chooseTicket"] = { result: borrowedResult("arg1") };
	for(const [name, kind] of Object.entries(ownedReceiverKinds))
	{
		const contract = configuration.contracts[`Owned.${name}`] ??= {};
		contract.receiver = kind;
		if(contract.result?.lifetime.anchor === "arg0") contract.result = receiverResult();
	}
	return configuration;
};

/** Describe the same API using independent reviewed names and method sites. */
export const ownedReceiverReviewedIr = () => {
	const ir = ownedBorrowReviewedIr({ mixed: true });
	const choose = structuredClone(ir.declarations.find(item => item.name === "retainTicket"));
	choose.name = "chooseTicket"; choose.id = "lean:Owned.chooseTicket";
	choose.overloadKey = "Owned.chooseTicket"; choose.source.declaration = "Owned.chooseTicket";
	choose.parameters.push({ ...structuredClone(choose.parameters[0]), name: "owner1" });
	Object.assign(choose.result, borrowedResult("owner1")); ir.declarations.push(choose);
	for(const item of ir.declarations)
	{
		if(!Object.hasOwn(ownedReceiverKinds, item.name)) continue;
		const { name, type, ownership, lifetime, mutability } = item.parameters.shift();
		item.kind = ownedReceiverKinds[item.name]; item.owner = type.id;
		item.receiver = { type, ownership, lifetime, mutability };
		if(item.result.ownership === "borrow" && item.result.lifetime.anchor === name)
			Object.assign(item.result, receiverResult());
	}
	return ir;
};

/** Keep the independent lifetime assertions identical in direct and installed runs. */
export const ownedReceiverProbe = async () => {
	const source = await readFile("tests/fixtures/structured-types/owned-public-borrows.c", "utf8");
	const receiver = await readFile("tests/fixtures/structured-types/owned-receiver-parameter.c", "utf8");
	return source.replace("int main(void) {", receiver + "\nint main(void) {")
		.replace("callbacks_and_closures(); mixed_transfers();", "callbacks_and_closures(); mixed_transfers(); receiver_parameter_anchor();");
};

/**
 * Map independent container cases to their generated typed copy entry points.
 *
 * @param values - Public C value model.
 */
export const ownedReceiverCopyMacros = values => [
	["OPTION", "echoOption"], ["ARRAY", "echoArray"], ["LIST", "echoList"]
	, ["RESULT", "echoResult"], ["TUPLE", "echoTuple"]
	, ["ROW", "echoRow"], ["NESTED", "echoNested"]
].map(([macro, name]) => {
	const id = values.functions.find(item => item.name === name).parameters[0];
	return `#define COPY_${macro} ${values.copies.find(item => item.id === id).cName}\n`;
}).join("");
