/**
 * Implements the value frame module in the ABI subsystem.
 *
 * @file
 */

import { validateBindingIr } from "../binding-ir/contract.mjs";
import { hashBindingIr } from "../binding-ir/canonical.mjs";

/**
 * Reports value frame generation failures with stable machine-readable codes and structured diagnostic context.
 */
export class ValueFrameGenerationError extends Error
{
	/**
   * Initializes the error used to report value frame generation failures, preserving its code, message, and diagnostic context.
   *
   * @param code - Stable machine-readable code that identifies the failure category.
   * @param message - Human-readable explanation of the failure.
   * @param details - Structured diagnostic fields associated with the failure.
   */
	constructor(code, message, details = {})
	{
		super(message);
		this.name = "ValueFrameGenerationError";
		this.code = code;
		this.details = Object.freeze({ ...details });
	}
}

const fail = (code, message, details = {}) => {
	throw new ValueFrameGenerationError(code, message, details);
};

const deepFreeze = value => {
	if(value !== null && typeof value === "object" && !Object.isFrozen(value))
	{
		Object.freeze(value);
		for(const child of Object.values(value)) deepFreeze(child);
	}
	return value;
};

const headerNames = ["abiVersion", "byteSize", "status", "detail"];

const scalarField = (field, offset) => {
	if(field.type.kind !== "primitive") return undefined;
	if(field.type.name === "bool")
	{
		return { name: field.name, transport: "scalar", scalar: "bool", offset };
	}
	if(field.type.name === "uint32")
	{
		return { name: field.name, transport: "scalar", scalar: "uint32", offset };
	}
	return undefined;
};

const bufferField = (field, offset, limits) => {
	let codec;
	let element;
	let elementBytes;
	let maximumLength;
	if(field.type.kind === "primitive" && field.type.name === "string")
	{
		codec = "utf8";
		element = "uint8";
		elementBytes = 1;
		maximumLength = limits.maxCopyBytes;
	} else if(field.type.kind === "primitive" && field.type.name === "bytes")
	{
		codec = "bytes";
		element = "uint8";
		elementBytes = 1;
		maximumLength = limits.maxCopyBytes;
	} else if(
    field.type.kind === "apply"
    && field.type.constructor === "array"
    && field.type.arguments.length === 1
    && field.type.arguments[0].kind === "primitive"
    && field.type.arguments[0].name === "uint32"
	) {
		codec = "array";
		element = "uint32";
		elementBytes = 4;
		maximumLength = limits.maxArrayLength;
	} else {
		return undefined;
	}
	return {
		name: field.name
		, transport: "buffer"
		, codec
		, element
		, elementBytes
		, maximumLength
		, pointerOffset: offset
		, lengthOffset: offset + 4
		, capacityOffset: offset + 8
	};
};

const copiedRecord = (ir, declaration) => {
	if(declaration.parameters.length !== 1)
	{
		fail(
			"unsupported-frame-signature",
			`${declaration.id} requires exactly one copied-record parameter`,
			{ declaration: declaration.id, parameters: declaration.parameters.length },
		);
	}
	const input = declaration.parameters[0].type;
	const output = declaration.result.type;
	if(
		input.kind !== "named"
    || output.kind !== "named"
    || input.id !== output.id
	) {
		fail(
			"unsupported-frame-signature",
			`${declaration.id} must return the same copied record type it accepts`,
			{ declaration: declaration.id, input, output },
		);
	}
	const type = ir.types.find(candidate => candidate.id === input.id);
	if(type?.kind !== "record" || type.representation !== "copied")
	{
		fail("unsupported-frame-type", `${input.id} is not a copied record`, {
			declaration: declaration.id
			, type: input.id
		});
	}
	return type;
};

/**
 * Compiles value frame version 1 into the explicit representation consumed by the generated host-adapter ABI.
 *
 * @param ir - Binding IR document that defines the source types and operations.
 * @param declarationId - Stable Binding IR identifier of the declaration to process.
 * @param root0 - Named inputs and dependency overrides used to compile value frame version 1.
 * @param root0.abiVersion - Numeric ABI revision encoded into the generated adapter contract.
 * @param root0.maxCopyBytes - Maximum copied payload size accepted by the generated value-frame adapter.
 * @param root0.maxArrayLength - Maximum array element count accepted by the generated value-frame decoder.
 */
