/**
 * Exercise offline Lake lock capture with real cached Git and local packages.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { chmod, cp, lstat, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { deflateSync, inflateSync } from "node:zlib";
import { prepareLakeDependencySnapshot, verifyLakeDependencySnapshot, writeLakeDependencySnapshot } from "../src/build/lake-dependency-snapshot.mjs";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { assertJsonSchema } from "./helpers/json-schema.mjs";

const execute = promisify(execFile);
const toolchain = "leanprover/lean4:v4.32.2\n";
const save = async (root, path, bytes) => {
	await mkdir(dirname(join(root, path)), { recursive: true });
	await writeFile(join(root, path), bytes);
};
const git = async (root, ...args) => (await execute("git", ["-C", root, ...args], {
	env: { PATH: process.env.PATH, GIT_CONFIG_NOSYSTEM: "1"
		, GIT_CONFIG_GLOBAL: "/dev/null"
		, GIT_AUTHOR_NAME: "Snapshot fixture", GIT_COMMITTER_NAME: "Snapshot fixture"
		, GIT_AUTHOR_EMAIL: "fixture@example.invalid"
		, GIT_COMMITTER_EMAIL: "fixture@example.invalid"
		, GIT_AUTHOR_DATE: "2026-09-01T00:00:00Z"
		, GIT_COMMITTER_DATE: "2026-09-01T00:00:00Z" }
})).stdout.trim();
const packageFiles = async (directory, name) => {
	await save(directory, "lakefile.toml", `name = "${name}"\n`);
	await save(directory, "lake-manifest.json", JSON.stringify({ version: "1.2.0", packages: [] }));
	await save(directory, "lean-toolchain", toolchain);
	await save(directory, `${name}.lean`, `def ${name}.value : Nat := 42\n`);
};
const fixture = async (t, { withGit = false, objectFormat = "sha1" } = {}) => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-lake-snapshot-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const root = join(directory, "workspace", "project");
	const local = join(directory, "workspace", "local");
	await packageFiles(root, "Project");
	await packageFiles(local, "Local");
	await save(local, "native/value.c", "unsigned value(void) { return 42; }\n");
	await save(local, "native/value.h", "unsigned value(void);\n");
	await save(local, "assets/input.bin", Buffer.from([0, 255, 1, 128]));
	await save(local, "scripts/build.sh", "#!/bin/sh\nexit 1\n");
	await chmod(join(local, "scripts/build.sh"), 0o755);
	const manifest = { version: "1.2.0", name: "Project", lakeDir: ".lake"
		, packagesDir: ".lake/packages", fixedToolchain: false
		, packages: [{ type: "path", name: "Local", inherited: false, dir: "../local" }] };
	const cached = join(root, ".lake/packages/Remote");
	if(withGit)
	{
		await packageFiles(cached, "Remote");
		await git(cached, "init", "--quiet", `--object-format=${objectFormat}`);
		await git(cached, "add", ".");
		await git(cached, "commit", "--quiet", "-m", "Pinned dependency");
		manifest.packages.push({ type: "git", name: "Remote", inherited: true
			, scope: "team", url: "https://example.invalid/team/remote.git"
			, rev: await git(cached, "rev-parse", "HEAD")
			, inputRev: "main", subDir: null, configFile: "lakefile.toml"
			, manifestFile: "lake-manifest.json" });
	}
	const lock = () => save(root, "lake-manifest.json", JSON.stringify(manifest));
	await lock();
	const capture = options => prepareLakeDependencySnapshot({ projectRoot: root, ...options });
	return { directory, root, local, cached, manifest, lock, capture };
};
const inputState = async root => {
	const entries = [];
	const visit = async prefix => {
		for(const name of (await readdir(join(root, prefix))).sort())
		{
			const path = prefix ? `${prefix}/${name}` : name;
			const stat = await lstat(join(root, path));
			entries.push({ path, mode: stat.mode
				, mtime: stat.mtimeMs, ctime: stat.ctimeMs
				, sha256: stat.isFile() ? sha256(await readFile(join(root, path))) : null });
			if(stat.isDirectory()) await visit(path);
		}
	};
	await visit("");
	return entries;
};
const write = (context, snapshot, name = "snapshot") => writeLakeDependencySnapshot({ snapshot, outputRoot: join(context.directory, name) });

test("Lake capture includes locked inherited packages, native inputs and exact file identities without source writes", async t => {
	const context = await fixture(t, { withGit: true });
	const before = await inputState(join(context.directory, "workspace"));
	const snapshot = await context.capture();
	assert.deepEqual(await inputState(join(context.directory, "workspace")), before);
	assert.equal(snapshot.sha256, sha256(canonicalJson(snapshot.document)));
	assert.equal(JSON.stringify(snapshot).includes(context.directory), false);
	assert.deepEqual(snapshot.document.packages.map(item => [item.name, item.inherited]), [["Local", false], ["Remote", true]]);
	const local = snapshot.document.packages[0];
	assert.equal(local.configFile, "lakefile.toml");
	assert.deepEqual(local.source, { type: "path", dir: "../local" });
	assert.equal(local.treeSha256, sha256(canonicalJson(local.files)));
	assert.equal(local.files.find(file => file.path === "scripts/build.sh").mode, 0o755);
	assert.equal(local.files.find(file => file.path === "assets/input.bin").sha256, sha256(Buffer.from([0, 255, 1, 128])));
	assert.ok(local.files.some(file => file.path === "native/value.c"));
	assert.ok(local.files.some(file => file.path === "native/value.h"));
	await assertJsonSchema("lake-dependency-snapshot", snapshot.document);
	assert.throws(() => snapshot.document.packages.push({}), TypeError);
	assert.throws(() => { local.files[0].sha256 = "0".repeat(64); }, TypeError);
	const result = await write(context, snapshot);
	assert.deepEqual(await verifyLakeDependencySnapshot({ snapshot, snapshotRoot: result.output }), {
		verified: true, sha256: snapshot.sha256, packages: 2
	});
	assert.deepEqual(await inputState(join(context.directory, "workspace")), before);
});

test("relocated locks and cached Git produce identical offline snapshots", async t => {
	const context = await fixture(t, { withGit: true });
	const first = await context.capture();
	await cp(join(context.directory, "workspace"), join(context.directory, "relocated"), { recursive: true });
	const second = await prepareLakeDependencySnapshot({ projectRoot: join(context.directory, "relocated/project") });
	assert.deepEqual(second, first);
	const left = await write(context, first, "left");
	const right = await write(context, second, "right");
	assert.deepEqual((await inputState(left.output)).map(({ path, mode, sha256: digest }) => ({ path, mode, digest }))
		, (await inputState(right.output)).map(({ path, mode, sha256: digest }) => ({ path, mode, digest })));
});

test("snapshot schema rejects undeclared fields and malformed file identities", async t => {
	const context = await fixture(t, { withGit: true });
	const { document } = await context.capture();
	for(const change of [
		value => { value.completeImportClosure = true; }
		, value => { value.packages[0].extra = true; }
		, value => { value.packages[0].files[0].sha256 = "invalid"; }
		, value => { value.packages[0].files[0].mode = 644; }
		, value => { value.packages[0].files[0].path = "../escape"; }
		, value => { value.packages[1].source.rev = "main"; }
	]) {
		const invalid = structuredClone(document);
		change(invalid);
		await assert.rejects(() => assertJsonSchema("lake-dependency-snapshot", invalid));
	}
});

test("writing uses captured bytes, while new local content changes the next capture identity", async t => {
	const context = await fixture(t);
	const first = await context.capture();
	await save(context.local, "Local.lean", "def Local.value : Nat := 99\n");
	const second = await context.capture();
	assert.notEqual(first.sha256, second.sha256);
	const result = await write(context, first);
	assert.equal(await readFile(join(result.output, "packages/Local/Local.lean"), "utf8"), "def Local.value : Nat := 42\n");
	await verifyLakeDependencySnapshot({ snapshot: first, snapshotRoot: result.output });
});

test("generated outputs, caches and secret filenames are excluded from local snapshots", async t => {
	const context = await fixture(t);
	const first = await context.capture();
	for(const path of [".lake/build/Local.olean", "node_modules/x.js"
		, "build/result"
		, "dist/package", "target/a"
		, ".env", ".env.local", ".npmrc", ".lean-bridge-stage/source"])
		await save(context.local, path, "not a source input");
	assert.deepEqual(await context.capture(), first);
});

test("Lake config defaults prefer Lean then TOML and preserve explicit filenames and null manifests", async t => {
	const context = await fixture(t);
	await save(context.local, "lakefile.lean", "import Lake\nopen Lake DSL\npackage Local\n");
	assert.equal((await context.capture()).document.packages[0].configFile, "lakefile.lean");
	context.manifest.packages[0].configFile = "lakefile.toml";
	context.manifest.packages[0].manifestFile = null;
	await context.lock();
	await rm(join(context.local, "lake-manifest.json"));
	assert.equal((await context.capture()).document.packages[0].configFile, "lakefile.toml");
	context.manifest.packages[0].configFile = "settings/package";
	await save(context.local, "settings/package.toml", "name = \"Local\"\n");
	await context.lock();
	assert.equal((await context.capture()).document.packages[0].configFile, "settings/package.toml");
});

test("custom lakeDir keeps the default package cache and rejects active override files", async t => {
	const context = await fixture(t, { withGit: true });
	context.manifest.lakeDir = "cache";
	context.manifest.packagesDir = null;
	await context.lock();
	await context.capture();
	await save(context.root, "cache/package-overrides.json", "{}");
	await assert.rejects(context.capture, { code: "unsupported-lake-overrides" });
});

test("a configured package cache resolves its pinned checkout", async t => {
	const context = await fixture(t, { withGit: true });
	context.manifest.packagesDir = "dependencies";
	await cp(context.cached, join(context.root, "dependencies/Remote"), { recursive: true });
	await context.lock();
	await context.capture();
});

test("Git subdirectories preserve the complete checkout including sibling native inputs", async t => {
	const context = await fixture(t, { withGit: true });
	await packageFiles(join(context.cached, "lean/pkg"), "Remote");
	await save(context.cached, "native/external.c", "int external(void) { return 1; }\n");
	await git(context.cached, "add", ".");
	await git(context.cached, "commit", "--quiet", "-m", "Monorepo package");
	Object.assign(context.manifest.packages[1], { rev: await git(context.cached, "rev-parse", "HEAD"), subDir: "lean/pkg" });
	await context.lock();
	const snapshot = await context.capture();
	assert.equal(snapshot.document.packages[1].packageRoot, "lean/pkg");
	assert.ok(snapshot.document.packages[1].files.some(file => file.path === "native/external.c"));
	await assertJsonSchema("lake-dependency-snapshot", snapshot.document);
});

for(const [label, change, code] of [
	["branch pin", entry => { entry.rev = "main"; }, "unpinned-lake-dependency"]
	, ["short pin", entry => { entry.rev = "a".repeat(12); }, "unpinned-lake-dependency"]
	, ["wrong commit", entry => { entry.rev = "a".repeat(40); }, "lake-git-drift"]
	, ["password URL", entry => { entry.url = "https://user:secret@example.invalid/repo"; }, "unpinned-lake-dependency"]
	, ["token URL", entry => { entry.url = "https://secret@example.invalid/repo"; }, "unpinned-lake-dependency"]
	, ["local Git URL", entry => { entry.url = "file:///tmp/repo"; }, "unpinned-lake-dependency"]
	, ["escaping subdirectory", entry => { entry.subDir = "../escape"; }, "invalid-lake-snapshot"]
]) test(`locked Git rejects ${label}`, async t => {
	const context = await fixture(t, { withGit: true });
	change(context.manifest.packages[1]);
	await context.lock();
	await assert.rejects(context.capture, { code });
});

for(const [label, change] of [
	["modified bytes", root => save(root, "Remote.lean", "-- changed\n")]
	, ["missing files", root => rm(join(root, "Remote.lean"))]
	, ["untracked files", root => save(root, "Unexpected.lean", "-- untracked\n")]
	, ["executable mode", root => chmod(join(root, "Remote.lean"), 0o755)]
]) test(`locked Git rejects ${label} without running filters`, async t => {
	const context = await fixture(t, { withGit: true });
	await git(context.cached, "config", "core.fsmonitor", "false");
	await change(context.cached);
	await assert.rejects(context.capture, { code: "lake-git-drift" });
});

test("Git snapshot validation does not run configured filters or fsmonitor hooks", async t => {
	const context = await fixture(t, { withGit: true });
	await save(context.cached, ".gitattributes", "*.lean filter=fail\n");
	await git(context.cached, "add", ".gitattributes");
	await git(context.cached, "commit", "--quiet", "-m", "Declare filter");
	context.manifest.packages[1].rev = await git(context.cached, "rev-parse", "HEAD");
	await context.lock();
	await git(context.cached, "config", "filter.fail.clean", "touch FILTER_EXECUTED; exit 1");
	await git(context.cached, "config", "filter.fail.required", "true");
	await git(context.cached, "config", "core.fsmonitor", "touch FSMONITOR_EXECUTED; exit 1");
	const before = await inputState(context.cached);
	await context.capture();
	assert.deepEqual(await inputState(context.cached), before);
});

test("SHA-256 Git object databases verify against their full commit and blob identities", async t => {
	const context = await fixture(t, { withGit: true, objectFormat: "sha256" });
	assert.equal(context.manifest.packages[1].rev.length, 64);
	await assertJsonSchema("lake-dependency-snapshot", (await context.capture()).document);
	await save(context.cached, "Remote.lean", "-- changed\n");
	await assert.rejects(context.capture, { code: "lake-git-drift" });
});

test("Git replacement refs cannot substitute a different source tree for the locked commit", async t => {
	const context = await fixture(t, { withGit: true });
	const original = await context.capture();
	await save(context.cached, "Remote.lean", "-- replacement\n");
	await git(context.cached, "add", "Remote.lean");
	await git(context.cached, "commit", "--quiet", "-m", "Replacement");
	const replacement = await git(context.cached, "rev-parse", "HEAD");
	const pin = context.manifest.packages[1].rev;
	await git(context.cached, "replace", pin, replacement);
	await git(context.cached, "update-ref", "HEAD", pin);
	await save(context.cached, "Remote.lean", "def Remote.value : Nat := 42\n");
	assert.deepEqual(await context.capture(), original);
});

for(const kind of ["commit", "tree"])
	test(`corrupt cached Git ${kind} objects cannot retain the pinned identity`, async t => {
		const context = await fixture(t, { withGit: true });
		const identity = await git(context.cached, "rev-parse", kind === "commit" ? "HEAD" : "HEAD^{tree}");
		const path = join(context.cached, ".git/objects", identity.slice(0, 2), identity.slice(2));
		const original = inflateSync(await readFile(path));
		const changed = Buffer.from(original);
		const marker = kind === "commit" ? "Pinned dependency" : "Remote.lean";
		const index = changed.indexOf(marker);
		assert.ok(index > 0);
		changed[index] = kind === "commit" ? 88 : 83;
		await chmod(path, 0o600);
		await writeFile(path, deflateSync(changed));
		// Some Git versions reject the corrupt object before the bridge hashes it.
		await assert.rejects(context.capture, error => ["lake-git-drift", "lake-git-unavailable"].includes(error.code));
	});

test("missing promisor objects fail offline without invoking remote helpers", async t => {
	const context = await fixture(t, { withGit: true });
	await git(context.cached, "config", "extensions.partialClone", "origin");
	await git(context.cached, "config", "remote.origin.promisor", "true");
	await git(context.cached, "config", "remote.origin.url", "ext::sh -c touch% REMOTE_EXECUTED");
	await git(context.cached, "config", "protocol.ext.allow", "always");
	const identity = await git(context.cached, "rev-parse", "HEAD^{tree}");
	await rm(join(context.cached, ".git/objects", identity.slice(0, 2), identity.slice(2)));
	const before = await inputState(context.cached);
	await assert.rejects(context.capture, { code: "lake-git-unavailable" });
	assert.deepEqual(await inputState(context.cached), before);
});

for(const [label, path, mode] of [["symlinks", "Link", "120000"], ["submodules", "Nested", "160000"], ["excluded inputs", ".env", "100644"]])
	test(`locked Git rejects tracked ${label}`, async t => {
		const context = await fixture(t, { withGit: true });
		let identity = context.manifest.packages[1].rev;
		if(mode !== "160000")
		{
			await save(context.cached, "temporary-input", "input");
			identity = await git(context.cached, "hash-object", "-w", "temporary-input");
			await rm(join(context.cached, "temporary-input"));
		}
		await git(context.cached, "update-index", "--add", "--cacheinfo", `${mode},${identity},${path}`);
		await git(context.cached, "commit", "--quiet", "-m", "Unsupported entry");
		context.manifest.packages[1].rev = await git(context.cached, "rev-parse", "HEAD");
		await context.lock();
		await assert.rejects(context.capture, { code: "unsafe-lake-source" });
	});

test("missing lock never creates a lock or invokes Lake", async t => {
	const context = await fixture(t);
	await rm(join(context.root, "lake-manifest.json"));
	const before = await inputState(context.root);
	await assert.rejects(context.capture, { code: "missing-lake-lock" });
	assert.deepEqual(await inputState(context.root), before);
});

test("malformed lock fields and nonportable or duplicate package names fail closed", async t => {
	const context = await fixture(t);
	const entry = context.manifest.packages[0];
	const invalid = [null, [], {}, { ...context.manifest, version: 7 }
		, { ...context.manifest, version: "1.3.0" }
		, { ...context.manifest, extra: true }, { ...context.manifest, name: 1 }
		, { ...context.manifest, fixedToolchain: "true" }
		, { ...context.manifest, lakeDir: null }
		, { ...context.manifest, packagesDir: "../outside" }
		, { ...context.manifest, packages: [entry, entry] }
		, ...[{ name: "../escape" }, { name: "." }, { inherited: null }
			, { scope: 123 }, { dir: "/tmp" }
			, { type: "registry" }, { configFile: "../lakefile.toml" }
			, { manifestFile: "../../lock" }, { dir: "C:\\temp" }]
			.map(change => ({ ...context.manifest, packages: [{ ...entry, ...change }] }))];
	for(const manifest of invalid)
	{
		await save(context.root, "lake-manifest.json", JSON.stringify(manifest));
		await assert.rejects(context.capture, { code: "invalid-lake-snapshot" });
	}
	await save(context.root, "lake-manifest.json", "{");
	await assert.rejects(context.capture, { code: "invalid-lake-snapshot" });
	await save(context.root, "lake-manifest.json", Buffer.from([255]));
	await assert.rejects(context.capture, { code: "invalid-lake-snapshot" });
});

test("local dependencies cannot contain the root project or resolve through symlinks", async t => {
	const context = await fixture(t);
	for(const dir of [".", "..", "../../../../../../../../.."])
	{
		context.manifest.packages[0].dir = dir;
		await context.lock();
		await assert.rejects(context.capture, { code: "unsafe-lake-source" });
	}
	await symlink(context.local, join(context.directory, "workspace/link"));
	context.manifest.packages[0].dir = "../link";
	await context.lock();
	await assert.rejects(context.capture, { code: "unsafe-lake-source" });
});

test("symlinked local files and directories cannot enter a snapshot", async t => {
	const context = await fixture(t);
	for(const target of [join(context.local, "Local.lean"), join(context.local, "native")])
	{
		await symlink(target, join(context.local, "linked"));
		await assert.rejects(context.capture, { code: "unsafe-lake-source" });
		await rm(join(context.local, "linked"));
	}
});

test("toolchains must be pinned and match every dependency's declared release", async t => {
	const context = await fixture(t);
	for(const version of ["leanprover/lean4:stable\n", "leanprover/lean4:nightly\n", "../toolchain\n"])
	{
		await save(context.root, "lean-toolchain", version);
		await assert.rejects(context.capture, { code: "unpinned-lake-toolchain" });
	}
	await save(context.root, "lean-toolchain", toolchain);
	await save(context.local, "lean-toolchain", "leanprover/lean4:v4.31.0\n");
	await assert.rejects(context.capture, { code: "incompatible-lake-toolchain" });
});

test("missing declared manifests and configuration files fail before writing outputs", async t => {
	const context = await fixture(t);
	await rm(join(context.local, "lake-manifest.json"));
	await assert.rejects(context.capture, { code: "missing-lake-input" });
	context.manifest.packages[0].manifestFile = null;
	await context.lock();
	await rm(join(context.local, "lakefile.toml"));
	await assert.rejects(context.capture, { code: "missing-lake-input" });
});

test("aggregate limits cover root inputs, package count, bytes and file count", async t => {
	const context = await fixture(t, { withGit: true });
	for(const limits of [{ packages: 1 }, { files: 2 }, { fileBytes: 1 }, { totalBytes: 10 }])
		await assert.rejects(() => context.capture({ limits }), error => ["invalid-lake-snapshot", "lake-snapshot-limit"].includes(error.code));
	for(const limits of [{ files: 0 }, { packages: -1 }, { fileBytes: 1.5 }, { maximum: 1 }])
		await assert.rejects(() => context.capture({ limits }), { code: "invalid-lake-snapshot" });
	context.manifest.packages = [];
	await context.lock();
	await assert.rejects(() => context.capture({ limits: { totalBytes: 1 } }), { code: "lake-snapshot-limit" });
	await assert.rejects(() => context.capture({ limits: { files: 1 } }), { code: "lake-snapshot-limit" });
	const snapshot = await context.capture();
	await assertJsonSchema("lake-dependency-snapshot", snapshot.document);
});

test("verification honors capture limits and allows only the snapshot manifest overhead", async t => {
	const context = await fixture(t);
	const limits = { fileBytes: 2048, totalBytes: 4096, files: 10 };
	const snapshot = await context.capture({ limits });
	const result = await write(context, snapshot);
	await verifyLakeDependencySnapshot({ snapshot, snapshotRoot: result.output });
	await save(result.output, "packages/Local/extra", "x".repeat(4097));
	await assert.rejects(() => verifyLakeDependencySnapshot({ snapshot, snapshotRoot: result.output }), { code: "lake-snapshot-limit" });
});

test("explicit larger file limits survive snapshot writing and verification", async t => {
	const context = await fixture(t);
	await save(context.local, "assets/large.bin", Buffer.alloc(17 * 1024 * 1024, 42));
	await assert.rejects(context.capture, { code: "lake-snapshot-limit" });
	const snapshot = await context.capture({ limits: { fileBytes: 17 * 1024 * 1024, totalBytes: 18 * 1024 * 1024 } });
	const { output } = await write(context, snapshot);
	await verifyLakeDependencySnapshot({ snapshot, snapshotRoot: output });
});

test("cancelled captures and writes leave inputs and destinations untouched", async t => {
	const context = await fixture(t);
	const before = await inputState(context.root);
	await assert.rejects(() => context.capture({ signal: AbortSignal.abort() }), { name: "AbortError" });
	const snapshot = await context.capture();
	await assert.rejects(() => writeLakeDependencySnapshot({ snapshot, outputRoot: join(context.directory, "cancelled"), signal: AbortSignal.abort() }), { name: "AbortError" });
	await assert.rejects(() => lstat(join(context.directory, "cancelled")), { code: "ENOENT" });
	assert.deepEqual(await inputState(context.root), before);
});

test("cancellation after staging begins removes only the new partial snapshot", async t => {
	const context = await fixture(t);
	const snapshot = await context.capture();
	const controller = new AbortController();
	const original = controller.signal.throwIfAborted.bind(controller.signal);
	let checks = 0;
	t.mock.method(controller.signal, "throwIfAborted", () => {
		if(++checks === 3) controller.abort();
		original();
	});
	const outputRoot = join(context.directory, "partial");
	const before = await inputState(join(context.directory, "workspace"));
	await assert.rejects(() => writeLakeDependencySnapshot({ snapshot, outputRoot, signal: controller.signal }), { name: "AbortError" });
	assert.equal(checks, 3);
	await assert.rejects(() => lstat(outputRoot), { code: "ENOENT" });
	assert.deepEqual(await inputState(join(context.directory, "workspace")), before);
});

test("snapshot writes reject occupied paths, input roots, ancestors and symlinked destinations", async t => {
	const context = await fixture(t);
	const snapshot = await context.capture();
	const occupied = join(context.directory, "occupied");
	await writeFile(occupied, "keep me");
	await assert.rejects(() => writeLakeDependencySnapshot({ snapshot, outputRoot: occupied }), { code: "EEXIST" });
	assert.equal(await readFile(occupied, "utf8"), "keep me");
	for(const outputRoot of [context.root, context.local, context.directory, "/", join(context.root, "snapshot"), join(context.local, "snapshot")])
		await assert.rejects(() => writeLakeDependencySnapshot({ snapshot, outputRoot }), { code: "unsafe-lake-output" });
	await mkdir(join(context.directory, "real"));
	await symlink(join(context.directory, "real"), join(context.directory, "alias"));
	await assert.rejects(() => writeLakeDependencySnapshot({ snapshot, outputRoot: join(context.directory, "alias/snapshot") }), { code: "unsafe-lake-output" });
	await assert.rejects(() => writeLakeDependencySnapshot({ snapshot: structuredClone(snapshot), outputRoot: occupied }), { code: "invalid-lake-snapshot" });
});

for(const [label, change, code] of [
	["corrupt input", root => save(root, "packages/Local/Local.lean", "corrupt"), "lake-snapshot-drift"]
	, ["missing input", root => rm(join(root, "packages/Local/Local.lean")), "lake-snapshot-drift"]
	, ["extra input", root => save(root, "extra", "unrecorded"), "lake-snapshot-drift"]
	, ["mode change", root => chmod(join(root, "packages/Local/Local.lean"), 0o755), "lake-snapshot-drift"]
	, ["corrupt manifest", root => save(root, "lake-dependency-snapshot.json", "{}"), "lake-snapshot-drift"]
	, ["missing manifest", root => rm(join(root, "lake-dependency-snapshot.json")), "lake-snapshot-drift"]
	, ["extra symlink", root => symlink("packages", join(root, "linked")), "unsafe-lake-source"]
]) test(`snapshot verification rejects ${label}`, async t => {
	const context = await fixture(t);
	const snapshot = await context.capture();
	const { output } = await write(context, snapshot);
	await change(output);
	await assert.rejects(() => verifyLakeDependencySnapshot({ snapshot, snapshotRoot: output }), { code });
});
