/**
 * Compile Java and genuine Kotlin metadata before compiler-free Maven packaging.
 *
 * @file
 */
import { access, mkdir, readFile, readdir, realpath, stat } from "node:fs/promises";
import { constants } from "node:fs";
import { delimiter, dirname, isAbsolute, join, resolve } from "node:path";
import { sha256 } from "../capsule/node.mjs";
import { processBuildRunner } from "./process-runner.mjs";

const kotlinModule = namespace => `lean_bridge_${namespace.replaceAll(".", "_")}`;
const kotlinOptions = (module, copiedGraph) => ["-module-name", module, "-jvm-target", "22", "-no-reflect", "-no-stdlib", "-Werror", "-Xrender-internal-diagnostic-names", ...copiedGraph ? ["-Xuse-type-table"] : []];
const kotlinJars = ["kotlin-compiler.jar", "kotlin-stdlib.jar", "annotations-13.0.jar"];

/**
 * Check the closed compiler contract before packaging Kotlin classes.
 *
 * @param evidence - Recorded Kotlin compilation metadata.
 * @param namespace - Independently derived Java namespace.
 * @param options - Independently verified native graph profile.
 * @param options.copiedGraph - Use finite metadata references for deep graph fields.
 */
export const validateKotlinCompilation = (evidence, namespace, { copiedGraph = false } = {}) => {
	const module = kotlinModule(namespace), hashes = evidence?.compilerFiles;
	if(evidence?.namespace !== `${namespace}.kotlin` || evidence?.standardLibraryVersion !== "2.2.0"
		|| !/^info: kotlinc-jvm 2\.2\.0 /m.test(evidence?.version ?? "")
		|| evidence?.module !== module || JSON.stringify(evidence?.options) !== JSON.stringify(kotlinOptions(module, copiedGraph))
		|| !hashes || Array.isArray(hashes) || typeof hashes !== "object"
		|| kotlinJars.some(name => !Object.hasOwn(hashes, name))
		|| Object.entries(hashes).some(([name, hash]) => !/^[A-Za-z0-9_.+-]+\.jar$/.test(name) || !/^[a-f0-9]{64}$/.test(hash)))
		throw new Error("Compiled Kotlin projection differs from the compiler contract");
};

const executable = async (command, environment, root) => {
	const candidates = isAbsolute(command) || command.includes("/") ? [resolve(root, command)]
		: String(environment.PATH ?? "").split(delimiter).filter(Boolean).map(directory => resolve(root, directory, command));
	for(const path of candidates)
	{
		try
		{
			if(!(await stat(path)).isFile()) continue;
			await access(path, constants.X_OK); return await realpath(path);
		} catch(error)
		{
			if(!["ENOENT", "ENOTDIR", "EACCES"].includes(error.code)) throw error;
		}
	}
	throw new Error(`Required JVM compiler tool is unavailable: ${command}`);
};

/**
 * Compile closed generated sources against explicit JDK and Kotlin installations.
 *
 * @param options - Prepared source root and explicit tool selection.
 * @param options.root - Private directory already containing generated sources.
 * @param options.files - Generated source map.
 * @param options.environment - Compiler paths and permitted build environment.
 * @param options.signal - Optional cancellation signal.
 */
export const compileJvmSources = async ({ root, files, environment, signal }) => {
	const env = { ...environment };
	for(const key of ["CLASSPATH", "JAVA_TOOL_OPTIONS", "JDK_JAVA_OPTIONS", "JDK_JAVAC_OPTIONS", "_JAVA_OPTIONS", "JAVA_OPTS", "KOTLIN_OPTS", "KOTLIN_RUNNER"]) delete env[key];
	const javac = await executable(environment.LEAN_BRIDGE_JAVAC ?? "javac", env, root);
	const java = await executable(environment.LEAN_BRIDGE_JAVA ?? join(dirname(javac), "java"), env, root);
	const jdk = dirname(dirname(java));
	if(dirname(dirname(javac)) !== jdk) throw new Error("Java and javac must use the same Java 22 installation");
	const run = (command, args) => processBuildRunner.capture({ command, args, cwd: root, env, signal });
	const versionResult = await run(javac, ["-version"]), compiler = (versionResult.stdout || versionResult.stderr).trim();
	if(!/^javac 22(?:[.+ -]|$)/.test(compiler)) throw new Error("Ordinary Maven packages require the Java 22 compiler");
	const javaSources = Object.keys(files).filter(path => path.endsWith(".java")).sort();
	const kotlinSources = Object.keys(files).filter(path => path.endsWith(".kt")).sort();
	await mkdir(join(root, "empty-classpath"));
	let classpath = "empty-classpath", kotlin;
	if(kotlinSources.length)
	{
		const kotlinc = await executable(environment.LEAN_BRIDGE_KOTLINC ?? "kotlinc", env, root);
		const home = environment.LEAN_BRIDGE_KOTLIN_HOME ? resolve(root, environment.LEAN_BRIDGE_KOTLIN_HOME) : dirname(dirname(kotlinc));
		const lib = join(home, "lib"), compilerFiles = {};
		for(const name of (await readdir(lib)).filter(name => name.endsWith(".jar")).sort()) compilerFiles[name] = sha256(await readFile(join(lib, name)));
		for(const name of kotlinJars)
			if(!compilerFiles[name]) throw new Error(`Kotlin 2.2.0 distribution is missing ${name}`);
		const launch = ["-Xmx2g", "-classpath", join(lib, "*"), "org.jetbrains.kotlin.cli.jvm.K2JVMCompiler", "-kotlin-home", home];
		const checked = await run(java, [...launch, "-version"]), version = (checked.stderr || checked.stdout).trim();
		if(!/^info: kotlinc-jvm 2\.2\.0 /m.test(version)) throw new Error("Ordinary Maven packages require the Kotlin 2.2.0 compiler");
		const metadata = JSON.parse(files["binding-manifest.json"]), module = kotlinModule(metadata.namespace);
		// Inline nested Type/Argument messages exceed Kotlin's metadata decoder
		// limit at 32 container levels. Type-table references retain every level.
		const copiedGraph = ["jvm-copied-graph-v1", "jvm-callable-graph-v1"].includes(metadata.generator);
		const options = kotlinOptions(module, copiedGraph);
		await run(java, [...launch, ...options, "-jdk-home", jdk, "-classpath", `${join(lib, "kotlin-stdlib.jar")}${delimiter}${join(lib, "annotations-13.0.jar")}`, "-d", "classes", ...kotlinSources, ...javaSources]);
		classpath = `classes${delimiter}${join(lib, "kotlin-stdlib.jar")}`;
		kotlin = { version, module, options, compilerFiles, namespace: metadata.kotlin.namespace, standardLibraryVersion: "2.2.0" };
		validateKotlinCompilation(kotlin, metadata.namespace, { copiedGraph });
	}
	await run(javac, ["--release", "22", "-g:none", "-proc:none", "-encoding", "UTF-8", "-classpath", classpath, "-sourcepath", "src/main/java", "-d", "classes", ...javaSources]);
	return { compiler, ...kotlin ? { kotlin } : {} };
};
