/**
 * Tests the consumer Node behavior.
 *
 * @file
 */

import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import {
	STEADY_STATE_BOX_VALUE,
	STEADY_STATE_MEASURED_ITERATIONS,
	STEADY_STATE_OPERATION,
	STEADY_STATE_WARMUP_ITERATIONS,
	writeConsumerPerformance,
} from "../src/adoption/consumer-performance.mjs";

const execute = promisify(execFile);
const repository = resolve(".");
const runtimeRoot = resolve(process.env.LEAN_BRIDGE_RUNTIME_ROOT ?? "build/consumer-ci-runtime/lazy");
const alphaPackageRoot = resolve(process.env.LEAN_BRIDGE_ALPHA_NPM_PACKAGE_ROOT ?? "build/consumer-node-alpha-package");
const maxBuffer = 64 * 1024 * 1024;

const run = (command, args, options = {}) => execute(command, args, { maxBuffer, ...options });

const filesAt = async directory => {
	const files = [];
	const visit = async current => {
		for(const entry of await readdir(current, { withFileTypes: true }))
		{
			const path = join(current, entry.name);
			if(entry.isDirectory() && entry.name !== ".git" && entry.name !== "build") await visit(path);
			else if(entry.isFile()) files.push(path);
		}
	};
	await visit(directory);
	return files.sort();
};

