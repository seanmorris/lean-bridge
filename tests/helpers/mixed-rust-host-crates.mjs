/** @file Add installed host crates to the synchronous IO + task Cargo consumer. */
import assert from "node:assert/strict";
import { copyFile, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { sha256 } from "../../src/capsule/node.mjs";
import { readVerifiedPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";

/**
 * Check the actual provider archive, not just its version, before adding a
 * component. Exercise the task peer both before and after closing the hosts.
 *
 * @param root - Independently built and retained Rust host releases.
 * @param runtime - Verified synchronous IO runtime package record.
 * @param src - Downstream application's private source directory.
 * @param unpack - Extract a verified archive into the installation.
 */
export const addMixedRustHosts = async (root, runtime, src, unpack) => {
	const lines = [], packages = [], receipts = [];
	for(const [route, name] of [["ordinary", "workshop"], ["peer", "peer"]])
	{
		const dir = join(root, route), receiptPath = join(dir, "package-set-receipt.json");
		const { receipt, result } = await readVerifiedPackageSetReceipt({ receiptPath });
		assert.deepEqual(result.profiles, ["native-rust-host-v1"]); assert.equal(receipt.packages.length, 2);
		const component = receipt.packages.find(p => p.role === "component"), shared = receipt.packages.find(p => p.role === "runtime");
		assert.equal(component.name, name);
		for(const key of ["name", "version", "runtimeIdentity", "artifacts"]) assert.deepEqual(shared[key], runtime[key]);
		const path = await unpack(component, dir, name);
		lines.push(name + "={path=" + JSON.stringify(path) + "}"); packages.push(component); receipts.push(result.receiptSha256);
	}
	const fixture = "tests/fixtures/rust-host-members/archives.rs";
	await copyFile(join(src, "main.rs"), join(src, "resources.rs")); await copyFile(fixture, join(src, "hosts.rs"));
	const entry = 'mod resources { include!("resources.rs"); pub fn run() { main(); } }\nmod hosts { include!("hosts.rs"); pub fn run() { main(); } }\nfn main() { resources::run(); hosts::run(); resources::run(); }\n';
	await writeFile(join(src, "main.rs"), entry);
	return { dependencies: lines.join("\n") + "\n", packages, evidence: { receipts, fixtureSha256: sha256(await readFile(fixture)), entrySha256: sha256(entry) } };
};
