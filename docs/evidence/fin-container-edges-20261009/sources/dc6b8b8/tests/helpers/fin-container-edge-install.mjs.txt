/**
 * Installed acceptance for the additive native Fin container cases. This development slice is C/C++/Python;
 * other native consumers and the separate measured-dispatch supplement remain required under VO #1454.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, cp, lstat, mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative, resolve } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { buildCanonicalProject } from "../../src/build/canonical-build.mjs";
import { verifyNativeFiles } from "../../src/build/native-artifacts.mjs";
import { verifyPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { copiedCleanEnvironment, installCopiedConsumer, runCopied } from "./copied-fixture-install.mjs";
import { finContainerEnvironment, finContainerTargets } from "./fin-container-install.mjs";
import { finContainerEdgeConsumer, finContainerEdgeRefinements, finContainerEdgeSource, implementedFinContainerEdgeProfiles } from "./fin-container-edges.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { copyPackageSetHandoff } from "./package-set.mjs";

/** Original accepted counts plus the new fragment, including its exact-count assertion. */
export const finContainerEdgeChecks = Object.freeze({ c: 2041 + 12073, cpp: 2039 + 12060, python: 2029 + 12066 });

/**
 * Reject missing/unknown/duplicate explicit profiles. Undefined disables the installed gate.
 *
 * @param value - Explicit comma-separated native hosts.
 */
export const finContainerEdgeSelection = value => {
	if(value === undefined) return [];
	assert.equal(typeof value, "string");
	const profiles = value.split(",").sort();
	assert.ok(profiles.every(profile => implementedFinContainerEdgeProfiles.includes(profile)), "Unknown, empty or unimplemented Fin edge profile");
	assert.equal(new Set(profiles).size, profiles.length, "Duplicate Fin edge profile");
	return profiles;
};

/**
 * Refuse every existing entry, including a broken symlink, before building.
 *
 * @param path - Destination that must not already exist.
 */
export const requireNewFinContainerEdgeReport = async path => {
	assert.match(basename(path), /^edges-[a-z0-9-]+\.json$/u, "Use an edges-*.json report name");
	try
	{ await lstat(path); }
	catch(error)
	{ if(error.code === "ENOENT") return; throw error; }
	throw new Error(`Fin container edge report already exists: ${path}`);
};

/**
 * Append a new report exclusively; never replace an earlier attempt.
 *
 * @param path - New report path.
 * @param report - Completed acceptance observation.
 */
export const writeFinContainerEdgeReport = async (path, report) => {
	await requireNewFinContainerEdgeReport(path);
	await mkdir(dirname(path), { recursive: true });
	await writeFile(path, canonicalJson(report), { flag: "wx" });
};

/**
 * Compile the installed public C/C++ consumer with an origin-relative runtime search path.
 * Check the actual ELF metadata, not just the compiler arguments, before moving the tree.
 *
 * @param options - Installed package and consumer paths.
 * @param options.profile - C or C++.
 * @param options.root - Consumer directory containing the restricted assembler/linker tools.
 * @param options.directory - Single package directory beneath root.
 * @param options.pkgConfig - Receipt-pinned pkg-config name.
 */
export const prepareFinContainerEdgeExecutable = async ({ profile, root, directory, pkgConfig }) => {
	assert.ok(["c", "cpp"].includes(profile));
	assert.match(directory, /^[A-Za-z0-9][A-Za-z0-9._-]*$/u);
	const installed = join(root, directory), command = join(root, "consumer");
	const compile = { ...copiedCleanEnvironment, PATH: join(root, "tools"), PKG_CONFIG_LIBDIR: join(installed, "lib/pkgconfig"), PKG_CONFIG_PATH: "" };
	const flags = (await runCopied("/usr/bin/pkg-config", ["--cflags", "--libs", pkgConfig], root, compile)).stdout.trim().split(/\s+/u);
	assert.equal(flags.filter(flag => flag.startsWith("-Wl,-rpath,")).length, 1, "expected the installed package runtime search path");
	const runtimeSearchPath = `$ORIGIN/${directory}/lib`;
	const relativeFlags = flags.map(flag => flag.startsWith("-Wl,-rpath,") ? `-Wl,-rpath,${runtimeSearchPath}` : flag);
	await runCopied(profile === "cpp" ? "/usr/bin/c++" : "/usr/bin/cc"
		, [`-std=${profile === "cpp" ? "c++20" : "c11"}`, "-Wall", "-Wextra", "-Werror", "-UNDEBUG", `consumer.${profile === "cpp" ? "cpp" : "c"}`, ...relativeFlags, "-o", command]
		, root, compile);
	const dynamic = await runCopied("/usr/bin/readelf", ["--dynamic", command], root);
	const actualPaths = [...dynamic.stdout.matchAll(/\((?:RUNPATH|RPATH)\)[^\n]*\[([^\]]*)\]/gu)].map(match => match[1]);
	assert.deepEqual(actualPaths, [runtimeSearchPath], "ELF runtime path must be relative to the executable, with no old-root fallback");
	return { executableSha256: sha256(await readFile(command)), runtimeSearchPath };
};

