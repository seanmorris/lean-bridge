/**
 * Keep all WIT producer gates while removing repository-sized Nix imports.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
import {
	assertIsolatedWasmtimeCapiBootstraps, checkWasmtimeCapiBootstrap
	, isolatedWasmtimeCapiBootstrap
} from "./wasmtime-capi-bootstrap.mjs";
import {
	beforeWasmtimeCapiRolloutSource, wasmtimeCapiRolloutHistoryPath
} from "./wasmtime-capi-ci-rollout-source-history.mjs";
import { sourceAtFinHistoryRecord } from "./source-at-fin-history-milestone.mjs";

export const wasmtimeCapiRolloutWorkflows = [
	"callback-checked-record-remaining", "callback-subtype-remaining"
	, "checked-record-value-index-wit", "consumer-matrix"
	, "dependent-checked-record-wit", "generic-subtype-managed-wit"
	, "inherited-checked-record-wit", "nested-checked-record-wit"
	, "nominal-primitive-subtype-wit", "owned-subtype-remaining"
	, "recursive-checked-record-wit", "zero-payload-checked-record-wit"
].map(name => `.github/workflows/${name}.yml`);
const predecessor = "9b6cd8048433479b5f09eeb328afb301fa1ad9b2";
const block = isolatedWasmtimeCapiBootstrap.trimEnd().split("\n")
	.map(line => "          " + line + "\n").join("");
const command = "nix build .#wasmtime-c-api --out-link build/wasmtime-c-api";

test("Wasmtime C API rollout preserves all twelve workflows outside SDK setup and strict tool discovery", async () => {
	let sites = 0;
	for(const path of wasmtimeCapiRolloutWorkflows)
	{
		const current = await sourceAtFinHistoryRecord(
			wasmtimeCapiRolloutHistoryPath, path
			, beforeWasmtimeCapiRolloutSource
		);
		const previous = execFileSync("git", ["show", `${predecessor}:${path}`]
			, { encoding: "utf8", maxBuffer: 2 * 1024 ** 2 });
		const count = path.endsWith("/consumer-matrix.yml") ? 3 : 1;
		assertIsolatedWasmtimeCapiBootstraps(current, count);
		assert.equal(previous.split(command).length - 1, count);
		sites += count;
		let restored = current.replaceAll(block, "          " + command + "\n");
		if(previous.includes("        run: " + command + "\n"))
			restored = restored.replace("        run: |\n          " + command + "\n"
				, "        run: " + command + "\n");
		if(count === 1)
		{
			const nix = /^ {6}- name: Install the documented Nix CLI\n(?: {8}if: matrix\.lane == 'wit-wasi'\n)? {8}uses: cachix\/install-nix-action@v31\n {8}with:\n {10}install_url: https:\/\/releases\.nixos\.org\/nix\/nix-2\.24\.11\/install\n/gmu;
			const matches = [...previous.matchAll(nix)];
			assert.equal(matches.length, 1);
			const removed = matches[0];
			const following = previous.slice(removed.index + removed[0].length).split("\n")[0] + "\n";
			assert.equal(restored.split(following).length, 2);
			restored = restored.replace(following, removed[0] + following);
			assert.doesNotMatch(current, /cachix\/install-nix/u);
		}
		if(path.endsWith("/owned-subtype-remaining.yml"))
			for(const name of ["MAVEN", "PHP", "COMPOSER"])
			{
				const prefix = "              ";
				const variable = `LEAN_BRIDGE_${name}`;
				const binary = name === "MAVEN" ? "mvn" : name.toLowerCase();
				const assignment = `${variable}="$(command -v ${binary})"`;
				assert.ok(current.includes(prefix + assignment + "\n"));
				restored = restored.replace(prefix + assignment, prefix + "export " + assignment);
				restored = restored.replace(prefix + "export " + variable + "\n", "");
			}
		restored = restored.replace("              export LEAN_BRIDGE_PHP LEAN_BRIDGE_COMPOSER\n", "");
		assert.equal(restored, previous, path);
	}
	assert.equal(sites, 14);
});

test("Wasmtime C API rollout confines shell options and cleanup in six offline scenarios", async t => {
	await checkWasmtimeCapiBootstrap(t, isolatedWasmtimeCapiBootstrap, true);
});

test("Wasmtime C API rollout refuses altered and duplicate installers", async () => {
	const mutations = [
		["wasmtime-v42.0.1", "wasmtime-v42.0.2"]
		, ["sha256sum --check --status", "true"]
		, ["--max-time 300", "--max-time 30000"]
		, ["mv -T", "cp -r"]
		, ["trap 'rm -rf --", "trap 'echo"]
		, ["test ! -e build/wasmtime-c-api", "true"]
	];
	for(const path of wasmtimeCapiRolloutWorkflows)
	{
		const source = await readFile(path, "utf8");
		const count = path.endsWith("/consumer-matrix.yml") ? 3 : 1;
		for(const [before, after] of mutations)
		{
			const changed = source.replace(before, after);
			assert.notEqual(changed, source, `${path}: ${before}`);
			assert.throws(() => assertIsolatedWasmtimeCapiBootstraps(changed, count));
		}
		assert.throws(() => assertIsolatedWasmtimeCapiBootstraps(source + block, count));
	}
});

test("Wasmtime C API rollout leaves no repository-importing SDK build in active CI", async () => {
	const directory = ".github/workflows";
	for(const name of await readdir(directory))
	{
		if(!name.endsWith(".yml")) continue;
		assert.doesNotMatch(await readFile(`${directory}/${name}`, "utf8")
			, /nix build \.#wasmtime-c-api/u, name);
	}
});
