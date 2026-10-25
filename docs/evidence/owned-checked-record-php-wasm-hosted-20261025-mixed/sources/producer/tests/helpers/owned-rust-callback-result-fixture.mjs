/**
 * Rust callback-owner fixtures include returned closures used as host arguments.
 *
 * @file
 */
import { ownedCallbackResultConfiguration, ownedCallbackResultReviewedIr
	, ownedCallbackResultSource, ownedCallbackResultCombinedConfiguration
	, ownedCallbackResultCombinedReviewedIr, ownedCallbackResultCombinedSource } from "./owned-callback-result-fixture.mjs";

const source = `
namespace Owned
def makeRecordCallback (captured : Bundle) : Bundle → Bundle := fun _ => captured
def makeTreeCallback (captured : Tree) : Tree → Tree := fun _ => captured
end Owned
`;
export const ownedRustCallbackResultSource = ownedCallbackResultSource + source;
export const ownedRustCallbackResultCombinedSource = ownedCallbackResultCombinedSource + source;

const configured = async factory => {
	const configuration = await factory();
	for(const name of ["makeRecordCallback", "makeTreeCallback"])
	{
		configuration.exports.push("Owned." + name);
		configuration.arities["Owned." + name] = 1;
		configuration.contracts["Owned." + name] = { result: {
			ownership: "lease", lifetime: { scope: "explicit", anchor: null }
			, callable: { result: { ownership: "borrow"
				, lifetime: { scope: "parameter", anchor: "arg0" } } }
		} };
	}
	return configuration;
};
const reviewed = factory => {
	const ir = factory();
	for(const [name, echo, call] of [
		["makeRecordCallback", "echoRecord", "callbackRecord"]
		, ["makeTreeCallback", "echoRecursive", "callbackRecursive"]
	]) {
		const declaration = structuredClone(ir.declarations.find(item => item.name === echo));
		declaration.name = name; declaration.id = "lean:Owned." + name;
		declaration.overloadKey = "Owned." + name; declaration.source.declaration = "Owned." + name;
		declaration.result = structuredClone(ir.declarations.find(item => item.name === "makeLeasedRecord").result);
		declaration.result.type = structuredClone(ir.declarations.find(item => item.name === call).parameters[1].type);
		ir.declarations.push(declaration);
	}
	return ir;
};
/** Author callback-local owners without supplying compiler-generated types. */
export const ownedRustCallbackResultConfiguration = () => configured(ownedCallbackResultConfiguration);
/** Add borrowed and consuming receiver methods to the authored callbacks. */
export const ownedRustCallbackResultCombinedConfiguration = () => configured(ownedCallbackResultCombinedConfiguration);
/** Describe the same returned callable types using independently reviewed IR. */
export const ownedRustCallbackResultReviewedIr = () => reviewed(ownedCallbackResultReviewedIr);
/** Preserve callback-local anchors in reviewed receiver and transfer contracts. */
export const ownedRustCallbackResultCombinedReviewedIr = () => reviewed(ownedCallbackResultCombinedReviewedIr);
