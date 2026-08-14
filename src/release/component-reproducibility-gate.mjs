/**
 * Implements the component reproducibility gate module in the release subsystem.
 *
 * @file
 */

import { createHash } from "node:crypto";
import {
	cp,
	mkdir,
	mkdtemp,
	rename,
	rm,
	stat,
	writeFile,
} from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { buildCanonicalProject, processBuildRunner } from "../build/canonical-build.mjs";
import { canonicalJson } from "../capsule/node.mjs";
import { buildComponentNpmPackages } from "./component-npm-package.mjs";
import { verifyComponentPackageReceipt } from "./component-package-receipt.mjs";
import {
	collectReleaseInventory,
	compareReleaseInventories,
	hashReleaseInventory,
} from "./reproducibility.mjs";
import { ReproducibilityGateError } from "./reproducibility-gate.mjs";

const installedEngineRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const sha256 = value => createHash("sha256").update(value).digest("hex");
const portable = value => value.replaceAll("\\", "/");

const fail = (code, message, options = {}) => {
	throw new ReproducibilityGateError(code, message, options);
};

const capture = (runner, request) => runner.capture({ timeoutMs: 30 * 60 * 1000, ...request });

const outputAbsent = async ({ projectRoot, outputRoot }) => {
	const project = resolve(projectRoot);
	const output = resolve(outputRoot);
	if(output === project || project.startsWith(`${output}${sep}`))
	{
		fail("unsafe-gate-output", "Gate output cannot replace the project or one of its parents");
	}
	try
	{
		await stat(output);
		fail("gate-output-exists", `Gate output already exists: ${output}`, {
			hint: "Choose a new empty output path."
		});
	} catch(error)
	{
		if(error instanceof ReproducibilityGateError) throw error;
		if(error.code !== "ENOENT") throw error;
	}
	return output;
};

/**
 * Prepares clean component sources in an isolated, deterministic form for the deterministic release and independent-verification pipeline.
 *
 * @param root0 - Named inputs and dependency overrides used to prepare clean component sources.
 * @param root0.projectRoot - Filesystem root containing the project.
 * @param root0.scratchRoot - Filesystem root containing the scratch.
 * @param root0.runner - Process runner used for isolated external commands.
 */
export const prepareCleanComponentSources = async ({
	projectRoot
	, scratchRoot
	, runner = processBuildRunner
}) => {
	const project = resolve(projectRoot);
	let repositoryRoot;
	try
	{
		repositoryRoot = resolve((await capture(runner, {
			command: "git"
			, args: ["-C", project, "rev-parse", "--show-toplevel"]
			, cwd: project
		})).stdout.trim());
	} catch(error)
	{
		fail("source-not-git", "The reproducibility gate requires committed project source", {
			hint: "Initialize the project repository and commit the package candidate."
			, details: { cause: error.code ?? error.message }
		});
	}
	const projectPath = relative(repositoryRoot, project);
	if(projectPath === ".." || projectPath.startsWith(`..${sep}`))
	{
		fail("invalid-project-root", "The project root is outside its Git repository");
	}
	const status = (await capture(runner, {
		command: "git"
		, args: ["-C", project, "status", "--porcelain=v1", "--untracked-files=all", "--", "."]
		, cwd: project
	})).stdout.trim();
	if(status !== "")
	{
		fail("source-tree-dirty", "The reproducibility gate only authorizes committed project source", {
			hint: "Commit or remove every project change, then run the dry run again."
			, details: { changedPaths: status.split("\n").slice(0, 100) }
		});
	}
	const [revision, tree] = await Promise.all([
		capture(runner, { command: "git", args: ["-C", project, "rev-parse", "HEAD"], cwd: project })
		, capture(runner, { command: "git", args: ["-C", project, "rev-parse", "HEAD^{tree}"], cwd: project })
	]);
	let repository = portable(repositoryRoot);
	try
	{
		repository = (await capture(runner, {
			command: "git"
			, args: ["-C", project, "remote", "get-url", "origin"]
			, cwd: project
		})).stdout.trim() || repository;
	} catch
	{
		// Falling back to the portable local repository path is intentional.
	}
	const roots = [];
	for(const name of ["a", "b"])
	{
		const checkout = join(scratchRoot, `source-${name}`);
		await capture(runner, {
			command: "git"
			, args: ["clone", "--quiet", "--no-local", "--no-hardlinks", "--no-checkout", repositoryRoot, checkout]
			, cwd: scratchRoot
		});
		await capture(runner, {
			command: "git"
			, args: ["-C", checkout, "checkout", "--quiet", "--detach", revision.stdout.trim()]
			, cwd: scratchRoot
		});
		const cloneProject = resolve(checkout, projectPath);
		const cloneStatus = (await capture(runner, {
			command: "git"
			, args: ["-C", cloneProject, "status", "--porcelain=v1", "--untracked-files=all", "--", "."]
			, cwd: cloneProject
		})).stdout.trim();
		if(cloneStatus !== "") fail("unclean-source-clone", `Independent source clone ${name.toUpperCase()} is not clean`);
		roots.push(cloneProject);
	}
	return Object.freeze({
		roots: Object.freeze(roots)
		, source: Object.freeze({
			repository
			, projectPath: projectPath === "" ? "." : portable(projectPath)
			, revision: revision.stdout.trim()
			, tree: tree.stdout.trim()
		})
	});
};

