/**
 * Tests the engine output comparison behavior.
 *
 * @file
 */

import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { compareComponentEngineOutputs, EngineOutputComparisonError } from "../src/build/engine-output-comparison.mjs";

const writeOutput = async ({ root, backend }) => {
	await mkdir(join(root, "bundle"), { recursive: true });
	const request = Buffer.from('{"kind":"request"}\n');
	await writeFile(join(root, "engine-execution-request.json"), request);
	await writeFile(join(root, "bundle", "component.wasm"), Buffer.from([0, 97, 115, 109]));
	await writeFile(join(root, "bundle", "metadata.json"), '{"sharedRuntime":true}\n');
	await writeFile(join(root, "engine-execution-report.json"), JSON.stringify({
		schemaVersion: 1
		, backend
		, requestSha256: "6721fbcbba2282b9a20a3ac6d5cd3c9a95de3d24f760ecf22aa7247f374a6a80"
		, engineIdentitySha256: "a".repeat(64)
		, bundleManifestSha256: "b".repeat(64)
		, bundleIdentitySha256: "c".repeat(64)
	}));
};

test("component engine output comparison permits only the backend report label", async () => {
  const scratch = await mkdtemp(join(tmpdir(), "lean-bridge-engine-compare-"));
  try
{
    const nativeRoot = join(scratch, "native");
    const dockerRoot = join(scratch, "docker");
    await writeOutput({ root: nativeRoot, backend: "native-nix" });
    await cp(nativeRoot, dockerRoot, { recursive: true });
    const dockerReport = JSON.parse(await readFile(join(dockerRoot, "engine-execution-report.json"), "utf8"));
    dockerReport.backend = "docker-nix";
    await writeFile(join(dockerRoot, "engine-execution-report.json"), JSON.stringify(dockerReport));
    const report = await compareComponentEngineOutputs({ nativeRoot, dockerRoot });
    assert.equal(report.status, "passed");
    assert.equal(report.comparedFileCount, 2);
    assert.equal(report.backendReportDifference, "backend-label-only");

    await writeFile(join(dockerRoot, "bundle", "metadata.json"), '{"sharedRuntime":false}\n');
    await assert.rejects(
      compareComponentEngineOutputs({ nativeRoot, dockerRoot }),
      error => error instanceof EngineOutputComparisonError && error.code === "engine-authorized-output-drift",
    );
} finally
{
    await rm(scratch, { recursive: true, force: true });
}
});
