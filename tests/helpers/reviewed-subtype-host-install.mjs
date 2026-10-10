/**
 * Closed installed environments and real relocation for reviewed Subtype host callers.
 * The existing native acceptance policies authenticate original package bytes before loading.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, readFile, rename } from "node:fs/promises";
import { join } from "node:path";
import { sha256 } from "../../src/capsule/node.mjs";
import { installCopiedConsumer, runCopied, copiedCleanEnvironment } from "./copied-fixture-install.mjs";
import { installFinContainerEdgePython, runFinContainerEdgePython } from "./fin-container-edge-python-closure.mjs";
import { installFinContainerEdgeRuby, runFinContainerEdgeRuby } from "./fin-container-edge-ruby-closure.mjs";
import { installFinContainerEdgeDotnet, runFinContainerEdgeDotnet } from "./fin-container-edge-dotnet-closure.mjs";
import { installFinContainerEdgeJvm, runFinContainerEdgeJvm } from "./fin-container-edge-jvm-closure.mjs";
import { installFinContainerEdgePhp, runFinContainerEdgePhp } from "./fin-container-edge-php-closure.mjs";
import { verifyFinContainerEdgeArchiveClosure } from "./fin-container-edge-closure.mjs";
import { relocatePerlConsumer } from "./perl-relocated-consumer.mjs";
import { reviewedSubtypeHostConsumer, reviewedSubtypeHostExtensions, reviewedSubtypeHostProfiles } from "./reviewed-subtype-host-fixture.mjs";

export const reviewedSubtypeHostChecks = Object.freeze({
	python: 2025, rust: 2026, dotnet: 2024, java: 2024, kotlin: 2023
	, ruby: 2024, "php-native": 2024, "wit-wasi": 2031, perl: 2025 });

/**
 * Install normally, verify complete package/environment inputs and repeat after moving the tree.
 *
 * @param options - Verified source-free archive handoff and explicit toolchain selection.
 */
export const installReviewedSubtypeHost = async options => {
	const { profile, consumer, packages } = options;
	assert.ok(reviewedSubtypeHostProfiles.includes(profile), "Unknown reviewed Subtype host");
	const observation = await installCopiedConsumer({ ...options, fixture: {
		source: reviewedSubtypeHostConsumer, success: "subtype-ok"
		, expectedChecks: reviewedSubtypeHostChecks[profile]
		, wit: [/byte-value: func\([^)]*: u8\) -> u8;/u, /zero-even: func\(\) -> bridge-value-\d+;/u]
		, installPython: input => installFinContainerEdgePython({ ...input, receiptPath: "lean_subtypes/lean_bridge/package-receipt.json" })
		, installRuby: installFinContainerEdgeRuby
		, installDotnet: installFinContainerEdgeDotnet
		, installJvm: installFinContainerEdgeJvm
		, installPhp: installFinContainerEdgePhp
		, verifyInstalledPackage: verifyFinContainerEdgeArchiveClosure
	} });
	const root = join(consumer, profile), relocated = root + "-relocated";
	const sourcePath = `consumer.${reviewedSubtypeHostExtensions[profile]}`;
	assert.equal(sha256(await readFile(join(root, sourcePath))), observation.consumerSha256);
	const { command, ...portable } = observation;
	if(profile === "perl")
	{
		const moved = await relocatePerlConsumer({ root, command, success: "subtype-ok", checks: observation.checks });
		assert.equal(moved.consumerSha256, observation.consumerSha256);
		const interpreter = await runCopied(command, ["-MConfig", "-MJSON::PP", "-e", 'print JSON::PP->new->canonical->encode({map { $_ => $Config{$_} } qw(version archname useithreads usemultiplicity ivsize ptrsize)})'], relocated);
		assert.equal(interpreter.stderr, "");
		return { ...portable, relocatedInstallation: true, repeatExecution: true
			, perl: JSON.parse(interpreter.stdout)
			, interpreterSha256: sha256(await readFile(command)) };
	}
	await assert.rejects(access(relocated), { code: "ENOENT" });
	await rename(root, relocated);
	await assert.rejects(access(root), { code: "ENOENT" });
	const runs = [];
	if(profile === "python")
		runs.push(await runFinContainerEdgePython({ ...observation.pythonEnvironment, venv: join(relocated, "venv") }, [sourcePath], relocated));
	else if(profile === "ruby")
		runs.push(await runFinContainerEdgeRuby({ ...observation.rubyEnvironment, gems: join(relocated, "gems") }, [sourcePath], relocated));
	else if(profile === "dotnet")
		runs.push(await runFinContainerEdgeDotnet({ ...observation.dotnetEnvironment, root: relocated }));
	else if(profile === "java" || profile === "kotlin")
		runs.push(await runFinContainerEdgeJvm({ ...observation.jvmEnvironment, root: relocated }));
	else if(profile === "php-native")
		for(const mode of ["weak", "strict"]) runs.push(await runFinContainerEdgePhp({ ...observation.phpEnvironment, root: relocated }, mode));
	else
	{
		assert.ok(["rust", "wit-wasi"].includes(profile));
		const pkg = packages.find(item => item.role === "component");
		const installed = join(relocated, `${pkg.name}-${pkg.version}${profile === "wit-wasi" ? "-wit-wasi" : ""}`);
		const verify = () => verifyFinContainerEdgeArchiveClosure({ profile, installed
			, receiptPath: profile === "rust" ? "lean-bridge/package-receipt.json" : "lean-bridge-package.json"
			, archive: join(options.handoff, pkg.artifacts[0].path)
			, archiveSha256: pkg.artifacts[0].sha256 });
		await verify();
		runs.push(await runCopied(join(relocated, profile === "rust" ? "target/debug/consumer" : "consumer"), [], relocated
			, { ...copiedCleanEnvironment, ...profile === "wit-wasi" ? { LD_LIBRARY_PATH: join(installed, "lib") } : {} }));
		await verify();
	}
	for(const run of runs)
	{
		assert.equal(run.stderr, "");
		assert.equal(run.stdout, `subtype-ok:${observation.checks}\n`);
	}
	assert.equal(sha256(await readFile(join(relocated, sourcePath))), observation.consumerSha256);
	await assert.rejects(access(root), { code: "ENOENT" });
	return { ...portable, relocatedInstallation: true, repeatExecution: true
		, repeatedRuns: runs.length
		, compilerFreeReplay: true, sourceUnchangedAfterReplay: true };
};
