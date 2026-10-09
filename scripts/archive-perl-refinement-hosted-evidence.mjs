/**
 * Archive the four bf89eff Perl corpus selections and exact producer snapshots without rewriting originals.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { sha256 } from "../src/capsule/node.mjs";
import { assertPerlRefinementArchive, perlRefinementConfigurations, perlRefinementCases, perlRefinementDirectory, perlRefinementOriginals, perlRefinementReceipt, perlRefinementRevision, perlRefinementSourcePaths, writePerlRefinementArtifact } from "../tests/helpers/perl-refinement-hosted-evidence.mjs";

const options = process.argv.slice(2);
assert.ok(options.every(option => option === "--check" || option.startsWith("--from=")), "Only --check and --from=<checkout holding the originals> are accepted");
assert.ok(options.filter(option => option.startsWith("--from=")).length <= 1);
const from = options.find(option => option.startsWith("--from="))?.slice("--from=".length) ?? ".";
const pending = new Map(), files = [], refinements = {};
const keep = (name, bytes, originalPath) => {
	const path = `${perlRefinementDirectory}/${name}`;
	assert.ok(!pending.has(path));
	pending.set(path, bytes);
	files.push({ path, originalPath, bytes: bytes.length, sha256: sha256(bytes) });
};
for(const configuration of perlRefinementConfigurations)
{
	const root = `${perlRefinementOriginals}/${configuration.name}`;
	for(const name of ["fetched-at.txt", "job.json", "job.log", "corpus-artifact.json", "abi-artifact.json"])
		keep(`${configuration.name}/${name}`, await readFile(join(from, root, name)), `${root}/${name}`);
	for(const kind of ["corpus", "abi"])
	{
		const metadata = JSON.parse(await readFile(join(from, root, `${kind}-artifact.json`)));
		const zip = await readFile(join(from, root, `${kind}.zip`));
		assert.equal(metadata.id, configuration[kind]);
		assert.equal(zip.length, metadata.size_in_bytes); assert.equal(`sha256:${sha256(zip)}`, metadata.digest);
	}
	const extract = (kind, member) => execFileSync("/usr/bin/unzip", ["-p", join(from, root, `${kind}.zip`), member], { maxBuffer: 8 * 1024 * 1024 });
	const member = `${configuration.name}/acceptance.json`;
	keep(`${configuration.name}/abi-acceptance.json`, extract("abi", member), `${root}/abi.zip!${member}`);
	for(const selected of perlRefinementCases)
	{
		const bytes = extract("corpus", selected.member);
		keep(`${configuration.name}/${selected.id}.json`, bytes, `${root}/corpus.zip!${selected.member}`);
		const tree = JSON.parse(bytes).reports[0].refinements, kind = selected.id === "reviewed-container" ? "container" : selected.id;
		if(refinements[kind]) assert.deepEqual(tree, refinements[kind]);
		else refinements[kind] = tree;
	}
}
for(const path of perlRefinementSourcePaths)
	keep(`source/${path}.source`, execFileSync("git", ["show", `${perlRefinementRevision}:${path}`], { maxBuffer: 8 * 1024 * 1024 }), `git:${perlRefinementRevision}:${path}`);
const receipt = perlRefinementReceipt(files, refinements);
await assertPerlRefinementArchive(receipt, async path => pending.get(path));
const bytes = Buffer.from(JSON.stringify(receipt, null, 2) + "\n");
if(!options.includes("--check"))
{
	for(const [path, bytes] of pending) await writePerlRefinementArtifact(path, bytes);
	await writePerlRefinementArtifact(`${perlRefinementDirectory}/receipt.json`, bytes);
}
process.stdout.write(`${options.includes("--check") ? "Validated" : "Archived"} 16 hosted reports, 24 provenance/context files and ${perlRefinementSourcePaths.length} exact Git source snapshots. Receipt SHA256 ${sha256(bytes)}\n`);
