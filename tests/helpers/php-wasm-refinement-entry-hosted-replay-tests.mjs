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
import { dirname, join, posix } from "node:path";
import test from "node:test";
import ts from "typescript";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	phpWasmEntryReplaySourceScopes, phpWasmEntryReplaySourceManifest
	, phpWasmEntryReplaySnapshotFiles, phpWasmEntryReplaySourceSupplementPath
	, phpWasmEntryReplaySourceSupplementSha256
	, phpWasmEntryReplayBuildInputScopes, readPhpWasmEntryReplayBuildInput
	, phpWasmEntryReplayBuildInputSupplementPath
	, phpWasmEntryReplayBuildInputSupplementSha256
} from "./php-wasm-refinement-entry-hosted-replay.mjs";
import { phpWasmEntryReplaySourceSupplement } from "./php-wasm-entry-source-supplement.mjs";
import { phpWasmEntryReplayBuildInputSupplement } from "./php-wasm-entry-build-input-supplement.mjs";
import { moduleSpecifiers } from "./module-closure.mjs";

const moduleUrl = new URL("php-wasm-refinement-entry-hosted-replay.mjs", import.meta.url).href;
const cleanEnvironment = () => Object.fromEntries(Object.entries(process.env)
	.filter(([key]) => !key.startsWith("GIT_") && !["NODE_OPTIONS", "NODE_PATH"].includes(key)));
const git = (root, args) => execFileSync("git", args
	, { cwd: root, env: cleanEnvironment(), encoding: "utf8"
		, maxBuffer: 8 * 1024 * 1024
		, stdio: ["ignore", "pipe", "pipe"] });
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
		const path = scope === "LICENSE" || scope.includes(".") && scope !== ".github"
			? scope : `${scope}/example.txt`;
		files[path] = path.endsWith(".json") ? "{}\n" : `original ${path}\n`;
	}
	for(const file of phpWasmEntryReplayBuildInputSupplement.files)
		files[file.path] = file.path.endsWith(".json") ? "{}\n" : `original ${file.path}\n`;
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