/**
 * Verify the installed files against the receipt bytes from the original archive, move the complete
 * consumer tree, rerun the identical public consumer and verify the same file identities afterward.
 *
 * @param options - Verified archive handoff and installed consumer execution.
 * @param options.profile - C, C++ or Python.
 * @param options.consumer - Parent of the installed host directory.
 * @param options.handoff - Archive handoff directory.
 * @param options.packages - Selected verified package-set entries.
 * @param options.command - Absolute installed consumer command.
 */
export const repeatFinContainerEdges = async ({ profile, consumer, handoff, packages, command }) => {
	const root = join(consumer, profile), pkg = packages.find(item => item.role === "component");
	assert.ok(pkg);
	const archive = join(handoff, pkg.artifacts[0].path);
	let installed, receiptPath, archiveBytes, args, python;
	if(profile === "python")
	{
		const identity = await runCopied(command, ["-I", "-c", "import json, pathlib, sys, lean_fincontainers; print(json.dumps({'site':str(pathlib.Path(lean_fincontainers.__file__).parent.parent),'version':sys.version.split()[0]}))"], root);
		const parsed = JSON.parse(identity.stdout);
		installed = parsed.site;
		assert.ok(installed.startsWith(`${root}/venv/`));
		python = parsed.version;
		receiptPath = "lean_fincontainers/lean_bridge/package-receipt.json";
		archiveBytes = (await runCopied("/usr/bin/unzip", ["-p", archive, receiptPath], root)).stdout;
		args = ["-I", "consumer.py"];
	}
	else
	{
		assert.ok(["c", "cpp"].includes(profile));
		const directory = `${pkg.name}-${pkg.version}-${profile}`;
		installed = join(root, directory);
		receiptPath = "lean-bridge-package.json";
		archiveBytes = (await runCopied("/usr/bin/tar", ["--use-compress-program=/usr/bin/gzip", "-xOf", archive, `${directory}/${receiptPath}`], root)).stdout;
		args = [];
	}
	assert.equal(await readFile(join(installed, receiptPath), "utf8"), archiveBytes, "installed receipt equals original archive member");
	const receipt = JSON.parse(archiveBytes);
	await verifyNativeFiles(installed, receipt.files);
	const executable = profile === "python" ? null : await prepareFinContainerEdgeExecutable({ profile, root, directory: basename(installed), pkgConfig: receipt.pkgConfig });
	if(executable)
	{
		assert.equal(command, join(root, "consumer"));
		const before = await runCopied(command, args, root, copiedCleanEnvironment);
		assert.equal(before.stderr, "");
		assert.equal(before.stdout, `fin-container-ok:${finContainerEdgeChecks[profile]}\n`);
		assert.equal(sha256(await readFile(command)), executable.executableSha256);
	}
	const moved = `${root}-relocated`;
	assert.ok(command.startsWith(`${root}/`));
	await rename(root, moved);
	await assert.rejects(access(root), { code: "ENOENT" });
	const repeated = await runCopied(join(moved, relative(root, command)), args, moved, copiedCleanEnvironment);
	assert.equal(repeated.stderr, "");
	assert.equal(repeated.stdout, `fin-container-ok:${finContainerEdgeChecks[profile]}\n`);
	const movedInstall = join(moved, relative(root, installed));
	assert.equal(await readFile(join(movedInstall, receiptPath), "utf8"), archiveBytes);
	await verifyNativeFiles(movedInstall, receipt.files);
	if(executable) assert.equal(sha256(await readFile(join(moved, "consumer"))), executable.executableSha256);
	return { relocatedInstallation: true
		, repeatExecution: true
		, installedFilesUnchanged: true
		, installedFilesSha256: sha256(canonicalJson(receipt.files))
		, installedReceiptSha256: sha256(archiveBytes)
		, ...executable
		, ...(python ? { python } : {}) };
};

