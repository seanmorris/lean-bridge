import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
	alpha,
	beta,
	gamma,
} from "../poc/lean-link-spike/descriptors.mjs";
import { readLockedGraph } from "../src/capsule/node.mjs";
import { hashBindingIr } from "../src/binding-ir/canonical.mjs";

const digest = contents => createHash("sha256").update(contents).digest("hex");
const lockPath = "poc/lean-link-spike/graph-lock.json";

test("one content-addressed graph drives dynamic and final-static composition", async () => {
  const graph = JSON.parse(await readFile(lockPath, "utf8"));
  const descriptors = new Map(
    [alpha, beta, gamma].map(descriptor => [descriptor.id, descriptor]),
  );
  const positions = new Map(
    graph.libraries.map((library, index) => [library.id, index]),
  );

  assert.equal(graph.schemaVersion, 2);
  assert.equal(positions.size, graph.libraries.length);
  assert.deepEqual([...positions.keys()], [...descriptors.keys()]);

  for(const library of graph.libraries)
{
    const descriptor = descriptors.get(library.id);
    assert.ok(descriptor, `missing descriptor for ${library.id}`);
    assert.equal(descriptor.capsule.id, library.id);
    assert.equal(descriptor.buildHash, library.capsule.sha256);
    assert.deepEqual(
      descriptor.dependencies.map(dependency => dependency.id),
      library.dependencies.map(dependency => dependency.id),
    );
    assert.equal(
      descriptor.sideModule.pathname.endsWith(
        `/${library.module.toLowerCase()}.so.wasm`,
      ),
      true,
    );

    for(const dependency of library.dependencies)
{
      assert.ok(
        positions.get(dependency.id) < positions.get(library.id),
        `${dependency.id} must precede ${library.id}`,
      );
}

    for(const input of [library.capsule, library.source, library.shim, library.bindingIr].filter(Boolean))
{
      const contents = await readFile(`poc/lean-link-spike/${input.path}`);
      assert.equal(digest(contents), input.sha256, input.path);
}
    if(library.bindingIr)
{
      const bindingIr = JSON.parse(
        await readFile(`poc/lean-link-spike/${library.bindingIr.path}`, "utf8"),
      );
      assert.equal(hashBindingIr(bindingIr), library.bindingIr.semanticSha256);
      assert.equal(descriptor.bindingIrSha256, library.bindingIr.semanticSha256);
      assert.equal(descriptor.capsule.fragments.bindings, library.bindingIr.path);
}
}
});
test("startup, lazy, and final-static profiles resolve the same locked order", async () => {
  const profiles = await Promise.all(
    ["side-startup", "side-lazy", "final-static"].map(profile =>
      readLockedGraph({ lockPath, profile }),
    ),
  );
  for(const graph of profiles)
{
    assert.deepEqual(graph.order, [
      "poc/lean-alpha@0.0.0"
      , "poc/lean-beta@0.0.0"
      , "poc/lean-gamma@0.0.0"
    ]);
}

  const browserEvidence = await Promise.all(
    ["side-startup", "side-lazy", "final-static"].map(profile =>
      readFile(`build/lean-link-spike/audit/resolved-${profile}.json`, "utf8").then(JSON.parse),
    ),
  );
  assert.deepEqual(
    browserEvidence.map(graph => graph.libraries.map(library => library.id)),
    Array(3).fill([...profiles[0].order]),
  );
});
