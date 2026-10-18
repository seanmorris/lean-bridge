/**
 * Install inherited checked-record CPAN packages and replay one unchanged
 * caller after physical relocation.
 *
 * @file
 */
import assert from "node:assert/strict";
import {
	access, mkdir, readFile, readdir, rename, rm, symlink
} from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { nativeArtifactPaths } from "../../src/build/native-artifacts.mjs";
import { installCpanArchive } from "../../src/release/cpan-install.mjs";
import { traceCpanInstall } from "../../src/release/cpan-install-trace.mjs";
import { readVerifiedCpanPackage } from "../../src/release/cpan-package.mjs";
import { copiedCleanEnvironment, runCopied } from "./copied-fixture-install.mjs";
import {
	checkedRecordPerlConfigurations, checkedRecordPerlExecutables
	, checkedRecordPerlInstalledFiles, checkedRecordPerlModes
	, probeCheckedRecordPerl
} from "./checked-record-perl-install.mjs";
import {
	inheritedCheckedRecordPerlCaller
	, inheritedCheckedRecordPerlCallerArgs
	, inheritedCheckedRecordPerlTarget
	, parseInheritedCheckedRecordPerlResult
} from "./inherited-checked-record-perl-fixture.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

export const inheritedCheckedRecordPerlConfigurations
	= checkedRecordPerlConfigurations;
export const inheritedCheckedRecordPerlInstallModes = checkedRecordPerlModes;
export const inheritedCheckedRecordPerlExecutables = checkedRecordPerlExecutables;

/**
 * Bind both prepared archives to the selected component and shared runtime.
 *
 * @param manifest - Verified prepared CPAN manifest.
 * @param pkg - Matching package-set entry.
 * @param runtime - Runtime manifest loaded before the component.
 */
export const assertInheritedCheckedRecordPerlPackageIdentity = (
	manifest, pkg, runtime
) => {
	assert.ok(["runtime", "component"].includes(pkg.role));
	assert.equal(pkg.target, "cpan");
	assert.equal(pkg.ecosystem, "cpan");
	assert.equal(pkg.profile, "native-library-v1");
	assert.equal(manifest.module, pkg.role === "runtime"
		? "LeanBridge::Runtime" : inheritedCheckedRecordPerlTarget.module);
	assert.equal(manifest.distribution, pkg.name);
	assert.equal(manifest.version, pkg.version);
	assert.match(pkg.runtimeIdentity, /^[a-f0-9]{64}$/u);
	assert.equal(manifest.nativeRuntimeIdentity, pkg.runtimeIdentity);
	assert.equal(runtime.module, "LeanBridge::Runtime");
	assert.equal(runtime.nativeRuntimeIdentity, manifest.nativeRuntimeIdentity);
	assert.match(runtime.runtimeIdentity, /^[a-f0-9]{64}$/u);
	assert.equal(manifest.runtimeIdentity, runtime.runtimeIdentity);
	assert.equal(manifest.runtimeVersion, runtime.version);
	assert.equal(runtime.files["lib/LeanBridge/Runtime/runtime.json"]
		, runtime.nativeRuntimeIdentity);
	assert.equal(runtime.files["lib/LeanBridge/Runtime/binding.json"]
		, runtime.runtimeIdentity);
	assert.deepEqual(pkg.requires, pkg.role === "runtime" ? [] : [{
		ecosystem: "cpan", name: runtime.distribution, version: runtime.version
	}]);
};

/**
 * Inspect, install offline, execute, relocate, and execute one immutable
 * caller again.
 *
 * @param root0 - One closed installed-package selection.
 * @param root0.configuration - Pinned Perl ABI configuration.
 * @param root0.command - Absolute pinned Perl executable.
 * @param root0.installMode - Prebuilt-only or local XS build.
 * @param root0.route - Ordinary or independently reviewed author route.
 * @param root0.apiMode - Full or result-only public API.
 * @param root0.consumer - Task-owned parent for fresh consumer roots.
 * @param root0.handoff - Verified package-set handoff directory.
 * @param root0.packages - Runtime and component package-set entries.
 * @param root0.output - Destination for original inspection and run records.
 */
