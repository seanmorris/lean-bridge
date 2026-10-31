#!/usr/bin/env node
/**
 * Record the Alpha npm package module-closure repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { gitSourceHistoryTransition }
	from "../tests/helpers/source-history-stream.mjs";
import {
	alphaNpmModuleClosureHistoryAdditions
	, alphaNpmModuleClosureHistoryPath
	, alphaNpmModuleClosureImplementation
	, alphaNpmModuleClosureImplementationPaths
	, alphaNpmModuleClosureIntegrationPaths
	, alphaNpmModuleClosurePinPaths
	, alphaNpmModuleClosurePredecessor
	, alphaNpmModuleClosureSourceCommit
} from "../tests/helpers/alpha-npm-module-closure-source-history.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-alpha-npm-module-closure-source-history.mjs");
assert.equal(existsSync(alphaNpmModuleClosureHistoryPath), false
	, alphaNpmModuleClosureHistoryPath + " already exists");
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, alphaNpmModuleClosureSourceCommit);
assert.equal(git(["rev-parse", "HEAD^"]).trim()
	, alphaNpmModuleClosureImplementation);
assert.equal(git(["rev-parse", alphaNpmModuleClosureImplementation + "^"]).trim()
	, alphaNpmModuleClosurePredecessor);
assert.deepEqual(names(["diff", "--name-only"
	, alphaNpmModuleClosurePredecessor, alphaNpmModuleClosureImplementation, "--"])
, [...alphaNpmModuleClosureImplementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only"
	, alphaNpmModuleClosureImplementation
	, alphaNpmModuleClosureSourceCommit
	, "--"])
, [...alphaNpmModuleClosurePinPaths].sort());
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--", ...alphaNpmModuleClosureIntegrationPaths])
, [...alphaNpmModuleClosureIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...alphaNpmModuleClosureHistoryAdditions])
, [...alphaNpmModuleClosureHistoryAdditions].sort());

const npmPackagePath = "src/release/npm-package.mjs";
const bundlePath = "src/release/universal-release-bundle.mjs";
const npmSource = git(["show"
	, alphaNpmModuleClosureImplementation + ":" + npmPackagePath]);
const bundleSource = git(["show"
	, alphaNpmModuleClosureImplementation + ":" + bundlePath]);
assert.match(npmSource
	, /internal\/bridge\/src\/binding-ir\/default-value\.mjs/u);
assert.match(npmSource, /validateNpmPackageModuleClosure/u);
assert.match(bundleSource
	, /runtime\/javascript\/src\/binding-ir\/default-value\.mjs/u);
assert.match(bundleSource
	, /validators\/src\/binding-ir\/default-value\.mjs/u);

const inventoryPath = "docs/type-surface.v1.json";
const beforeInventory = git(["show"
	, alphaNpmModuleClosureImplementation + ":" + inventoryPath]);
const afterInventory = git(["show"
	, alphaNpmModuleClosureSourceCommit + ":" + inventoryPath]);
const previousNpmSha256 = sha256(git(["show"
	, alphaNpmModuleClosurePredecessor + ":" + npmPackagePath]));
const currentNpmSha256 = sha256(npmSource);
const refreshedCitationCount = afterInventory.split(currentNpmSha256).length - 1;
assert.equal(refreshedCitationCount, 1);
assert.equal(afterInventory.replaceAll(currentNpmSha256, previousNpmSha256)
	, beforeInventory);

const updates = [];
for(const path of alphaNpmModuleClosureImplementationPaths)
	updates.push(await gitSourceHistoryTransition(path
		, alphaNpmModuleClosurePredecessor
		, alphaNpmModuleClosureImplementation
		, { maximumEditBytes: 256 * 1024 * 1024 }));
for(const path of alphaNpmModuleClosurePinPaths)
	updates.push(await gitSourceHistoryTransition(path
		, alphaNpmModuleClosureImplementation
		, alphaNpmModuleClosureSourceCommit
		, { maximumEditBytes: 256 * 1024 * 1024 }));

const directory = await mkdtemp(join(tmpdir(), "lean-alpha-npm-closure-"));
try
{
	const environment = {
		...process.env, GIT_INDEX_FILE: join(directory, "index")
		, GIT_AUTHOR_NAME: "Lean Bridge history writer"
		, GIT_AUTHOR_EMAIL: "history@example.invalid"
		, GIT_COMMITTER_NAME: "Lean Bridge history writer"
		, GIT_COMMITTER_EMAIL: "history@example.invalid"
		, GIT_AUTHOR_DATE: "2000-01-01T00:00:00Z"
		, GIT_COMMITTER_DATE: "2000-01-01T00:00:00Z"
	};
	const temporaryGit = (arguments_, options = {}) => execFileSync(
		"git", arguments_, { encoding: "utf8"
			, maxBuffer: 512 * 1024 * 1024, env: environment, ...options });
	temporaryGit(["read-tree", alphaNpmModuleClosureSourceCommit]);
	temporaryGit(["add", "--sparse", "--"
		, ...alphaNpmModuleClosureIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit(["commit-tree", tree, "-p"
		, alphaNpmModuleClosureSourceCommit]
	, { input: "Authenticate Alpha npm module closure\n" }).trim();
	const integrationUpdates = [];
	for(const path of alphaNpmModuleClosureIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(path
			, alphaNpmModuleClosureSourceCommit, integrationCommit
			, { maximumEditBytes: 128 * 1024 * 1024 }));
	const historyAdditions = [];
	for(const path of alphaNpmModuleClosureHistoryAdditions)
		historyAdditions.push({ path, sha256: sha256(await readFile(path)) });
	await writeFile(alphaNpmModuleClosureHistoryPath, canonicalJson({
		schemaVersion: 1
		, milestone: "alpha-npm-module-closure-source-v1"
		, predecessorCommit: alphaNpmModuleClosurePredecessor
		, implementationCommit: alphaNpmModuleClosureImplementation
		, sourceCommit: alphaNpmModuleClosureSourceCommit
		, failedRun: { workflow: 41204400085, job: 124548376979 }
		, failure: {
			consumer: "docker-engine-node"
			, completedAt: "2026-10-31T14:05:43Z"
			, code: "ERR_MODULE_NOT_FOUND"
			, importer: "internal/bridge/src/binding-ir/contract.mjs"
			, missing: "internal/bridge/src/binding-ir/default-value.mjs"
			, diskClosurePassed: true, executedProductBoundary: true
		}
		, bundleAdditions: [
			"runtime/javascript/src/binding-ir/default-value.mjs"
			, "validators/src/binding-ir/default-value.mjs"
		]
		, packageAddition: "internal/bridge/src/binding-ir/default-value.mjs"
		, closure: {
			assemblyGuard: "validateNpmPackageModuleClosure"
			, covers: "every relative import in every assembled .mjs module"
			, omittedDependencyControl: true
		}
		, scope: "Repair the installed Alpha npm package after the bounded Docker consumer reached real execution and found that contract.mjs imported an omitted default-value.mjs. Carry the dependency through both canonical-bundle roles, copy it into the installed internal bridge, and reject every assembled package whose complete relative ES-module graph is open. Prove the positive package path and a negative omitted-dependency mutation. Refresh exactly one live source citation without changing the public API or type support matrix."
		, refreshedCitationCount
		, currentSourcePins: [{ path: npmPackagePath
			, count: refreshedCitationCount, previous: previousNpmSha256
			, current: currentNpmSha256 }]
		, updates, integrationUpdates, historyAdditions
	}), { flag: "wx" });
	process.stdout.write("Recorded " + updates.length
		+ " source transitions, " + integrationUpdates.length
		+ " integration transitions and " + refreshedCitationCount
		+ " live source pin.\n");
}
finally
{ await rm(directory, { recursive: true, force: true }); }
