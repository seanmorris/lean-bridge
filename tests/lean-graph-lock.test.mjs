import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  alpha,
  beta,
  gamma,
} from "../poc/lean-link-spike/descriptors.mjs";

const digest = contents => createHash("sha256").update(contents).digest("hex");

test("one content-addressed graph drives dynamic and final-static composition", async () => {
  const graph = JSON.parse(
    await readFile("poc/lean-link-spike/graph-lock.json", "utf8"),
  );
  const descriptors = new Map(
    [alpha, beta, gamma].map(descriptor => [descriptor.id, descriptor]),
  );
  const positions = new Map(
    graph.libraries.map((library, index) => [library.id, index]),
  );

  assert.equal(graph.schemaVersion, 1);
  assert.equal(positions.size, graph.libraries.length);
  assert.deepEqual([...positions.keys()], [...descriptors.keys()]);

  for (const library of graph.libraries) {
    const descriptor = descriptors.get(library.id);
    assert.ok(descriptor, `missing descriptor for ${library.id}`);
    assert.deepEqual(
      descriptor.dependencies.map(dependency => dependency.id),
      library.dependencies,
    );
    assert.equal(
      descriptor.sideModule.pathname.endsWith(
        `/${library.module.toLowerCase()}.so.wasm`,
      ),
      true,
    );

    for (const dependency of library.dependencies) {
      assert.ok(
        positions.get(dependency) < positions.get(library.id),
        `${dependency} must precede ${library.id}`,
      );
    }

    for (const input of [library.source, library.shim]) {
      const contents = await readFile(`poc/lean-link-spike/${input.path}`);
      assert.equal(digest(contents), input.sha256, input.path);
    }
  }
});
