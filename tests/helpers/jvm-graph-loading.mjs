/**
 * Install independent Maven packages, then test their shared runtime without
 * sources, compilers, Maven, an ambient cache or native-path overrides.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdir, readFile, readdir, rename, rm } from "node:fs/promises";
import { basename, dirname, join, relative } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { buildCanonicalProject } from "../../src/build/canonical-build.mjs";
import { nativeArtifactPaths, verifyNativeFiles } from "../../src/build/native-artifacts.mjs";
import { verifyPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { copiedCleanEnvironment, nativeFixtureEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { copyPackageSetHandoff } from "./package-set.mjs";
import { saveLakeFile, lakeInputState } from "./lake-workspace.mjs";
import { prepareJvmCorpusDependencies, jvmTools, jvmMaven, mavenGoals, mavenSettings, javaCompilerOptions, kotlinCompilerOptions } from "./type-corpus-jvm-tools.mjs";

const inventory = async root => Object.fromEntries(await Promise.all((await nativeArtifactPaths(root)).map(async path => {
	const bytes = await readFile(join(root, path)); return [path, { sha256: sha256(bytes), bytes: bytes.length }];
})));
const fixture = path => readFile(`tests/fixtures/structured-types/${path}`, "utf8");
const build = async (root, specifications, diagnostic) => {
	const environment = nativeFixtureEnvironment(["java", "kotlin"]), tools = await jvmTools(environment), packages = [];
	const feed = join(root, "feed"); await mkdir(feed);
	let dependencies;
	for(const [index, specification] of specifications.entries())
	{
		const { name, module, graph, value, targets, artifact = name } = specification;
		const author = join(root, "author"), projectRoot = join(author, "project"), outputRoot = join(author, "release");
		const handoff = join(root, "handoff"), lean = `namespace ${module}
${graph ? `inductive V where
  | done (value : UInt32)
  | next (value : V)
structure Parcel where
  node : V
def echo (value : Parcel) : Parcel := value
` : ""}def value : UInt32 := ${value}
end ${module}
`;
		await saveLakeFile(projectRoot, `${module}.lean`, lean);
		await saveLakeFile(projectRoot, "lean-toolchain", "leanprover/lean4:v4.32.2\n");
		await saveLakeFile(projectRoot, "lakefile.toml", `name = "${name}"\nversion = "1.0.0"\n[[lean_lib]]\nname = "${module}"\n`);
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1
			, modules: [module]
			, exports: [...graph ? [`${module}.echo`] : [], `${module}.value`]
			, targets: { maven: { name: `org.leanbridge:${artifact}`, version: "1.0.0" } } }));
		const before = await lakeInputState(projectRoot);
		diagnostic(`loading: building ${artifact} (${targets.join(", ")})`);
		await buildCanonicalProject({ projectRoot, outputRoot, targets, environment })
			.catch(error => { error.message += `: ${JSON.stringify(error.details)}`; throw error; });
		assert.deepEqual(await lakeInputState(projectRoot), before);
		const release = await copyPackageSetHandoff(outputRoot, handoff);
		await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		assert.deepEqual(release.packages.map(pkg => pkg.target).sort(), [...targets].sort());
		const pkg = release.packages.find(pkg => pkg.target === "maven");
		for(const artifact of pkg.artifacts)
		{
			const bytes = await readFile(join(handoff, artifact.path)); assert.equal(sha256(bytes), artifact.sha256);
			await saveLakeFile(feed, `${index}/${basename(artifact.path)}`, bytes);
		}
		if(!dependencies)
		{
			dependencies = await prepareJvmCorpusDependencies({ directory: author, handoff, pkg, environment, clean: copiedCleanEnvironment });
			await cp(join(handoff, dependencies.archive), join(feed, dependencies.archive));
		}
		packages.push({ ...specification, package: pkg, sourceSha256: sha256(lean), authorInputsUnchanged: true });
		await rm(author, { recursive: true, force: true }); await rm(handoff, { recursive: true, force: true });
	}
	assert.equal(new Set(packages.map(item => item.package.runtimeIdentity)).size, 1);
	const project = join(root, "consumer"), repository = join(project, "repository");
	await mkdir(repository, { recursive: true }); await mkdir(join(project, "home"));
	assert.deepEqual(await readdir(repository), []); assert.deepEqual(await readdir(join(project, "home")), []);
	assert.equal(sha256(await readFile(join(feed, dependencies.archive))), dependencies.sha256);
	await runCopied("/usr/bin/tar", ["--use-compress-program=/usr/bin/gzip", "-xf", join(feed, dependencies.archive), "-C", project], project);
	assert.deepEqual(await inventory(repository), dependencies.files);
	await saveLakeFile(project, "settings.xml", mavenSettings);
	await saveLakeFile(project, "pom.xml", `<project xmlns="http://maven.apache.org/POM/4.0.0"><modelVersion>4.0.0</modelVersion><groupId>consumer</groupId><artifactId>loading</artifactId><version>1.0.0</version><dependencies>${packages.map(({ package: pkg }) => {
		const [group, artifact] = pkg.name.split(":");
		return `<dependency><groupId>${group}</groupId><artifactId>${artifact}</artifactId><version>${pkg.version}</version></dependency>`;
	}).join("")}</dependencies></project>\n`);
	const jars = [], receipts = [];
	for(const [index, { package: pkg }] of packages.entries())
	{
		const jar = pkg.artifacts.find(file => file.path.endsWith(".jar")), pom = pkg.artifacts.find(file => file.path.endsWith(".pom"));
		const [group, artifact] = pkg.name.split(":"), installed = join(repository, ...group.split("."), artifact, pkg.version);
		await jvmMaven(tools, project, [mavenGoals.install, `-Dfile=${join(feed, String(index), basename(jar.path))}`, `-DpomFile=${join(feed, String(index), basename(pom.path))}`], copiedCleanEnvironment);
		for(const file of [jar, pom]) assert.equal(sha256(await readFile(join(installed, basename(file.path)))), file.sha256);
		const installedJar = join(installed, basename(jar.path)), extracted = join(project, "extracted");
		await mkdir(extracted); await runCopied("/usr/bin/unzip", ["-q", installedJar, "-d", extracted], project);
		const path = "META-INF/lean-bridge/package-receipt.json", bytes = await readFile(join(extracted, path)), receipt = JSON.parse(bytes);
		assert.equal(receipt.name, pkg.name); assert.equal(receipt.runtimeIdentity, pkg.runtimeIdentity);
		const payload = await inventory(extracted); delete payload[path]; assert.deepEqual(payload, receipt.files);
		await verifyNativeFiles(extracted, receipt.files);
		jars.push(installedJar); receipts.push({ receipt, sha256: sha256(bytes) });
		await rm(extracted, { recursive: true, force: true });
	}
	await jvmMaven(tools, project, [mavenGoals.resolve, "-Dmdep.outputFile=classpath.txt"], copiedCleanEnvironment);
	const classpath = (await readFile(join(project, "classpath.txt"), "utf8")).trim().split(":"), resolved = [];
	for(const jar of jars) assert.ok(classpath.includes(jar));
	assert.equal(new Set(classpath).size, classpath.length);
	for(const path of classpath.filter(path => !jars.includes(path)))
	{
		const mavenPath = relative(repository, path); assert.ok(dependencies.files[mavenPath]);
		const hash = sha256(await readFile(path)); assert.equal(hash, dependencies.files[mavenPath].sha256);
		resolved.push({ path, mavenPath, sha256: hash });
	}
	assert.ok(resolved.some(item => item.mavenPath === "org/jetbrains/kotlin/kotlin-stdlib/2.2.0/kotlin-stdlib-2.2.0.jar"));
	await rm(feed, { recursive: true, force: true });
	return { root, project, environment, tools, packages, jars, receipts, resolved, classpath, dependencies };
};

const deploy = async prepared => {
	const { root, project, tools, jars, resolved, packages } = prepared, deployment = join(root, "relocated"), runtime = join(root, "runtime-only");
	await mkdir(deployment); await rename(join(project, "classes"), join(deployment, "classes"));
	for(const [index, path] of jars.entries()) await cp(path, join(deployment, `component${index}.jar`));
	await mkdir(join(deployment, "dependencies"));
	for(const item of resolved) await cp(item.path, join(deployment, "dependencies", basename(item.path)));
	await runCopied(tools.jlink, ["--module-path", join(tools.jdk, "jmods"), "--add-modules", "java.base", "--no-header-files", "--no-man-pages", "--output", runtime], project);
	const files = await inventory(deployment), runtimeFiles = await inventory(runtime);
	for(const [index, { package: pkg }] of packages.entries())
		assert.equal(files[`component${index}.jar`].sha256, pkg.artifacts.find(file => file.path.endsWith(".jar")).sha256);
	await rm(project, { recursive: true, force: true });
	assert.deepEqual((await readdir(root)).sort(), ["relocated", "runtime-only"]);
	const modules = (await runCopied(join(runtime, "bin/java"), ["--list-modules"], deployment)).stdout.trim().split("\n");
	assert.equal(modules.length, 1); assert.match(modules[0], /^java\.base@22(?:\.|$)/);
	await mkdir(join(deployment, "native-temp"));
	return { deployment, runtime, files, runtimeFiles, modules };
};

const execute = async (prepared, deployed, profile, mode, main, args = [], withPackages = true) => {
	const { deployment, runtime } = deployed, temp = join(deployment, "native-temp");
	const classpath = ["classes"
		, ...withPackages ? prepared.jars.map((_, index) => `component${index}.jar`) : []
		, ...prepared.resolved.map(item => `dependencies/${basename(item.path)}`)];
	assert.deepEqual(await readdir(temp), []);
	const result = await runCopied(join(runtime, "bin/java"), [
		"--enable-native-access=ALL-UNNAMED", "-Xss256k"
		, `-Djava.io.tmpdir=${temp}`, "-cp", classpath.join(":"), main, mode
		, ...args], deployment);
	assert.equal(result.stderr, ""); assert.deepEqual(await readdir(temp), []);
	assert.deepEqual(await inventory(deployment), deployed.files); assert.deepEqual(await inventory(runtime), deployed.runtimeFiles);
	const lines = result.stdout.trim().split("\n"), status = lines.pop();
	assert.match(status, new RegExp(`^${profile}-${mode}-ok$`));
	const mappings = Object.fromEntries(lines.map(line => {
		const match = /^mapped:([A-Za-z0-9_.-]+):([a-f0-9]{64})$/.exec(line); assert.ok(match, line); return [match[1], match[2]];
	}));
	assert.equal(Object.keys(mappings).length, lines.length);
	return { profile, mode, mappings, stdout: result.stdout, normalExitCleanup: true, deploymentUnchanged: true };
};

/**
 * Original recursive and ordinary Maven packages share one runtime.
 *
 * @param root - Test-owned temporary root.
 * @param diagnostic - Progress reporter.
 */
