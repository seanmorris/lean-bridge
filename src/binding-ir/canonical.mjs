/**
 * Implements the canonical module in the binding IR subsystem.
 *
 * @file
 */

import {
	validateBindingIr,
	validateBindingIrForMigration,
} from "./contract.mjs";
import { sha256Text } from "./sha256.mjs";

export const BINDING_IR_SCHEMA_VERSION = 3;
export const SUPPORTED_BINDING_IR_SCHEMA_VERSIONS = Object.freeze([3]);

/**
 * Reports Binding IR canonical failures with stable machine-readable codes and structured diagnostic context.
 */
export class BindingIrCanonicalError extends Error
{
	/**
   * Initializes the error used to report Binding IR canonical failures, preserving its code, message, and diagnostic context.
   *
   * @param code - Stable machine-readable code that identifies the failure category.
   * @param message - Human-readable explanation of the failure.
   * @param details - Structured diagnostic fields associated with the failure.
   */
	constructor(code, message, details = {})
	{
		super(message);
		this.name = "BindingIrCanonicalError";
		this.code = code;
		this.details = Object.freeze({ ...details });
	}
}

/**
 * Reports Binding IR compatibility failures with stable machine-readable codes and structured diagnostic context.
 */
export class BindingIrCompatibilityError extends Error
{
	/**
   * Initializes the error used to report Binding IR compatibility failures, preserving its code, message, and diagnostic context.
   *
   * @param code - Stable machine-readable code that identifies the failure category.
   * @param message - Human-readable explanation of the failure.
   * @param details - Structured diagnostic fields associated with the failure.
   */
	constructor(code, message, details = {})
	{
		super(message);
		this.name = "BindingIrCompatibilityError";
		this.code = code;
		this.details = Object.freeze({ ...details });
	}
}

const canonicalFail = (code, message, details = {}) => {
	throw new BindingIrCanonicalError(code, message, details);
};

const assertUnicodeScalarString = (value, path) => {
	for(let index = 0; index < value.length; index += 1)
	{
		const code = value.charCodeAt(index);
		if(code >= 0xd800 && code <= 0xdbff)
		{
			const next = value.charCodeAt(index + 1);
			if(!(next >= 0xdc00 && next <= 0xdfff))
			{
				canonicalFail("invalid-unicode", `${path} contains an unpaired high surrogate`, {
					path
					, index
				});
			}
			index += 1;
		} else if(code >= 0xdc00 && code <= 0xdfff)
		{
			canonicalFail("invalid-unicode", `${path} contains an unpaired low surrogate`, {
				path
				, index
			});
		}
	}
};

const serializeCanonical = (value, path, ancestors) => {
	if(value === null) return "null";
	if(typeof value === "string")
	{
		assertUnicodeScalarString(value, path);
		return JSON.stringify(value);
	}
	if(typeof value === "boolean") return value ? "true" : "false";
	if(typeof value === "number")
	{
		if(!Number.isFinite(value))
		{
			canonicalFail("invalid-number", `${path} must contain a finite JSON number`, {
				path
				, actual: value
			});
		}
		return JSON.stringify(value);
	}
	if(typeof value !== "object")
	{
		canonicalFail("non-json-value", `${path} contains a non-JSON value`, {
			path
			, actualType: typeof value
		});
	}
	if(ancestors.has(value))
	{
		canonicalFail("cycle", `${path} contains a reference cycle`, { path });
	}
	ancestors.add(value);
	try
	{
		if(Array.isArray(value))
		{
			const items = [];
			for(let index = 0; index < value.length; index += 1)
			{
				if(!(index in value))
				{
					canonicalFail("array-hole", `${path}[${index}] is missing`, {
						path: `${path}[${index}]`
					});
				}
				items.push(serializeCanonical(value[index], `${path}[${index}]`, ancestors));
			}
			return `[${items.join(",")}]`;
		}
		const prototype = Object.getPrototypeOf(value);
		if(prototype !== Object.prototype && prototype !== null)
		{
			canonicalFail("non-json-object", `${path} must contain a plain JSON object`, {
				path
			});
		}
		const keys = Object.keys(value).sort((left, right) =>
			left < right ? -1 : left > right ? 1 : 0,
		);
		const members = keys.map(key => {
      assertUnicodeScalarString(key, `${path} key`);
      return `${JSON.stringify(key)}:${serializeCanonical(value[key], `${path}.${key}`, ancestors)}`;
		});
		return `{${members.join(",")}}`;
	} finally
	{
		ancestors.delete(value);
	}
};

/**
 * Classifies a Binding IR schema version as exact, invalid, older, or newer and supplies the required corrective action.
 *
 * @param value - Candidate Binding IR document whose schema version will be diagnosed.
 */
