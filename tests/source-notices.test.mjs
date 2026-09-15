/**
 * Source notices survive relocation and reject drift independently of archives.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rename, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { inspectLeanProject } from "../src/analyze/lean-project.mjs";
import { prepareLakeDependencySnapshot, writeLakeDependencySnapshot } from "../src/build/lake-dependency-snapshot.mjs";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { captureSourceNotices, isSourceNotice, readVerifiedSourceNotices } from "../src/release/source-notices.mjs";
import { lakeWorkspaceFixture, saveLakeFile } from "./helpers/lake-workspace.mjs";

test("notice discovery includes nested, case-insensitive and REUSE notices without matching source code", () => {
	for(const path of ["LICENSE", "LICENCE.md", "licenses/MIT.txt", "nested/NOTICE", "nested/license-apache", "COPYRIGHT", "legal/COPYING.LESSER", "vendor/LICENSES/a file.txt"])
		assert.equal(isSourceNotice(path), true, path);
	for(const path of ["Licenses.lean", "NOTICEBOARD.md", "src/Notice.lean", "/LICENSE", "../LICENSE", "foo/../LICENSE", "foo\\LICENSE", "COPYRIGHT\n", "secrets.txt", "LICENSES/.env", "LICENSES/.npmrc", ".secrets/LICENSE"])
		assert.equal(isSourceNotice(path), false, path);
});

const prepared = async t => {
	const context = await lakeWorkspaceFixture(t);
	await saveLakeFile(context.root, "licence.md", "A separate root notice.\n");
	await saveLakeFile(context.root, "LICENSES/custom terms.txt", "Custom terms fixture.\n");
	const analysis = await inspectLeanProject(context.root);
	const snapshot = await prepareLakeDependencySnapshot({ projectRoot: context.root, includeProject: true });
	const snapshotRoot = join(context.directory, "snapshot");
	await writeLakeDependencySnapshot({ snapshot, outputRoot: snapshotRoot });
	const capture = () => captureSourceNotices({ projectRoot: context.root
		, projectName: analysis.project.name, inputs: analysis.inputs
		, sourceTreeSha256: analysis.sourceTreeSha256, snapshot, snapshotRoot });
	const notices = await capture(), root = join(context.directory, "compiled");
	for(const [path, bytes] of notices.files) await saveLakeFile(root, path, bytes);
	const sourceIdentity = { sourceTreeSha256: analysis.sourceTreeSha256
		, sourceNoticesSha256: notices.sha256
		, lakeDependencies: { snapshot: snapshot.document, snapshotSha256: snapshot.sha256 } };
	return { ...context, analysis, notices, root, sourceIdentity, capture };
};

test("compiled notices retain the library, local and pinned Git licenses after sources disappear", async t => {
	const context = await prepared(t);
	assert.deepEqual(context.notices.document.packages.map(pkg => [pkg.name, pkg.notices.map(file => file.path)]), [
		["shop", ["LICENSE", "LICENSES/custom terms.txt", "legal/NOTICE.txt", "licence.md"]]
		, ["Catalog", ["COPYRIGHT"]], ["Units", ["LICENSES/Apache-2.0.txt"]]
	]);
	const repeat = await context.capture();
	assert.deepEqual(repeat, context.notices);
	await rename(context.workspace, join(context.directory, "hidden-source"));
	const verified = await readVerifiedSourceNotices(context.root, context.sourceIdentity);
	assert.deepEqual(verified.document, context.notices.document);
	assert.deepEqual(verified.files, context.notices.files);
});

test("missing notices stay explicit and do not borrow Lean Bridge's license", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-no-notices-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const sourceTreeSha256 = sha256("");
	const result = await captureSourceNotices({ projectRoot: root, projectName: "private-library", inputs: [], sourceTreeSha256 });
	assert.deepEqual(result.document.packages, [{ name: "private-library", source: { kind: "root", sourceTreeSha256, inputs: [] }, notices: [] }]);
	for(const [path, bytes] of result.files) await saveLakeFile(root, path, bytes);
	await readVerifiedSourceNotices(root, { sourceTreeSha256, sourceNoticesSha256: result.sha256 });
});

test("identical notices share payload bytes while preserving both original paths", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-identical-notices-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const contents = "Identical notice fixture.\n";
	for(const path of ["LICENSE", "legal/COPYING"]) await saveLakeFile(root, path, contents);
	const analysis = await inspectLeanProject(root);
	const result = await captureSourceNotices({ projectRoot: root, projectName: "example", inputs: analysis.inputs, sourceTreeSha256: analysis.sourceTreeSha256 });
	assert.deepEqual(result.document.packages[0].notices.map(file => file.path), ["LICENSE", "legal/COPYING"]);
	assert.equal(result.files.size, 2);
	for(const [path, bytes] of result.files) await saveLakeFile(root, path, bytes);
	assert.equal((await readVerifiedSourceNotices(root, { sourceTreeSha256: analysis.sourceTreeSha256, sourceNoticesSha256: result.sha256 })).files.size, 2);
});

test("notice capture rejects changed bytes and symlinks", async t => {
	const context = await prepared(t);
	const path = join(context.workspace, "project/LICENSE");
	const original = await readFile(path);
	await saveLakeFile(context.workspace, "project/LICENSE", "changed\n");
	await assert.rejects(context.capture(), /changed after capture/);
	await rm(path);
	await saveLakeFile(context.directory, "outside-LICENSE", original);
	await symlink(join(context.directory, "outside-LICENSE"), path);
	await assert.rejects(context.capture(), /without symlinks/);
});

test("notice verification rejects payload corruption, extra files and altered inventories", async t => {
	const context = await prepared(t), path = context.notices.document.packages[0].notices[0].payload;
	await saveLakeFile(context.root, path, "changed\n");
	await assert.rejects(readVerifiedSourceNotices(context.root, context.sourceIdentity), /payload drift/);
	await saveLakeFile(context.root, path, context.notices.files.get(path));
	await saveLakeFile(context.root, "source-notices/unrecorded.txt", "extra");
	await assert.rejects(readVerifiedSourceNotices(context.root, context.sourceIdentity), /Unexpected source notice/);
	await rm(join(context.root, "source-notices/unrecorded.txt"));
	await saveLakeFile(context.root, "source-notices.json", canonicalJson({ ...context.notices.document, kind: "other" }));
	await assert.rejects(readVerifiedSourceNotices(context.root, context.sourceIdentity), /differs from compilation/);
});

test("resealing a notice inventory cannot omit root or dependency notices, change sources or redirect a payload", async t => {
	const context = await prepared(t);
	for(const mutate of [
		document => { document.packages[1].notices = []; }
		, document => { document.packages[0].notices = []; }
		, document => { document.packages[0].source.inputs = []; }
		, document => { document.packages.pop(); }
		, document => { document.packages[0].notices[0].payload = "../LICENSE"; }
		, document => { document.packages[0].source.sourceTreeSha256 = "0".repeat(64); }
	]) {
		const changed = structuredClone(context.notices.document); mutate(changed);
		const bytes = canonicalJson(changed);
		await saveLakeFile(context.root, "source-notices.json", bytes);
		await assert.rejects(readVerifiedSourceNotices(context.root, { ...context.sourceIdentity, sourceNoticesSha256: sha256(bytes) }));
	}
});
