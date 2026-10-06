/**
 * Checked top-level Fin sites in installed, relocated JVM packages.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, readdir, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { compileCopiedJvmModel } from "../src/backends/jvm/copied-model.mjs";
import { renderCopiedJvmPackage } from "../src/backends/jvm/copied-values.mjs";
import { verifyNativeFiles } from "../src/build/native-artifacts.mjs";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { supportsNativeRefinementTargets } from "../src/build/native-project.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { corpusReviewedIr } from "./helpers/type-corpus-reviewed-ir.mjs";
import { copiedCleanEnvironment, installCopiedConsumer, nativeFixtureEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";

const huge = "1180591620717411303424";
const expectedBounds = {
	"NativeFin.impossible": [["0"], null]
	, "NativeFin.only": [["1"], null]
	, "NativeFin.mirror": [["10"], "10"]
	, "NativeFin.twice": [["300"], null]
	, "NativeFin.succHuge": [[huge], huge]
	, "NativeFin.wrap": [[null], "7"]
	, "NativeFin.label": [[null, "4", null], null]
};
const bounds = refinements => refinements ? [refinements.parameters.map(item => item?.bound ?? null), refinements.result?.bound ?? null] : null;
const sharedLibraries = files => Object.fromEntries(Object.entries(files)
	.filter(([path]) => /\.so(?:\.|$)/.test(path)).map(([path, file]) => [basename(path), file.sha256 ?? file]));

/** Public API cases: exact bounds, host exception identity, cleanup and recovery. */
const javaFinConsumer = () => `import org.leanbridge.native_fin.Api;
import java.math.BigInteger;

public final class Consumer {
    private Consumer() { }
    private static int checks;
    static void check(boolean value, String label) { if (!value) throw new AssertionError("failed: " + label); checks++; }
    static boolean rejected(Runnable action, String parameter, String bound) {
        try { action.run(); }
        catch (IllegalArgumentException error) { return (parameter + " is not below its Fin " + bound + " bound").equals(error.getMessage()); }
        return false;
    }
    static boolean throwsType(Class<? extends Throwable> type, Runnable action) {
        try { action.run(); } catch (Throwable error) { return type.isInstance(error); }
        return false;
    }
    static BigInteger n(long value) { return BigInteger.valueOf(value); }
    public static void main(String[] args) {
        BigInteger huge = BigInteger.ONE.shiftLeft(70), word = BigInteger.ONE.shiftLeft(32);
        check(rejected(() -> Api.impossible(n(0)), "value", "0"), "Fin 0 rejects zero");
        check(rejected(() -> Api.impossible(n(1)), "value", "0"), "Fin 0 rejects one");
        check(Api.only(n(0)).equals(n(7)), "Fin 1 accepts zero");
        check(rejected(() -> Api.only(n(1)), "value", "1"), "Fin 1 rejects its bound");
        check(Api.mirror(n(0)).equals(n(9)) && Api.mirror(n(9)).equals(n(0)), "Fin 10 endpoints");
        for (BigInteger value : new BigInteger[] { n(10), n(11), word, huge })
            check(rejected(() -> Api.mirror(value), "value", "10"), "Fin 10 rejects " + value);
        check(throwsType(IllegalArgumentException.class, () -> Api.mirror(n(-1))) && !rejected(() -> Api.mirror(n(-1)), "value", "10"), "negative is the Nat error");
        check(throwsType(NullPointerException.class, () -> Api.mirror(null)), "null is rejected");
        check(Api.twice(n(299)).equals(n(598)), "alias accepts its largest value");
        check(rejected(() -> Api.twice(n(300)), "value", "300"), "alias rejects its bound");
        check(rejected(() -> Api.twice(n(301)), "value", "300"), "alias rejects beyond its bound");
        check(Api.succHuge(word).equals(word.add(BigInteger.ONE)), "large Fin crosses a limb");
        check(Api.succHuge(huge.subtract(n(2))).equals(huge.subtract(BigInteger.ONE)) && Api.succHuge(huge.subtract(BigInteger.ONE)).equals(huge.subtract(BigInteger.ONE)), "large Fin endpoints");
        for (BigInteger value : new BigInteger[] { huge, huge.add(BigInteger.ONE), BigInteger.ONE.shiftLeft(128) })
            check(rejected(() -> Api.succHuge(value), "value", huge.toString()), "large Fin rejects " + value);
        check(Api.wrap(n(100)).equals(n(2)) && Api.wrap(huge).equals(n(2)) && Api.wrap(n(0)).equals(n(0)), "result-only Fin values");
        BigInteger start = n(5); String name = "slot";
        check(Api.label(start, n(3), name).equals("slot:8"), "mixed arguments");
        check(rejected(() -> Api.label(start, n(4), name), "offset", "4"), "mixed arguments reject the Fin site");
        check(start.equals(n(5)) && name.equals("slot") && Api.label(start, n(0), name).equals("slot:5"), "caller data unchanged");
        for (int i = 0; i < 1000; i++) {
            final int k = i;
            if (!rejected(() -> Api.mirror(n(10 + k)), "value", "10")) throw new AssertionError("invalid call accepted at " + i);
            if (!Api.mirror(n(i % 10)).equals(n(9 - i % 10))) throw new AssertionError("valid call failed at " + i);
        }
        checks += 2000;
        System.out.println("java-fin-ok:" + checks);
    }
}
`;

