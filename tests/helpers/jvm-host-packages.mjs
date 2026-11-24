/** @file Exercise the installed CLI and two independently published Maven packages, without a network. */
import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { buildCliNpmPackage } from "../../src/release/cli-npm-package.mjs";
import { captureJvmHostHandoff } from "./jvm-host-handoff.mjs";
import { runJvmHostConsumers } from "./jvm-host-installed.mjs";
import { runNativeTool as run } from "./native-effect-consumers.mjs";

test("installed Java and Kotlin bind application-owned objects through two independent Maven releases", { timeout: 3600000 }, async t => {
	const seed = process.env.LEAN_BRIDGE_JVM_IO_M2_SEED;
	assert.ok(seed, "Set LEAN_BRIDGE_JVM_IO_M2_SEED to an offline Maven seed (see docs/evidence/jvm-host-imports-20261124.md)");
	const plugins = "org/apache/maven/plugins/";
	for(const file of [plugins + "maven-install-plugin/3.1.4/maven-install-plugin-3.1.4.jar", plugins + "maven-dependency-plugin/3.8.1/maven-dependency-plugin-3.8.1.jar", "org/jetbrains/kotlin/kotlin-stdlib/2.2.0/kotlin-stdlib-2.2.0.jar"])
		await access(join(seed, file));
	const root = await mkdtemp(join(tmpdir(), "jvm-host-release-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const archives = await mkdtemp(join(process.env.LEAN_BRIDGE_JVM_HOST_HANDOFF_TMP ?? tmpdir(), "jvm-host-archives-"));
	t.after(() => rm(archives, { recursive: true, force: true }));
	const candidate = await buildCliNpmPackage({ outputRoot: join(root, "candidate") });
	const tools = join(root, "tools"); await mkdir(tools);
	await run("npm", ["install", "--prefix", tools, "--offline", "--ignore-scripts", "--no-audit", "--no-fund", "--cache", join(root, "npm-cache"), candidate.archive], root, process.env);
	await rm(candidate.output, { recursive: true });
	const cli = join(tools, "node_modules/.bin/lean-bridge");
	for(const reviewed of [false, true])
	{
		const packs = [], route = reviewed ? "reviewed" : "ordinary";
		for(const peer of [false, true])
		{
			const p = await captureJvmHostHandoff({ root, archives, cli, peer, reviewed }); packs.push(p);
			t.diagnostic(route + " " + p.name + " receipt " + p.receiptSha256 + "; JAR " + p.artifacts.find(a => a.path.endsWith(".jar")).sha256);
		}
		for(const line of await runJvmHostConsumers(root, packs)) t.diagnostic(route + " " + line);
	}
});
