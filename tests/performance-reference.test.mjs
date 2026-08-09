import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("independent Lean performance components compile and execute corpus vectors", async () => {
  const output = execFileSync("bash", ["scripts/test-performance-reference.sh"], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" },
  });
  assert.match(output, /performance reference vectors passed/);

  const ordered = await readFile("build/performance-reference/ordered-search/OrderedSearch.c", "utf8");
  const index = await readFile("build/performance-reference/spatial-index/SpatialIndex.c", "utf8");
  const consumer = await readFile("build/performance-reference/spatial-consumer/SpatialConsumer.c", "utf8");

  assert.match(ordered, /lean_bridge_performance_point_lower_bound/);
  assert.match(index, /lean_bridge_performance_index_size/);
  assert.match(consumer, /lean_bridge_performance_index_range\(/);
  assert.doesNotMatch(ordered, /lean_initialize_runtime_module/);
  assert.doesNotMatch(index, /lean_initialize_runtime_module/);
  assert.doesNotMatch(consumer, /lean_initialize_runtime_module/);
});
