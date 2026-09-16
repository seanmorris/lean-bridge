/**
 * Inspect real ecosystem archives independently of their packaging inventories.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { processBuildRunner } from "../../src/build/process-runner.mjs";
import { isSourceNotice } from "../../src/release/source-notices.mjs";

/**
 * Require root/dependency notice bytes in every component, never its runtime.
 *
 * @param t - Cleanup and diagnostic context.
 * @param root - Completed release root containing a package-set receipt.
 * @param expected - Distinct exact notice texts from the fixture's inputs.
 * @param metadataDeclared - Whether the fixture declares its own authors and URLs.
 */
export const assertPackagedSourceNotices = async (t, root, expected, metadataDeclared = false) => {
	const receipt = JSON.parse(await readFile(join(root, "package-set-receipt.json"), "utf8"));
	const run = async (command, args) => (await processBuildRunner.capture({ command, args })).stdout;
	for(const pkg of receipt.packages) for(const artifact of pkg.artifacts)
	{
		if(artifact.path.endsWith(".pom")) continue;
		let archive = join(root, artifact.path);
		if(archive.endsWith(".gem"))
		{
			const directory = await mkdtemp(join(tmpdir(), "lean-bridge-notice-gem-"));
			t.after(() => rm(directory, { recursive: true, force: true }));
			await run("tar", ["-xf", archive, "-C", directory, "data.tar.gz"]);
			archive = join(directory, "data.tar.gz");
		}
		const zip = /\.(?:zip|jar|nupkg|whl)$/.test(archive);
		const paths = (await run(zip ? "unzip" : "tar", zip ? ["-Z1", archive] : ["-tzf", archive])).trim().split("\n");
		const read = path => run(zip ? "unzip" : "tar", zip ? ["-p", archive, path] : ["-xOzf", archive, path]);
		const notices = paths.filter(path => isSourceNotice(path) || /\/source-notices\/[a-f0-9]{64}\.txt$/.test(path));
		const contents = await Promise.all(notices.map(read));
		for(const text of expected) assert.equal(contents.includes(text), pkg.role !== "runtime", `${pkg.target} ${pkg.role} ${artifact.path}: ${text.trim()}`);
		if(pkg.target === "cpan" && pkg.role === "component")
		{
			const metadata = JSON.parse(await read(paths.find(path => path.endsWith("/META.json"))));
			assert.deepEqual(metadata.license, ["unknown"]);
			if(!metadataDeclared)
			{
				assert.deepEqual(metadata.author, ["Author not declared"]);
				assert.equal(metadata.resources, undefined);
			}
		}
		if(pkg.target === "cargo") assert.doesNotMatch(await read(paths.find(path => path.endsWith("/Cargo.toml"))), /^license(?:-file)?\s*=/m);
	}
};
