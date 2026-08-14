/**
 * Tests the managed artifacts behavior.
 *
 * @file
 */

import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";

const run = promisify(execFile);
const dotnet = process.env.LEAN_BRIDGE_DOTNET;
const javac = process.env.LEAN_BRIDGE_JAVAC;

test("canonical .NET and JVM compiler outputs are reproducible", { skip: !dotnet || !javac }, async () => {
  const root = await mkdtemp(join(tmpdir(), "lean-bridge-managed-artifact-test-"));
  const outputs = [join(root, "first"), join(root, "second")];
  for(const output of outputs)
{
    await run("node", [
      "scripts/build-managed-binding-artifacts.mjs"
      , "--output", output
      , "--dotnet", dotnet
      , "--javac", javac
    ], { maxBuffer: 32 * 1024 * 1024 });
}
  const manifests = await Promise.all(outputs.map(output => readFile(join(output, "managed-artifacts.json"), "utf8").then(JSON.parse)));
  assert.deepEqual(manifests[0], manifests[1]);
  assert.deepEqual(manifests[0].files.map(file => file.path), [
    "dotnet/lib/net8.0/LeanBridge.Alpha.dll"
    , "dotnet/lib/net8.0/LeanBridge.Alpha.xml"
    , "jvm/classes/org/leanbridge/alpha/Alpha.class"
    , "jvm/classes/org/leanbridge/alpha/Box.class"
    , "jvm/classes/org/leanbridge/alpha/CallbackThrewException.class"
    , "jvm/classes/org/leanbridge/alpha/DisposedResourceException.class"
    , "jvm/classes/org/leanbridge/alpha/LeanBridgeException.class"
    , "jvm/classes/org/leanbridge/alpha/OwnedTransform.class"
    , "jvm/classes/org/leanbridge/alpha/Payload.class"
    , "jvm/classes/org/leanbridge/alpha/Runtime.class"
    , "jvm/classes/org/leanbridge/alpha/Runtime$BoxState.class"
    , "jvm/classes/org/leanbridge/alpha/Runtime$CallbackState.class"
    , "jvm/classes/org/leanbridge/alpha/Runtime$NativeAssets.class"
    , "jvm/classes/org/leanbridge/alpha/Runtime$ResourceCleanup.class"
    , "jvm/classes/org/leanbridge/alpha/Runtime$TransformAddress.class"
    , "jvm/classes/org/leanbridge/alpha/Runtime$TransformState.class"
    , "jvm/classes/org/leanbridge/alpha/Transform.class"
  ]);
  for(const output of outputs) assert.deepEqual((await readdir(output)).sort(), ["dotnet", "jvm", "managed-artifacts.json"]);
});