test("JVM packages are checked Fin consumers beside C, C++, Python, Rust, Ruby and .NET", () => {
	for(const targets of [["maven"], ["c", "maven"], ["c", "cpp", "pypi", "cargo", "rubygems", "nuget", "maven"]])
		assert.equal(supportsNativeRefinementTargets(targets), true, targets.join(","));
	for(const target of ["cpan", "php-native", "wit-wasi"])
		assert.equal(supportsNativeRefinementTargets(["maven", target]), false, target);
});

test("generated JVM bound docs come only from checked refinement metadata", () => {
	const ir = corpusReviewedIr({ id: "fins" }, [
		{ name: "Fins.label", parameters: ["nat", "nat", "string"], result: "string" }
		, { name: "Fins.plain", parameters: ["nat"], result: "nat" }]);
	const label = ir.declarations.find(item => item.id === "lean:Fins.label");
	label.source.extensions["lean-lang.org/refinements"] = { parameters: [null, { kind: "fin", bound: "4" }, null], result: null };
	const files = renderCopiedJvmPackage(compileCopiedJvmModel(ir));
	const api = Object.entries(files).find(([path]) => path.endsWith("/Api.java"))[1];
	assert.match(api, /\/\*\*\n \* Checked Lean Fin bounds: arg1 &lt; 4\.\n \*\/\n {4}public static String label\(/);
	assert.doesNotMatch(api, /bounds:[^\n]*\n[^\n]*\n {4}public static [^\n]* plain\(/);
	assert.match(files["README.md"], /Lean Fin n parameters and results are java\.math\.BigInteger values below n\./);
	assert.match(files["README.md"], /\n- org\.leanbridge\.fins\.Api\.label: arg1 < 4\n/);
	label.source.extensions["lean-lang.org/refinements"] = { parameters: [null, { kind: "subtype", constructor: "Fins.check" }, null], result: null };
	assert.throws(() => renderCopiedJvmPackage(compileCopiedJvmModel(ir)), TypeError);
});

test("relocated source-free JVM packages check Fin bounds through the bundled C adapter", { skip: process.env.LEAN_BRIDGE_JVM_FIN_TEST !== "1", timeout: 2_400_000 }, async t => {
	const environment = nativeFixtureEnvironment(["c", "java"]), reports = [], archives = [];
	for(const attempt of [0, 1])
	{
		const author = await mkdtemp(join(tmpdir(), "lean-bridge-jvm-fin-author-"));
		const consumer = await mkdtemp(join(tmpdir(), "lean-bridge-jvm-fin-consumer-"));
		t.after(() => Promise.all([author, consumer].map(root => rm(root, { recursive: true, force: true }))));
		const projectRoot = join(author, "project"), outputRoot = join(author, "release"), handoff = join(consumer, "handoff");
		await cp("tests/fixtures/onboarding/native-fin", projectRoot, { recursive: true });
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1
			, modules: ["NativeFin"]
			, targets: { c: { name: "native-fin", version: "1.0.0" }, maven: { name: "org.leanbridge:native-fin", version: "1.0.0" } } }));
		t.diagnostic(`build ${attempt}: compiling the shared C library and Maven JAR`);
		const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: ["c", "maven"], environment }).catch(error => {
			error.message += `: ${JSON.stringify(error.details)}`; throw error;
		});
		const model = JSON.parse(await readFile(join(outputRoot, "native/component/model.json"), "utf8"));
		assert.deepEqual(Object.fromEntries(model.exports.map(item => [item.name, bounds(item.refinements)])), expectedBounds);
		const receipt = await copyPackageSetHandoff(outputRoot, handoff);
		await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		archives.push(Object.fromEntries(receipt.packages.flatMap(pkg => pkg.artifacts.map(artifact => [artifact.path, artifact.sha256]))));
		await rm(author, { recursive: true, force: true });
		if(attempt === 1) break;
		const cPackage = receipt.packages.find(pkg => pkg.target === "c" && pkg.role === "component");
		const extracted = join(consumer, "c-extract");
		await saveLakeFile(extracted, ".keep", "");
		await runCopied("/usr/bin/tar", ["--use-compress-program=/usr/bin/gzip", "-xf", join(handoff, cPackage.artifacts[0].path)], extracted);
		const cInstalled = join(extracted, `${cPackage.name}-${cPackage.version}-c`);
		const cReceipt = JSON.parse(await readFile(join(cInstalled, "lean-bridge-package.json"), "utf8"));
		await verifyNativeFiles(cInstalled, cReceipt.files);
		const cLibraries = sharedLibraries(cReceipt.files);
		// The JAR bundles the exact checked adapter that the C, Python and Rust probes instrument.
		const packages = receipt.packages.filter(pkg => pkg.target === "maven");
		const jar = join(consumer, "jar");
		await saveLakeFile(jar, ".keep", "");
		await runCopied("/usr/bin/unzip", ["-q", join(handoff, packages.flatMap(pkg => pkg.artifacts).find(item => item.path.endsWith(".jar")).path), "-d", jar], consumer);
		const nativeDirectory = join(jar, "META-INF/lean-bridge/native/linux-x64");
		const packageLibraries = Object.fromEntries(await Promise.all((await readdir(nativeDirectory)).filter(name => /\.so(?:\.|$)/.test(name))
			.map(async name => [name, sha256(await readFile(join(nativeDirectory, name)))])));
		const shared = Object.keys(packageLibraries).filter(name => Object.hasOwn(cLibraries, name)).sort();
		assert.ok(shared.includes("libnative_fin.so"), JSON.stringify({ maven: packageLibraries, c: cLibraries }));
		for(const name of shared) assert.equal(packageLibraries[name], cLibraries[name], name);
		const docs = (await Promise.all((await readdir(jar, { recursive: true })).filter(path => path.endsWith("Api.java")).map(path => readFile(join(jar, path), "utf8")))).join("\n");
		assert.match(docs, /Checked Lean Fin bounds: arg0 &lt; 10; result &lt; 10\./);
		t.diagnostic("offline Java compilation without producer files or Lean/C compilers");
		const fixture = { source: javaFinConsumer, success: "java-fin-ok" };
		const { command, ...observation } = await installCopiedConsumer({ profile: "java", consumer, handoff, packages, environment, fixture });
		const root = join(consumer, "java"), relocated = join(consumer, "java-relocated");
		await rename(root, relocated);
		const repeated = await runCopied(command, ["--enable-native-access=ALL-UNNAMED", "-cp", `${join(relocated, "component.jar")}:${relocated}`, "Consumer"], relocated, copiedCleanEnvironment);
		assert.equal(repeated.stderr, ""); assert.equal(repeated.stdout.trim(), `java-fin-ok:${observation.checks}`);
		reports.push({ profile: "java", path: "ordinary-source"
			, ...observation
			, packages
			, sharedNativeLibraries: Object.fromEntries(shared.map(name => [name, packageLibraries[name]]))
			, dispatch: { observed: false, reason: "the JVM loads extracted native libraries privately; identity with the instrumented C adapter is asserted instead" }
			, bindingIrSha256: built.bindingIrSha256
			, sourceTreeSha256: model.sourceIdentity.sourceTreeSha256
			, modelSha256: sha256(canonicalJson(model))
			, receiptSha256: sha256(await readFile(join(handoff, "package-set-receipt.json")))
			, sourceRemovedBeforeInstallation: true
			, relocatedInstallation: true, repeatExecution: true });
		await rm(consumer, { recursive: true, force: true });
	}
	assert.deepEqual(archives[1], archives[0]);
	await saveLakeFile("build/native-fin", "jvm.json", canonicalJson({ schemaVersion: 1, reports, archives: archives[0], reproducible: true }));
});
