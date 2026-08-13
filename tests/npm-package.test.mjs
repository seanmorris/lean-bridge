import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { buildNpmPackage } from "../src/release/npm-package.mjs";
import { buildUniversalReleaseBundle } from "../src/release/universal-release-bundle.mjs";

const execute = promisify(execFile);
const revision = "ee22db2b1a8ab6360c79d22f574b2bcc17bb909d";

const withBundle = async operation => {
	const scratch = await mkdtemp(join(tmpdir(), "lean-bridge-npm-package-"));
	try
	{
		const bundle = join(scratch, "bundle");
		await buildUniversalReleaseBundle({
			projectRoot: process.cwd()
			, coreRoot: "build/lean-link-spike"
			, outputRoot: bundle
			, revision
			, sourceDateEpoch: 1786261809
		});
		return await operation({ scratch, bundle });
	} finally
	{
		await rm(scratch, { recursive: true, force: true });
	}
};

test("npm projection is deterministic and preserves every compiled core byte", async () => withBundle(async ({ scratch, bundle }) => {
  const first = await buildNpmPackage({ bundleRoot: bundle, outputRoot: join(scratch, "first") });
  const second = await buildNpmPackage({ bundleRoot: bundle, outputRoot: join(scratch, "second") });
  assert.equal(first.archiveSha256, second.archiveSha256);
  assert.deepEqual(await readFile(first.archive), await readFile(second.archive));
  assert.equal(first.coreArtifacts.length, 3);
  for(const artifact of first.coreArtifacts)
{
    assert.equal(artifact.sourceSha256, artifact.packageSha256, artifact.packagePath);
    assert.deepEqual(
      await readFile(join(bundle, artifact.sourcePath)),
      await readFile(join(scratch, "first/package", artifact.packagePath)),
      artifact.packagePath,
    );
}

  const packageJson = JSON.parse(await readFile(join(scratch, "first/package/package.json"), "utf8"));
  assert.equal(packageJson.name, "@lean-bridge/alpha");
  assert.equal(packageJson.version, "0.0.0");
  assert.equal(packageJson.sideEffects, false);
  assert.equal("scripts" in packageJson, false);
  assert.deepEqual(Object.keys(packageJson.exports), ["."]);
  assert.equal(packageJson.exports["."].browser, "./index.mjs");
  const runtime = await readFile(join(scratch, "first/package/internal/runtime.mjs"), "utf8");
  assert.match(runtime, /new URL\("\.\/wasm\/main\.wasm", import\.meta\.url\)/);
  assert.match(runtime, /new URL\("\.\/wasm\/alpha\.so\.wasm", import\.meta\.url\)/);
}));

test("a clean npm consumer installs, imports, and calls the generated native surface", async () => withBundle(async ({ scratch, bundle }) => {
  const result = await buildNpmPackage({ bundleRoot: bundle, outputRoot: join(scratch, "release") });
  const consumer = join(scratch, "consumer.mjs");
  await execute("npm", ["init", "--yes"], { cwd: scratch });
  await execute("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund", result.archive], { cwd: scratch });
  const source = `
    import bindings, { Box, makeAdder, roundTrip, withCallback } from "@lean-bridge/alpha";
    const box = new Box(42);
    const identity = box.identity() === box;
    const value = box.read();
    box.dispose();
    const payload = roundTrip({
      enabled: true,
      count: 41,
      label: "Lean λ bridge",
      bytes: new Uint8Array([0, 127, 255]),
      values: [0, 0xffffffff],
    });
    const callback = withCallback(40, current => current);
    const addTwo = makeAdder(2);
    const closure = addTwo(40);
    addTwo.dispose();
    process.stdout.write(JSON.stringify({
      exports: Object.keys(bindings),
      value,
      identity,
      payload: { ...payload, bytes: [...payload.bytes] },
      callback,
      closure,
    }));
  `;
  await writeFile(consumer, source);
  const { stdout } = await execute("node", [consumer], { cwd: scratch });
  assert.deepEqual(JSON.parse(stdout), {
    exports: ["Box", "roundTrip", "withCallback", "makeAdder"]
    , value: 42
    , identity: true
    , payload: {
      enabled: false
      , count: 42
      , label: "Lean λ bridge"
      , bytes: [0, 127, 255]
      , values: [0, 0xffffffff]
    }
    , callback: 42
    , closure: 42
  });
  await assert.rejects(
    execute("node", ["--input-type=module", "-e", "import '@lean-bridge/alpha/internal/runtime.mjs'"], { cwd: scratch }),
    error => error.stderr.includes("ERR_PACKAGE_PATH_NOT_EXPORTED"),
  );
}));

test("npm projection rejects a changed canonical artifact before packaging", async () => withBundle(async ({ scratch, bundle }) => {
  const runtime = join(bundle, "artifacts/browser/runtime.wasm");
  const bytes = await readFile(runtime);
  bytes[0] ^= 0xff;
  await writeFile(runtime, bytes);
  await assert.rejects(
    buildNpmPackage({ bundleRoot: bundle, outputRoot: join(scratch, "rejected") }),
    /canonical bundle artifact changed: artifacts\/browser\/runtime\.wasm/,
  );
}));
