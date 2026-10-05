/**
 * Execute the recursive C-family publishing and consumer guides as written.
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
import { nativeRecursiveCallableReviewedIr } from "./helpers/native-recursive-callable-fixture.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { copiedCleanEnvironment, nativeFixtureEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";

const examples = async () => {
	const publisher = (await readFile("docs/publish/c.md", "utf8")).split("## Export recursive callbacks\n")[1]?.split("## GMP dependency")[0];
	const lean = publisher?.match(/```lean\n([\s\S]*?)\n```/u)?.[1];
	const config = JSON.parse(publisher?.match(/```json\n([\s\S]*?)\n```/u)?.[1] ?? "null");
	assert.ok(lean && config);
	const sources = {};
	for(const profile of ["c", "cpp"])
	{
		const source = (await readFile(`docs/consume/${profile}.md`, "utf8"))
			.match(new RegExp("```" + profile + " file=" + profile + "/recursive-callables\\." + profile + "\\n([\\s\\S]*?)\\n```", "u"))?.[1];
		assert.ok(source, profile); sources[profile] = source + "\n";
		assert.equal(sources[profile], await readFile(`tests/fixtures/documentation/consumers/${profile}/recursive-callables.${profile}`, "utf8"));
	}
	return { lean: lean + "\n", config, sources };
};

test("recursive C and C++ documentation matches the checked consumer files", async () => {
	const { config } = await examples();
	assert.deepEqual(config.exports, ["Structured.callRecursive", "Structured.makeRecursive"]);
	assert.deepEqual(config.arities, { "Structured.makeRecursive": 1 });
	assert.deepEqual(Object.keys(config.targets), ["c", "cpp"]);
});

test("recursive C-family publisher examples run from both installed source paths", {
	skip: process.env.LEAN_BRIDGE_C_FAMILY_RECURSIVE_DOCUMENTATION_TEST !== "1"
	, timeout: 600_000
}, async t => {
	const { lean, config, sources } = await examples(), reports = [];
	const ir = nativeRecursiveCallableReviewedIr();
	ir.declarations = ir.declarations.filter(fn => ["callRecursive", "makeRecursive"].includes(fn.name));
	const used = new Set(["lean:Structured.Tree", ...ir.declarations.flatMap(fn => [...fn.parameters, fn.result].map(site => site.type.id))]);
	ir.types = ir.types.filter(type => used.has(type.id));
	for(const path of ["ordinary-source", "reviewed-ir"])
	{
		const author = await mkdtemp(join(tmpdir(), "lean-c-family-recursive-doc-author-"));
		const consumer = await mkdtemp(join(tmpdir(), "lean-c-family-recursive-doc-consumer-"));
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
		const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: ["c", "cpp"], environment: nativeFixtureEnvironment(["c", "cpp"]) })
			.catch(error => { error.message += `: ${JSON.stringify(error.details)}`; throw error; });
		const model = JSON.parse(await readFile(join(outputRoot, "native/component/model.json"), "utf8"));
		const incoming = join(consumer, "incoming"), handoff = join(consumer, "relocated");
		const receipt = await copyPackageSetHandoff(outputRoot, incoming);
		await rm(author, { recursive: true, force: true }); await rename(incoming, handoff);
		const deployments = [];
		for(const profile of ["c", "cpp"])
		{
			const pkg = receipt.packages.find(item => item.target === profile && item.role === "component");
			await runCopied("/usr/bin/tar", ["--use-compress-program=/usr/bin/gzip", "-xf", join(handoff, pkg.artifacts[0].path)], consumer);
			const installed = join(consumer, `${pkg.name}-${pkg.version}-${profile}`);
			const packageReceipt = JSON.parse(await readFile(join(installed, "lean-bridge-package.json"), "utf8"));
			await verifyNativeFiles(installed, packageReceipt.files);
			const flags = (await runCopied("/usr/bin/pkg-config", ["--cflags", "--libs", pkg.name], consumer
				, { ...copiedCleanEnvironment, PKG_CONFIG_LIBDIR: join(installed, "lib/pkgconfig"), PKG_CONFIG_PATH: "" })).stdout.trim().split(/\s+/u);
			await saveLakeFile(consumer, `main.${profile}`, sources[profile]);
			const deployment = join(consumer, `runtime-${profile}`), executable = join(deployment, "example");
			await cp(join(installed, "lib"), join(deployment, "lib"), { recursive: true, dereference: true });
			await runCopied(`/usr/bin/${profile === "c" ? "cc" : "c++"}`, [profile === "c" ? "-std=c11" : "-std=c++20"
				, "-Wall", "-Wextra", "-Werror", "-UNDEBUG", `main.${profile}`
				, ...flags.filter(flag => !flag.startsWith("-Wl,-rpath,"))
				, "-Wl,-rpath,$ORIGIN/lib", "-o", executable]
			, consumer, { ...copiedCleanEnvironment, PATH: "/usr/bin:/bin" });
			await verifyNativeFiles(installed, packageReceipt.files);
			deployments.push({ profile, executable, deployment, executableSha256: sha256(await readFile(executable)) });
			await rm(installed, { recursive: true, force: true });
			await rm(join(consumer, `main.${profile}`));
		}
		await rm(handoff, { recursive: true, force: true });
		for(const { profile, executable, deployment, executableSha256 } of deployments)
		{
			for(let repeat = 0; repeat < 2; ++repeat)
			{
				const result = await runCopied(executable, [], deployment, copiedCleanEnvironment);
				assert.equal(result.stdout, "43\n"); assert.equal(result.stderr, "");
			}
			reports.push({ path, profile
				, packages: receipt.packages.filter(pkg => pkg.target === profile)
				, bindingIrSha256: built.bindingIrSha256
				, sourceTreeSha256: model.sourceIdentity.sourceTreeSha256
				, publisherSourceSha256: sha256(lean)
				, configurationSha256: sha256(canonicalJson(config))
				, consumerSourceSha256: sha256(sources[profile]), executableSha256
				, stdout: "43\n", repeatedExecutions: 2
				, sourceRemovedBeforeInstallation: true
				, relocatedBeforeInstallation: true, headersAndArchivesRemoved: true
				, compilerFreeExecution: true, installedFilesUnchanged: true });
		}
		await rm(consumer, { recursive: true, force: true });
	}
	await saveLakeFile(resolve("build/recursive-callables"), "c-family-documentation.json", canonicalJson({ schemaVersion: 1, reports }));
});
