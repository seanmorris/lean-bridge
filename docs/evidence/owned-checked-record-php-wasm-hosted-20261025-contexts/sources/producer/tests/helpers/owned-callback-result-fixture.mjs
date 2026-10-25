/**
 * Independently author borrowed callback results and a matching leased closure.
 *
 * @file
 */
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { ownedAggregateReviewedIr } from "./owned-aggregate-fixture.mjs";

const borrow = { ownership: "borrow", lifetime: { scope: "call", anchor: null } };
const anchored = index => ({ ownership: "borrow", lifetime: { scope: "parameter", anchor: `arg${index}` } });
export const ownedCallbackResultSource = `
namespace Owned
def makeLeasedRecord (captured : Bundle) : Bool → Bundle → Bundle := makeRecord captured
end Owned
`;

/** Select callback-local lifetime decisions without supplying compiler types. */
export const ownedCallbackResultConfiguration = async () => {
	const value = JSON.parse(await readFile("tests/fixtures/onboarding/owned-aggregates/lean-bridge.exports.json", "utf8"));
	value.exports.push("Owned.makeLeasedRecord"); value.arities["Owned.makeLeasedRecord"] = 1;
	value.contracts = {};
	for(const name of ["callbackRecord", "callbackRecursive"])
		value.contracts["Owned." + name] = { parameters: [borrow, { ...borrow, callable: { result: anchored(0) } }] };
	for(const name of ["makeRecord", "makeRecursive"])
		value.contracts["Owned." + name] = { result: {
			ownership: "lease", lifetime: { scope: "explicit", anchor: null }
			, callable: { result: anchored(1) }
		} };
	return structuredClone(value);
};

/** Keep review parameter names independent of compiled argument positions. */
export const ownedCallbackResultReviewedIr = () => {
	const ir = ownedAggregateReviewedIr(), replacements = new Map();
	const leased = structuredClone(ir.declarations.find(item => item.name === "makeRecord"));
	const leasedType = structuredClone(ir.types.find(type => type.id === leased.result.type.id));
	leased.id = "lean:Owned.makeLeasedRecord"; leased.name = "makeLeasedRecord";
	leased.overloadKey = "Owned.makeLeasedRecord"; leased.source.declaration = "Owned.makeLeasedRecord";
	for(const type of ir.types.filter(type => type.kind === "callback"))
	{
		const signature = {
			parameters: type.callable.parameters.map(value => value.type)
			, result: type.callable.result.type
			, resultAnchor: type.callable.parameters.length - 1
		};
		const name = "Callback" + sha256(canonicalJson(signature)).slice(0, 20), id = "bridge:" + name;
		replacements.set(type.id, id); type.id = id; type.name = name; type.source.declaration = name;
		type.callable.parameters.forEach((value, index) => { value.name = "incoming" + index; });
		type.callable.result.ownership = "borrow";
		type.callable.result.lifetime = { scope: "parameter", anchor: type.callable.parameters.at(-1).name };
	}
	const remap = value => {
		if(value === null || typeof value !== "object") return;
		if(value.kind === "named" && replacements.has(value.id)) value.id = replacements.get(value.id);
		for(const child of Object.values(value)) remap(child);
	};
	remap(ir); ir.types.push(leasedType); ir.declarations.push(leased);
	return ir;
};

export const ownedCallbackResultCombinedSource = ownedCallbackResultSource + `
namespace Owned
def borrowRecord (value : Bundle) : Bundle := value
def moveRecord (value : Bundle) (callback : Bundle → Bundle) : Bundle := callback value
end Owned
`;

/** Combine callback anchors with borrowed and consuming receiver methods. */
export const ownedCallbackResultCombinedConfiguration = async () => {
	const config = await ownedCallbackResultConfiguration();
	for(const name of ["makeRecord", "makeRecursive"])
		config.contracts["Owned." + name].receiver = "method";
	config.exports.push("Owned.borrowRecord", "Owned.moveRecord");
	config.arities["Owned.borrowRecord"] = 1; config.arities["Owned.moveRecord"] = 2;
	config.contracts["Owned.borrowRecord"] = { receiver: "method"
		, result: {
			ownership: "borrow", lifetime: { scope: "receiver", anchor: "receiver" }
		}
	};
	config.contracts["Owned.moveRecord"] = { receiver: "method"
		, parameters: [
			{ ...borrow, ownership: "transfer" }
			, { ...borrow, callable: { result: anchored(0) } }
		]
	};
	return config;
};

/** Independently describe the combined methods and their local callback owners. */
export const ownedCallbackResultCombinedReviewedIr = () => {
	const ir = ownedCallbackResultReviewedIr();
	for(const [name, original] of [["borrowRecord", "echoRecord"], ["moveRecord", "callbackRecord"]])
	{
		const item = structuredClone(ir.declarations.find(value => value.name === original));
		item.name = name; item.id = "lean:Owned." + name;
		item.overloadKey = "Owned." + name; item.source.declaration = "Owned." + name;
		if(name === "moveRecord") item.parameters[0].ownership = "transfer";
		else Object.assign(item.result, { ownership: "borrow", lifetime: { scope: "receiver", anchor: "receiver" } });
		ir.declarations.push(item);
	}
	for(const item of ir.declarations.filter(value => ["makeRecord", "makeRecursive", "borrowRecord", "moveRecord"].includes(value.name)))
	{
		const { type, ownership, lifetime, mutability } = item.parameters.shift();
		item.receiver = { type, ownership, lifetime, mutability };
		item.kind = "method"; item.owner = type.id;
	}
	return ir;
};
