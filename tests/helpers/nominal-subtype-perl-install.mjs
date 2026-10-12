/**
 * Install nominal Subtype CPAN packages offline and replay after a physical move.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, mkdir, readFile, readdir, rename, rm, symlink } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { nativeArtifactPaths } from "../../src/build/native-artifacts.mjs";
import { installCpanArchive } from "../../src/release/cpan-install.mjs";
import { readVerifiedCpanPackage } from "../../src/release/cpan-package.mjs";
import { traceCpanInstall } from "../../src/release/cpan-install-trace.mjs";
import { copiedCleanEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { checkedRecordPerlConfigurations, checkedRecordPerlModes, checkedRecordPerlInstalledFiles, probeCheckedRecordPerl } from "./checked-record-perl-install.mjs";
import { nominalSubtypePerlModule, nominalSubtypePerlRoutes, nominalSubtypePerlModes, nominalSubtypePerlCounts, nominalSubtypePerlCaller, parseNominalSubtypePerlResult } from "./nominal-subtype-perl-fixture.mjs";

/**
 * Bind each CPAN distribution to its package-set entry and shared runtime.
 *
 * @param manifest - Verified prepared manifest.
 * @param pkg - Native package-set entry.
 * @param runtime - Shared prepared runtime manifest.
 */
export const assertNominalSubtypePerlPackageIdentity = (manifest, pkg, runtime) => {
	assert.ok(["runtime", "component"].includes(pkg.role));
	assert.equal(pkg.target, "cpan"); assert.equal(pkg.ecosystem, "cpan");
	assert.equal(pkg.profile, "native-library-v1");
	assert.equal(manifest.module, pkg.role === "runtime" ? "LeanBridge::Runtime" : nominalSubtypePerlModule);
	assert.equal(manifest.distribution, pkg.name); assert.equal(manifest.version, pkg.version);
	assert.match(pkg.runtimeIdentity, /^[a-f0-9]{64}$/u);
	assert.equal(manifest.nativeRuntimeIdentity, pkg.runtimeIdentity);
	assert.equal(runtime.module, "LeanBridge::Runtime");
	assert.equal(runtime.nativeRuntimeIdentity, manifest.nativeRuntimeIdentity);
	assert.match(runtime.runtimeIdentity, /^[a-f0-9]{64}$/u);
	assert.equal(manifest.runtimeIdentity, runtime.runtimeIdentity);
	assert.equal(manifest.runtimeVersion, runtime.version);
	assert.equal(runtime.files["lib/LeanBridge/Runtime/runtime.json"], runtime.nativeRuntimeIdentity);
	assert.equal(runtime.files["lib/LeanBridge/Runtime/binding.json"], runtime.runtimeIdentity);
	assert.deepEqual(pkg.requires, pkg.role === "runtime" ? []
		: [{ ecosystem: "cpan", name: runtime.distribution, version: runtime.version }]);
};

/**
 * Inspect, install and relocate one independently selected ABI and delivery mode.
 *
 * @param options - Task-owned roots and verified package-set handoff.
 * @param options.configuration - Pinned version and threading selection.
 * @param options.command - Absolute interpreter executable.
 * @param options.delivery - Prebuilt-only or build-xs installation.
 * @param options.route - Ordinary or independently reviewed author route.
 * @param options.mode - Full or standalone result-only API.
 * @param options.consumer - Parent of fresh consumer directories.
 * @param options.handoff - Verified package-set handoff directory.
 * @param options.packages - Runtime and component package-set entries.
 * @param options.output - Destination for original execution and inspection records.
 */
