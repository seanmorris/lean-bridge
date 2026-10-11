/**
 * Install both CPAN delivery modes and replay unchanged checked-record callers after relocation.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, mkdir, readFile, readdir, rm, symlink } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { nativeArtifactPaths } from "../../src/build/native-artifacts.mjs";
import { installCpanArchive } from "../../src/release/cpan-install.mjs";
import { readVerifiedCpanPackage } from "../../src/release/cpan-package.mjs";
import { traceCpanInstall } from "../../src/release/cpan-install-trace.mjs";
import { copiedCleanEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { relocatePerlConsumer } from "./perl-relocated-consumer.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { checkedRecordPerlConsumer, checkedRecordPerlSelection } from "./checked-record-perl-fixture.mjs";

export const checkedRecordPerlConfigurations = Object.freeze([
	"5.36.3-threaded", "5.36.3-unthreaded", "5.38.2-threaded", "5.38.2-unthreaded"
]);
export const checkedRecordPerlModes = Object.freeze(["prebuilt-only", "build-xs"]);

/**
 * Select every required ABI; an override changes executable locations, never the matrix.
 *
 * @param override - Optional JSON object mapping all four configuration names to absolute executables.
 */
export const checkedRecordPerlExecutables = override => {
	const selected = override === undefined
		? Object.fromEntries(checkedRecordPerlConfigurations.map(name => [name, resolve(".toolchains/perl", name, "bin/perl")]))
		: JSON.parse(override);
	assert.ok(selected && typeof selected === "object" && !Array.isArray(selected));
	assert.deepEqual(Object.keys(selected).sort(), [...checkedRecordPerlConfigurations].sort());
	assert.ok(Object.values(selected).every(path => typeof path === "string" && isAbsolute(path)));
	assert.equal(new Set(Object.values(selected)).size, 4, "Each Perl configuration needs its own executable");
	return selected;
};

/**
 * Require the actual executable's version and threading, not a pathname label.
 *
 * @param configuration - Pinned version and threading selection.
 * @param identity - Actual Perl Config output.
 */
export const assertCheckedRecordPerlIdentity = (configuration, identity) => {
	assert.ok(checkedRecordPerlConfigurations.includes(configuration));
	assert.equal(identity.version, configuration.split("-")[0]);
	const threaded = configuration.endsWith("-threaded");
	assert.equal(identity.useithreads === "define", threaded);
	assert.equal(identity.usemultiplicity === "define", threaded);
	assert.equal(identity.ivsize, "8"); assert.equal(identity.ptrsize, "8");
	assert.match(identity.archname, /x86_64|amd64/u);
};

/**
 * Record the executable bytes and independently observed Perl Config.
 *
 * @param configuration - Pinned version and threading selection.
 * @param command - Absolute interpreter executable.
 * @param directory - Working directory for the isolated probe.
 */
export const probeCheckedRecordPerl = async (configuration, command, directory) => {
	const result = await runCopied(command, ["-MConfig", "-MJSON::PP", "-e"
		, 'print JSON::PP->new->canonical->encode({map { $_ => $Config{$_} } qw(version archname useithreads usemultiplicity ivsize ptrsize)})'], directory);
	assert.equal(result.stderr, "");
	const identity = JSON.parse(result.stdout);
	assertCheckedRecordPerlIdentity(configuration, identity);
	return { configuration, identity, executableSha256: sha256(await readFile(command)) };
};

/**
 * Snapshot all installed bytes, including receipts; reject links and special files.
 *
 * @param root - Installed prefix to authenticate.
 */
export const checkedRecordPerlInstalledFiles = async root => {
	const entries = {};
	for(const path of await nativeArtifactPaths(root))
	{
		const bytes = await readFile(join(root, path));
		entries[path] = { bytes: bytes.length, sha256: sha256(bytes) };
	}
	assert.ok(Object.keys(entries).length > 0);
	return entries;
};

/**
 * Inspect exact prepared bytes, install offline, authenticate installed payloads and run twice.
 * C compilation is available only in build-xs; neither mode can rebuild Lean.
 *
 * @param options - Task-owned roots, independently selected interpreter and verified handoff.
 * @param options.configuration - Pinned version and threading selection.
 * @param options.command - Absolute interpreter executable.
 * @param options.mode - Explicit prebuilt-only or build-xs installation.
 * @param options.route - Ordinary/reviewed full or standalone result-only route.
 * @param options.consumer - Task-owned parent of fresh consumer directories.
 * @param options.handoff - Verified package-set handoff directory.
 * @param options.packages - Runtime and component package-set entries.
 * @param options.output - New destination for original inspection and execution records.
 */
