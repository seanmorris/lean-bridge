/**
 * Offline ordinary projects with local and transitively imported Git packages.
 *
 * @file
 */
import { execFile } from "node:child_process";
import { lstat, mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import { sha256 } from "../../src/capsule/node.mjs";

const execute = promisify(execFile);
/**
 * Write a task-owned fixture input.
 *
 * @param root - Fixture directory.
 * @param path - Relative input filename.
 * @param bytes - Source contents.
 */
export const saveLakeFile = async (root, path, bytes) => {
	await mkdir(dirname(join(root, path)), { recursive: true });
	await writeFile(join(root, path), bytes);
};
/**
 * Run Git against a test checkout with deterministic commit identities.
 *
 * @param root - Fixture checkout.
 * @param args - Git arguments.
 */
// Fixture writes must finish before the source-read-only inventory starts.
export const lakeGit = async (root, ...args) => (await execute("git", ["-c", "maintenance.auto=false", "-c", "gc.auto=0", "-C", root, ...args], {
	env: { PATH: process.env.PATH, GIT_CONFIG_NOSYSTEM: "1"
		, GIT_CONFIG_GLOBAL: "/dev/null"
		, GIT_AUTHOR_NAME: "Workspace fixture"
		, GIT_COMMITTER_NAME: "Workspace fixture"
		, GIT_AUTHOR_EMAIL: "fixture@example.invalid"
		, GIT_COMMITTER_EMAIL: "fixture@example.invalid"
		, GIT_AUTHOR_DATE: "2026-09-01T00:00:00Z"
		, GIT_COMMITTER_DATE: "2026-09-01T00:00:00Z" }
})).stdout.trim();

/**
 * Make one of two unrelated dependency-importing packages, without remote access.
 *
 * @param t - Test context responsible for cleanup.
 * @param variant - Which independent fixture to construct.
 */
export const lakeWorkspaceFixture = async (t, variant = "shop") => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-lake-test-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const workspace = join(directory, "original");
	const root = join(workspace, "project"), local = join(workspace, "local");
	const names = variant === "shop"
		? { root: "Shop", local: "Catalog", remote: "Units", operation: "quote" }
		: { root: "Telemetry", local: "Metrics", remote: "Reading", operation: "measure" };
	const cached = join(root, `.lake/packages/${names.remote}`);
	const url = `https://example.invalid/locked/${names.remote}.git`;
	for(const path of [root, local, cached])
		await saveLakeFile(path, "lean-toolchain", "leanprover/lean4:v4.32.2\n");
	await saveLakeFile(cached, "lakefile.toml", `name = "${names.remote}"\nversion = "1.0.0"\n[[lean_lib]]\nname = "${names.remote}"\nsrcDir = "lib"\n`);
	await saveLakeFile(cached, `lib/${names.remote}.lean`, `def ${names.remote}.convert (value : UInt32) : UInt32 := value * ${variant === "shop" ? 2 : 3}\n`);
	await saveLakeFile(cached, "lake-manifest.json", JSON.stringify({ version: "1.2.0", packages: [] }));
	await lakeGit(cached, "init", "--quiet");
	await lakeGit(cached, "add", ".");
	await lakeGit(cached, "commit", "--quiet", "-m", "Offline pinned dependency");
	const rev = await lakeGit(cached, "rev-parse", "HEAD");
	const remote = { type: "git", name: names.remote, inherited: true
		, scope: "", url, rev, inputRev: rev, subDir: null
		, configFile: "lakefile.toml", manifestFile: "lake-manifest.json" };
	await saveLakeFile(local, "lakefile.toml", `name = "${names.local}"\nversion = "1.0.0"\n[[require]]\nname = "${names.remote}"\ngit = "${url}"\nrev = "${rev}"\n[[lean_lib]]\nname = "${names.local}"\n`);
	await saveLakeFile(local, `${names.local}.lean`, `/- import FakeModule -/\nimport ${names.remote}\ndef ${names.local}.${names.operation} (value : UInt32) : UInt32 := ${names.remote}.convert value + 5\n`);
	await saveLakeFile(local, "lake-manifest.json", JSON.stringify({ version: "1.2.0", packages: [{ ...remote, inherited: false }] }));
	await saveLakeFile(root, "lakefile.toml", `name = "${names.root.toLowerCase()}"\nversion = "1.0.0"\n[[require]]\nname = "${names.local}"\npath = "../local"\n[[lean_lib]]\nname = "${names.root}"\n`);
	await saveLakeFile(root, `${names.root}.lean`, `import ${names.local}\nnamespace ${names.root}\ndef ${names.operation} (value : UInt32) : UInt32 := ${names.local}.${names.operation} value + 1\nend ${names.root}\n`);
	await saveLakeFile(root, "lean-bridge.exports.json", JSON.stringify({ schemaVersion: 1
		, modules: [names.root], exports: [`${names.root}.${names.operation}`]
		, targets: { cpan: { module: `LeanBridge::${names.root}`, version: "1.000" } } }));
	const manifest = { version: "1.2.0", name: names.root.toLowerCase()
		, lakeDir: ".lake"
		, packagesDir: ".lake/packages", fixedToolchain: false
		, packages: [{ type: "path", name: names.local, inherited: false
			, dir: "../local", configFile: "lakefile.toml"
			, manifestFile: "lake-manifest.json" }
		, remote] };
	const lock = () => saveLakeFile(root, "lake-manifest.json", JSON.stringify(manifest));
	await lock();
	return { directory, workspace, root, local, cached, names, manifest, lock };
};

