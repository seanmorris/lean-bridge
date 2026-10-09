/**
 * Preserve the four hosted Perl XS scalar Fin captures at 046ced0 and their selected producer sources. The
 * captures are read only; each extracted report is taken again from its original ZIP by the strict reader.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { sha256 } from "../src/capsule/node.mjs";
import { strictArtifactZipMembers } from "../tests/helpers/hosted-specialization-evidence.mjs";
import { assertPerlScalarArchive, perlScalarConfigurations, perlScalarDirectory, perlScalarOriginals, perlScalarReceipt, perlScalarRevision, perlScalarSnapshot, perlScalarSources, writePerlScalarArtifact } from "../tests/helpers/perl-scalar-hosted-evidence.mjs";

const options = process.argv.slice(2);
assert.ok(options.every(option => option === "--check" || option.startsWith("--from=")), "Only --check and --from=<checkout holding the captures> are accepted");
const from = options.find(option => option.startsWith("--from="))?.slice("--from=".length) ?? ".";
const pending = new Map(), files = [];
const add = (path, bytes, originalPath) => {
	assert.ok(!pending.has(path));
	pending.set(path, bytes);
	files.push({ path, originalPath, sha256: sha256(bytes), bytes: bytes.length });
};
for(const configuration of perlScalarConfigurations)
{
	const original = name => readFile(join(from, perlScalarOriginals, configuration.name, name));
	for(const name of ["fetched-at.txt", "capture.json", "job.json", "job.log", "corpus-artifact.json", "abi-artifact.json", "corpus.zip", "abi.zip"])
		add(`${perlScalarDirectory}/${configuration.name}/${name}`, await original(name), `${perlScalarOriginals}/${configuration.name}/${name}`);
	const zipped = [["corpus", { "native-fin/perl.json": "ordinary.json", "native-fin/perl-reviewed.json": "reviewed.json" }]
		, ["abi", { [`${configuration.name}/acceptance.json`]: "abi-acceptance.json", [`${configuration.name}/perl.json`]: "abi-perl.json" }]];
	for(const [kind, map] of zipped)
	{
		const found = strictArtifactZipMembers(await original(`${kind}.zip`), Object.keys(map));
		for(const [member, name] of Object.entries(map))
		{
			// The capture's own extraction must be byte-identical to the strict reader's.
			assert.ok(found.get(member).equals(await original(name)), `${configuration.name}/${name}`);
			add(`${perlScalarDirectory}/${configuration.name}/${name}`, found.get(member), `${perlScalarOriginals}/${configuration.name}/${kind}.zip!${member}`);
		}
	}
}
for(const [path, digest] of Object.entries(perlScalarSources))
{
	const bytes = execFileSync("git", ["show", `${perlScalarRevision}:${path}`], { maxBuffer: 64 * 1024 * 1024 });
	assert.equal(sha256(bytes), digest, path);
	add(perlScalarSnapshot(path), bytes, `git:${perlScalarRevision}:${path}`);
}
const receipt = perlScalarReceipt(files);
await assertPerlScalarArchive(receipt, async path => pending.get(path));
const bytes = Buffer.from(JSON.stringify(receipt, null, 2) + "\n");
if(!options.includes("--check"))
{
	for(const [path, content] of pending) await writePerlScalarArtifact(path, content);
	await writePerlScalarArtifact(`${perlScalarDirectory}/receipt.json`, bytes);
}
process.stdout.write(`${options.includes("--check") ? "Validated" : "Archived"} ${files.length} files for the hosted Perl scalar Fin configurations. Receipt SHA-256 ${sha256(bytes)}\n`);
