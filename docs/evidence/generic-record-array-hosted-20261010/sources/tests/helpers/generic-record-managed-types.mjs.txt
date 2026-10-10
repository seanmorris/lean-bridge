/**
 * Reject invalid alias-named record callers against installed managed packages.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { sha256 } from "../../src/capsule/node.mjs";
import { copiedCleanEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { captureCorpusCompiler } from "./type-corpus-compiler.mjs";
import { javaCompilerOptions, jvmDiagnostics } from "./type-corpus-jvm-tools.mjs";

const select = versions => versions.filter(version => /^8\.0\./u.test(version)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).at(-1);
const cases = {
	dotnet: [
		["alias", "Api.Bump(new NatBoxAgain(1, 0));", "CS1503"]
		, ["field", 'new NatBox("wrong", 0);', "CS1503"]
		, ["missing", "new NatBox(1);", "CS7036"]]
	, java: [
		["alias", "Api.bump(new NatBoxAgain(BigInteger.ONE, BigInteger.ZERO));", "compiler.err.cant.apply.symbol"]
		, ["field", 'new NatBox("wrong", BigInteger.ZERO);', "compiler.err.cant.apply.symbol"]
		, ["missing", "new NatBox(BigInteger.ONE);", "compiler.err.cant.apply.symbol"]]
	, kotlin: [
		["alias", "Api.bump(NatBoxAgain(BigInteger.ONE, BigInteger.ZERO))", "ARGUMENT_TYPE_MISMATCH"]
		, ["field", 'NatBox("wrong", BigInteger.ZERO)', "ARGUMENT_TYPE_MISMATCH"]
		, ["missing", "NatBox(BigInteger.ONE)", "NO_VALUE_FOR_PARAMETER"]]
};
const specializedCases = {
	dotnet: [
		["namespace", "Api.EchoLeft(new RightBox(1, 0));", "CS1503"]
		, ["specialized-field", 'new LeftBox("wrong", 0);', "CS1503"]
		, ["specialized-missing", "new RightBox(1);", "CS7036"]]
	, java: [
		["namespace", "Api.echoLeft(new RightBox(BigInteger.ONE, BigInteger.ZERO));", "compiler.err.cant.apply.symbol"]
		, ["specialized-field", 'new LeftBox("wrong", BigInteger.ZERO);', "compiler.err.cant.apply.symbol"]
		, ["specialized-missing", "new RightBox(BigInteger.ONE);", "compiler.err.cant.apply.symbol"]]
	, kotlin: [
		["namespace", "Api.echoLeft(RightBox(BigInteger.ONE, BigInteger.ZERO))", "ARGUMENT_TYPE_MISMATCH"]
		, ["specialized-field", 'LeftBox("wrong", BigInteger.ZERO)', "ARGUMENT_TYPE_MISMATCH"]
		, ["specialized-missing", "RightBox(BigInteger.ONE)", "NO_VALUE_FOR_PARAMETER"]]
};

/**
 * Require every C# error to originate at the independently authored caller.
 *
 * @param result - Compiler exit status and complete diagnostics.
 * @param root - Isolated compiler directory.
 * @param file - Exact invalid caller filename.
 * @param expected - Expected C# error code.
 */
export const genericRecordDotnetDiagnostics = (result, root, file, expected) => {
	assert.equal(result.code, 1, result.stdout + result.stderr);
	const diagnostics = [];
	for(const line of (result.stdout + "\n" + result.stderr).split("\n"))
	{
		const match = /^(.+\.cs)\((\d+),(\d+)\): error (CS\d+): (.+)$/u.exec(line);
		if(!match)
		{ assert.doesNotMatch(line, /\berror\b/iu); continue; }
		const [, path, row, column, code] = match;
		assert.equal(resolve(root, path), join(root, file));
		assert.equal(code, expected);
		assert.ok(Number(row) > 0 && Number(column) > 0);
		diagnostics.push({ code, file, line: Number(row), column: Number(column) });
	}
	assert.equal(diagnostics.length, 1);
	return diagnostics;
};

/**
 * Compile positive and negative callers, then repeat the installed valid program.
 *
 * @param options - Installed package location and absolute toolchain selection.
 * @param options.profile - Selected dotnet, java or kotlin profile.
 * @param options.consumer - Source-free consumer handoff directory.
 * @param options.environment - Selected managed toolchains.
 * @param options.specialized - Include the specialized namespace controls.
 * @param observation - Valid installed consumer result.
 */
