/**
 * One runtime coordinate must identify one archive across every npm builder.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { assembleComponentNpmRuntime } from "../src/release/component-npm-package.mjs";
import { createDeterministicTarGzFromFiles } from "../src/release/deterministic-archive.mjs";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";

const requirement = { kind: "content-addressed-peer", artifactIncluded: false
	, abiVersion: 1, leanCommit: "a".repeat(40), patchSetSha256: "b".repeat(64)
	, profile: "side-lazy", shared: true
	, requiredImports: ["memory", "__indirect_function_table"] };
const inputs = { mainModule: Buffer.from("prepared runtime bytes")
	, mainWasm: Buffer.from([0, 97, 115, 109, 1, 0, 0, 0]) };
const archive = runtime => createDeterministicTarGzFromFiles({ sourceDateEpoch: 1
	, files: [...runtime.files].map(([path, bytes]) => ({ path: `package/${path}`
		, bytes: Buffer.from(bytes), mode: 0o644 })) });

test("equivalent copied and owned runtime metadata produces identical npm bytes", async () => {
	const ordinary = await assembleComponentNpmRuntime({ ...inputs, runtimeRequirement: requirement });
	const restored = await assembleComponentNpmRuntime({ ...inputs, runtimeRequirement: JSON.parse(canonicalJson(requirement)) });
	const reversed = await assembleComponentNpmRuntime({ ...inputs, runtimeRequirement: Object.fromEntries(Object.entries(requirement).reverse()) });
	for(const other of [restored, reversed])
	{
		assert.equal(other.version, ordinary.version);
		assert.equal(other.runtimeIdentity, ordinary.runtimeIdentity);
		assert.deepEqual(other.files, ordinary.files, "One coordinate must identify exactly the same files");
		assert.deepEqual(archive(other), archive(ordinary));
	}
	const metadata = JSON.parse(ordinary.files.get("package.json"));
	assert.equal(ordinary.files.get("package.json"), canonicalJson(metadata));
	assert.equal(metadata.leanBridge.runtimeIdentity, sha256(ordinary.files.get("runtime-identity.json")));
});

test("runtime metadata and binary changes retain distinct content-addressed coordinates", async () => {
	const original = await assembleComponentNpmRuntime({ ...inputs, runtimeRequirement: requirement });
	const variants = [{ mainModule: Buffer.from("changed runtime") }
		, { mainWasm: Buffer.from("changed binary") }
		, { runtimeRequirement: { ...requirement, patchSetSha256: "c".repeat(64) } }];
	for(const override of variants)
	{
		const changed = await assembleComponentNpmRuntime({ ...inputs, runtimeRequirement: requirement, ...override });
		assert.notEqual(changed.version, original.version);
		assert.notEqual(sha256(archive(changed)), sha256(archive(original)));
	}
});
