/**
 * Build the published author recipe and execute both unmodified consumer guides.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { processBuildRunner } from "../src/build/process-runner.mjs";
import { copiedCleanEnvironment, nativeFixtureEnvironment } from "./helpers/copied-fixture-install.mjs";
import { lakeInputState, saveLakeFile } from "./helpers/lake-workspace.mjs";
import { ownedJvmDocumentationExamples } from "./helpers/owned-jvm-installed.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";
import { installedJvmCorpus } from "./helpers/type-corpus-jvm.mjs";
import { prepareJvmCorpusDependencies } from "./helpers/type-corpus-jvm-tools.mjs";

test("owned Maven author recipe builds and executes the Java and Kotlin guides", {
	skip: process.env.LEAN_BRIDGE_OWNED_NATIVE_TEST !== "1", timeout: 1200000
}, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-owned-jvm-docs-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const guide = await readFile("docs/publish/maven.md", "utf8");
	const section = guide.split("## Owned resources and aggregates\n")[1].split("\n## ")[0];
	const block = language => {
		const match = section.match(new RegExp("```" + language + "\\n([^]*?)\\n```"));
		assert.ok(match, language + " author block"); return match[1] + "\n";
	};
	const lean = block("lean"), config = block("json");
	const author = join(root, "author"), project = join(author, "project");
	const release = join(author, "release"), handoff = join(root, "handoff");
	await saveLakeFile(project, "Owned.lean", lean);
	await saveLakeFile(project, "lean-bridge.exports.json", config);
	await saveLakeFile(project, "lean-toolchain", "leanprover/lean4:v4.32.2\n");
	await saveLakeFile(project, "lakefile.toml", 'name = "owned-aggregates"\nversion = "1.0.0"\n[[lean_lib]]\nname = "Owned"\n');
	const before = await lakeInputState(project), environment = nativeFixtureEnvironment(["java", "kotlin"]);
	const cli = resolve("scripts/lean-bridge.mjs");
	const built = await processBuildRunner.capture({ command: process.execPath
		, args: [cli, "build", "--project", project, "--target", "maven", "--output", release, "--json"]
		, cwd: root, env: environment, timeoutMs: 600000 })
		.catch(error => { error.message += ": " + (error.details?.stdout ?? "") + (error.details?.stderr ?? ""); throw error; });
	assert.equal(JSON.parse(built.stdout).status, "ok");
	assert.deepEqual(await lakeInputState(project), before);
	const receipt = await copyPackageSetHandoff(release, handoff), pkg = receipt.packages[0];
	assert.equal(receipt.packages.length, 1); assert.equal(pkg.target, "maven");
	assert.equal(pkg.name, JSON.parse(config).targets.maven.name);
	assert.equal(pkg.version, JSON.parse(config).targets.maven.version);
	const dependencies = await prepareJvmCorpusDependencies({ directory: author, handoff, pkg, environment, clean: copiedCleanEnvironment });
	await rm(author, { recursive: true, force: true });
	const verified = await processBuildRunner.capture({ command: process.execPath
		, args: [cli, "verify", "--receipt", join(handoff, "package-set-receipt.json"), "--json"]
		, cwd: root, env: copiedCleanEnvironment });
	assert.equal(JSON.parse(verified.stdout).result.verificationType, "local-package-set");
	const namespace = "org.leanbridge.owned_aggregates", examples = await ownedJvmDocumentationExamples(namespace);
	const fixture = {
		packageKind: "lean-bridge-owned-maven-package"
		, removeHandoffBeforeExecution: true
		, examples: profile => examples[profile], rejections: () => []
		, signatures: () => "newTicket(Nat,String),serial(Ticket),callbackRecord(Bundle,Bundle->Bundle)"
		, source: profile => profile === "java" ? `import ${namespace}.Api;
import java.math.BigInteger;
public final class Consumer {
    public static void main(String[] args) throws Exception {
        Wire.check(Api.class.getDeclaredMethods().length == 3);
        try (var ticket = Api.newTicket(BigInteger.valueOf(42), "documentation")) {
            var value = Api.serial(ticket);
            Wire.check(value.equals(BigInteger.valueOf(42)));
            Wire.result("owned/documentation", Wire.integer(value), false);
        }
        Wire.finish("java", "${namespace}", System.getProperty("java.version"), Api.class);
    }
}
` : `import ${namespace}.kotlin.Api
import java.math.BigInteger
fun main() {
    check(Api::class.java.declaredMethods.size == 3)
    Api.newTicket(BigInteger.valueOf(42), "documentation").use { ticket ->
        val value = Api.serial(ticket)
        check(value == BigInteger.valueOf(42))
        Wire.result("owned/documentation", Wire.integer(value), false)
    }
    Wire.finish("kotlin", "${namespace}", KotlinVersion.CURRENT.toString(), Api::class.java)
}
`
	};
	const observations = [];
	for(const profile of ["java", "kotlin"])
	{
		const profileHandoff = join(root, "handoff-" + profile);
		await cp(handoff, profileHandoff, { recursive: true });
		const result = await installedJvmCorpus({ library: { jvmModule: namespace }
			, profile, consumer: join(root, "consumer"), handoff: profileHandoff
			, pkg, dependencies, environment, clean: copiedCleanEnvironment, fixture });
		assert.deepEqual(result.observation.errors, []);
		assert.equal(result.observation.results[0].observed.integer, "42");
		assert.equal(result.jvm.documentation.length, 1);
		observations.push({ profile, ...result });
		await rm(join(root, "consumer", profile), { recursive: true, force: true });
	}
	await saveLakeFile("build/owned-jvm-packaging", "documentation.json", canonicalJson({
		schemaVersion: 1, planNode: 1219, cliIntegrated: true
		, sourceRemovedBeforeInstallation: true
		, sourceHashes: { lean: sha256(lean), config: sha256(config) }
		, packageSetReceipt: receipt
		, dependencies, observations
	}));
});