export const checkJvmGraphComposition = async (root, diagnostic) => {
	const prepared = await build(root, [
		{ name: "graph_one", module: "GraphOne", graph: true, value: 41, targets: ["maven"] }
		, { name: "graph_two", module: "GraphTwo", graph: true, value: 43, targets: ["cpp", "maven"] }
		, { name: "graph_peer", module: "GraphPeer", graph: false, value: 42, targets: ["maven"] }
	], diagnostic);
	const { project, tools, environment, classpath, receipts } = prepared, sources = {};
	for(const file of ["recursive-jvm-loading.java", "recursive-jvm-composition.java", "recursive-kotlin-composition.kt"])
	{
		const name = { "recursive-jvm-loading.java": "Loading.java", "recursive-jvm-composition.java": "Composition.java", "recursive-kotlin-composition.kt": "Composition.kt" }[file];
		const source = await fixture(file); await saveLakeFile(project, name, source); sources[file] = sha256(source);
	}
	await runCopied(tools.javac, [...javaCompilerOptions, "-cp", classpath.join(":"), "-d", "classes", "Loading.java", "Composition.java"], project);
	const kotlin = dirname(dirname(environment.LEAN_BRIDGE_KOTLINC));
	await runCopied(tools.java, ["-cp", join(kotlin, "lib/*")
		, "org.jetbrains.kotlin.cli.jvm.K2JVMCompiler", "-kotlin-home", kotlin
		, ...kotlinCompilerOptions, "-jdk-home", tools.jdk
		, "-cp", [...classpath, join(project, "classes")].join(":")
		, "-d", "classes", "Composition.kt"], project);
	const deployed = await deploy(prepared), scenarios = [], expected = {};
	for(const { receipt } of receipts)
		for(const [path, file] of Object.entries(receipt.files).filter(([path]) => path.startsWith("META-INF/lean-bridge/native/linux-x64/")))
		{
			const name = basename(path); if(expected[name]) assert.equal(expected[name], file.sha256);
			expected[name] = file.sha256;
		}
	for(const profile of ["java", "kotlin"])
		for(const mode of ["graph-first", "peer-first"])
		{
			diagnostic(`composition: ${profile}/${mode} without author tools`);
			const observation = await execute(prepared, deployed, profile, mode, profile === "java" ? "Composition" : "CompositionKt");
			assert.deepEqual(observation.mappings, expected); scenarios.push({ ...observation, concurrentCalls: 192 });
		}
	return { schemaVersion: 1, packages: prepared.packages, receipts, scenarios
		, sourceHashes: sources, dependencies: prepared.dependencies
		, resolvedDependencies: prepared.resolved.map(({ mavenPath, sha256 }) => ({ mavenPath, sha256 }))
		, deployment: deployed.files, runtimeFiles: deployed.runtimeFiles
		, runtimeModules: deployed.modules
		, offlineInstall: true, emptyRepository: true
		, sourceFreeExecution: true, compilerFreeExecution: true
		, sharedRetirement: true, mixedCppMaven: true };
};

