const ID = /^[a-z0-9][a-z0-9._/-]*:[A-Za-z0-9][A-Za-z0-9._/-]*$/;
const PACKAGE_ID = /^[a-z0-9][a-z0-9._-]*(?:\/[a-z0-9][a-z0-9._-]*)*@[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?$/;
const VERSION = /^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?$/;
const NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;
const EXTENSION = /^[a-z0-9][a-z0-9.-]*\/[A-Za-z0-9][A-Za-z0-9._-]*$/;

const PRIMITIVES = new Set([
	"unit"
	, "bool"
	, "uint8"
	, "uint16"
	, "uint32"
	, "uint64"
	, "int8"
	, "int16"
	, "int32"
	, "int64"
	, "nat"
	, "int"
	, "float32"
	, "float64"
	, "string"
	, "bytes"
]);
const TYPE_APPLICATIONS = new Set(["array", "option", "result", "tuple"]);
const OWNERSHIP = new Set(["copy", "borrow", "lease", "transfer"]);
const MUTABILITY = new Set(["immutable", "read", "write"]);
const EFFECTS = new Set([
	"allocates"
	, "reads-resource"
	, "writes-resource"
	, "fails"
	, "host-call"
	, "async"
	, "nondeterministic"
]);
const RESULT_MODES = new Set(["value", "promise", "iterator", "async-iterator"]);
const CALLBACK_RESULT_MODES = new Set(["value", "promise"]);
const SCHEMA_VERSIONS = new Set([1, 2, 3]);

/**
 * Reports Binding IR contract failures with stable machine-readable codes and structured diagnostic context.
 */
export class BindingIrContractError extends Error
{
	/**
   * Initializes the error used to report Binding IR contract failures, preserving its code, message, and diagnostic context.
   *
   * @param code - Stable machine-readable code that identifies the failure category.
   * @param message - Human-readable explanation of the failure.
   * @param details - Structured diagnostic fields associated with the failure.
   */
	constructor(code, message, details = {})
	{
		super(message);
		this.name = "BindingIrContractError";
		this.code = code;
		this.details = Object.freeze({ ...details });
	}
}

const fail = (code, message, details = {}) => {
	throw new BindingIrContractError(code, message, details);
};

const isObject = value =>
	value !== null && typeof value === "object" && !Array.isArray(value);

const object = (value, path) => {
	if(!isObject(value)) fail("invalid-type", `${path} must be an object`, { path });
	return value;
};

const exactKeys = (value, required, optional, path) => {
	object(value, path);
	const allowed = new Set([...required, ...optional]);
	const missing = required.filter(key => !(key in value));
	if(missing.length > 0)
	{
		fail("missing-property", `${path} is missing ${missing.join(", ")}`, {
			path
			, missing
		});
	}
	const unknown = Object.keys(value).filter(key => !allowed.has(key));
	if(unknown.length > 0)
	{
		fail("unknown-property", `${path} contains unknown ${unknown.join(", ")}`, {
			path
			, unknown
		});
	}
};

const string = (value, path, pattern) => {
	if(
		typeof value !== "string"
    || value.length === 0
    || (pattern && !pattern.test(value))
	) {
		fail("invalid-value", `${path} has an invalid value`, { path, actual: value });
	}
	return value;
};

const integer = (value, path, { minimum = 0 } = {}) => {
	if(!Number.isSafeInteger(value) || value < minimum)
	{
		fail("invalid-value", `${path} must be an integer of at least ${minimum}`, {
			path
			, actual: value
		});
	}
	return value;
};

const boolean = (value, path) => {
	if(typeof value !== "boolean")
	{
		fail("invalid-type", `${path} must be a boolean`, { path });
	}
};

const enumeration = (value, allowed, path) => {
	if(!allowed.has(value))
	{
		fail("invalid-value", `${path} is not supported`, {
			path
			, actual: value
			, expected: [...allowed]
		});
	}
	return value;
};

const array = (value, path, { nonempty = false } = {}) => {
	if(!Array.isArray(value) || (nonempty && value.length === 0))
	{
		fail("invalid-type", `${path} must be ${nonempty ? "a non-empty" : "an"} array`, {
			path
		});
	}
	return value;
};

const unique = (items, key, path) => {
	const seen = new Set();
	for(const item of items)
	{
		const value = key(item);
		if(seen.has(value))
		{
			fail("duplicate-id", `${path} contains duplicate ${value}`, { path, value });
		}
		seen.add(value);
	}
};

const namedTypeId = typeRef => (typeRef?.kind === "named" ? typeRef.id : null);

const validateDocumentation = (value, path) => {
	exactKeys(value, ["summary", "details"], [], path);
	string(value.summary, `${path}.summary`);
	if(typeof value.details !== "string")
	{
		fail("invalid-type", `${path}.details must be a string`, { path: `${path}.details` });
	}
};

const validateExtensions = (value, path) => {
	object(value, path);
	for(const key of Object.keys(value)) string(key, `${path} key`, EXTENSION);
};

const validateTypeRef = (value, path, typeParameters = new Set()) => {
	object(value, path);
	if(value.kind === "primitive")
	{
		exactKeys(value, ["kind", "name"], [], path);
		enumeration(value.name, PRIMITIVES, `${path}.name`);
	} else if(value.kind === "named")
	{
		exactKeys(value, ["kind", "id"], [], path);
		string(value.id, `${path}.id`, ID);
	} else if(value.kind === "parameter")
	{
		exactKeys(value, ["kind", "id"], [], path);
		string(value.id, `${path}.id`, NAME);
		if(!typeParameters.has(value.id))
		{
			fail("unknown-type-parameter", `${path}.id names unknown parameter ${value.id}`, {
				path: `${path}.id`
				, parameter: value.id
			});
		}
	} else if(value.kind === "apply")
	{
		exactKeys(value, ["kind", "constructor", "arguments"], [], path);
		enumeration(value.constructor, TYPE_APPLICATIONS, `${path}.constructor`);
		array(value.arguments, `${path}.arguments`, { nonempty: true }).forEach(
			(argument, index) =>
				validateTypeRef(argument, `${path}.arguments[${index}]`, typeParameters),
		);
		if(value.constructor === "option" && value.arguments.length !== 1)
		{
			fail("generic-arity", `${path} option requires one argument`, { path });
		}
		if(value.constructor === "result" && value.arguments.length !== 2)
		{
			fail("generic-arity", `${path} result requires two arguments`, { path });
		}
	} else
	{
		fail("type-kind", `${path}.kind is not supported`, {
			path: `${path}.kind`
			, actual: value.kind
		});
	}
};

const validateSource = (value, path, producers) => {
	exactKeys(value, ["producer", "declaration", "extensions"], [], path);
	string(value.producer, `${path}.producer`, NAME);
	if(!producers.has(value.producer))
	{
		fail("unknown-producer", `${path}.producer is not declared`, {
			path: `${path}.producer`
			, producer: value.producer
		});
	}
	string(value.declaration, `${path}.declaration`);
	validateExtensions(value.extensions, `${path}.extensions`);
};

const validateLifetime = (value, path) => {
	if(value === null) return;
	exactKeys(value, ["scope", "anchor"], [], path);
	enumeration(
		value.scope,
		new Set(["call", "receiver", "parameter", "explicit", "runtime"]),
		`${path}.scope`,
	);
	if(value.anchor !== null) string(value.anchor, `${path}.anchor`);
	if(value.scope === "receiver" && value.anchor !== "receiver")
	{
		fail("lifetime-anchor", `${path} receiver lifetime must use receiver anchor`, { path });
	}
	if(value.scope === "parameter" && value.anchor === null)
	{
		fail("lifetime-anchor", `${path} parameter lifetime requires an anchor`, { path });
	}
	if(!new Set(["receiver", "parameter"]).has(value.scope) && value.anchor !== null)
	{
		fail("lifetime-anchor", `${path} ${value.scope} lifetime cannot carry an anchor`, { path });
	}
};

const validateOwnershipSite = (value, path, typeParameters) => {
	object(value, path);
	const missing = ["type", "ownership", "lifetime"].filter(key => !(key in value));
	if(missing.length > 0)
	{
		fail("missing-property", `${path} is missing ${missing.join(", ")}`, {
			path
			, missing
		});
	}
	validateTypeRef(value.type, `${path}.type`, typeParameters);
	enumeration(value.ownership, OWNERSHIP, `${path}.ownership`);
	validateLifetime(value.lifetime, `${path}.lifetime`);
	if(value.ownership === "copy" && value.lifetime !== null)
	{
		fail("copy-lifetime", `${path} copied values cannot carry a lifetime`, { path });
	}
	if(value.ownership !== "copy" && value.lifetime === null)
	{
		fail("missing-lifetime", `${path} ${value.ownership} requires a lifetime`, { path });
	}
	if(
		value.ownership === "borrow"
    && !new Set(["call", "receiver", "parameter"]).has(value.lifetime?.scope)
	) {
		fail("borrow-lifetime", `${path} borrow requires call, receiver, or parameter lifetime`, {
			path
		});
	}
	if(
		value.ownership === "lease"
    && !new Set(["explicit", "runtime"]).has(value.lifetime?.scope)
	) {
		fail("lease-lifetime", `${path} lease requires explicit or runtime lifetime`, { path });
	}
	if(
		value.ownership === "transfer"
    && !new Set(["call", "explicit"]).has(value.lifetime?.scope)
	) {
		fail("transfer-lifetime", `${path} transfer requires call or explicit lifetime`, { path });
	}
};

const validateFailure = (value, path, knownErrors) => {
	exactKeys(value, ["mode", "errors", "unexpected"], [], path);
	enumeration(value.mode, new Set(["none", "declared"]), `${path}.mode`);
	enumeration(
		value.unexpected,
		new Set(["trap", "poison-runtime"]),
		`${path}.unexpected`,
	);
	validateReferenceList(value.errors, knownErrors, `${path}.errors`, "unknown-error");
	if(value.mode === "none" && value.errors.length !== 0)
	{
		fail("failure-errors", `${path} none mode cannot list errors`, { path });
	}
	if(value.mode === "declared" && value.errors.length === 0)
	{
		fail("failure-errors", `${path} declared mode requires at least one error`, { path });
	}
};

const validateParameterShape = (parameter, path, typeParameters) => {
	exactKeys(
		parameter,
		["name", "type", "ownership", "lifetime", "mutability", "optional", "default"],
		[],
		path,
	);
	string(parameter.name, `${path}.name`, NAME);
	validateOwnershipSite(parameter, path, typeParameters);
	enumeration(parameter.mutability, MUTABILITY, `${path}.mutability`);
	boolean(parameter.optional, `${path}.optional`);
	if(!parameter.optional && parameter.default !== null)
	{
		fail("unexpected-default", `${path} required parameter cannot have a default`, {
			path
		});
	}
};

const validateCallableShape = (value, path, typeParameters, knownErrors) => {
	exactKeys(
		value,
		[
			"invocation"
			, "reentry"
			, "selfDisposal"
			, "parameters"
			, "result"
			, "effects"
			, "failure"
			, "resultMode"
		],
		[],
		path,
	);
	enumeration(value.invocation, new Set(["once", "many"]), `${path}.invocation`);
	enumeration(value.reentry, new Set(["same-agent", "disallowed"]), `${path}.reentry`);
	enumeration(value.selfDisposal, new Set(["reject", "defer"]), `${path}.selfDisposal`);
	array(value.parameters, `${path}.parameters`).forEach((parameter, index) =>
		validateParameterShape(parameter, `${path}.parameters[${index}]`, typeParameters),
	);
	unique(value.parameters, parameter => parameter.name, `${path}.parameters`);
	validateOwnershipSite(value.result, `${path}.result`, typeParameters);
	array(value.effects, `${path}.effects`).forEach((effect, index) =>
		enumeration(effect, EFFECTS, `${path}.effects[${index}]`),
	);
	unique(value.effects, effect => effect, `${path}.effects`);
	validateFailure(value.failure, `${path}.failure`, knownErrors);
	if(value.failure.mode === "declared" && !value.effects.includes("fails"))
	{
		fail("failure-effect", `${path} declared failure must include fails effect`, { path });
	}
	if(value.failure.mode === "none" && value.effects.includes("fails"))
	{
		fail("failure-effect", `${path} none failure mode cannot include fails effect`, { path });
	}
	enumeration(value.resultMode, CALLBACK_RESULT_MODES, `${path}.resultMode`);
	if(value.resultMode === "promise" && !value.effects.includes("async"))
	{
		fail("async-effect", `${path} Promise result must include async effect`, { path });
	}
	if(value.resultMode === "value" && value.effects.includes("async"))
	{
		fail("sync-effect", `${path} value result cannot include async effect`, { path });
	}
};

const validateFieldShape = (field, path, typeParameters) => {
	exactKeys(field, ["name", "type", "mutability", "documentation"], [], path);
	string(field.name, `${path}.name`, NAME);
	validateTypeRef(field.type, `${path}.type`, typeParameters);
	enumeration(field.mutability, MUTABILITY, `${path}.mutability`);
	validateDocumentation(field.documentation, `${path}.documentation`);
};

const validateVariantCases = (value, path, typeParameters) => {
	array(value, path, { nonempty: true }).forEach((variantCase, index) => {
    const casePath = `${path}[${index}]`;
    exactKeys(variantCase, ["name", "fields", "documentation"], [], casePath);
    string(variantCase.name, `${casePath}.name`, NAME);
    array(variantCase.fields, `${casePath}.fields`).forEach((field, fieldIndex) =>
      validateFieldShape(field, `${casePath}.fields[${fieldIndex}]`, typeParameters),
    );
    unique(variantCase.fields, field => field.name, `${casePath}.fields`);
    validateDocumentation(variantCase.documentation, `${casePath}.documentation`);
	});
	unique(value, variantCase => variantCase.name, path);
};

const validateHostProjection = (value, path) => {
	if(value === null) return;
	exactKeys(value, ["targets", "identity", "dynamic"], [], path);
	array(value.targets, `${path}.targets`, { nonempty: true }).forEach((target, index) =>
		enumeration(target, new Set(["javascript", "python", "dotnet", "jvm", "ruby"]), `${path}.targets[${index}]`),
	);
	unique(value.targets, target => target, `${path}.targets`);
	enumeration(
		value.identity,
		new Set(["weak-canonical", "strong-canonical"]),
		`${path}.identity`,
	);
	boolean(value.dynamic, `${path}.dynamic`);
};

const assertKnownTypeRef = (typeRef, path, typeMap) => {
	if(typeRef.kind === "named" && !typeMap.has(typeRef.id))
	{
		fail("unknown-type", `${path} references unknown type ${typeRef.id}`, {
			path
			, reference: typeRef.id
		});
	}
	if(typeRef.kind === "apply")
	{
		typeRef.arguments.forEach((argument, index) =>
			assertKnownTypeRef(argument, `${path}.arguments[${index}]`, typeMap),
		);
	}
};

const representationOf = (typeRef, typeMap, typeParameters) => {
	if(typeRef.kind === "primitive") return "copied";
	if(typeRef.kind === "named") return typeMap.get(typeRef.id)?.representation;
	if(typeRef.kind === "parameter")
	{
		return typeParameters.get(typeRef.id)?.representation;
	}
	if(typeRef.kind === "apply")
	{
		const representations = typeRef.arguments.map(argument =>
			representationOf(argument, typeMap, typeParameters),
		);
		return representations.includes("identity") ? "identity"
			: representations.includes("any") ? "any" : "copied";
	}
	return undefined;
};

const checkOwnershipRepresentation = (site, path, typeMap, typeParameters) => {
	assertKnownTypeRef(site.type, `${path}.type`, typeMap);
	const representation = representationOf(site.type, typeMap, typeParameters);
	if(!representation)
	{
		fail("unknown-type", `${path}.type references an unknown type`, { path: `${path}.type` });
	}
	if(representation === "copied" && site.ownership !== "copy")
	{
		fail("copied-ownership", `${path} copied types require copy ownership`, { path });
	}
	if(representation === "identity" && site.ownership === "copy")
	{
		fail("identity-ownership", `${path} identity types cannot use copy ownership`, { path });
	}
};

const validateReferenceList = (value, known, path, code) => {
	array(value, path);
	unique(value, item => item, path);
	value.forEach((reference, index) => {
    string(reference, `${path}[${index}]`, ID);
    if(!known.has(reference))
{
      fail(code, `${path}[${index}] references unknown ${reference}`, {
        path: `${path}[${index}]`
        , reference
      });
}
	});
};

/**
 * Validates binding IR for migration against its closed contract before it enters the closed Binding IR semantic contract.
 *
 * @param ir - Binding IR document that defines the source types and operations.
 * @param path - Logical or filesystem path used to locate the input and anchor precise validation diagnostics.
 */
export const validateBindingIrForMigration = (ir, path = "bindingIr") => {
	exactKeys(
		ir,
		[
			"schemaVersion"
			, "component"
			, "producers"
			, "types"
			, "declarations"
			, "errors"
			, "capabilities"
			, "assurance"
			, "documentation"
		],
		[],
		path,
	);
	if(!SCHEMA_VERSIONS.has(ir.schemaVersion))
	{
		fail("unsupported-schema", `${path}.schemaVersion must be 1, 2, or 3`, {
			path: `${path}.schemaVersion`
			, expected: [...SCHEMA_VERSIONS]
			, actual: ir.schemaVersion
		});
	}

	exactKeys(ir.component, ["id", "name", "version"], [], `${path}.component`);
	string(ir.component.id, `${path}.component.id`, PACKAGE_ID);
	string(ir.component.name, `${path}.component.name`);
	string(ir.component.version, `${path}.component.version`, VERSION);
	const packageVersion = ir.component.id.slice(ir.component.id.lastIndexOf("@") + 1);
	if(ir.component.version !== packageVersion)
	{
		fail("component-version", `${path}.component.version does not match its package id`, {
			path: `${path}.component.version`
			, expected: packageVersion
			, actual: ir.component.version
		});
	}
	validateDocumentation(ir.documentation, `${path}.documentation`);

	array(ir.producers, `${path}.producers`, { nonempty: true });
	unique(ir.producers, producer => producer.id, `${path}.producers`);
	const producers = new Set();
	ir.producers.forEach((producer, index) => {
    const producerPath = `${path}.producers[${index}]`;
    exactKeys(
      producer,
      ["id", "adapter", "adapterVersion", "tool", "toolVersion", "extensions"],
      [],
      producerPath,
    );
    string(producer.id, `${producerPath}.id`, NAME);
    string(producer.adapter, `${producerPath}.adapter`);
    integer(producer.adapterVersion, `${producerPath}.adapterVersion`, { minimum: 1 });
    string(producer.tool, `${producerPath}.tool`);
    string(producer.toolVersion, `${producerPath}.toolVersion`);
    validateExtensions(producer.extensions, `${producerPath}.extensions`);
    producers.add(producer.id);
	});

	array(ir.errors, `${path}.errors`);
	ir.errors.forEach((error, index) => {
    object(error, `${path}.errors[${index}]`);
    string(error.id, `${path}.errors[${index}].id`, ID);
	});
	unique(ir.errors, error => error.id, `${path}.errors`);
	const declaredErrors = new Set(ir.errors.map(error => error.id));

	array(ir.types, `${path}.types`);
	unique(ir.types, type => type.id, `${path}.types`);
	const typeMap = new Map(ir.types.map(type => [type.id, type]));
	ir.types.forEach((type, index) => {
    const typePath = `${path}.types[${index}]`;
    const typeKeys = [
        "id"
        , "name"
        , "kind"
        , "representation"
        , "mutability"
        , "typeParameters"
        , "fields"
        , "target"
        , "resource"
        , "documentation"
        , "source"
        , "assurance"
    ];
    if(ir.schemaVersion >= 2) typeKeys.splice(9, 0, "callable");
    if(ir.schemaVersion >= 3) typeKeys.splice(10, 0, "cases", "host");
    exactKeys(
      type,
      typeKeys,
      [],
      typePath,
    );
    string(type.id, `${typePath}.id`, ID);
    string(type.name, `${typePath}.name`, NAME);
    enumeration(
      type.kind,
      ir.schemaVersion === 1
        ? new Set(["record", "resource", "alias"])
        : ir.schemaVersion === 2
          ? new Set(["record", "resource", "alias", "callback"])
          : new Set(["record", "resource", "alias", "callback", "variant"]),
      `${typePath}.kind`,
    );
    enumeration(
      type.representation,
      new Set(["copied", "identity"]),
      `${typePath}.representation`,
    );
    enumeration(type.mutability, MUTABILITY, `${typePath}.mutability`);
    array(type.typeParameters, `${typePath}.typeParameters`);
    unique(type.typeParameters, parameter => parameter.id, `${typePath}.typeParameters`);
    const parameterIds = new Set();
    type.typeParameters.forEach((parameter, parameterIndex) => {
      const parameterPath = `${typePath}.typeParameters[${parameterIndex}]`;
      exactKeys(parameter, ["id", "representation", "constraints"], [], parameterPath);
      string(parameter.id, `${parameterPath}.id`, NAME);
      enumeration(
        parameter.representation,
        new Set(["copied", "identity", "any"]),
        `${parameterPath}.representation`,
      );
      array(parameter.constraints, `${parameterPath}.constraints`).forEach(
        (constraint, constraintIndex) =>
          string(constraint, `${parameterPath}.constraints[${constraintIndex}]`, ID),
      );
      parameterIds.add(parameter.id);
    });

    if(type.kind === "record")
{
      if(
        type.representation !== "copied"
        || type.resource !== null
        || type.target !== null
        || (ir.schemaVersion >= 2 && type.callable !== null)
        || (ir.schemaVersion >= 3 && (type.cases.length !== 0 || type.host !== null))
      ) {
        fail("record-shape", `${typePath} record must be copied and have no resource or alias target`, {
          path: typePath
        });
      }
      array(type.fields, `${typePath}.fields`).forEach((field, fieldIndex) => {
        validateFieldShape(field, `${typePath}.fields[${fieldIndex}]`, parameterIds);
      });
      unique(type.fields, field => field.name, `${typePath}.fields`);
} else if(type.kind === "resource")
{
      if(
        type.representation !== "identity"
        || type.fields.length !== 0
        || type.target !== null
        || (ir.schemaVersion >= 2 && type.callable !== null)
        || (ir.schemaVersion >= 3 && type.cases.length !== 0)
      ) {
        fail("resource-shape", `${typePath} resource must be identity-bearing without fields or alias target`, {
          path: typePath
        });
      }
      exactKeys(
        type.resource,
        ["kindId", "disposal", "fallback", "cycles"],
        [],
        `${typePath}.resource`,
      );
      string(type.resource.kindId, `${typePath}.resource.kindId`, ID);
      enumeration(
        type.resource.disposal,
        new Set(["required", "scope", "runtime"]),
        `${typePath}.resource.disposal`,
      );
      enumeration(
        type.resource.fallback,
        new Set(["none", "queued-finalizer"]),
        `${typePath}.resource.fallback`,
      );
      enumeration(
        type.resource.cycles,
        new Set(["no-back-edges", "explicit-cut"]),
        `${typePath}.resource.cycles`,
      );
      if(ir.schemaVersion >= 3) validateHostProjection(type.host, `${typePath}.host`);
} else if(type.kind === "alias")
{
      if(
        type.fields.length !== 0
        || type.resource !== null
        || type.target === null
        || (ir.schemaVersion >= 2 && type.callable !== null)
        || (ir.schemaVersion >= 3 && (type.cases.length !== 0 || type.host !== null))
      ) {
        fail("alias-shape", `${typePath} alias requires only a target`, { path: typePath });
      }
      validateTypeRef(type.target, `${typePath}.target`, parameterIds);
} else if(type.kind === "callback")
{
      if(
        type.representation !== "identity"
        || type.mutability !== "immutable"
        || type.fields.length !== 0
        || type.target !== null
        || type.resource !== null
        || type.callable === null
      ) {
        fail(
          "callback-shape",
          `${typePath} callback must be an immutable identity with one callable signature`,
          { path: typePath },
        );
      }
      validateCallableShape(
        type.callable,
        `${typePath}.callable`,
        parameterIds,
        declaredErrors,
      );
      if(ir.schemaVersion >= 3 && (type.cases.length !== 0 || type.host !== null))
{
        fail("callback-shape", `${typePath} callback cannot carry variant or host metadata`, {
          path: typePath
        });
}
} else
{
      if(
        type.representation !== "copied"
        || type.mutability !== "immutable"
        || type.fields.length !== 0
        || type.target !== null
        || type.resource !== null
        || type.callable !== null
        || type.host !== null
      ) {
        fail(
          "variant-shape",
          `${typePath} variant must be an immutable copied value with named cases`,
          { path: typePath },
        );
      }
      validateVariantCases(type.cases, `${typePath}.cases`, parameterIds);
}
    validateDocumentation(type.documentation, `${typePath}.documentation`);
    validateSource(type.source, `${typePath}.source`, producers);
    array(type.assurance, `${typePath}.assurance`);
	});

	for(const type of ir.types)
	{
		const typeParameters = new Map(
			type.typeParameters.map(parameter => [parameter.id, parameter]),
		);
		if(type.kind === "record" || type.kind === "variant")
		{
			const fields = type.kind === "record"
				? type.fields.map((field, index) => [field, `${type.id}.fields[${index}].type`])
				: type.cases.flatMap((variantCase, caseIndex) =>
					variantCase.fields.map((field, fieldIndex) => [
						field
						, `${type.id}.cases[${caseIndex}].fields[${fieldIndex}].type`
					]),
				);
			fields.forEach(([field, fieldPath]) => {
        assertKnownTypeRef(field.type, fieldPath, typeMap);
        const representation = representationOf(field.type, typeMap, typeParameters);
        if(representation !== "copied")
{
          fail(
            "record-field-representation",
            `${fieldPath} must remain copied in every instantiation`,
            { path: fieldPath, representation },
          );
}
			});
		} else if(type.kind === "alias")
		{
			const targetPath = `${type.id}.target`;
			assertKnownTypeRef(type.target, targetPath, typeMap);
			const representation = representationOf(type.target, typeMap, typeParameters);
			if(representation !== type.representation)
			{
				fail(
					"alias-representation",
					`${targetPath} has ${representation} representation, not ${type.representation}`,
					{ path: targetPath, expected: type.representation, actual: representation },
				);
			}
		} else if(type.kind === "callback")
		{
			const callablePath = `${type.id}.callable`;
			type.callable.parameters.forEach((parameter, index) => {
        const parameterPath = `${callablePath}.parameters[${index}]`;
        checkOwnershipRepresentation(parameter, parameterPath, typeMap, typeParameters);
        if(parameter.lifetime?.scope === "receiver")
{
          fail("borrow-anchor", `${parameterPath} callback parameter has no receiver anchor`, {
            path: `${parameterPath}.lifetime.anchor`
          });
}
        if(
          parameter.lifetime?.scope === "parameter"
          && !type.callable.parameters.some(item => item.name === parameter.lifetime.anchor)
        ) {
          fail(
            "borrow-anchor",
            `${parameterPath} names unknown callback parameter ${parameter.lifetime.anchor}`,
            {
              path: `${parameterPath}.lifetime.anchor`
              , anchor: parameter.lifetime.anchor
            },
          );
        }
			});
			checkOwnershipRepresentation(
				type.callable.result,
				`${callablePath}.result`,
				typeMap,
				typeParameters,
			);
			if(type.callable.result.lifetime?.scope === "receiver")
			{
				fail("borrow-anchor", `${callablePath}.result has no receiver anchor`, {
					path: `${callablePath}.result.lifetime.anchor`
				});
			}
			if(
				type.callable.result.lifetime?.scope === "parameter"
          && !type.callable.parameters.some(parameter => parameter.name === type.callable.result.lifetime.anchor)
			) {
				fail(
					"borrow-anchor",
					`${callablePath}.result names unknown callback parameter ${type.callable.result.lifetime.anchor}`,
					{
						path: `${callablePath}.result.lifetime.anchor`
						, anchor: type.callable.result.lifetime.anchor
					},
				);
			}
		}
	}

	array(ir.errors, `${path}.errors`);
	unique(ir.errors, error => error.id, `${path}.errors`);
	const errors = new Set();
	ir.errors.forEach((error, index) => {
    const errorPath = `${path}.errors[${index}]`;
    exactKeys(error, ["id", "name", "category", "payload", "documentation"], [], errorPath);
    string(error.id, `${errorPath}.id`, ID);
    string(error.name, `${errorPath}.name`, NAME);
    enumeration(
      error.category,
      new Set(["domain", "boundary", "capability"]),
      `${errorPath}.category`,
    );
    if(error.payload !== null)
{
      validateTypeRef(error.payload, `${errorPath}.payload`);
      assertKnownTypeRef(error.payload, `${errorPath}.payload`, typeMap);
}
    validateDocumentation(error.documentation, `${errorPath}.documentation`);
    errors.add(error.id);
	});

	array(ir.capabilities, `${path}.capabilities`);
	unique(ir.capabilities, capability => capability.id, `${path}.capabilities`);
	const capabilities = new Set();
	ir.capabilities.forEach((capability, index) => {
    const capabilityPath = `${path}.capabilities[${index}]`;
    exactKeys(
      capability,
      ["id", "category", "requirement", "documentation"],
      [],
      capabilityPath,
    );
    string(capability.id, `${capabilityPath}.id`, ID);
    enumeration(
      capability.category,
      new Set(["host", "target", "runtime", "feature"]),
      `${capabilityPath}.category`,
    );
    enumeration(
      capability.requirement,
      new Set(["required", "optional"]),
      `${capabilityPath}.requirement`,
    );
    validateDocumentation(capability.documentation, `${capabilityPath}.documentation`);
    capabilities.add(capability.id);
	});

	array(ir.assurance, `${path}.assurance`);
	unique(ir.assurance, claim => claim.id, `${path}.assurance`);
	const assurance = new Set();
	ir.assurance.forEach((claim, index) => {
    const claimPath = `${path}.assurance[${index}]`;
    exactKeys(
      claim,
      ["id", "state", "subject", "claim", "theorems", "assumptions", "source"],
      [],
      claimPath,
    );
    string(claim.id, `${claimPath}.id`, ID);
    enumeration(
      claim.state,
      new Set(["proved", "trusted-boundary", "unverified"]),
      `${claimPath}.state`,
    );
    string(claim.subject, `${claimPath}.subject`, ID);
    string(claim.claim, `${claimPath}.claim`);
    array(claim.theorems, `${claimPath}.theorems`).forEach((theorem, theoremIndex) =>
      string(theorem, `${claimPath}.theorems[${theoremIndex}]`),
    );
    array(claim.assumptions, `${claimPath}.assumptions`).forEach(
      (assumption, assumptionIndex) =>
        string(assumption, `${claimPath}.assumptions[${assumptionIndex}]`),
    );
    validateSource(claim.source, `${claimPath}.source`, producers);
    assurance.add(claim.id);
	});

	for(const type of ir.types)
	{
		validateReferenceList(type.assurance, assurance, `${type.id}.assurance`, "unknown-assurance");
	}

	array(ir.declarations, `${path}.declarations`, { nonempty: true });
	unique(ir.declarations, declaration => declaration.id, `${path}.declarations`);
	unique(ir.declarations, declaration => declaration.overloadKey, `${path}.declarations overloads`);
	ir.declarations.forEach((declaration, index) => {
    const declarationPath = `${path}.declarations[${index}]`;
    exactKeys(
      declaration,
      [
        "id"
        , "name"
        , "kind"
        , ...(ir.schemaVersion >= 3 ? ["owner"] : [])
        , "overloadKey"
        , "typeParameters"
        , "receiver"
        , "parameters"
        , "result"
        , "mutability"
        , "effects"
        , "failure"
        , "resultMode"
        , "capabilities"
        , "assurance"
        , "documentation"
        , "source"
      ],
      [],
      declarationPath,
    );
    string(declaration.id, `${declarationPath}.id`, ID);
    string(declaration.name, `${declarationPath}.name`, NAME);
    enumeration(
      declaration.kind,
      new Set(["function", "constructor", "method", "static-method", "property"]),
      `${declarationPath}.kind`,
    );
    if(ir.schemaVersion >= 3)
{
      if(declaration.owner !== null) string(declaration.owner, `${declarationPath}.owner`, ID);
      const owner = declaration.owner === null ? null : typeMap.get(declaration.owner);
      if(declaration.owner !== null && owner?.kind !== "resource")
{
        fail("invalid-owner", `${declarationPath}.owner must name a resource`, {
          path: `${declarationPath}.owner`
          , owner: declaration.owner
        });
}
}
    string(declaration.overloadKey, `${declarationPath}.overloadKey`);
    array(declaration.typeParameters, `${declarationPath}.typeParameters`);
    unique(
      declaration.typeParameters,
      parameter => parameter.id,
      `${declarationPath}.typeParameters`,
    );
    const typeParameters = new Map();
    declaration.typeParameters.forEach((parameter, parameterIndex) => {
      const parameterPath = `${declarationPath}.typeParameters[${parameterIndex}]`;
      exactKeys(parameter, ["id", "representation", "constraints"], [], parameterPath);
      string(parameter.id, `${parameterPath}.id`, NAME);
      enumeration(
        parameter.representation,
        new Set(["copied", "identity", "any"]),
        `${parameterPath}.representation`,
      );
      array(parameter.constraints, `${parameterPath}.constraints`).forEach(
        (constraint, constraintIndex) =>
          string(constraint, `${parameterPath}.constraints[${constraintIndex}]`, ID),
      );
      typeParameters.set(parameter.id, parameter);
    });
    const parameterIds = new Set(typeParameters.keys());

    if(declaration.receiver !== null)
{
      exactKeys(
        declaration.receiver,
        ["type", "ownership", "lifetime", "mutability"],
        [],
        `${declarationPath}.receiver`,
      );
      validateOwnershipSite(
        declaration.receiver,
        `${declarationPath}.receiver`,
        parameterIds,
      );
      enumeration(
        declaration.receiver.mutability,
        MUTABILITY,
        `${declarationPath}.receiver.mutability`,
      );
      checkOwnershipRepresentation(
        declaration.receiver,
        `${declarationPath}.receiver`,
        typeMap,
        typeParameters,
      );
}
    if(
      new Set(["method", "property"]).has(declaration.kind)
      && declaration.receiver === null
    ) {
      fail("missing-receiver", `${declarationPath} ${declaration.kind} requires a receiver`, {
        path: declarationPath
      });
    }
    if(ir.schemaVersion >= 3)
{
      const inferredOwner = declaration.kind === "constructor"
        ? namedTypeId(declaration.result.type)
        : new Set(["method", "property"]).has(declaration.kind)
          ? namedTypeId(declaration.receiver?.type)
          : null;
      if(declaration.kind === "function" && declaration.owner !== null)
{
        fail("unexpected-owner", `${declarationPath} function cannot have an owner`, {
          path: `${declarationPath}.owner`
        });
}
      if(declaration.kind === "static-method" && declaration.owner === null)
{
        fail("missing-owner", `${declarationPath} static method requires an owner`, {
          path: `${declarationPath}.owner`
        });
}
      if(
        new Set(["constructor", "method", "property"]).has(declaration.kind)
        && declaration.owner !== inferredOwner
      ) {
        fail("owner-mismatch", `${declarationPath}.owner does not match its resource type`, {
          path: `${declarationPath}.owner`
          , expected: inferredOwner
          , actual: declaration.owner
        });
      }
}
    if(
      new Set(["function", "constructor", "static-method"]).has(declaration.kind)
      && declaration.receiver !== null
    ) {
      fail("unexpected-receiver", `${declarationPath} ${declaration.kind} cannot have a receiver`, {
        path: declarationPath
      });
    }

    array(declaration.parameters, `${declarationPath}.parameters`).forEach(
      (parameter, parameterIndex) => {
        const parameterPath = `${declarationPath}.parameters[${parameterIndex}]`;
        validateParameterShape(parameter, parameterPath, parameterIds);
        checkOwnershipRepresentation(parameter, parameterPath, typeMap, typeParameters);
      },
    );
    unique(declaration.parameters, parameter => parameter.name, `${declarationPath}.parameters`);

    validateOwnershipSite(declaration.result, `${declarationPath}.result`, parameterIds);
    checkOwnershipRepresentation(
      declaration.result,
      `${declarationPath}.result`,
      typeMap,
      typeParameters,
    );
    const ownershipSites = [
      ...(declaration.receiver === null
        ? []
        : [[declaration.receiver, `${declarationPath}.receiver`]])
      , ...declaration.parameters.map((parameter, parameterIndex) => [
        parameter
        , `${declarationPath}.parameters[${parameterIndex}]`
      ])
      , [declaration.result, `${declarationPath}.result`]
    ];
    for(const [site, sitePath] of ownershipSites)
{
      if(site.lifetime?.scope === "receiver" && declaration.receiver === null)
{
        fail("borrow-anchor", `${sitePath} requires a receiver anchor`, {
          path: `${sitePath}.lifetime.anchor`
        });
}
      if(
        site.lifetime?.scope === "parameter"
        && !declaration.parameters.some(parameter => parameter.name === site.lifetime.anchor)
      ) {
        fail("borrow-anchor", `${sitePath} names unknown parameter ${site.lifetime.anchor}`, {
          path: `${sitePath}.lifetime.anchor`
          , anchor: site.lifetime.anchor
        });
      }
}
    if(
      declaration.kind === "constructor"
      && !new Set(["lease", "transfer"]).has(declaration.result.ownership)
    ) {
      fail("constructor-ownership", `${declarationPath} constructor must return an owned identity`, {
        path: declarationPath
      });
    }

    enumeration(declaration.mutability, MUTABILITY, `${declarationPath}.mutability`);
    array(declaration.effects, `${declarationPath}.effects`).forEach((effect, effectIndex) =>
      enumeration(effect, EFFECTS, `${declarationPath}.effects[${effectIndex}]`),
    );
    unique(declaration.effects, effect => effect, `${declarationPath}.effects`);
    validateFailure(declaration.failure, `${declarationPath}.failure`, errors);
    if(declaration.failure.mode === "declared" && !declaration.effects.includes("fails"))
{
      fail("failure-effect", `${declarationPath} declared failure must include fails effect`, {
        path: declarationPath
      });
}
    if(declaration.failure.mode === "none" && declaration.effects.includes("fails"))
{
      fail("failure-effect", `${declarationPath} none failure mode cannot include fails effect`, {
        path: declarationPath
      });
}
    enumeration(declaration.resultMode, RESULT_MODES, `${declarationPath}.resultMode`);
    const asynchronous = new Set(["promise", "async-iterator"]).has(
      declaration.resultMode,
    );
    if(asynchronous && !declaration.effects.includes("async"))
{
      fail("async-effect", `${declarationPath} asynchronous result must include async effect`, {
        path: declarationPath
      });
}
    if(!asynchronous && declaration.effects.includes("async"))
{
      fail("sync-effect", `${declarationPath} non-async result cannot include async effect`, {
        path: declarationPath
      });
}
    validateReferenceList(
      declaration.capabilities,
      capabilities,
      `${declarationPath}.capabilities`,
      "unknown-capability",
    );
    validateReferenceList(
      declaration.assurance,
      assurance,
      `${declarationPath}.assurance`,
      "unknown-assurance",
    );
    validateDocumentation(declaration.documentation, `${declarationPath}.documentation`);
    validateSource(declaration.source, `${declarationPath}.source`, producers);
	});

	for(const claim of ir.assurance)
	{
		if(!typeMap.has(claim.subject) && !ir.declarations.some(item => item.id === claim.subject))
		{
			fail("unknown-assurance-subject", `${claim.id} names unknown subject ${claim.subject}`, {
				claim: claim.id
				, subject: claim.subject
			});
		}
	}
	return ir;
};

/**
 * Validates binding IR against its closed contract before it enters the closed Binding IR semantic contract.
 *
 * @param ir - Binding IR document that defines the source types and operations.
 * @param path - Logical or filesystem path used to locate the input and anchor precise validation diagnostics.
 */
export const validateBindingIr = (ir, path = "bindingIr") => {
	if(ir?.schemaVersion !== 3)
	{
		fail("unsupported-schema", `${path}.schemaVersion must be 3`, {
			path: `${path}.schemaVersion`
			, expected: 3
			, actual: ir?.schemaVersion
		});
	}
	return validateBindingIrForMigration(ir, path);
};
