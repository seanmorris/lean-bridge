#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = resolve(projectRoot, "poc/performance/scale/graph.v1.json");
const outputRoot = resolve(projectRoot, "build/performance-scale");
const generatedRoot = resolve(outputRoot, "generated");
const specification = JSON.parse(await readFile(sourcePath, "utf8"));

if(
	specification.schemaVersion !== 1
  || specification.maximumLibraries !== 50
  || specification.dependencyShape !== "linear-chain"
  || JSON.stringify(specification.graphCounts) !== JSON.stringify([1, 3, 10, 50])
) {
	throw new Error("the performance scaling graph must define the reviewed 1, 3, 10, and 50-library chain");
}

const pad = ordinal => String(ordinal).padStart(3, "0");
const components = [];
await mkdir(generatedRoot, { recursive: true });

for(let ordinal = 1; ordinal <= specification.maximumLibraries; ordinal += 1)
{
	const suffix = pad(ordinal);
	const name = `scale-${suffix}`;
	const moduleName = `Scale${suffix}`;
	const id = `${specification.component.idPrefix}${suffix}@${specification.component.version}`;
	const previous = ordinal === 1
		? []
		: [`${specification.component.idPrefix}${pad(ordinal - 1)}@${specification.component.version}`];
	const symbol = `lean_bridge_scale_${suffix}_ping`;
	const initializer = `initialize_${moduleName}`;
	const artifact = `${name}${specification.component.artifactSuffix}`;
	const leanSource = `namespace LeanBridge.Performance.${moduleName}\n\n@[export ${symbol}]\ndef ping (value : UInt32) : UInt32 := value + ${ordinal}\n\nend LeanBridge.Performance.${moduleName}\n`;
	const shimSource = `#include <lean/lean.h>\n#include <stdint.h>\n\ntypedef uint32_t (*scale_ping_fn)(uint32_t);\ntypedef lean_object *(*scale_initializer_fn)(uint8_t);\n\nextern uint32_t ${symbol}(uint32_t);\nextern lean_object *${initializer}(uint8_t);\nextern void bridge_scale_register(uint32_t, scale_ping_fn, scale_initializer_fn);\n\n__attribute__((constructor))\nstatic void bridge_scale_${suffix}_register(void) {\n  bridge_scale_register(${ordinal}, ${symbol}, ${initializer});\n}\n`;
	await writeFile(resolve(generatedRoot, `${moduleName}.lean`), leanSource);
	await writeFile(resolve(generatedRoot, `${name}_shim.c`), shimSource);
	components.push(Object.freeze({
		ordinal
		, name
		, moduleName
		, id
		, artifact
		, dependencies: previous
		, binding: Object.freeze({ name: "ping", input: "uint32", output: "uint32" })
		, expectedDelta: ordinal
		, symbols: Object.freeze({ callable: symbol, initializer })
	}));
}

const manifest = Object.freeze({
	schemaVersion: 1
	, graphCounts: Object.freeze([...specification.graphCounts])
	, dependencyShape: specification.dependencyShape
	, resultRule: specification.component.resultRule
	, components: Object.freeze(components)
});
await writeFile(resolve(outputRoot, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

const descriptors = components.map(component => `Object.freeze(${JSON.stringify({
	ordinal: component.ordinal
	, name: component.name
	, id: component.id
	, artifact: component.artifact
	, dependencies: component.dependencies
	, expectedDelta: component.expectedDelta
})})`);
const bindings = `// Generated from poc/performance/scale/graph.v1.json. Do not edit.\nimport { createScaleLibraryLoader, resolveScaleGraph } from "../../poc/performance/scale/runtime.mjs";\n\nexport const descriptors = Object.freeze([\n  ${descriptors.join(",\n  ")}\n]);\nexport const descriptorsForCount = count => Object.freeze(descriptors.slice(0, count));\nexport const resolveLibraries = (count, requested) => resolveScaleGraph(descriptorsForCount(count), requested);\nexport const createLibraries = (module, count, options) => createScaleLibraryLoader(module, descriptorsForCount(count), options);\nexport const createIsolatedLibrary = (module, descriptor) => createScaleLibraryLoader(module, [Object.freeze({ ...descriptor, dependencies: Object.freeze([]) })]);\n`;
const types = `// Generated from poc/performance/scale/graph.v1.json. Do not edit.
export interface ScaleLibrary { ping(value: number): number; }
export interface ScaleLoader {
  load(name: string): Promise<ScaleLibrary>;
  resolve(name: string): readonly object[];
  measurements(): readonly object[];
  diagnostics(): object;
  shutdown(): boolean;
}
export declare const descriptors: readonly object[];
export declare const descriptorsForCount: (count: 1 | 3 | 10 | 50) => readonly object[];
export declare const createLibraries: (module: object, count: 1 | 3 | 10 | 50, options?: { readonly prelinked?: readonly string[] }) => ScaleLoader;
export declare const createIsolatedLibrary: (module: object, descriptor: object) => ScaleLoader;
`;
await writeFile(resolve(outputRoot, "bindings.mjs"), bindings);
await writeFile(resolve(outputRoot, "bindings.d.ts"), types);

process.stdout.write(`Generated ${components.length} Lean scaling components in ${generatedRoot}\n`);
