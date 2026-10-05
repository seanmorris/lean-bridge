/**
 * Check the exact prepared CPAN archives on a compatible production host.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { sha256 } from "../src/capsule/node.mjs";
import { installCpanArchive } from "../src/release/cpan-install.mjs";
import { processBuildRunner } from "../src/build/process-runner.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const flags = new Map();
for(let index = 2; index < process.argv.length; index += 2)
{
	const flag = process.argv[index], value = process.argv[index + 1];
	assert.ok(["--release", "--output", "--perls"].includes(flag) && value && !flags.has(flag), "Use --release DIRECTORY --output NEW_DIRECTORY --perls JSON_ARRAY");
	flags.set(flag, value);
}
assert.equal(flags.size, 3, "All three arguments are required");
const release = resolve(flags.get("--release")), output = resolve(flags.get("--output"));
const perls = JSON.parse(flags.get("--perls"));
assert.ok(Array.isArray(perls) && perls.length > 0 && perls.every(perl => typeof perl === "string" && perl.startsWith("/")));
const receipt = JSON.parse(await readFile(join(release, "native-release.json"), "utf8"));
assert.equal(receipt.ecosystem, "cpan");
assert.equal(receipt.packages.length, 2);
for(const entry of receipt.packages)
{
	assert.match(entry.archive, /^LeanBridge-[A-Za-z0-9_.-]+\.tar\.gz$/);
	assert.equal(sha256(await readFile(join(release, "archives", entry.archive))), entry.sha256);
	assert.equal(entry.abiVariants.length, perls.length);
}
await mkdir(output);
const results = [];
for(const [index, perl] of perls.entries())
{
	for(const mode of ["prebuilt-only", "build-xs"])
	{
		const prefix = join(output, `perl-${index}-${mode}`);
		let installed;
		for(const entry of receipt.packages)
			installed = await installCpanArchive({ archive: join(release, "archives", entry.archive)
				, workingRoot: output, prefix, perl, mode });
		const env = { ...process.env, PERL5LIB: installed.perl5lib };
		delete env.LEAN_BRIDGE_PERL_OTHER;
		const run = file => processBuildRunner.capture({ command: perl, args: [join(root, file)], cwd: output, env });
		const consumer = await run("tests/fixtures/perl/consumer.t");
		assert.doesNotMatch(consumer.stdout, /^not ok/m);
		assert.match(consumer.stdout, /1\.\.173\s*$/);
		const example = await run("tests/fixtures/documentation/consumers/perl/consumer.pl");
		assert.equal(example.stdout, "42\n42\n42\n41\n");
		results.push({ perl, mode, checks: 173, documentationExample: "passed" });
		process.stdout.write(`${perl}: ${mode}: 173 checks and documentation example passed\n`);
	}
}
const report = {
	schemaVersion: 1, configurationSha256: receipt.configurationSha256
	, glibcMinimumVersion: receipt.glibcMinimumVersion
	, packages: receipt.packages, results
};
await writeFile(join(output, "report.json"), JSON.stringify(report, null, 2) + "\n");