const runtimeRootFor = async ({ engineRoot, environment }) => {
	const candidates = [
		environment.LEAN_BRIDGE_RUNTIME_ROOT
		, join(engineRoot, "runtime", "wasm")
		, join(engineRoot, "build", "lean-link-spike", "lazy")
	].filter(Boolean).map(value => resolve(value));
	for(const root of candidates)
	{
		try
		{
			await Promise.all([stat(join(root, "main.mjs")), stat(join(root, "main.wasm"))]);
			return root;
		} catch(error)
		{
			if(error.code !== "ENOENT") throw error;
		}
	}
	fail("shared-runtime-package-unavailable", "The installed Lean Bridge package does not contain its shared runtime", {
		hint: "Reinstall Lean Bridge, then run the same dry-run command."
	});
};

const combinedInventory = async ({ buildRoot, packageRoot }) => new Map([
	...await collectReleaseInventory(join(buildRoot, "bundle"), { prefix: "bundle" })
	, ...await collectReleaseInventory(packageRoot, { prefix: "packages/npm" })
]);

const inventoryRecords = inventory => [...inventory.entries()].map(([path, item]) => Object.freeze({
	path
	, bytes: item.bytes.length
	, mode: item.mode
	, sha256: sha256(item.bytes)
})).sort((left, right) => left.path.localeCompare(right.path));

const packageTarget = ({ packages, candidateId }) => Object.freeze({
	ecosystem: "npm"
	, component: packages.report.component.id
	, candidateId
	, runtime: Object.freeze({
		coordinate: packages.report.runtime.package
		, path: `release/packages/npm/${packages.report.runtime.archive}`
		, sha256: packages.report.runtime.sha256
	})
	, package: Object.freeze({
		coordinate: packages.report.package.package
		, path: `release/packages/npm/${packages.report.package.archive}`
		, sha256: packages.report.package.sha256
	})
});

const publishManifest = ({ createdAt, source, candidateId, inventorySha256, packages, receipt }) => Object.freeze({
	schemaVersion: 1
	, kind: "lean-bridge-component-publish-plan"
	, mode: "authorized-no-publish"
	, createdAt
	, source
	, candidate: Object.freeze({ id: candidateId, inventorySha256 })
	, receipt: Object.freeze({
		path: "release/packages/npm/component-package-receipt.json"
		, sha256: receipt.receiptSha256
		, componentIdentitySha256: receipt.componentIdentitySha256
	})
	, targets: Object.freeze([packageTarget({ packages, candidateId })])
	, policy: Object.freeze({
		networkPublicationPerformed: false
		, externalRegistryWritesPerformed: false
		, credentialsRead: false
		, byteIdenticalRebuildRequired: true
	})
});

