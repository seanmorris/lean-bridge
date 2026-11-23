/**
 * Typed Java 22 and Kotlin 2.2 APIs for compiler-elaborated synchronous IO.
 *
 * @file
 */
import { readFile } from "node:fs/promises";
import { copiedJvmAssets } from "./copied-assets.mjs";

const types = { unit: ["Unit", "Unit"], bool: ["boolean", "Boolean"]
	, char: ["int", "Int"], uint8: ["int", "Int"], uint16: ["int", "Int"]
	, uint32: ["long", "Long"], int8: ["byte", "Byte"], int16: ["short", "Short"]
	, int32: ["int", "Int"], int64: ["long", "Long"], isize: ["long", "Long"]
	, float32: ["float", "Float"], float64: ["double", "Double"]
	, string: ["String", "String"], bytes: ["byte[]", "ByteArray"] };
for(const t of ["nat", "int", "uint64", "usize"]) types[t] = ["java.math.BigInteger", "java.math.BigInteger"];
const boxed = { boolean: "Boolean", int: "Integer", long: "Long", byte: "Byte", short: "Short", float: "Float", double: "Double" };
const words = new Set("abstract assert boolean break byte case catch char class const continue default do double else enum extends final finally float for goto if implements import instanceof int interface long native new package private protected public return short static strictfp super switch synchronized this throw throws transient try void volatile while true false null record sealed permits var yield _ getClass clone finalize notify notifyAll wait hashCode toString equals".split(" "));
const camel = s => s.replace(/_([a-z0-9])/gu, (_, c) => c.toUpperCase());
const ident = s => words.has(camel(s)) ? camel(s) + "_" : camel(s);
const spelling = (t, ns, k, nest = false) => {
	if(Array.isArray(t) && t.length === 2)
		return (k ? ns + "." : "") + "Result<" + t.map(a => spelling(a, ns, k, true)).join(", ") + ">";
	if(!Object.hasOwn(types, t)) throw new TypeError("Unsupported JVM IO value: " + t);
	if(k && t === "unit") return ns + ".Unit";
	const s = types[t][k ? 1 : 0]; return !k && nest ? boxed[s] ?? s : s;
};
const argument = (t, i, v) => {
	const call = (f, arg) => `f.${f}(${i}, ${arg});`;
	if(["uint8", "uint16", "uint32"].includes(t)) return call("bounded", v + ", " + ({ uint8: "255", uint16: "65535", uint32: "0xffffffffL" })[t]);
	if(t === "uint64" || t === "usize") return call("unsigned64", v);
	if(t === "nat" || t === "int") return call("integer", v + ", " + (t === "nat"));
	if(["bytes", "string"].includes(t)) return call(t === "bytes" ? "bytes" : "text", v);
	if(t === "unit") return `java.util.Objects.requireNonNull(${v}); ` + call("word", "0");
	const value = { bool: v + " ? 1 : 0", char: `Wire.codePoint(${v})`
		, float32: `Float.floatToRawIntBits(${v})`
		, float64: `Double.doubleToRawLongBits(${v})` };
	return call("word", value[t] ?? v);
};
const result = (t, d = 0) => {
	if(Array.isArray(t)) return `(f.tag(${d}) ? new Result.Ok<>(${result(t[0], d + 1)}) : new Result.Err<>(${result(t[1], d + 1)}))`;
	const read = { unit: "f.unit()", bool: "Wire.bool(f.scalar())"
		, char: "f.charValue()", bytes: "f.bytes()", string: "f.text()"
		, uint64: "Wire.unsigned(f.scalar())", usize: "Wire.unsigned(f.scalar())"
		, nat: "f.integer(true)", int: "f.integer(false)"
		, float64: "Double.longBitsToDouble(f.scalar())"
		, float32: "Float.intBitsToFloat((int)f.scalar())" };
	return read[t] ?? "(" + types[t][0] + ") f.scalar()";
};

/**
 * Generate both language projections over the same private synchronous ABI.
 *
 * @param options - Checked Binding IR, wire methods, owner entry and native library evidence.
 */
