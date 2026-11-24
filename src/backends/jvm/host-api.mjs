/** @file The scoped Java/Kotlin API for application-supplied classes. */
import { copiedJvmAssets } from "./copied-assets.mjs";
import { jvmHostCarrier } from "./host-native-members.mjs";
import { jvmIOScalarTypes, jvmIOIdentifier, jvmIOReserved } from "./sync-io.mjs";

const box = { int: "Integer", long: "Long", boolean: "Boolean", float: "Float", double: "Double", short: "Short", byte: "Byte" };
const fail = why => { throw new TypeError("Invalid JVM host API: " + why); };
const ident = /^[A-Za-z][A-Za-z0-9_]*$/u;
/**
 * Return the same package name used for JNI symbol generation and public sources.
 *
 * @param component - Elaborated application component.
 */
export const jvmHostNamespace = component => {
	const slug = component.name.toLowerCase().replaceAll(/[^a-z0-9]+/gu, "_");
	if(!ident.test(slug) || jvmIOReserved(slug)) fail("component namespace");
	return "org.leanbridge." + slug;
};
const port = (veneer, hash) => `final class NativePort {
    private NativePort() {}
    static { load(); }
    private static void load() {
        try {
            var root = java.nio.file.Files.createTempDirectory("lean-bridge-jni-"); root.toFile().deleteOnExit();
            var file = root.resolve("${veneer}"); file.toFile().deleteOnExit();
            try (var input = NativePort.class.getResourceAsStream("/META-INF/lean-bridge/jni/${veneer}");
                 var out = java.nio.file.Files.newOutputStream(file,java.nio.file.StandardOpenOption.CREATE_NEW)) {
                if (input == null) throw new java.io.IOException("Missing JNI entry library");
                input.transferTo(out);
            }
            var sha=java.security.MessageDigest.getInstance("SHA-256");
            try (var input=java.nio.file.Files.newInputStream(file,java.nio.file.LinkOption.NOFOLLOW_LINKS)) {
                byte[] b=new byte[16384]; for (int n;(n=input.read(b))!=-1;) sha.update(b,0,n);
            }
            if (!java.util.HexFormat.of().formatHex(sha.digest()).equals("${hash}"))
                throw new java.io.IOException("JNI entry library differs from verified component");
            NativeAssets.lookup();
            System.load(file.toAbsolutePath().toString());
        } catch (java.io.IOException | java.security.NoSuchAlgorithmException e) { throw new IllegalStateException("Cannot load prepared JVM host component", e); }
    }
    static native Object[] invoke(HostMembers binding,int operation,Object[] args) throws Exception;
}\n`;
/**
 * Emit normal host-language methods. Only the per-classloader JNI veneer
 * is private-loaded; all mutable native state lives in authenticated peers.
 *
 * @param o - Compiler entries, validated imports, native evidence and verified veneer.
 */
