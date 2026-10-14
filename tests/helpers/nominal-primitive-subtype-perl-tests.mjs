/**
 * Independent primitive-base Perl caller controls and source checks, not installed acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { gunzipSync, gzipSync } from "node:zlib";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { createDeterministicTarGzFromFiles } from "../../src/release/deterministic-archive.mjs";
import { generatePerlBindingPackage } from "../../src/backends/perl/generate.mjs";
import { readClosedPackageTarGz } from "./closed-package-tar.mjs";
import { applyNominalPrimitiveSubtypePerlModelMutation, applyNominalPrimitiveSubtypePerlPackageMutation, nominalPrimitiveSubtypePerlControlPositions, nominalPrimitiveSubtypePerlHandoffMutations, nominalPrimitiveSubtypePerlModelMutations, nominalPrimitiveSubtypePerlPackageMutations } from "./nominal-primitive-subtype-perl-controls.mjs";
import { projectPerlNames } from "../../src/backends/perl/naming.mjs";
import { validateExportConfiguration } from "../../src/analyze/export-configuration.mjs";
import { nominalPrimitiveSubtypeConfiguration, nominalPrimitiveSubtypeFields } from "./nominal-primitive-subtype-fixture.mjs";
import { nominalPrimitiveSubtypePerlModule, nominalPrimitiveSubtypePerlRoutes, nominalPrimitiveSubtypePerlModes, nominalPrimitiveSubtypePerlConfiguration, nominalPrimitiveSubtypePerlCaller, nominalPrimitiveSubtypePerlArguments, nominalPrimitiveSubtypePerlCounts, nominalPrimitiveSubtypePerlSelection, nominalPrimitiveSubtypePerlExecutables, parseNominalPrimitiveSubtypePerlResult } from "./nominal-primitive-subtype-perl-fixture.mjs";
import { checkedRecordPerlConfigurations, probeCheckedRecordPerl } from "./checked-record-perl-install.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { runCopied } from "./copied-fixture-install.mjs";

test("primitive-base Perl configurations preserve both source routes and constructor-free result exports", async () => {
	for(const route of nominalPrimitiveSubtypePerlRoutes) for(const mode of nominalPrimitiveSubtypePerlModes)
	{
		const actual = nominalPrimitiveSubtypePerlConfiguration(route, mode);
		const expected = nominalPrimitiveSubtypeConfiguration(route, ["c"], mode === "result-only");
		validateExportConfiguration(actual);
		assert.deepEqual({ ...actual, targets: expected.targets }, expected);
		assert.deepEqual(actual.targets, { cpan: { module: nominalPrimitiveSubtypePerlModule, version: "1.000" } });
		if(mode === "result-only") assert.equal(actual.contracts, undefined);
		assert.deepEqual(nominalPrimitiveSubtypePerlArguments(route, mode), ["consumer.pl", ...mode === "result-only" ? ["--result-only"] : [], ...route === "reviewed" ? ["--reviewed"] : []]);
	}
	assert.equal(await nominalPrimitiveSubtypePerlCaller("reviewed"), await nominalPrimitiveSubtypePerlCaller("ordinary"));
	assert.throws(() => nominalPrimitiveSubtypePerlConfiguration("unknown", "full"));
	assert.throws(() => nominalPrimitiveSubtypePerlConfiguration("ordinary", "unknown"));
	assert.throws(() => nominalPrimitiveSubtypePerlArguments("unknown", "full"));
	assert.throws(() => nominalPrimitiveSubtypePerlArguments("ordinary", "unknown"));
	await assert.rejects(nominalPrimitiveSubtypePerlCaller("unknown"));
	for(const mode of nominalPrimitiveSubtypePerlModes)
	{
		const counts = nominalPrimitiveSubtypePerlCounts[mode];
		assert.deepEqual(parseNominalPrimitiveSubtypePerlResult(JSON.stringify(counts), mode), counts);
		for(const key of Object.keys(counts))
			assert.throws(() => parseNominalPrimitiveSubtypePerlResult(JSON.stringify({ ...counts, [key]: counts[key] + 1 }), mode));
		assert.throws(() => parseNominalPrimitiveSubtypePerlResult(JSON.stringify({ ...counts, extra: 1 }), mode));
	}
	assert.throws(() => parseNominalPrimitiveSubtypePerlResult("{}", "unknown"));
});

test("primitive-base Perl gates reject disabled selections, non-string values and partial ABI matrices", () => {
	const prefix = "LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_PERL_", enabled = { [prefix + "TEST"]: "1" };
	assert.deepEqual(nominalPrimitiveSubtypePerlSelection({}), { enabled: false, routes: ["ordinary", "reviewed"], modes: ["full", "result-only"] });
	assert.equal(nominalPrimitiveSubtypePerlSelection(enabled).enabled, true);
	for(const flag of ["", "true", "yes", "2", true, null])
		assert.throws(() => nominalPrimitiveSubtypePerlSelection({ [prefix + "TEST"]: flag }));
	for(const [name, valid] of [["ROUTES", "ordinary"], ["MODES", "full"]])
	{
		for(const raw of ["", "unknown", `${valid},`, `${valid},${valid}`, true, null])
			assert.throws(() => nominalPrimitiveSubtypePerlSelection({ ...enabled, [prefix + name]: raw }));
		for(const flag of [undefined, "0"])
			assert.throws(() => nominalPrimitiveSubtypePerlSelection({ [prefix + "TEST"]: flag, [prefix + name]: valid }));
		assert.deepEqual(nominalPrimitiveSubtypePerlSelection({ ...enabled, [prefix + name]: valid })[name.toLowerCase()], [valid]);
	}
	for(const name of [prefix + "OUTPUT", "LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_PERLS"])
		for(const flag of [undefined, "0"])
			assert.throws(() => nominalPrimitiveSubtypePerlSelection({ [prefix + "TEST"]: flag, [name]: "explicit" }));
	const commands = Object.fromEntries(checkedRecordPerlConfigurations.map(name => [name, `/toolchains/perl/${name}/bin/perl`]));
	assert.deepEqual(nominalPrimitiveSubtypePerlExecutables(JSON.stringify(commands)), commands);
	assert.deepEqual(Object.keys(nominalPrimitiveSubtypePerlExecutables(undefined)).sort(), [...checkedRecordPerlConfigurations].sort());
	for(const raw of ["", "null", "[]", "{}"
		, JSON.stringify(Object.fromEntries(Object.entries(commands).slice(0, 3)))
		, JSON.stringify({ ...commands, "5.40.0-threaded": "/toolchains/perl/5.40.0-threaded/bin/perl" })
		, JSON.stringify({ ...commands, "5.38.2-unthreaded": commands["5.38.2-threaded"] })
		, JSON.stringify({ ...commands, "5.36.3-threaded": "perl" })])
		assert.throws(() => nominalPrimitiveSubtypePerlExecutables(raw));
});

const executables = nominalPrimitiveSubtypePerlExecutables(process.env.LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_PERLS);
const rejectedMutations = [...nominalPrimitiveSubtypeFields.map(field => field.name)
	, "digit", "wrong-word-width", "normalization-bypass"
	, "unit-refusal-bypass", "inactive-branch-added"];
for(const configuration of checkedRecordPerlConfigurations)
	test(`primitive-base Perl caller detects twenty field mutations and four semantic mutations on ${configuration}`, {
		skip: !process.env.LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_PERLS && !existsSync(executables[configuration])
			&& "Select LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_PERLS to execute caller controls"
	}, async t => {
		const root = await mkdtemp(join(tmpdir(), "lean-bridge-nominal-primitive-perl-controls-"));
		t.after(() => rm(root, { recursive: true }));
		await probeCheckedRecordPerl(configuration, executables[configuration], root);
		const caller = await nominalPrimitiveSubtypePerlCaller("ordinary"), path = join(root, "consumer.pl");
		await saveLakeFile(root, "consumer.pl", caller);
		const run = await runCopied(executables[configuration], [resolve("tests/helpers/nominal-primitive-subtype-perl-model.pl"), path], root);
		assert.equal(run.stderr, ""); const result = JSON.parse(run.stdout);
		assert.equal(result.installedAcceptance, false); assert.equal(result.diagnosticControls, 12);
		assert.deepEqual(result.results, nominalPrimitiveSubtypePerlModes.flatMap(mode => ["arg", "value"].map(parameterPrefix => ({
			resultOnly: mode === "result-only", parameterPrefix
			, ...nominalPrimitiveSubtypePerlCounts[mode] }))));
		assert.deepEqual(result.rejectedMutations, rejectedMutations);
		assert.equal(await readFile(path, "utf8"), caller);
		t.diagnostic("An explicit runtime double exercises the caller; no installed Lean library executes.");
	});

test("primitive-base Perl source preserves per-site constructors, Fin priority and constructor-free result projections", async () => {
	// Authenticate existing Lean models for source generation only. No Perl package was installed here.
	const root = "docs/evidence/nominal-primitive-subtype-python-20261014";
	const indexBytes = await readFile(`${root}/index.json`);
	assert.equal(sha256(indexBytes), "6ca71a8845f0025aad297334f8c72dd4e6b90228697e02bde65c84b2ff36aa7b");
	const index = JSON.parse(indexBytes), moduleName = nominalPrimitiveSubtypePerlModule;
	for(const route of nominalPrimitiveSubtypePerlRoutes) for(const mode of nominalPrimitiveSubtypePerlModes)
	{
		const path = `${route}/${mode}/records/build-0/model.json`, entry = index.files.find(item => item.path === path);
		const bytes = await readFile(`${root}/${path}`);
		assert.equal(bytes.length, entry.bytes); assert.equal(sha256(bytes), entry.sha256);
		const native = JSON.parse(bytes), model = { ...native, moduleName, exports: projectPerlNames(moduleName, native.exports) };
		const before = structuredClone(model), files = generatePerlBindingPackage(model, {
			library: "libcomponent_test.so", nativeLibrary: { sha256: "b".repeat(64) }
			, runtimeIdentity: "c".repeat(64)
			, initializer: "initialize_NominalPrimitiveSubtypes"
		});
		assert.deepEqual(model, before);
		const xs = files["Component.xs"], pm = files["lib/LeanBridge/NominalPrimitiveSubtypes.pm"];
		const body = name => {
			const start = xs.indexOf(`\n${name}(...)\n`); assert.ok(start > 0, name);
			const end = xs.indexOf("\nvoid\n", start + 1);
			return xs.slice(start, end < 0 ? undefined : end);
		};
		for(const item of model.exports)
		{
			const source = body(item.publicName), parameters = item.refinements?.parameters ?? [];
			if(mode === "full" && parameters.some(tree => JSON.stringify(tree).includes('"subtype"')))
			{
				const validator = source.indexOf(`${item.symbol}_refinement_`);
				assert.ok(validator > 0 && validator < source.indexOf(`lean_object *checked = ${item.symbol}(`), item.publicName);
			}
			else assert.doesNotMatch(source, /_refinement_/u);
		}
		for(const name of ["Some", "Ok", "Err", "Packet", "RawPacket", "Pair", "Event", "Event::Empty", "Event::Box", "Event::Choices"])
			assert.ok(pm.includes(`package ${moduleName}::${name};`), name);
		if(mode === "result-only")
		{
			assert.equal(model.exports.length, 6);
			assert.doesNotMatch(xs, /was rejected by NominalPrimitiveSubtypes\.|\necho_a\(\.\.\.\)|\nrefuse_unit\(\.\.\.\)/u);
			continue;
		}
		assert.equal(model.exports.length, 14);
		for(const name of ["combine", "aliases", "echo_pair", "echo_event_a", "echo_event_b"])
			assert.ok(body(name).indexOf("is not below its Fin 3 bound") < body(name).indexOf("was rejected by NominalPrimitiveSubtypes."), name);
		for(const field of nominalPrimitiveSubtypeFields)
		{
			assert.ok(body("echo_a").includes(`%s.${field.name} was rejected by NominalPrimitiveSubtypes.${field.constructor}A`), field.name);
			assert.ok(body("echo_b").includes(`%s.${field.name} was rejected by NominalPrimitiveSubtypes.${field.constructor}B`), field.name);
			assert.ok(!body("echo_a").includes(`NominalPrimitiveSubtypes.${field.constructor}B`), field.name);
			assert.ok(!body("echo_b").includes(`NominalPrimitiveSubtypes.${field.constructor}A`), field.name);
		}
		assert.ok(body("refuse_unit").includes("%s.unitValue was rejected by NominalPrimitiveSubtypes.unitReject"));
		assert.ok(!body("refuse_unit").includes("NominalPrimitiveSubtypes.unitA"));
		assert.ok(body("combine").includes("%s.natValue was rejected by NominalPrimitiveSubtypes.natA"));
		assert.ok(body("combine").includes("%s.natValue was rejected by NominalPrimitiveSubtypes.natB"));
		assert.ok(body("echo_pair").includes("%s.left[%zu]?.natValue was rejected by NominalPrimitiveSubtypes.natA"));
		assert.ok(body("echo_pair").includes("%s.right[%zu]?.natValue was rejected by NominalPrimitiveSubtypes.natB"));
		assert.ok(body("aliases").includes("%s[%zu]?.natValue was rejected by NominalPrimitiveSubtypes.natA"));
		assert.ok(body("aliases").includes("%s[%zu]?.natValue was rejected by NominalPrimitiveSubtypes.natB"));
		assert.ok(body("echo_event_a").includes("%s.box.value.natValue was rejected by NominalPrimitiveSubtypes.natA"));
		assert.ok(body("echo_event_a").includes("%s.choices.values[%zu]?.ok.natValue was rejected by NominalPrimitiveSubtypes.natA"));
		assert.ok(body("echo_event_a").includes("%s.choices.values[%zu]?.error.natValue was rejected by NominalPrimitiveSubtypes.natB"));
		assert.ok(body("echo_event_b").includes("%s.box.value.natValue was rejected by NominalPrimitiveSubtypes.natB"));
		assert.ok(body("echo_event_b").includes("%s.choices.values[%zu]?.ok.natValue was rejected by NominalPrimitiveSubtypes.natB"));
		assert.ok(body("echo_event_b").includes("%s.choices.values[%zu]?.error.natValue was rejected by NominalPrimitiveSubtypes.natA"));
		assert.ok(body("echo_event_a").includes("%s.box.value.digit is not below its Fin 3 bound"));
		assert.ok(body("echo_event_a").includes("%s.choices.values[%zu]?.error.digit is not below its Fin 3 bound"));
	}
});

test("primitive-base Perl controls change their targets before any installed record exists", async t => {
	// The retained #1444 install records share the manifest, receipt, trace and installed-file shapes.
	const root = "docs/evidence/nominal-subtype-perl-20261012/ordinary-full/records", originals = new Map();
	const load = async path => { originals.set(path, await readFile(`${root}/${path}`)); };
	await load("report.json");
	const report = JSON.parse(originals.get("report.json")), floor = report.declaredGlibcFloor;
	assert.equal(floor, "2.36");
	let packageMutations = 0;
	for(const position of nominalPrimitiveSubtypePerlControlPositions)
	{
		const item = report.reports[position], prefix = `${item.configuration}/${item.delivery}/`;
		await load(prefix + "installed-files.json"); await load(prefix + "report.json");
		for(const role of ["runtime", "component"]) for(const name of ["manifest.json", "install-receipt.json", "trace.json", "source.xs", "public.pm"])
			await load(prefix + `${role}-${name}`);
		for(const role of ["runtime", "component"])
		{
			const mutations = nominalPrimitiveSubtypePerlPackageMutations(item.delivery, floor);
			assert.equal(mutations.length, item.delivery === "build-xs" ? 13 : 11);
			assert.equal(mutations[0][0], "wrong glibc floor");
			for(const [label, mutate] of mutations)
			{
				const altered = applyNominalPrimitiveSubtypePerlPackageMutation(originals, prefix, role, position, mutate);
				assert.ok([...altered].some(([path, bytes]) => !bytes.equals(originals.get(path))), label);
				if(label === "wrong glibc floor") assert.equal(JSON.parse(altered.get(prefix + `${role}-manifest.json`)).glibcMinimumVersion, "2.37");
				packageMutations++;
			}
			// A mutation that changes nothing, and a floor control bound to another floor, are refused outright.
			assert.throws(() => applyNominalPrimitiveSubtypePerlPackageMutation(originals, prefix, role, position, () => {}), /must change/u);
			assert.throws(() => applyNominalPrimitiveSubtypePerlPackageMutation(originals, prefix, role, position, nominalPrimitiveSubtypePerlPackageMutations(item.delivery, "2.38")[0][1]), /selected floor/u);
			assert.throws(() => applyNominalPrimitiveSubtypePerlPackageMutation(originals, prefix, role, position, context => { context.manifest.glibcMinimumVersion = floor; }), /must change/u);
		}
	}
	assert.equal(packageMutations, 48);
	// Compiler-decision mutations on the four retained nineteen-base native models.
	const archive = "docs/evidence/nominal-primitive-subtype-python-20261014";
	let modelMutations = 0;
	for(const route of nominalPrimitiveSubtypePerlRoutes) for(const mode of nominalPrimitiveSubtypePerlModes)
	{
		const native = JSON.parse(await readFile(`${archive}/${route}/${mode}/records/build-0/model.json`));
		const model = { ...native, moduleName: nominalPrimitiveSubtypePerlModule };
		const mutations = nominalPrimitiveSubtypePerlModelMutations(mode);
		assert.equal(mutations.length, mode === "full" ? 43 : 24);
		for(const [label, mutate] of mutations)
		{
			const mutated = applyNominalPrimitiveSubtypePerlModelMutation(model, mutate);
			assert.notEqual(canonicalJson(mutated), canonicalJson(model), label); modelMutations++;
		}
		assert.throws(() => applyNominalPrimitiveSubtypePerlModelMutation(model, () => {}), /must change/u);
		assert.throws(() => applyNominalPrimitiveSubtypePerlModelMutation(model, value => { value.pointerBits = 64; }), /must change/u);
	}
	assert.equal(modelMutations, 134);
	// Archive mutations prove their byte changes even on synthetic records.
	const receipt = { packages: [{ role: "runtime", artifacts: [{ path: "archives/runtime.tar.gz" }] }, { role: "component", artifacts: [{ path: "archives/component.tar.gz" }] }] };
	const handoff = new Map([
		["handoff/package-set-receipt.json", Buffer.from("{}")]
		, ["handoff/package-set-receipt.json.sha256", Buffer.from("digest  package-set-receipt.json\n")]
		, ["handoff/archives/runtime.tar.gz", Buffer.from("runtime bytes")]
		, ["handoff/archives/component.tar.gz", Buffer.from("component bytes")]]);
	assert.equal(nominalPrimitiveSubtypePerlHandoffMutations(receipt, handoff).length, 4);
	assert.throws(() => nominalPrimitiveSubtypePerlHandoffMutations(receipt, new Map([...handoff, ["handoff/archives/component.tar.gz", Buffer.from("runtime bytes")]])), /must change/u);
	assert.throws(() => nominalPrimitiveSubtypePerlHandoffMutations(receipt, new Map([...handoff].filter(([path]) => !path.endsWith(".sha256")))), /missing original/u);
	t.diagnostic(`${packageMutations} package, ${modelMutations} model and 4 archive mutations change their targets; no installed record was used.`);
});

// A hand-built ustar header for negative controls the deterministic writer refuses to produce.
const tarHeader = ({ name, prefix = "", size = 0, mode = 0o644, epoch = 1, type = "0", link = "", uid = 0, checksum }) => {
	const header = Buffer.alloc(512), text = (offset, value) => Buffer.from(value, "utf8").copy(header, offset);
	const octal = (value, width) => `${value.toString(8).padStart(width - 1, "0")}\0`;
	text(0, name); text(100, octal(mode, 8)); text(108, octal(uid, 8)); text(116, octal(0, 8));
	text(124, octal(size, 12)); text(136, octal(epoch, 12)); header.fill(0x20, 148, 156);
	text(156, type); text(157, link); text(257, "ustar\0"); text(263, "00"); text(345, prefix);
	const sum = checksum ?? header.reduce((total, byte) => total + byte, 0);
	text(148, `${sum.toString(8).padStart(6, "0")}\0 `);
	return header;
};
const tarEntry = (fields, bytes = Buffer.alloc(0)) => Buffer.concat([tarHeader({ ...fields, size: bytes.length }), bytes, Buffer.alloc((512 - bytes.length % 512) % 512)]);
const tarGz = (...entries) => gzipSync(Buffer.concat([...entries, Buffer.alloc(1024)]), { level: 9, mtime: 0 });
const gunzip = bytes => gunzipSync(bytes);

test("the closed tar reader accepts the deterministic CPAN format and refuses every unsafe or malformed member", async t => {
	const files = [
		{ path: "dist-1.0/lean-bridge-package.json", bytes: Buffer.from('{"files":{}}'), mode: 0o644 }
		, { path: "dist-1.0/lib/LeanBridge/Deep.pm", bytes: Buffer.from("1;\n"), mode: 0o644 }
		, { path: `dist-1.0/${"long-directory-name-".repeat(6)}/${"n".repeat(60)}.so`, bytes: Buffer.alloc(700, 7), mode: 0o755 }
		, { path: "dist-1.0/t/00-load.t", bytes: Buffer.alloc(512, 1), mode: 0o644 }
	];
	const archive = createDeterministicTarGzFromFiles({ files, sourceDateEpoch: 1 });
	const members = readClosedPackageTarGz(archive, { root: "dist-1.0" });
	assert.deepEqual([...members.keys()].sort(), files.map(file => file.path.slice("dist-1.0/".length)).sort());
	for(const file of files) assert.deepEqual(members.get(file.path.slice("dist-1.0/".length)), file.bytes);
	assert.deepEqual(readClosedPackageTarGz(archive, { root: "dist-1.0", maxBytes: 8192, maxMembers: 4 }), members);
	const payload = Buffer.from("payload");
	const rejected = [
		["wrong root", () => readClosedPackageTarGz(archive, { root: "other-1.0" })]
		, ["expansion limit", () => readClosedPackageTarGz(archive, { root: "dist-1.0", maxBytes: 2048 })]
		, ["member limit", () => readClosedPackageTarGz(archive, { root: "dist-1.0", maxMembers: 3 })]
		, ["input limit", () => readClosedPackageTarGz(archive, { root: "dist-1.0", maxInput: archive.length - 1 })]
		, ["changed epoch", () => readClosedPackageTarGz(archive, { root: "dist-1.0", epoch: 2 })]
		, ["unsafe root", () => readClosedPackageTarGz(archive, { root: "../dist-1.0" })]
		, ["trailing gzip data", () => readClosedPackageTarGz(Buffer.concat([archive, Buffer.from("trailing")]), { root: "dist-1.0" })]
		, ["truncated archive", () => readClosedPackageTarGz(gzipSync(gunzip(archive).subarray(0, -512)), { root: "dist-1.0" })]
		, ["missing end blocks", () => readClosedPackageTarGz(gzipSync(gunzip(archive).subarray(0, -1024)), { root: "dist-1.0" })]
		, ["trailing archive data", () => readClosedPackageTarGz(gzipSync(Buffer.concat([gunzip(archive), Buffer.alloc(512)])), { root: "dist-1.0" })]
		, ["nonzero padding", () => readClosedPackageTarGz(tarGz(Buffer.concat([tarHeader({ name: "dist-1.0/a", size: 7 }), payload, Buffer.alloc(505, 1)])), { root: "dist-1.0" })]
		, ["empty archive", () => readClosedPackageTarGz(tarGz(), { root: "dist-1.0" })]
		, ["traversal", () => readClosedPackageTarGz(tarGz(tarEntry({ name: "dist-1.0/../escape" }, payload)), { root: "dist-1.0" })]
		, ["dot segment", () => readClosedPackageTarGz(tarGz(tarEntry({ name: "dist-1.0/./a" }, payload)), { root: "dist-1.0" })]
		, ["absolute path", () => readClosedPackageTarGz(tarGz(tarEntry({ name: "/dist-1.0/a" }, payload)), { root: "dist-1.0" })]
		, ["prefix traversal", () => readClosedPackageTarGz(tarGz(tarEntry({ name: "a", prefix: "dist-1.0/.." }, payload)), { root: "dist-1.0" })]
		, ["root entry only", () => readClosedPackageTarGz(tarGz(tarEntry({ name: "dist-1.0" }, payload)), { root: "dist-1.0" })]
		, ["second root", () => readClosedPackageTarGz(tarGz(tarEntry({ name: "dist-1.0/a" }, payload), tarEntry({ name: "other/b" }, payload)), { root: "dist-1.0" })]
		, ["symlink", () => readClosedPackageTarGz(tarGz(tarEntry({ name: "dist-1.0/a", type: "2", link: "/etc/passwd" })), { root: "dist-1.0" })]
		, ["hard link", () => readClosedPackageTarGz(tarGz(tarEntry({ name: "dist-1.0/a", type: "1", link: "dist-1.0/b" })), { root: "dist-1.0" })]
		, ["directory", () => readClosedPackageTarGz(tarGz(tarEntry({ name: "dist-1.0/d/", type: "5" })), { root: "dist-1.0" })]
		, ["fifo", () => readClosedPackageTarGz(tarGz(tarEntry({ name: "dist-1.0/p", type: "6" })), { root: "dist-1.0" })]
		, ["character device", () => readClosedPackageTarGz(tarGz(tarEntry({ name: "dist-1.0/c", type: "3" })), { root: "dist-1.0" })]
		, ["GNU long name", () => readClosedPackageTarGz(tarGz(tarEntry({ name: "././@LongLink", type: "L" }, Buffer.from("dist-1.0/x\0"))), { root: "dist-1.0" })]
		, ["pax header", () => readClosedPackageTarGz(tarGz(tarEntry({ name: "dist-1.0/a", type: "x" }, payload)), { root: "dist-1.0" })]
		, ["duplicate", () => readClosedPackageTarGz(tarGz(tarEntry({ name: "dist-1.0/a" }, payload), tarEntry({ name: "dist-1.0/a" }, payload)), { root: "dist-1.0" })]
		, ["file and directory conflict", () => readClosedPackageTarGz(tarGz(tarEntry({ name: "dist-1.0/a" }, payload), tarEntry({ name: "dist-1.0/a/b" }, payload)), { root: "dist-1.0" })]
		, ["unsafe name byte", () => readClosedPackageTarGz(tarGz(tarEntry({ name: "dist-1.0/a b" }, payload)), { root: "dist-1.0" })]
		, ["bad checksum", () => readClosedPackageTarGz(tarGz(tarEntry({ name: "dist-1.0/a", checksum: 1 }, payload)), { root: "dist-1.0" })]
		, ["wrong mode", () => readClosedPackageTarGz(tarGz(tarEntry({ name: "dist-1.0/a", mode: 0o777 }, payload)), { root: "dist-1.0" })]
		, ["non-root owner", () => readClosedPackageTarGz(tarGz(tarEntry({ name: "dist-1.0/a", uid: 1000 }, payload)), { root: "dist-1.0" })]
		, ["changed timestamp", () => readClosedPackageTarGz(tarGz(tarEntry({ name: "dist-1.0/a", epoch: 2 }, payload)), { root: "dist-1.0" })]
		, ["oversized declared size", () => readClosedPackageTarGz(tarGz(tarHeader({ name: "dist-1.0/a", size: 4096 }), payload, Buffer.alloc(505)), { root: "dist-1.0" })]
		, ["not gzip", () => readClosedPackageTarGz(Buffer.concat([tarEntry({ name: "dist-1.0/a" }, payload), Buffer.alloc(1024)]), { root: "dist-1.0" })]
	];
	for(const [label, attempt] of rejected) assert.throws(attempt, undefined, label);
	t.diagnostic(`${rejected.length} malformed or unsafe archives refused before any member byte is returned`);
});
