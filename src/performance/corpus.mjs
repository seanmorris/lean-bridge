import { canonicalizeJsonValue } from "../binding-ir/canonical.mjs";
import { sha256Text } from "../binding-ir/sha256.mjs";

export class PerformanceCorpusError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "PerformanceCorpusError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

const fail = (code, message, details = {}) => {
  throw new PerformanceCorpusError(code, message, details);
};

const isObject = value => value !== null && typeof value === "object" && !Array.isArray(value);

const exactKeys = (value, required, optional, path) => {
  if (!isObject(value)) fail("invalid-type", `${path} must be an object`, { path });
  const allowed = new Set([...required, ...optional]);
  const missing = required.filter(key => !(key in value));
  const unknown = Object.keys(value).filter(key => !allowed.has(key));
  if (missing.length !== 0 || unknown.length !== 0) {
    fail("closed-contract", `${path} has missing or unknown fields`, { path, missing, unknown });
  }
};

const string = (value, path) => {
  if (typeof value !== "string" || value.length === 0) {
    fail("invalid-string", `${path} must be a non-empty string`, { path, actual: value });
  }
  return value;
};

const integer = (value, path, minimum = Number.MIN_SAFE_INTEGER, maximum = Number.MAX_SAFE_INTEGER) => {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    fail("invalid-integer", `${path} must be an integer from ${minimum} through ${maximum}`, {
      path,
      actual: value,
    });
  }
  return value;
};

const array = (value, path, minimum = 0) => {
  if (!Array.isArray(value) || value.length < minimum) {
    fail("invalid-array", `${path} must contain at least ${minimum} items`, { path });
  }
  return value;
};

const oneOf = (value, allowed, path) => {
  if (!allowed.has(value)) {
    fail("invalid-enum", `${path} must be one of ${[...allowed].join(", ")}`, { path, actual: value });
  }
  return value;
};

const uniqueIds = (values, path) => {
  const seen = new Set();
  for (const [index, value] of values.entries()) {
    string(value.id, `${path}[${index}].id`);
    if (seen.has(value.id)) fail("duplicate-id", `${path} contains duplicate ${value.id}`, { path, id: value.id });
    seen.add(value.id);
  }
};

const compareCoordinates = (left, right) => {
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return left[index] - right[index];
  }
  return 0;
};

const comparePoints = (left, right) => compareCoordinates(left.coordinates, right.coordinates) || left.id - right.id;

const validatePoint = (point, path, { dimensions, minimum, maximum }) => {
  exactKeys(point, ["id", "coordinates"], [], path);
  integer(point.id, `${path}.id`, 0, 0xffff_ffff);
  array(point.coordinates, `${path}.coordinates`);
  if (point.coordinates.length !== dimensions) {
    fail("dimension-mismatch", `${path}.coordinates must contain ${dimensions} values`, {
      path: `${path}.coordinates`,
      expected: dimensions,
      actual: point.coordinates.length,
    });
  }
  point.coordinates.forEach((coordinate, index) =>
    integer(coordinate, `${path}.coordinates[${index}]`, minimum, maximum));
};

const validateComplexityMetric = (metric, path, evidence) => {
  exactKeys(metric, ["state", "bound", "evidence"], [], path);
  oneOf(metric.state, new Set(["proved", "asserted", "unknown"]), `${path}.state`);
  if (metric.state === "unknown") {
    if (metric.bound !== null || metric.evidence !== null) {
      fail("unknown-complexity-has-claim", `${path} cannot attach a bound or evidence while unknown`, { path });
    }
    return;
  }
  string(metric.bound, `${path}.bound`);
  string(metric.evidence, `${path}.evidence`);
  const record = evidence.get(metric.evidence);
  if (!record) fail("missing-evidence", `${path} references absent evidence ${metric.evidence}`, { path });
  if (metric.state === "proved" && (record.state !== "proved" || record.theorem === null)) {
    fail("unproved-complexity", `${path} claims a proof without a theorem-backed evidence record`, { path });
  }
};

