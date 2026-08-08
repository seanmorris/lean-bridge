import test from "node:test";

import { inspectLeanLinkProfile } from "./helpers/lean-link-structure.mjs";

test("startup Lean side module imports the main memory, table, and runtime symbols", async () => {
  await inspectLeanLinkProfile({
    root: "build/lean-link-spike",
    profile: "startup",
    mainMemoryMode: "defined",
  });
});

test("lazy Lean side module imports the main memory, table, and runtime symbols", async () => {
  await inspectLeanLinkProfile({
    root: "build/lean-link-spike",
    profile: "lazy",
    mainMemoryMode: "defined",
  });
});
