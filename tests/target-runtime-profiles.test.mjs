/**
 * Tests the target runtime profiles behavior.
 *
 * @file
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
	TargetRuntimeProfileError,
	readTargetRuntimeProfiles,
	targetRuntimeAcceptanceIds,
	validateTargetRuntimeProfiles,
} from "../src/adoption/target-runtime-profiles.mjs";

test("managed runtime profiles share one closed native execution contract", async () => {
  const contract = await readTargetRuntimeProfiles();
  const schema = JSON.parse(await readFile("schema/target-runtime-profiles.schema.json", "utf8"));
  assert.equal(schema.$id, "urn:lean-bridge:schema:target-runtime-profiles:v1");
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.$defs.profile.additionalProperties, false);
  assert.deepEqual(contract.profiles.map(profile => profile.id), ["dotnet", "jvm", "ruby"]);
  assert.equal(contract.boundary.transport, "generated-c");
  assert.equal(contract.boundary.runtimeScope, "process");
  assert.equal(contract.boundary.sharedRuntime, true);
  assert.equal(contract.boundary.compileOnce, true);
  assert.deepEqual(contract.acceptance.map(item => item.id), [...targetRuntimeAcceptanceIds]);
  for(const profile of contract.profiles)
{
    assert.deepEqual(profile.supportedFeatures, contract.profiles[0].supportedFeatures);
    assert.equal(profile.package.scriptsDisabled, true);
    assert.ok(profile.capabilityGaps.every(gap => !profile.supportedFeatures.includes(gap.feature)));
}
});

test("profiles select host-native private FFI without changing the public boundary", async () => {
  const contract = await readTargetRuntimeProfiles();
  const dotnet = contract.profiles.find(profile => profile.id === "dotnet");
  const jvm = contract.profiles.find(profile => profile.id === "jvm");
  const ruby = contract.profiles.find(profile => profile.id === "ruby");
  assert.equal(dotnet.interop, "library-import");
  assert.ok(dotnet.privateMechanisms.includes("System.Runtime.InteropServices.LibraryImport"));
  assert.ok(dotnet.forbiddenMechanisms.includes("public IntPtr"));
  assert.equal(jvm.interop, "foreign-function-and-memory");
  assert.ok(jvm.privateMechanisms.includes("java.lang.foreign.Linker"));
  assert.ok(jvm.forbiddenMechanisms.includes("JNI"));
  assert.equal(ruby.interop, "fiddle");
  assert.ok(ruby.privateMechanisms.includes("Fiddle::Function"));
  assert.ok(ruby.forbiddenMechanisms.includes("native extension build"));
});

test("validator rejects boundary, package, and capability drift", async () => {
  const contract = await readTargetRuntimeProfiles();
  for(const mutate of [
    value => { value.boundary.runtimeScope = "component"; }
    , value => { value.profiles[0].package.scriptsDisabled = false; }
    , value => { value.profiles[1].forbiddenMechanisms = value.profiles[1].forbiddenMechanisms.filter(item => item !== "JNI"); }
    , value => { value.profiles[2].capabilityGaps[0].feature = "direct-functions"; }
    , value => { value.profiles[0].unreviewed = true; }
  ]) {
    const changed = structuredClone(contract);
    mutate(changed);
    assert.throws(
      () => validateTargetRuntimeProfiles(changed),
      error => error instanceof TargetRuntimeProfileError,
    );
  }
});
