import { validateBindingIr } from "../binding-ir/contract.mjs";

/**
 * Reports overload generation failures with stable machine-readable codes and structured diagnostic context.
 */
export class OverloadGenerationError extends Error
{
	/**
   * Initializes the error used to report overload generation failures, preserving its code, message, and diagnostic context.
   *
   * @param code - Stable machine-readable code that identifies the failure category.
   * @param message - Human-readable explanation of the failure.
   * @param details - Structured diagnostic fields associated with the failure.
   */
	constructor(code, message, details = {})
	{
		super(message);
		this.name = "OverloadGenerationError";
		this.code = code;
		this.details = Object.freeze({ ...details });
	}
}

const fail = (code, message, details = {}) => {
	throw new OverloadGenerationError(code, message, details);
};

const deepFreeze = value => {
	if(value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
	for(const child of Object.values(value)) deepFreeze(child);
	return Object.freeze(value);
};

/**
 * Compiles overload version 1 into the explicit representation consumed by the generated host-adapter ABI.
 *
 * @param ir - Binding IR document that defines the source types and operations.
 * @param name - Overloaded declaration name used to collect and order matching candidates.
 */
export const compileOverloadV1 = (ir, name) => {
	validateBindingIr(ir);
	const declarations = ir.declarations.filter(
		declaration => declaration.kind === "function" && declaration.name === name,
	);
	if(declarations.length < 2)
	{
		fail("overload-group-size", `${name} does not define an overload group`, {
			name
			, actual: declarations.length
		});
	}
	const arities = new Map();
	const branches = [];
	for(const declaration of declarations)
	{
		if(declaration.resultMode !== "value")
		{
			fail(
				"unsupported-overload-result-mode",
				`${declaration.id} requires ${declaration.resultMode} overload delivery`,
				{ declaration: declaration.id, resultMode: declaration.resultMode },
			);
		}
		if(declaration.parameters.some(parameter => parameter.optional || parameter.default !== null))
		{
			fail(
				"unsupported-overload-optional",
				`${declaration.id} has an optional or defaulted overload parameter`,
				{ declaration: declaration.id },
			);
		}
		const arity = declaration.parameters.length;
		if(arities.has(arity))
		{
			fail("ambiguous-overload-group", `${name} has two branches with arity ${arity}`, {
				name
				, arity
				, declarations: [arities.get(arity), declaration.id]
			});
		}
		arities.set(arity, declaration.id);
		branches.push({
			declarationId: declaration.id
			, overloadKey: declaration.overloadKey
			, arity
			, resultMode: declaration.resultMode
		});
	}
	branches.sort((left, right) => left.arity - right.arity);
	return deepFreeze({
		kind: "overload-v1"
		, abiVersion: 1
		, name
		, strategy: "arity"
		, branches
	});
};
