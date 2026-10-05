/**
 * Independently reviewed contract for the locked Telemetry multi-profile fixture.
 *
 * @file
 */
import { corpusReviewedIr } from "./type-corpus-reviewed-ir.mjs";

/**
 * Describe the selected public API without copying compiler metadata.
 */
export const reviewedTelemetry = () => {
	const ir = corpusReviewedIr({ id: "telemetry" }, [{ name: "Telemetry.measure", parameters: ["uint32"], result: "uint32" }]);
	ir.component = { id: "telemetry@0.0.0-local", name: "telemetry", version: "0.0.0-local" };
	const word = { kind: "named", id: "lean:Telemetry.Word" };
	ir.declarations[0].parameters[0].type = word;
	ir.declarations[0].result.type = { ...word };
	ir.types = [{ id: word.id, name: "Word", kind: "alias"
		, representation: "copied", mutability: "immutable", typeParameters: []
		, fields: [], cases: [], target: { kind: "primitive", name: "uint32" }
		, resource: null, callable: null, host: null
		, documentation: { summary: "Public count alias.", details: "" }
		, source: { producer: "corpusReview", declaration: "Telemetry.Word", extensions: {} }
		, assurance: [] }];
	return ir;
};