export const diagnoseBindingIrVersion = value => {
	const actual = value?.schemaVersion;
	const supported = [...SUPPORTED_BINDING_IR_SCHEMA_VERSIONS];
	if(!Number.isSafeInteger(actual) || actual < 1)
	{
		return Object.freeze({
			compatible: false
			, code: "invalid-schema-version"
			, actual
			, supported
			, relation: "invalid"
			, action: "Regenerate the binding IR with a frontend that emits a positive schemaVersion."
		});
	}
	if(supported.includes(actual))
	{
		return Object.freeze({
			compatible: true
			, code: "exact-schema-version"
			, actual
			, supported
			, relation: "exact"
			, action: null
		});
	}
	const relation = actual < supported[0] ? "older" : "newer";
	return Object.freeze({
		compatible: false
		, code: relation === "older" ? "migration-required" : "consumer-upgrade-required"
		, actual
		, supported
		, relation
		, action: relation === "older" ? `Migrate schema version ${actual} to version ${BINDING_IR_SCHEMA_VERSION} before generation.` : `Upgrade the consumer to support schema version ${actual}.`
	});
};

/**
 * Rejects inputs when compatible binding IR version would violate an invariant owned by the closed Binding IR semantic contract.
 *
 * @param value - Binding IR document whose declared version must be supported by this implementation.
 */
export const assertCompatibleBindingIrVersion = value => {
	const diagnostic = diagnoseBindingIrVersion(value);
	if(!diagnostic.compatible)
	{
		throw new BindingIrCompatibilityError(
			diagnostic.code,
			diagnostic.action,
			diagnostic,
		);
	}
	return diagnostic;
};

/**
 * Parses binding IR and validates the resulting closed representation before returning it to the closed Binding IR semantic contract.
 *
 * @param text - JSON text parsed into a candidate Binding IR document.
 */
export const parseBindingIr = text => {
	let value;
	try
	{
		value = JSON.parse(text);
	} catch(cause)
	{
		throw new BindingIrCanonicalError("invalid-json", "Binding IR is not valid JSON", {
			cause: cause.message
		});
	}
	assertCompatibleBindingIrVersion(value);
	return validateBindingIr(value);
};

/**
 * Normalizes binding IR into the canonical representation expected by the closed Binding IR semantic contract.
 *
 * @param value - Binding IR document to validate and reduce to its deterministic representation.
 */
export const canonicalizeBindingIr = value => {
	assertCompatibleBindingIrVersion(value);
	validateBindingIr(value);
	return canonicalizeJsonValue(value, "bindingIr");
};

/**
 * Normalizes JSON value into the canonical representation expected by the closed Binding IR semantic contract.
 *
 * @param value - JSON-compatible value whose keys and nested values require deterministic ordering.
 * @param path - Logical or filesystem path used to locate the input and anchor precise validation diagnostics.
 */
export const canonicalizeJsonValue = (value, path = "value") =>
	serializeCanonical(value, path, new Set());

/**
 * Computes a stable content identity for binding IR so the closed Binding IR semantic contract can reject drift.
 *
 * @param value - Binding IR document whose canonical bytes determine the returned digest.
 */
export const hashBindingIr = value =>
	sha256Text(canonicalizeBindingIr(value));

/**
 * Migrates supported version 1 or 2 Binding IR documents to the current closed schema and validates the result.
 *
 * @param value - Older Binding IR document accepted by the migration-only validator.
 * @param targetVersion - Required output schema version, which must equal the current supported version.
 */
export const migrateBindingIr = (value, targetVersion = BINDING_IR_SCHEMA_VERSION) => {
	if(targetVersion !== BINDING_IR_SCHEMA_VERSION)
	{
		throw new BindingIrCompatibilityError(
			"unsupported-migration-target",
			`This tool cannot emit binding IR schema version ${targetVersion}.`,
			{ targetVersion, supported: [...SUPPORTED_BINDING_IR_SCHEMA_VERSIONS] },
		);
	}
	if(new Set([1, 2]).has(value?.schemaVersion) && targetVersion === 3)
	{
		validateBindingIrForMigration(value);
		const migrated = structuredClone(value);
		if(migrated.schemaVersion === 1)
		{
			migrated.schemaVersion = 2;
			for(const type of migrated.types) type.callable = null;
		}
		migrated.schemaVersion = 3;
		for(const type of migrated.types)
		{
			type.cases = [];
			type.host = null;
		}
		for(const declaration of migrated.declarations)
		{
			if(declaration.kind === "constructor")
			{
				declaration.owner = declaration.result.type.kind === "named"
					? declaration.result.type.id
					: null;
			} else if(new Set(["method", "property"]).has(declaration.kind))
			{
				declaration.owner = declaration.receiver?.type.kind === "named"
					? declaration.receiver.type.id
					: null;
			} else if(declaration.kind === "static-method")
			{
				throw new BindingIrCompatibilityError(
					"ambiguous-static-owner",
					`${declaration.id} requires an explicit owner before migration to schema version 3.`,
					{ declaration: declaration.id },
				);
			} else
			{
				declaration.owner = null;
			}
		}
		validateBindingIr(migrated);
		return migrated;
	}
	const diagnostic = diagnoseBindingIrVersion(value);
	if(!diagnostic.compatible)
	{
		throw new BindingIrCompatibilityError(
			"migration-unavailable",
			`No automatic migration from schema version ${String(diagnostic.actual)} is registered.`,
			diagnostic,
		);
	}
	validateBindingIr(value);
	return structuredClone(value);
};
