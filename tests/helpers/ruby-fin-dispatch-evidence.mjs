/**
 * Authenticate the local installed Ruby Fin entry-counter run and its exact producer sources.
 * Original reports remain separate from later toolchain-selection hardening and hosted acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";

export const rubyDispatchArchiveDirectory = "docs/evidence/ruby-fin-dispatch-20261009";
export const rubyDispatchRevision = "c3bfecb21af56fcc3d4648d305a577730499a516";
const archived = name => `${rubyDispatchArchiveDirectory}/${name}`;
export const rubyDispatchOriginals = Object.freeze({
	"queue.json": {
		"original": "build/vo1425-ruby-dispatch-c3bfecb/queue.json"
		, "sha256": "dcc1960042d130905ae77a46ebe52475178ff71d9673a82bd682a3f87651df5d"
	}
	, "run.tap": {
		"original": "build/vo1425-ruby-dispatch-c3bfecb/run.tap"
		, "sha256": "c81085293fb3c8bcc6db27a7ab4dba4a88b2e6ffc1acb384b2de01965dbfdbe9"
	}
	, "end.txt": {
		"original": "build/vo1425-ruby-dispatch-c3bfecb/end.txt"
		, "sha256": "261ceda3a1d4761b7ff71972421966b6e0e7daaa9f84f1fc4e9cf6e7ad4a10f5"
	}
	, "ruby.json": {
		"original": "build/vo1425-ruby-dispatch-c3bfecb/ruby.json"
		, "sha256": "9c3a6f0d01142f510ea2f821b6519d58107d220fb214711bc6711e9a620357fd"
	}
	, "ruby-reviewed.json": {
		"original": "build/vo1425-ruby-dispatch-c3bfecb/ruby-reviewed.json"
		, "sha256": "97934b8677a90c7f9ea14eebbed22078efd4d584222db241fa97fdaee20e35a6"
	}
});
export const rubyDispatchSources = Object.freeze({
	"tests/ruby-fin.test.mjs": "817b089ecf718de80e5d2fc6d63f03c881e987c7c2bd76734871c5eb4187716c"
	, "tests/helpers/native-fin-dispatch-gdb.mjs": "71905e87090421e3346652b49ef2a35528e96568e605b84c5e8649a1dd773792"
	, "tests/helpers/native-fin-dispatch-gdb-tests.mjs": "cda3667177fda437c1a8b9af01349ca1399ed3264b31691ed4c5f0a7b92710e7"
	, "tests/helpers/native-fin-dispatch.mjs": "e1b7105b020665d1ff624baa09f0ab62101b3a3eaba5d9f79cc56895105fb0bc"
	, "tests/helpers/copied-fixture-install.mjs": "4b7065d87cfc18be27bdf9a78a8ed1f207b30c528dcd00a44b077e4d21de4227"
	, "src/backends/ruby/verified-assets.mjs": "801be5e0c60f3ab8d86e9fc5286657c556a7c2315b557e3dfa62c02ef4ec6b49"
	, "src/backends/ruby/copied-assets.mjs": "501e2ad9936e09d58131f9995164ec27fa28d222bfeeded3ed64ae2b5bda0c4f"
	, "src/backends/ruby/copied-values.mjs": "44580dc2129a996655284ea7df86250cf3a671a0930259c05b58fd6e1d1c51c7"
	, "src/build/native-component.mjs": "2798e4cad749111193445a470704201c350819241a293a155c4baff59f135867"
});
export const rubyDispatchTests = Object.freeze([
	"the GDB identity names one verified defining library per counted column"
	, "nm listings decide each column's single defining library"
	, "the GDB script records before the inferior runs and arms only exact verified definitions"
	, "the GDB record reader requires the exact layout"
	, "Ruby gems are checked Fin consumers beside C, C++, Python and Rust"
	, "generated Ruby bound docs come only from checked refinement metadata"
	, "GDB entry breakpoints count a deep-bound Ruby stand-in exactly and refuse missing, stale, foreign and leaking runs"
	, "relocated source-free Ruby gems check Fin bounds through the bundled C adapter"
	, "independently reviewed Ruby packages check scalar Fin through installed consumers"
]);
export const rubyDispatchRows = Object.freeze([
	["start", "ok", [0, 0, 0, 0, 0, 0]]
	, ["invalid-mirror-bound", "rejected:arg0<10", [0, 0, 0, 0, 0, 0]]
	, ["invalid-mirror-huge", "rejected:arg0<10", [0, 0, 0, 0, 0, 0]]
	, ["invalid-impossible-zero", "rejected:arg0<0", [0, 0, 0, 0, 0, 0]]
	, ["invalid-label-late", "rejected:arg1<4", [0, 0, 0, 0, 0, 0]]
	, ["valid-mirror", "ok:6", [1, 0, 0, 1, 0, 0]]
	, ["valid-label", "ok:slot:8", [1, 0, 1, 1, 0, 1]]
	, ["recovery-invalid-mirror", "rejected:arg0<10", [1, 0, 1, 1, 0, 1]]
	, ["recovery-invalid-impossible", "rejected:arg0<0", [1, 0, 1, 1, 0, 1]]
	, ["recovery-invalid-label", "rejected:arg1<4", [1, 0, 1, 1, 0, 1]]
	, ["recovery-valid-mirror", "ok:0", [2, 0, 1, 2, 0, 1]]
	, ["recovery-valid-label", "ok:slot:5", [2, 0, 2, 2, 0, 2]]
]);
export const rubyDispatchColumns = Object.freeze([
	"l_NativeFin_mirror"
	, "l_NativeFin_impossible"
	, "l_NativeFin_label"
	, "lb_b703515a10173a97c2e27e46"
	, "lb_1d7e0c72a4d6e1cde32466e4"
	, "lb_9afacce322a81504ba9eb75b"
]);
const versions = {
	"node": "v22.23.3"
	, "lean": "Lean (version 4.32.2, x86_64-unknown-linux-gnu, commit f3b06c705e6c85f5314019d5d3baab0fec5b580c, Release)"
	, "ruby": "ruby 3.3.12 (2026-07-16 revision 0581089df9) [x86_64-linux]"
	, "rubySha256": "28eea9e1f4c7eef2f6812b0535409dce29f71ca86bbbddeccb6df6d3279bf6bb"
	, "gem": "3.5.22"
	, "glibc": "ldd (Debian GLIBC 2.36-9+deb12u14) 2.36"
	, "gdb": "GNU gdb (Debian 13.1-3) 13.1"
	, "gdbSha256": "762f9d48202dd341e170d8302543f35622417b4e39bfce9a270d06943702e754"
	, "ptraceScope": "0"
	, "cc": "cc (Debian 12.2.0-14+deb12u1) 12.2.0"
	, "nm": "GNU nm (GNU Binutils for Debian) 2.40"
	, "readelf": "GNU readelf (GNU Binutils for Debian) 2.40"
};
const command = "env -u FORCE_COLOR NO_COLOR=1 LEAN_BRIDGE_RUBY_FIN_TEST=1 LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36 taskset -c 3 node --test --test-concurrency=1 --test-reporter=tap tests/ruby-fin.test.mjs";
const environment = {
	"NO_COLOR": "1"
	, "FORCE_COLOR": "(unset)"
	, "LEAN_BRIDGE_RUBY_FIN_TEST": "1"
	, "LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR": "2.36"
	, "LEAN_BRIDGE_RUBY": "(unset: .toolchains/ruby33/bin/ruby)"
	, "LEAN_BRIDGE_GDB": "(unset: /usr/bin/gdb)"
	, "TMPDIR": "(unset: /tmp)"
};
const routes = ["public Ruby methods LeanBridge::NativeFin.mirror, .impossible and .label through the verified RTLD_DEEPBIND gem loader and Fiddle into the bundled C adapter"];
const libraries = {
	"libcomponent_3f006a55a2dafabb9196.so": "1dc7c7fefd12e9b23c58a55d588a03213594055c6f27c501eca3fbff0d3de420"
	, "liblean_bridge_native.so": "25bb83c98a7f86c15c8f5a5181457943beae8e9052ce059cf11df47060cdb5f7"
	, "libleanshared.so": "d7768b88d8162736da4305777cd6f147676038fd885bd8a265c958b0ecea00b4"
	, "libnative_fin.so": "a969da07861f6e1074a6b994808e8132ecfa2e05268aa175a076b72fc01c4a9b"
};
const reportKeys = ["bindingIrSha256","checks","compilerFreePath","consumerSha256","dispatch","installedFilesSha256","modelSha256","offlineInstall","packages","path","profile","receiptSha256","relocatedInstallation","repeatExecution","sharedNativeLibraries","sourceRemovedBeforeInstallation","sourceTreeSha256"];
const dispatchKeys = ["breakpoints","columns","configSha256","definers","gdb","instrument","instrumentation","libraries","observed","positiveControl","probeSha256","routes","scope","scriptSha256"];
const offsets = ["0x23f0","0x22f0","0x2780","0x2bd0","0x29b0","0x2a40"];
const producerMetadata = {
	"ordinary-source": {
		"bindingIrSha256": "7b3ab955e613342b509259dde03813c06b694cb1b9675c924512fdbe6140509f"
		, "consumerSha256": "40d6b24387d8e90fe082af78953519874c4a1201db68707edc98eabf736522f4"
		, "installedFilesSha256": "c2585b50379c2643daa305c7ce49e80c703ce34abb91e789ab91689e5de37235"
		, "modelSha256": "0a7029e9ceedf19e10a400ec4780b5dd94bdb32a38f6ee8d9a0ed17b242a7b31"
		, "receiptSha256": "8d43e91fd6f1d5f76bdd9f15992736adfeb3de86d281b5900ff2593ac75cefb3"
		, "sourceTreeSha256": "50711843030e7648f3df031a75c8aa9d82c6c496e29cb55fc32795bfc5bd9b4f"
	}
	, "reviewed-ir": {
		"bindingIrSha256": "8f06973cdd86426d4c7f4c8fe8802275300d1ae4f3b8cb8e6abd538acc788b5c"
		, "consumerSha256": "40d6b24387d8e90fe082af78953519874c4a1201db68707edc98eabf736522f4"
		, "installedFilesSha256": "f6d8cf1e5a5ada98811ad5de96bf829751ba3c1695e295d372c912f4d98bcbd8"
		, "modelSha256": "17726690fd36a569a1822dec9ca01f6f0d4aaa14927fcc452eeeab07ac80fdf9"
		, "receiptSha256": "cee63f0296f5813fbd979b26d5afa8fd3a22819e656b84c10ac6cf2d5467d348"
		, "reviewedSourceSha256": "95c70a9b79f4f4cce574b9d7ce8a3f1dcb32519448820cd52b40a371fd1ecd4c"
		, "sourceTreeSha256": "ef74ce360c4ba6723a28c7a5acd5d1fcae1ec53ca9794f1df168cb4a24444b25"
	}
};

/**
 * Where one exact producing source is retained.
 *
 * @param path - Repository-relative source path.
 */
