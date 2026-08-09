import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";

import createModule from "../build/performance-wasm/main.mjs";
import { createLibraries } from "../build/performance-wasm/bindings.mjs";

const points2d = [
  { id: 10, coordinates: [-3, 4] },
  { id: 11, coordinates: [0, 0] },
  { id: 12, coordinates: [0, 7] },
  { id: 13, coordinates: [2, -1] },
  { id: 14, coordinates: [2, -1] },
  { id: 15, coordinates: [9, 9] },
];

const assertNativeSurface = (api, expected) => {
  assert.equal(Object.isFrozen(api), true);
  assert.deepEqual(Object.keys(api), expected);
  assert.equal(Object.keys(api).some(name => name.startsWith("_")), false);
  assert.equal("ccall" in api, false);
};

test("generated performance bindings load native callables lazily", async () => {
  const module = await createModule();
  const libraries = createLibraries(module);

  assert.equal(libraries.loaded.size, 0);
  const ordered = await libraries.load("ordered-search");
  assertNativeSurface(ordered, ["lowerBound"]);
  assert.equal(libraries.loaded.size, 1);
  assert.equal(await libraries.load("performance/ordered-search"), ordered);
  assert.equal(ordered.lowerBound(points2d, [-4, 99]), 0);
  assert.equal(ordered.lowerBound(points2d, [0, 0]), 1);
  assert.equal(ordered.lowerBound(points2d, [1, 0]), 3);
  assert.equal(ordered.lowerBound(points2d, [2, -1]), 3);
  assert.equal(ordered.lowerBound(points2d, [10, 0]), 6);
  assert.deepEqual(libraries.diagnostics(), {
    runtimeState: 1,
    runtimeInitializations: 1,
    libraryInitializations: 1,
    liveResources: 0,
    rejectedHandles: 0,
  });
  assert.equal(libraries.shutdown(), true);
});

test("independent spatial components share one runtime and resource identity", async () => {
  const module = await createModule();
  const libraries = createLibraries(module);
  const spatial = await libraries.load("spatial-index");
  assertNativeSurface(spatial, ["SpatialIndex"]);
  assert.equal(libraries.loaded.size, 2);

  const index = new spatial.SpatialIndex(2, points2d);
  assert.equal("handle" in index, false);
  assert.equal("token" in index, false);
  assert.equal(index.size, 6);
  assert.deepEqual(index.nearest([1, 0]), {
    pointId: 11,
    coordinates: new Int32Array([0, 0]),
    squaredDistance: 1n,
  });
  assert.deepEqual(index.nearest([2, -1]), {
    pointId: 13,
    coordinates: new Int32Array([2, -1]),
    squaredDistance: 0n,
  });
  assert.deepEqual(
    index.range([0, -1], [2, 7]),
    new Uint32Array([11, 12, 13, 14]),
  );
  assert.equal(index.insert({ id: 16, coordinates: [1, 1] }), 7);
  assert.equal(index.size, 7);
  assert.equal(index.nearest([1, 1]).pointId, 16);

  const consumer = await libraries.load("spatial-consumer");
  assertNativeSurface(consumer, ["rangeChecksum"]);
  assert.deepEqual(consumer.rangeChecksum(index, [0, -1], [2, 7]), {
    pointIds: new Uint32Array([11, 12, 13, 14, 16]),
    checksum: 66n,
  });
  assert.deepEqual(libraries.diagnostics(), {
    runtimeState: 1,
    runtimeInitializations: 1,
    libraryInitializations: 3,
    liveResources: 1,
    rejectedHandles: 0,
  });

  assert.equal(index.dispose(), true);
  assert.equal(index.dispose(), false);
  assert.equal(index.disposed, true);
  assert.throws(
    () => index.size,
    error => error.code === "disposed-resource",
  );
  assert.equal(libraries.diagnostics().liveResources, 0);
  assert.equal(libraries.shutdown(), true);
});

