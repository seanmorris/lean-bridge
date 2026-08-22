#!/usr/bin/env node
/**
 * Runs one classified repository test profile after its capability preflight.
 *
 * @file
 */

import { spawn } from "node:child_process";
import { readdir } from "node:fs/promises";
import { relative, resolve } from "node:path";

import { collectToolchainPreflight, renderToolchainPreflight } from "../src/adoption/toolchain-preflight.mjs";
import { groupRepositoryTests, repositoryTestProfiles } from "../src/adoption/test-profiles.mjs";

const root = resolve(".");
const requested = process.argv[2] ?? "contract";
if(!repositoryTestProfiles.includes(requested))
{
	process.stderr.write(`Unknown test profile ${requested}; expected ${repositoryTestProfiles.join(", ")}\n`);
	process.exit(64);
}

const visit = async directory => {
	const paths = [];
	for(const entry of (await readdir(directory, { withFileTypes: true })).sort((left, right) => left.name.localeCompare(right.name)))
	{
		const path = resolve(directory, entry.name);
		if(entry.isDirectory()) paths.push(...await visit(path));
		else if(entry.isFile() && entry.name.endsWith(".test.mjs")) paths.push(relative(root, path).replaceAll("\\", "/"));
	}
	return paths;
};

const grouped = groupRepositoryTests(await visit(resolve(root, "tests")));
const profileMap = {
	contract: "core", component: "component", native: "native"
	, php: "php", managed: "managed", browser: "browser"
	, performance: "performance", consumer: "component", all: "full"
};
const preflight = await collectToolchainPreflight({ profile: profileMap[requested] });
process.stderr.write(renderToolchainPreflight(preflight));
if(!preflight.accepted) process.exit(127);

const selected = requested === "all" ? Object.values(grouped).flat() : grouped[requested];
if(selected.length === 0)
{
	process.stderr.write(`Test profile ${requested} is empty\n`);
	process.exit(1);
}
process.stderr.write(`test_profile=${requested}\ntest_count=${selected.length}\n`);

const child = spawn(process.execPath, ["--test", ...selected], { cwd: root, env: process.env, stdio: "inherit" });
child.once("error", error => {
	process.stderr.write(`${error.stack ?? error.message}\n`);
	process.exitCode = 1;
});
child.once("exit", (code, signal) => {
	if(signal !== null) process.kill(process.pid, signal);
	else process.exitCode = code ?? 1;
});
