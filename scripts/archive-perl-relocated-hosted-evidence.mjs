/**
 * Archive the four 93c60a0 relocated Perl corpus selections and exact producer snapshots without rewriting originals.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { sha256 } from "../src/capsule/node.mjs";
import { perlRefinementCases } from "../tests/helpers/perl-refinement-hosted-evidence.mjs";
import { assertPerlRelocatedArchive, perlRelocatedConfigurations, perlRelocatedDirectory, perlRelocatedOriginals, perlRelocatedReceipt, perlRelocatedRevision, perlRelocatedSourcePaths, writePerlRelocatedArtifact } from "../tests/helpers/perl-relocated-hosted-evidence.mjs";

const options = process.argv.slice(2);
assert.ok(options.every(option => option === "--check" || option.startsWith("--from=")), "Only --check and --from=<checkout holding the originals> are accepted");
assert.ok(options.filter(option => option.startsWith("--from=")).length <= 1);
const from = options.find(option => option.startsWith("--from="))?.slice("--from=".length) ?? ".";
const pending = new Map(), files = [];
const keep = (name, bytes, originalPath) => {
	const path = `${perlRelocatedDirectory}/${name}`;
	assert.ok(!pending.has(path));
	pending.set(path, bytes);
	files.push({ path, originalPath, bytes: bytes.length, sha256: sha256(bytes) });
};
// The corpus download kept its GitHub names; the archive uses the earlier archive's names.
const downloaded = { corpus: { zip: "artifact.zip", metadata: "artifact.json" }, abi: { zip: "abi.zip", metadata: "abi-artifact.json" } };
for(const configuration of perlRelocatedConfigurations)
{
	const root = `${perlRelocatedOriginals}/${configuration.name}`;
	for(const [name, original] of [["fetched-at.txt", "fetched-at.txt"], ["job.json", "job.json"], ["job.log", "job.log"], ["corpus-artifact.json", downloaded.corpus.metadata], ["abi-artifact.json", downloaded.abi.metadata]])
		keep(`${configuration.name}/${name}`, await readFile(join(from, root, original)), `${root}/${original}`);
	for(const kind of ["corpus", "abi"])
	{
		const metadata = JSON.parse(await readFile(join(from, root, downloaded[kind].metadata)));
		const zip = await readFile(join(from, root, downloaded[kind].zip));
		assert.equal(metadata.id, configuration[kind]);
		assert.equal(zip.length, metadata.size_in_bytes); assert.equal(`sha256:${sha256(zip)}`, metadata.digest);
	}
	const extract = (kind, member) => execFileSync("/usr/bin/unzip", ["-p", join(from, root, downloaded[kind].zip), member], { maxBuffer: 8 * 1024 * 1024 });
	const member = `${configuration.name}/acceptance.json`;
	keep(`${configuration.name}/abi-acceptance.json`, extract("abi", member), `${root}/${downloaded.abi.zip}!${member}`);
	for(const selected of perlRefinementCases)
		keep(`${configuration.name}/${selected.id}.json`, extract("corpus", selected.member), `${root}/${downloaded.corpus.zip}!${selected.member}`);
}
for(const path of perlRelocatedSourcePaths)
	keep(`source/${path}.source`, execFileSync("git", ["show", `${perlRelocatedRevision}:${path}`], { maxBuffer: 8 * 1024 * 1024 }), `git:${perlRelocatedRevision}:${path}`);
const receipt = perlRelocatedReceipt(files);
await assertPerlRelocatedArchive(receipt, async path => pending.get(path) ?? readFile(path));
const bytes = Buffer.from(JSON.stringify(receipt, null, 2) + "\n");
if(!options.includes("--check"))
{
	for(const [path, bytes] of pending) await writePerlRelocatedArtifact(path, bytes);
	await writePerlRelocatedArtifact(`${perlRelocatedDirectory}/receipt.json`, bytes);
}
process.stdout.write(`${options.includes("--check") ? "Validated" : "Archived"} 16 relocated hosted reports, 24 provenance/context files and ${perlRelocatedSourcePaths.length} exact Git source snapshots. Receipt SHA256 ${sha256(bytes)}\n`);