const validateInterface = (item, path, evidence) => {
  exactKeys(item, [
    "id", "component", "kind", "owner", "mutability", "parameters", "result",
    "preconditions", "postconditions", "failures", "complexity",
  ], [], path);
  string(item.id, `${path}.id`);
  string(item.component, `${path}.component`);
  oneOf(item.kind, new Set(["function", "constructor", "method", "lifecycle"]), `${path}.kind`);
  if (item.owner !== null) string(item.owner, `${path}.owner`);
  oneOf(item.mutability, new Set(["pure", "read", "write", "lifecycle"]), `${path}.mutability`);
  array(item.parameters, `${path}.parameters`);
  item.parameters.forEach((parameter, index) => {
    const parameterPath = `${path}.parameters[${index}]`;
    exactKeys(parameter, ["name", "type", "ownership"], [], parameterPath);
    string(parameter.name, `${parameterPath}.name`);
    string(parameter.type, `${parameterPath}.type`);
    oneOf(parameter.ownership, new Set(["copy", "borrow", "own"]), `${parameterPath}.ownership`);
  });
  exactKeys(item.result, ["type", "ownership"], [], `${path}.result`);
  string(item.result.type, `${path}.result.type`);
  oneOf(item.result.ownership, new Set(["copy", "own", "none"]), `${path}.result.ownership`);
  for (const field of ["preconditions", "postconditions", "failures"]) {
    array(item[field], `${path}.${field}`);
    item[field].forEach((value, index) => string(value, `${path}.${field}[${index}]`));
  }
  exactKeys(item.complexity, ["time", "auxiliarySpace"], [], `${path}.complexity`);
  validateComplexityMetric(item.complexity.time, `${path}.complexity.time`, evidence);
  validateComplexityMetric(item.complexity.auxiliarySpace, `${path}.complexity.auxiliarySpace`, evidence);
};

const validateEvidence = (item, path) => {
  exactKeys(item, ["id", "state", "scope", "basis", "theorem"], [], path);
  string(item.id, `${path}.id`);
  oneOf(item.state, new Set(["proved", "asserted", "tested", "unknown"]), `${path}.state`);
  string(item.scope, `${path}.scope`);
  string(item.basis, `${path}.basis`);
  if (item.theorem !== null) string(item.theorem, `${path}.theorem`);
  if (item.state === "proved" && item.theorem === null) {
    fail("missing-theorem", `${path} is proved but names no theorem`, { path });
  }
  if (item.state !== "proved" && item.theorem !== null) {
    fail("misleading-theorem", `${path} names a theorem without proved state`, { path });
  }
};

const validateCoordinates = (coordinates, path, options) => {
  array(coordinates, path);
  if (coordinates.length !== options.dimensions) {
    fail("dimension-mismatch", `${path} must contain ${options.dimensions} values`, {
      path,
      expected: options.dimensions,
      actual: coordinates.length,
    });
  }
  coordinates.forEach((coordinate, index) =>
    integer(coordinate, `${path}[${index}]`, options.minimum, options.maximum));
};

const validateStep = (step, path, interfaces, pointOptions) => {
  exactKeys(step, ["call", "arguments", "expected"], [], path);
  string(step.call, `${path}.call`);
  if (!interfaces.has(step.call)) fail("unknown-operation", `${path} calls unknown ${step.call}`, { path });
  if (!isObject(step.arguments)) fail("invalid-type", `${path}.arguments must be an object`, { path });
  if (!isObject(step.expected)) fail("invalid-type", `${path}.expected must be an object`, { path });
  if (new Set(["point-lower-bound", "index-nearest"]).has(step.call)) {
    exactKeys(step.arguments, ["query"], [], `${path}.arguments`);
    validateCoordinates(step.arguments.query, `${path}.arguments.query`, pointOptions);
  } else if (new Set(["index-range", "consumer-range-checksum"]).has(step.call)) {
    exactKeys(step.arguments, ["minimum", "maximum"], [], `${path}.arguments`);
    validateCoordinates(step.arguments.minimum, `${path}.arguments.minimum`, pointOptions);
    validateCoordinates(step.arguments.maximum, `${path}.arguments.maximum`, pointOptions);
    if (step.arguments.minimum.some((value, index) => value > step.arguments.maximum[index])) {
      fail("invalid-range", `${path}.arguments minimum must not exceed maximum`, { path });
    }
  } else if (step.call === "index-insert") {
    exactKeys(step.arguments, ["point"], [], `${path}.arguments`);
    validatePoint(step.arguments.point, `${path}.arguments.point`, pointOptions);
  } else {
    exactKeys(step.arguments, [], [], `${path}.arguments`);
  }
};

