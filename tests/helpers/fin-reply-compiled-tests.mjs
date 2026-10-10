/**
 * Executable checks for host callback replies with Fin bounds (VO #1453). The generated C package
 * wrapper is relinked twice with ASan and UBSan: once as generated, and once with only its C reply
 * walk removed, so Lean's own decidable reconstruction is the only remaining check. The bypass lives
 * entirely in this harness; the release build has no switch for it.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { buildCanonicalProject } from "../../src/build/canonical-build.mjs";
import { nativeTypeKey } from "../../src/build/native-model.mjs";
import { compilePrimitiveCSurface } from "../../src/backends/c/primitive-surface.mjs";
import { copiedCleanEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { finCallbackEnvironment } from "./fin-callback-install.mjs";
import { finCallback, finCallbackBound, finCallbackCompilerModel, finCallbackNat } from "./fin-callback-model.mjs";
import { generateNativeCallables } from "../../src/backends/c/native-callables.mjs";

const enabled = process.env.LEAN_BRIDGE_NATIVE_FIN_REPLY_TEST === "1";
const fixture = "tests/fixtures/onboarding/native-fin-replies";
const exports = ["digits", "failure", "late", "maybe", "maybeTile", "none0", "plain", "twice", "wide"].map(name => `FinReplies.${name}`);
const sanitizers = ["-fsanitize=address,undefined", "-fno-sanitize-recover=undefined", "-fno-omit-frame-pointer", "-g"];
// Lean's runtime keeps process-lifetime allocations, so only memory errors and undefined behavior fail.
const sanitized = { ASAN_OPTIONS: "detect_leaks=0:halt_on_error=1:abort_on_error=0", UBSAN_OPTIONS: "halt_on_error=1:print_stacktrace=1" };
// Every CHECK the consumer executes on success, including the second thread's and the parent's fork check.
const expectedChecks = 27;

/**
 * Run a command and, if it fails, keep its output beside the report before the temporary build is
 * removed. The process runner reports output under details; a bare error keeps its own fields.
 *
 * @param path - Failure record path.
 * @param run - Command to run.
 */
export const retainFailure = (path, run) => run().catch(async error => {
	await mkdir(dirname(path), { recursive: true });
	// Long output keeps its first and last 4000 characters: a linker's first diagnostics and its last.
	const bounded = value => typeof value !== "string" ? "" : value.length <= 8000 ? value : `${value.slice(0, 4000)}\n[...]\n${value.slice(-4000)}`;
	const output = error.details ?? error;
	const captured = { command: output.command ?? null, args: output.args ?? [], stdout: bounded(output.stdout), stderr: bounded(output.stderr) };
	await writeFile(path, canonicalJson({ code: error.code ?? null, ...captured, message: bounded(error.message) }));
	throw error;
});

/**
 * Remove exactly one C reply walk: the bound comparison of one native callback key and its constant.
 *
 * @param source - Generated src/native.c.
 * @param key - Native callback key whose reply walk is removed.
 */
export const stripReplyWalk = (source, key) => {
	const lines = source.split("\n"), name = `lb_fin_reply_${key}_0`;
	const definitions = lines.filter(line => line.startsWith(`static const uint32_t ${name}[`));
	const comparisons = lines.filter(line => line.includes(`lb_fin_below(`) && line.includes(`, ${name}, `));
	// One bound, one comparison: the walk of a single Option (Fin n) reply.
	assert.equal(definitions.length, 1); assert.equal(comparisons.length, 1);
	assert.match(comparisons[0], /^ {8}if \(!lb_fin_below\(.*\)\) \{ lb_record\(frame, [A-Z0-9_]+_STATUS_INVALID_ARGUMENT, NULL, "callback result\? is not below its Fin 5 bound"\); goto done; \}$/u);
	const stripped = lines.filter(line => line !== definitions[0] && line !== comparisons[0]).join("\n");
	assert.equal(stripped.split("\n").length, lines.length - 2);
	assert.ok(!stripped.includes(name));
	// The Lean-rejection flag and every other reply walk remain.
	assert.equal(stripped.split("_reply_take_rejected()) lb_record(").length, source.split("_reply_take_rejected()) lb_record(").length);
	return { source: stripped, removed: [...definitions, ...comparisons] };
};

