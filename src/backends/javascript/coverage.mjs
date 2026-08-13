import { validateBindingIr } from "../../binding-ir/contract.mjs";
import { supportsErrorEnvelopeValue } from "../../abi/error-envelope.mjs";
import { supportsIteratorValue } from "../../abi/iterator.mjs";
import {
	OverloadGenerationError,
	compileOverloadV1,
} from "../../abi/overload.mjs";
import {
	GenericSpecializationError,
	compileGenericSpecializationV1,
} from "../../abi/generic-specialization.mjs";

const gap = (code, message, details = {}) =>
	Object.freeze({ code, message, details: Object.freeze({ ...details }) });

const namedTypeId = typeRef => (typeRef.kind === "named" ? typeRef.id : undefined);

/**
 * Traverses Binding IR types, callbacks, errors, and declarations to report unsupported JavaScript projection features.
 *
 * @param ir - Binding IR document that defines the source types and operations.
 */
export const analyzeJavaScriptCoverage = ir => {
	validateBindingIr(ir);
	const gaps = [];
	const typeMap = new Map(ir.types.map(type => [type.id, type]));
	const errorMap = new Map(ir.errors.map(error => [error.id, error]));
	const visitedTypes = new Set();
	const visitedCallbacks = new Set();

	const report = (code, message, details) => {
		gaps.push(gap(code, message, details));
	};

	const inspectTypeRef = (typeRef, path, { allowResource = false, allowCallback = false } = {}) => {
		if(typeRef.kind === "primitive") return;
		if(typeRef.kind === "parameter")
		{
			report("unsupported-generic", `${path} requires runtime generic specialization`, {
				path
				, parameter: typeRef.id
			});
			return;
		}
		if(typeRef.kind === "apply")
		{
			if(typeRef.constructor !== "array")
			{
				report(
					"unsupported-type-constructor",
					`${path} uses ${typeRef.constructor}, which has no JavaScript value adapter`,
					{ path, constructor: typeRef.constructor },
				);
				return;
			}
			inspectTypeRef(typeRef.arguments[0], `${path}.items`);
			return;
		}
		const type = typeMap.get(typeRef.id);
		if(type?.kind === "resource")
		{
			if(!allowResource)
			{
				report(
					"unsupported-resource-position",
					`${path} exposes a resource outside its generated class lifecycle`,
					{ path, type: typeRef.id },
				);
			}
			return;
		}
		if(type?.kind === "callback")
		{
			if(!allowCallback)
			{
				report(
					"unsupported-callback-position",
					`${path} exposes a callback without a generated callback adapter`,
					{ path, type: typeRef.id },
				);
			}
			inspectCallback(type);
			return;
		}
		if(!type || visitedTypes.has(type.id)) return;
		visitedTypes.add(type.id);
		if(type.typeParameters.length > 0)
		{
			report("unsupported-generic-type", `${type.id} requires runtime generic specialization`, {
				type: type.id
			});
			return;
		}
		if(type.kind === "record")
		{
			for(const field of type.fields)
			{
				inspectTypeRef(field.type, `${type.id}.${field.name}`);
			}
		} else if(type.kind === "variant")
		{
			for(const variantCase of type.cases)
			{
				for(const field of variantCase.fields)
				{
					inspectTypeRef(field.type, `${type.id}.${variantCase.name}.${field.name}`);
				}
			}
		} else if(type.kind === "alias")
		{
			inspectTypeRef(type.target, `${type.id}.target`);
		}
	};

	const inspectFailure = (failure, path, { errorEnvelope = false } = {}) => {
		if(failure.mode !== "declared") return;
		for(const errorId of failure.errors)
		{
			const error = errorMap.get(errorId);
			const boundaryOnly = error?.category === "boundary" && error.payload === null;
			const envelopeSupported
        = errorEnvelope && error && supportsErrorEnvelopeValue(error.payload);
			if(!boundaryOnly && !envelopeSupported)
			{
				report(
					"unsupported-error-envelope",
					`${path} requires domain or payload error translation`,
					{
						path
						, error: errorId
						, category: error?.category
						, payload: error?.payload ?? null
					},
				);
			}
		}
	};

	/**
   * Inspects callback and returns the structured evidence required by the generated native-language binding pipeline.
   *
   * @param type - Callback Binding IR type inspected for supported parameter and result shapes.
   */
	function inspectCallback(type)
	{
		if(visitedCallbacks.has(type.id)) return;
		visitedCallbacks.add(type.id);
		if(type.typeParameters.length > 0)
		{
			report("unsupported-generic-callback", `${type.id} requires generic callback adapters`, {
				type: type.id
			});
		}
		if(type.callable.resultMode !== "value")
		{
			report(
				"unsupported-callback-delivery",
				`${type.id} uses ${type.callable.resultMode}, which has no callback adapter`,
				{ type: type.id, resultMode: type.callable.resultMode },
			);
		}
		for(const parameter of type.callable.parameters)
		{
			if(parameter.ownership !== "copy")
			{
				report(
					"unsupported-callback-ownership",
					`${type.id}.${parameter.name} requires an identity callback value adapter`,
					{ type: type.id, parameter: parameter.name, ownership: parameter.ownership },
				);
			}
			inspectTypeRef(parameter.type, `${type.id}.${parameter.name}`);
		}
		if(type.callable.result.ownership !== "copy")
		{
			report(
				"unsupported-callback-ownership",
				`${type.id}.result requires an identity callback value adapter`,
				{ type: type.id, ownership: type.callable.result.ownership },
			);
		}
		inspectTypeRef(type.callable.result.type, `${type.id}.result`);
		inspectFailure(type.callable.failure, `${type.id}.failure`);
	}

	for(const type of ir.types)
	{
		if(type.kind === "record" || type.kind === "alias" || type.kind === "variant")
		{
			inspectTypeRef({ kind: "named", id: type.id }, type.id);
		} else if(type.kind === "callback")
		{
			inspectCallback(type);
		}
	}

	const overloads = new Map();
	for(const declaration of ir.declarations)
	{
		if(declaration.kind === "function")
		{
			const sameName = overloads.get(declaration.name) ?? [];
			sameName.push(declaration.id);
			overloads.set(declaration.name, sameName);
		}

		let genericPlan;
		if(declaration.typeParameters.length > 0)
		{
			try
			{
				genericPlan = compileGenericSpecializationV1(ir, declaration.id);
			} catch(error)
			{
				if(!(error instanceof GenericSpecializationError)) throw error;
				report(error.code, error.message, error.details);
			}
		}
		if(declaration.kind === "property")
		{
			const getter = declaration.parameters.length === 0 && declaration.mutability !== "write";
			const setter
        = declaration.parameters.length === 1
        && declaration.mutability === "write"
        && declaration.result.type.kind === "primitive"
        && declaration.result.type.name === "unit";
			if(!getter && !setter)
			{
				report(
					"unsupported-property-shape",
					`${declaration.id} is neither a property getter nor setter`,
					{ declaration: declaration.id },
				);
			}
		}
		const supportedModes = new Set(["function", "method", "static-method"]).has(declaration.kind) ? new Set(["value", "promise", "iterator", "async-iterator"]) : new Set(["value"]);
		if(!supportedModes.has(declaration.resultMode))
		{
			report(
				"unsupported-result-mode",
				`${declaration.id} uses ${declaration.resultMode}, which has no JavaScript adapter`,
				{ declaration: declaration.id, resultMode: declaration.resultMode },
			);
		}
		for(const parameter of declaration.parameters)
		{
			if(parameter.optional || parameter.default !== null)
			{
				report(
					"unsupported-optional-parameter",
					`${declaration.id}.${parameter.name} requires optional argument lowering`,
					{ declaration: declaration.id, parameter: parameter.name },
				);
			}
			const parameterType = typeMap.get(namedTypeId(parameter.type));
			if(parameterType?.kind === "callback")
			{
				if(
					parameter.ownership !== "borrow"
          || parameter.lifetime?.scope !== "call"
				) {
					report(
						"unsupported-callback-lifecycle",
						`${declaration.id}.${parameter.name} must borrow its callback for one call`,
						{ declaration: declaration.id, parameter: parameter.name },
					);
				}
				inspectTypeRef(parameter.type, `${declaration.id}.${parameter.name}`, {
					allowCallback: true
				});
			} else if(!genericPlan)
			{
				inspectTypeRef(parameter.type, `${declaration.id}.${parameter.name}`);
			}
			if(
				new Set(["iterator", "async-iterator"]).has(declaration.resultMode)
        && !supportsIteratorValue(parameter.type)
			) {
				report(
					"unsupported-iterator-value",
					`${declaration.id}.${parameter.name} has no iterator scalar lowering`,
					{ declaration: declaration.id, parameter: parameter.name },
				);
			}
		}

		const resultType = typeMap.get(namedTypeId(declaration.result.type));
		if(resultType?.kind === "resource")
		{
			inspectTypeRef(declaration.result.type, `${declaration.id}.result`, {
				allowResource: declaration.kind === "constructor" || declaration.kind === "method"
			});
		} else if(resultType?.kind === "callback")
		{
			if(
				declaration.result.ownership !== "lease"
        || declaration.result.lifetime?.scope !== "explicit"
			) {
				report(
					"unsupported-callback-lifecycle",
					`${declaration.id}.result must provide an explicit callback lease`,
					{ declaration: declaration.id },
				);
			}
			inspectTypeRef(declaration.result.type, `${declaration.id}.result`, {
				allowCallback: true
			});
		} else if(!genericPlan)
		{
			inspectTypeRef(declaration.result.type, `${declaration.id}.result`);
		}
		if(
			new Set(["iterator", "async-iterator"]).has(declaration.resultMode)
      && !supportsIteratorValue(declaration.result.type)
		) {
			report(
				"unsupported-iterator-value",
				`${declaration.id}.result has no iterator scalar lowering`,
				{ declaration: declaration.id },
			);
		}
		inspectFailure(declaration.failure, `${declaration.id}.failure`, {
			errorEnvelope: declaration.kind === "function" && declaration.resultMode === "value"
		});
	}

	for(const [name, declarations] of overloads)
	{
		if(declarations.length < 2) continue;
		if(
			declarations.some(id =>
				ir.declarations.find(declaration => declaration.id === id)?.typeParameters.length > 0,
			)
		) {
			report(
				"unsupported-generic-overload",
				`${name} combines generic specialization with overload dispatch`,
				{ name, declarations },
			);
			continue;
		}
		try
		{
			compileOverloadV1(ir, name);
		} catch(error)
		{
			if(!(error instanceof OverloadGenerationError)) throw error;
			report(error.code, error.message, error.details);
		}
	}

	return Object.freeze({
		backend: "javascript"
		, supported: gaps.length === 0
		, gaps: Object.freeze(gaps)
	});
};