export const validatePerformanceCorpus = value => {
  exactKeys(value, [
    "schemaVersion", "id", "version", "coordinate", "dimensions", "ordering",
    "evidence", "interfaces", "resources", "components", "datasets",
  ], [], "corpus");
  if (value.schemaVersion !== 1) fail("unsupported-schema", "corpus.schemaVersion must be 1");
  string(value.id, "corpus.id");
  string(value.version, "corpus.version");
  if (!/^\d+\.\d+\.\d+$/.test(value.version)) fail("invalid-version", "corpus.version must be semantic");

  exactKeys(value.coordinate, ["type", "minimum", "maximum"], [], "corpus.coordinate");
  if (value.coordinate.type !== "int32") fail("unsupported-coordinate", "corpus.coordinate.type must be int32");
  integer(value.coordinate.minimum, "corpus.coordinate.minimum", -0x8000_0000, 0x7fff_ffff);
  integer(value.coordinate.maximum, "corpus.coordinate.maximum", value.coordinate.minimum, 0x7fff_ffff);

  array(value.dimensions, "corpus.dimensions", 1);
  const dimensions = new Set();
  value.dimensions.forEach((dimension, index) => {
    integer(dimension, `corpus.dimensions[${index}]`, 1, 32);
    if (dimensions.has(dimension)) fail("duplicate-dimension", `corpus.dimensions contains duplicate ${dimension}`);
    dimensions.add(dimension);
  });

  exactKeys(value.ordering, ["points", "duplicates", "queryResults", "nearestTies"], [], "corpus.ordering");
  if (
    value.ordering.points !== "coordinates-lexicographic-then-id" ||
    value.ordering.duplicates !== "first" ||
    value.ordering.queryResults !== "point-id-ascending" ||
    value.ordering.nearestTies !== "lowest-point-id"
  ) fail("unsupported-ordering", "corpus.ordering does not match the version 1 canonical order");

  array(value.evidence, "corpus.evidence", 1);
  value.evidence.forEach((item, index) => validateEvidence(item, `corpus.evidence[${index}]`));
  uniqueIds(value.evidence, "corpus.evidence");
  const evidence = new Map(value.evidence.map(item => [item.id, item]));

  array(value.interfaces, "corpus.interfaces", 1);
  value.interfaces.forEach((item, index) => validateInterface(item, `corpus.interfaces[${index}]`, evidence));
  uniqueIds(value.interfaces, "corpus.interfaces");
  const interfaces = new Map(value.interfaces.map(item => [item.id, item]));

  array(value.resources, "corpus.resources", 1);
  value.resources.forEach((resource, index) => {
    const path = `corpus.resources[${index}]`;
    exactKeys(resource, ["id", "identity", "mutability", "owns", "aliases", "disposal", "invariants"], [], path);
    string(resource.id, `${path}.id`);
    if (resource.identity !== "resource") fail("invalid-resource", `${path}.identity must be resource`);
    if (resource.mutability !== "mutable") fail("invalid-resource", `${path}.mutability must be mutable`);
    if (resource.owns !== "copied-points") fail("invalid-resource", `${path}.owns must be copied-points`);
    if (resource.aliases !== "canonical") fail("invalid-resource", `${path}.aliases must be canonical`);
    if (resource.disposal !== "required-idempotent") fail("invalid-resource", `${path}.disposal must be required-idempotent`);
    array(resource.invariants, `${path}.invariants`, 1).forEach((entry, itemIndex) =>
      string(entry, `${path}.invariants[${itemIndex}]`));
  });
  uniqueIds(value.resources, "corpus.resources");
  const resourceIds = new Set(value.resources.map(resource => resource.id));

  array(value.components, "corpus.components", 2);
  value.components.forEach((component, index) => {
    const path = `corpus.components[${index}]`;
    exactKeys(component, ["id", "role", "provides", "requires", "runtime"], [], path);
    string(component.id, `${path}.id`);
    string(component.role, `${path}.role`);
    array(component.provides, `${path}.provides`).forEach((entry, itemIndex) => string(entry, `${path}.provides[${itemIndex}]`));
    array(component.requires, `${path}.requires`).forEach((entry, itemIndex) => string(entry, `${path}.requires[${itemIndex}]`));
    if (component.runtime !== "shared-application-runtime") {
      fail("private-runtime", `${path}.runtime must be shared-application-runtime`, { path });
    }
  });
  uniqueIds(value.components, "corpus.components");
  const components = new Map(value.components.map(component => [component.id, component]));
  const provided = new Set(value.components.flatMap(component => component.provides));
  const knownContracts = new Set([...interfaces.keys(), ...resourceIds]);
  for (const [index, component] of value.components.entries()) {
    for (const [field, entries] of [["provides", component.provides], ["requires", component.requires]]) {
      if (new Set(entries).size !== entries.length) {
        fail("duplicate-contract", `corpus.components[${index}].${field} contains duplicate contracts`);
      }
      for (const entry of entries) {
        if (!knownContracts.has(entry)) {
          fail("unknown-contract", `corpus.components[${index}].${field} references unknown ${entry}`);
        }
        if (field === "requires" && !provided.has(entry)) {
          fail("unresolved-contract", `corpus.components[${index}] requires unprovided ${entry}`);
        }
      }
    }
  }
  for (const [index, interface_] of value.interfaces.entries()) {
    const component = components.get(interface_.component);
    if (!component || !component.provides.includes(interface_.id)) {
      fail("interface-provider-drift", `corpus.interfaces[${index}] is not provided by ${interface_.component}`);
    }
    if (interface_.owner !== null && !resourceIds.has(interface_.owner)) {
      fail("unknown-resource-owner", `corpus.interfaces[${index}] owns unknown ${interface_.owner}`);
    }
  }

  array(value.datasets, "corpus.datasets", 1);
  value.datasets.forEach((dataset, datasetIndex) => {
    const path = `corpus.datasets[${datasetIndex}]`;
    exactKeys(dataset, ["id", "dimensions", "initialPoints", "vectors"], [], path);
    string(dataset.id, `${path}.id`);
    integer(dataset.dimensions, `${path}.dimensions`, 1, 32);
    if (!dimensions.has(dataset.dimensions)) {
      fail("unsupported-dimension", `${path}.dimensions is not declared by the corpus`, { path });
    }
    array(dataset.initialPoints, `${path}.initialPoints`, 1);
    const pointOptions = {
      dimensions: dataset.dimensions,
      minimum: value.coordinate.minimum,
      maximum: value.coordinate.maximum,
    };
    dataset.initialPoints.forEach((point, pointIndex) =>
      validatePoint(point, `${path}.initialPoints[${pointIndex}]`, pointOptions));
    const pointIds = dataset.initialPoints.map(point => point.id);
    if (new Set(pointIds).size !== pointIds.length) fail("duplicate-point-id", `${path}.initialPoints contains duplicate IDs`);
    for (let index = 1; index < dataset.initialPoints.length; index += 1) {
      if (comparePoints(dataset.initialPoints[index - 1], dataset.initialPoints[index]) > 0) {
        fail("unsorted-points", `${path}.initialPoints must use canonical point order`, { path });
      }
    }
    array(dataset.vectors, `${path}.vectors`, 1);
    dataset.vectors.forEach((vector, vectorIndex) => {
      const vectorPath = `${path}.vectors[${vectorIndex}]`;
      exactKeys(vector, ["id", "steps"], [], vectorPath);
      string(vector.id, `${vectorPath}.id`);
      array(vector.steps, `${vectorPath}.steps`, 1).forEach((step, stepIndex) =>
        validateStep(step, `${vectorPath}.steps[${stepIndex}]`, interfaces, pointOptions));
    });
    uniqueIds(dataset.vectors, `${path}.vectors`);
  });
  uniqueIds(value.datasets, "corpus.datasets");
  return value;
};

