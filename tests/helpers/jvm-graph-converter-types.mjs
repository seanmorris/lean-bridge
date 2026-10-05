/**
 * Compile collision-heavy and large finite Java graph type catalogs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { join } from "node:path";
import { sha256 } from "../../src/capsule/node.mjs";
import { generateCopiedJvmGraphConversions } from "../../src/backends/jvm/copied-graph-conversions.mjs";
import { jvmGraphConversionIr } from "./jvm-graph-conversion-fixture.mjs";
import { jvmLinkedGraphIr } from "./jvm-graph-values-fixture.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { runCopied } from "./copied-fixture-install.mjs";
import { javaCompilerOptions } from "./type-corpus-jvm-tools.mjs";

/** Public names cannot capture JDK types or private converter frames. */
export const jvmGraphCollisionIr = () => {
	const ir = jvmGraphConversionIr();
	const names = {
		Scalars: "Math", Tree: "MemorySegment", Spine: "Arena"
		, Envelope: "AutoCloseable"
		, LeftTree: "OutOfMemoryError", RightTree: "UnsupportedOperationException"
		, Marker: "Frame", Wide: "Node", EmptyRecord: "Cursor", Link: "Input" };
	for(const type of ir.types) type.name = names[type.name] ?? type.name;
	return ir;
};

/** Metadata initialization must stay below the JVM's per-method bytecode limit. */
export const jvmGraphLargeCatalogIr = () => {
	const ir = jvmLinkedGraphIr(), template = ir.types[0];
	ir.component.id = "scale@1.0.0"; ir.component.name = "scale";
	ir.types = Array.from({ length: 700 }, (_, index) => ({
		...structuredClone(template)
		, id: `lean:Recursive.Item${index}`, name: `Item${index}`
		, fields: [template.fields[1]] }));
	const type = { kind: "named", id: ir.types[0].id };
	ir.declarations[0].parameters[0].type = type; ir.declarations[0].result.type = type;
	return ir;
};

/**
 * Compile and execute every descriptor, including generated layouts and shapes.
 *
 * @param directory - Parent test-owned directory.
 * @param environment - Selected Java compiler and runtime.
 */
export const checkJvmGraphConverterTypes = async (directory, environment) => {
	const observations = [];
	for(const [name, ir] of [["collisions", jvmGraphCollisionIr()], ["scale", jvmGraphLargeCatalogIr()]])
	{
		const root = join(directory, name), model = generateCopiedJvmGraphConversions(ir);
		const sources = [], sourceHashes = {};
		for(const [path, source] of Object.entries(model.files))
		{ await saveLakeFile(root, path, source); sources.push(path); sourceHashes[path] = sha256(source); }
		const tree = model.types.find(node => node.ref.id === "lean:Recursive.Tree"), link = model.types.find(node => node.ref.id === "lean:Recursive.Link");
		const body = name === "collisions" ? `
        var leaf = new Math(Unit.INSTANCE, true, 255, 65535, 4294967295L, java.math.BigInteger.ONE,
            (byte)-128, (short)-32768, Integer.MIN_VALUE, Long.MIN_VALUE, java.math.BigInteger.TEN, java.math.BigInteger.ONE.negate(),
            1.5f, -2.25, "text\\0", new byte[] {0, -1}, 0x1f331, java.math.BigInteger.ONE, -9L);
        var input = new MemorySegmentBranch(new MemorySegment[] {new MemorySegmentLeaf(leaf)});
        var linked = new Input(Option.some(new Input(Option.none())));
        try (var scope = new _GraphRuntime.Scope(false)) {
            var raw = _GraphRuntime.write(${tree?.index}, input, scope);
            var copy = _GraphRuntime.read(${tree?.index}, raw, scope);
            if (input == copy || !input.equals(copy)) throw new AssertionError("Copied collision value");
            var rawLink = _GraphRuntime.write(${link?.index}, linked, scope);
            if (!linked.equals(_GraphRuntime.read(${link?.index}, rawLink, scope))) throw new AssertionError("Copied Input value");
        }
        System.out.println("collision-copy-ok");` : `
        int checked = 0;
        for (var node : _GraphTypes.NODES) {
            if (node.kind() != 4) continue;
            Object input = node.hostType().getConstructor(long.class).newInstance(4294967295L);
            try (var scope = new _GraphRuntime.Scope(false)) {
                var raw = _GraphRuntime.write(node.id(), input, scope);
                var copy = _GraphRuntime.read(node.id(), raw, scope);
                if (input == copy || !input.equals(copy)) throw new AssertionError("Catalog copy");
            }
            checked++;
        }
        if (checked != 700) throw new AssertionError("Incomplete finite catalog: " + checked);
        System.out.println("catalog-copy-ok:700");`;
		const probe = `package ${model.namespace};\nclass ConverterTypes { public static void main(String[] arguments) throws ReflectiveOperationException {${body}\n} }\n`;
		await saveLakeFile(root, "ConverterTypes.java", probe);
		await runCopied(environment.LEAN_BRIDGE_JAVAC, [...javaCompilerOptions, "-d", "classes", ...sources, "ConverterTypes.java"], root);
		const result = await runCopied(environment.LEAN_BRIDGE_JAVA, ["--enable-native-access=ALL-UNNAMED", "-Xss256k", "-cp", "classes", `${model.namespace}.ConverterTypes`], root);
		assert.equal(result.stderr, ""); assert.equal(result.stdout, name === "collisions" ? "collision-copy-ok\n" : "catalog-copy-ok:700\n");
		observations.push({ name, sourceHashes, probeSha256: sha256(probe), result: result.stdout.trim() });
	}
	return observations;
};
