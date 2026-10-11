/**
 * Synthetic format and corruption controls. These are not installed-package acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { finContainerEdgeChecks } from "./fin-container-edge-install.mjs";
import { finContainerEdgeRefinements, finContainerEdgeReviewedIr, finContainerEdgeSource } from "./fin-container-edges.mjs";
import { finContainerTargets } from "./fin-container-install.mjs";
import { finLateAdditionalChecks, finLateConsumer, finLateProfiles } from "./fin-container-late-consumers.mjs";
import { assertFinLateReport, assertFinLateTap } from "./fin-container-late-report.mjs";
import "./fin-container-late-ci-tests.mjs";
import "./fin-container-late-disk-tests.mjs";
import "./fin-container-late-native-archive-tests.mjs";
import "./fin-container-late-wit-report-tests.mjs";
import "./fin-container-late-ci-workflow-tests.mjs";
import "./fin-container-late-ci-history-tests.mjs";

const synthetic = async () => {
	const profiles = [...finLateProfiles].sort(), source = await finContainerEdgeSource(), hash = sha256("synthetic, not an installed observation");
	const files = new Map(), put = (path, value) => files.set(path, Buffer.from(typeof value === "string" ? value : canonicalJson(value)));
	const config = canonicalJson({ schemaVersion: 1, modules: ["FinContainers"], targets: Object.fromEntries(profiles.map(profile => finContainerTargets[profile])) });
	const ir = finContainerEdgeReviewedIr(), model = { bindingIr: ir
		, bindingIrSha256: hashBindingIr(ir), component: ir.component
		, sourceIdentity: { exportConfigurationSource: config
			, exportConfigurationSha256: sha256(config), sourceTreeSha256: hash
			, modules: [{ module: "FinContainers", source: { path: "FinContainers.lean", bytes: Buffer.byteLength(source), sha256: sha256(source) } }] }
		, exports: Object.entries(finContainerEdgeRefinements).map(([name, refinements]) => ({ name, refinements })) };
	const packages = [...new Map(profiles.map(profile => {
		const [target, coordinate] = finContainerTargets[profile];
		return [target, { target, ...coordinate, role: "component", profile: "native-library-v1", runtimeIdentity: hash, artifacts: [{ path: `packages/${target}/synthetic.zip`, sha256: hash }] }];
	})).values()];
	const receipt = { schemaVersion: 1, kind: "lean-bridge-package-set-receipt"
		, component: model.component, packages, source: { treeSha256: hash }
		, profiles: [{ id: "native-library-v1", bindingIrSha256: model.bindingIrSha256, runtimeIdentity: hash }] };
	put("context.json", { roots: [0, 1].map(i => ({ author: `/synthetic/author-${i}`, consumer: `/synthetic/consumer-${i}` })) });
	for(const i of [0, 1])
	{
		put(`author-${i}/model.json`, model); put(`author-${i}/package-set-receipt.json`, receipt);
		put(`author-${i}/FinContainers.lean`, source); put(`author-${i}/lean-bridge.exports.json`, config);
	}
	const report = { schemaVersion: 1, kind: "fin-container-late-native-v1"
		, profiles, authorRoots: 2, reproducible: true
		, archives: Object.fromEntries(packages.flatMap(pkg => pkg.artifacts.map(a => [a.path, a.sha256])))
		, reports: [] };
	for(const profile of profiles)
	{
		const pkg = packages.find(item => item.target === finContainerTargets[profile][0]);
		const installed = { name: pkg.name, version: pkg.version
			, bindingIrSha256: model.bindingIrSha256
			, sourceIdentity: model.sourceIdentity
			, runtimeIdentity: hash, glibcMinimumVersion: "2.36"
			, files: { "synthetic.txt": { bytes: 0, sha256: sha256("") } } };
		if(["c", "cpp"].includes(profile))
		{
			delete installed.sourceIdentity;
			installed.kind = "lean-bridge-native-c-package"; installed.ecosystem = profile;
			installed.adapterReceiptSha256 = hash; installed.componentReceiptSha256 = hash;
			installed.files["share/lean-bridge/component/model.json"] = { bytes: files.get("author-0/model.json").length, sha256: sha256(files.get("author-0/model.json")) };
			for(const path of ["share/lean-bridge/native-c-adapter.json", "share/lean-bridge/component/native-component.json"])
				installed.files[path] = { bytes: 0, sha256: hash };
		}
		put(`${profile}.source`, await finLateConsumer(profile)); put(`${profile}.receipt.json`, installed);
		const item = { profile, path: "ordinary-source"
			, checks: finContainerEdgeChecks[profile] + finLateAdditionalChecks[profile]
			, consumerSha256: sha256(files.get(`${profile}.source`))
			, fixtureSha256: sha256(source)
			, modelSha256: sha256(files.get("author-0/model.json"))
			, receiptSha256: sha256(files.get("author-0/package-set-receipt.json"))
			, bindingIrSha256: model.bindingIrSha256, sourceTreeSha256: hash
			, refinements: structuredClone(finContainerEdgeRefinements)
			, offlineInstall: true, compilerFreePath: true
			, sourceRemovedBeforeInstallation: true, relocatedInstallation: true
			, repeatExecution: true, installedFilesUnchanged: true
			, lateInputs: { additionalChecks: finLateAdditionalChecks[profile], rejections: 1009, recoveries: 1009, snapshotMutationControls: 6, inputTreesCompared: ["arg0", "arg1"] }
			, dispatch: { observed: false, reason: "This supplement measures public behavior. Expanded source/adapter counters remain a separate required gate." }
			, packages: [pkg]
			, installedReceiptSha256: sha256(files.get(`${profile}.receipt.json`))
			, installedFilesSha256: sha256(canonicalJson(installed.files)) };
		item.result = { checks: item.checks };
		const receiptPath = ["c", "cpp"].includes(profile) ? "lean-bridge-package.json" : ["java", "kotlin"].includes(profile) ? "META-INF/lean-bridge/package-receipt.json" : "lean-bridge/package-receipt.json";
		let closure;
		if(profile === "python")
		{
			item.python = "3.11.9"; item.pythonBytecodePolicy = "isolated-empty-prefix";
			closure = { python: item.python, baselineSha256: hash, environmentSha256: hash, interpreterSha256: hash };
			item.pythonEnvironment = closure;
		}
		else
		{
			item.exactPackageFiles = true; item.packageFileSetSha256 = sha256(canonicalJson([...Object.keys(installed.files), receiptPath].sort()));
			closure = { receiptSha256: item.installedReceiptSha256, packageFileSetSha256: item.packageFileSetSha256 };
			const hosts = { ruby: ["rubyEnvironment", ["environmentSha256", "interpreterSha256", "gemspecSha256"]]
				, java: ["jvmEnvironment", ["classpathFilesSha256", "interpreterSha256"]]
				, kotlin: ["jvmEnvironment", ["classpathFilesSha256", "interpreterSha256"]]
				, dotnet: ["dotnetEnvironment", ["cacheFilesSha256", "buildInputsSha256", "deployedFilesSha256", "interpreterSha256"]]
				, "php-native": ["phpEnvironment", ["dependencyFilesSha256", "generatedFilesSha256", "vendorFilesSha256", "toolsSha256"]] };
			if(hosts[profile])
			{ const [key, fields] = hosts[profile]; Object.assign(closure, Object.fromEntries(fields.map(f => [f, hash]))); item[key] = closure; }
		}
		put(`${profile}.closure.json`, closure);
		for(const suffix of ["before.stdout", "relocated.stdout", ...(profile === "php-native" ? ["strict.stdout"] : [])]) put(`${profile}.${suffix}`, `fin-container-ok:${item.checks}\n`);
		if(["c", "cpp", "rust"].includes(profile)) item.executableSha256 = hash;
		if(["c", "cpp"].includes(profile)) item.runtimeSearchPath = `$ORIGIN/${pkg.name}-${pkg.version}-${profile}/lib`;
		if(["java", "kotlin", "dotnet", "php-native"].includes(profile)) item.deployedFiles = { "synthetic.txt": hash };
		if(profile === "php-native") item.repeatStrictExecution = true;
		report.reports.push(item);
	}
	report.recordFiles = Object.fromEntries([...files].map(([path, bytes]) => [path, { bytes: bytes.length, sha256: sha256(bytes) }]));
	return { report, profiles, files, options: { glibc: "2.36", python: "3.11", read: async path => { assert.ok(files.has(path)); return files.get(path); } } };
};

test("late-input checker binds all nine synthetic host formats without claiming execution", async () => {
	const { report, profiles, options, files } = await synthetic();
	assert.equal((await assertFinLateReport(report, profiles, options)).records, files.size);
	await assert.rejects(assertFinLateReport(report, profiles, { ...options, python: "3.12" }));
	await assert.rejects(assertFinLateReport(report, profiles, { ...options, glibc: "2.38" }));
	for(const path of files.keys())
	{
		await assert.rejects(assertFinLateReport(report, profiles, { ...options, read: async name => name === path ? Buffer.from("corrupt") : files.get(name) }), undefined, path);
	}
	for(const field of ["checks", "consumerSha256", "fixtureSha256", "sourceTreeSha256", "modelSha256", "bindingIrSha256", "receiptSha256", "offlineInstall", "compilerFreePath", "sourceRemovedBeforeInstallation", "relocatedInstallation", "repeatExecution", "installedFilesUnchanged"])
	{
		const altered = structuredClone(report); delete altered.reports[0][field];
		await assert.rejects(assertFinLateReport(altered, profiles, options), undefined, field);
	}
	for(const mutate of [r => { r.reports[0].lateInputs.inputTreesCompared.pop(); }
		, r => { r.reports[0].lateInputs.rejections--; }
		, r => { r.reports[0].lateInputs.snapshotMutationControls = 0; }
		, r => { r.reports[0].dispatch.observed = true; }
		, r => { r.reproducible = false; }, r => { r.authorRoots = 1; }
		, r => { r.reports.reverse(); }
		, r => { r.kind = "fin-container-edge-dispatch-v1"; }
		, r => { r.reports.find(i => i.profile === "php-native").repeatStrictExecution = false; }]) {
		const altered = structuredClone(report); mutate(altered); await assert.rejects(assertFinLateReport(altered, profiles, options));
		}
});

test("late-input TAP checker refuses wrong gates, skips, failures and ambiguous totals", () => {
	const tap = "TAP version 13\nok 1 - installed native packages preserve both complete late Fin inputs through rejection and relocated recovery\n1..1\n# tests 1\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n";
	assertFinLateTap(tap);
	for(const changed of [tap.replace("ok 1", "not ok 1")
		, tap.replace("# skipped 0", "# skipped 1")
		, tap.replace("# fail 0", "# fail 1")
		, tap.replace("native packages", "source-only fixtures")
		, tap + "# pass 1\n", tap.replace("recovery\n", "recovery # SKIP\n")])
		assert.throws(() => assertFinLateTap(changed));
});

test("late-input C-family checker requires the receipt-pinned original model and component metadata", async () => {
	const { report, profiles, options, files } = await synthetic();
	for(const profile of ["c", "cpp"])
		for(const mutate of [value => { delete value.files["share/lean-bridge/component/model.json"]; }
			, value => { value.files["share/lean-bridge/component/model.json"].sha256 = "0".repeat(64); }
			, value => { value.componentReceiptSha256 = "0".repeat(64); }
			, value => { value.adapterReceiptSha256 = "0".repeat(64); }
			, value => { value.sourceIdentity = {}; }]) {
			const name = `${profile}.receipt.json`, altered = structuredClone(report), receipt = JSON.parse(files.get(name));
			mutate(receipt);
			const bytes = Buffer.from(canonicalJson(receipt)), item = altered.reports.find(item => item.profile === profile);
			altered.recordFiles[name] = { bytes: bytes.length, sha256: sha256(bytes) };
			item.installedReceiptSha256 = sha256(bytes); item.installedFilesSha256 = sha256(canonicalJson(receipt.files));
			await assert.rejects(assertFinLateReport(altered, profiles, { ...options, read: async path => path === name ? bytes : files.get(path) }));
			}
});
