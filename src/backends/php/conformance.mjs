import { createHash } from "node:crypto";

import { canonicalJson } from "../../capsule/node.mjs";
import { compilePhpProjection } from "./projection.mjs";

export class PhpConformanceError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "PhpConformanceError";
    this.code = code;
    this.details = Object.freeze(structuredClone(details));
  }
}

const fail = (code, message, details = {}) => {
  throw new PhpConformanceError(code, message, details);
};

const sha256 = source => createHash("sha256").update(source).digest("hex");
const phpClass = name => `\\${name}`;
const phpFunction = operation => `\\${operation.public.namespace}\\${operation.public.name}`;
const phpString = value => `'${value.replaceAll("\\", "\\\\").replaceAll("'", "\\'")}'`;

const requireOne = (values, label) => {
  if (values.length !== 1) fail("unsupported-conformance-shape", `PHP conformance requires one ${label}`, {
    label,
    matches: values.map(value => value.id),
  });
  return values[0];
};

const sampleExpression = (type, namespace) => {
  if (type.kind === "primitive") {
    if (type.binding === "bool") return "false";
    if (type.binding === "uint32") return "8";
    if (type.binding === "string") return "'parity'";
    if (type.binding === "bytes") return `${phpClass(`${namespace}\\Bytes`)}::fromString("\\x00\\x7f\\xff")`;
  }
  if (
    type.kind === "application" &&
    type.binding === "array" &&
    type.arguments.length === 1 &&
    type.arguments[0].kind === "primitive" &&
    type.arguments[0].binding === "uint32"
  ) return "[1, 5, 13]";
  fail("unsupported-conformance-value", "PHP conformance cannot synthesize a portable value", { type });
};

const observationExpression = (variable, field) => {
  const access = `${variable}->${field.name}`;
  if (field.type.kind === "primitive" && field.type.binding === "bytes") {
    return `bin2hex(${access}->toString())`;
  }
  return access;
};

const errorFor = (projection, id) => {
  const error = projection.errors.find(candidate => candidate.id === id);
  if (!error) fail("missing-conformance-error", `PHP conformance cannot resolve ${id}`, { error: id });
  return error;
};

const differences = (left, right, path = "result") => {
  if (Object.is(left, right)) return [];
  if (
    left === null || right === null ||
    typeof left !== "object" || typeof right !== "object" ||
    Array.isArray(left) !== Array.isArray(right)
  ) return [{ path, native: left, phpWasm: right }];
  const keys = [...new Set([...Object.keys(left), ...Object.keys(right)])].sort();
  return keys.flatMap(key => differences(left[key], right[key], `${path}.${key}`));
};

const validateObservation = (corpus, observation, transport) => {
  if (observation === null || typeof observation !== "object" || Array.isArray(observation)) {
    fail("invalid-conformance-observation", `${transport} did not return a structured PHP conformance result`);
  }
  if (observation.bindingIrSha256 !== corpus.bindingIrSha256) {
    fail("conformance-binding-drift", `${transport} executed a different Binding IR`, {
      transport,
      expected: corpus.bindingIrSha256,
      actual: observation.bindingIrSha256,
    });
  }
  if (observation.identity !== corpus.expected.identity) {
    fail("conformance-identity-failure", `${transport} did not preserve canonical object identity`, { transport });
  }
  const failureIds = [observation.failures?.callback?.[0], observation.failures?.closedResource];
  if (canonicalJson(failureIds) !== canonicalJson(corpus.expected.declaredFailures)) {
    fail("conformance-failure-drift", `${transport} did not project the declared failures`, {
      transport,
      expected: corpus.expected.declaredFailures,
      actual: failureIds,
    });
  }
  if (
    observation.runtime?.runtimeInitRuns !== corpus.expected.runtimeInitRuns ||
    observation.runtime?.liveIdentities !== corpus.expected.liveIdentities
  ) {
    fail("conformance-runtime-state", `${transport} did not finish in the expected runtime state`, {
      transport,
      expected: {
        runtimeInitRuns: corpus.expected.runtimeInitRuns,
        liveIdentities: corpus.expected.liveIdentities,
      },
      actual: observation.runtime,
    });
  }
};

export const comparePhpConformanceResults = ({ corpus, native, phpWasm }) => {
  validateObservation(corpus, native, "native-zend");
  validateObservation(corpus, phpWasm, "php-wasm");
  const mismatch = differences(native, phpWasm);
  if (mismatch.length > 0) {
    fail("php-transport-semantic-mismatch", "native Zend and PHP-Wasm returned different public observations", {
      differences: mismatch,
    });
  }
  return Object.freeze({
    schemaVersion: 1,
    component: structuredClone(corpus.component),
    bindingIrSha256: corpus.bindingIrSha256,
    result: "passed",
    transports: ["native-zend", "php-wasm"],
    featureCoverage: structuredClone(corpus.featureCoverage),
    capabilityGaps: structuredClone(corpus.capabilityGaps),
    observationSha256: sha256(canonicalJson(native)),
    observation: structuredClone(native),
  });
};

