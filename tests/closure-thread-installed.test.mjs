/**
 * Reproduce closure thread reuse against relocated source-free C packages.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { verifyNativeFiles } from "../src/build/native-artifacts.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";
import { nativeFixtureEnvironment, copiedCleanEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import { closureThreadExports, closureThreadReview, closureThreadConsumer } from "./helpers/closure-thread-fixture.mjs";

test("installed C closure leases reject replacement threads on both source paths", {
	skip: process.env.LEAN_BRIDGE_C_CLOSURE_THREAD_TEST !== "1", timeout: 600_000
}, async t => {
	const reports = [], names = closureThreadExports;
	const review = closureThreadReview(), source = closureThreadConsumer();
	for(const path of ["ordinary-source", "reviewed-ir"])
	{
		const author = await mkdtemp(join(tmpdir(), "lean-closure-thread-author-"));
		const consumer = await mkdtemp(join(tmpdir(), "lean-closure-thread-consumer-"));
		try
		{
			const projectRoot = join(author, "project"), outputRoot = join(author, "release");
			const config = { schemaVersion: 1, modules: ["Callables"]
				, targets: { c: { name: "callables", version: "1.0.0" } }
				, ...(path === "ordinary-source" ? { exports: names, arities: Object.fromEntries(names.map(name => [name, 1])) } : {}) };
			await cp("tests/fixtures/onboarding/callables", projectRoot, { recursive: true });
			await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson(config));
			if(path === "reviewed-ir") await saveLakeFile(projectRoot, "callables.binding-ir.json", canonicalJson(review));
			t.diagnostic(`${path}: building original C archive`);
			const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: ["c"], environment: nativeFixtureEnvironment(["c"]) })
				.catch(error => { error.message += `: ${JSON.stringify(error.details)}`; throw error; });
			const model = JSON.parse(await readFile(join(outputRoot, "native/component/model.json"), "utf8"));
			assert.equal(model.exports.length, 2);
			const incoming = join(consumer, "incoming"), handoff = join(consumer, "relocated");
			const receipt = await copyPackageSetHandoff(outputRoot, incoming);
			await verifyPackageSetReceipt({ receiptPath: join(incoming, "package-set-receipt.json") });
			await rm(author, { recursive: true, force: true }); await rename(incoming, handoff);
			await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
			const pkg = receipt.packages.find(item => item.target === "c" && item.role === "component");
			await runCopied("/usr/bin/tar", ["--use-compress-program=/usr/bin/gzip", "-xf", join(handoff, pkg.artifacts[0].path)], consumer);
			const installed = join(consumer, `${pkg.name}-${pkg.version}-c`);
			const packageReceipt = JSON.parse(await readFile(join(installed, "lean-bridge-package.json"), "utf8"));
			await verifyNativeFiles(installed, packageReceipt.files);
			const flags = (await runCopied("/usr/bin/pkg-config", ["--cflags", "--libs", pkg.name], consumer
				, { ...copiedCleanEnvironment, PKG_CONFIG_LIBDIR: join(installed, "lib/pkgconfig"), PKG_CONFIG_PATH: "" })).stdout.trim().split(/\s+/u);
			await saveLakeFile(consumer, "main.c", source);
			const deployment = join(consumer, "runtime"), executable = join(deployment, "probe");
			await cp(join(installed, "lib"), join(deployment, "lib"), { recursive: true, dereference: true });
			const compile = ["-std=c11", "-Wall", "-Wextra", "-Werror", "-UNDEBUG", "-pthread", "main.c"];
			compile.push(...flags.filter(flag => !flag.startsWith("-Wl,-rpath,")), "-ldl", "-Wl,-rpath,$ORIGIN/lib", "-o", executable);
			await runCopied("/usr/bin/cc", compile, consumer, { ...copiedCleanEnvironment, PATH: "/usr/bin:/bin" });
			await verifyNativeFiles(installed, packageReceipt.files);
			const executableSha256 = sha256(await readFile(executable));
			await rm(installed, { recursive: true, force: true });
			await rm(handoff, { recursive: true, force: true }); await rm(join(consumer, "main.c"));
			let observed;
			for(let repeat = 0; repeat < 2; ++repeat)
			{
				const result = await runCopied(executable, [], deployment, copiedCleanEnvironment);
				assert.equal(result.stderr, "");
				observed = JSON.parse(result.stdout);
				assert.deepEqual(observed, { checks: 204, identities: 0, stringAccepted: 0, stringRejected: 16, wordAccepted: 0, wordRejected: 16 });
			}
			reports.push({ path, observed, packages: receipt.packages
				, bindingIrSha256: built.bindingIrSha256
				, sourceTreeSha256: model.sourceIdentity.sourceTreeSha256
				, consumerSha256: sha256(source), executableSha256
				, sourceRemovedBeforeInstallation: true, relocatedBeforeInstallation: true
				, headersAndArchivesRemoved: true, compilerFreeExecution: true
				, repeatedExecutions: 2 });
			t.diagnostic(`${path}: ${JSON.stringify(observed)}`);
		}
		finally
		{ await rm(author, { recursive: true, force: true }); await rm(consumer, { recursive: true, force: true }); }
	}
	const record = { schemaVersion: 1, kind: "installed-closure-thread-lifetime"
		, generatorSha256: sha256(await readFile("src/backends/c/native-callables.mjs"))
		, reports };
	await saveLakeFile(resolve("build/closure-thread"), "installed.json", canonicalJson(record));
});
