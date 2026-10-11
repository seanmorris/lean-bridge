/**
 * Explicitly synthetic Composer packages for real PHP installation guard controls.
 *
 * @file
 */
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { nativeArtifactPaths } from "../../src/build/native-artifacts.mjs";
import { createDeterministicZip } from "../../src/release/deterministic-zip.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

/**
 * Build a tiny real PHP package that also loads the exact offline Brick Math dependency.
 *
 * @param t - Running test context owning all created directories.
 */
export const finContainerEdgePhpFixture = async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-fin-edge-php-closure-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const payload = join(root, "payload"), name = "probe/api", version = "1.0.0";
	const metadata = { name, version, type: "library", license: "MIT"
		, require: { php: ">=8.2 <9", "ext-ffi": "*", "brick/math": "1.0.0" }
		, autoload: { files: ["src/Api.php"] } };
	await saveLakeFile(payload, "composer.json", canonicalJson(metadata));
	await saveLakeFile(payload, "src/Api.php", '<?php namespace Probe; function value() { return \\Brick\\Math\\BigInteger::of(1); }\n');
	const receipt = async () => {
		const files = {};
		for(const path of await nativeArtifactPaths(payload)) if(path !== "lean-bridge/package-receipt.json")
		{
			const bytes = await readFile(join(payload, path)); files[path] = { bytes: bytes.length, sha256: sha256(bytes) };
		}
		await saveLakeFile(payload, "lean-bridge/package-receipt.json", canonicalJson({ schemaVersion: 1
			, kind: "lean-bridge-ordinary-php-package", ecosystem: "composer"
			, name, version, files }));
	};
	await receipt();
	return { root, payload, metadata, receipt
		, pack: async label => {
			const handoff = join(root, `handoff-${label}`), bytes = await createDeterministicZip({ directory: payload, sourceDateEpoch: 315532800 });
			await saveLakeFile(handoff, "probe.zip", bytes);
			return { handoff, packages: [{ role: "component", name, version, artifacts: [{ path: "probe.zip", sha256: sha256(bytes) }] }] };
		}
	};
};