const initialReport = createdAt => ({
	schemaVersion: 1
	, kind: "lean-bridge-component-reproducibility-report"
	, result: "failed"
	, createdAt
	, source: null
	, component: null
	, candidate: null
	, builds: []
	, artifacts: []
	, differences: []
	, policy: {
		cleanCommittedSource: true
		, independentSourceCheckouts: true
		, independentBuildOutputs: true
		, sharedImmutableToolchainStore: true
		, byteIdenticalArtifactsRequired: true
		, externalRegistryWrites: false
	}
	, failure: null
});

/**
 * Runs component reproducibility gate and returns a structured result suitable for the deterministic release and independent-verification pipeline.
 *
 * @param root0 - Named inputs and dependency overrides used to run component reproducibility gate.
 * @param root0.projectRoot - Filesystem root containing the project.
 * @param root0.outputRoot - Filesystem root containing the output.
 * @param root0.engineRoot - Filesystem root containing the engine.
 * @param root0.environment - Environment variables used to resolve tools and policy.
 * @param root0.runner - Process runner used for isolated external commands.
 * @param root0.build - Injected build implementation used to produce an isolated candidate from prepared sources.
 * @param root0.packageComponent - Injected packager that turns a compiled component into the independently verified package.
 * @param root0.verifyReceipt - Injected verifier that validates the independently packaged component receipt.
 * @param root0.sourcePreparer - Injected function that creates a clean, isolated source tree for each rebuild.
 * @param root0.now - Injected clock returning the current timestamp for deterministic lifecycle records.
 * @param root0.targets - Closed target identifiers selected for planning, building, or reproducibility comparison.
 * @param root0.cache - Cache settings propagated to the isolated build while preserving the requested cache policy.
 * @param root0.signal - Abort signal used to cancel the operation.
 * @param root0.onProgress - Observer invoked when progress occurs.
 */
