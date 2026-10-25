/**
 * Check original source ZIPs and repository inputs without rebuilding runtimes.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, posix, resolve } from "node:path";
import { canonicalJson, sha256 } from "../../../src/capsule/node.mjs";
import { moduleSpecifiers } from "../../../tests/helpers/module-closure.mjs";
import { phpWasmEntryReplaySourceSupplement } from "../../../tests/helpers/php-wasm-entry-source-supplement.mjs";
import { phpWasmEntryReplayBuildInputSupplement } from "../../../tests/helpers/php-wasm-entry-build-input-supplement.mjs";
import {
	assertPhpWasmEntryReplayCheckout, checkPhpWasmEntryReplaySourceSnapshot
	, readPhpWasmEntryReplayBuildInput
} from "../../../tests/helpers/php-wasm-refinement-entry-hosted-replay.mjs";
import { reconstructCallbackSubtypeHostedArtifact } from "../../../tests/helpers/callback-subtype-hosted-evidence.mjs";

const producer = "a003269808c43a2a3a509a23c8a8ab8def07b610";
const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
const head = git(["rev-parse", "HEAD"]).trim();
assert.equal(process.argv.length, 3, "Pass the exact original producer checkout");
const checkout = resolve(process.argv[2]);
assert.equal(checkout, process.argv[2]);
const originals = await assertPhpWasmEntryReplayCheckout(checkout, producer);
const originalByPath = new Map(originals.map(file => [file.path, file]));
const workflows = [
	"php-wasm-refinement-entry-promotion", "php-wasm-refinement-entry"
	, "php-wasm-owned-refinement-entry", "php-wasm-callback-entry"
	, "php-wasm-indexed-refinement-entry"
].map(name => ".github/workflows/" + name + ".yml");
const entries = new Set([
	"tests/helpers/php-wasm-refinement-entry-installed-tests.mjs"
	, "tests/helpers/php-wasm-owned-refinement-entry-installed-tests.mjs"
	, "tests/php-wasm-callback-entry-installed.test.mjs"
	, "tests/helpers/owned-php-wasm-runtime.mjs"
	, "scripts/check-php-wasm-refinement-entry-records.mjs"
	, "scripts/check-php-wasm-callback-entry-records.mjs"
	, "scripts/summarize-php-wasm-refinement-entry-hosted.mjs"
]);
const workflowScripts = new Set();
for(const path of workflows)
{
	const source = await readFile(path, "utf8");
	for(const match of source.matchAll(/(?:tests|scripts)\/[A-Za-z0-9_./-]+\.mjs\b/gu))
		entries.add(match[0]);
	for(const match of source.matchAll(/scripts\/[A-Za-z0-9_./-]+\.sh\b/gu))
		workflowScripts.add(match[0]);
}
const seen = new Set();
const visit = async path => {
	if(seen.has(path)) return;
	seen.add(path);
	const original = originalByPath.get(path);
	assert.ok(original, path);
	const bytes = await readFile(path);
	assert.equal(bytes.length, original.bytes, path);
	assert.equal(sha256(bytes), original.sha256, path);
	for(const specifier of moduleSpecifiers(bytes.toString(), path))
		await visit(posix.normalize(posix.join(posix.dirname(path)
			, posix.extname(specifier) ? specifier : specifier + ".mjs")));
};
for(const entry of entries) await visit(entry);
const unchanged = [
	"src", "tests/fixtures", "schema", "config", "notices", "patches", "poc"
	, "package.json", "package-lock.json", "lean-toolchain", "flake.nix", "flake.lock"
	, "docs/consumer-support.v1.json", "site/serve.mjs", "site/paths.mjs"
	, ".github/actions/bounded-apt"
	, "scripts/env.sh", "scripts/lean-runtime-config.sh"
	, ...workflows, ...workflowScripts
	, ...phpWasmEntryReplayBuildInputSupplement.files.map(file => file.path)
];
assert.equal(git(["diff", "--name-only", producer, head, "--", ...unchanged]), "");
assert.equal(git(["diff", "--name-only", "HEAD", "--", ...unchanged]), "");
for(const file of phpWasmEntryReplayBuildInputSupplement.files)
	assert.deepEqual(await readFile(file.path), readPhpWasmEntryReplayBuildInput(file));
const temporary = await mkdtemp(join(tmpdir(), "lean-php-entry-build-input-audit-"));
const checked = [];
try
{
	for(const archive of phpWasmEntryReplaySourceSupplement.archives)
	{
		const bytes = await readFile(archive.path);
		assert.equal(bytes.length, archive.bytes);
		assert.equal(sha256(bytes), archive.sha256);
		for(const source of JSON.parse(bytes).sources)
		{
			if(checked.some(item => item.revision === source.snapshot.revision)) continue;
			const root = resolve(dirname(archive.path));
			const zip = source.parts ? join(temporary, source.snapshot.revision + ".zip")
				: join(root, source.path);
			if(source.parts)
				assert.equal(await reconstructCallbackSubtypeHostedArtifact(root, source.parts, zip)
					, source.snapshot.zip.bytes);
			await checkPhpWasmEntryReplaySourceSnapshot(source.snapshot, zip);
			checked.push({
				revision: source.snapshot.revision
				, snapshotSha256: sha256(canonicalJson(source.snapshot))
				, archiveFiles: source.snapshot.files.length, zip: source.snapshot.zip
				, reconstructedAndExtracted: true
			});
			if(source.parts) await rm(zip);
		}
	}
}
finally
{ await rm(temporary, { recursive: true, force: true }); }
assert.equal(checked.length, 3);
const moduleIdentities = [...seen].sort().map(path => originalByPath.get(path));
console.log(canonicalJson({
	schemaVersion: 1, kind: "php-wasm-entry-build-input-source-audit-v1"
	, producerCommit: producer, comparedCommit: head
	, producerCheckoutFiles: originals.length
	, producerCheckoutBytes: originals.reduce((total, file) => total + file.bytes, 0)
	, entryRoots: [...entries].sort(), reachableModules: seen.size
	, moduleIdentitiesSha256: sha256(canonicalJson(moduleIdentities))
	, unchangedRepositoryInputs: [...new Set(unchanged)].sort()
	, buildInputFiles: phpWasmEntryReplayBuildInputSupplement.files.length
	, snapshots: checked
	, scope: "Repository source and data identity plus original ZIP extraction. The literal-import audit is supplemented by unchanged complete source, fixture, schema, configuration, notice, patch and metadata trees, explicit workflow/shell inputs and two retained preflight models. External compilers and hosts remain described by the original run and runtime receipts. This audit does not execute a new build or replace the thirty-route verifier or final hosted acceptance."
}));