export const generatePhpConformanceCorpus = ir => {
  const projection = compilePhpProjection(ir);
  const record = requireOne(projection.types.filter(type => type.projection === "value-object"), "copied record");
  const resource = requireOne(projection.types.filter(type => type.projection === "resource-object"), "identity resource");
  const callback = requireOne(projection.types.filter(type => type.projection === "invokable-object"), "callback type");
  const constructor = requireOne(projection.operations.filter(operation =>
    operation.public.kind === "constructor" && operation.result.type.binding === resource.id
  ), "resource constructor");
  const read = requireOne(projection.operations.filter(operation =>
    operation.public.kind === "method" &&
    operation.receiver?.type.binding === resource.id &&
    operation.parameters.length === 0 &&
    operation.result.type.kind === "primitive" &&
    operation.result.type.binding === "uint32" &&
    operation.failure.mode === "declared"
  ), "fallible resource read");
  const identity = requireOne(projection.operations.filter(operation =>
    operation.public.kind === "method" &&
    operation.receiver?.type.binding === resource.id &&
    operation.result.type.binding === resource.id &&
    operation.result.lifetime?.scope === "receiver"
  ), "canonical identity method");
  const copiedRoundTrip = requireOne(projection.operations.filter(operation =>
    operation.public.kind === "function" &&
    operation.parameters.length === 1 &&
    operation.parameters[0].type.binding === record.id &&
    operation.result.type.binding === record.id
  ), "copied-record function");
  const callbackCall = requireOne(projection.operations.filter(operation =>
    operation.public.kind === "function" &&
    operation.parameters.some(parameter => parameter.type.binding === callback.id) &&
    operation.failure.mode === "declared"
  ), "host-callback function");
  const closureFactory = requireOne(projection.operations.filter(operation =>
    operation.public.kind === "function" &&
    operation.result.type.binding === callback.id &&
    operation.result.ownership === "lease"
  ), "owned closure factory");
  if (constructor.parameters.length !== 1 || constructor.parameters[0].type.binding !== "uint32") {
    fail("unsupported-conformance-shape", "PHP conformance requires a one-argument UInt32 resource constructor");
  }
  const callbackParameter = callbackCall.parameters.find(parameter => parameter.type.binding === callback.id);
  const callbackValueParameter = callbackCall.parameters.find(parameter => parameter !== callbackParameter);
  if (callbackCall.parameters.length !== 2 || callbackValueParameter?.type.binding !== "uint32") {
    fail("unsupported-conformance-shape", "PHP conformance requires one UInt32 and one callback parameter");
  }
  if (closureFactory.parameters.length !== 1 || closureFactory.parameters[0].type.binding !== "uint32") {
    fail("unsupported-conformance-shape", "PHP conformance requires a one-argument UInt32 closure factory");
  }
  const callbackError = errorFor(projection, callbackCall.failure.errors[0]);
  const disposedError = errorFor(projection, read.failure.errors[0]);
  const namespace = projection.package.namespace;
  const recordArguments = record.fields.map(field => sampleExpression(field.type, namespace)).join(", ");
  const recordObservation = record.fields.map(field =>
    `        ${JSON.stringify(field.name)} => ${observationExpression("$payload", field)},`
  ).join("\n");
  const operationShape = projection.operations.map(operation => ({
    id: operation.id,
    public: operation.public,
    overloadKey: operation.overloadKey,
    specializations: operation.specializations,
  }));
  const typeShape = projection.types.map(type => ({
    id: type.id,
    fqcn: type.fqcn,
    projection: type.projection,
    readonly: type.readonly ?? null,
  }));
  const propertyOperations = projection.operations.filter(operation => operation.public.kind === "property");
  const genericSpecializations = projection.operations.flatMap(operation => operation.specializations.map(specialization => ({
    operation: operation.id,
    specialization,
  })));
  const featureCoverage = {
    copiedValues: true,
    objectIdentity: true,
    callbacks: true,
    returnedClosures: true,
    declaredExceptions: true,
    initialization: true,
    deterministicCleanup: true,
    staleIdentityRejection: true,
    reflection: true,
    documentation: true,
    assurance: true,
    properties: propertyOperations.length > 0,
    genericSpecializations: genericSpecializations.length > 0,
  };
  const capabilityGaps = [
    ...(!featureCoverage.properties ? [{ feature: "properties", reason: "The current Binding IR fixture declares no property operation." }] : []),
    ...(!featureCoverage.genericSpecializations ? [{ feature: "generic-specializations", reason: "The current Binding IR fixture declares no finite generic specialization." }] : []),
  ];

  const source = `<?php
$packageRoot = getenv('LEAN_BRIDGE_CONFORMANCE_PACKAGE_ROOT') ?: '/vendor';
$autoload = getenv('LEAN_BRIDGE_CONFORMANCE_AUTOLOAD') ?: $packageRoot . '/autoload.php';
require_once $autoload;

function lean_bridge_conformance_root_message(\\Throwable $error): string
{
    while ($error->getPrevious() !== null) $error = $error->getPrevious();
    return $error->getMessage();
}

$binding = json_decode(file_get_contents($packageRoot . '/binding-manifest.json'), true, flags: JSON_THROW_ON_ERROR);
$reflection = json_decode(file_get_contents($packageRoot . '/reflection.json'), true, flags: JSON_THROW_ON_ERROR);
$assurance = json_decode(file_get_contents($packageRoot . '/assurance.json'), true, flags: JSON_THROW_ON_ERROR);

$box = new ${phpClass(resource.fqcn)}(41);
$payload = ${phpFunction(copiedRoundTrip)}(new ${phpClass(record.fqcn)}(${recordArguments}));
$adder = ${phpFunction(closureFactory)}(2);
try {
    ${phpFunction(callbackCall)}(40, static function (int $value): int {
        throw new \\RuntimeException("parity callback failed at $value");
    });
    $callbackFailure = null;
} catch (${phpClass(callbackError.fqcn)} $error) {
    $callbackFailure = [$error::ID, lean_bridge_conformance_root_message($error)];
}
$identity = $box->${identity.public.name}() === $box;
$readValue = $box->${read.public.name}();
$callbackValue = ${phpFunction(callbackCall)}(40, static fn(int $value): int => $value);
$closureValue = $adder(40);
$box->${resource.closeMethod}();
try {
    $box->${read.public.name}();
    $closedFailure = null;
} catch (${phpClass(disposedError.fqcn)} $error) {
    $closedFailure = $error::ID;
}
$adder->${callback.closeMethod}();
$transport = ${phpClass(`${namespace}\\Internal\\Runtime`)}::transport();
$snapshot = method_exists($transport, 'runtimeSnapshot') ? $transport->runtimeSnapshot() : null;
$resourceReflection = new \\ReflectionClass(${phpClass(resource.fqcn)}::class);
$recordReflection = new \\ReflectionClass(${phpClass(record.fqcn)}::class);
$resourceMethods = array_map(static fn(\\ReflectionMethod $method): string => $method->getName(), $resourceReflection->getMethods(\\ReflectionMethod::IS_PUBLIC));
sort($resourceMethods);

echo json_encode([
    'bindingIrSha256' => $binding['bindingIrSha256'],
    'metadata' => [
        'reflectionSha256' => hash_file('sha256', $packageRoot . '/reflection.json'),
        'assuranceSha256' => hash_file('sha256', $packageRoot . '/assurance.json'),
        'documentationSha256' => hash_file('sha256', $packageRoot . '/README.md'),
        'reflectionComponent' => $reflection['component'],
        'assuranceComponent' => $assurance['component'],
    ],
    'reflection' => [
        'recordReadonly' => $recordReflection->isReadOnly(),
        'resourceMethods' => $resourceMethods,
        'types' => json_decode(${phpString(JSON.stringify(typeShape))}, true, flags: JSON_THROW_ON_ERROR),
        'operations' => json_decode(${phpString(JSON.stringify(operationShape))}, true, flags: JSON_THROW_ON_ERROR),
    ],
    'values' => [
        'resourceRead' => $readValue,
        'payload' => [
${recordObservation}
        ],
        'callback' => $callbackValue,
        'closure' => $closureValue,
    ],
    'identity' => $identity,
    'failures' => [
        'callback' => $callbackFailure,
        'closedResource' => $closedFailure,
    ],
    'runtime' => $snapshot === null ? null : [
        'runtimeInitRuns' => $snapshot['runtimeInitRuns'],
        'componentInitRuns' => $snapshot['componentInitRuns'],
        'liveIdentities' => $snapshot['liveIdentities'],
    ],
], JSON_THROW_ON_ERROR);
`;
  const manifest = {
    schemaVersion: 1,
    component: projection.component,
    bindingIrSha256: projection.bindingIrSha256,
    generator: { id: "lean-wasm/php-conformance", version: 1 },
    phpSourceSha256: sha256(source),
    featureCoverage,
    capabilityGaps,
    vectors: [
      { id: "copied-record", source: copiedRoundTrip.id, type: record.id },
      { id: "canonical-resource", source: identity.id, type: resource.id },
      { id: "host-callback", source: callbackCall.id, failure: callbackError.id },
      { id: "returned-closure", source: closureFactory.id, type: callback.id },
      { id: "closed-resource", source: read.id, failure: disposedError.id },
      { id: "metadata-identity", sources: ["binding-manifest.json", "reflection.json", "assurance.json", "README.md"] },
    ],
    reflection: { types: typeShape, operations: operationShape },
    expected: {
      bindingIrSha256: projection.bindingIrSha256,
      identity: true,
      declaredFailures: [callbackError.id, disposedError.id],
      runtimeInitRuns: 1,
      liveIdentities: 0,
    },
  };
  return Object.freeze({
    manifest: Object.freeze(structuredClone(manifest)),
    files: Object.freeze({
      "conformance.php": source,
      "conformance.json": canonicalJson(manifest),
    }),
  });
};