export const generateJvmIO = async options => {
	const { api, wire, invoke, retire, evidence } = options;
	const slug = api.component.name.toLowerCase().replaceAll(/[^a-z0-9]+/gu, "_");
	if(!/^[a-z][a-z0-9_]*$/u.test(slug) || words.has(slug)) throw new TypeError("Invalid JVM IO component namespace");
	const ns = "org.leanbridge." + slug, pkg = "package " + ns + ";\n";
	const files = {}, dir = ns.replaceAll(".", "/");
	const java = (name, source) => { files[`src/main/java/${dir}/${name}.java`] = pkg + source; };
	const names = new Set(), classes = new Set(["Api", "Wire", "Unit", "NativeAssets", "Result", "LeanEIOError", "LeanIOException"]);
	const methods = [], kotlin = [];
	for(const [i, m] of wire.methods.entries())
	{
		const decl = api.declarations.find(d => d.name === m.name);
		if(!decl || decl.source.declaration !== m.declaration || decl.parameters.length !== m.args.length || m.delivery || wire.wait || wire.leases)
			throw new TypeError("JVM IO methods must match the synchronous Lean declarations");
		const name = ident(m.name);
		if(!/^[a-z][A-Za-z0-9_]*$/u.test(name) || names.has(name)) throw new TypeError("Colliding JVM IO method: " + name);
		names.add(name);
		const params = decl.parameters.map((p, j) => {
			const key = ident(p.name);
			return /^[a-zA-Z][A-Za-z0-9_]*$/u.test(key) ? key : "arg" + j;
		});
		if(new Set(params).size !== params.length) throw new TypeError("Colliding JVM IO parameter names: " + name);
		const nativeArgs = m.args.map((t, j) => spelling(t, ns, false) + " a" + j).join(", ");
		const init = m.args.map((t, j) => argument(t, j, "a" + j)).join("\n            ");
		const declaration = JSON.stringify(m.declaration), jt = m.result === "unit" ? "void" : spelling(m.result, ns, false);
		let error = "";
		if(m.effect === "IO") error = `if (status == 4) throw new LeanIOException(${declaration}, f.text());`;
		if(m.effect === "EIO")
		{
			const ex = name[0].toUpperCase() + name.slice(1) + "Error";
			if(classes.has(ex)) throw new TypeError("Colliding JVM IO exception: " + ex);
			classes.add(ex);
			const et = spelling(m.error, ns, false, true);
			java(ex, `public final class ${ex} extends LeanEIOError {
    private final ${et} value;
    ${ex}(${et} value) { super(${declaration}); this.value = value; }
    @Override public ${et} payload() { return value; }
}\n`);
			error = `if (status == 3) throw new ${ex}(${result(m.error)});`;
		}
		methods.push(`    public static ${jt} ${name}(${nativeArgs}) {
        try (var f = new Wire(${m.args.length}, ${m.tagBytes})) {
            ${init}
            int status = f.call(${i}); ${error}
            Wire.success(status); ${m.result === "unit" ? "f.unit();" : "return " + result(m.result) + ";"}
        }
    }`);
		const back = s => "\u0060" + s + "\u0060";
		const kp = m.args.map((t, j) => back(params[j]) + ": " + spelling(t, ns, true)).join(", ");
		const kt = m.result === "unit" ? "kotlin.Unit" : spelling(m.result, ns, true);
		kotlin.push(`    @JvmStatic fun ${back(name)}(${kp}): ${kt} = ${ns}.Api.${back(name)}(${params.map(back).join(", ")})`);
	}
	java("Api", "public final class Api {\n    private Api() {}\n" + methods.join("\n") + "\n}\n");
	java("Unit", "public enum Unit { INSTANCE }\n");
	java("Result", `public sealed interface Result<V,E> {
    record Ok<V,E>(V value) implements Result<V,E> { }
    record Err<V,E>(E error) implements Result<V,E> { }
}\n`);
	java("LeanIOException", `public final class LeanIOException extends java.io.UncheckedIOException {
    private final String declaration;
    LeanIOException(String decl, String message) { super(decl + ": " + message, new java.io.IOException(message)); declaration = decl; }
    public String declaration() { return declaration; }
}\n`);
	java("LeanEIOError", `public abstract class LeanEIOError extends RuntimeException {
    private final String declaration;
    LeanEIOError(String decl) { super(decl + " failed"); declaration = decl; }
    public String declaration() { return declaration; }
    public abstract Object payload();
}\n`);
	files[`src/main/java/${dir}/NativeAssets.java`] = copiedJvmAssets({ namespace: ns }, evidence);
	files[`src/main/java/${dir}/Wire.java`] = (await readFile(new URL("./io-wire.java", import.meta.url), "utf8"))
		.replace("__PACKAGE__", ns).replace("__INVOKE__", invoke).replace("__CLEAR__", wire.clear).replace("__RETIRE__", retire);
	files[`src/main/kotlin/${dir}/kotlin/Api.kt`] = `package ${ns}.kotlin\nobject Api {\n${kotlin.join("\n")}\n}\n`;
	files["binding-manifest.json"] = JSON.stringify({ generator: "jvm-sync-io-v1", namespace: ns, kotlin: { namespace: ns + ".kotlin" } });
	return { namespace: ns, files };
};