/**
 * Build from two independent roots and execute ordinary-source prepared packages after author deletion.
 *
 * @param t - Test context owning temporary cleanup.
 * @param profiles - Explicit supported development slice.
 * @param reportPath - Fresh separated report path, validated before any compilation.
 */
export const checkInstalledFinContainerEdges = async (t, profiles, reportPath) => {
	assert.deepEqual(finContainerEdgeSelection(profiles.join(",")), profiles);
	await requireNewFinContainerEdgeReport(reportPath);
	const environment = finContainerEnvironment(profiles), reports = [], archives = [], authors = [];
	const targets = Object.fromEntries(profiles.map(profile => finContainerTargets[profile]));
	const source = await finContainerEdgeSource();
	for(const attempt of [0, 1])
	{
		const author = await mkdtemp(join(tmpdir(), "lean-bridge-fin-edges-author-"));
		const consumer = await mkdtemp(join(tmpdir(), "lean-bridge-fin-edges-consumer-"));
		t.after(() => Promise.all([author, consumer].map(root => rm(root, { recursive: true, force: true }))));
		assert.ok(!authors.includes(author) && relative(author, consumer).startsWith("..")); authors.push(author);
		const projectRoot = join(author, "project"), outputRoot = join(author, "release"), handoff = join(consumer, "handoff");
		await cp("tests/fixtures/onboarding/native-fin-containers", projectRoot, { recursive: true });
		await saveLakeFile(projectRoot, "FinContainers.lean", source);
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1, modules: ["FinContainers"], targets }));
		t.diagnostic(`edge build ${attempt + 1}/2: ${profiles.join(", ")}`);
		const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: Object.keys(targets), environment }).catch(error => {
			error.message += `: ${JSON.stringify(error.details)}`; throw error;
		});
		const modelBytes = await readFile(join(outputRoot, "native/component/model.json"));
		const model = JSON.parse(modelBytes);
		assert.deepEqual(Object.fromEntries(model.exports.map(item => [item.name, item.refinements ?? null])), finContainerEdgeRefinements);
		const receipt = await copyPackageSetHandoff(outputRoot, handoff);
		await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		archives.push(Object.fromEntries(receipt.packages.flatMap(pkg => pkg.artifacts.map(artifact => [artifact.path, artifact.sha256]))));
		const receiptSha256 = sha256(await readFile(join(handoff, "package-set-receipt.json")));
		await rm(author, { recursive: true, force: true });
		await assert.rejects(access(author), { code: "ENOENT" });
		if(attempt === 1) continue;
		for(const profile of profiles)
		{
			const packages = receipt.packages.filter(pkg => pkg.target === finContainerTargets[profile][0]);
			const consumerSource = await finContainerEdgeConsumer(profile);
			const { command, ...observation } = await installCopiedConsumer({ profile
				, consumer, handoff, packages, environment
				, fixture: { source: () => consumerSource, success: "fin-container-ok", expectedChecks: finContainerEdgeChecks[profile] } });
			const repeated = await repeatFinContainerEdges({ profile, consumer, handoff, packages, command });
			reports.push({ profile
				, path: "ordinary-source"
				, ...observation
				, ...repeated
				, packages
				, sourceRemovedBeforeInstallation: true
				, fixtureSha256: sha256(source)
				, sourceTreeSha256: model.sourceIdentity.sourceTreeSha256
				, modelSha256: sha256(modelBytes)
				, bindingIrSha256: built.bindingIrSha256
				, receiptSha256
				, refinements: finContainerEdgeRefinements
				, dispatch: { observed: false, reason: "This supplement measures public behavior. Expanded source/adapter counters remain a separate required gate." } });
		}
	}
	assert.equal(new Set(authors).size, 2); assert.deepEqual(archives[1], archives[0]);
	const report = { schemaVersion: 1, profiles, reports, archives: archives[0], reproducible: true, authorRoots: 2 };
	await writeFinContainerEdgeReport(resolve(reportPath), report);
	return report;
};
