/** @file Installed publisher CLI to offline NuGet consumer, ordinary and reviewed source. */
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { buildCliNpmPackage } from "../../src/release/cli-npm-package.mjs";
import { captureNativeHostHandoff } from "./native-host-handoff.mjs";
import { runDotnetHostConsumers } from "./dotnet-host-installed.mjs";
import { runNativeTool as run } from "./native-effect-consumers.mjs";

test("offline installed NuGet components expose CLR host objects through ordinary and reviewed packages", { timeout: 3600000 }, async t => {
	const root = await mkdtemp(join(tmpdir(), "dotnet-host-release-")); t.after(() => rm(root, { recursive: true, force: true }));
	const archives = await mkdtemp(join(process.env.LEAN_BRIDGE_DOTNET_HOST_HANDOFF_TMP ?? tmpdir(), "dotnet-host-feed-")); t.after(() => rm(archives, { recursive: true, force: true }));
	const candidate = await buildCliNpmPackage({ outputRoot: join(root, "cli") }), tools = join(root, "tools"); await mkdir(tools);
	await run("npm", ["install", "--prefix", tools, "--offline", "--ignore-scripts", "--no-audit", "--no-fund", "--cache", join(root, "npm-cache"), candidate.archive], root, process.env);
	await rm(candidate.output, { recursive: true }); await rm(join(root, "npm-cache"), { recursive: true });
	const cli = join(tools, "node_modules/.bin/lean-bridge");
	for(const reviewed of [false, true])
	{
		const packs = [], route = reviewed ? "reviewed" : "ordinary";
		for(const peer of [false, true])
		{
			const p = await captureNativeHostHandoff({ root, archives, cli, peer, reviewed, backend: "dotnet" }); packs.push(p);
			t.diagnostic(route + " " + p.name + " receipt " + p.receiptSha256 + "; NuGet " + p.artifacts[0].sha256);
		}
		for(const line of await runDotnetHostConsumers(root, archives)) t.diagnostic(route + " " + line);
		for(const p of packs) for(const f of p.files) await rm(f);
	}
});
