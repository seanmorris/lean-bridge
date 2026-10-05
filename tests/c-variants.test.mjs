/**
 * Ordinary and reviewed variants through relocated, offline-installed C/GMP archives.
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
import { cVariantReviewedIr, cVariantSignatures } from "./helpers/c-variant-fixture.mjs";
import { checkNativeVariantFaults } from "./helpers/native-variant-faults.mjs";
import { checkCVariantFaults } from "./helpers/c-variant-faults.mjs";
import { gmpIdentity } from "../src/backends/c/gmp.mjs";
import { copiedCleanEnvironment, nativeFixtureEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";

const shape = ir => ({
	declarations: ir.declarations.map(item => ({ id: item.id, parameters: item.parameters.map(p => p.type), result: item.result.type })).sort((a, b) => a.id.localeCompare(b.id))
	, types: ir.types.map(type => ({ id: type.id, name: type.name, kind: type.kind
		, fields: type.fields.map(({ name, type }) => ({ name, type }))
		, cases: type.cases.map(branch => ({ name: branch.name, fields: branch.fields.map(({ name, type }) => ({ name, type })) })) })).sort((a, b) => a.id.localeCompare(b.id))
});

test("installed C and C/GMP variants preserve named constructors and copied payloads", { skip: process.env.LEAN_BRIDGE_C_VARIANT_TEST !== "1", timeout: 900_000 }, async t => {
	const reports = [], environment = nativeFixtureEnvironment(["c"]);
	for(const transport of ["plain", "gmp"]) for(const path of ["ordinary-source", "reviewed-ir"])
	{
		const author = await mkdtemp(join(tmpdir(), "lean-bridge-c-variant-author-"));
		const consumer = await mkdtemp(join(tmpdir(), "lean-bridge-c-variant-consumer-"));
		t.after(() => Promise.all([author, consumer].map(root => rm(root, { recursive: true, force: true }))));
		const projectRoot = join(author, "project"), outputRoot = join(author, "release"), handoff = join(consumer, "handoff");
		await cp("tests/fixtures/onboarding/native-variants", projectRoot, { recursive: true });
		await saveLakeFile(projectRoot, "Variants/Extra.lean", await readFile("tests/fixtures/variant-consumers/Extra.lean", "utf8"));
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1
			, modules: ["Variants", "Variants.Extra"]
			, targets: { c: { name: "variants", version: "1.0.0" } }
			, ...(path === "ordinary-source" ? { exports: cVariantSignatures(transport === "gmp").map(item => item.name) } : {}) }));
		if(path === "reviewed-ir") await saveLakeFile(projectRoot, "reviewed.binding-ir.json", canonicalJson(cVariantReviewedIr(transport === "gmp")));
		t.diagnostic(`${transport}/${path}: compiling C variants`);
		const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: ["c"], environment }).catch(error => {
			error.message += `: ${JSON.stringify(error.details)}`; throw error;
		});
		const model = JSON.parse(await readFile(join(outputRoot, "native/component/model.json")));
		assert.deepEqual(shape(model.bindingIr), shape(cVariantReviewedIr(transport === "gmp")));
		const faultChecks = await checkNativeVariantFaults(outputRoot, join(author, "faults"), environment);
		if(transport === "gmp") faultChecks.gmp = await checkCVariantFaults(outputRoot, join(author, "gmp-faults"), environment);
		const receipt = await copyPackageSetHandoff(outputRoot, handoff);
		await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		await rm(author, { recursive: true, force: true });
		const packages = receipt.packages.filter(pkg => pkg.target === "c"), pkg = packages[0];
		assert.equal(packages.length, 1);
		const root = join(consumer, "install"), directory = `${pkg.name}-${pkg.version}-c`, installed = join(root, directory);
		const source = await readFile(`tests/fixtures/variant-consumers/${transport === "gmp" ? "c.c" : "c-basic.c"}`, "utf8");
		await saveLakeFile(root, "consumer.c", source);
		await runCopied("/usr/bin/tar", ["--use-compress-program=/usr/bin/gzip", "-xf", join(handoff, pkg.artifacts[0].path)], root);
		const installedReceipt = JSON.parse(await readFile(join(installed, "lean-bridge-package.json")));
		await verifyNativeFiles(installed, installedReceipt.files);
		let dependency = null;
		if(transport === "gmp")
		{
			dependency = JSON.parse(await readFile(join(installed, "share/lean-bridge/gmp.json")));
			for(const [key, value] of Object.entries(gmpIdentity)) assert.equal(dependency[key], value);
			assert.equal(dependency.checked, true); await verifyNativeFiles(installed, dependency.files);
			assert.equal(sha256(await readFile(join(installed, "share/lean-bridge/sources/gmp-6.3.0.tar.xz"))), gmpIdentity.sha256);
		}
		const tools = join(root, "tools"); await mkdir(tools);
		for(const name of ["as", "ld"]) await symlink(`/usr/bin/${name}`, join(tools, name));
		const compile = { ...copiedCleanEnvironment, PATH: tools, PKG_CONFIG_LIBDIR: join(installed, "lib/pkgconfig"), PKG_CONFIG_PATH: "" };
		const flags = (await runCopied("/usr/bin/pkg-config", ["--cflags", "--libs", installedReceipt.pkgConfig], root, compile)).stdout.trim().split(/\s+/);
		assert.equal(flags.filter(flag => flag.startsWith("-Wl,-rpath,")).length, 1);
		const relativeFlags = flags.map(flag => flag.startsWith("-Wl,-rpath,") ? `-Wl,-rpath,$ORIGIN/${directory}/lib` : flag);
		await runCopied("/usr/bin/cc", ["-std=c11", "-Wall", "-Wextra", "-Werror", "-UNDEBUG", "consumer.c", ...relativeFlags, "-o", "consumer"], root, compile);
		const executableSha256 = sha256(await readFile(join(root, "consumer")));
		await rm(handoff, { recursive: true, force: true });
		await rm(tools, { recursive: true, force: true });
		await rm(join(root, "consumer.c"));
		const relocated = join(consumer, "relocated"); await rename(root, relocated);
		const runs = [];
		for(let attempt = 0; attempt < 2; ++attempt)
		{
			const result = await runCopied(join(relocated, "consumer"), [], relocated);
			assert.equal(result.stderr, "");
			const lines = result.stdout.trim().split("\n"), counts = /^c-variant-ok:(\d+):(\d+):(\d+)$/.exec(lines.shift());
			assert.ok(counts, result.stdout);
			const [checks, calls, rejected] = counts.slice(1).map(Number);
			assert.ok(checks > 1000 && calls > 100 && rejected >= 1);
			const loadedLibraries = [];
			for(const line of lines)
			{
				assert.ok(line.startsWith("library:"));
				const file = line.slice(8), name = relative(join(relocated, directory), file);
				assert.ok(name.startsWith("lib/") && !name.includes(".."), file);
				assert.equal(sha256(await readFile(file)), installedReceipt.files[name].sha256);
				loadedLibraries.push({ path: name, ...installedReceipt.files[name] });
			}
			assert.equal(loadedLibraries.length, transport === "gmp" ? 6 : 4);
			await verifyNativeFiles(join(relocated, directory), installedReceipt.files);
			assert.equal(sha256(await readFile(join(relocated, "consumer"))), executableSha256);
			runs.push({ checks, calls, rejected, loadedLibraries });
		}
		assert.deepEqual(runs[0], runs[1]);
		reports.push({ profile: "c", transport, path, runs, packages, faultChecks
			, dependency
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
		t.diagnostic(`${transport}/${path}: ${runs[0].checks} assertions and ${runs[0].calls} calls`);
		await rm(consumer, { recursive: true, force: true });
	}
	await saveLakeFile("build/variants", "c.json", canonicalJson({ schemaVersion: 1, reports }));
});
