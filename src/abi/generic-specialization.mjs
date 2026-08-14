/**
 * Implements the generic specialization module in the ABI subsystem.
 *
 * @file
 */

import { validateBindingIr } from "../binding-ir/contract.mjs";

/**
 * Reports generic specialization failures with stable machine-readable codes and structured diagnostic context.
 */
export class GenericSpecializationError extends Error
{
	/**
   * Initializes the error used to report generic specialization failures, preserving its code, message, and diagnostic context.
   *
   * @param code - Stable machine-readable code that identifies the failure category.
   * @param message - Human-readable explanation of the failure.
   * @param details - Structured diagnostic fields associated with the failure.
   */
	constructor(code, message, details = {})
	{
		super(message);
		this.name = "GenericSpecializationError";
		this.code = code;
		this.details = Object.freeze({ ...details });
	}
}

const fail = (code, message, details = {}) => {
	throw new GenericSpecializationError(code, message, details);
};

const deepFreeze = value => {
	if(value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
	for(const child of Object.values(value)) deepFreeze(child);
	return Object.freeze(value);
};

const GUARDS = Object.freeze({
	bool: "boolean"
	, uint8: "number"
	, uint16: "number"
	, uint32: "number"
	, int8: "number"
	, int16: "number"
	, int32: "number"
	, float32: "number"
	, float64: "number"
	, uint64: "bigint"
	, int64: "bigint"
	, nat: "bigint"
	, int: "bigint"
	, string: "string"
	, bytes: "bytes"
});

/**
 * Compiles finite generic specializations into the explicit representation consumed by the generated host-adapter ABI.
 *
 * @param declaration - Generic Binding IR declaration whose finite specializations are compiled.
 */
export const compileFiniteGenericSpecializations = declaration => {
	const metadata = declaration?.source?.extensions?.["lean-wasm.org/specializations"];
	if(!Array.isArray(metadata) || metadata.length === 0)
	{
		fail("missing-generic-specializations", `${declaration?.id ?? "unknown declaration"} has no specialization metadata`, {
			declaration: declaration?.id
		});
	}
	if(
		!declaration
    || declaration.kind !== "function"
    || declaration.typeParameters.length !== 1
    || declaration.typeParameters[0].representation !== "copied"
    || declaration.typeParameters[0].constraints.length !== 0
    || declaration.parameters.length !== 1
    || declaration.parameters[0].type.kind !== "parameter"
    || declaration.parameters[0].type.id !== declaration.typeParameters[0].id
    || declaration.result.type.kind !== "parameter"
    || declaration.result.type.id !== declaration.typeParameters[0].id
    || declaration.resultMode !== "value"
	) {
		fail(
			"unsupported-generic-shape",
			`${declaration?.id ?? "unknown declaration"} is not a synchronous copied identity specialization`,
			{ declaration: declaration?.id },
		);
	}
	const ids = new Set();
	const guards = new Map();
	const branches = metadata.map((branch, index) => {
    if(
      branch === null
      || typeof branch !== "object"
      || Array.isArray(branch)
      || Object.keys(branch).sort().join(",") !== "id,type"
      || typeof branch.id !== "string"
      || branch.id.length === 0
      || branch.type?.kind !== "primitive"
      || !(branch.type.name in GUARDS)
    ) {
      fail("invalid-generic-specialization", `${declaration.id} specialization ${index} is invalid`, {
        declaration: declaration.id
        , index
      });
    }
    if(ids.has(branch.id))
{
      fail("duplicate-generic-specialization", `${declaration.id} repeats ${branch.id}`, {
        declaration: declaration.id
        , specialization: branch.id
      });
}
    ids.add(branch.id);
    const guard = GUARDS[branch.type.name];
    if(guards.has(guard))
{
      fail(
        "ambiguous-generic-specialization",
        `${declaration.id} maps ${guards.get(guard)} and ${branch.id} to ${guard}`,
        { declaration: declaration.id, guard },
      );
}
    guards.set(guard, branch.id);
    return {
      id: branch.id
      , type: structuredClone(branch.type)
      , guard
    };
	});
	return deepFreeze(branches);
};

/**
 * Compiles generic specialization version 1 into the explicit representation consumed by the generated host-adapter ABI.
 *
 * @param ir - Binding IR document that defines the source types and operations.
 * @param declarationId - Stable Binding IR identifier of the declaration to process.
 * @param adapter - Boundary adapter that validates identities and translates calls between projected and native representations.
 */
export const compileGenericSpecializationV1 = (ir, declarationId, adapter = null) => {
	validateBindingIr(ir);
	const declaration = ir.declarations.find(item => item.id === declarationId);
	if(!declaration) fail("unknown-generic-declaration", `unknown declaration ${declarationId}`);
	const metadataBranches = compileFiniteGenericSpecializations(declaration);
	const privateBranches = adapter
		? new Map(adapter.branches.map(branch => [branch.id, branch.symbol]))
		: null;
	const branches = metadataBranches.map(branch => {
    const symbol = privateBranches?.get(branch.id);
    if(privateBranches && (typeof symbol !== "string" || symbol.length === 0))
{
      fail("missing-generic-symbol", `${declarationId} has no private symbol for ${branch.id}`, {
        declaration: declarationId
        , specialization: branch.id
      });
}
    return {
      ...structuredClone(branch),
      ...(symbol ? { symbol } : {}),
    };
	});
	if(privateBranches && privateBranches.size !== branches.length)
	{
		fail("unknown-generic-symbol", `${declarationId} private specializations do not match metadata`, {
			declaration: declarationId
		});
	}
	return deepFreeze({
		kind: "generic-specialization-v1"
		, abiVersion: 1
		, declarationId
		, parameter: declaration.parameters[0].name
		, typeParameter: declaration.typeParameters[0].id
		, branches
	});
};