export const runComponentReproducibilityGate = async ({
	projectRoot
	, outputRoot
	, engineRoot = installedEngineRoot
	, environment = process.env
	, runner = processBuildRunner
	, build = buildCanonicalProject
	, packageComponent = buildComponentNpmPackages
	, verifyReceipt = verifyComponentPackageReceipt
	, sourcePreparer = prepareCleanComponentSources
	, now = () => Date.now()
	, targets = []
	, cache = { policy: "use", directory: null }
	, signal = undefined
	, onProgress = undefined
} = {}) => {
	const project = resolve(projectRoot ?? process.cwd());
	const engine = resolve(engineRoot);
	if(cache.directory !== null)
	{
		fail("reproducibility-cache-directory-unsupported", "The reproducibility gate creates its own build outputs", {
			hint: "Remove --cache-directory and run the dry run again."
		});
	}
	const output = await outputAbsent({
		projectRoot: project
		, outputRoot: outputRoot ?? join(project, "build", "lean-bridge-dry-run")
	});
	await mkdir(dirname(output), { recursive: true });
	const scratch = await mkdtemp(join(dirname(output), ".lean-bridge-component-repro-"));
	const staging = join(scratch, "result");
	await mkdir(staging);
	const createdAt = new Date(now()).toISOString();
	const report = initialReport(createdAt);
	try
	{
		onProgress?.({ phase: "source", state: "started", message: "Preparing two clean project checkouts" });
		const prepared = await sourcePreparer({ projectRoot: project, scratchRoot: scratch, runner });
		report.source = prepared.source;
		signal?.throwIfAborted();
		onProgress?.({ phase: "source", state: "completed", message: "Project revision is clean and locked" });
		const runtimeRoot = await runtimeRootFor({ engineRoot: engine, environment });
		const built = [];
		for(const [index, name] of ["A", "B"].entries())
		{
			const buildRoot = join(scratch, `build-${name.toLowerCase()}`);
			const packageRoot = join(scratch, `packages-${name.toLowerCase()}`);
			const started = now();
			onProgress?.({ phase: `build-${name.toLowerCase()}`, state: "started", message: `Building clean component ${name}`, current: index, total: 2 });
			const result = await build({
				projectRoot: prepared.roots[index]
				, engineRoot: engine
				, outputRoot: buildRoot
				, environment
				, targets
				, cache
				, signal
			});
			const packages = await packageComponent({
				bundleRoot: join(buildRoot, "bundle")
				, runtimeRoot
				, outputRoot: packageRoot
			});
			const receipt = await verifyReceipt({ receiptPath: join(packageRoot, "component-package-receipt.json") });
			const inventory = await combinedInventory({ buildRoot, packageRoot });
			built.push({ name, buildRoot, packageRoot, result, packages, receipt, inventory, durationMs: Math.max(0, now() - started) });
			onProgress?.({ phase: `build-${name.toLowerCase()}`, state: "completed", message: `Clean component ${name} built`, current: index + 1, total: 2 });
		}
		const [left, right] = built;
		const comparison = compareReleaseInventories(left.inventory, right.inventory);
		report.component = left.packages.report.component.id;
		report.builds = built.map(item => ({
			name: item.name
			, backend: item.result.backend
			, engineIdentitySha256: item.result.engineIdentitySha256
			, componentIdentitySha256: item.packages.report.componentIdentitySha256
			, receiptSha256: item.receipt.receiptSha256
			, artifacts: item.inventory.size
			, durationMs: item.durationMs
		}));
		report.artifacts = inventoryRecords(left.inventory);
		report.differences = comparison.differences;
		if(comparison.differences.length !== 0)
		{
			fail("release-not-reproducible", `${comparison.differences.length} component package paths differ between clean builds`, {
				hint: `Inspect ${portable(join(output, "evidence", "reproducibility.json"))}.`
			});
		}
		const inventorySha256 = hashReleaseInventory(report.artifacts);
		const candidateId = sha256(canonicalJson({ source: report.source, component: report.component, inventorySha256 }));
		report.candidate = { id: candidateId, inventorySha256 };
		report.result = "passed";
		await Promise.all([
			cp(join(left.buildRoot, "bundle"), join(staging, "release", "bundle"), { recursive: true, dereference: true })
			, cp(left.packageRoot, join(staging, "release", "packages", "npm"), { recursive: true, dereference: true })
		]);
		const copiedReceipt = await verifyReceipt({
			receiptPath: join(staging, "release", "packages", "npm", "component-package-receipt.json")
		});
		const manifest = publishManifest({
			createdAt
			, source: report.source
			, candidateId
			, inventorySha256
			, packages: left.packages
			, receipt: copiedReceipt
		});
		await mkdir(join(staging, "evidence"), { recursive: true });
		const reportSource = canonicalJson(report);
		const manifestSource = canonicalJson(manifest);
		await Promise.all([
			writeFile(join(staging, "evidence", "reproducibility.json"), reportSource)
			, writeFile(join(staging, "publish-manifest.json"), manifestSource)
			, writeFile(join(staging, "publish-manifest.sha256"), `${sha256(manifestSource)}  publish-manifest.json\n`)
		]);
		await rename(staging, output);
		return Object.freeze({
			kind: "lean-bridge-component-reproducibility-gate"
			, output
			, result: "passed"
			, candidate: Object.freeze({ ...report.candidate })
			, report: join(output, "evidence", "reproducibility.json")
			, reportSha256: sha256(reportSource)
			, publishManifest: join(output, "publish-manifest.json")
			, publishManifestSha256: sha256(manifestSource)
			, plannedTargets: manifest.targets
			, receipt: Object.freeze({ ...copiedReceipt, path: join(output, manifest.receipt.path) })
			, packages: Object.freeze({
				runtime: join(output, manifest.targets[0].runtime.path)
				, component: join(output, manifest.targets[0].package.path)
			})
			, externalRegistryWrites: false
		});
	} catch(error)
	{
		report.failure = {
			code: error.code ?? "component-reproducibility-gate-failed"
			, message: error.message ?? String(error)
			, hint: error.hint ?? null
		};
		await mkdir(join(staging, "evidence"), { recursive: true });
		const reportSource = canonicalJson(report);
		await writeFile(join(staging, "evidence", "reproducibility.json"), reportSource);
		await rename(staging, output);
		throw new ReproducibilityGateError(report.failure.code, report.failure.message, {
			hint: report.failure.hint
			, details: {
				output
				, report: join(output, "evidence", "reproducibility.json")
				, reportSha256: sha256(reportSource)
			}
		});
	} finally
	{
		await rm(scratch, { recursive: true, force: true });
	}
};