export const installNominalSubtypePerl = async ({ configuration, command, delivery, route, mode, consumer, handoff, packages, output }) => {
	assert.ok(checkedRecordPerlModes.includes(delivery));
	assert.ok(checkedRecordPerlConfigurations.includes(configuration));
	assert.ok(nominalSubtypePerlRoutes.includes(route)); assert.ok(nominalSubtypePerlModes.includes(mode));
	assert.deepEqual(packages.map(item => item.role).sort(), ["component", "runtime"]);
	assert.ok(packages.every(item => item.target === "cpan" && item.artifacts.length === 1));
	const root = join(consumer, `${configuration}-${delivery}`), prefix = join(root, "installed");
	await assert.rejects(access(root), { code: "ENOENT" }); await mkdir(root, { recursive: true });
	const interpreter = await probeCheckedRecordPerl(configuration, command, root);
	const source = await nominalSubtypePerlCaller(route);
	await saveLakeFile(root, "consumer.pl", source);
	const tools = join(root, "tools"); await mkdir(tools);
	const allowed = ["make", "tar", "gzip", "sh", "cp", "mv", "rm", "chmod", "mkdir", "touch", "true"];
	if(delivery === "build-xs") allowed.push("cc", "gcc", "x86_64-linux-gnu-gcc", "as", "ld");
	for(const name of allowed) await symlink(`/usr/bin/${name}`, join(tools, name));
	const environment = { ...copiedCleanEnvironment, PATH: tools
		, ...delivery === "build-xs" ? { CC: "/usr/bin/cc" } : {} };
	const traces = []; let runtime;
	for(const role of ["runtime", "component"])
	{
		const pkg = packages.find(item => item.role === role), artifact = pkg.artifacts[0];
		const archive = join(handoff, artifact.path);
		assert.equal(sha256(await readFile(archive)), artifact.sha256);
		const inspection = join(root, `inspect-${role}`); await mkdir(inspection);
		await runCopied("/usr/bin/tar", ["--use-compress-program=/usr/bin/gzip", "-xf", archive, "-C", inspection], root);
		const children = await readdir(inspection); assert.equal(children.length, 1);
		const packageRoot = join(inspection, children[0]);
		const { manifest } = await readVerifiedCpanPackage(packageRoot);
		if(role === "runtime") runtime = manifest;
		assertNominalSubtypePerlPackageIdentity(manifest, pkg, runtime);
		const relative = manifest.module.replaceAll("::", "/");
		await saveLakeFile(output, `${role}-manifest.json`, canonicalJson(manifest));
		await saveLakeFile(output, `${role}-source.xs`, await readFile(join(packageRoot, manifest.xs)));
		await saveLakeFile(output, `${role}-public.pm`, await readFile(join(packageRoot, "lib", relative + ".pm")));
		await installCpanArchive({ archive, workingRoot: root, prefix, perl: command, mode: delivery, environment });
		const receipts = (await nativeArtifactPaths(prefix)).filter(path => path.endsWith(`/${relative}/install-receipt.json`));
		assert.equal(receipts.length, 1, `${role} installed receipt must be unique`);
		const installRoot = join(prefix, receipts[0].slice(0, -`${relative}/install-receipt.json`.length));
		const receiptBytes = await readFile(join(prefix, receipts[0])), receipt = JSON.parse(receiptBytes);
		const trace = await traceCpanInstall({ packageRoot, installRoot });
		assert.equal(trace.operation, delivery === "prebuilt-only" ? "prebuilt-xs" : "generated-xs-only");
		const abi = await runCopied(command, ["-I.", "-MLeanBridgeBuild", "-e", "print JSON::PP->new->canonical->encode(LeanBridgeBuild::abi())"], packageRoot);
		assert.equal(abi.stderr, ""); assert.deepEqual(receipt.abi, JSON.parse(abi.stdout));
		assert.ok(manifest.prebuilt.some(item => canonicalJson(item.abi) === canonicalJson(receipt.abi)));
		await saveLakeFile(output, `${role}-install-receipt.json`, receiptBytes);
		await saveLakeFile(output, `${role}-trace.json`, canonicalJson(trace));
		traces.push({ role, manifestSha256: sha256(canonicalJson(manifest)), receiptSha256: sha256(receiptBytes), traceSha256: sha256(canonicalJson(trace)) });
		assert.equal(sha256(await readFile(archive)), artifact.sha256);
		await rm(inspection, { recursive: true }); await assert.rejects(access(inspection), { code: "ENOENT" });
	}
	const installed = await checkedRecordPerlInstalledFiles(prefix);
	await saveLakeFile(output, "installed-files.json", canonicalJson(installed));
	const arguments_ = ["consumer.pl", ...mode === "result-only" ? ["--result-only"] : []];
	const first = await runCopied(command, arguments_, root, { ...copiedCleanEnvironment, PERL5LIB: join(prefix, "lib/perl5") });
	assert.equal(first.stderr, ""); parseNominalSubtypePerlResult(first.stdout, mode);
	assert.deepEqual(await checkedRecordPerlInstalledFiles(prefix), installed);
	assert.equal(await readFile(join(root, "consumer.pl"), "utf8"), source);
	await saveLakeFile(output, "first.json", canonicalJson(first));
	const moved = root + "-relocated";
	await assert.rejects(access(moved), { code: "ENOENT" });
	await rename(root, moved); await assert.rejects(access(root), { code: "ENOENT" });
	assert.deepEqual(await checkedRecordPerlInstalledFiles(join(moved, "installed")), installed);
	assert.deepEqual(await probeCheckedRecordPerl(configuration, command, moved), interpreter);
	const repeated = await runCopied(command, arguments_, moved, { ...copiedCleanEnvironment, PERL5LIB: join(moved, "installed/lib/perl5") });
	assert.equal(repeated.stderr, ""); assert.equal(repeated.stdout, first.stdout); parseNominalSubtypePerlResult(repeated.stdout, mode);
	await saveLakeFile(output, "repeated.json", canonicalJson(repeated));
	assert.deepEqual(await checkedRecordPerlInstalledFiles(join(moved, "installed")), installed);
	assert.equal(await readFile(join(moved, "consumer.pl"), "utf8"), source);
	await assert.rejects(access(root), { code: "ENOENT" });
	return { configuration, delivery, ...interpreter, route, mode
		, ...nominalSubtypePerlCounts[mode]
		, consumerSha256: sha256(source), arguments: arguments_
		, installedFilesSha256: sha256(canonicalJson(installed)), traces
		, offlineInstall: true, compilerFreeExecution: true
		, leanCompilerUnavailable: true, extractedDistributionsRemoved: true
		, nativePayloadUnchanged: true, installedBytesUnchanged: true
		, relocatedInstallation: true, compilerFreeReplay: true, repeatedRuns: 2
		, installationCCompilerAvailable: delivery === "build-xs"
		, sourceUnchangedAfterReplay: true
		, dispatch: { observed: false, reason: "Separate constructor/source entry probe remains required" } };
};
