import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
	PerformanceCorpusError,
	hashPerformanceCorpus,
	runPerformanceCorpusVectors,
	validatePerformanceCorpus,
} from "../src/performance/corpus.mjs";

const corpus = JSON.parse(await readFile("poc/performance/corpus.v1.json", "utf8"));

const clone = value => structuredClone(value);

test("the performance corpus schema is closed and uses draft 2020-12", async () => {
  const schema = JSON.parse(await readFile("schema/performance-corpus.schema.json", "utf8"));
  assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.$defs.interface.additionalProperties, false);
  assert.equal(schema.$defs.dataset.additionalProperties, false);
  assert.equal(schema.$defs.step.additionalProperties, false);
});

test("the canonical spatial corpus has one stable reviewed identity", () => {
  assert.equal(validatePerformanceCorpus(corpus), corpus);
  assert.equal(
    hashPerformanceCorpus(corpus),
    "baa4108733e6c8949bd4874a93f3a467487e5e8796fce4d0226f1de7634612ef",
  );
  assert.deepEqual(corpus.dimensions, [2, 4, 8]);
});

test("all frozen correctness, mutation, handoff, and disposal vectors execute", () => {
  const report = runPerformanceCorpusVectors(corpus);
  assert.equal(report.sha256, hashPerformanceCorpus(corpus));
  assert.deepEqual(
    report.vectors.map(vector => `${vector.dataset}/${vector.vector}`),
    [
      "duplicates-2d/lower-bound-duplicate-order"
      , "duplicates-2d/resource-mutation-handoff-disposal"
      , "ordered-4d/fixed-dimension-query"
      , "ordered-8d/dimension-eight-query"
    ],
  );
  const lifecycle = report.vectors[1].observations;
  assert.deepEqual(lifecycle.at(-3).actual, { released: true });
  assert.deepEqual(lifecycle.at(-2).actual, { released: false });
  assert.deepEqual(lifecycle.at(-1).actual, { error: "disposed-resource" });
  assert.deepEqual(lifecycle[6].actual, { pointIds: [11, 12, 13, 14, 16], checksum: 66 });
});

test("complexity is either evidence-scoped or explicitly unknown", () => {
  const evidence = new Map(corpus.evidence.map(item => [item.id, item]));
  for(const interface_ of corpus.interfaces)
{
    for(const metric of Object.values(interface_.complexity))
{
      if(metric.state === "unknown")
{
        assert.equal(metric.bound, null);
        assert.equal(metric.evidence, null);
} else
{
        assert.equal(typeof metric.bound, "string");
        assert.ok(evidence.has(metric.evidence));
}
}
}
  assert.equal(evidence.get("evidence:lower-bound-control-flow").state, "asserted");
  assert.equal(evidence.get("evidence:lower-bound-control-flow").theorem, null);

  const drift = clone(corpus);
  drift.interfaces[1].complexity.time.bound = "O(log n)";
  assert.throws(
    () => validatePerformanceCorpus(drift),
    error => error instanceof PerformanceCorpusError && error.code === "unknown-complexity-has-claim",
  );
});

test("the contract rejects semantic and correctness-vector drift", () => {
  const unsorted = clone(corpus);
  [unsorted.datasets[0].initialPoints[0], unsorted.datasets[0].initialPoints[1]]
    = [unsorted.datasets[0].initialPoints[1], unsorted.datasets[0].initialPoints[0]];
  assert.throws(
    () => validatePerformanceCorpus(unsorted),
    error => error instanceof PerformanceCorpusError && error.code === "unsorted-points",
  );

  const wrongDimension = clone(corpus);
  wrongDimension.datasets[2].vectors[0].steps[0].arguments.query.pop();
  assert.throws(
    () => validatePerformanceCorpus(wrongDimension),
    error => error instanceof PerformanceCorpusError && error.code === "dimension-mismatch",
  );

  const changedAnswer = clone(corpus);
  changedAnswer.datasets[0].vectors[0].steps[3].expected.index = 4;
  assert.throws(
    () => runPerformanceCorpusVectors(changedAnswer),
    error => error instanceof PerformanceCorpusError && error.code === "vector-mismatch",
  );
});

test("two independent components declare one borrowed resource handoff", () => {
  const producer = corpus.components.find(item => item.id === "performance/spatial-index@1.0.0");
  const consumer = corpus.components.find(item => item.id === "performance/spatial-consumer@1.0.0");
  const handoff = corpus.interfaces.find(item => item.id === "consumer-range-checksum");
  const resource = corpus.resources.find(item => item.id === "spatial-index");

  assert.ok(producer.provides.includes(resource.id));
  assert.ok(consumer.requires.includes(resource.id));
  assert.equal(producer.runtime, "shared-application-runtime");
  assert.equal(consumer.runtime, "shared-application-runtime");
  assert.equal(handoff.parameters[0].type, resource.id);
  assert.equal(handoff.parameters[0].ownership, "borrow");
  assert.equal(resource.aliases, "canonical");
  assert.equal(resource.disposal, "required-idempotent");
});