/**
 * Genuine conflicting builds reject before mapping; exact duplicates work.
 *
 * @param root - Test-owned temporary root.
 * @param diagnostic - Progress reporter.
 */
export const checkJvmGraphConflicts = async (root, diagnostic) => {
	const prepared = await build(root, [41, 43].map(value => ({
		name: "graph_collision", module: "Collision", graph: true, value
		, targets: ["maven"], artifact: `collision${value}` })), diagnostic);
	const { project, tools, receipts } = prepared, sources = {};
	assert.equal(receipts[0].receipt.component.id, "graph_collision@1.0.0");
	assert.equal(receipts[1].receipt.component.id, receipts[0].receipt.component.id);
	assert.notEqual(receipts[0].sha256, receipts[1].sha256);
	for(const [file, name] of [["recursive-jvm-loading.java", "Loading.java"], ["recursive-jvm-conflicts.java", "Conflicts.java"]])
	{
		const source = await fixture(file); await saveLakeFile(project, name, source); sources[file] = sha256(source);
	}
	await runCopied(tools.javac, [...javaCompilerOptions, "-d", "classes", "Loading.java", "Conflicts.java"], project);
	const deployed = await deploy(prepared), scenarios = [];
	for(const profile of ["java", "kotlin"])
		for(const first of [0, 1])
			for(const mode of ["duplicate", "conflict"])
			{
				diagnostic(`class loaders: ${profile}/${mode}/${first}`);
				const observation = await execute(prepared, deployed, profile, mode, "Conflicts", [profile, `component${first}.jar`, `component${mode === "duplicate" ? first : 1 - first}.jar`, String(prepared.packages[first].value)], false);
				const expected = Object.fromEntries(Object.entries(receipts[first].receipt.files).filter(([path]) => path.startsWith("META-INF/lean-bridge/native/linux-x64/")).map(([path, value]) => [basename(path), value.sha256]));
				assert.deepEqual(observation.mappings, expected); scenarios.push({ ...observation, first });
			}
	return { schemaVersion: 1, packages: prepared.packages, receipts, scenarios
		, sourceHashes: sources
		, dependencies: prepared.dependencies, deployment: deployed.files
		, runtimeFiles: deployed.runtimeFiles, runtimeModules: deployed.modules
		, offlineInstall: true, emptyRepository: true
		, sourceFreeExecution: true, compilerFreeExecution: true
		, duplicateClassLoaders: true, conflictRejectedBeforeMapping: true
		, existingComponentRemainsUsable: true };
};
