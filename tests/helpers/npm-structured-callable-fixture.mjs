/**
 * Independently assemble test descriptors without using the compiler factory.
 *
 * @file
 */
import { sha256 } from "../../src/capsule/node.mjs";
import { componentRecordDefinitions } from "../../src/abi/component-records.mjs";
import { componentStructuredCallableAbi, componentStructuredCallableDispatch,
	componentStructuredCallableSignatureText } from "../../src/abi/component-structured-callables.mjs";

/**
 * Assemble the expected private contract from an independent public review.
 *
 * @param ir - Independently stated public signatures and copied definitions.
 */
export const descriptor = ir => {
	const types = componentRecordDefinitions({ types: ir.types.filter(type => type.kind !== "callback") }, true);
	const callbacks = ir.types.filter(type => type.kind === "callback").map(type => {
		const signature = { parameters: type.callable.parameters.map(item => item.type), result: type.callable.result.type };
		return { id: type.id, key: sha256(componentStructuredCallableSignatureText(signature, types)).slice(0, 40), ...signature };
	});
	return { version: componentStructuredCallableAbi
		, dispatch: componentStructuredCallableDispatch
		, types
		, callbacks
		, exports: ir.declarations.map(item => ({ bindingId: item.id
			, symbol: `lean_bridge_${sha256(`${ir.component.id}\0${item.id}`).slice(0, 24)}`
			, parameters: item.parameters.map(parameter => parameter.type)
			, result: item.result.type
			, resultMode: item.resultMode })) };
};

/**
 * Locate original Lean declarations without extracting a generated wrapper.
 *
 * @param ir - Independent public review.
 * @param abi - Expected private contract.
 */
export const sourceExports = (ir, abi) => ir.declarations.map(item => ({
	bindingId: item.id
	, symbol: abi.exports.find(entry => entry.bindingId === item.id).symbol
	, sourceDeclaration: item.source.declaration
	, wrapper: `export_${sha256(item.id).slice(0, 20)}`
}));
