/**
 * Compiler-authenticated aliases through relocated, offline-installed C/C++ archives.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { sourceApiIdentity } from "../src/analyze/semantic-model.mjs";
import { verifyNativeFiles } from "../src/build/native-artifacts.mjs";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { nativeAliasReviewedIr, nativeAliasSignatures } from "./helpers/native-alias-fixture.mjs";
import { nativeAliasConsumer } from "./helpers/native-alias-consumers.mjs";
import { copiedCleanEnvironment, installCopiedConsumer, nativeFixtureEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";

const shape = ir => ({
	declarations: ir.declarations.map(item => ({ id: item.id, parameters: item.parameters.map(p => p.type), result: item.result.type })).sort((a, b) => a.id.localeCompare(b.id))
	, types: ir.types.map(type => ({ id: type.id, name: type.name, kind: type.kind
		, representation: type.representation, mutability: type.mutability
		, typeParameters: type.typeParameters, target: type.target
		, fields: type.fields.map(({ name, type }) => ({ name, type }))
		, cases: type.cases })).sort((a, b) => a.id.localeCompare(b.id))
});

const recheckRelocated = async (profile, consumer, packages, observation) => {
	const root = join(consumer, profile), pkg = packages.find(item => item.role === "component");
	const directory = `${pkg.name}-${pkg.version}-${profile}`, installed = join(root, directory);
	const receipt = JSON.parse(await readFile(join(installed, "lean-bridge-package.json")));
	const compile = { ...copiedCleanEnvironment, PATH: join(root, "tools"), PKG_CONFIG_LIBDIR: join(installed, "lib/pkgconfig"), PKG_CONFIG_PATH: "" };
	const flags = (await runCopied("/usr/bin/pkg-config", ["--cflags", "--libs", receipt.pkgConfig], root, compile)).stdout.trim().split(/\s+/);
	assert.equal(flags.filter(flag => flag.startsWith("-Wl,-rpath,")).length, 1);
	// An application chooses its installation layout. Link that relative layout
	// before moving it; the package's own libraries already use $ORIGIN.
	const relative = flags.map(flag => flag.startsWith("-Wl,-rpath,") ? `-Wl,-rpath,$ORIGIN/${directory}/lib` : flag);
	const extension = profile === "cpp" ? "cpp" : "c";
	await runCopied(profile === "cpp" ? "/usr/bin/c++" : "/usr/bin/cc"
		, [`-std=${profile === "cpp" ? "c++20" : "c11"}`, "-Wall", "-Wextra", "-Werror", "-UNDEBUG", `consumer.${extension}`, ...relative, "-o", "consumer"]
		, root, compile);
	const executableSha256 = sha256(await readFile(join(root, "consumer")));
	const relocated = join(consumer, `${profile}-relocated`);
	await rename(root, relocated);
	const repeated = await runCopied(join(relocated, "consumer"), [], relocated);
	assert.equal(repeated.stderr, ""); assert.equal(repeated.stdout.trim(), `alias-ok:${observation.checks}`);
	await verifyNativeFiles(join(relocated, directory), receipt.files);
	return { relocatedInstallation: true, repeatExecution: true
		, installedFilesUnchanged: true
		, executableSha256, installedFilesSha256: sha256(canonicalJson(receipt.files))
		, nativeLibraries: Object.fromEntries(Object.entries(receipt.files)
			.filter(([path]) => /\.so(?:\.|$)/.test(path))) };
};

test("installed C/C++ aliases retain public names and exact copied target semantics", { skip: process.env.LEAN_BRIDGE_NATIVE_ALIAS_TEST !== "1", timeout: 900_000 }, async t => {
	const reports = [], environment = nativeFixtureEnvironment(["c", "cpp"]);
	for(const path of ["ordinary-source", "reviewed-ir"])
	{
		const author = await mkdtemp(join(tmpdir(), "lean-bridge-alias-author-"));
		const consumer = await mkdtemp(join(tmpdir(), "lean-bridge-alias-consumer-"));
		t.after(() => Promise.all([author, consumer].map(root => rm(root, { recursive: true, force: true }))));
		const projectRoot = join(author, "project"), outputRoot = join(author, "release"), handoff = join(consumer, "handoff");
		await cp("tests/fixtures/onboarding/native-aliases", projectRoot, { recursive: true });
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1
			, modules: ["Aliases"]
			, targets: { c: { name: "aliases", version: "1.0.0" }, cpp: { name: "aliases", version: "1.0.0" } }
			, ...(path === "ordinary-source" ? { exports: nativeAliasSignatures.map(item => item.name) } : {}) }));
		if(path === "reviewed-ir") await saveLakeFile(projectRoot, "reviewed.binding-ir.json", canonicalJson(nativeAliasReviewedIr()));
		t.diagnostic(`${path}: compiling C/GMP and C++ aliases`);
		const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: ["c", "cpp"], environment }).catch(error => {
			error.message += `: ${JSON.stringify(error.details)}`; throw error;
		});
		const model = JSON.parse(await readFile(join(outputRoot, "native/component/model.json")));
		assert.deepEqual(shape(model.bindingIr), shape(nativeAliasReviewedIr()));
		const receipt = await copyPackageSetHandoff(outputRoot, handoff);
		await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		await rm(author, { recursive: true, force: true });
		for(const profile of ["c", "cpp"])
		{
			t.diagnostic(`${path}: installing ${profile}`);
			const packages = receipt.packages.filter(pkg => pkg.target === profile);
			const observation = await installCopiedConsumer({ profile, consumer
				, handoff, packages, environment
				, fixture: { source: nativeAliasConsumer, success: "alias-ok" } });
			const relocation = await recheckRelocated(profile, consumer, packages, observation);
			reports.push({ profile, path
				, ...observation, ...relocation, packages
				, bindingIrSha256: built.bindingIrSha256
				, sourceTreeSha256: model.sourceIdentity.sourceTreeSha256
				, modelSha256: sha256(canonicalJson(model))
				, sourceApiSha256: sourceApiIdentity(model.bindingIr).sha256
				, receiptSha256: sha256(await readFile(join(handoff, "package-set-receipt.json")))
				, sourceRemovedBeforeInstallation: true });
			await rm(join(consumer, `${profile}-relocated`), { recursive: true, force: true });
		}
		await rm(consumer, { recursive: true, force: true });
	}
	await saveLakeFile("build/aliases", "native.json", canonicalJson({ schemaVersion: 1, reports }));
});
