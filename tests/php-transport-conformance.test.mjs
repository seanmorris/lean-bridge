/**
 * Tests the PHP transport conformance behavior.
 *
 * @file
 */

import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";

import { alpha } from "../poc/lean-link-spike/descriptors.mjs";
import {
	PhpConformanceError,
	comparePhpConformanceResults,
	generatePhpConformanceCorpus,
} from "../src/backends/php/conformance.mjs";

const run = promisify(execFile);

const observation = corpus => ({
	bindingIrSha256: corpus.bindingIrSha256
	, metadata: {
		reflectionSha256: "1".repeat(64)
		, assuranceSha256: "2".repeat(64)
		, documentationSha256: "3".repeat(64)
		, reflectionComponent: corpus.component.id
		, assuranceComponent: corpus.component.id
	}
	, reflection: corpus.reflection
	, values: {
		resourceRead: 41
		, payload: { enabled: true, count: 9, label: "parity", bytes: "007fff", values: [1, 5, 13] }
		, callback: 42
		, closure: 42
	}
	, identity: true
	, failures: {
		callback: ["error:callback-threw", "parity callback failed at 41"]
		, closedResource: "error:disposed-resource"
	}
	, runtime: { runtimeInitRuns: 1, componentInitRuns: 1, liveIdentities: 0 }
});

test("Binding IR generates one transport-neutral PHP conformance corpus", async () => {
  const first = generatePhpConformanceCorpus(alpha.bindingIr);
  const second = generatePhpConformanceCorpus(alpha.bindingIr);
  assert.deepEqual(second, first);
  assert.equal(first.manifest.bindingIrSha256, alpha.bindingIrSha256);
  assert.equal(first.manifest.featureCoverage.copiedValues, true);
  assert.equal(first.manifest.featureCoverage.objectIdentity, true);
  assert.equal(first.manifest.featureCoverage.callbacks, true);
  assert.equal(first.manifest.featureCoverage.returnedClosures, true);
  assert.equal(first.manifest.featureCoverage.declaredExceptions, true);
  assert.equal(first.manifest.featureCoverage.properties, false);
  assert.equal(first.manifest.featureCoverage.genericSpecializations, false);
  assert.deepEqual(first.manifest.capabilityGaps.map(gap => gap.feature), [
    "properties"
    , "generic-specializations"
  ]);
  assert.doesNotMatch(first.files["conformance.php"], /NativeTransport|PHP-Wasm|Wasm URL|\bccall\b|\bcwrap\b/);
  assert.match(first.files["conformance.php"], /LEAN_BRIDGE_CONFORMANCE_AUTOLOAD/);
  assert.match(first.files["conformance.php"], /reflection\.json/);
  assert.match(first.files["conformance.php"], /assurance\.json/);

  await mkdir("build", { recursive: true });
  const directory = await mkdtemp(join(process.cwd(), "build/php-conformance-test-"));
  try
{
    const path = join(directory, "conformance.php");
    await writeFile(path, first.files["conformance.php"]);
    const { stdout, stderr } = await run("php", ["-l", path]);
    assert.equal(stderr, "");
    assert.match(stdout, /No syntax errors detected/);
} finally
{
    await rm(directory, { recursive: true, force: true });
}
});

test("PHP conformance comparison rejects undocumented transport differences", () => {
  const { manifest } = generatePhpConformanceCorpus(alpha.bindingIr);
  const native = observation(manifest);
  const phpWasm = structuredClone(native);
  const report = comparePhpConformanceResults({ corpus: manifest, native, phpWasm });
  assert.equal(report.result, "passed");
  assert.deepEqual(report.transports, ["native-zend", "php-wasm"]);

  phpWasm.values.callback = 41;
  assert.throws(
    () => comparePhpConformanceResults({ corpus: manifest, native, phpWasm }),
    error =>
      error instanceof PhpConformanceError
      && error.code === "php-transport-semantic-mismatch"
      && error.details.differences.some(difference => difference.path === "result.values.callback"),
  );
});