export const checkGenericRecordManagedTypes = async ({ profile, consumer, environment, specialized }, observation) => {
	assert.ok(Object.hasOwn(cases, profile));
	const root = join(consumer, profile), dotnet = profile === "dotnet", java = profile === "java";
	const extension = dotnet ? "cs" : java ? "java" : "kt";
	const sourceFor = statement => dotnet
		? `using LeanBridge.Genericrecords; static class Probe { static void Test() { ${statement} } }\n`
		: `import org.leanbridge.genericrecords.*;\nimport java.math.BigInteger;\n${java ? "class Probe { static void test() {" : "fun test() {"}\n${statement}\n}${java ? " }" : ""}\n`;
	let command, argumentsFor, artifact, repeatArgs, env = copiedCleanEnvironment;
	if(dotnet)
	{
		command = environment.LEAN_BRIDGE_DOTNET;
		const sdkRoot = dirname(command);
		const sdk = select(await readdir(join(sdkRoot, "sdk")));
		const compiler = join(sdkRoot, "sdk", sdk, "Roslyn/bincore/csc.dll");
		const refRoot = join(sdkRoot, "packs/Microsoft.NETCore.App.Ref", select(await readdir(join(sdkRoot, "packs/Microsoft.NETCore.App.Ref"))), "ref/net8.0");
		const refs = (await readdir(refRoot)).filter(file => file.endsWith(".dll")).sort().map(file => `/reference:${join(refRoot, file)}`);
		const libraries = (await readdir(join(root, "out"))).filter(file => file.endsWith(".dll") && file !== "Consumer.dll");
		assert.equal(libraries.length, 1);
		artifact = join(root, "out", libraries[0]);
		env = { ...env, DOTNET_ROOT: sdkRoot, DOTNET_CLI_HOME: join(root, "dotnet-home"), DOTNET_NOLOGO: "1", DOTNET_CLI_TELEMETRY_OPTOUT: "1" };
		argumentsFor = file => ["exec", compiler, "/nologo", "/noconfig", "/nostdlib+", "/target:library", "/langversion:12", "/nullable:enable", "/warnaserror+", ...refs, `/reference:${artifact}`, "/out:probe.dll", file];
		repeatArgs = ["out/Consumer.dll"];
	}
	else
	{
		artifact = join(root, "component.jar");
		command = java ? environment.LEAN_BRIDGE_JAVAC : environment.LEAN_BRIDGE_KOTLINC;
		if(!java) env = { ...env, PATH: "/usr/bin:/bin", JAVA_HOME: dirname(dirname(environment.LEAN_BRIDGE_JAVA)) };
		argumentsFor = file => java
			? [...javaCompilerOptions, "-XDrawDiagnostics", "-cp", artifact, file]
			: ["-Werror", "-jvm-target", "22", "-Xrender-internal-diagnostic-names", "-cp", artifact, file, "-d", "probe.jar"];
		repeatArgs = ["--enable-native-access=ALL-UNNAMED", "-cp", `${artifact}:${java ? root : join(root, "consumer.jar")}`, java ? "Consumer" : "ConsumerKt"];
	}
	const artifactSha256 = sha256(await readFile(artifact));
	const positive = sourceFor((dotnet ? "Api.Bump(new NatBox(1, 0));" : `Api.bump(${java ? "new " : ""}NatBox(BigInteger.ONE, BigInteger.ZERO));`)
		+ (specialized ? dotnet ? "Api.EchoLeft(new LeftBox(1, 0));" : `Api.echoLeft(${java ? "new " : ""}LeftBox(BigInteger.ONE, BigInteger.ZERO));` : ""));
	const positiveFile = `valid.${extension}`;
	await saveLakeFile(root, positiveFile, positive);
	const accepted = await captureCorpusCompiler(command, argumentsFor(positiveFile), root, env);
	assert.equal(accepted.code, 0, accepted.stdout + accepted.stderr);
	const rejected = [];
	for(const [name, statement, expected] of [...cases[profile], ...specialized ? specializedCases[profile] : []])
	{
		const file = `invalid-${name}.${extension}`, source = sourceFor(statement);
		await saveLakeFile(root, file, source);
		const result = await captureCorpusCompiler(command, argumentsFor(file), root, env);
		const diagnostics = dotnet ? genericRecordDotnetDiagnostics(result, root, file, expected)
			: jvmDiagnostics(result, { id: name, expectation: { diagnostic: [expected] } }, profile, root, file);
		rejected.push({ case: name, sourceSha256: sha256(source), diagnostics });
	}
	assert.equal(sha256(await readFile(artifact)), artifactSha256);
	const repeated = await runCopied(observation.command, repeatArgs, root, copiedCleanEnvironment);
	assert.equal(repeated.stderr, "");
	assert.equal(repeated.stdout, `generic-records-ok:${observation.checks}\n`);
	return { artifactSha256, artifactUnchanged: true, positiveSourceSha256: sha256(positive), positiveCompiles: true, rejected, repeatExecutionAfterTypeRejection: true };
};
