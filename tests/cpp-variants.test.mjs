/**
 * Ordinary and reviewed variants through relocated, offline-installed C++ archives.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, rename, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { sourceApiIdentity } from "../src/analyze/semantic-model.mjs";
import { verifyNativeFiles } from "../src/build/native-artifacts.mjs";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { nativeVariantReviewedIr, nativeVariantSignatures } from "./helpers/native-variant-fixture.mjs";
import { checkNativeVariantFaults } from "./helpers/native-variant-faults.mjs";
import { copiedCleanEnvironment, nativeFixtureEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";

const shape = ir => ({
	declarations: ir.declarations.map(item => ({ id: item.id, parameters: item.parameters.map(p => p.type), result: item.result.type })).sort((a, b) => a.id.localeCompare(b.id))
	, types: ir.types.map(type => ({ id: type.id, name: type.name, kind: type.kind
		, fields: type.fields.map(({ name, type }) => ({ name, type }))
		, cases: type.cases.map(branch => ({ name: branch.name, fields: branch.fields.map(({ name, type }) => ({ name, type })) })) })).sort((a, b) => a.id.localeCompare(b.id))
});

test("installed C++ variants preserve every named constructor and copied payload", { skip: process.env.LEAN_BRIDGE_CPP_VARIANT_TEST !== "1", timeout: 900_000 }, async t => {
	const reports = [], environment = nativeFixtureEnvironment(["cpp"]);
	for(const path of ["ordinary-source", "reviewed-ir"])
	{
		const author = await mkdtemp(join(tmpdir(), "lean-bridge-variant-author-"));
		const consumer = await mkdtemp(join(tmpdir(), "lean-bridge-variant-consumer-"));
		t.after(() => Promise.all([author, consumer].map(root => rm(root, { recursive: true, force: true }))));
		const projectRoot = join(author, "project"), outputRoot = join(author, "release"), handoff = join(consumer, "handoff");
		await cp("tests/fixtures/onboarding/native-variants", projectRoot, { recursive: true });
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1
			, modules: ["Variants"]
			, targets: { cpp: { name: "variants", version: "1.0.0" } }
			, ...(path === "ordinary-source" ? { exports: nativeVariantSignatures.map(item => item.name) } : {}) }));
		if(path === "reviewed-ir") await saveLakeFile(projectRoot, "reviewed.binding-ir.json", canonicalJson(nativeVariantReviewedIr()));
		t.diagnostic(`${path}: compiling native C++ variants`);
		const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: ["cpp"], environment }).catch(error => {
			error.message += `: ${JSON.stringify(error.details)}`; throw error;
		});
		const model = JSON.parse(await readFile(join(outputRoot, "native/component/model.json")));
		assert.deepEqual(shape(model.bindingIr), shape(nativeVariantReviewedIr()));
		const faultChecks = await checkNativeVariantFaults(outputRoot, join(author, "faults"), environment);
		const receipt = await copyPackageSetHandoff(outputRoot, handoff);
		await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		await rm(author, { recursive: true, force: true });
		const packages = receipt.packages.filter(pkg => pkg.target === "cpp"), pkg = packages[0];
		assert.equal(packages.length, 1);
		const root = join(consumer, "install"), directory = `${pkg.name}-${pkg.version}-cpp`, installed = join(root, directory);
		const source = await readFile("tests/fixtures/variant-consumers/cpp.cpp", "utf8");
		await saveLakeFile(root, "consumer.cpp", source);
		await runCopied("/usr/bin/tar", ["--use-compress-program=/usr/bin/gzip", "-xf", join(handoff, pkg.artifacts[0].path)], root);
		const installedReceipt = JSON.parse(await readFile(join(installed, "lean-bridge-package.json")));
		await verifyNativeFiles(installed, installedReceipt.files);
		const tools = join(root, "tools"); await mkdir(tools);
		for(const name of ["as", "ld"]) await symlink(`/usr/bin/${name}`, join(tools, name));
		const compile = { ...copiedCleanEnvironment, PATH: tools, PKG_CONFIG_LIBDIR: join(installed, "lib/pkgconfig"), PKG_CONFIG_PATH: "" };
		const flags = (await runCopied("/usr/bin/pkg-config", ["--cflags", "--libs", installedReceipt.pkgConfig], root, compile)).stdout.trim().split(/\s+/);
		assert.equal(flags.filter(flag => flag.startsWith("-Wl,-rpath,")).length, 1);
		const relativeFlags = flags.map(flag => flag.startsWith("-Wl,-rpath,") ? `-Wl,-rpath,$ORIGIN/${directory}/lib` : flag);
		await runCopied("/usr/bin/c++", ["-std=c++20", "-Wall", "-Wextra", "-Werror", "-UNDEBUG", "consumer.cpp", ...relativeFlags, "-o", "consumer"], root, compile);
		const executableSha256 = sha256(await readFile(join(root, "consumer")));
		await rm(handoff, { recursive: true, force: true });
		await rm(tools, { recursive: true, force: true });
		await rm(join(root, "consumer.cpp"));
		const relocated = join(consumer, "relocated"); await rename(root, relocated);
		const runs = [];
		for(let attempt = 0; attempt < 2; ++attempt)
		{
			const result = await runCopied(join(relocated, "consumer"), [], relocated);
			assert.equal(result.stderr, "");
			const lines = result.stdout.trim().split("\n"), counts = /^variant-ok:(\d+):(\d+):(\d+):(\d+)$/.exec(lines.shift());
			assert.ok(counts, result.stdout);
			const [checks, calls, rejected, allocationFailures] = counts.slice(1).map(Number);
			assert.ok(checks > 10000 && calls > 1000 && rejected >= 9 && allocationFailures > 10);
			const loadedLibraries = [];
			for(const line of lines)
			{
				assert.ok(line.startsWith("library:"));
				const file = line.slice(8), name = relative(join(relocated, directory), file);
				assert.ok(name.startsWith("lib/") && !name.includes(".."), file);
				assert.equal(sha256(await readFile(file)), installedReceipt.files[name].sha256);
				loadedLibraries.push({ path: name, ...installedReceipt.files[name] });
			}
			assert.equal(loadedLibraries.length, 4);
			await verifyNativeFiles(join(relocated, directory), installedReceipt.files);
			assert.equal(sha256(await readFile(join(relocated, "consumer"))), executableSha256);
			runs.push({ checks, calls, rejected, allocationFailures, loadedLibraries });
		}
		assert.deepEqual(runs[0], runs[1]);
		reports.push({ profile: "cpp", path, runs, packages, faultChecks
			, consumerSha256: sha256(source), executableSha256
			, installedFiles: installedReceipt.files
			, bindingIrSha256: built.bindingIrSha256
			, sourceTreeSha256: model.sourceIdentity.sourceTreeSha256
			, sourceApiSha256: sourceApiIdentity(model.bindingIr).sha256
			, modelSha256: sha256(canonicalJson(model))
			, receiptSha256: sha256(canonicalJson(receipt))
			, offlineInstall: true, compilerFreePath: true, relocatedInstallation: true
			, sourceRemovedBeforeInstallation: true, handoffRemovedBeforeExecution: true
			, installedFilesUnchanged: true, repeatExecution: true });
		t.diagnostic(`${path}: ${runs[0].checks} assertions; ${runs[0].allocationFailures} C++ allocation failures recovered`);
		await rm(consumer, { recursive: true, force: true });
	}
	await saveLakeFile("build/variants", "cpp.json", canonicalJson({ schemaVersion: 1, reports }));
});
