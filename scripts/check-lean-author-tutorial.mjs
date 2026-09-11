/**
 * Execute the documented author source through a strict proof check and local package handoff.
 *
 * @file
 */

import assert from "node:assert/strict";
import { execFile, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { access, cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";
import { verifyComponentPackageReceipt } from "../src/release/component-package-receipt.mjs";

const execute = promisify(execFile);
const options = new Map();
for(let index = 2; index < process.argv.length; index += 2)
{
	const key = process.argv[index];
	if(!["--output", "--backend", "--runtime", "--lean", "--engine"].includes(key) || process.argv[index + 1] === undefined) throw new Error(`Unknown or incomplete option: ${key}`);
	options.set(key, process.argv[index + 1]);
}
const repository = resolve(import.meta.dirname, "..");
const engine = resolve(options.get("--engine") ?? repository);
const output = resolve(options.get("--output") ?? join(repository, "build/documentation-author-acceptance"));
const backend = options.get("--backend") ?? "docker";
const runtime = resolve(options.get("--runtime") ?? join(repository, "build/lean-link-spike/lazy"));
const lean = options.get("--lean") ?? process.env.LEAN_BRIDGE_LEAN
	?? join(repository, ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2/bin/lean");
const fixture = join(repository, "tests/fixtures/documentation/lean-author");
const sha256 = value => createHash("sha256").update(value).digest("hex");
await assert.rejects(access(output), { code: "ENOENT" }, "Use a fresh acceptance output directory");
await Promise.all([access(lean), access(join(runtime, "main.mjs")), access(join(runtime, "main.wasm"))]);
await mkdir(dirname(output), { recursive: true });
const scratch = await mkdtemp(join(tmpdir(), "lean-bridge-author-tutorial-"));
const project = join(scratch, "onboarding-small");
const consumer = join(scratch, "consumer");
const logs = [];
let completed = false;
const environment = { ...process.env, LEAN_BRIDGE_BUILD_BACKEND: backend, LEAN_BRIDGE_RUNTIME_ROOT: runtime };
const run = async (name, command, args, cwd = project) => {
	process.stdout.write(`${name}\n`);
	try
	{
		const result = await execute(command, args, { cwd, env: environment, timeout: 30 * 60 * 1000, maxBuffer: 16 * 1024 * 1024 });
		logs.push({ name, stdout: result.stdout, stderr: result.stderr });
		return result;
	}
	catch(error)
	{
		logs.push({ name, stdout: error.stdout ?? "", stderr: error.stderr ?? "", error: error.message });
		throw error;
	}
};
const cli = (name, args) => run(name, process.execPath, [join(engine, "scripts/lean-bridge.mjs"), ...args, "--json", "--progress", "json"]);

try
{
	await cp(fixture, project, { recursive: true });
	const source = await readFile(join(project, "OnboardingSmall.lean"), "utf8");
	const proof = await run("Check the documented theorem", lean, ["-DwarningAsError=true", "OnboardingSmall.lean"]);
	assert.match(proof.stdout, /'OnboardingSmall\.add_commutative' does not depend on any axioms/);
	const rejected = [];
	for(const [name, input] of [
		["changed implementation", source.replace("left + right", "left")]
		, ["admitted proof", source.replace("Nat.add_comm left right", "by sorry")]
	]) {
		const result = spawnSync(lean, ["--stdin", "-DwarningAsError=true"], { cwd: project, input, encoding: "utf8", timeout: 30_000 });
		assert.equal(result.status, 1, `${name} must fail strict Lean checking`);
		rejected.push({ name, exitCode: result.status, output: result.stdout.trim() });
	}
	await run("Initialize a separate source repository", "git", ["init", "--quiet"]);
	await run("Stage the tutorial source and license", "git", ["add", ".gitignore", "lakefile.toml", "lean-toolchain", "OnboardingSmall.lean", "package.json", "LICENSE"]);
	await run("Commit the exact tutorial source", "git", ["-c", "user.name=Lean Bridge tutorial", "-c", "user.email=tutorial@example.invalid", "commit", "--quiet", "-m", "Add documented Lean component"]);
	const revision = (await run("Read the candidate revision", "git", ["rev-parse", "HEAD"])).stdout.trim();
	await cli("Analyze the documented exports", ["analyze", "--project", ".", "--check", "--output", "build/analysis"]);
	const analysis = JSON.parse(await readFile(join(project, "build/analysis/project-analysis.json"), "utf8"));
	assert.deepEqual(analysis.proposedExports, ["lean:OnboardingSmall.add", "lean:OnboardingSmall.isEmpty"]);
	assert.deepEqual(analysis.adapterHints.filter(item => item.required), []);
	await cli("Build the documented component", ["build", "--project", ".", "--target", "npm", "--output", "build/lean-bridge-release"]);
	const assurance = JSON.parse(await readFile(join(project, "build/lean-bridge-release/bundle/metadata/assurance.json"), "utf8"));
	assert.deepEqual(assurance.claims, analysis.bindingIr.document.assurance);
	assert.ok(assurance.claims.every(claim => claim.state === "unverified"));
	assert.deepEqual(assurance.claims.find(claim => claim.subject === "lean:OnboardingSmall.add").theorems, ["OnboardingSmall.add_commutative"]);
	assert.equal((await run("Check source remains clean", "git", ["status", "--porcelain=v1", "--untracked-files=all"])).stdout, "");
	await cli("Build and compare two committed source copies", ["publish", "--project", ".", "--target", "npm", "--dry-run", "--output", output]);
	const packageRoot = join(output, "release/packages/npm");
	const receiptPath = join(packageRoot, "component-package-receipt.json");
	const receipt = JSON.parse(await readFile(receiptPath, "utf8"));
	const verified = await verifyComponentPackageReceipt({ receiptPath });
	const checkedHandoff = JSON.parse((await run("Verify the handoff through the CLI", process.execPath,
		[join(engine, "scripts/lean-bridge.mjs"), "verify", "--receipt", receiptPath, "--json"], scratch)).stdout);
	assert.deepEqual(checkedHandoff.result, { ...verified, verificationType: "local-npm", authenticated: false });
	await run("Run the copied standalone receipt verifier", process.execPath, [join(packageRoot, "verify-component-package-receipt.mjs"), "--receipt", receiptPath], scratch);
	await mkdir(consumer);
	await run("Initialize a separate consumer", "npm", ["init", "-y"], consumer);
	await run("Install the exact local archives", "npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund", join(packageRoot, receipt.runtime.archive), join(packageRoot, receipt.package.archive)], consumer);
	await cp(join(repository, "tests/fixtures/documentation/lean-author-consumer/index.mjs"), join(consumer, "index.mjs"));
	const example = await run("Run the documented JavaScript file", process.execPath, ["index.mjs"], consumer);
	assert.equal(example.stdout, "123n\ntrue\nfalse\n");
	const invocationSource = [
		'import * as component from "onboarding-small";'
		, 'const { add, isEmpty } = component;'
		, 'process.stdout.write(JSON.stringify({ exports: Object.keys(component).sort(), add: String(add(100n, 23n)), empty: isEmpty(""), nonempty: isEmpty("browser") }));'
	].join("\n");
	const invoked = await run("Call only installed public exports", process.execPath, ["--input-type=module", "-e", invocationSource], consumer);
	const calls = JSON.parse(invoked.stdout);
	assert.deepEqual(calls, { exports: ["add", "default", "isEmpty"], add: "123", empty: true, nonempty: false });
	const reproducibility = JSON.parse(await readFile(join(output, "evidence/reproducibility.json"), "utf8"));
	assert.equal(reproducibility.result, "passed");
	assert.deepEqual(reproducibility.differences, []);
	const packagedSource = await readFile(join(output, "release/bundle/source/OnboardingSmall.lean"), "utf8");
	assert.equal(packagedSource, source);
	const report = {
		schemaVersion: 1, kind: "lean-bridge-author-tutorial", status: "passed"
		, fixture: "tests/fixtures/documentation/lean-author"
		, sourceRevision: revision
		, sourceSha256: sha256(source), strictProof: proof.stdout.trim(), rejected
		, assurance: assurance.claims.map(({ subject, state, theorems }) => ({ subject, state, theorems }))
		, backend, cleanBuilds: reproducibility.builds.length
		, comparedFiles: reproducibility.artifacts.length
		, externalRegistryWrites: false, installationScripts: false
		, calls, receipt: verified
	};
	await writeFile(join(output, "author-acceptance.json"), `${JSON.stringify(report, null, 2)}\n`);
	await writeFile(join(output, "evidence/author-commands.json"), `${JSON.stringify(logs, null, 2)}\n`);
	completed = true;
	process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}
finally
{
	if(completed) await rm(scratch, { recursive: true, force: true });
	else
	{
		await writeFile(join(scratch, "failure-commands.json"), `${JSON.stringify(logs, null, 2)}\n`);
		process.stderr.write(`Preserved failed tutorial inputs and logs at ${scratch}\n`);
	}
}