test("generated bindings preserve 4D and 8D typed values", async () => {
  for (const fixture of [
    {
      dimensions: 4,
      points: [
        { id: 100, coordinates: [-1, -1, -1, -1] },
        { id: 101, coordinates: [0, 0, 0, 0] },
        { id: 102, coordinates: [0, 0, 0, 1] },
        { id: 103, coordinates: [4, 3, 2, 1] },
      ],
      query: [1, 1, 1, 1],
      nearest: { id: 102, coordinates: [0, 0, 0, 1], distance: 3n },
      minimum: [0, 0, 0, 0],
      maximum: [4, 3, 2, 1],
      range: [101, 102, 103],
    },
    {
      dimensions: 8,
      points: [
        { id: 200, coordinates: [0, 0, 0, 0, 0, 0, 0, 0] },
        { id: 201, coordinates: [1, 1, 1, 1, 1, 1, 1, 1] },
        { id: 202, coordinates: [2, 2, 2, 2, 2, 2, 2, 2] },
      ],
      query: [1, 1, 1, 1, 1, 1, 1, 1],
      nearest: { id: 201, coordinates: [1, 1, 1, 1, 1, 1, 1, 1], distance: 0n },
      minimum: [0, 0, 0, 0, 0, 0, 0, 0],
      maximum: [1, 1, 1, 1, 1, 1, 1, 1],
      range: [200, 201],
    },
  ]) {
    const module = await createModule();
    const libraries = createLibraries(module);
    const { SpatialIndex } = await libraries.load("spatial-index");
    const index = new SpatialIndex(fixture.dimensions, fixture.points);
    const nearest = index.nearest(fixture.query);
    assert.equal(nearest.pointId, fixture.nearest.id);
    assert.deepEqual(nearest.coordinates, new Int32Array(fixture.nearest.coordinates));
    assert.equal(nearest.squaredDistance, fixture.nearest.distance);
    assert.deepEqual(
      index.range(fixture.minimum, fixture.maximum),
      new Uint32Array(fixture.range),
    );
    index.dispose();
    assert.equal(libraries.shutdown(), true);
  }
});

test("resources cannot cross independently instantiated runtimes", async () => {
  const firstModule = await createModule();
  const secondModule = await createModule();
  const firstLibraries = createLibraries(firstModule);
  const secondLibraries = createLibraries(secondModule);
  const firstSpatial = await firstLibraries.load("spatial-index");
  const secondConsumer = await secondLibraries.load("spatial-consumer");
  const index = new firstSpatial.SpatialIndex(2, points2d);

  assert.throws(
    () => secondConsumer.rangeChecksum(index, [0, -1], [2, 7]),
    error => error.code === "cross-runtime-resource",
  );
  index.dispose();
  assert.equal(firstLibraries.shutdown(), true);
  assert.equal(secondLibraries.shutdown(), true);
});

test("side modules import one shared memory and resolve inter-library symbols", async () => {
  const manifest = await readFile(
    "build/performance-wasm/audit/main-export-manifest.txt",
    "utf8",
  );
  assert.doesNotMatch(manifest, /l_LeanBridge_Performance_comparePoint/);
  assert.doesNotMatch(manifest, /lean_bridge_performance_index_range/);

  const orderedDump = execFileSync(
    "wasm-objdump",
    ["-x", "build/performance-wasm/ordered-search.so.wasm"],
    { encoding: "utf8" },
  );
  const indexDump = execFileSync(
    "wasm-objdump",
    ["-x", "build/performance-wasm/spatial-index.so.wasm"],
    { encoding: "utf8" },
  );
  const consumerDump = execFileSync(
    "wasm-objdump",
    ["-x", "build/performance-wasm/spatial-consumer.so.wasm"],
    { encoding: "utf8" },
  );
  for (const dump of [orderedDump, indexDump, consumerDump]) {
    assert.match(dump, /memory\[0\].*<- env\.memory/);
    assert.match(dump, /table\[0\].*<- env\.__indirect_function_table/);
    assert.doesNotMatch(dump, /Memory\[/);
  }
  assert.match(indexDump, /env\.l_LeanBridge_Performance_comparePoint/);
  assert.match(orderedDump, /-> "l_LeanBridge_Performance_comparePoint"/);
  assert.match(consumerDump, /env\.lean_bridge_performance_index_range/);
  assert.match(indexDump, /-> "lean_bridge_performance_index_range"/);
});