export const installCheckedRecordPerl = async ({ configuration, command, mode, route, consumer, handoff, packages, output }) => {
	assert.ok(checkedRecordPerlModes.includes(mode));
	assert.ok(checkedRecordPerlConfigurations.includes(configuration));
	const selection = checkedRecordPerlSelection(route);
	assert.deepEqual(packages.map(item => item.role).sort(), ["component", "runtime"]);
	assert.ok(packages.every(item => item.target === "cpan" && item.artifacts.length === 1));
	const root = join(consumer, `${configuration}-${mode}`), prefix = join(root, "installed");
	await assert.rejects(access(root), { code: "ENOENT" });
	await mkdir(root, { recursive: true });
	const interpreter = await probeCheckedRecordPerl(configuration, command, root);
	const source = await checkedRecordPerlConsumer(route);
	await saveLakeFile(root, "consumer.pl", source);
	const tools = join(root, "tools"); await mkdir(tools);
	const allowed = ["make", "tar", "gzip", "sh", "cp", "mv", "rm", "chmod", "mkdir", "touch", "true"];
	if(mode === "build-xs") allowed.push("cc", "gcc", "x86_64-linux-gnu-gcc", "as", "ld");
	for(const name of allowed) await symlink(`/usr/bin/${name}`, join(tools, name));
	const environment = { ...copiedCleanEnvironment, PATH: tools
		, ...mode === "build-xs" ? { CC: "/usr/bin/cc" } : {} };
	const traces = [];
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
		assert.equal(manifest.runtimeIdentity, pkg.runtimeIdentity);
		await saveLakeFile(output, `${role}-manifest.json`, canonicalJson(manifest));
		await saveLakeFile(output, `${role}-source.xs`, await readFile(join(packageRoot, manifest.xs)));
		await installCpanArchive({ archive, workingRoot: root, prefix, perl: command, mode, environment });
		const relative = manifest.module.replaceAll("::", "/");
		const receipts = (await nativeArtifactPaths(prefix)).filter(path => path.endsWith(`/${relative}/install-receipt.json`));
		assert.equal(receipts.length, 1, `${role} installed receipt must be unique`);
		const installRoot = join(prefix, receipts[0].slice(0, -`${relative}/install-receipt.json`.length));
		const receiptBytes = await readFile(join(prefix, receipts[0])), receipt = JSON.parse(receiptBytes);
		const trace = await traceCpanInstall({ packageRoot, installRoot });
		assert.equal(trace.operation, mode === "prebuilt-only" ? "prebuilt-xs" : "generated-xs-only");
		const abi = await runCopied(command, ["-I.", "-MLeanBridgeBuild", "-e", "print JSON::PP->new->canonical->encode(LeanBridgeBuild::abi())"], packageRoot);
		assert.equal(abi.stderr, ""); assert.deepEqual(receipt.abi, JSON.parse(abi.stdout));
		assert.ok(manifest.prebuilt.some(item => canonicalJson(item.abi) === canonicalJson(receipt.abi)));
		await saveLakeFile(output, `${role}-install-receipt.json`, receiptBytes);
		await saveLakeFile(output, `${role}-trace.json`, canonicalJson(trace));
		traces.push({ role, manifestSha256: sha256(canonicalJson(manifest)), receiptSha256: sha256(receiptBytes), traceSha256: sha256(canonicalJson(trace)) });
		assert.equal(sha256(await readFile(archive)), artifact.sha256);
		// No extracted distribution can satisfy a library lookup during either consumer run.
		await rm(inspection, { recursive: true });
		await assert.rejects(access(inspection), { code: "ENOENT" });
	}
	const installed = await checkedRecordPerlInstalledFiles(prefix);
	await saveLakeFile(output, "installed-files.json", canonicalJson(installed));
	const first = await runCopied(command, ["consumer.pl"], root, { ...copiedCleanEnvironment, PERL5LIB: join(prefix, "lib/perl5") });
	assert.equal(first.stderr, ""); assert.equal(first.stdout, `checked-record-ok:${selection.checks}\n`);
	assert.deepEqual(await checkedRecordPerlInstalledFiles(prefix), installed);
	await saveLakeFile(output, "first.stdout", first.stdout);
	const moved = await relocatePerlConsumer({ root, command, success: "checked-record-ok", checks: selection.checks });
	assert.equal(moved.consumerSha256, sha256(source));
	assert.deepEqual(await checkedRecordPerlInstalledFiles(join(moved.installed, "installed")), installed);
	assert.deepEqual(await probeCheckedRecordPerl(configuration, command, moved.installed), interpreter);
	// Retain the independently executed replay, not a copy of the expected success marker.
	const repeated = await runCopied(command, ["consumer.pl"], moved.installed, { ...copiedCleanEnvironment, PERL5LIB: moved.library });
	assert.equal(repeated.stderr, ""); assert.equal(repeated.stdout, first.stdout);
	await saveLakeFile(output, "repeated.stdout", repeated.stdout);
	assert.deepEqual(await checkedRecordPerlInstalledFiles(join(moved.installed, "installed")), installed);
	await assert.rejects(access(root), { code: "ENOENT" });
	return { configuration, mode, ...interpreter, route, checks: selection.checks
		, consumerSha256: sha256(source)
		, installedFilesSha256: sha256(canonicalJson(installed)), traces
		, offlineInstall: true, compilerFreeExecution: true
		, leanCompilerUnavailable: true, extractedDistributionsRemoved: true
		, nativePayloadUnchanged: true, installedBytesUnchanged: true
		, relocatedInstallation: true, compilerFreeReplay: true, repeatedRuns: 2
		, installationCCompilerAvailable: mode === "build-xs"
		, sourceUnchangedAfterReplay: sha256(await readFile(join(moved.installed, "consumer.pl"))) === sha256(source)
		, dispatch: { observed: false, reason: "No entry instrumentation in this Perl installed acceptance" }
	};
};
