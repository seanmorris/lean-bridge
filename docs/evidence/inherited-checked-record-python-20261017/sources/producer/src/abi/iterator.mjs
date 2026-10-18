/**
 * Implements the iterator module in the ABI subsystem.
 *
 * @file
 */

import { validateBindingIr } from "../binding-ir/contract.mjs";

/**
 * Reports iterator generation failures with stable machine-readable codes and structured diagnostic context.
 */
export class IteratorGenerationError extends Error
{
	/**
   * Initializes the error used to report iterator generation failures, preserving its code, message, and diagnostic context.
   *
   * @param code - Stable machine-readable code that identifies the failure category.
   * @param message - Human-readable explanation of the failure.
   * @param details - Structured diagnostic fields associated with the failure.
   */
	constructor(code, message, details = {})
	{
		super(message);
		this.name = "IteratorGenerationError";
		this.code = code;
		this.details = Object.freeze({ ...details });
	}
}

const fail = (code, message, details = {}) => {
	throw new IteratorGenerationError(code, message, details);
};

const deepFreeze = value => {
	if(value !== null && typeof value === "object" && !Object.isFrozen(value))
	{
		Object.freeze(value);
		for(const child of Object.values(value)) deepFreeze(child);
	}
	return value;
};

const scalar = (type, path) => {
	if(type.kind !== "primitive")
	{
		fail("unsupported-iterator-value", `${path} requires a copied scalar`, { path, type });
	}
	if(new Set(["bool", "uint8", "uint16", "uint32"]).has(type.name))
	{
		return { codec: type.name === "bool" ? "bool" : "uint32", byteWidth: 4 };
	}
	if(new Set(["int8", "int16", "int32"]).has(type.name))
	{
		return { codec: "int32", byteWidth: 4 };
	}
	if(type.name === "float32") return { codec: "float32", byteWidth: 4 };
	if(type.name === "float64") return { codec: "float64", byteWidth: 8 };
	fail("unsupported-iterator-value", `${path} uses unsupported scalar ${type.name}`, {
		path
		, type: type.name
	});
};

/**
 * Reports whether a value type can cross the iterator ABI through one of its supported scalar codecs.
 *
 * @param type - Candidate Binding IR value type for an iterator item.
 */
export const supportsIteratorValue = type => {
	try
	{
		scalar(type, "value");
		return true;
	} catch(error)
	{
		if(error instanceof IteratorGenerationError) return false;
		throw error;
	}
};

/**
 * Compiles iterator version 1 into the explicit representation consumed by the generated host-adapter ABI.
 *
 * @param ir - Binding IR document that defines the source types and operations.
 * @param declarationId - Stable Binding IR identifier of the declaration to process.
 * @param root0 - Named inputs and dependency overrides used to compile iterator version 1.
 * @param root0.abiVersion - Numeric ABI revision encoded into the generated adapter contract.
 * @param root0.side - Iterator ownership side that determines which boundary creates and releases cursor state.
 * @param root0.handleKind - Numeric handle-kind discriminator encoded into callback tokens.
 * @param root0.next - Native iterator-next symbol that advances a cursor and returns its next value state.
 * @param root0.dispose - Native disposal symbol used to release iterator state exactly once.
 */
export const compileIteratorV1 = (
	ir,
	declarationId,
	{
		abiVersion = 1
		, side
		, handleKind
		, next
		, dispose
	} = {},
) => {
	validateBindingIr(ir);
	if(abiVersion !== 1)
	{
		fail("unsupported-iterator-version", `iterator ABI ${abiVersion} is unsupported`, {
			actual: abiVersion
			, supported: [1]
		});
	}
	if(side !== "lean" || !Number.isSafeInteger(handleKind) || handleKind < 1 || handleKind > 0x7f)
	{
		fail("invalid-iterator-handle", `${declarationId} has an invalid cursor handle`, {
			side
			, handleKind
		});
	}
	for(const [name, value] of Object.entries({ next, dispose }))
	{
		if(typeof value !== "string" || value.length === 0)
		{
			fail("invalid-iterator-symbol", `${declarationId} has no ${name} symbol`, { name });
		}
	}
	const declaration = ir.declarations.find(candidate => candidate.id === declarationId);
	if(!declaration)
	{
		fail("missing-declaration", `Binding IR has no declaration ${declarationId}`, {
			declaration: declarationId
		});
	}
	if(
		declaration.kind !== "function"
    || declaration.resultMode !== "iterator"
    || declaration.typeParameters.length > 0
	) {
		fail(
			"unsupported-iterator-declaration",
			`${declarationId} must be a synchronous monomorphic iterator function`,
			{ declaration: declarationId, resultMode: declaration.resultMode },
		);
	}
	for(const parameter of declaration.parameters)
	{
		scalar(parameter.type, `${declarationId}.${parameter.name}`);
	}
	const value = scalar(declaration.result.type, `${declarationId}.result`);
	const byteSize = value.byteWidth === 8 ? 24 : 20;

	return deepFreeze({
		kind: "iterator-v1"
		, abiVersion
		, declarationId
		, delivery: "iterator"
		, cursor: {
			typeId: `${declarationId}/iterator`
			, handle: { side, kind: handleKind }
			, ownership: "lease"
			, lifetime: { scope: "explicit", anchor: null }
			, disposal: {
				explicit: true
				, hostProtocol: "return"
				, fallback: "queued-finalizer"
				, symbol: dispose
			}
		}
		, step: {
			symbol: next
			, byteSize
			, header: {
				abiVersion: 0
				, byteSize: 4
				, state: 8
				, detail: 12
			}
			, states: { value: 0, done: 1 }
			, value: {
				type: declaration.result.type
				, ...value
				, offset: 16
			}
		}
	});
};