test("installed CLI packages one plain Lean project for clean JavaScript and TypeScript consumers", async context => {
  const scratch = await mkdtemp(join(tmpdir(), "lean-bridge-node-consumer-"));
  try
{
    const prefix = join(scratch, "prefix");
    const project = join(scratch, "project");
    const consumer = join(scratch, "consumer");
    await run("npm", [
      "install", "--global", "--ignore-scripts", "--no-audit", "--no-fund"
      , "--prefix", prefix, repository
    ]);
    const cli = join(prefix, "bin", "lean-bridge");
    const help = await run(cli, ["--help"]);
    assert.match(help.stdout, /lean-bridge <command>/);

    await cp(join(repository, "tests/fixtures/onboarding/small"), project, { recursive: true });
    await writeFile(join(project, ".gitignore"), "build/\n");
    await run("git", ["init", "--quiet"], { cwd: project });
    await run("git", ["add", "."], { cwd: project });
    await run("git", [
      "-c", "user.name=Lean Bridge CI"
      , "-c", "user.email=ci@example.invalid"
      , "commit", "--quiet", "-m", "Add plain Lean component"
    ], { cwd: project });
    const sourceFiles = await filesAt(project);
    const sourceBefore = await Promise.all(sourceFiles.map(path => readFile(path)));
    const leanSource = await readFile(join(project, "OnboardingSmall.lean"), "utf8");
    assert.doesNotMatch(leanSource, /@\[/);

    const environment = {
      ...process.env,
      LEAN_BRIDGE_BUILD_BACKEND: process.env.LEAN_BRIDGE_BUILD_BACKEND ?? "nix"
      , LEAN_BRIDGE_RUNTIME_ROOT: runtimeRoot
    };
    const analyze = JSON.parse((await run(cli, [
      "analyze", "--project", project, "--check"
      , "--output"
      , join(project, "build/analysis")
      , "--json"
      , "--progress"
      , "none"
    ], { env: environment })).stdout);
    assert.equal(analyze.status, "ok");
    assert.deepEqual(analyze.prompts, []);
    assert.deepEqual(analyze.result.adapterHints, []);
    assert.deepEqual(analyze.result.proposedExports, [
      "lean:OnboardingSmall.add"
      , "lean:OnboardingSmall.isEmpty"
    ]);

    const build = JSON.parse((await run(cli, [
      "build", "--project", project, "--target", "npm"
      , "--output"
      , join(project, "build/lean-bridge-release")
      , "--json"
      , "--progress"
      , "none"
    ], { env: environment })).stdout);
    assert.equal(build.status, "ok");
    assert.equal(build.result.bundle.component, "onboarding-small@1.0.0");
    assert.equal(build.result.componentBinariesRebuiltByProjection, false);

    const gate = JSON.parse((await run(cli, [
      "publish", "--project", project, "--target", "npm", "--dry-run"
      , "--output"
      , join(project, "build/lean-bridge-dry-run")
      , "--json"
      , "--progress"
      , "none"
    ], { env: environment })).stdout);
    assert.equal(gate.status, "ok");
    assert.equal(gate.result.result, "passed");
    assert.equal(gate.result.externalRegistryWrites, false);
    assert.equal(gate.result.receipt.verified, true);

    const release = join(project, "build/lean-bridge-dry-run/release/packages/npm");
    const packageFiles = (await readdir(release)).sort();
    const runtimeArchive = packageFiles.find(path => /^lean-bridge-runtime-.+\.tgz$/.test(path));
    const componentArchive = packageFiles.find(path => /^onboarding-small-.+\.tgz$/.test(path));
    const alphaArchive = (await readdir(alphaPackageRoot)).find(path => /^lean-bridge-alpha-.+\.tgz$/.test(path));
    assert.ok(runtimeArchive);
    assert.ok(componentArchive);
    assert.ok(alphaArchive);
    assert.ok(packageFiles.includes("component-package-receipt.json"));

    await mkdir(consumer);
    await run("npm", ["init", "--yes"], { cwd: consumer });
    await run("npm", ["pkg", "set", "type=module"], { cwd: consumer });
    await run("npm", [
      "install", "--ignore-scripts", "--no-audit", "--no-fund"
      , join(release, runtimeArchive)
      , join(release, componentArchive)
      , join(alphaPackageRoot, alphaArchive)
    ], { cwd: consumer });

    const javascript = await run("node", ["--input-type=module", "-e"
    , [
      'import { Box } from "@lean-bridge/alpha";'
      , `const box = new Box(${STEADY_STATE_BOX_VALUE});`
      , `const iterations = ${STEADY_STATE_MEASURED_ITERATIONS};`
      , `for (let index = 0; index < ${STEADY_STATE_WARMUP_ITERATIONS}; index += 1) box.read();`
      , "let checksum = 0;"
      , "const started = performance.now();"
      , "for (let index = 0; index < iterations; index += 1) checksum += box.read();"
      , "const durationNanoseconds = (performance.now() - started) * 1000000;"
      , "box.dispose();"
      , 'const { add, isEmpty } = await import("onboarding-small");'
      , 'process.stdout.write(JSON.stringify({ add: String(add(100n, 23n)), empty: isEmpty(""), nonempty: isEmpty("Lean"), checksum, performance: { iterations, durationNanoseconds } }));'
    ].join("\n")], { cwd: consumer });
    const javascriptResult = JSON.parse(javascript.stdout);
    assert.deepEqual({
      add: javascriptResult.add
      , empty: javascriptResult.empty
      , nonempty: javascriptResult.nonempty
    }, { add: "123", empty: true, nonempty: false });
    assert.equal(javascriptResult.checksum, STEADY_STATE_BOX_VALUE * javascriptResult.performance.iterations);
    await writeConsumerPerformance({
      consumer: "node-javascript"
      , operation: STEADY_STATE_OPERATION
      , timingMode: "steady-state"
      , scope: "steady-state generated JavaScript API call through the Alpha npm package",
      ...javascriptResult.performance
    });

    const declarations = await readFile(join(consumer, "node_modules/onboarding-small/index.d.ts"), "utf8");
    assert.doesNotMatch(declarations, /\bany\b/);
    assert.match(declarations, /add\(left: bigint, right: bigint\): bigint/);
    const alphaDeclarations = await readFile(join(consumer, "node_modules/@lean-bridge/alpha/index.d.ts"), "utf8");
    assert.doesNotMatch(alphaDeclarations, /\bany\b/);
    assert.match(alphaDeclarations, /class Box/);
    await writeFile(join(consumer, "index.ts"), [
      'import { Box } from "@lean-bridge/alpha";'
      , `const box: Box = new Box(${STEADY_STATE_BOX_VALUE});`
      , `const iterations: number = ${STEADY_STATE_MEASURED_ITERATIONS};`
      , `for (let index = 0; index < ${STEADY_STATE_WARMUP_ITERATIONS}; index += 1) box.read();`
      , "let checksum: number = 0;"
      , "const started: number = performance.now();"
      , "for (let index = 0; index < iterations; index += 1) checksum += box.read();"
      , "const durationNanoseconds: number = (performance.now() - started) * 1000000;"
      , "box.dispose();"
      , 'const { add, isEmpty } = await import("onboarding-small");'
      , "const sum: bigint = add(20n, 22n);"
      , 'const empty: boolean = isEmpty("");'
      , 'if (sum !== 42n || !empty) throw new Error("unexpected Lean result");'
      , "console.log(JSON.stringify({ iterations, durationNanoseconds, checksum }));"
      , ""
    ].join("\n"));
    await writeFile(join(consumer, "tsconfig.json"), `${JSON.stringify({
      compilerOptions: {
        target: "ES2022"
        , module: "NodeNext"
        , moduleResolution: "NodeNext"
        , lib: ["ES2022", "DOM", "ESNext.Disposable"]
        , strict: true
        , noImplicitAny: true
        , skipLibCheck: false
        , outDir: "dist"
      }
      , include: ["index.ts"]
    }, null, 2)}\n`);
    await run(join(repository, "node_modules/.bin/tsc"), ["--project", "tsconfig.json"], { cwd: consumer });
    const typescript = JSON.parse((await run("node", ["dist/index.js"], { cwd: consumer })).stdout);
    assert.equal(typescript.checksum, STEADY_STATE_BOX_VALUE * typescript.iterations);
    await writeConsumerPerformance({
      consumer: "node-typescript"
      , operation: STEADY_STATE_OPERATION
      , timingMode: "steady-state"
      , scope: "steady-state generated TypeScript API call through the Alpha npm package after compilation"
      , iterations: typescript.iterations
      , durationNanoseconds: typescript.durationNanoseconds
    });

    const verification = JSON.parse((await run("node", [
      join(repository, "scripts/verify-component-package-receipt.mjs")
      , "--receipt", join(release, "component-package-receipt.json")
    ])).stdout);
    assert.equal(verification.verified, true);
    assert.equal(verification.component, "onboarding-small@1.0.0");
    assert.match(verification.runtime, /^@lean-bridge\/runtime@0\.0\.0-abi1\./);
    assert.equal(verification.package, "onboarding-small@1.0.0");
    const receipt = JSON.parse(await readFile(join(release, "component-package-receipt.json"), "utf8"));
    assert.equal(receipt.runtime.archive, runtimeArchive);
    assert.equal(receipt.package.archive, componentArchive);

    const sourceAfter = await Promise.all(sourceFiles.map(path => readFile(path)));
    assert.deepEqual(sourceAfter, sourceBefore);
    assert.equal((await run("git", ["status", "--porcelain=v1", "--untracked-files=all"], { cwd: project })).stdout, "");
    context.diagnostic(`verified ${verification.component} for JavaScript and TypeScript`);
} finally
{
    await rm(scratch, { recursive: true, force: true });
}
});
