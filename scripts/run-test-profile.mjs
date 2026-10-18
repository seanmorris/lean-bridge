#!/usr/bin/env node
/**
 * Runs one classified repository test profile after its capability preflight.
 *
 * @file
 */

import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { collectToolchainPreflight, renderToolchainPreflight } from "../src/adoption/toolchain-preflight.mjs";
import { groupRepositoryTests, repositoryTestProfiles } from "../src/adoption/test-profiles.mjs";
import { canonicalJson } from "../src/capsule/node.mjs";
import {
	collectRepositoryTestPaths, coreContractShardLabels, coreContractShardManifest
} from "./core-contract-shards.mjs";

const root = resolve(".");
const arguments_ = process.argv.slice(2);
const requested = arguments_.shift() ?? "contract";
if(!repositoryTestProfiles.includes(requested))
{
	process.stderr.write(`Unknown test profile ${requested}; expected ${repositoryTestProfiles.join(", ")}\n`);
	process.exit(64);
}
let shard = null, shardManifestPath = null;
if(arguments_.length)
{
	if(arguments_.length !== 4 || arguments_[0] !== "--shard"
		|| arguments_[2] !== "--shard-manifest" || requested !== "contract"
		|| !coreContractShardLabels.includes(arguments_[1])
		|| !arguments_[3] || /[\0\r\n]/u.test(arguments_[3])) {
		process.stderr.write("Usage: run-test-profile.mjs [profile] [--shard <1/6|2/6|3/6|4/6|5/6|6/6> --shard-manifest <path>]\n");
		process.exit(64);
		}
	shard = arguments_[1]; shardManifestPath = resolve(arguments_[3]);
}
const grouped = groupRepositoryTests(await collectRepositoryTestPaths(root));
const profileMap = {
	contract: "core", component: "component", native: "native"
	, php: "php", managed: "managed", browser: "browser"
	, performance: "performance", consumer: "component", all: "full"
};
const preflight = await collectToolchainPreflight({ profile: profileMap[requested] });
process.stderr.write(renderToolchainPreflight(preflight));
if(!preflight.accepted) process.exit(127);

const complete = requested === "all" ? Object.values(grouped).flat() : grouped[requested];
const manifest = shard ? coreContractShardManifest(complete, shard) : null;
const selected = manifest?.selection.files ?? complete;
if(selected.length === 0)
{
	process.stderr.write(`Test profile ${requested} is empty\n`);
	process.exit(1);
}
if(manifest)
{
	await mkdir(dirname(shardManifestPath), { recursive: true });
	await writeFile(shardManifestPath, canonicalJson(manifest));
}
process.stderr.write(`test_profile=${requested}\ncontract_test_count=${complete.length}\ntest_count=${selected.length}\ntest_shard=${shard ?? "all"}\n`);

const boundedHostedCore = requested === "contract" && process.env.CI === "true";
const childEnvironment = boundedHostedCore ? {
	...process.env
	, NODE_OPTIONS: [process.env.NODE_OPTIONS, "--max-old-space-size=4096"]
		.filter(Boolean).join(" ")
} : process.env;
const child = spawn(process.execPath, [
	"--test", ...boundedHostedCore ? ["--test-concurrency=2"] : [], ...selected
], { cwd: root, env: childEnvironment, stdio: "inherit" });
child.once("error", error => {
	process.stderr.write(`${error.stack ?? error.message}\n`);
	process.exitCode = 1;
});
child.once("exit", (code, signal) => {
	if(signal !== null) process.kill(process.pid, signal);
	else process.exitCode = code ?? 1;
});
