/**
 * Check immutable source snapshots and refusal before executing a producer.
 * The miniature repository tests source identity only, not probe acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { phpWasmEntryReplaySourceScopes } from "./php-wasm-refinement-entry-hosted-replay.mjs";

const moduleUrl = new URL("php-wasm-refinement-entry-hosted-replay.mjs", import.meta.url).href;
const cleanEnvironment = () => Object.fromEntries(Object.entries(process.env)
	.filter(([key]) => !key.startsWith("GIT_") && !["NODE_OPTIONS", "NODE_PATH"].includes(key)));
const git = (root, args) => execFileSync("git", args
	, { cwd: root, env: cleanEnvironment(), encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
const run = (root, script) => execFileSync(process.execPath, [
	"--max-old-space-size=512", "--input-type=module", "-e"
	, `import * as source from ${JSON.stringify(moduleUrl)};\n${script}`]
, { cwd: root, env: cleanEnvironment(), encoding: "utf8", timeout: 15_000
	, maxBuffer: 2 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });
const fixture = async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-php-entry-source-tests-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const files = {};
	for(const scope of phpWasmEntryReplaySourceScopes)
	{
		const path = scope.includes(".") && scope !== ".github" ? scope : `${scope}/example.txt`;
		files[path] = path.endsWith(".json") ? "{}\n" : `original ${path}\n`;
	}
	files["lean-toolchain"] = "leanprover/lean4:v4.25.0\n";
	delete files["lean-toolchain/example.txt"];
	files["src/empty.txt"] = "";
	files["tests/binary.dat"] = Buffer.alloc(256 * 1024, 0xa5);
	files["scripts/summarize-php-wasm-refinement-entry-hosted.mjs"]
		= 'import {writeFileSync} from "node:fs"; writeFileSync("executed", "wrong");\n';
	for(const [path, bytes] of Object.entries(files))
	{
		await mkdir(dirname(join(root, path)), { recursive: true });
		await writeFile(join(root, path), bytes);
	}
	git(root, ["init", "--quiet"]); git(root, ["add", "."]);
	git(root, ["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
		, "-c", "commit.gpgsign=false", "commit", "--quiet", "-m", "source fixture"]);
	return { root, files, revision: git(root, ["rev-parse", "HEAD"]).trim() };
};

test("PHP-Wasm replay sources hash exact Git blobs including non-module assets", async t => {
	const { root, files, revision } = await fixture(t);
	const manifest = JSON.parse(run(root, `console.log(JSON.stringify(await source.phpWasmEntryReplaySourceManifest('${revision}')));`));
	assert.deepEqual(manifest.map(file => file.path), Object.keys(files).sort());
	for(const file of manifest)
	{
		assert.equal(file.bytes, Buffer.byteLength(files[file.path]));
		assert.equal(file.sha256, sha256(files[file.path]));
		assert.equal(file.mode, "100644");
		assert.equal(file.object, git(root, ["rev-parse", `${revision}:${file.path}`]).trim());
	}
	await writeFile(join(root, "src/example.txt"), "uncommitted source\n");
	assert.deepEqual(JSON.parse(run(root, `console.log(JSON.stringify(await source.phpWasmEntryReplaySourceManifest('${revision}')));`)), manifest);
});

test("PHP-Wasm replay source snapshots reproduce and reject forged identities", async t => {
	const { root, revision } = await fixture(t);
	const result = JSON.parse(run(root, `
const one=await source.writePhpWasmEntryReplaySourceSnapshot('${revision}',${JSON.stringify(join(root, "one.zip"))});
const two=await source.writePhpWasmEntryReplaySourceSnapshot('${revision}',${JSON.stringify(join(root, "two.zip"))});
console.log(JSON.stringify({one,two}));`));
	assert.deepEqual(result.one, result.two);
	assert.deepEqual(await readFile(join(root, "one.zip")), await readFile(join(root, "two.zip")));
	for(const change of [
		value => { value.files.pop(); }
		, value => { value.files[0].sha256 = "0".repeat(64); }
		, value => { value.files[0].object = "0".repeat(40); }
		, value => { value.zip.sha256 = "0".repeat(64); }
		, value => { value.zip.bytes++; }
		, value => { value.extra = true; }
	]) {
		const altered = structuredClone(result.one); change(altered);
		assert.throws(() => run(root, `await source.checkPhpWasmEntryReplaySourceSnapshot(${JSON.stringify(altered)},${JSON.stringify(join(root, "one.zip"))});`));
	}
	const bytes = await readFile(join(root, "one.zip")); bytes[0] ^= 1;
	await writeFile(join(root, "one.zip"), bytes);
	assert.throws(() => run(root, `await source.checkPhpWasmEntryReplaySourceSnapshot(${JSON.stringify(result.one)},${JSON.stringify(join(root, "one.zip"))});`));
});

test("PHP-Wasm replay refuses tracked symlinks before creating a source snapshot", async t => {
	const { root } = await fixture(t);
	await symlink("../package.json", join(root, "src/link.json")); git(root, ["add", "src/link.json"]);
	git(root, ["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
		, "-c", "commit.gpgsign=false", "commit", "--quiet", "-m", "link fixture"]);
	const revision = git(root, ["rev-parse", "HEAD"]).trim();
	assert.throws(() => run(root, `await source.writePhpWasmEntryReplaySourceSnapshot('${revision}',${JSON.stringify(join(root, "source.zip"))});`));
	assert.equal(existsSync(join(root, "source.zip")), false);
});

test("PHP-Wasm replay source extraction rejects substituted bytes and omitted members", async t => {
	const { root, revision } = await fixture(t);
	const first = JSON.parse(run(root, `console.log(JSON.stringify(await source.writePhpWasmEntryReplaySourceSnapshot('${revision}',${JSON.stringify(join(root, "original.zip"))})));`));
	await writeFile(join(root, "src/example.txt"), "substituted source\n");
	git(root, ["add", "src/example.txt"]);
	git(root, ["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
		, "-c", "commit.gpgsign=false", "commit", "--quiet", "-m", "changed source"]);
	const changed = git(root, ["rev-parse", "HEAD"]).trim();
	const second = JSON.parse(run(root, `console.log(JSON.stringify(await source.writePhpWasmEntryReplaySourceSnapshot('${changed}',${JSON.stringify(join(root, "changed.zip"))})));`));
	const substituted = { ...first, zip: second.zip };
	assert.throws(() => run(root, `await source.checkPhpWasmEntryReplaySourceSnapshot(${JSON.stringify(substituted)},${JSON.stringify(join(root, "changed.zip"))});`));
	await writeFile(join(root, ".gitattributes"), "src/example.txt export-ignore\n");
	git(root, ["add", ".gitattributes"]);
	git(root, ["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
		, "-c", "commit.gpgsign=false", "commit", "--quiet", "-m", "omitted source"]);
	const omitted = git(root, ["rev-parse", "HEAD"]).trim();
	assert.throws(() => run(root, `await source.writePhpWasmEntryReplaySourceSnapshot('${omitted}',${JSON.stringify(join(root, "omitted.zip"))});`));
});

test("PHP-Wasm replay checkout detects hidden edits and ignored source inputs", async t => {
	const { root, revision, files } = await fixture(t);
	const check = `await source.assertPhpWasmEntryReplayCheckout(${JSON.stringify(root)},'${revision}');`;
	run(root, check);
	git(root, ["update-index", "--assume-unchanged", "src/example.txt"]);
	await writeFile(join(root, "src/example.txt"), "hidden edit\n");
	assert.equal(git(root, ["diff", "--name-only", "HEAD"]), "");
	assert.throws(() => run(root, check));
	await writeFile(join(root, "src/example.txt"), files["src/example.txt"]);
	git(root, ["update-index", "--no-assume-unchanged", "src/example.txt"]);
	await writeFile(join(root, ".git/info/exclude"), "src/hidden.mjs\n");
	await writeFile(join(root, "src/hidden.mjs"), "export const unexpected = true;\n");
	assert.equal(git(root, ["ls-files", "--others", "--exclude-standard"]), "");
	assert.throws(() => run(root, check));
});

test("PHP-Wasm replay refuses wrong or dirty source before invoking a verifier", async t => {
	const { root, revision } = await fixture(t);
	const records = join(root, "records"); await mkdir(records);
	const invoke = selected => `await source.replayPhpWasmEntryHostedArtifacts(${JSON.stringify(root)},'${selected}',${JSON.stringify(records)});`;
	assert.throws(() => run(root, invoke("b".repeat(40))));
	await writeFile(join(root, "src/example.txt"), "dirty\n");
	assert.throws(() => run(root, invoke(revision)));
	assert.equal(existsSync(join(root, "executed")), false);
});

test("PHP-Wasm replay snapshots refuse existing or symlinked destinations", async t => {
	const { root, revision } = await fixture(t);
	const destination = join(root, "keep.zip"); await writeFile(destination, "keep this file");
	assert.throws(() => run(root, `await source.writePhpWasmEntryReplaySourceSnapshot('${revision}',${JSON.stringify(destination)});`));
	assert.equal(await readFile(destination, "utf8"), "keep this file");
	const link = join(root, "link"); await symlink(root, link);
	assert.throws(() => run(root, `await source.writePhpWasmEntryReplaySourceSnapshot('${revision}',${JSON.stringify(join(link, "missing.zip"))});`));
	assert.equal(existsSync(join(root, "missing.zip")), false);
});
