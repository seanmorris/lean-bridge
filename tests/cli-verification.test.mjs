/**
 * Check project-free receipt verification, authentication failures and installed CLI use.
 *
 * @file
 */

import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { chmod, copyFile, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import { canonicalJson } from "../src/capsule/node.mjs";
import { parseCliArguments, validateCliResult } from "../src/cli/contract.mjs";
import { runCli } from "../src/cli/run.mjs";
import { createVerificationHandler, verificationHandler } from "../src/cli/verify.mjs";
import { buildCliNpmPackage } from "../src/release/cli-npm-package.mjs";
import { createLocalHandoff } from "./helpers/component-receipt-fixture.mjs";
import { createSignedHandoff, sha256 } from "./helpers/release-receipt-fixture.mjs";

const execute = promisify(execFile);
const entrypoint = resolve("scripts/lean-bridge.mjs");
const handlers = { verify: verificationHandler };
const invoke = (args, options = {}) => runCli({ argv: ["verify", ...args, "--json"], handlers, environment: {}, ...options });
const hostileEnvironment = {
	LEAN_BRIDGE_CONFIG: "/missing/lean-bridge.cli.json"
	, LEAN_BRIDGE_PROJECT: "/missing/project"
	, LEAN_BRIDGE_TARGETS: "invalid target", LEAN_BRIDGE_CACHE: "invalid-cache"
	, LEAN_BRIDGE_CACHE_DIRECTORY: "/missing/cache"
	, LEAN_BRIDGE_BUILD_BACKEND: "missing-engine"
	, LEAN_BRIDGE_RUNTIME_ROOT: "/missing/runtime"
	, LEAN_BRIDGE_NPM_REGISTRY_MODE: "sandbox"
	, LEAN_BRIDGE_NPM_REGISTRY_URL: "not-a-registry-url"
};

test("verify parsing ignores project configuration and limits environment overrides to presentation", async t => {
	const local = await createLocalHandoff(t);
	await writeFile(join(local.directory, "lean-bridge.cli.json"), "not valid JSON");
	for(const environment of [{}, hostileEnvironment])
	{
		const request = parseCliArguments(["verify", "--receipt", basename(local.receiptPath)], {
			cwd: local.directory, environment, stderrIsTTY: false
		});
		assert.equal(request.project, null);
		assert.equal(request.configuration.path, null);
		assert.deepEqual(request.cache, { policy: "off", directory: null });
		assert.deepEqual(request.verification, { verificationType: "local-npm", receiptPath: local.receiptPath, artifactRoot: null });
		assert.equal(request.format, "human");
		assert.equal(request.progress, "none");
	}
	const presentation = parseCliArguments(["verify", "--receipt", "r", "--artifacts", "a"], {
		cwd: local.directory
		, environment: { LEAN_BRIDGE_FORMAT: "json", LEAN_BRIDGE_PROGRESS: "plain" }
	});
	assert.equal(presentation.format, "json");
	assert.equal(presentation.progress, "plain");
	assert.equal(presentation.verification.artifactRoot, join(local.directory, "a"));
	assert.equal(parseCliArguments(["verify", "--help"], { environment: hostileEnvironment }).kind, "help");
	for(const args of [["verify", "--help"], ["--help"]])
	{
		const result = await execute(process.execPath, [entrypoint, ...args], {
			cwd: local.directory, env: { ...process.env, ...hostileEnvironment }
		});
		assert.match(result.stdout, /Signed verification requires all five options/);
		assert.equal(result.stderr, "");
	}
});

test("verify rejects missing, duplicate, mixed and author-only options as usage errors", async t => {
	const signed = await createSignedHandoff(t);
	const cases = [
		[], ["--receipt"], ["--receipt", ""]
		, ["--receipt", "r", "--receipt", "r"]
		, ["--receipt", "r", "--artifacts", ""]
		, ["--receipt", "r", "--format", "yaml"]
		, ["--receipt", "r", "--progress", "verbose"]
		, ["--receipt", "r", "--format", "human"]
		, ...["--project", "--config", "--target", "--cache", "--output", "--bundle", "--manifest", "--unknown"]
			.map(flag => ["--receipt", "r", flag, "value"])
		, ...["--interactive", "--check", "--dry-run", "--no-cache"].map(flag => ["--receipt", "r", flag])
		, [...signed.args, "--artifacts", "."]
	];
	for(const flag of ["--archive", "--policy", "--policy-sha256", "--subject", "--coordinate"])
	{
		const args = [...signed.args];
		args.splice(args.indexOf(flag), 2);
		cases.push(args);
	}
	const badHash = [...signed.args];
	badHash[badHash.indexOf("--policy-sha256") + 1] = "not-a-hash";
	cases.push(badHash);
	for(const args of cases)
	{
		const result = await invoke(args);
		assert.equal(result.exitCode, 64, JSON.stringify(args));
		assert.equal(result.response.result, null);
		assert.equal(result.response.command, null);
	}
});

test("local CLI results match the portable verifier and distinguish unsigned consistency", async t => {
	const local = await createLocalHandoff(t);
	const copied = JSON.parse((await execute(process.execPath, [local.verifierPath, "--receipt", local.receiptPath])).stdout);
	const result = await invoke(["--receipt", basename(local.receiptPath)], { cwd: local.directory });
	assert.equal(result.exitCode, 0);
	assert.deepEqual(result.response.result, { ...copied, verificationType: "local-npm", authenticated: false });
	assert.equal(result.response.project, null);
	assert.equal(validateCliResult(result.response), true);
	assert.throws(() => validateCliResult({ ...result.response, project: local.directory }), /no Lean project/);
	assert.throws(() => validateCliResult({ ...result.response, command: "build" }), /project must be a path/);
	const relocated = join(local.directory, "metadata");
	await mkdir(relocated);
	await copyFile(local.receiptPath, join(relocated, "receipt.json"));
	const overridden = await invoke(["--receipt", "metadata/receipt.json", "--artifacts", "."], { cwd: local.directory });
	assert.deepEqual(overridden.response.result, result.response.result);
	const human = await runCli({ argv: ["verify", "--receipt", local.receiptPath], handlers, environment: {} });
	assert.match(human.stdout, /archive consistency \(unsigned receipt\)/);
	assert.match(human.stdout, /component: sample@1.0.0/);
	assert.doesNotMatch(human.stdout, /project:|targets:|cache:/);
	const progress = await execute(process.execPath, [entrypoint, "verify", "--receipt", local.receiptPath, "--json", "--progress", "json"]);
	assert.equal(JSON.parse(progress.stdout).result.authenticated, false);
	assert.deepEqual(progress.stderr.trim().split("\n").map(line => JSON.parse(line).state), ["started", "completed"]);
});

test("signed CLI results match the portable verifier with both signatures authenticated", async t => {
	const signed = await createSignedHandoff(t);
	const portable = JSON.parse((await execute(process.execPath, [join(signed.directory, "verify-release-archive.mjs"), ...signed.args])).stdout);
	const result = await invoke(signed.args);
	assert.equal(result.exitCode, 0);
	assert.deepEqual(result.response.result, { ...portable, verificationType: "signed-archive", authenticated: true });
	assert.equal(result.response.result.publicationSignatures, 1);
	assert.equal(result.response.result.receiptSignatures, 1);
	const human = await runCli({ argv: ["verify", ...signed.args], handlers, environment: {} });
	assert.match(human.stdout, /signed archive authenticated against the trusted signer policy/);
	assert.match(human.stdout, /coordinate: @lean-bridge\/alpha@1.2.3/);
	assert.doesNotMatch(human.stdout, /project:|targets:|cache:/);
	const unsignedAttempt = await invoke(["--receipt", signed.receiptPath]);
	assert.equal(unsignedAttempt.exitCode, 1);
	assert.equal(unsignedAttempt.response.result, null);
	const local = await createLocalHandoff(t);
	const mismatched = [...signed.args];
	mismatched[mismatched.indexOf("--receipt") + 1] = local.receiptPath;
	assert.equal((await invoke(mismatched)).exitCode, 1);
});

test("local verification rejects corrupt inputs without changing or executing the handoff", async t => {
	for(const [name, change] of [
		["runtime bytes", value => writeFile(value.runtimePath, "changed")]
		, ["component bytes", value => writeFile(value.archivePath, "changed")]
		, ["missing archive", value => rm(value.archivePath)]
		, ["missing receipt", value => rm(value.receiptPath)]
		, ["invalid JSON", value => writeFile(value.receiptPath, "not JSON")]
		, ["noncanonical JSON", value => writeFile(value.receiptPath, JSON.stringify(value.receipt))]
		, ["unsupported receipt", value => writeFile(value.receiptPath, canonicalJson({ ...value.receipt, kind: "other-receipt" }))]
		, ["archive traversal", value => writeFile(value.receiptPath, canonicalJson({ ...value.receipt, runtime: { ...value.receipt.runtime, archive: "../outside.tgz" } }))]
	]) await t.test(name, async child => {
		const local = await createLocalHandoff(child);
		await change(local);
		const result = await invoke(["--receipt", local.receiptPath]);
		assert.equal(result.exitCode, 1);
		assert.equal(result.response.result, null);
		assert.equal(result.response.diagnostics[0].path, local.receiptPath);
	});
});

test("signed verification fails closed for every integrity and authentication boundary", async t => {
	const rewriteReceipt = async (value, change) => {
		const receipt = JSON.parse(await readFile(value.receiptPath, "utf8"));
		change(receipt);
		const bytes = canonicalJson(receipt);
		await writeFile(value.receiptPath, bytes);
		await writeFile(join(value.directory, "release-receipt.sha256"), `${sha256(bytes)}  release-receipt.json\n`);
	};
	const replaceArgument = (value, flag, replacement) => { value.args[value.args.indexOf(flag) + 1] = replacement; };
	for(const [name, change] of [
		["archive bytes", value => writeFile(value.archivePath, "changed")]
		, ["missing archive", value => rm(value.archivePath)]
		, ["missing sidecar", value => rm(join(value.directory, "release-receipt.sha256"))]
		, ["sidecar hash", value => writeFile(join(value.directory, "release-receipt.sha256"), "changed")]
		, ["malformed receipt", value => writeFile(value.receiptPath, "not JSON")]
		, ["noncanonical receipt", async value => writeFile(value.receiptPath, JSON.stringify(JSON.parse(await readFile(value.receiptPath, "utf8"))))]
		, ["receipt type", value => rewriteReceipt(value, receipt => { receipt.predicateType = "unknown"; })]
		, ["receipt signature", value => rewriteReceipt(value, receipt => { receipt.envelope.signatures[0].sig = Buffer.alloc(64).toString("base64"); })]
		, ["publication signature", value => rewriteReceipt(value, receipt => { receipt.publicationAuthorization.envelope.signatures[0].sig = Buffer.alloc(64).toString("base64"); })]
		, ["trusted policy", value => replaceArgument(value, "--policy-sha256", "0".repeat(64))]
		, ["substituted policy", async value => {
			const policy = JSON.parse(await readFile(value.policyPath, "utf8"));
			policy.signers[0].identity = "https://example.invalid/substitute";
			await writeFile(value.policyPath, canonicalJson(policy));
		}]
		, ["subject", value => replaceArgument(value, "--subject", "another/package.tgz")]
		, ["coordinate", value => replaceArgument(value, "--coordinate", "another@1.2.3")]
		, ["filename", async value => {
			const renamed = join(value.directory, "renamed.tgz");
			await copyFile(value.archivePath, renamed);
			replaceArgument(value, "--archive", renamed);
		}]
	]) await t.test(name, async child => {
		const signed = await createSignedHandoff(child);
		await change(signed);
		const result = await invoke(signed.args);
		assert.equal(result.exitCode, 1);
		assert.equal(result.response.result, null);
		assert.equal(result.response.diagnostics.length, 1);
	});
});

test("verification cancellation wins before and after a validator completes", async () => {
	for(const before of [true, false])
	{
		const cancellation = new AbortController();
		let calls = 0;
		const verify = createVerificationHandler({ verifyLocal: async () => {
			calls++;
			cancellation.abort();
			return { verified: true };
		} });
		if(before) cancellation.abort();
		const result = await invoke(["--receipt", "unused.json"], { signal: cancellation.signal, handlers: { verify } });
		assert.equal(result.exitCode, 130);
		assert.equal(result.response.status, "cancelled");
		assert.equal(result.response.result, null);
		assert.equal(calls, before ? 0 : 1);
	}
});

test("an offline-installed runtime-free CLI verifies both handoffs with only Node on PATH", async t => {
	const scratch = await mkdtemp(join(tmpdir(), "lean-bridge-verify-installed-"));
	t.after(() => rm(scratch, { recursive: true, force: true }));
	const built = await buildCliNpmPackage({ outputRoot: join(scratch, "candidate") });
	assert.equal(built.report.runtimeIncluded, false);
	const consumer = join(scratch, "verification tools");
	await mkdir(consumer);
	await execute("npm", ["install", "--prefix", consumer, "--offline", "--ignore-scripts", "--no-audit", "--no-fund", built.archive]);
	const executable = join(consumer, "node_modules/.bin/lean-bridge");
	const working = join(scratch, "unrelated");
	const bin = join(scratch, "bin");
	await mkdir(working);
	await mkdir(bin);
	await symlink(process.execPath, join(bin, "node"));
	await writeFile(join(working, "lean-bridge.cli.json"), "not valid JSON");
	const local = await createLocalHandoff(t);
	const signed = await createSignedHandoff(t);
	for(const script of [local.verifierPath, join(signed.directory, "verify-release-archive.mjs")])
		await writeFile(script, 'throw new Error("Do not execute code from the handoff");\n');
	const inputPaths = [
		local.receiptPath, local.runtimePath, local.archivePath, local.verifierPath
		, signed.receiptPath, signed.archivePath, signed.policyPath
		, join(signed.directory, "release-receipt.sha256")
	];
	const before = await Promise.all(inputPaths.map(path => readFile(path)));
	await chmod(working, 0o555);
	try
	{
		for(const extra of [{}, { LEAN_BRIDGE_CONFIG: undefined }])
		{
			const options = { cwd: working, env: { ...hostileEnvironment, ...extra, PATH: bin, LANG: "C.UTF-8" } };
			for(const [args, authenticated] of [[["--receipt", local.receiptPath], false], [signed.args, true]])
			{
				const result = JSON.parse((await execute(executable, ["verify", ...args, "--json"], options)).stdout);
				assert.equal(result.status, "ok");
				assert.equal(result.result.authenticated, authenticated);
			}
		}
		assert.deepEqual(await Promise.all(inputPaths.map(path => readFile(path))), before);
		assert.deepEqual(await readdir(working), ["lean-bridge.cli.json"]);
	}
	finally
	{ await chmod(working, 0o755); }
});