/**
 * Compiles async iterator version 1 into the explicit representation consumed by the generated host-adapter ABI.
 *
 * @param ir - Binding IR document that defines the source types and operations.
 * @param declarationId - Stable Binding IR identifier of the declaration to process.
 * @param root0 - Named inputs and dependency overrides used to compile async iterator version 1.
 * @param root0.abiVersion - Numeric ABI revision encoded into the generated adapter contract.
 * @param root0.side - Iterator ownership side that determines which boundary creates and releases cursor state.
 * @param root0.handleKind - Numeric handle-kind discriminator encoded into callback tokens.
 * @param root0.next - Native iterator-next symbol that advances a cursor and returns its next value state.
 * @param root0.cancel - Native cancellation symbol or lifecycle hook invoked to stop unfinished work.
 * @param root0.dispose - Native disposal symbol used to release iterator state exactly once.
 */
export const compileAsyncIteratorV1 = (
	ir,
	declarationId,
	{
		abiVersion = 1
		, side
		, handleKind
		, next
		, cancel
		, dispose
	} = {},
) => {
	validateBindingIr(ir);
	if(abiVersion !== 1)
	{
		fail("unsupported-iterator-version", `iterator ABI ${abiVersion} is unsupported`, {
			actual: abiVersion
			, supported: [1]
		});
	}
	if(side !== "lean" || !Number.isSafeInteger(handleKind) || handleKind < 1 || handleKind > 0x7f)
	{
		fail("invalid-iterator-handle", `${declarationId} has an invalid cursor handle`, {
			side
			, handleKind
		});
	}
	for(const [name, value] of Object.entries({ next, cancel, dispose }))
	{
		if(typeof value !== "string" || value.length === 0)
		{
			fail("invalid-iterator-symbol", `${declarationId} has no ${name} symbol`, { name });
		}
	}
	const declaration = ir.declarations.find(candidate => candidate.id === declarationId);
	if(!declaration)
	{
		fail("missing-declaration", `Binding IR has no declaration ${declarationId}`, {
			declaration: declarationId
		});
	}
	if(
		declaration.kind !== "function"
    || declaration.resultMode !== "async-iterator"
    || declaration.typeParameters.length > 0
	) {
		fail(
			"unsupported-iterator-declaration",
			`${declarationId} must be a monomorphic async iterator function`,
			{ declaration: declarationId, resultMode: declaration.resultMode },
		);
	}
	for(const parameter of declaration.parameters)
	{
		scalar(parameter.type, `${declarationId}.${parameter.name}`);
	}
	const value = scalar(declaration.result.type, `${declarationId}.result`);
	const resolver = value.codec === "int32" ? "__leanBridgePendingResolveIteratorI32" : new Set(["float32", "float64"]).has(value.codec) ? "__leanBridgePendingResolveIteratorF64" : "__leanBridgePendingResolveIteratorU32";

	return deepFreeze({
		kind: "async-iterator-v1"
		, abiVersion
		, declarationId
		, delivery: "async-iterator"
		, cursor: {
			typeId: `${declarationId}/async-iterator`
			, handle: { side, kind: handleKind }
			, ownership: "lease"
			, lifetime: { scope: "explicit", anchor: null }
			, disposal: {
				explicit: true
				, hostProtocol: "return"
				, fallback: "queued-finalizer"
				, symbol: dispose
			}
		}
		, step: {
			symbol: next
			, cancelSymbol: cancel
			, resolver
			, states: { value: 0, done: 1 }
			, value: {
				type: declaration.result.type,
				...value
			}
			, pending: {
				kind: "pending-operation-v1"
				, abiVersion: 1
				, delivery: "promise"
				, settlement: { cardinality: "exactly-once", late: "reject" }
				, cancellation: { supported: true, cleanup: "before-reject" }
			}
		}
	});
};
