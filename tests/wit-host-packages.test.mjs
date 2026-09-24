/**
 * Installed WIT library isolation with genuine independently compiled Lean.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdtemp, mkdir, readFile, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { verifyNativeFiles } from "../src/build/native-artifacts.mjs";
import { nativeFixtureEnvironment, runCopied, copiedCleanEnvironment } from "./helpers/copied-fixture-install.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

test("installed WIT hosts reject conflicting binaries and retain compatible and independent packages", {
	skip: process.env.LEAN_BRIDGE_WIT_HOST_PACKAGES_TEST !== "1"
	, timeout: 1_200_000
}, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-wit-host-packages-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const environment = nativeFixtureEnvironment(["wit-wasi"]), packages = [];
	for(const [index, name, answer] of [[0, "witprobe", 11], [1, "witprobe", 21], [2, "otherprobe", 31]])
	{
		const author = join(root, `author-${index}`), projectRoot = join(author, "project"), outputRoot = join(author, "release");
		await saveLakeFile(projectRoot, "Probe.lean", `namespace Probe\ninductive Tree where\n  | leaf (value : UInt32)\n  | next (child : Tree)\ndef evaluate (_ : Tree) : UInt32 := ${answer}\nend Probe\n`);
		await saveLakeFile(projectRoot, "lean-toolchain", "leanprover/lean4:v4.32.2\n");
		await saveLakeFile(projectRoot, "lakefile.toml", `name = "${name}"\nversion = "1.0.0"\n[[lean_lib]]\nname = "Probe"\n`);
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1, modules: ["Probe"], exports: ["Probe.evaluate"], targets: { "wit-wasi": { name, version: "1.0.0" } } }));
		t.diagnostic(`Building ${name}: expected answer ${answer}`);
		const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: ["wit-wasi"], environment })
			.catch(error => { error.message += `: ${JSON.stringify(error.details)}`; throw error; });
		const archive = built.packages[0], install = join(root, `install-${index}`); await mkdir(install);
		await runCopied("/usr/bin/tar", ["--use-compress-program=/usr/bin/gzip", "-xf", join(outputRoot, "archives", archive.archive), "-C", install], root);
		const directory = join(install, `${name}-1.0.0-wit-wasi`), receipt = JSON.parse(await readFile(join(directory, "lean-bridge-package.json")));
		await verifyNativeFiles(directory, receipt.files);
		packages.push({ directory, name, answer, archive, receipt, component: JSON.parse(await readFile(join(directory, "share/lean-bridge/component/native-component.json"))) });
		await rm(author, { recursive: true, force: true });
	}
	assert.notEqual(packages[0].component.nativeLibrary.sha256, packages[1].component.nativeLibrary.sha256);
	assert.notEqual(packages[0].component.library, packages[2].component.library);
	const duplicate = join(root, "identical-relocated-copy"); await cp(packages[0].directory, duplicate, { recursive: true });
	packages.push({ ...packages[0], directory: duplicate });
	const tools = join(root, "tools"); await mkdir(tools);
	for(const tool of ["as", "ld"]) await symlink(`/usr/bin/${tool}`, join(tools, tool));
	const consumer = await readFile("tests/fixtures/recursive-consumers/wit-package-conflict.c");
	await saveLakeFile(root, "consumer.c", consumer);
	await runCopied("/usr/bin/cc", ["-std=c11", "-Wall", "-Wextra", "-Werror", "-UNDEBUG", "-I", join(packages[0].directory, "include"), "-I", join(packages[2].directory, "include"), "consumer.c", "-ldl", "-o", "consumer"], root, { ...copiedCleanEnvironment, PATH: tools });
	await rm(join(root, "consumer.c")); await rm(tools, { recursive: true, force: true });
	const results = [];
	for(const visibility of ["local", "global"]) for(const [first, second, rejected] of [[0, 1, true], [1, 0, true], [0, 3, false], [3, 0, false], [0, 2, false], [2, 0, false]])
	{
		const a = packages[first], b = packages[second];
		const args = [visibility, a.name === "otherprobe" ? "1" : "0", join(a.directory, `lib/lib${a.name}_wasmtime.so`), String(a.answer), b.name === "otherprobe" ? "1" : "0", join(b.directory, `lib/lib${b.name}_wasmtime.so`), String(rejected ? -1 : b.answer), "none"];
		const result = await runCopied(join(root, "consumer"), args, root);
		assert.equal(result.stderr, ""); const observation = JSON.parse(result.stdout);
		assert.equal(observation.first, a.answer); assert.equal(observation.firstAfter, a.answer);
		assert.equal(observation.secondRejected, rejected); assert.equal(observation.inheritedHostRejected, true);
		assert.equal(observation.second, rejected ? 0xabcdef : b.answer);
		results.push({ visibility, first, second, observation }); t.diagnostic(JSON.stringify(results.at(-1)));
	}
	for(const visibility of ["local", "global"]) for(const [first, preloaded] of [[0, 1], [1, 0]])
	{
		const a = packages[first], b = packages[preloaded], library = join(a.directory, "lib/libwitprobe_wasmtime.so");
		const result = await runCopied(join(root, "consumer"), [visibility, "0", library, "-1", "0", library, "-1", join(b.directory, "lib", b.component.library)], root);
		assert.equal(result.stderr, ""); const observation = JSON.parse(result.stdout);
		assert.deepEqual(observation, { firstRejected: true }); results.push({ visibility, first, preloaded, observation });
	}
	const dependencies = Object.keys(packages[0].receipt.files).filter(path => /^lib\/[^/]+\.so$/.test(path) && !path.endsWith("_wasmtime.so"));
	assert.equal(dependencies.length, 5);
	for(const path of dependencies)
	{
		const original = await readFile(join(duplicate, path));
		// Appending a byte leaves valid ELF code intact but changes its identity.
		await saveLakeFile(duplicate, path, Buffer.concat([original, Buffer.from([1])]));
		for(const visibility of ["local", "global"])
		{
			const library = join(packages[0].directory, "lib/libwitprobe_wasmtime.so");
			const result = await runCopied(join(root, "consumer"), [visibility, "0", library, "-1", "0", library, "-1", join(duplicate, path)], root);
			assert.equal(result.stderr, ""); const observation = JSON.parse(result.stdout);
			assert.deepEqual(observation, { firstRejected: true }); results.push({ visibility, tamperedDependency: path, observation });
		}
		await saveLakeFile(duplicate, path, original);
	}
	for(const item of packages) await verifyNativeFiles(item.directory, item.receipt.files);
	await saveLakeFile("build/recursive-wit", "host-isolation.json", canonicalJson({ schemaVersion: 1
		, kind: "installed-wit-host-isolation", sourceFree: true
		, consumerSha256: sha256(consumer)
		, executableSha256: sha256(await readFile(join(root, "consumer")))
		, packages: packages.map(item => {
			const copy = { ...item }; delete copy.directory; return copy;
		})
		, results }));
});
