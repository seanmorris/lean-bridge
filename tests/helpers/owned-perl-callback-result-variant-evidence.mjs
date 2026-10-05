/**
 * Independently reconstruct optional-capability CPAN reports. Recorded process
 * output is evidence, not a substitute for an authenticated execution receipt.
 *
 * @file
 */
import assert from "node:assert/strict";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { readFile } from "node:fs/promises";
import { basename, isAbsolute, join } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { createCompiledNativeModel } from "../../src/build/native-graph-model.mjs";
import { ownedDotnetCallbackResultConfiguration, ownedDotnetCallbackResultReviewedIr
	, ownedDotnetCallbackResultSource } from "./owned-dotnet-callback-result-fixture.mjs";
import { ownedPerlReceiverVariant, ownedPerlReceiverVariants } from "./owned-perl-receiver-evidence.mjs";
import { assertOwnedPerlCallbackPackageArtifacts, assertOwnedPerlCallbackPackageIdentity
	, ownedPerlCallbackPackageAbi, ownedPerlCallbackCliResponse
	, assertOwnedPerlCallbackCompileReceipt } from "./owned-perl-callback-result-package-evidence.mjs";

const keys = (value, names) => assert.deepEqual(Object.keys(value).sort(), names.split(" ").sort());
const hash = value => sha256(canonicalJson(value));
const compact = value => JSON.stringify(JSON.parse(canonicalJson(value)));
const identity = value => ({ bytes: Buffer.byteLength(value), sha256: sha256(value) });
const roles = ["runtime", "component"];
const consumerPath = "tests/fixtures/structured-types/owned-perl-callback-results-variants-installed.pl";
const driverPath = "tests/helpers/owned-perl-callback-result-variant-producer.mjs";
export const ownedPerlCallbackVariantReports = Object.freeze(["ordinary", "reviewed"]
	.flatMap(mode => ["no-host", "host"].map(variant => `${mode}-${variant}-package.json`)));
const pins = {
	ordinary: { metadata: "1ea0533885d0a2ef790dc6cf84615f0d02bfa9235440f1306f6a89a0a12c1e9e"
		, identity: "560f9049a312254726b0b33c82287ebf36b6f1e3da014431834bddd7f1ce6b4a" }
	, reviewed: { metadata: "df4862e16d7c77318be1928c3634adea5f5214f43126626ddfa0590321f9f8d7"
		, identity: "eff54940b3786446bc48cd6c0d60f12e7e6793e8383405579a42bad9cc4c4823" }
};
const capabilities = host => ({ ownedGraphs: true, ownedHostCallbacks: host
	, ownedInputTransfers: false, ownedAnchoredResults: false
	, ownedReceiverExports: false, ownedCallbackResultAnchors: true });
const absolute = path => {
	assert.equal(typeof path, "string"); assert.ok(isAbsolute(path));
	assert.ok(!path.includes("\0") && !path.split("/").some(part => part === "." || part === ".."));
};
const fileIdentity = value => {
	keys(value, "bytes sha256"); assert.ok(Number.isSafeInteger(value.bytes) && value.bytes > 0);
	assert.match(value.sha256, /^[a-f0-9]{64}$/u);
};
const raw = (execution, command, args, cwd, stdout) => {
	keys(execution, "args code command cwd signal spawnError stderr stdout timedOut");
	assert.deepEqual({ ...execution, stdout: null }, {
		command, args, cwd, code: 0, signal: null, spawnError: null
		, timedOut: false, stderr: "", stdout: null });
	assert.equal(typeof execution.stdout, "string");
	assert.doesNotMatch(execution.stdout, /segmentation fault|core dumped|double free|unreleased (?:native|Perl) ownership/iu);
	if(stdout !== undefined) assert.equal(execution.stdout, stdout);
};
const sourceRecord = async (record, path, readSource) => {
	keys(record, "path sha256 source");
	const source = (await readSource(path)).toString();
	assert.deepEqual(record, { path, source, sha256: sha256(source) });
};

