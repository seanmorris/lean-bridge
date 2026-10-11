/**
 * Check complete late-input observations against retained original build and execution records.
 * This supplement does not measure dispatch and cannot replace the earlier instrumented gates.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { finContainerEdgeChecks, finContainerEdgeSelection } from "./fin-container-edge-install.mjs";
import { finContainerEdgeRefinements, finContainerEdgeSource } from "./fin-container-edges.mjs";
import { finContainerTargets } from "./fin-container-install.mjs";
import { finLateAdditionalChecks, finLateConsumer, finLateProfiles } from "./fin-container-late-consumers.mjs";

const digest = /^[a-f0-9]{64}$/u;
const hashes = (object, keys) => { for(const key of keys) assert.match(object[key], digest, key); };
const flags = (object, keys) => { for(const key of keys) assert.equal(object[key], true, key); };
const safePath = path => {
	assert.equal(typeof path, "string"); assert.ok(!isAbsolute(path) && !/[\\\0]/u.test(path));
	assert.ok(path.split("/").every(part => part !== "" && part !== "." && part !== ".."));
};

/**
 * Check an exact, non-skipped installed test, not a source-only or differently named gate.
 *
 * @param tap - Original TAP transcript.
 */
export const assertFinLateTap = tap => {
	assert.match(tap, /^ok 1 - installed native packages preserve both complete late Fin inputs through rejection and relocated recovery$/mu);
	for(const [name, value] of Object.entries({ tests: 1, pass: 1, fail: 0, cancelled: 0, skipped: 0, todo: 0 }))
	{
		const matches = [...tap.matchAll(new RegExp(`^# ${name} (\\d+)$`, "gm"))];
		assert.equal(matches.length, 1); assert.equal(Number(matches[0][1]), value);
	}
	assert.doesNotMatch(tap, /^not ok |# (?:SKIP|TODO)\b/mu);
};

/**
 * Authenticate both original models/receipts, whole callers, output and closure observations.
 *
 * @param report - Actual completed installed report.
 * @param profiles - Explicit sorted native selection.
 * @param options - Independent expectations and original record reader.
 * @param options.read - Reader of paths relative to this report's records directory.
 * @param options.python - Required minor when Python is selected.
 * @param options.glibc - Explicit declared package floor, never inferred from the host.
 */
export const assertFinLateReport = async (report, profiles, { read, python, glibc } = {}) => {
	assert.deepEqual(finContainerEdgeSelection(profiles.join(",")), profiles);
	assert.ok(profiles.length > 0 && profiles.every(profile => finLateProfiles.includes(profile)));
	assert.equal(typeof read, "function"); assert.match(glibc, /^2\.\d+$/u);
	if(profiles.includes("python")) assert.ok(["3.11", "3.12"].includes(python));
	else assert.equal(python, undefined);
	assert.equal(report.schemaVersion, 1); assert.equal(report.kind, "fin-container-late-native-v1");
	assert.deepEqual(report.profiles, profiles); assert.equal(report.authorRoots, 2); assert.equal(report.reproducible, true);
	assert.deepEqual(report.reports.map(item => item.profile), profiles);
	const expected = ["context.json"];
	for(const attempt of [0, 1])
		for(const name of ["model.json", "package-set-receipt.json", "FinContainers.lean", "lean-bridge.exports.json"])
			expected.push(`author-${attempt}/${name}`);
	for(const profile of profiles)
		for(const extension of ["source", "receipt.json", "closure.json", "before.stdout", "relocated.stdout", ...(profile === "php-native" ? ["strict.stdout"] : [])])
			expected.push(`${profile}.${extension}`);
	assert.deepEqual(Object.keys(report.recordFiles).sort(), expected.sort());
	const files = new Map();
	for(const path of expected)
	{
		const bytes = await read(path), identity = report.recordFiles[path];
		assert.ok(Buffer.isBuffer(bytes)); assert.deepEqual(Object.keys(identity).sort(), ["bytes", "sha256"]);
		assert.equal(bytes.length, identity.bytes, path); assert.equal(sha256(bytes), identity.sha256, path);
		files.set(path, bytes);
	}
	const json = path => JSON.parse(files.get(path)), text = path => files.get(path).toString();
	const roots = json("context.json").roots;
	assert.equal(roots.length, 2);
	const directories = roots.flatMap(root => [root.author, root.consumer]);
	assert.equal(new Set(directories).size, 4);
	for(const path of directories) assert.ok(typeof path === "string" && isAbsolute(path) && !path.includes("\0"));
	const source = await finContainerEdgeSource();
	const targets = Object.fromEntries(profiles.map(profile => finContainerTargets[profile]));
	for(const attempt of [0, 1])
	{
		const prefix = `author-${attempt}/`, model = json(prefix + "model.json"), receipt = json(prefix + "package-set-receipt.json");
		assert.equal(text(prefix + "FinContainers.lean"), source);
		const configuration = text(prefix + "lean-bridge.exports.json");
		assert.equal(configuration, canonicalJson({ schemaVersion: 1, modules: ["FinContainers"], targets }));
		assert.equal(model.sourceIdentity.exportConfigurationSource, configuration);
		assert.equal(model.sourceIdentity.exportConfigurationSha256, sha256(configuration));
		assert.equal(model.bindingIrSha256, hashBindingIr(model.bindingIr));
		assert.deepEqual(Object.fromEntries(model.exports.map(item => [item.name, item.refinements ?? null])), finContainerEdgeRefinements);
		const module = model.sourceIdentity.modules.find(item => item.module === "FinContainers");
		assert.deepEqual(module.source, { path: "FinContainers.lean", bytes: Buffer.byteLength(source), sha256: sha256(source) });
		assert.equal(receipt.kind, "lean-bridge-package-set-receipt"); assert.equal(receipt.schemaVersion, 1);
		assert.deepEqual(receipt.component, model.component);
		assert.equal(receipt.source.treeSha256, model.sourceIdentity.sourceTreeSha256);
		assert.equal(receipt.profiles.length, 1);
		assert.equal(receipt.profiles[0].id, "native-library-v1");
		assert.equal(receipt.profiles[0].bindingIrSha256, model.bindingIrSha256);
		const expectedTargets = [...new Set(profiles.map(profile => finContainerTargets[profile][0]))].sort();
		assert.deepEqual(receipt.packages.map(pkg => pkg.target).sort(), expectedTargets);
		const archives = {};
		for(const pkg of receipt.packages)
		{
			assert.equal(pkg.role, "component"); assert.equal(pkg.profile, "native-library-v1");
			assert.equal(pkg.runtimeIdentity, receipt.profiles[0].runtimeIdentity);
			assert.ok(pkg.artifacts.length > 0);
			for(const artifact of pkg.artifacts)
			{
				safePath(artifact.path); assert.match(artifact.sha256, digest);
				assert.ok(!Object.hasOwn(archives, artifact.path)); archives[artifact.path] = artifact.sha256;
			}
		}
		assert.deepEqual(report.archives, archives);
	}
	for(const name of ["model.json", "package-set-receipt.json"])
		assert.equal(sha256(files.get(`author-0/${name}`)), sha256(files.get(`author-1/${name}`)), `two-root ${name}`);
	const model = json("author-0/model.json"), receipt = json("author-0/package-set-receipt.json");
	for(const item of report.reports)
	{
		const profile = item.profile, [target, coordinate] = finContainerTargets[profile];
		assert.equal(item.path, "ordinary-source");
		assert.equal(item.checks, finContainerEdgeChecks[profile] + finLateAdditionalChecks[profile]);
		assert.deepEqual(item.result, { checks: item.checks });
		assert.equal(text(`${profile}.source`), await finLateConsumer(profile));
		assert.equal(item.consumerSha256, sha256(files.get(`${profile}.source`)));
		assert.equal(item.fixtureSha256, sha256(source));
		assert.equal(item.modelSha256, sha256(files.get("author-0/model.json")));
		assert.equal(item.receiptSha256, sha256(files.get("author-0/package-set-receipt.json")));
		assert.equal(item.bindingIrSha256, model.bindingIrSha256);
		assert.equal(item.sourceTreeSha256, model.sourceIdentity.sourceTreeSha256);
		assert.deepEqual(item.refinements, finContainerEdgeRefinements);
		flags(item, ["offlineInstall", "compilerFreePath", "sourceRemovedBeforeInstallation", "relocatedInstallation", "repeatExecution", "installedFilesUnchanged"]);
		assert.deepEqual(item.lateInputs, { additionalChecks: finLateAdditionalChecks[profile], rejections: 1009, recoveries: 1009, snapshotMutationControls: 6, inputTreesCompared: ["arg0", "arg1"] });
		assert.deepEqual(item.dispatch, { observed: false, reason: "This supplement measures public behavior. Expanded source/adapter counters remain a separate required gate." });
		assert.equal(Object.hasOwn(item, "foreignCarriers"), false);
		assert.deepEqual(item.packages, receipt.packages.filter(pkg => pkg.target === target));
		const pkg = item.packages[0], installed = json(`${profile}.receipt.json`);
		assert.equal(pkg.name, coordinate.name); assert.equal(pkg.version, coordinate.version);
		assert.equal(installed.name, pkg.name); assert.equal(installed.version, pkg.version);
		assert.equal(installed.bindingIrSha256, item.bindingIrSha256);
		if(["c", "cpp"].includes(profile))
		{
			assert.equal(installed.kind, "lean-bridge-native-c-package");
			assert.equal(installed.ecosystem, profile);
			assert.equal(Object.hasOwn(installed, "sourceIdentity"), false);
			assert.deepEqual(installed.files["share/lean-bridge/component/model.json"], report.recordFiles["author-0/model.json"]);
			for(const [field, path] of [["adapterReceiptSha256", "share/lean-bridge/native-c-adapter.json"]
				, ["componentReceiptSha256", "share/lean-bridge/component/native-component.json"]]) {
				assert.match(installed[field], digest); assert.equal(installed.files[path].sha256, installed[field]);
				}
		}
		else assert.deepEqual(installed.sourceIdentity, model.sourceIdentity);
		assert.equal(installed.runtimeIdentity, pkg.runtimeIdentity);
		assert.equal(installed.glibcMinimumVersion, glibc);
		assert.ok(Object.keys(installed.files).length > 0);
		for(const [path, file] of Object.entries(installed.files))
		{ safePath(path); assert.match(file.sha256, digest); assert.ok(Number.isSafeInteger(file.bytes) && file.bytes >= 0); }
		assert.equal(item.installedReceiptSha256, sha256(files.get(`${profile}.receipt.json`)));
		assert.equal(item.installedFilesSha256, sha256(canonicalJson(installed.files)));
		for(const suffix of ["before.stdout", "relocated.stdout", ...(profile === "php-native" ? ["strict.stdout"] : [])])
			assert.equal(text(`${profile}.${suffix}`), `fin-container-ok:${item.checks}\n`);
		const closure = json(`${profile}.closure.json`);
		if(profile === "python")
		{
			assert.equal(Object.hasOwn(item, "exactPackageFiles"), false);
			assert.deepEqual(item.pythonEnvironment, closure); assert.equal(item.pythonBytecodePolicy, "isolated-empty-prefix");
			assert.equal(item.python, closure.python); assert.ok(item.python.startsWith(python + "."));
			hashes(closure, ["baselineSha256", "environmentSha256", "interpreterSha256"]);
		}
		else
		{
			assert.equal(item.exactPackageFiles, true); hashes(item, ["packageFileSetSha256"]);
			assert.equal(closure.receiptSha256, item.installedReceiptSha256);
			assert.equal(closure.packageFileSetSha256, item.packageFileSetSha256);
			const receiptPath = ["c", "cpp"].includes(profile) ? "lean-bridge-package.json"
				: ["java", "kotlin"].includes(profile) ? "META-INF/lean-bridge/package-receipt.json" : "lean-bridge/package-receipt.json";
			assert.equal(item.packageFileSetSha256, sha256(canonicalJson([...Object.keys(installed.files), receiptPath].sort())));
		}
		const contexts = { ruby: ["rubyEnvironment", ["environmentSha256", "interpreterSha256", "gemspecSha256"]]
			, java: ["jvmEnvironment", ["classpathFilesSha256", "interpreterSha256"]]
			, kotlin: ["jvmEnvironment", ["classpathFilesSha256", "interpreterSha256"]]
			, dotnet: ["dotnetEnvironment", ["cacheFilesSha256", "buildInputsSha256", "deployedFilesSha256", "interpreterSha256"]]
			, "php-native": ["phpEnvironment", ["dependencyFilesSha256", "generatedFilesSha256", "vendorFilesSha256", "toolsSha256"]] };
		if(contexts[profile])
		{
			const [field, keys] = contexts[profile]; assert.deepEqual(item[field], closure); hashes(closure, keys);
		}
		if(["c", "cpp", "rust"].includes(profile)) hashes(item, ["executableSha256"]);
		if(["c", "cpp"].includes(profile)) assert.equal(item.runtimeSearchPath, `$ORIGIN/${pkg.name}-${pkg.version}-${profile}/lib`);
		if(profile === "php-native") assert.equal(item.repeatStrictExecution, true);
		if(["java", "kotlin", "dotnet", "php-native"].includes(profile))
		{ assert.ok(Object.keys(item.deployedFiles).length > 0); hashes(item.deployedFiles, Object.keys(item.deployedFiles)); }
	}
	return { profiles, checks: report.reports.map(item => item.checks), records: files.size };
};

/**
 * Read the actual report and its adjacent originals; no current temporary installation is required.
 *
 * @param path - Original edges-*.json report.
 * @param profiles - Exact expected selection.
 * @param options - Explicit Python minor and declared glibc floor.
 */
export const readFinLateReport = async (path, profiles, options) => {
	const report = JSON.parse(await readFile(path));
	return assertFinLateReport(report, profiles, { ...options, read: file => readFile(join(`${path}.records`, file)) });
};