test("a failed harness command keeps its structured output beside the report", async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-fin-replies-retain-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const path = join(directory, "failure.json");
	await assert.rejects(() => retainFailure(path, () => runCopied("/bin/sh", ["-c", "echo out; echo err >&2; exit 3"], directory, { PATH: "/usr/bin:/bin" })));
	const record = JSON.parse(await readFile(path, "utf8"));
	// A record under directories that do not exist yet keeps the original failure, never ENOENT.
	const nested = join(directory, "missing", "deeper", "failure.json");
	await assert.rejects(() => retainFailure(nested, () => Promise.reject(Object.assign(new Error("first build failed"), { code: "build-command-failed" }))), { message: "first build failed" });
	assert.deepEqual(JSON.parse(await readFile(nested, "utf8")).code, "build-command-failed");
	assert.deepEqual([record.command, record.args, record.stdout, record.stderr], ["/bin/sh", ["-c", "echo out; echo err >&2; exit 3"], "out\n", "err\n"]);
	// A coded build error without process output keeps its code and bounded message.
	const long = `${"h".repeat(4000)}${"m".repeat(1000)}${"t".repeat(4000)}`;
	await assert.rejects(() => retainFailure(path, () => Promise.reject(Object.assign(new Error(long), { code: "unsupported-native-c-signature", details: { declaration: "lean:FinReplies.late" } }))));
	const coded = JSON.parse(await readFile(path, "utf8"));
	assert.deepEqual([coded.code, coded.command, coded.stdout], ["unsupported-native-c-signature", null, ""]);
	assert.equal(coded.message, `${"h".repeat(4000)}\n[...]\n${"t".repeat(4000)}`);
	// Boundaries: 8000 characters stay whole; 8001 lose exactly the one middle character.
	for(const [text, expected] of [["a".repeat(7999) + "z", "a".repeat(7999) + "z"], [`${"h".repeat(4000)}X${"t".repeat(4000)}`, `${"h".repeat(4000)}\n[...]\n${"t".repeat(4000)}`]])
	{
		await assert.rejects(() => retainFailure(path, () => Promise.reject(Object.assign(new Error(text), { details: { command: "/bin/true", args: [], stdout: text, stderr: text } }))));
		const record = JSON.parse(await readFile(path, "utf8"));
		assert.deepEqual([record.message, record.stdout, record.stderr], [expected, expected, expected]);
		assert.equal(record.stdout.includes("X"), false);
	}
	// A successful command leaves no record.
	await rm(path);
	await retainFailure(path, () => runCopied("/bin/sh", ["-c", "true"], directory, { PATH: "/usr/bin:/bin" }));
	await assert.rejects(() => readFile(path));
});

test("the harness bypass removes exactly one C reply walk and keeps Lean's rejection flag", () => {
	const heap = { cType: "lean_object*", box: "lean_box", unbox: "lean_unbox", heap: true };
	const option = bound => ({ kind: "option", element: finCallbackBound(bound), abi: heap });
	const model = finCallbackCompilerModel({ maybe: [finCallback([finCallbackNat], option("5")), finCallbackNat], seven: [finCallback([finCallbackNat], option("7")), finCallbackNat] });
	const surface = compilePrimitiveCSurface(model.bindingIr, { wordBits: model.pointerBits, callables: true, structuredCallables: true, compounds: true, lists: true, variants: true });
	const source = generateNativeCallables(model, surface).source, key = name => nativeTypeKey(model.exports.find(item => item.name === `Sample.${name}`).parameters[0].type);
	const { source: stripped, removed } = stripReplyWalk(source, key("maybe"));
	assert.equal(removed.length, 2);
	// Only the Fin 5 walk goes; the Fin 7 walk and both flag checks stay byte for byte.
	assert.deepEqual(source.split("\n").filter(line => !removed.includes(line)), stripped.split("\n"));
	assert.ok(stripped.includes(`lb_fin_reply_${key("seven")}_0`));
	assert.throws(() => stripReplyWalk(stripped, key("maybe")), assert.AssertionError);
	assert.throws(() => stripReplyWalk(source, "0".repeat(20)), assert.AssertionError);
});

