/**
 * Compile the publisher example and run the documented C consumer after install.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, rename, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { verifyNativeFiles } from "../src/build/native-artifacts.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";
import { structuredCallableReviewedIr } from "./helpers/structured-callable-fixture.mjs";
import { witStructuredSignatures } from "./helpers/wit-structured-callable-fixture.mjs";
import { nativeFixtureEnvironment, runCopied, copiedCleanEnvironment } from "./helpers/copied-fixture-install.mjs";

test("WIT structured publisher and consumer documentation execute from installed archives", { skip: process.env.LEAN_BRIDGE_WIT_STRUCTURED_CALLABLE_TEST !== "1", timeout: 600_000 }, async t => {
	const docs = process.env.LEAN_BRIDGE_WIT_DOCUMENTATION_ROOT ?? "docs";
	const publisher = (await readFile(join(docs, "publish/wit-wasi.md"), "utf8")).split("## Export structured callbacks\n")[1]?.split("## Export named copied aliases\n")[0];
	const leanBlock = publisher?.match(/```lean\n([\s\S]*?)\n```/u)?.[1];
	const config = JSON.parse(publisher?.match(/```json\n([\s\S]*?)\n```/u)?.[1] ?? "null");
	assert.ok(leanBlock && config);
	const lean = leanBlock + "\n";
	const guide = await readFile(join(docs, "consume/wit-wasi.md"), "utf8");
	const source = guide.match(/```c file=wit-wasi\/structured\.c\n([\s\S]*?)\n```/u)?.[1] + "\n";
	assert.equal(source, await readFile("tests/fixtures/documentation/consumers/wit-wasi/structured.c", "utf8"));
	const ir = structuredCallableReviewedIr();
	ir.declarations = ir.declarations.filter(fn => ["callRecord", "makeRecord"].includes(fn.name));
	const types = new Set(["lean:Structured.Payload", ...ir.declarations.flatMap(fn => [...fn.parameters, fn.result].map(site => site.type.id))]);
	ir.types = ir.types.filter(type => types.has(type.id));
	const reports = [];
	for(const path of ["ordinary-source", "reviewed-ir"])
	{
		const author = await mkdtemp(join(tmpdir(), "lean-bridge-wit-structured-doc-author-"));
		const consumer = await mkdtemp(join(tmpdir(), "lean-bridge-wit-structured-doc-consumer-"));
		t.after(() => Promise.all([author, consumer].map(root => rm(root, { recursive: true, force: true }))));
		const projectRoot = join(author, "project"), outputRoot = join(author, "release");
		await cp("tests/fixtures/onboarding/structured-callables", projectRoot, { recursive: true });
		await saveLakeFile(projectRoot, "Structured.lean", lean);
		const selected = structuredClone(config);
		if(path === "reviewed-ir")
		{
			delete selected.exports; delete selected.arities;
			await saveLakeFile(projectRoot, "structured.binding-ir.json", canonicalJson(ir));
		}
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson(selected));
		const environment = nativeFixtureEnvironment(["wit-wasi"]);
		const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: ["wit-wasi"], environment }).catch(error => { error.message += `: ${JSON.stringify(error.details)}`; throw error; });
		const model = JSON.parse(await readFile(join(outputRoot, "native/component/model.json"), "utf8"));
		assert.deepEqual(witStructuredSignatures(model.bindingIr), witStructuredSignatures(ir));
		const incoming = join(consumer, "incoming"), handoff = join(consumer, "relocated");
		const receipt = await copyPackageSetHandoff(outputRoot, incoming);
		await rm(author, { recursive: true, force: true }); await rename(incoming, handoff);
		const pkg = receipt.packages.find(item => item.role === "component");
		await runCopied("/usr/bin/tar", ["--use-compress-program=/usr/bin/gzip", "-xf", join(handoff, pkg.artifacts[0].path)], consumer);
		const installed = join(consumer, `${pkg.name}-${pkg.version}-wit-wasi`);
		const packageReceipt = JSON.parse(await readFile(join(installed, "lean-bridge-package.json"), "utf8"));
		await verifyNativeFiles(installed, packageReceipt.files);
		const toolDirectory = join(consumer, "tools"); await mkdir(toolDirectory);
		for(const name of ["as", "ld"]) await symlink(`/usr/bin/${name}`, join(toolDirectory, name));
		const compile = { ...copiedCleanEnvironment, PATH: toolDirectory, PKG_CONFIG_LIBDIR: join(installed, "lib/pkgconfig"), PKG_CONFIG_PATH: "" };
		const flags = (await runCopied("/usr/bin/pkg-config", ["--cflags", "--libs", `${pkg.name}-wit`], consumer, compile)).stdout.trim().split(/\s+/u);
		await saveLakeFile(consumer, "main.c", source);
		const executable = join(consumer, "structured-example");
		await runCopied("/usr/bin/cc", ["-std=c11", "-Wall", "-Wextra", "-Werror", "main.c", ...flags, "-o", executable], consumer, compile);
		await rm(handoff, { recursive: true, force: true });
		for(let repeat = 0; repeat < 2; ++repeat)
		{
			const result = await runCopied(executable, [], consumer);
			assert.equal(result.stdout, "echo\n"); assert.equal(result.stderr, "");
		}
		await verifyNativeFiles(installed, packageReceipt.files);
		reports.push({ path, packages: receipt.packages
			, bindingIrSha256: built.bindingIrSha256
			, sourceTreeSha256: model.sourceIdentity.sourceTreeSha256
			, publisherSourceSha256: sha256(lean)
			, configurationSha256: sha256(canonicalJson(config))
			, consumerSourceSha256: sha256(source)
			, executableSha256: sha256(await readFile(executable))
			, stdout: "echo\n", repeatedExecutions: 2
			, sourceRemovedBeforeInstallation: true, handoffRemovedBeforeExecution: true
			, compilerFreeExecution: true, installedFilesUnchanged: true });
		await rm(consumer, { recursive: true, force: true });
	}
	await saveLakeFile("build/structured-callables", "wit-documentation.json", canonicalJson({ schemaVersion: 1, reports }));
});
