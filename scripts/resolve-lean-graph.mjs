#!/usr/bin/env node

import { resolve } from "node:path";

import { CapsuleContractError } from "../src/capsule/contract.mjs";
import { canonicalJson, readLockedGraph } from "../src/capsule/node.mjs";

const option = (name, fallback) => {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1];
};

const lockPath = resolve(option("--lock", "poc/lean-link-spike/graph-lock.json"));
const profile = option("--profile", "side-lazy");
const format = option("--format", "json");

try {
  const graph = await readLockedGraph({ lockPath, profile });
  if (format === "modules") {
    process.stdout.write(`${graph.libraries.map(library => library.build.module).join("\n")}\n`);
  } else if (format === "ids") {
    process.stdout.write(`${graph.order.join("\n")}\n`);
  } else if (format === "json") {
    process.stdout.write(
      canonicalJson({
        schemaVersion: graph.schemaVersion,
        graphId: graph.graphId,
        profile: graph.profile,
        roots: graph.roots,
        libraries: graph.libraries.map(library => ({
          id: library.id,
          sha256: library.sha256,
          module: library.build.module,
          dependencies: library.build.dependencies,
          artifacts: library.capsule.artifacts,
          symbols: library.capsule.symbols,
          initializer: library.capsule.initializer,
        })),
      }),
    );
  } else {
    throw new CapsuleContractError("invalid-format", `Unknown output format ${format}`, {
      actual: format,
      expected: ["json", "modules", "ids"],
    });
  }
} catch (error) {
  if (error instanceof CapsuleContractError) {
    process.stderr.write(`${error.code}: ${error.message}\n`);
    process.stderr.write(`${JSON.stringify(error.details)}\n`);
    process.exitCode = 1;
  } else {
    throw error;
  }
}