export const compileValueFrameV1 = (
	ir,
	declarationId,
	{ abiVersion = 1, maxCopyBytes, maxArrayLength },
) => {
	validateBindingIr(ir);
	if(abiVersion !== 1)
	{
		fail("unsupported-frame-version", `value frame ABI ${abiVersion} is unsupported`, {
			actual: abiVersion
			, supported: [1]
		});
	}
	for(const [name, value] of Object.entries({ maxCopyBytes, maxArrayLength }))
	{
		if(!Number.isSafeInteger(value) || value < 1)
		{
			fail("invalid-frame-limit", `${name} must be a positive safe integer`, {
				name
				, actual: value
			});
		}
	}
	const declaration = ir.declarations.find(candidate => candidate.id === declarationId);
	if(!declaration)
	{
		fail("unknown-frame-declaration", `${declarationId} is not declared`, {
			declaration: declarationId
		});
	}
	if(declaration.kind !== "function" || declaration.resultMode !== "value")
	{
		fail(
			"unsupported-frame-declaration",
			`${declarationId} must be a synchronous function`,
			{ declaration: declarationId, kind: declaration.kind, resultMode: declaration.resultMode },
		);
	}

	const record = copiedRecord(ir, declaration);
	const header = Object.fromEntries(headerNames.map((name, index) => [name, index * 4]));
	const fields = [];
	let offset = headerNames.length * 4;
	for(const field of record.fields)
	{
		const compiled
      = scalarField(field, offset)
      ?? bufferField(field, offset, { maxCopyBytes, maxArrayLength });
		if(!compiled)
		{
			fail(
				"unsupported-frame-field",
				`${record.id}.${field.name} cannot use value-frame-v1`,
				{ type: record.id, field: field.name, typeRef: field.type },
			);
		}
		fields.push(compiled);
		offset += compiled.transport === "scalar" ? 4 : 12;
	}

	return deepFreeze({
		kind: "value-frame-v1"
		, abiVersion
		, byteSize: offset
		, maxCopyBytes
		, maxArrayLength
		, declarationId
		, parameterName: declaration.parameters[0].name
		, recordTypeId: record.id
		, header
		, fields
	});
};

const cIdentifier = value =>
	value
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^A-Za-z0-9_]/g, "_")
    .toLowerCase();

/**
 * Generates value frame version 1 C header from validated semantic input without introducing behavior outside the generated host-adapter ABI.
 *
 * @param ir - Binding IR document that defines the source types and operations.
 * @param declarationId - Stable Binding IR identifier of the declaration to process.
 * @param options - ABI version plus copy-size and array-length bounds used to compile the matching C layout.
 */
export const emitValueFrameV1CHeader = (ir, declarationId, options) => {
	const layout = compileValueFrameV1(ir, declarationId, options);
	const guard = `LEAN_BRIDGE_${cIdentifier(declarationId).toUpperCase()}_VALUE_FRAME_V1_H`;
	const lines = [
		`/* Generated from Binding IR SHA-256 ${hashBindingIr(ir)}. */`
		, `#ifndef ${guard}`
		, `#define ${guard}`
		, ""
		, "#include <stdint.h>"
		, ""
		, "enum bridge_lean_frame_status {"
		, "  BRIDGE_LEAN_FRAME_OK = 0,"
		, "  BRIDGE_LEAN_FRAME_ABI_VERSION = 1,"
		, "  BRIDGE_LEAN_FRAME_BYTE_SIZE = 2,"
		, "  BRIDGE_LEAN_FRAME_RUNTIME = 3,"
		, "  BRIDGE_LEAN_FRAME_BOOL = 4,"
		, "  BRIDGE_LEAN_FRAME_LIMIT = 5,"
		, "  BRIDGE_LEAN_FRAME_POINTER_RANGE = 6,"
		, "  BRIDGE_LEAN_FRAME_OUTPUT_CAPACITY = 7,"
		, "  BRIDGE_LEAN_FRAME_INTERNAL = 8,"
		, "};"
		, ""
		, "enum bridge_lean_frame_limits {"
		, `  BRIDGE_LEAN_FRAME_ABI_V1 = ${layout.abiVersion},`
		, `  BRIDGE_LEAN_FRAME_MAX_COPY_BYTES = ${layout.maxCopyBytes},`
		, `  BRIDGE_LEAN_FRAME_MAX_ARRAY_LENGTH = ${layout.maxArrayLength},`
		, "};"
		, ""
		, "typedef struct bridge_lean_value_frame_v1 {"
		, "  uint32_t abi_version;"
		, "  uint32_t byte_size;"
		, "  uint32_t status;"
		, "  uint32_t detail;"
	];
	for(const field of layout.fields)
	{
		const name = cIdentifier(field.name);
		if(field.transport === "scalar")
		{
			lines.push(`  uint32_t ${name};`);
		} else
		{
			lines.push(
				`  uint32_t ${name}_ptr;`,
				`  uint32_t ${name}_length;`,
				`  uint32_t ${name}_capacity;`,
			);
		}
	}
	lines.push(
		"} bridge_lean_value_frame_v1;",
		"",
		`_Static_assert(sizeof(bridge_lean_value_frame_v1) == ${layout.byteSize}, "generated value frame size drift");`,
		"",
		`#endif /* ${guard} */`,
		"",
	);
	return lines.join("\n");
};
