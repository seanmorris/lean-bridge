#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = resolve(projectRoot, "poc/performance/library-manifest.json");
const outputDirectory = resolve(projectRoot, "build/performance-wasm");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.components)) {
  throw new Error("performance library manifest must use schema version 1");
}

const identifiers = new Map();
for (const [index, component] of manifest.components.entries()) {
  identifiers.set(component.id, `component${index}`);
}

const descriptorLines = manifest.components.map(component => {
  const dependencies = component.dependencies.map(id => {
    const identifier = identifiers.get(id);
    if (!identifier) throw new Error(`${component.id} has unknown dependency ${id}`);
    return identifier;
  });
  return `const ${identifiers.get(component.id)} = Object.freeze({\n  id: ${JSON.stringify(component.id)},\n  artifact: ${JSON.stringify(component.artifact)},\n  runtimeRoot: ${JSON.stringify(component.runtimeRoot)},\n  dependencies: Object.freeze([${dependencies.join(", ")}]),\n  bindings: Object.freeze(${JSON.stringify(component.bindings)}),\n});`;
});

const moduleSource = `// Generated from poc/performance/library-manifest.json. Do not edit.\nimport { createPerformanceLibraryLoader } from "../../poc/performance/runtime.mjs";\n\n${descriptorLines.join("\n")}\n\nexport const descriptors = Object.freeze([${[...identifiers.values()].join(", ")}]);\nexport const createLibraries = module => createPerformanceLibraryLoader(module, descriptors);\n`;

const types = `// Generated from poc/performance/library-manifest.json. Do not edit.\nexport interface Point { readonly id: number; readonly coordinates: readonly number[] | Int32Array; }\nexport interface NearestResult { readonly pointId: number; readonly coordinates: Int32Array; readonly squaredDistance: bigint; }\nexport interface RangeChecksum { readonly pointIds: Uint32Array; readonly checksum: bigint; }\nexport interface SpatialIndex {\n  readonly disposed: boolean;\n  readonly size: number;\n  nearest(query: readonly number[] | Int32Array): NearestResult;\n  range(minimum: readonly number[] | Int32Array, maximum: readonly number[] | Int32Array): Uint32Array;\n  insert(point: Point): number;\n  dispose(): boolean;\n}\nexport interface SpatialIndexConstructor { new (dimensions: 2 | 4 | 8, points: readonly Point[]): SpatialIndex; }\nexport interface OrderedSearch { lowerBound(points: readonly Point[], query: readonly number[] | Int32Array): number; }\nexport interface SpatialIndexLibrary { SpatialIndex: SpatialIndexConstructor; }\nexport interface SpatialConsumer { rangeChecksum(index: SpatialIndex, minimum: readonly number[] | Int32Array, maximum: readonly number[] | Int32Array): RangeChecksum; }\nexport interface Libraries {\n  load(name: "ordered-search" | "performance/ordered-search" | "performance/ordered-search@1.0.0"): Promise<OrderedSearch>;\n  load(name: "spatial-index" | "performance/spatial-index" | "performance/spatial-index@1.0.0"): Promise<SpatialIndexLibrary>;\n  load(name: "spatial-consumer" | "performance/spatial-consumer" | "performance/spatial-consumer@1.0.0"): Promise<SpatialConsumer>;\n  shutdown(): boolean;\n}\nexport declare const createLibraries: (module: object) => Libraries;\n`;

await mkdir(outputDirectory, { recursive: true });
await writeFile(resolve(outputDirectory, "bindings.mjs"), moduleSource);
await writeFile(resolve(outputDirectory, "bindings.d.ts"), types);
