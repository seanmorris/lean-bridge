#!/usr/bin/env node

import { execFile } from "node:child_process";
import { cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { promisify } from "node:util";

import { analyzeLeanProject } from "../src/analyze/lean-project.mjs";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { buildComponentNpmPackages } from "../src/release/component-npm-package.mjs";
import { verifyComponentPackageReceipt } from "../src/release/component-package-receipt.mjs";
import { collectReleaseInventory, compareReleaseInventories, hashReleaseInventory } from "../src/release/reproducibility.mjs";

const execute = promisify(execFile);
const options = new Map();
for(let index = 2; index < process.argv.length; index += 2) options.set(process.argv[index], process.argv[index + 1]);
const repository = resolve(options.get("--engine") ?? process.cwd());
const fixture = resolve(options.get("--fixture") ?? join(repository, "tests/fixtures/onboarding/small"));
const output = resolve(options.get("--output") ?? join(repository, "build/plain-project-package-acceptance"));
const runtimeRoot = resolve(options.get("--runtime") ?? join(repository, "build/lean-link-spike/lazy"));
const backend = options.get("--backend") ?? "nix";
const scratch = await mkdtemp(join(tmpdir(), "lean-bridge-plain-project-"));

try
{
	const project = join(scratch, "plain-lean-project");
	const consumer = join(scratch, "javascript-consumer");
	await cp(fixture, project, { recursive: true });
	await mkdir(consumer);
	const analysis = await analyzeLeanProject(project, { targets: ["npm"] });
	if(analysis.bindingIr === null || analysis.adapterHints.some(item => item.required)) throw new Error("plain project analysis is incomplete");
	const builds = [];
	for(const name of ["a", "b"])
	{
		const buildRoot = join(scratch, `build-${name}`);
		const packageRoot = join(scratch, `packages-${name}`);
		const build = await buildCanonicalProject({
			projectRoot: project
			, engineRoot: repository
			, outputRoot: buildRoot
			, environment: { ...process.env, LEAN_BRIDGE_BUILD_BACKEND: backend }
			, targets: ["npm"]
		});
		const packages = await buildComponentNpmPackages({ bundleRoot: join(buildRoot, "bundle"), runtimeRoot, outputRoot: packageRoot });
		const buildInventory = await collectReleaseInventory(buildRoot, { prefix: "build" });
		const packageInventory = await collectReleaseInventory(packageRoot, { prefix: "packages" });
		builds.push({ name, build, packages, inventory: new Map([...buildInventory, ...packageInventory]) });
	}
	const comparison = compareReleaseInventories(builds[0].inventory, builds[1].inventory);
	if(comparison.differences.length !== 0) throw new Error(`plain project rebuild produced ${comparison.differences.length} differences`);

	await execute("npm", ["init", "-y"], { cwd: consumer });
	await execute("npm", ["install", "--ignore-scripts", builds[0].packages.runtimeArchive, builds[0].packages.componentArchive], { cwd: consumer });
	const invocation = await execute("node", ["--input-type=module", "-e"
		, [
			'import { add, isEmpty } from "onboarding-small";'
			, 'process.stdout.write(JSON.stringify({ add: String(add(100n, 23n)), empty: isEmpty(""), nonempty: isEmpty("browser") }));'
		].join("\n")], { cwd: consumer });
	const calls = JSON.parse(invocation.stdout);
	const receiptPath = join(builds[0].packages.output, "component-package-receipt.json");
	const receipt = await verifyComponentPackageReceipt({ receiptPath });
	const report = Object.freeze({
		schemaVersion: 1
		, kind: "lean-bridge-plain-project-package-acceptance"
		, status: "passed"
		, projectLocation: "temporary-directory-outside-repository"
		, component: analysis.bindingIr.document.component.id
		, declarations: Object.freeze(analysis.bindingIr.document.declarations.map(item => item.source.declaration).sort())
		, annotationsRequired: 0
		, promptsRequired: 0
		, build: Object.freeze({
			backend
			, engineIdentitySha256: builds[0].build.engineIdentitySha256
			, executionRequestSha256: builds[0].build.executionRequestSha256
			, componentPlanSha256: builds[0].build.componentPlanSha256
			, compilationPlanSha256: builds[0].build.compilationPlanSha256
			, componentBundleSha256: builds[0].build.bundle.manifestSha256
			, componentIdentitySha256: builds[0].build.bundle.identitySha256
		})
		, reproducibility: Object.freeze({
			dryRun: true
			, cleanBuilds: 2
			, inventorySha256: hashReleaseInventory(builds[0].inventory)
			, files: builds[0].inventory.size
			, differences: Object.freeze([])
			, externalRegistryWrites: false
		})
		, installation: Object.freeze({
			packageManager: "npm"
			, installScripts: false
			, runtimePackage: builds[0].packages.report.runtime.package
			, componentPackage: builds[0].packages.report.package.package
			, componentArchive: basename(builds[0].packages.componentArchive)
			, runtimeArchive: basename(builds[0].packages.runtimeArchive)
			, publicImports: Object.freeze(["add", "isEmpty"])
			, calls: Object.freeze(calls)
		})
		, receipt: Object.freeze({
			verified: receipt.verified
			, receiptSha256: receipt.receiptSha256
			, component: receipt.component
			, componentIdentitySha256: receipt.componentIdentitySha256
			, runtime: receipt.runtime
			, package: receipt.package
		})
		, identityAudit: Object.freeze({
			expectedComponent: analysis.bindingIr.document.component.id
			, forbiddenFixtureName: "Alpha"
			, forbiddenFixturePresent: JSON.stringify({ analysis, build: builds[0].build, receipt }).includes("Alpha")
		})
	});
	if(report.identityAudit.forbiddenFixturePresent) throw new Error("plain project evidence contains the Alpha fixture identity");
	await rm(output, { recursive: true, force: true });
	await mkdir(output, { recursive: true });
	await writeFile(join(output, "acceptance.json"), `${JSON.stringify(report, null, 2)}\n`);
	await cp(receiptPath, join(output, "component-package-receipt.json"));
	await cp(builds[0].packages.componentArchive, join(output, basename(builds[0].packages.componentArchive)));
	await cp(builds[0].packages.runtimeArchive, join(output, basename(builds[0].packages.runtimeArchive)));
	process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} finally
{
	await rm(scratch, { recursive: true, force: true });
}
