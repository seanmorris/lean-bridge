/**
 * Exercise mixed native/host callbacks in exports, closures and receivers.
 *
 * @file
 */
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { ownedRustCallbackResultConfiguration, ownedRustCallbackResultReviewedIr
	, ownedRustCallbackResultSource, ownedRustCallbackResultCombinedConfiguration
	, ownedRustCallbackResultCombinedReviewedIr, ownedRustCallbackResultCombinedSource } from "./owned-rust-callback-result-fixture.mjs";

const source = `
namespace Owned
def applyTwice (value : Bundle) (left : Bundle → Bundle) (right : Bundle → Bundle) : Bundle := right (left value)
def dispatch (captured : Bundle) : (Bundle → Bundle) → Bundle := fun callback => callback captured
end Owned
`;
export const ownedDotnetCallbackResultSource = ownedRustCallbackResultSource + source;
export const ownedDotnetCallbackResultCombinedSource = ownedRustCallbackResultCombinedSource + source + `
namespace Owned
def moveTwice (value : Bundle) (left : Bundle → Bundle) (right : Bundle → Bundle) : Bundle := right (left value)
end Owned
`;

const configured = async combined => {
	const configuration = await (combined ? ownedRustCallbackResultCombinedConfiguration : ownedRustCallbackResultConfiguration)();
	const [value, callback] = configuration.contracts["Owned.callbackRecord"].parameters;
	configuration.exports.push("Owned.applyTwice", "Owned.dispatch");
	configuration.arities["Owned.applyTwice"] = 3; configuration.arities["Owned.dispatch"] = 1;
	configuration.contracts["Owned.applyTwice"] = { parameters: [value, callback, callback] };
	configuration.contracts["Owned.dispatch"] = { result: {
		ownership: "lease", lifetime: { scope: "explicit", anchor: null }
		, callable: { parameters: [callback] }
	} };
	if(combined)
	{
		configuration.exports.push("Owned.moveTwice"); configuration.arities["Owned.moveTwice"] = 3;
		configuration.contracts["Owned.moveTwice"] = { receiver: "method"
			, parameters: [{ ...value, ownership: "transfer" }, callback, callback] };
	}
	return structuredClone(configuration);
};

const reviewed = combined => {
	const ir = (combined ? ownedRustCallbackResultCombinedReviewedIr : ownedRustCallbackResultReviewedIr)();
	const original = ir.declarations.find(item => item.name === "callbackRecord");
	const declaration = name => ({ ...structuredClone(original), id: "lean:Owned." + name
		, name, overloadKey: "Owned." + name
		, source: { ...original.source, declaration: "Owned." + name } });
	const twice = declaration("applyTwice");
	twice.parameters.push({ ...structuredClone(twice.parameters[1]), name: "right" });
	ir.declarations.push(twice);
	const callback = original.parameters[1];
	const signature = { parameters: [callback.type], result: original.result.type };
	const name = "Callback" + sha256(canonicalJson(signature)).slice(0, 20), id = "bridge:" + name;
	const factory = structuredClone(ir.declarations.find(item => item.name === "makeRecordCallback"));
	const template = ir.types.find(item => item.id === factory.result.type.id);
	ir.types.push({ ...structuredClone(template), id, name
		, source: { ...template.source, declaration: name }
		, callable: { ...structuredClone(template.callable)
			, parameters: [{ ...structuredClone(callback), name: "argument" }]
			, result: structuredClone(original.result) }
	});
	ir.declarations.push({ ...factory, id: "lean:Owned.dispatch", name: "dispatch"
		, overloadKey: "Owned.dispatch"
		, source: { ...factory.source, declaration: "Owned.dispatch" }
		, result: { ...factory.result, type: { kind: "named", id } } });
	if(combined)
	{
		const move = declaration("moveTwice");
		move.parameters = structuredClone(twice.parameters);
		const { type, lifetime, mutability } = move.parameters.shift();
		move.receiver = { type, lifetime, mutability, ownership: "transfer" };
		move.kind = "method"; move.owner = type.id;
		ir.declarations.push(move);
	}
	return ir;
};

/** Author mixed callback sites without supplying compiler-generated types. */
export const ownedDotnetCallbackResultConfiguration = () => configured(false);
/** Combine mixed callback sites with original-owner receiver transfers. */
export const ownedDotnetCallbackResultCombinedConfiguration = () => configured(true);
/** Describe callback-local anchors and higher-order signatures independently. */
export const ownedDotnetCallbackResultReviewedIr = () => reviewed(false);
/** Describe the matching consuming receiver contracts independently. */
export const ownedDotnetCallbackResultCombinedReviewedIr = () => reviewed(true);
