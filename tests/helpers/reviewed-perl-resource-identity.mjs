/**
 * Standalone (v3) identity resources: independently authored contracts, two
 * separately compiled CPAN components, one runtime and no consumer compiler.
 *
 * @file
 */
import assert from "node:assert/strict";
import { copyFile, cp, mkdir, mkdtemp, readFile, rename, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { reconcileReviewedSource, reviewedSourceSelection } from "../../src/analyze/reviewed-source.mjs";
import { buildNativeProject } from "../../src/build/native-project.mjs";
import { installCpanArchive } from "../../src/release/cpan-install.mjs";
import { verifyPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { perlConfigurations } from "../../scripts/test-perl-consumers.mjs";
import { corpusReviewedIr } from "./type-corpus-reviewed-ir.mjs";
import { addResourceCallables, resourceCallableArities } from "./standalone-resource-callables.mjs";
import { copyPackageSetHandoff } from "./package-set.mjs";
import { copiedCleanEnvironment, nativeFixtureEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

const counter = { record: "Workshop.Counter", fields: {} }, badge = { record: "Workshop.Badge", fields: {} };
const contract = module => {
	const signatures = module === "Other" ? [["same", [counter], counter], ["value", [counter], "uint32"]]
		: [["newCounter", ["uint32"], counter], ["sameCounter", [counter], counter], ["newBadge", ["uint32"], badge]];
	const ir = corpusReviewedIr({ id: module.toLowerCase() }, signatures.map(([name, parameters, result]) =>
		({ name: `${module}.${name}`, parameters, result })));
	ir.component.version = "0.1.0";
	ir.component.id = `${ir.component.name}@${ir.component.version}`;
	for(const type of ir.types) Object.assign(type, {
		kind: "resource", representation: "identity", mutability: "read"
		, resource: { kindId: `resource:${type.source.declaration}`, disposal: "required", fallback: "queued-finalizer", cycles: "explicit-cut" }
	});
	for(const declaration of ir.declarations)
	{
		for(const parameter of declaration.parameters) if(parameter.type.kind === "named")
			Object.assign(parameter, { ownership: "borrow", lifetime: { scope: "call", anchor: null } });
		if(declaration.result.type.kind === "named") Object.assign(declaration.result, {
			ownership: "lease", lifetime: { scope: "explicit", anchor: null }
		});
	}
	return module === "Workshop" ? addResourceCallables(ir) : ir;
};
const capture = ir => {
	const source = canonicalJson(ir);
	return { schemaVersion: 1, path: "api.binding-ir.json", source, sourceSha256: sha256(source), semanticSha256: hashBindingIr(ir) };
};
const native = { nativeResources: true };
const matrix = process.env.LEAN_BRIDGE_RESOURCE_MATRIX === "1";

const retainEvidence = async (source, destination) => {
	await mkdir(dirname(destination), { recursive: true });
	await mkdir(destination); // Reserve a new run; never replace a previous result.
	for(const entry of ["archives", "probes", "tap", "report.json"])
		await cp(join(source, entry), join(destination, entry), { recursive: true, errorOnExist: true, force: false });
};

test("standalone resource evidence fills a fresh directory and cannot overwrite a retained run", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-resource-retention-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const source = join(root, "source"), destination = join(root, "published", "run");
	for(const file of ["archives/original", "probes/consumer", "tap/abi/route/probe.tap", "report.json"])
		await saveLakeFile(source, file, file);
	await retainEvidence(source, destination);
	for(const file of ["archives/original", "probes/consumer", "tap/abi/route/probe.tap", "report.json"])
		assert.equal(await readFile(join(destination, file), "utf8"), file);
	await saveLakeFile(source, "report.json", "different run");
	await assert.rejects(retainEvidence(source, destination), { code: "EEXIST" });
	assert.equal(await readFile(join(destination, "report.json"), "utf8"), "report.json");
});

test("reviewed standalone resources bind the exact native selection and cannot be copied", () => {
	const ir = contract("Workshop"), review = capture(ir);
	const selection = reviewedSourceSelection(review, native);
	assert.deepEqual(selection.resources, ["Workshop.Badge", "Workshop.Counter"]);
	assert.throws(() => reviewedSourceSelection(review), { code: "reviewed-ir-build-unsupported" });
	const configuration = canonicalJson({ schemaVersion: 1, modules: ["Workshop"] });
	const identity = { exportConfigurationSource: configuration
		, exportConfigurationSha256: sha256(configuration)
		, request: { ...selection, exportModules: ["Workshop"], profile: "native-library-v1" } };
	for(const resources of [[], ["Workshop.Counter"], [...selection.resources, "Other.Counter"]])
		assert.throws(() => reconcileReviewedSource(review, ir, { ...identity, request: { ...identity.request, resources } })
			, { code: "reviewed-ir-source-mismatch" });
	const wrapResource = value => {
		const result = value.declarations[0].result;
		Object.assign(result, { type: { kind: "apply", constructor: "array", arguments: [result.type] }, ownership: "copy", lifetime: null });
	};
	for(const [code, mutate] of [
		["reviewed-ir-build-unsupported", value => { value.types[0].resource.kindId = "resource:Foreign.Counter"; }]
		, ["identity-ownership", value => { Object.assign(value.declarations[1].parameters[0], { ownership: "copy", lifetime: null }); }]
		, ["identity-ownership", value => { Object.assign(value.declarations[0].result, { ownership: "copy", lifetime: null }); }]
		, ["identity-ownership", wrapResource]
	]){
		const changed = structuredClone(ir); mutate(changed);
		assert.throws(() => reviewedSourceSelection(capture(changed), native), { code });
	}
});

test("installed reviewed CPAN packages share standalone resource identity across independent components", {
	skip: process.env.LEAN_BRIDGE_PERL_NATIVE_TEST !== "1"
	, timeout: matrix ? 1_800_000 : 900_000
}, async t => {
	const working = await mkdtemp(join(tmpdir(), "lean-bridge-reviewed-resources-"));
	t.after(() => rm(working, { recursive: true, force: true }));
	const interpreters = matrix ? perlConfigurations.map(configuration => ({
		...configuration, perl: resolve(process.env.LEAN_BRIDGE_RESOURCE_PERL_ROOT ?? ".toolchains/perl", configuration.label, "bin/perl")
	})) : [{ label: "selected", perl: process.env.LEAN_BRIDGE_TEST_PERL ?? "/usr/bin/perl" }];
	if(matrix) assert.deepEqual(interpreters.map(item => item.label).sort(), [
		"5.36.3-threaded", "5.36.3-unthreaded", "5.38.2-threaded", "5.38.2-unthreaded"
	], "the acceptance matrix must exercise all four pinned interpreters");
	const environment = { ...nativeFixtureEnvironment(["perl"]), LEAN_BRIDGE_PERLS: JSON.stringify(interpreters.map(item => item.perl)) };
	for(const interpreter of interpreters)
	{
		const config = await runCopied(interpreter.perl, ["-MConfig", "-e", 'printf "%vd %s %d", $^V, $Config{archname}, !!$Config{useithreads}'], working, copiedCleanEnvironment);
		const [version, archname, threaded] = config.stdout.trim().split(" ");
		if(matrix)
		{
			assert.equal(version, interpreter.version); assert.equal(threaded, interpreter.threaded ? "1" : "0");
		}
		interpreter.abi = { version, archname, threaded: threaded === "1" };
	}
	const archive = process.env.LEAN_BRIDGE_RECORD_RESOURCE_EVIDENCE === "1";
	const evidence = join(working, "evidence"), results = [], packages = [], retained = new Set();
	if(archive) await mkdir(join(evidence, "archives"), { recursive: true });
	const fixture = resolve("tests/fixtures/perl");
	const source = await readFile(join(fixture, "ordinary/Workshop.lean"), "utf8")
		+ "\n" + await readFile(join(fixture, "resource-callables.lean"), "utf8");
	const builds = [];
	for(const [module, route] of [["Workshop", "reviewed"], ["Other", "reviewed"], ["Workshop", "ordinary"]])
	{
		const producer = join(working, "producer"), project = join(producer, "project"), output = join(producer, "release");
		const handoff = join(working, `handoff-${module}-${route}`), ir = contract(module);
		await cp(join(fixture, module === "Other" ? "other" : "ordinary"), project, { recursive: true });
		await saveLakeFile(project, "Workshop.lean", source);
		await saveLakeFile(project, "lean-bridge.exports.json", canonicalJson({
			schemaVersion: 1
			, modules: [module]
			, targets: { cpan: { module: `LeanBridge::${module}`, version: "0.001" } }
			, ...(route === "ordinary" ? { exports: ir.declarations.map(item => item.source.declaration)
				, resources: ["Workshop.Badge", "Workshop.Counter"]
				, arities: resourceCallableArities } : {})
		}));
		if(route === "reviewed") await saveLakeFile(project, "api.binding-ir.json", canonicalJson(ir));
		const built = await buildNativeProject({ projectRoot: project, outputRoot: output, targets: ["cpan"], environment })
			.catch(error => { t.diagnostic(`${module} (${route}): ${JSON.stringify(error.details)}`); throw error; });
		assert.equal(built.reviewedBindingIrSha256, route === "reviewed" ? hashBindingIr(ir) : undefined);
		const receipt = await copyPackageSetHandoff(output, handoff);
		await rm(producer, { recursive: true });
		await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		if(archive)
		{
			for(const pkg of built.packages)
			{
				if(retained.has(pkg.sha256)) continue;
				retained.add(pkg.sha256);
				const retainedPath = join(evidence, "archives", `${pkg.sha256}.tar.gz`);
				await copyFile(join(handoff, "archives", pkg.archive), retainedPath);
				assert.equal(sha256(await readFile(retainedPath)), pkg.sha256);
			}
			const archives = built.packages.map(({ archive, sha256 }) => ({ archive, sha256 }));
			packages.push({ module, route, receipt, archives
				, bindingIrSha256: built.bindingIrSha256
				, reviewedBindingIrSha256: built.reviewedBindingIrSha256 ?? null });
		}
		builds.push({ route, handoff, built });
	}
	const [reviewed, peer, ordinary] = builds;
	const installTools = join(working, "install-tools");
	await mkdir(installTools);
	for(const name of ["make", "tar", "gzip", "sh", "cp", "mv", "rm", "chmod", "mkdir", "touch", "true"])
		await symlink(`/usr/bin/${name}`, join(installTools, name));
	const installEnvironment = { ...copiedCleanEnvironment, PATH: installTools };
	for(const { label, perl } of interpreters) for(const subject of [reviewed, ordinary])
	{
		const consumer = join(working, label, subject.route), prefix = join(consumer, "prefix");
		assert.equal(subject.built.packages[0].sha256, peer.built.packages[0].sha256, "independent builds share one exact runtime");
		assert.notEqual(subject.built.packages[1].sha256, peer.built.packages[1].sha256);
		for(const [index, { handoff, built }] of [subject, peer].entries())
			for(const pkg of built.packages.slice(index === 0 ? 0 : 1))
				await installCpanArchive({ archive: join(handoff, "archives", pkg.archive)
					, workingRoot: consumer
					, prefix, perl, mode: "prebuilt-only", environment: installEnvironment });
		await rename(prefix, join(consumer, "relocated"));
	}
	for(const { handoff } of builds) await rm(handoff, { recursive: true });
	for(const { label, perl, abi } of interpreters) for(const subject of [reviewed, ordinary])
	{
		const consumer = join(working, label, subject.route);
		for(const [probeName, checks] of [["reviewed-resources.t", 12], ["resource-callables.t", 23], ["resource-borrows.t", 15]])
		{
			await copyFile(join(fixture, probeName), join(consumer, "consumer.t"));
			const probe = await runCopied(perl, ["consumer.t"], consumer, { ...copiedCleanEnvironment, PERL5LIB: join(consumer, "relocated/lib/perl5") });
			assert.equal(probe.stderr, "");
			assert.doesNotMatch(probe.stdout, /^not ok|#\s*(?:skip|todo)\b/imu);
			assert.equal(probe.stdout.trimEnd().split("\n").at(-1), `1..${checks}`, probe.stdout);
			assert.deepEqual([...probe.stdout.matchAll(/^ok (\d+)\b/gmu)].map(item => Number(item[1])), Array.from({ length: checks }, (_, i) => i + 1));
			if(archive)
			{
				const tap = `tap/${label}/${subject.route}/${probeName}.tap`;
				const bytes = await readFile(join(consumer, "consumer.t"));
				await saveLakeFile(evidence, `probes/${probeName}`, bytes);
				await saveLakeFile(evidence, tap, probe.stdout);
				results.push({ abi, route: subject.route, probe: probeName
					, probeSha256: sha256(bytes)
					, checks, tap, tapSha256: sha256(probe.stdout) });
			}
		}
		t.diagnostic(`${abi.version} ${abi.archname} ${subject.route}: 50 installed checks; archives ${subject.built.packages.map(pkg => pkg.sha256).join(", ")}; peer ${peer.built.packages[1].sha256}`);
	}
	if(archive)
	{
		const checks = results.reduce((sum, result) => sum + result.checks, 0);
		assert.equal(new Set(results.map(result => result.tap)).size, matrix ? 24 : 6);
		assert.equal(checks, matrix ? 400 : 100);
		assert.equal(retained.size, 4, "expect one runtime and three independently built components");
		const sources = { Workshop: sha256(source), Other: sha256(await readFile(join(fixture, "other/Other.lean"))) };
		await saveLakeFile(evidence, "report.json", canonicalJson({ schemaVersion: 1
			, family: "standalone-resource-callbacks"
			, commit: process.env.GITHUB_SHA ?? null
			, checks, sources, packages, results }));
		await retainEvidence(evidence, resolve("build/standalone-resource-acceptance"));
	}
});