const sources = async (mode, variant, item, readSource) => {
	keys(item.input, "metadata sourceIdentity component");
	const { sourceIdentity: source } = item.input;
	assert.equal(hash(item.input.metadata), pins[mode].metadata);
	assert.equal(hash(source), pins[mode].identity);
	const configuration = mode === "ordinary" ? await ownedDotnetCallbackResultConfiguration() : { schemaVersion: 1, modules: ["Owned"] };
	configuration.targets = { cpan: { module: "LeanBridge::OwnedProbe", version: "0.010" } };
	const lean = (await readSource("tests/fixtures/onboarding/owned-aggregates/Owned.lean")).toString() + ownedDotnetCallbackResultSource;
	const reviewedIr = mode === "reviewed" ? ownedDotnetCallbackResultReviewedIr() : null;
	assert.deepEqual(item.sourceInputs, { configuration, lean, reviewedIr });
	assert.equal(source.exportConfigurationSource, canonicalJson(configuration));
	assert.equal(source.exportConfigurationSha256, hash(configuration));
	assert.equal(source.extractorSha256, sha256(beforeFinRefinementSource("src/analyze/NativeExports.lean", await readSource("src/analyze/NativeExports.lean"), source.extractorSha256)));
	assert.deepEqual(source.modules[0].source, { path: "Owned.lean", ...identity(lean) });
	assert.equal(source.modules.length, 1);
	if(reviewedIr) assert.equal(source.reviewedBindingIr.source, canonicalJson(reviewedIr));
	assert.deepEqual(item.input.component, { id: "owned-aggregates@1.0.0", name: "owned-aggregates", version: "1.0.0" });
	const model = createCompiledNativeModel(item.input, capabilities(variant === "host"));
	assert.equal(model.schemaVersion, 11); assert.equal(model.ownedGraph.schemaVersion, 6);
	assert.equal(model.ownedGraph.callbackResultAnchors.signatures.length, 4);
	assert.equal(Boolean(model.ownedGraph.hostCallbacks), variant === "host");
	for(const key of ["resultAnchors", "receiverExports", "inputTransfers"]) assert.equal(model.ownedGraph[key], undefined);
	await assertOwnedPerlCallbackPackageArtifacts(item, model, readSource);
	const expectedSources = Object.keys(item.manifest.files).filter(path => /\.(?:h|c|xs|pm|lean)$/u.test(path) || path === "model.json");
	assert.deepEqual(Object.keys(item.sources).sort(), expectedSources.sort());
	for(const [path, record] of Object.entries(item.sources))
	{
		keys(record, "bytes sha256 source"); assert.equal(typeof record.source, "string");
		assert.deepEqual({ bytes: record.bytes, sha256: record.sha256 }, identity(record.source));
		assert.equal(record.sha256, item.manifest.files[path], path);
	}
	assert.equal(item.sources["model.json"].source, canonicalJson(model));
	await sourceRecord(item.consumer, consumerPath, readSource);
	assert.doesNotMatch(item.consumer.source, /\b(?:snapshot|handoffs)\s*\(|::Probe::|_Owned|::_identity\b/u);
	if(variant === "no-host") await sourceRecord(item.producerDriver, driverPath, readSource);
	else assert.equal(item.producerDriver, null);
	return model;
};

const producers = async (item, model, readSource) => {
	const packages = await assertOwnedPerlCallbackPackageIdentity(item, model, readSource);
	const { glibcMinimumVersion } = item.manifest;
	assert.equal(item.producerExecutions.length, 2);
	const root = item.producerExecutions[0].cwd, node = item.producerExecutions[0].command;
	absolute(root); absolute(node); assert.ok(["node", "nodejs"].includes(basename(node)));
	assert.equal(item.producerInterface, item.variant === "host" ? "installed-cli" : "native-build-api");
	const perls = item.abiQueries.map(query => query.perl);
	assert.deepEqual(perls.map(ownedPerlReceiverVariant), ownedPerlReceiverVariants);
	for(const perl of perls) absolute(perl);
	const project = join(root, "source"), cli = join(root, "author/node_modules/.bin/lean-bridge");
	for(const [index, destination] of ["producer", "independent"].entries())
	{
		const output = join(root, destination);
		const { response, ...execution } = item.producerExecutions[index];
		let result, expected, args;
		if(item.variant === "host")
		{
			result = { backend: "perl", bindingIrSha256: model.bindingIrSha256
				, component: model.component
				, configurationSha256: model.sourceIdentity.exportConfigurationSha256
				, ecosystem: "cpan", glibcMinimumVersion
				, nativeRuntimeIdentity: item.componentReceipt.runtimeIdentity
				, output, packages, profile: "native-library-v1", project
				, runtimeIdentity: item.manifest.runtimeIdentity
				, ...item.mode === "reviewed" ? { reviewedBindingIrSha256: model.sourceIdentity.reviewedBindingIr.semanticSha256 } : {}
				, schemaVersion: 1, targets: ["cpan"] };
			expected = ownedPerlCallbackCliResponse("build", project, result, perls);
			args = [cli, "build", "--project", project, "--target", "cpan", "--output", output, "--json"];
		} else
		{
			result = { backend: "perl", ecosystem: "cpan", glibcMinimumVersion
				, packages, runtimeIdentity: item.manifest.runtimeIdentity
				, targets: ["cpan"] };
			expected = { status: "ok", producerInterface: "native-build-api", capabilities: capabilities(false), result };
			const lean = item.producerExecutions[0].args[4]; absolute(lean);
			assert.ok(lean.endsWith("/elan/toolchains/leanprover--lean4---v4.32.2"));
			args = [join(root, "author/native-build-api.mjs"), join(root, "author/node_modules/lean-bridge"), project, output, lean];
		}
		assert.deepEqual(response, expected);
		raw(execution, node, args, root, canonicalJson(expected));
		if(index === 0) assert.deepEqual(item.built, result);
	}
	const verified = ownedPerlCallbackCliResponse("verify", null, {
		archives: 2, authenticated: false, component: model.component.id
		, packages: [item.manifest, item.runtimeManifest].map(pkg => ({ ecosystem: "cpan", target: "cpan", name: pkg.distribution, version: pkg.version }))
		, profiles: ["native-library-v1"], receiptSha256: hash(item.packageSetReceipt)
		, verificationType: "local-package-set", verified: true });
	assert.deepEqual(item.cliVerification, verified);
	raw(item.cliVerificationExecution, node, [cli, "verify", "--receipt", join(root, "handoff/package-set-receipt.json"), "--json"], root, canonicalJson(verified));
	absolute(item.savedHandoff);
	assert.match(basename(item.savedHandoff), new RegExp(`^${item.mode}-${item.variant}-package-handoff-[A-Za-z0-9]+$`, "u"));
	assert.deepEqual(item.removedBeforeInstallation, {
		project, output: join(root, "producer")
		, independent: join(root, "independent"), author: join(root, "author")
		, handoff: join(root, "handoff") });
	return { root, packages };
};

const queryArgs = ["-I.", "-MLeanBridgeBuild", "-MConfig", "-e"
	, 'print JSON::PP->new->canonical->encode({key => LeanBridgeBuild::abi_key(), abi => LeanBridgeBuild::abi(), perlVersion => "$^V", threaded => $Config{useithreads} ? 1 : 0})'];
const installed = async (item, root, packages, readSource) => {
	assert.equal(item.abiQueries.length, 4); assert.equal(item.observations.length, 8);
	const assetSource = sha256(await readSource("tests/fixtures/structured-types/owned-perl-installed-assets.pl"));
	for(const [abiIndex, abiVariant] of ownedPerlReceiverVariants.entries())
	{
		const query = item.abiQueries[abiIndex], abi = ownedPerlCallbackPackageAbi(abiVariant);
		keys(query, "perl execution observation");
		const { perl } = query, threaded = Number(!abiVariant.endsWith("unthreaded"));
		const fingerprint = { abi, key: sha256(compact(abi)), perlVersion: "v" + abiVariant.split("-")[0], threaded };
		assert.deepEqual(query.observation, fingerprint);
		raw(query.execution, perl, queryArgs, join(root, "producer/packages/component"), compact(fingerprint));
		for(const [modeIndex, mode] of ["prebuilt-only", "build-xs"].entries())
		{
			const observation = item.observations[abiIndex * 2 + modeIndex];
			keys(observation, "abiVariant assets executions installs mode nativePayload perl receipts relocated removed");
			assert.equal(observation.abiVariant, abiVariant); assert.equal(observation.mode, mode); assert.equal(observation.perl, perl);
			const consumer = join(root, `consumer-${abiIndex}-${mode}`), relocated = join(consumer, "relocated");
			assert.equal(observation.relocated, relocated);
			assert.deepEqual(observation.removed, { handoff: join(consumer, "handoff"), tools: join(consumer, "tools"), originalPrefix: join(consumer, "installed") });
			assert.equal(observation.installs.length, 2); assert.equal(observation.receipts.length, 2);
			for(const [roleIndex, role] of roles.entries())
			{
				const install = observation.installs[roleIndex], pkg = packages[roleIndex];
				const manifest = role === "runtime" ? item.runtimeManifest : item.manifest;
				keys(install, "archive mode commands manifestIdentity receiptIdentity" + (mode === "build-xs" ? " commandsSha256 generatedC generatedXs" : ""));
				assert.equal(install.archive, pkg.archive); assert.equal(install.mode, mode);
				assert.deepEqual(install.manifestIdentity, identity(canonicalJson(manifest)));
				assert.equal(install.commands.length, 3);
				const [extract, configure, make] = install.commands, unpack = extract.args[3];
				assert.equal(unpack.slice(0, consumer.length + 15), consumer + "/.cpan-install-");
				assert.match(basename(unpack), /^\.cpan-install-[A-Za-z0-9]+$/u);
				const packageRoot = join(unpack, pkg.archive.slice(0, -7));
				raw(extract, "tar", ["-xzf", join(consumer, "handoff", pkg.archive), "-C", unpack], consumer, "");
				raw(configure, perl, ["Makefile.PL", `INSTALL_BASE=${join(consumer, "installed")}`], packageRoot);
				raw(make, "make", ["test", "install"], packageRoot);
				assert.match(make.stdout, /t\/00-load\.t \.\. ok\nAll tests successful\.\n/u);
				assert.match(make.stdout, /Result: PASS\n/u);
				assert.doesNotMatch(make.stdout, /(?:^|\n)[ \t]*(?:not ok\b|Bail out!|Result: (?:FAIL|NOTESTS)\b|Failed\b|Dubious\b|Test Summary Report\b)/u);
				const recorded = observation.receipts[roleIndex]; keys(recorded, "role receipt receiptIdentity installed");
				assert.equal(recorded.role, role); const { receipt } = recorded;
				assert.equal(receipt.schemaVersion, 1); assert.deepEqual(receipt.abi, abi);
				assert.equal(receipt.operation, mode === "prebuilt-only" ? "prebuilt-xs" : "generated-xs-only");
				fileIdentity(recorded.installed); assert.equal(recorded.installed.sha256, receipt.outputSha256);
				assert.deepEqual(recorded.receiptIdentity, identity(compact(receipt) + "\n"));
				assert.deepEqual(install.receiptIdentity, recorded.receiptIdentity);
				let compilation = "";
				if(mode === "prebuilt-only")
				{
					keys(receipt, "schemaVersion operation abi outputSha256");
					assert.equal(receipt.outputSha256, manifest.files[manifest.prebuilt.find(value => value.abiKey === fingerprint.key).path]);
				} else
				{
					compilation = assertOwnedPerlCallbackCompileReceipt(receipt, manifest, configure, packageRoot, consumer, abiVariant, abi);
					fileIdentity(install.generatedC); fileIdentity(install.generatedXs);
					assert.equal(install.generatedC.sha256, receipt.generatedCSha256);
					assert.deepEqual(install.generatedXs, recorded.installed);
					assert.equal(install.commandsSha256, hash(receipt.commands));
				}
				assert.equal(configure.stdout, compilation + "Checking if your kit is complete...\nLooks good\nGenerating a Unix-style Makefile\n"
					+ `Writing Makefile for ${manifest.module}\nWriting MYMETA.yml and MYMETA.json\n`);
			}
			const payload = roles.flatMap(role => Object.entries((role === "runtime" ? item.runtimeManifest : item.manifest).files)
				.filter(([path]) => /^lib\/.*\/native\//u.test(path)).map(([path, sha256]) => ({ role, path, sha256 })));
			assert.equal(payload.length, 4); assert.equal(observation.nativePayload.length, 4);
			for(const [index, entry] of observation.nativePayload.entries())
			{
				keys(entry, "bytes path role sha256"); fileIdentity({ bytes: entry.bytes, sha256: entry.sha256 });
				assert.deepEqual({ role: entry.role, path: entry.path, sha256: entry.sha256 }, payload[index]);
				if(entry.path.endsWith("/" + item.componentReceipt.library)) assert.equal(entry.bytes, item.componentReceipt.nativeLibrary.bytes);
			}
			const expected = { checks: item.variant === "host" ? 64 : 39
				, phases: { surface: 2, native: 30, ...item.variant === "host" ? { host: 30 } : { no_host: 5 } }
				, variant: item.variant, perlVersion: fingerprint.perlVersion
				, threaded, archname: abi.archname };
			assert.equal(observation.executions.length, 2);
			for(const { observation: actual, ...execution } of observation.executions)
			{
				assert.deepEqual(actual, expected);
				raw(execution, perl, ["consumer.pl", item.variant], consumer, compact(expected) + "\n");
			}
			keys(observation.assets, "sourceSha256 observations"); assert.equal(observation.assets.sourceSha256, assetSource);
			const nativeRoot = join(relocated, "lib/perl5", abi.archname);
			const paths = [join(nativeRoot, "auto/LeanBridge/OwnedProbe/OwnedProbe.so")
				, ...[item.manifest.ownedValues.gmpLibrary, item.componentReceipt.library].map(name => join(nativeRoot, "LeanBridge/OwnedProbe/native", name))];
			assert.equal(observation.assets.observations.length, 6);
			for(const [assetIndex, path] of paths.entries()) for(const [warm, assetMode] of ["cold", "warm"].entries())
			{
				const asset = observation.assets.observations[assetIndex * 2 + warm];
				keys(asset, "asset execution forged observation original"); assert.equal(asset.asset, basename(path));
				fileIdentity(asset.original); fileIdentity(asset.forged);
				assert.notEqual(asset.original.sha256, asset.forged.sha256);
				assert.equal(asset.forged.bytes, asset.original.bytes + Buffer.byteLength("\nchanged installed native asset\n"));
				if(assetIndex === 0) assert.deepEqual(asset.original, observation.receipts[1].installed);
				else
				{
					const entry = observation.nativePayload.find(value => value.path.endsWith("/" + asset.asset));
					assert.deepEqual(asset.original, { bytes: entry.bytes, sha256: entry.sha256 });
				}
				if(warm)
				{
					assert.deepEqual(asset.original, observation.assets.observations[assetIndex * 2].original);
					assert.deepEqual(asset.forged, observation.assets.observations[assetIndex * 2].forged);
				}
				const result = { mode: assetMode, checks: 7, brokerIdentities: 0 };
				assert.deepEqual(asset.observation, result);
				raw(asset.execution, perl, ["inspect-assets.pl", assetMode, path, join(consumer, "changed-native-file"), ...paths], consumer);
				assert.deepEqual(JSON.parse(asset.execution.stdout), result);
				assert.equal(asset.execution.stdout, JSON.stringify(JSON.parse(asset.execution.stdout)));
			}
		}
	}
};

/**
 * Require one independently selected complete optional-variant report.
 *
 * @param name - Required report basename, selected outside the report.
 * @param item - Complete original report.
 * @param readSource - Current or authenticated historical source reader.
 */
export const assertOwnedPerlCallbackVariant = async (name, item, readSource = readFile) => {
	assert.ok(ownedPerlCallbackVariantReports.includes(name));
	const mode = name.split("-")[0], variant = name.includes("-no-host-") ? "no-host" : "host";
	keys(item, "abiQueries built cli cliInstallation cliVerification cliVerificationExecution componentReceipt consumer independentArchives independentPackageSetReceipt input limitations manifest mode observations packageSetReceipt producerDriver producerExecutions producerInterface reassembly removedBeforeInstallation runtimeManifest savedHandoff schemaVersion sourceInputs sources stage variant");
	assert.equal(item.schemaVersion, 1); assert.equal(item.stage, "complete");
	assert.equal(item.mode, mode); assert.equal(item.variant, variant);
	assert.deepEqual(item.limitations, [
		"no shared cross-language release"
		, "no native adapter owner or allocation counters"
		, "no-host producer uses the installed native build API, not the CLI build command"]);
	const model = await sources(mode, variant, item, readSource);
	const { root, packages } = await producers(item, model, readSource);
	await installed(item, root, packages, readSource);
};

/**
 * Require exactly four matrices: eight producers, 32 prefixes and 64 runs.
 *
 * @param reports - Reports keyed by independently selected basenames.
 * @param readSource - Current or authenticated historical source reader.
 */
export const assertOwnedPerlCallbackVariantMatrix = async (reports, readSource = readFile) => {
	keys(reports, ownedPerlCallbackVariantReports.join(" "));
	for(const name of ownedPerlCallbackVariantReports) await assertOwnedPerlCallbackVariant(name, reports[name], readSource);
	const first = reports[ownedPerlCallbackVariantReports[0]];
	for(const report of Object.values(reports)) assert.deepEqual(report.cli, first.cli);
	return { configurations: 4, producers: 8, prefixes: 32, runs: 64, checks: 3296, assetRejections: 192 };
};

/**
 * Parse complete ordered Node TAP, including metadata and the captured shell exit.
 *
 * @param text - Unmodified actual TAP and external exit marker.
 * @param blocks - Independently expected titles and per-test diagnostics.
 */
export const assertOwnedPerlCallbackVariantTap = (text, blocks) => {
	assert.equal(typeof text, "string"); assert.ok(blocks.length > 0);
	const lines = text.split("\n"); let cursor = 0;
	const take = expected => assert.equal(lines[cursor++], expected, `TAP line ${cursor}`);
	const duration = prefix => {
		const line = lines[cursor++]; assert.equal(typeof line, "string");
		assert.ok(line.startsWith(prefix)); const number = line.slice(prefix.length);
		assert.match(number, /^(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/u);
		assert.ok(Number.isFinite(Number(number)) && Number(number) > 0);
	};
	take("TAP version 13");
	for(const [index, { title, diagnostics }] of blocks.entries())
	{
		take("# Subtest: " + title); take(`ok ${index + 1} - ${title}`);
		take("  ---"); duration("  duration_ms: "); take("  type: 'test'"); take("  ...");
		for(const diagnostic of diagnostics) take(diagnostic);
	}
	take("1.." + blocks.length);
	for(const [key, value] of Object.entries({ tests: blocks.length, suites: 0, pass: blocks.length, fail: 0, cancelled: 0, skipped: 0, todo: 0 }))
		take("# " + key + " " + value);
	duration("# duration_ms "); take("ACTUAL_NODE_EXIT=0"); take("");
	assert.equal(cursor, lines.length, "Trailing or duplicated TAP content");
};

/**
 * Bind each selected actual TAP log, observed exit, and diagnostic to its reports.
 *
 * @param run - Original raw TAP with observed exit and SHA-256.
 * @param names - Independently selected report slots in execution order.
 * @param reports - Independently validated reports.
 */
export const assertOwnedPerlCallbackVariantLog = (run, names, reports) => {
	keys(run, "exitCode sha256 text"); assert.equal(run.exitCode, 0);
	assert.equal(run.sha256, sha256(run.text));
	assert.ok(names.length > 0 && names.every(name => ownedPerlCallbackVariantReports.includes(name)));
	assert.equal(new Set(names).size, names.length);
	const blocks = names.map(name => {
		const item = reports[name], prefix = `# ${item.mode}/${item.variant}: `;
		return { title: `installed CPAN callback-result owners (${item.mode}, ${item.variant})`
			, diagnostics: [prefix + `first real ${item.producerInterface} producer`
			, prefix + "independent second real producer"
			, prefix + `saved original archives at ${item.savedHandoff}; source-free installed matrix`
			, ...item.observations.map(value => "# " + JSON.stringify({ variant: item.variant
				, perl: value.perl, mode: value.mode
				, checks: item.variant === "host" ? 64 : 39
				, runtimeExecutions: 2, assetRejections: 6 }))] };
	});
	assertOwnedPerlCallbackVariantTap(run.text, blocks);
};