// A generated-wrapper execution check, not source-free installed acceptance: it relinks the producer's
// C wrapper from its build paths and exercises maybe and twice; the other admitted exports are compiled.
test("generated C wrapper execution: C reply walks and Lean's own reconstruction both refuse host replies under ASan and UBSan", { skip: !enabled, timeout: 2_400_000 }, async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-fin-replies-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const projectRoot = join(directory, "project"), outputRoot = join(directory, "release");
	await cp(fixture, projectRoot, { recursive: true });
	await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1, modules: ["FinReplies"], exports, targets: { c: { name: "finreplies", version: "1.0.0" } } }));
	const environment = finCallbackEnvironment(["c"]);
	const reportPath = resolve(process.env.LEAN_BRIDGE_NATIVE_FIN_REPLY_REPORT ?? "build/native-fin-replies/c-bypass.json");
	await mkdir(dirname(reportPath), { recursive: true });
	// The package build keeps its own failure record too: a refusal there precedes every relink.
	await retainFailure(`${reportPath}.build.failure.json`, () => buildCanonicalProject({ projectRoot, outputRoot, targets: ["c"], environment }).catch(error => {
		error.message += `: ${JSON.stringify(error.details)}`; throw error;
	}));
	const model = JSON.parse(await readFile(join(outputRoot, "native/component/model.json"), "utf8"));
	const declaration = name => model.exports.find(item => item.name === `FinReplies.${name}`);
	// Every admitted reply shape reached the model as a checked reply.
	for(const name of exports.filter(item => !item.endsWith(".plain") && !item.endsWith(".twice")))
		assert.ok(declaration(name.split(".")[1]).parameters[0].type.reply, name);
	const key = nativeTypeKey(declaration("maybe").parameters[0].type);
	assert.equal(nativeTypeKey(declaration("twice").parameters[0].type), key);
	const binding = join(outputRoot, "native/c-binding"), component = join(outputRoot, "native/component"), runtime = join(outputRoot, "native/runtime");
	const receipt = JSON.parse(await readFile(join(component, "native-component.json"), "utf8"));
	const surface = compilePrimitiveCSurface(model.bindingIr, { callables: true, structuredCallables: true, compounds: true, lists: true, variants: true });
	const original = await readFile(join(binding, "src/native.c"), "utf8"), stripped = stripReplyWalk(original, key);
	// The generated wrapper, as built for the package, and the walk-free copy share every other byte.
	const work = join(directory, "bypass"), variants = { checked: original, stripped: stripped.source };
	const env = { ...copiedCleanEnvironment, PATH: "/usr/bin:/bin" };
	const includes = ["-I", join(binding, "include"), "-I", join(binding, "internal"), "-I", component, "-I", join(runtime, "include")];
	const link = ["-L", component, "-L", join(runtime, "lib"), "-Wl,--no-as-needed", `-l:${receipt.library}`, "-llean_bridge_native", "-lleanshared", "-Wl,-z,defs", "-Wl,-z,nodelete"];
	const wrapperFlags = ["-std=c11", "-O2", "-fPIC", "-shared", "-Wall", "-Wextra", "-Werror", ...sanitizers];
	const names = Object.fromEntries([["HOST_MAYBE", "maybe", 0], ["HOST_TWICE_FIRST", "twice", 0], ["HOST_TWICE_SECOND", "twice", 1]]
		.map(([macro, name, index]) => [macro, `${surface.prefix}_${surface.callbacks.get(model.bindingIr.declarations.find(item => item.id === `lean:FinReplies.${name}`).parameters[index].type.id).field}`]));
	const harness = `${Object.entries(names).map(([macro, value]) => `#define ${macro} ${value}`).join("\n")}\n${await readFile("tests/fixtures/fin-reply-consumers/bypass.c", "utf8")}`;
	// The wrapper's own libraries sit in separate build directories, not beside it as in a package.
	const consumerFlags = ["-std=c11", "-Wall", "-Wextra", "-Werror", ...sanitizers, "-pthread", `-Wl,-rpath-link,${component}:${join(runtime, "lib")}`];
	const runs = {};
	const retained = (label, command, args, cwd, environment) => retainFailure(`${reportPath}.${label}.failure.json`, () => runCopied(command, args, cwd, environment));
	const compilerVersion = (await runCopied("/usr/bin/cc", ["--version"], directory, env)).stdout.split("\n")[0];
	const libraries = { wrapperSha256: sha256(await readFile(join(binding, "lib", `lib${surface.prefix}.so`))), componentSha256: sha256(await readFile(join(component, receipt.library))) };
	for(const [variant, source] of Object.entries(variants))
	{
		const root = join(work, variant);
		await mkdir(join(root, "src"), { recursive: true });
		await writeFile(join(root, "src/native.c"), source);
		await writeFile(join(root, "consumer.c"), harness);
		const library = join(root, `lib${surface.prefix}.so`);
		await retained(`${variant}-wrapper`, "/usr/bin/cc", [...wrapperFlags, ...includes, join(binding, surface.paths.implementation), join(root, "src/native.c"), ...link, `-Wl,-soname,lib${surface.prefix}.so`, "-o", library], root, env);
		await retained(`${variant}-consumer`, "/usr/bin/cc", [...consumerFlags, "-I", join(binding, "include"), "consumer.c", "-L", root, `-l${surface.prefix}`, "-o", "consumer"], root, env);
		const run = await retained(`${variant}-run`, join(root, "consumer"), [variant], root, { ...env, LD_LIBRARY_PATH: [root, component, join(runtime, "lib")].join(":"), ...sanitized });
		const lines = run.stdout.trim().split("\n");
		assert.equal(lines.at(-1), `fin-reply-ok ${variant} ${expectedChecks}`);
		assert.match(lines.find(line => line.startsWith("fork-status ")) ?? "", /^fork-status \d+ 0$/u);
		assert.equal(run.stderr, "");
		runs[variant] = { sourceSha256: sha256(source), librarySha256: sha256(await readFile(library)), stdout: lines };
	}
	// The wrapper (surface implementation and native.c) and the consumer are instrumented; the Lean
	// component, the bridge runtime and libleanshared are the unchanged, uninstrumented package build.
	const instrumentation = { instrumented: ["wrapper", "consumer"], uninstrumented: [receipt.library, "liblean_bridge_native.so", "libleanshared.so"] };
	const identities = { harnessSha256: sha256(harness), componentReceiptSha256: sha256(await readFile(join(component, "native-component.json"))) };
	const compiler = { version: compilerVersion, wrapper: wrapperFlags, consumer: consumerFlags, link, environment: sanitized, expectedChecks };
	await writeFile(reportPath, canonicalJson({ schemaVersion: 1, scope: "generated C wrapper execution, not installed acceptance", key, removed: stripped.removed, names, runs, compiler, original: libraries, ...instrumentation, ...identities }));
});