export const hashPerformanceCorpus = value => {
  validatePerformanceCorpus(value);
  return sha256Text(canonicalizeJsonValue(value, "performanceCorpus"));
};

const clonePoints = points => points.map(point => ({ id: point.id, coordinates: [...point.coordinates] }));

const lowerBound = (points, query) => {
  let lower = 0;
  let upper = points.length;
  while (lower < upper) {
    const middle = lower + Math.floor((upper - lower) / 2);
    if (compareCoordinates(points[middle].coordinates, query) < 0) lower = middle + 1;
    else upper = middle;
  }
  return lower;
};

const inRange = (coordinates, minimum, maximum) => coordinates.every(
  (coordinate, index) => coordinate >= minimum[index] && coordinate <= maximum[index],
);

const squaredDistance = (left, right) => left.reduce((sum, coordinate, index) => {
  const difference = coordinate - right[index];
  return sum + difference * difference;
}, 0);

class ReferenceIndex {
  #points;
  #disposed = false;

  constructor(points) {
    this.#points = clonePoints(points);
  }

  #live() {
    if (this.#disposed) fail("disposed-resource", "the canonical index has been disposed");
  }

  size() {
    this.#live();
    return this.#points.length;
  }

  nearest(query) {
    this.#live();
    if (this.#points.length === 0) fail("empty-index", "nearest requires at least one point");
    const ordered = this.#points.map(point => ({ point, distance: squaredDistance(point.coordinates, query) }))
      .sort((left, right) => left.distance - right.distance || left.point.id - right.point.id);
    const result = ordered[0];
    return { pointId: result.point.id, coordinates: [...result.point.coordinates], squaredDistance: result.distance };
  }

  range(minimum, maximum) {
    this.#live();
    return this.#points.filter(point => inRange(point.coordinates, minimum, maximum))
      .map(point => point.id)
      .sort((left, right) => left - right);
  }

  insert(point) {
    this.#live();
    if (this.#points.some(candidate => candidate.id === point.id)) {
      fail("duplicate-point-id", `point ID ${point.id} already exists`);
    }
    this.#points.push({ id: point.id, coordinates: [...point.coordinates] });
    this.#points.sort(comparePoints);
    return this.#points.length;
  }

  dispose() {
    if (this.#disposed) return false;
    this.#disposed = true;
    this.#points = [];
    return true;
  }
}

const executeStep = (dataset, state, step) => {
  if (step.call === "point-lower-bound") {
    return { index: lowerBound(dataset.initialPoints, step.arguments.query) };
  }
  if (step.call === "index-build") {
    state.index = new ReferenceIndex(dataset.initialPoints);
    return { size: state.index.size() };
  }
  if (!state.index) fail("missing-index", `${step.call} requires index-build first`);
  if (step.call === "index-nearest") return state.index.nearest(step.arguments.query);
  if (step.call === "index-range") return { pointIds: state.index.range(step.arguments.minimum, step.arguments.maximum) };
  if (step.call === "index-insert") return { size: state.index.insert(step.arguments.point) };
  if (step.call === "index-size") return { size: state.index.size() };
  if (step.call === "consumer-range-checksum") {
    const pointIds = state.index.range(step.arguments.minimum, step.arguments.maximum);
    return { pointIds, checksum: pointIds.reduce((sum, id) => sum + id, 0) };
  }
  if (step.call === "index-dispose") return { released: state.index.dispose() };
  fail("unknown-operation", `the reference runner cannot execute ${step.call}`);
};

const observedStep = (dataset, state, step) => {
  try {
    return executeStep(dataset, state, step);
  } catch (error) {
    if (!(error instanceof PerformanceCorpusError)) throw error;
    return { error: error.code };
  }
};

export const runPerformanceCorpusVectors = value => {
  const corpus = validatePerformanceCorpus(value);
  const vectors = [];
  for (const dataset of corpus.datasets) {
    for (const vector of dataset.vectors) {
      const state = { index: null };
      const observations = vector.steps.map((step, stepIndex) => {
        const actual = observedStep(dataset, state, step);
        if (canonicalizeJsonValue(actual) !== canonicalizeJsonValue(step.expected)) {
          fail("vector-mismatch", `${dataset.id}/${vector.id} step ${stepIndex} produced the wrong result`, {
            dataset: dataset.id,
            vector: vector.id,
            step: stepIndex,
            expected: step.expected,
            actual,
          });
        }
        return Object.freeze({ call: step.call, actual: Object.freeze(actual) });
      });
      vectors.push(Object.freeze({ dataset: dataset.id, vector: vector.id, observations: Object.freeze(observations) }));
    }
  }
  return Object.freeze({
    corpus: `${corpus.id}@${corpus.version}`,
    sha256: hashPerformanceCorpus(corpus),
    vectors: Object.freeze(vectors),
  });
};