/**
 * Move a fixture's selected module into a custom Lake source layout.
 *
 * @param context - Isolated fixture to update before capture.
 */
export const customLakeRoot = async context => {
	const { root, names } = context;
	const sourceDirectory = names.root === "Shop" ? "lean-src" : "source tree/lib";
	await mkdir(join(root, sourceDirectory), { recursive: true });
	await rename(join(root, `${names.root}.lean`), join(root, sourceDirectory, `${names.root}.lean`));
	if(names.root === "Shop")
		await saveLakeFile(root, "lakefile.toml", `${await readFile(join(root, "lakefile.toml"), "utf8")}srcDir = "${sourceDirectory}"\n`);
	else
	{
		await rm(join(root, "lakefile.toml"));
		await saveLakeFile(root, "lakefile.lean", `import Lake\nopen Lake DSL\npackage telemetry where\n  version := v!"1.0.0"\n  srcDir := "source tree"\nrequire Metrics from "../local"\nlean_lib Telemetry where\n  srcDir := "lib"\n`);
	}
	// Captured, but outside the selected Lake library and its import closure.
	await saveLakeFile(root, "other-source/Unused.lean", "import DeliberatelyAbsent\n");
	return `${sourceDirectory}/${names.root}.lean`;
};

/**
 * Add a Lake-declared C input, optionally referenced by a foreign Lean function.
 *
 * @param context - Offline fixture whose lock is updated to its new test commit.
 * @param foreign - Whether to select the deliberately unreviewed foreign call.
 */
export const nativeLakeInput = async (context, foreign = false) => {
	const { cached, local, names, manifest } = context;
	await saveLakeFile(cached, "lakefile.toml", `name = "${names.remote}"\nversion = "1.0.0"\n[[input_file]]\nname = "conversion"\npath = "native code/conversion.c"\n[[lean_lib]]\nname = "${names.remote}"\nsrcDir = "lib"\nmoreLinkObjs = ["conversion"]\n`);
	if(foreign) await saveLakeFile(cached, `lib/${names.remote}.lean`, `@[extern "fixture_convert"]\nopaque ${names.remote}.convert (value : UInt32) : UInt32\n`);
	await saveLakeFile(cached, "native code/conversion.c", '#include "factor.h"\n#include <stdint.h>\nuint32_t fixture_convert(uint32_t value) { return value * FIXTURE_FACTOR; }\n');
	await saveLakeFile(cached, "native code/factor.h", `#define FIXTURE_FACTOR ${names.root === "Shop" ? 2 : 3}\n`);
	await lakeGit(cached, "add", ".");
	await lakeGit(cached, "commit", "--quiet", "-m", "Captured native input");
	const old = manifest.packages[1].rev;
	const rev = await lakeGit(cached, "rev-parse", "HEAD");
	manifest.packages[1].rev = rev;
	manifest.packages[1].inputRev = rev;
	await saveLakeFile(local, "lakefile.toml", (await readFile(join(local, "lakefile.toml"), "utf8")).replaceAll(old, rev));
	await saveLakeFile(local, "lake-manifest.json", (await readFile(join(local, "lake-manifest.json"), "utf8")).replaceAll(old, rev));
	await context.lock();
};

/**
 * Inventory file contents and modification metadata, including original Git data.
 *
 * @param root - Directory to inspect without modifying it.
 */
export const lakeInputState = async root => {
	const entries = [];
	const visit = async prefix => {
		for(const name of (await readdir(join(root, prefix))).sort())
		{
			const path = prefix ? `${prefix}/${name}` : name;
			const stat = await lstat(join(root, path));
			entries.push({ path, mode: stat.mode, mtime: stat.mtimeMs
				, ctime: stat.ctimeMs
				, sha256: stat.isFile() ? sha256(await readFile(join(root, path))) : null });
			if(stat.isDirectory()) await visit(path);
		}
	};
	await visit("");
	return entries;
};