export const generateJvmHostApi = o => {
	const { api, ir, entries, model, evidence, veneer } = o, ns = jvmHostNamespace(api.component);
	if(!/^liblb_jni_[a-f0-9]{64}\.so$/u.test(veneer.name) || !/^[a-f0-9]{64}$/u.test(veneer.sha256)) fail("JNI entry identity");
	const files = {}, dir = ns.replaceAll(".", "/"), java = (name, source) => { files["src/main/java/" + dir + "/" + name + ".java"] = "package " + ns + ";\n" + source; };
	const gens = ir.types.map((_, i) => "T" + i), g = "<" + gens.join(",") + ">", cls = i => "type" + i;
	const type = (r, inner = false) => {
		if(r.kind === "apply" && r.constructor === "result") return "Result<" + r.arguments.map(x => type(x, true)).join(",") + ">";
		const c = jvmHostCarrier(ir.types, r); if(c.kind === "nominal") return gens[c.index];
		const s = jvmIOScalarTypes[c.kind][0]; return inner ? box[s] ?? s : s;
	};
	const token = r => r.kind === "named" ? cls(jvmHostCarrier(ir.types, r).index) : type(r) + ".class";
	const makeInput = (r, v) => "encode(" + JSON.stringify(r.kind === "named" ? "nominal" : r.name) + "," + token(r) + "," + v + ")";
	const get = (r, v) => {
		if(r.kind === "apply") return "(tag(" + v + ")==0 ? new Result.Ok<>(" + get(r.arguments[0], "payload(" + v + ")") + ") : new Result.Err<>(" + get(r.arguments[1], "payload(" + v + ")") + "))";
		if(r.kind === "named") return token(r) + ".cast(" + v + ")";
		return "(" + type(r, true) + ")HostWire.decode(" + JSON.stringify(r.name) + "," + token(r) + "," + v + ")";
	};
	const names = new Set(["close", "bindHosts", "encode", "tag", "payload", "nativeLive"]), methods = [];
	const classes = new Set(["NativePort", "HostWire", "HostContract", "HostMembers", "Unit", "Api", "Result", "LeanIOException", "LeanEIOError", "NativeAssets"]);
	for(const [index, e] of entries.entries())
	{
		const name = jvmIOIdentifier(e.name), d = JSON.stringify(e.declaration);
		if(!ident.test(name) || names.has(name)) fail("duplicate or reserved export " + name); names.add(name);
		const unit = e.result.kind === "primitive" && e.result.name === "unit";
		const args = e.parameters.map((p, i) => type(p.type) + " a" + i), input = e.parameters.map((p, i) => makeInput(p.type, "a" + i));
		let err = "";
		if(e.effect === "EIO")
		{
			const ex = name[0].toUpperCase() + name.slice(1) + "Error"; if(classes.has(ex)) fail("duplicate error class"); classes.add(ex);
			const jt = type(e.error, true);
			if(/\bT\d+\b/u.test(jt)) fail("owned exception payload");
			java(ex, `public final class ${ex} extends LeanEIOError {
    private final ${jt} value;
    ${ex}(${jt} v) { super(${d}); value=v; }
    @Override public ${jt} payload() { return value; }
}\n`);
			err = "if (status==1) throw new " + ex + "(" + get(e.error, "answer[1]") + ");";
		}
		methods.push(`        public ${unit ? "void" : type(e.result)} ${name}(${args.join(",")}) throws Exception {
            Object[] answer=NativePort.invoke(port,${index},new Object[]{${input.join(",")}});
            long status=tag(answer);
            if(status==2) throw new LeanIOException(${d},(String)HostWire.decode("string",String.class,answer[1]));
            ${err}
            if(status!=0) throw new IllegalStateException("Invalid native result");
            ${unit ? 'HostWire.decode("unit",void.class,answer[1]);' : "return " + get(e.result, "answer[1]") + ";"}
        }`);
	}
	const params = gens.map((t, i) => "Class<" + t + "> " + cls(i)), values = gens.map((_, i) => cls(i)).join(",");
	java("Unit", "public enum Unit { INSTANCE }\n");
	java("Result", "public sealed interface Result<V,E> { record Ok<V,E>(V value) implements Result<V,E> {} record Err<V,E>(E error) implements Result<V,E> {} }\n");
	java("LeanIOException", "public final class LeanIOException extends java.io.UncheckedIOException { private final String decl; LeanIOException(String d,String msg) { super(d+\": \"+msg,new java.io.IOException(msg)); decl=d; } public String declaration(){return decl;} }\n");
	java("LeanEIOError", "public abstract class LeanEIOError extends RuntimeException { private final String decl; LeanEIOError(String d){super(d+\" failed\"); decl=d;} public String declaration(){return decl;} public abstract Object payload(); }\n");
	java("Api", `public final class Api {
    private Api(){}
    public static ${g} Bound${g} bindHosts(${params.join(",")}) throws Exception {
        Bound${g} bound=new Bound<>(${values});
        NativePort.invoke(bound.port,-2,null); return bound;
    }
    private static Object encode(String kind,Class<?> cls,Object value) {
        return HostWire.encode(kind,new HostMembers.Site(kind,cls).checked(value,false));
    }
    private static long tag(Object r) { return (Long)((Object[])r)[0]; }
    private static Object payload(Object r) { return ((Object[])r)[1]; }
    public static final class Bound${g} implements AutoCloseable {
        private final HostMembers port;
        ${params.map(p => "private final " + p + ";").join(" ")}
        private Bound(${params.join(",")}) {
            ${gens.map((_, i) => "this." + cls(i) + "=" + cls(i) + ";").join(" ")}
            port=HostContract.bind(Unit.class,${values});
        }
        @Override public void close() throws Exception { NativePort.invoke(port,-1,null); }
${methods.join("\n")}
    }
}\n`);
	java("NativePort", port(veneer.name, veneer.sha256)); java("HostMembers", model.implementation); java("HostContract", model.contract);
	files["src/main/java/" + dir + "/NativeAssets.java"] = copiedJvmAssets({ namespace: ns }, evidence);
	files["src/main/kotlin/" + dir + "/kotlin/Api.kt"] = `package ${ns}.kotlin
object Api {
    @JvmStatic fun <${gens.map(t => t + ": Any").join(",")}> bindHosts(${gens.map((t, i) => cls(i) + ": kotlin.reflect.KClass<" + t + ">").join(",")}): ${ns}.Api.Bound${g} =
        ${ns}.Api.bindHosts(${gens.map((_, i) => cls(i) + ".java").join(",")})
}
`;
	files["binding-manifest.json"] = JSON.stringify({ generator: "jvm-host-v1", namespace: ns, kotlin: { namespace: ns + ".kotlin" } });
	return { namespace: ns, files };
};
