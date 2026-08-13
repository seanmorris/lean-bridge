import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { buildMavenPackage } from "../src/release/maven-package.mjs";
import { buildNugetPackage } from "../src/release/nuget-package.mjs";
import { buildRubyGemsPackage } from "../src/release/rubygems-package.mjs";
import { buildUniversalReleaseBundle } from "../src/release/universal-release-bundle.mjs";

const revision = "ee22db2b1a8ab6360c79d22f574b2bcc17bb909d";
const dotnet = process.env.LEAN_BRIDGE_DOTNET;
const javac = process.env.LEAN_BRIDGE_JAVAC;
const managed = process.env.LEAN_BRIDGE_MANAGED_ARTIFACTS;
const native = process.env.LEAN_BRIDGE_NATIVE_ARTIFACTS ?? "build/native-ffi-artifacts";

test("managed registry packages fail closed without compiled managed artifacts", async () => {
  const scratch = await mkdtemp(join(tmpdir(), "lean-bridge-managed-package-closed-"));
  try {
    const bundle = join(scratch, "bundle");
    await buildUniversalReleaseBundle({ projectRoot: process.cwd(), coreRoot: "build/lean-link-spike", outputRoot: bundle, revision, sourceDateEpoch: 1786261809 });
    for (const [ecosystem, build] of [["nuget", buildNugetPackage], ["maven", buildMavenPackage], ["rubygems", buildRubyGemsPackage]]) {
      await assert.rejects(build({ bundleRoot: bundle, outputRoot: join(scratch, ecosystem) }), error => error.code === "package-ineligible");
    }
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
});

test("eligible NuGet, Maven, and RubyGem projections are byte-identical", { skip: !managed }, async () => {
  const scratch = await mkdtemp(join(tmpdir(), "lean-bridge-managed-package-"));
  try {
    const bundle = join(scratch, "bundle");
    await buildUniversalReleaseBundle({ projectRoot: process.cwd(), coreRoot: "build/lean-link-spike", nativeRoot: native, managedRoot: managed, outputRoot: bundle, revision, sourceDateEpoch: 1786261809 });
    for (const [ecosystem, build, archive] of [
      ["nuget", buildNugetPackage, result => result.archive],
      ["maven", buildMavenPackage, result => result.jar],
      ["rubygems", buildRubyGemsPackage, result => result.archive],
    ]) {
      const first = await build({ bundleRoot: bundle, outputRoot: join(scratch, `${ecosystem}-first`) });
      const second = await build({ bundleRoot: bundle, outputRoot: join(scratch, `${ecosystem}-second`) });
      assert.deepEqual(await readFile(archive(first)), await readFile(archive(second)), ecosystem);
      assert.ok(first.coreArtifacts.length >= 2, ecosystem);
      assert.ok(first.coreArtifacts.every(item => item.sourceSha256 === item.packageSha256), ecosystem);
    }
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
});

test("managed compiler environment is either complete or absent", () => {
  assert.equal(Boolean(dotnet), Boolean(javac));
});