export const rubyDispatchSnapshot = path => archived(`sources/c3bfecb/${path}.source`);
export const rubyDispatchArchivePaths = Object.freeze([...Object.keys(rubyDispatchOriginals).map(archived), ...Object.keys(rubyDispatchSources).map(rubyDispatchSnapshot)]);

/**
 * Independently recount source/adapter pairs. Invalid calls never enter either, including Fin 0.
 *
 * @param observed - Ordered public-call rows.
 */
export const assertRubyDispatchDeltas = observed => {
	assert.deepEqual(observed.map(row => row.slice(0, 2)), rubyDispatchRows.map(row => row.slice(0, 2)));
	let counts = [0, 0, 0, 0, 0, 0];
	for(const [step, , entries] of observed)
	{
		counts = [...counts];
		if(step === "valid-mirror" || step === "recovery-valid-mirror")
		{ counts[0]++; counts[3]++; }
		if(step === "valid-label" || step === "recovery-valid-label")
		{ counts[2]++; counts[5]++; }
		assert.deepEqual(entries, counts, step);
	}
};

/**
 * Authenticate a report's exact source path, isolation, package and measurement.
 *
 * @param text - Original JSON bytes or text.
 * @param path - Ordinary source or reviewed IR.
 */
export const assertRubyDispatchReport = (text, path) => {
	const report = JSON.parse(text), [item] = report.reports;
	assert.ok(Object.hasOwn(producerMetadata, path));
	assert.deepEqual(Object.keys(report).sort(), ["archives", "reports", "reproducible", "schemaVersion"]);
	assert.equal(report.schemaVersion, 1); assert.equal(report.reproducible, true); assert.equal(report.reports.length, 1);
	assert.deepEqual(Object.keys(report.archives).sort(), ["archives/native-fin-1.0.0-c.tar.gz", "archives/native-fin-1.0.0-x86_64-linux.gem"]);
	assert.deepEqual(Object.keys(item).sort(), [...reportKeys, ...path === "reviewed-ir" ? ["reviewedSourceSha256"] : []].sort());
	assert.equal(item.path, path); assert.equal(item.profile, "ruby"); assert.equal(item.checks, 2029);
	for(const [key, value] of Object.entries(producerMetadata[path])) assert.equal(item[key], value, key);
	for(const flag of ["sourceRemovedBeforeInstallation", "compilerFreePath", "offlineInstall", "relocatedInstallation", "repeatExecution"]) assert.equal(item[flag], true, flag);
	assert.equal(item.packages.length, 1);
	const [pkg] = item.packages;
	assert.deepEqual([pkg.name, pkg.version, pkg.target, pkg.ecosystem, pkg.role, pkg.runtimeDelivery, pkg.profile], ["native-fin", "1.0.0", "rubygems", "rubygems", "component", "embedded", "native-library-v1"]);
	assert.deepEqual(pkg.requires, []); assert.equal(pkg.artifacts.length, 1);
	assert.equal(pkg.runtimeIdentity, "137cb2975ffded21021afe95f6e4cd7d33d6c5d9e605a9e0f28fd950136decdf");
	const [artifact] = pkg.artifacts;
	assert.equal(artifact.path, "archives/native-fin-1.0.0-x86_64-linux.gem");
	assert.ok(Number.isSafeInteger(artifact.bytes) && artifact.bytes > 0);
	assert.equal(artifact.sha256, report.archives[artifact.path]);
	for(const digest of Object.values(report.archives)) assert.match(digest, /^[a-f0-9]{64}$/u);
	assert.deepEqual(item.sharedNativeLibraries, libraries);
	const measured = item.dispatch;
	assert.deepEqual(Object.keys(measured).sort(), dispatchKeys);
	assert.equal(measured.instrument, "gdb-breakpoints");
	assert.equal(measured.instrumentation, "in-memory int3 breakpoints at each verified definition; deployed files and the production loader are unchanged");
	assert.equal(measured.scope, "local x86_64 Linux with GDB and ptrace");
	assert.deepEqual(measured.routes, routes);
	assert.equal(measured.positiveControl, "valid public Ruby calls increment exactly their source and adapter columns; rejected calls, including every Fin 0 call, change no column");
	assert.equal(measured.probeSha256, "1738c5f6495587f6eed85ed3bd59932ced2d5adae41ca0bb201c21440a9de5cb");
	assert.equal(measured.scriptSha256, "5da0ece193af2ef098a1491a52183864dc97aeb9b271b92720652a5cb1c7d640");
	assert.deepEqual(measured.gdb, { version: versions.gdb, sha256: versions.gdbSha256 });
	assert.deepEqual(measured.columns, rubyDispatchColumns);
	assert.deepEqual(measured.definers, Array(6).fill("libcomponent_3f006a55a2dafabb9196.so"));
	assert.deepEqual(measured.libraries, libraries);
	assert.deepEqual(measured.breakpoints, rubyDispatchColumns.map((symbol, index) => ({ symbol, library: measured.definers[index], offset: offsets[index] })));
	const identity = { schemaVersion: 1, platform: "x86_64-linux-gnu", instrument: "gdb-breakpoints", componentId: "native-fin@1.0.0", columns: rubyDispatchColumns, libraries: Object.keys(libraries).sort(), definers: measured.definers };
	assert.equal(measured.configSha256, sha256(canonicalJson(identity)));
	assert.deepEqual(measured.observed, rubyDispatchRows);
	assertRubyDispatchDeltas(measured.observed);
	return item;
};