export const installInheritedCheckedRecordPerl = async ({
	configuration, command, installMode, route, apiMode
	, consumer, handoff, packages, output
}) => {
	assert.ok(inheritedCheckedRecordPerlConfigurations.includes(configuration));
	assert.ok(inheritedCheckedRecordPerlInstallModes.includes(installMode));
	assert.deepEqual(packages.map(item => item.role).sort()
		, ["component", "runtime"]);
	assert.ok(packages.every(item =>
		item.target === "cpan" && item.artifacts.length === 1));
	const root = join(consumer, `${configuration}-${installMode}`);
	const relocated = `${root}-relocated`;
	const prefix = join(root, "installed");
	await assert.rejects(access(root), { code: "ENOENT" });
	await assert.rejects(access(relocated), { code: "ENOENT" });
	await mkdir(root, { recursive: true });
	const interpreter = await probeCheckedRecordPerl(
		configuration, command, root
	);
	const source = await inheritedCheckedRecordPerlCaller();
	await saveLakeFile(root, "consumer.pl", source);
	const tools = join(root, "tools");
	await mkdir(tools);
	const allowed = [
		"make", "tar", "gzip", "sh", "cp", "mv", "rm", "chmod", "mkdir"
		, "touch", "true"
	];
	if(installMode === "build-xs")
		allowed.push("cc", "gcc", "x86_64-linux-gnu-gcc", "as", "ld");
	for(const name of allowed)
		await symlink(`/usr/bin/${name}`, join(tools, name));
	const environment = {
		...copiedCleanEnvironment, PATH: tools
		, ...installMode === "build-xs" ? { CC: "/usr/bin/cc" } : {}
	};
	const traces = [];
	let runtime;
	for(const role of ["runtime", "component"])
	{
		const pkg = packages.find(item => item.role === role);
		const artifact = pkg.artifacts[0];
		const archive = join(handoff, artifact.path);
		assert.equal(sha256(await readFile(archive)), artifact.sha256);
		const inspection = join(root, `inspect-${role}`);
		await mkdir(inspection);
		await runCopied("/usr/bin/tar", [
			"--use-compress-program=/usr/bin/gzip", "-xf", archive
			, "-C", inspection
		], root);
		const children = await readdir(inspection);
		assert.equal(children.length, 1);
		const packageRoot = join(inspection, children[0]);
		const { manifest } = await readVerifiedCpanPackage(packageRoot);
		if(role === "runtime") runtime = manifest;
		assertInheritedCheckedRecordPerlPackageIdentity(
			manifest, pkg, runtime
		);
		await saveLakeFile(output, `${role}-manifest.json`
			, canonicalJson(manifest));
		await saveLakeFile(output, `${role}-source.xs`
			, await readFile(join(packageRoot, manifest.xs)));
		await installCpanArchive({
			archive, workingRoot: root, prefix, perl: command
			, mode: installMode, environment
		});
		const relative = manifest.module.replaceAll("::", "/");
		const receipts = (await nativeArtifactPaths(prefix)).filter(path =>
			path.endsWith(`/${relative}/install-receipt.json`));
		assert.equal(receipts.length, 1
			, `${role} installed receipt must be unique`);
		const installRoot = join(prefix
			, receipts[0].slice(0
				, -`${relative}/install-receipt.json`.length));
		const receiptBytes = await readFile(join(prefix, receipts[0]));
		const receipt = JSON.parse(receiptBytes);
		const trace = await traceCpanInstall({ packageRoot, installRoot });
		assert.equal(trace.operation, installMode === "prebuilt-only"
			? "prebuilt-xs" : "generated-xs-only");
		const abi = await runCopied(command, [
			"-I.", "-MLeanBridgeBuild", "-e"
			, "print JSON::PP->new->canonical->encode(LeanBridgeBuild::abi())"
		], packageRoot);
		assert.equal(abi.stderr, "");
		assert.deepEqual(receipt.abi, JSON.parse(abi.stdout));
		assert.ok(manifest.prebuilt.some(item =>
			canonicalJson(item.abi) === canonicalJson(receipt.abi)));
		await saveLakeFile(output, `${role}-install-receipt.json`, receiptBytes);
		await saveLakeFile(output, `${role}-trace.json`, canonicalJson(trace));
		traces.push({
			role, manifestSha256: sha256(canonicalJson(manifest))
			, receiptSha256: sha256(receiptBytes)
			, traceSha256: sha256(canonicalJson(trace))
		});
		assert.equal(sha256(await readFile(archive)), artifact.sha256);
		await rm(inspection, { recursive: true });
		await assert.rejects(access(inspection), { code: "ENOENT" });
	}
	const installed = await checkedRecordPerlInstalledFiles(prefix);
	await saveLakeFile(output, "installed-files.json", canonicalJson(installed));
	const args = ["consumer.pl"
		, ...inheritedCheckedRecordPerlCallerArgs(route, apiMode)];
	const firstRun = await runCopied(command, args, root, {
		...copiedCleanEnvironment, PERL5LIB: join(prefix, "lib/perl5")
	});
	assert.equal(firstRun.stderr, "");
	const first = parseInheritedCheckedRecordPerlResult(
		firstRun.stdout, apiMode
	);
	assert.deepEqual(await checkedRecordPerlInstalledFiles(prefix), installed);
	await saveLakeFile(output, "installed-process.json"
		, canonicalJson(firstRun));
	await saveLakeFile(output, "installed.json", canonicalJson(first));
	const consumerSha256 = sha256(source);
	assert.equal(sha256(await readFile(join(root, "consumer.pl")))
		, consumerSha256);
	await rename(root, relocated);
	await assert.rejects(access(root), { code: "ENOENT" });
	assert.equal(sha256(await readFile(join(relocated, "consumer.pl")))
		, consumerSha256);
	const relocatedPrefix = join(relocated, "installed");
	const repeatedRun = await runCopied(command, args, relocated, {
		...copiedCleanEnvironment
		, PERL5LIB: join(relocatedPrefix, "lib/perl5")
	});
	assert.equal(repeatedRun.stderr, "");
	const repeated = parseInheritedCheckedRecordPerlResult(
		repeatedRun.stdout, apiMode
	);
	assert.deepEqual(repeated, first);
	assert.deepEqual(await checkedRecordPerlInstalledFiles(relocatedPrefix)
		, installed);
	assert.deepEqual(await probeCheckedRecordPerl(
		configuration, command, relocated
	), interpreter);
	assert.equal(sha256(await readFile(join(relocated, "consumer.pl")))
		, consumerSha256);
	await assert.rejects(access(root), { code: "ENOENT" });
	await saveLakeFile(output, "relocated-process.json"
		, canonicalJson(repeatedRun));
	await saveLakeFile(output, "relocated.json", canonicalJson(repeated));
	return {
		configuration
		, installMode
		, route
		, apiMode
		, ...interpreter
		, arguments: args
		, consumerSha256
		, resultSha256: sha256(canonicalJson(first))
		, installedFilesSha256: sha256(canonicalJson(installed)), traces
		, counts: first
		, offlineInstall: true, compilerFreeExecution: true
		, leanCompilerUnavailable: true, extractedDistributionsRemoved: true
		, nativePayloadUnchanged: true, installedBytesUnchanged: true
		, relocatedInstallation: true, compilerFreeReplay: true, repeatedRuns: 2
		, callerInputsUnchanged: true, proofFieldsAbsent: true
		, installationCCompilerAvailable: installMode === "build-xs"
		, sourceUnchangedAfterReplay: true
	};
};