test("PHP-Wasm replay scopes retain runtime, packaging and preflight data", async () => {
	const patches = await readFile("scripts/lean-runtime-config.sh", "utf8");
	const patchPaths = [...patches.matchAll(/\$LEAN_WASM_PROJECT_ROOT\/(patches\/[^"\n]+)/gu)]
		.map(match => match[1]);
	assert.equal(patchPaths.length, 3);
	for(const path of ["LICENSE", "notices/runtime", "notices/php-wasm.txt"
		, ...patchPaths
		, "poc/lean-link-spike/graph-lock.json"
		, "poc/lean-link-spike/bindings/alpha.binding-ir.json"
		, "poc/lean-link-spike/bindings/php-wasm.package.json"
		, "docs/evidence/owned-php-wasm-transfers-20260930.json"
		, "docs/evidence/callback-refinements-php-wasm-20261023/hosted/output/records/checked-record/reviewed/build-0/model.json"])
		assert.ok(phpWasmEntryReplaySourceScopes.some(scope =>
			path === scope || path.startsWith(scope + "/")), path);
});

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

test("PHP-Wasm replay authenticates both imported site modules before execution", async t => {
	const { root, revision, files } = await fixture(t);
	const records = join(root, "records"); await mkdir(records);
	const invoke = `await source.replayPhpWasmEntryHostedArtifacts(${JSON.stringify(root)},'${revision}',${JSON.stringify(records)});`;
	for(const path of ["site/paths.mjs", "site/serve.mjs"])
	{
		assert.ok(phpWasmEntryReplaySourceScopes.includes(path));
		git(root, ["update-index", "--assume-unchanged", path]);
		await writeFile(join(root, path), "x" + files[path].slice(1));
		assert.equal(git(root, ["diff", "--name-only", "HEAD"]), "");
		assert.throws(() => run(root, invoke));
		assert.equal(existsSync(join(root, "executed")), false);
		await writeFile(join(root, path), files[path]);
		git(root, ["update-index", "--no-assume-unchanged", path]);
		await rm(join(root, path));
		assert.throws(() => run(root, invoke));
		await symlink("../src/example.txt", join(root, path));
		assert.throws(() => run(root, invoke));
		assert.equal(existsSync(join(root, "executed")), false);
		await rm(join(root, path)); await writeFile(join(root, path), files[path]);
	}
});

test("PHP-Wasm replay supplements only three complete immutable source snapshots", async () => {
	const supplement = phpWasmEntryReplaySourceSupplement;
	const bytes = await readFile(phpWasmEntryReplaySourceSupplementPath);
	assert.equal(sha256(bytes), phpWasmEntryReplaySourceSupplementSha256);
	assert.equal(bytes.toString(), canonicalJson(supplement));
	const buildInputs = phpWasmEntryReplayBuildInputSupplement;
	const buildBytes = await readFile(phpWasmEntryReplayBuildInputSupplementPath);
	assert.equal(sha256(buildBytes), phpWasmEntryReplayBuildInputSupplementSha256);
	assert.equal(buildBytes.toString(), canonicalJson(buildInputs));
	assert.deepEqual(buildInputs.archives, supplement.archives);
	assert.deepEqual(buildInputs.snapshots, supplement.snapshots);
	assert.equal(buildInputs.files.length, 17);
	const omitted = [...supplement.files, ...buildInputs.files];
	const snapshots = new Map();
	for(const archive of supplement.archives)
	{
		const bytes = await readFile(archive.path);
		assert.equal(bytes.length, archive.bytes); assert.equal(sha256(bytes), archive.sha256);
		for(const { snapshot } of JSON.parse(bytes).sources)
			snapshots.set(sha256(canonicalJson(snapshot)), snapshot);
	}
	assert.equal(snapshots.size, 3);
	assert.deepEqual([...snapshots.keys()], supplement.snapshots.map(item => item.snapshotSha256));
	for(const [identity, snapshot] of snapshots)
	{
		const files = await phpWasmEntryReplaySourceManifest(snapshot.revision);
		assert.equal(files.length, snapshot.files.length + omitted.length);
		assert.deepEqual(phpWasmEntryReplaySnapshotFiles(snapshot, files), snapshot.files);
		assert.equal(sha256(canonicalJson(snapshot)), identity);
		for(const file of omitted)
		{
			const original = git(process.cwd(), ["show", snapshot.revision + ":" + file.path]);
			const source = Object.hasOwn(file, "gzipBase64")
				? readPhpWasmEntryReplayBuildInput(file).toString("utf8") : file.source;
			assert.equal(original, source);
			assert.equal(sha256(original), file.sha256);
			assert.equal(Buffer.byteLength(original), file.bytes);
			assert.throws(() => phpWasmEntryReplaySnapshotFiles(snapshot, files.filter(item => item.path !== file.path)));
			assert.throws(() => phpWasmEntryReplaySnapshotFiles(snapshot, files.map(item => item.path === file.path
				? { ...item, sha256: "0".repeat(64) } : item)));
		}
		for(const mutate of [
			value => { value.files.pop(); }
			, value => { value.files[0].sha256 = "0".repeat(64); }
			, value => { value.zip.sha256 = "0".repeat(64); }
			, value => { value.revision = "0".repeat(40); }
			, value => { value.extra = true; }
		]) {
			const changed = structuredClone(snapshot); mutate(changed);
			assert.throws(() => phpWasmEntryReplaySnapshotFiles(changed, files));
		}
	}
});

test("PHP-Wasm replay new snapshots cannot omit an imported module or repository input", async t => {
	const { root, revision } = await fixture(t);
	const snapshot = JSON.parse(run(root, `console.log(JSON.stringify(await source.writePhpWasmEntryReplaySourceSnapshot('${revision}',${JSON.stringify(join(root, "complete.zip"))})));`));
	const required = ["site/paths.mjs", "site/serve.mjs"
		, ...phpWasmEntryReplayBuildInputSupplement.files.map(file => file.path)];
	for(const path of required)
	{
		assert.ok(snapshot.files.some(file => file.path === path));
		const changed = { ...snapshot, files: snapshot.files.filter(file => file.path !== path) };
		assert.throws(() => phpWasmEntryReplaySnapshotFiles(changed, snapshot.files));
	}
});

test("PHP-Wasm replay rejects malformed compressed supplemental input", () => {
	for(const file of phpWasmEntryReplayBuildInputSupplement.files)
	{
		const source = readPhpWasmEntryReplayBuildInput(file);
		assert.equal(source.length, file.bytes);
		for(const change of [
			{ bytes: 0 }, { bytes: 8 * 1024 * 1024 + 1 }, { bytes: file.bytes - 1 }
			, { gzipBytes: 0 }, { gzipBytes: file.gzipBytes + 1 }
			, { gzipBase64: file.gzipBase64 + "\n" }, { gzipSha256: "0".repeat(64) }
			, { sha256: "0".repeat(64) }, { object: "0".repeat(40) }
			, { mode: "120000" }, { path: "../outside" }, { extra: true }
		]) assert.throws(() => readPhpWasmEntryReplayBuildInput({ ...file, ...change }));
	}
});

test("PHP-Wasm replay checks every supplemental input before invoking the verifier", async t => {
	const { root, revision, files } = await fixture(t);
	const records = join(root, "records"); await mkdir(records);
	const invoke = `await source.replayPhpWasmEntryHostedArtifacts(${JSON.stringify(root)},'${revision}',${JSON.stringify(records)});`;
	for(const { path } of phpWasmEntryReplayBuildInputSupplement.files)
	{
		assert.ok(phpWasmEntryReplayBuildInputScopes.some(scope =>
			path === scope || path.startsWith(scope + "/")));
		git(root, ["update-index", "--assume-unchanged", path]);
		await writeFile(join(root, path), "x" + files[path].slice(1));
		assert.equal(git(root, ["diff", "--name-only", "HEAD"]), "");
		assert.throws(() => run(root, invoke));
		assert.equal(existsSync(join(root, "executed")), false);
		await writeFile(join(root, path), files[path]);
		git(root, ["update-index", "--no-assume-unchanged", path]);
		await rm(join(root, path));
		assert.throws(() => run(root, invoke));
		await symlink(join(root, "src/example.txt"), join(root, path));
		assert.throws(() => run(root, invoke));
		assert.equal(existsSync(join(root, "executed")), false);
		await rm(join(root, path)); await writeFile(join(root, path), files[path]);
	}
});

test("PHP-Wasm replay scopes contain producer imports and tracked literal inputs", async () => {
	const entries = new Set([
		"tests/helpers/php-wasm-refinement-entry-installed-tests.mjs"
		, "tests/helpers/php-wasm-owned-refinement-entry-installed-tests.mjs"
		, "tests/php-wasm-callback-entry-installed.test.mjs"
		, "tests/helpers/owned-php-wasm-runtime.mjs"
		, "scripts/check-php-wasm-refinement-entry-records.mjs"
		, "scripts/check-php-wasm-callback-entry-records.mjs"
		, "scripts/summarize-php-wasm-refinement-entry-hosted.mjs"
	]);
	for(const name of [
		"php-wasm-refinement-entry-promotion", "php-wasm-refinement-entry"
		, "php-wasm-owned-refinement-entry", "php-wasm-callback-entry"
		, "php-wasm-indexed-refinement-entry"
	]) {
		const workflow = await readFile(".github/workflows/" + name + ".yml", "utf8");
		for(const match of workflow.matchAll(/(?:tests|scripts)\/[A-Za-z0-9_./-]+\.mjs\b/gu)) entries.add(match[0]);
	}
	const seen = new Set(), references = new Set(), computedImports = [];
	const captured = path => phpWasmEntryReplaySourceScopes.some(scope =>
		path === scope || path.startsWith(scope + "/"));
	const visit = async path => {
		if(seen.has(path)) return;
		assert.ok(captured(path), path);
		seen.add(path);
		const source = await readFile(path, "utf8");
		for(const specifier of moduleSpecifiers(source, path))
			await visit(posix.normalize(posix.join(posix.dirname(path), posix.extname(specifier) ? specifier : specifier + ".mjs")));
		const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
		const walk = node => {
			if(ts.isStringLiteralLike(node)
				&& /^(?:poc|patches|docs|site|notices)\/[A-Za-z0-9_./-]+$/u.test(node.text))
				references.add(node.text.replace(/\/$/u, ""));
			if(ts.isNewExpression(node) && node.expression.getText(file) === "URL"
				&& node.arguments?.length === 2 && ts.isStringLiteralLike(node.arguments[0])
				&& node.arguments[1].getText(file) === "import.meta.url")
				references.add(posix.normalize(posix.join(posix.dirname(path)
					, node.arguments[0].text)).replace(/\/$/u, ""));
			if(ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword
				&& !ts.isStringLiteralLike(node.arguments[0]))
				computedImports.push(path);
			ts.forEachChild(node, walk);
		};
		walk(file);
	};
	for(const entry of entries) await visit(entry);
	assert.ok(seen.has("site/serve.mjs") && seen.has("site/paths.mjs"));
	// Query Git objects directly. A sparse checkout must not hide an omitted input.
	// Directory prefixes and generated paths are not classified as source files.
	const candidates = [...references].filter(path => path !== "." && !captured(path));
	if(candidates.length)
	{
		const objects = execFileSync("git", ["cat-file", "--batch-check"], {
			input: candidates.map(path => `HEAD:${path}`).join("\n") + "\n"
			, env: cleanEnvironment(), encoding: "utf8", maxBuffer: 1024 * 1024
		}).trim().split("\n");
		assert.equal(objects.length, candidates.length);
		for(const [index, object] of objects.entries())
			assert.notEqual(object.split(" ")[1], "blob", candidates[index]);
	}
	// Both computed imports load captured fixture drivers copied into owned scratch.
	assert.deepEqual(computedImports.sort(), [
		"tests/helpers/php-wasm-callback-entry-driver-tests.mjs"
		, "tests/helpers/php-wasm-refinement-entry-driver-tests.mjs"
	]);
	for(const family of ["callback", "refinement"])
	{
		const source = await readFile(`tests/helpers/php-wasm-${family}-entry-driver-tests.mjs`, "utf8");
		const path = `tests/fixtures/php-wasm-${family}-entry/driver.mjs`;
		assert.ok(captured(path));
		assert.ok(source.includes(`cp("${path}", join(root, "driver.mjs"))`));
		assert.ok(source.includes('import(pathToFileURL(join(root, "driver.mjs"))'));
	}
});