/**
 * Require both installed selections and all their controls, without skipped or failed tests.
 *
 * @param files - Original execution records.
 * @param files.queue - Queue JSON.
 * @param files.tap - Complete TAP.
 * @param files.end - Terminal status and free-space record.
 */
export const assertRubyDispatchRun = ({ queue, tap, end }) => {
	const record = JSON.parse(queue);
	assert.equal(record.node, 1425); assert.equal(record.revision, rubyDispatchRevision);
	assert.equal(record.selection, "tests/ruby-fin.test.mjs (both gated tests: ordinary and independently reviewed)");
	assert.equal(record.command, command); assert.deepEqual(record.environment, environment);
	assert.equal(record.cpu, "taskset -c 3"); assert.equal(record.concurrency, 1);
	assert.deepEqual(record.sources, rubyDispatchSources); assert.deepEqual(record.versions, versions);
	assert.deepEqual([...tap.matchAll(/^(not ok|ok) (\d+) - (.*)$/gmu)].map(match => match.slice(1)), rubyDispatchTests.map((name, index) => ["ok", String(index + 1), name]));
	assert.deepEqual([...tap.matchAll(/^1\.\.(\d+)$/gmu)].map(match => match[1]), ["9"]);
	assert.doesNotMatch(tap, /# (?:SKIP|TODO)\b/u);
	assert.equal(tap.split("# per-step source and adapter counts in the relocated Ruby process under GDB entry breakpoints\n").length, 3);
	for(const [key, count] of Object.entries({ tests: 9, pass: 9, fail: 0, cancelled: 0, skipped: 0, todo: 0 }))
		assert.deepEqual([...tap.matchAll(new RegExp(`^# ${key} (.+)$`, "gmu"))].map(match => match[1]), [String(count)], key);
	const ended = /^end=(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ) exit=(\d+) minFree=(\d+)M\n$/u.exec(end);
	assert.ok(ended); assert.equal(ended[2], "0"); assert.ok(Number(ended[3]) >= 1024);
	assert.ok(Date.parse(record.startedAt) < Date.parse(ended[1]));
};

/**
 * Fixed archive scope. Later changes and hosts need their own execution evidence.
 *
 * @param artifacts - Exact archive file references.
 */
export const rubyDispatchReceipt = artifacts => ({
	schemaVersion: 1, planNode: 1425, execution: "local"
	, revision: rubyDispatchRevision, sources: rubyDispatchSources
	, scope: {
		host: "Ruby ordinary-source and independently reviewed IR gems"
		, counter: "GDB entry breakpoints at three Lean source definitions and their three C adapter definitions"
		, routes
		, environment: "Local Ruby 3.3.12, GDB 13.1, ptrace and a glibc 2.36 package floor on x86_64 Linux"
		, loader: "The generated RTLD_DEEPBIND loader and deployed library files are unchanged; instrumentation changes process memory"
		, producer: "c3bfecb produced these installed results; 50d1163 later hardened toolchain selection and gated stand-in requirements"
		, otherHosts: false, hostedCi: false
		, olderEvidence: "Older observed:false reports remain unchanged; this is a separately dated measurement"
	}
	, artifacts
});

/**
 * Write once, refusing any differing existing bytes.
 *
 * @param path - Task-owned artifact path.
 * @param bytes - Exact original bytes.
 */
export const writeRubyDispatchArtifact = async (path, bytes) => {
	await mkdir(dirname(path), { recursive: true });
	try
	{ await writeFile(path, bytes, { flag: "wx" }); }
	catch(error)
	{
		if(error.code !== "EEXIST") throw error;
		assert.ok((await readFile(path)).equals(bytes), path + " already holds different bytes");
	}
};

/**
 * Check the path set before reading, all original hashes, run and reports, and optional producer ancestry.
 *
 * @param receipt - Parsed receipt.
 * @param read - Read allowed repository-relative paths.
 * @param options - Validation options.
 * @param options.currentSources - Also compare current sources with their exact producer snapshots.
 */
export const assertRubyDispatchArchive = async (receipt, read, { currentSources = true } = {}) => {
	assert.ok(Array.isArray(receipt.artifacts));
	const paths = receipt.artifacts.map(artifact => artifact?.path);
	assert.deepEqual([...paths].sort(), [...rubyDispatchArchivePaths].sort());
	assert.equal(new Set(paths).size, paths.length);
	assert.deepEqual(receipt, rubyDispatchReceipt(receipt.artifacts));
	const files = {};
	for(const artifact of receipt.artifacts)
	{
		const bytes = await read(artifact.path);
		assert.equal(bytes.length, artifact.bytes, artifact.path); assert.equal(sha256(bytes), artifact.sha256, artifact.path);
		files[artifact.path] = bytes.toString();
	}
	for(const [name, file] of Object.entries(rubyDispatchOriginals))
	{
		const artifact = receipt.artifacts.find(item => item.path === archived(name));
		assert.equal(artifact.originalPath, file.original); assert.equal(artifact.sha256, file.sha256, name);
	}
	for(const [path, digest] of Object.entries(rubyDispatchSources))
	{
		const artifact = receipt.artifacts.find(item => item.path === rubyDispatchSnapshot(path));
		assert.equal(artifact.originalPath, `git:${rubyDispatchRevision}:${path}`); assert.equal(artifact.sha256, digest, path);
	}
	assertRubyDispatchRun({ queue: files[archived("queue.json")], tap: files[archived("run.tap")], end: files[archived("end.txt")] });
	const ordinary = assertRubyDispatchReport(files[archived("ruby.json")], "ordinary-source");
	const reviewed = assertRubyDispatchReport(files[archived("ruby-reviewed.json")], "reviewed-ir");
	assert.deepEqual(reviewed.dispatch, ordinary.dispatch);
	for(const path of currentSources ? Object.keys(rubyDispatchSources) : [])
	{
		const source = beforeFinRefinementSource(path, await read(path), rubyDispatchSources[path]);
		assert.equal(sha256(source), rubyDispatchSources[path], path);
		assert.equal(source.toString(), files[rubyDispatchSnapshot(path)], path + " snapshot");
	}
};
