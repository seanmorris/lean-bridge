/**
 * Bind finite copied-type graphs to validated public Binding IR definitions.
 * Compiler and native transport admission are deliberately independent of this step.
 *
 * @file
 */
import { validateBindingIr } from "../binding-ir/contract.mjs";
import { componentRecordDefinitions } from "../abi/component-records.mjs";
import { snapshotComponentCopiedGraph } from "../abi/component-recursive.mjs";

/**
 * Retain nominal identities, field/case order and transparent alias edges.
 * Copied values cannot hide mutable fields, generics, resources or callables.
 *
 * @param ir - Validated public Binding IR, authenticated separately by its producer.
 * @param root - Selected semantic type reference.
 */
export const componentRecursiveTypeGraph = (ir, root) => {
	validateBindingIr(ir);
	return snapshotComponentCopiedGraph({ schemaVersion: 1, root, types: componentRecordDefinitions(ir, true) });
};

/**
 * Reject descriptor substitutions without unfolding a recursive definition.
 * Declaration order is irrelevant; field and constructor order are significant.
 *
 * @param descriptor - Closed finite copied graph.
 * @param ir - Independently authenticated public Binding IR.
 * @param root - Expected semantic root reference from that IR.
 */
export const assertComponentRecursiveTypeGraph = (descriptor, ir, root) => {
	const actual = snapshotComponentCopiedGraph(descriptor), expected = componentRecursiveTypeGraph(ir, root);
	if(JSON.stringify(actual) !== JSON.stringify(expected)) throw new TypeError("Component recursive graph differs from its public types");
};
