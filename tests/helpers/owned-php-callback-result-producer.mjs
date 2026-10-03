/**
 * Build genuine no-host PHP through an independently installed native-build API.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { pathToFileURL } from "node:url";

const [cliRoot, project, output, leanPrefix] = process.argv.slice(2);
assert.equal(process.argv.length, 6);
for(const path of [cliRoot, project, output, leanPrefix]) assert.ok(isAbsolute(path));
const imported = path => import(pathToFileURL(join(cliRoot, path)).href);
const { canonicalJson } = await imported("src/capsule/node.mjs");
const { buildNativeComponent, buildNativeSharedRuntime } = await imported("src/build/native-component.mjs");
const { projectOwnedPhp } = await imported("src/build/owned-php-projection.mjs");
const { writeNativePackageSet } = await imported("src/release/package-set-assembly.mjs");
const configuration = JSON.parse(await readFile(join(project, "lean-bridge.exports.json"), "utf8"));
assert.deepEqual(Object.keys(configuration.targets), ["php-native"]);
const capabilities = { ownedGraphs: true, ownedHostCallbacks: false
	, ownedInputTransfers: false, ownedAnchoredResults: false
	, ownedReceiverExports: false, ownedCallbackResultAnchors: true };
const runtimeRoot = join(output, "native/runtime"), nativeRoot = join(output, "native/component");
await buildNativeSharedRuntime({ outputRoot: runtimeRoot, leanPrefix });
const native = await buildNativeComponent({ projectRoot: project
	, outputRoot: nativeRoot
	, runtimeRoot, leanPrefix, targets: ["php-native"], ...capabilities });
assert.equal(Boolean(native.model.ownedGraph.hostCallbacks), false);
const built = await projectOwnedPhp({ working: output, nativeRoot, runtimeRoot
	, leanPrefix, settings: configuration.targets["php-native"]
	, environment: process.env });
await writeNativePackageSet({ root: output, model: native.model
	, runtimeIdentity: native.receipt.runtimeIdentity, projections: [built] });
process.stdout.write(canonicalJson({ status: "ok"
	, producerInterface: "native-build-api"
	, capabilities, result: { targets: ["php-native"], ...built } }));
