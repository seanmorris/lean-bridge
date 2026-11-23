/**
 * Typed Java 22 and Kotlin 2.2 projections of compiler-elaborated IO, tasks and cursors.
 *
 * @file
 */
import { readFile } from "node:fs/promises";
import { copiedJvmAssets } from "./copied-assets.mjs";
import { jvmLeaseModels, jvmLeaseSource, verifyJvmLeaseSites } from "./io-resources.mjs";

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
const insertAt = (source, marker, replacement) => {
	if(!source.includes(marker) || source.indexOf(marker) !== source.lastIndexOf(marker)) throw new Error("Missing or ambiguous JVM template hook: " + marker);
	return source.replace(marker, () => replacement);
};
const spelling = (t, ns, k, nest = false) => {
	if(t?.leaseClass) return t.leaseClass;
	if(Array.isArray(t) && t.length === 2)
		return (k ? ns + "." : "") + "Result<" + t.map(a => spelling(a, ns, k, true)).join(", ") + ">";
	if(!Object.hasOwn(types, t)) throw new TypeError("Unsupported JVM IO value: " + t);
	if(k && t === "unit") return ns + ".Unit";
	const s = types[t][k ? 1 : 0]; return !k && nest ? boxed[s] ?? s : s;
};
const argument = (t, i, v) => {
	if(t?.leaseClass) return `Resources.K${t.index}.borrow(f, ${i}, ${v});`;
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
	if(t?.leaseClass) return `Resources.K${t.index}.take(f)`;
	if(Array.isArray(t)) return `(f.tag(${d}) ? new Result.Ok<>(${result(t[0], d + 1)}) : new Result.Err<>(${result(t[1], d + 1)}))`;
	const read = { unit: "f.unit()", bool: "Wire.bool(f.scalar())"
		, char: "f.charValue()", bytes: "f.bytes()", string: "f.text()"
		, uint64: "Wire.unsigned(f.scalar())", usize: "Wire.unsigned(f.scalar())"
		, nat: "f.integer(true)", int: "f.integer(false)"
		, float64: "Double.longBitsToDouble(f.scalar())"
		, float32: "Float.intBitsToFloat((int)f.scalar())" };
	return read[t] ?? "(" + types[t][0] + ") f.scalar()";
};

const callbackSpecs = (api, m, decl, ns) => {
	const slots = new Map(), spec = m.callbacks ?? [];
	for(const [j, a, b] of spec)
	{
		const param = decl.parameters[j], ref = api.types?.find(t => t.id === param?.type?.id), cb = ref?.callable;
		if(!Number.isSafeInteger(j) || j < 0 || m.args[j] !== "callback" || slots.has(j) || m.delivery !== "task"
			|| param?.ownership !== "lease" || param.lifetime?.scope !== "explicit" || ref?.kind !== "callback"
			|| ref.source?.extensions?.["lean-bridge.dev/callback-scheduler"] !== "jvm-virtual-thread"
			|| cb?.invocation !== "many" || cb.reentry !== "same-agent" || cb.selfDisposal !== "defer" || cb.resultMode !== "value"
			|| cb.parameters?.length !== 1 || cb.parameters[0].type?.kind !== "primitive" || cb.parameters[0].type.name !== a
			|| cb.result?.type?.kind !== "primitive" || cb.result.type.name !== b || cb.failure?.unexpected !== "poison-runtime"
			|| cb.failure.errors?.length !== 1 || cb.failure.errors[0] !== "error:JvmCallbackException")
			throw new TypeError("Invalid compiler-selected JVM callback contract");
		const ja = spelling(a, ns, false, true), jb = spelling(b, ns, false, true), input = a !== "unit", output = b !== "unit";
		const java = input ? output ? `java.util.function.Function<${ja}, ${jb}>` : `java.util.function.Consumer<${ja}>`
			: output ? `java.util.function.Supplier<${jb}>` : "Runnable";
		const kotlin = "(" + (input ? spelling(a, ns, true) : "") + ") -> " + (output ? spelling(b, ns, true) : "kotlin.Unit");
		const invoke = "a" + j + "." + (input ? output ? "apply(v)" : "accept(v)" : output ? "get()" : "run()");
		const body = output ? invoke : "{ " + invoke + "; return Unit.INSTANCE; }";
		const bind = `CallbackPort.<${ja}, ${jb}>bind(f -> ${result(a)}, v -> ${body}, (f,v) -> { ${argument(b, 0, "v")} })`;
		slots.set(j, { java, kotlin, bind });
	}
	if(m.args.some((t, j) => (t === "callback") !== slots.has(j))) throw new TypeError("Missing compiler-selected JVM callback slot");
	return slots;
};

/**
 * Generate both language projections over the same private native ABI.
 *
 * @param options - Checked Binding IR, wire methods, owner entry and native library evidence.
 */
export const generateJvmIO = async options => {
	const { api, wire, invoke, retire, evidence } = options, tasks = Boolean(wire.wait);
	const retained = wire.methods.some(m => m.callbacks?.length);
	if(tasks && wire.leases) throw new TypeError("Resource-bearing JVM packages currently require synchronous IO exports");
	if(tasks !== Boolean(options.task && options.watch) || retained && !tasks) throw new TypeError("Inconsistent JVM task delivery");
	const slug = api.component.name.toLowerCase().replaceAll(/[^a-z0-9]+/gu, "_");
	if(!/^[a-z][a-z0-9_]*$/u.test(slug) || words.has(slug)) throw new TypeError("Invalid JVM IO component namespace");
	const ns = "org.leanbridge." + slug, pkg = "package " + ns + ";\n";
	const files = {}, dir = ns.replaceAll(".", "/");
	const java = (name, source) => { files[`src/main/java/${dir}/${name}.java`] = pkg + source; };
	const leases = jvmLeaseModels(api, wire, evidence, words);
	const shape = t => leases.get(t) ?? t;
	const names = new Set(), classes = new Set(["Api", "Wire", "Unit", "NativeAssets", "Result", "LeanEIOError", "LeanIOException"]);
	const methods = [], kotlin = [];
	const typedError = (ex, shape, decl) => {
		if(classes.has(ex)) throw new TypeError("Colliding JVM IO exception: " + ex);
		classes.add(ex);
		const et = spelling(shape, ns, false, true);
		java(ex, `public final class ${ex} extends LeanEIOError {
    private final ${et} value;
    ${ex}(${et} value) { super(${decl}); this.value = value; }
    @Override public ${et} payload() { return value; }
}\n`);
		return `if (status == 3) throw new ${ex}(${result(shape)});`;
	};
	for(const [i, raw] of wire.methods.entries())
	{
		const m = leases.size ? { ...raw, args: raw.args.map(shape), result: shape(raw.result), error: shape(raw.error) } : raw;
		const decl = api.declarations.find(d => d.name === m.name);
		const mode = m.delivery === "task" ? "promise" : m.delivery === "async-iterator" ? m.delivery : "value";
		if(!decl || decl.source.declaration !== m.declaration || decl.parameters.length !== m.args.length || decl.resultMode !== mode
			|| (m.delivery && (!tasks || mode === "value"))) throw new TypeError("JVM delivery must match the compiler-checked Lean declarations");
		verifyJvmLeaseSites(leases, raw, decl, api);
		const name = ident(m.name);
		if(!/^[a-z][A-Za-z0-9_]*$/u.test(name) || names.has(name)) throw new TypeError("Colliding JVM IO method: " + name);
		names.add(name);
		const params = decl.parameters.map((p, j) => {
			const key = ident(p.name);
			return /^[a-zA-Z][A-Za-z0-9_]*$/u.test(key) ? key : "arg" + j;
		});
		if(new Set(params).size !== params.length) throw new TypeError("Colliding JVM IO parameter names: " + name);
		const slots = callbackSpecs(api, m, decl, ns);
		const nativeArgs = m.args.map((t, j) => (slots.get(j)?.java ?? spelling(t, ns, false)) + " a" + j).join(", ");
		const init = m.args.map((t, j) => slots.has(j) ? `java.util.Objects.requireNonNull(a${j});` : argument(t, j, "a" + j)).join("\n            ");
		const declaration = JSON.stringify(m.declaration), jt = m.result === "unit" ? "void" : spelling(m.result, ns, false);
		let error = "";
		if(m.effect === "IO") error = `if (status == 4) throw new LeanIOException(${declaration}, f.text());`;
		if(m.effect === "EIO")
		{
			const ex = name[0].toUpperCase() + name.slice(1) + "Error";
			error = typedError(ex, m.error, declaration);
		}
		const back = s => "\u0060" + s + "\u0060";
		const kp = m.args.map((t, j) => back(params[j]) + ": " + (slots.get(j)?.kotlin ?? spelling(t, ns, true))).join(", ");
		const kt = m.result === "unit" ? "kotlin.Unit" : spelling(m.result, ns, true);
		const call = `${ns}.Api.${back(name)}(${params.map(back).join(", ")})`;
		if(slots.size)
		{
			const value = spelling(m.result, ns, false, true), unit = m.result === "unit";
			const startError = m.effect === "IO" ? `if (status == 13) throw new LeanIOException(${declaration}, f.text());` : error;
			const late = decl.source.extensions?.["lean-bridge.dev/task-failure"] === "IO.Error"
				? `if (status == 4) throw new TaskIOException(${declaration}, f.text());` : "";
			methods.push(`    public static java.util.concurrent.CompletableFuture<${value}> ${name}(${nativeArgs}) {
        return Delivery.task(new CallbackPort<${value}>(${i}, ${m.args.length}, ${m.tagBytes},
            f -> { ${init} }, (f,status,state) -> {
                if (status == 14) throw state.original(f.scalar()); ${startError} ${late}
                Wire.success(status); return ${result(m.result)};
            }, new CallbackPort.Slot[]{${m.args.map((_, j) => slots.get(j)?.bind ?? "null").join(", ")}}));
    }`);
			kotlin.push(`    @JvmStatic suspend fun ${back(name)}(${kp}): ${kt}${unit ? " { " + call + ".await() }" : " = " + call + ".await()"}`);
			continue;
		}
		if(m.delivery)
		{
			const stream = mode === "async-iterator", value = spelling(m.result, ns, false, true);
			const output = stream ? "java.util.concurrent.Flow.Publisher" : "java.util.concurrent.CompletableFuture";
			const terminal = !m.terminal ? "" : stream
				? typedError(name[0].toUpperCase() + name.slice(1) + "StepError", m.terminal, JSON.stringify(m.stepDeclaration))
				: `if (status == 4) throw new TaskIOException(${declaration}, f.text());`;
			const blobs = m.args.flatMap((t, j) => t === "bytes" ? [j] : []);
			const capture = stream && blobs.length ? "int remaining = 16 * 1024 * 1024; "
				+ blobs.map(j => `if (a${j}.length > remaining) throw new IllegalArgumentException("Lean conversion limit exceeded"); remaining -= a${j}.length;`).join(" ")
				+ " " + blobs.map(j => `byte[] copy${j} = a${j}.clone();`).join(" ") + " " : "";
			const input = m.args.map((t, j) => argument(t, j, (stream && t === "bytes" ? "copy" : "a") + j)).join(" ");
			methods.push(`    public static ${output}<${value}> ${name}(${nativeArgs}) {
        ${capture}return Delivery.${stream ? "stream(() -> " : "task("}new TaskPort<${value}>(${i}, ${m.args.length}, ${m.tagBytes},
            f -> { ${input} }, (f,status) -> { ${error} Wire.success(status); },
            (f,status) -> { ${stream ? "if (status == 2) return null;" : ""} ${terminal} Wire.success(status); return ${result(m.result)}; }));
    }`);
			const unit = m.result === "unit", tail = stream ? ".asLeanFlow()" + (unit ? ".map { kotlin.Unit }" : "") : ".await()";
			kotlin.push(`    @JvmStatic ${stream ? "" : "suspend "}fun ${back(name)}(${kp}): ${stream ? "kotlinx.coroutines.flow.Flow<" + kt + ">" : kt}${!stream && unit ? " { " + call + tail + " }" : " = " + call + tail}`);
			continue;
		}
		methods.push(`    public static ${jt} ${name}(${nativeArgs}) {
        try (var f = new Wire(${m.args.length}, ${m.tagBytes})) {
            ${init}
            int status = f.call(${i}); ${error}
            Wire.success(status); ${m.result === "unit" ? "f.unit();" : "return " + result(m.result) + ";"}
        }
    }`);
		kotlin.push(`    @JvmStatic fun ${back(name)}(${kp}): ${kt} = ${call}`);
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
	if(leases.size)
	{
		const ports = [];
		for(const r of leases.values())
		{
			files["src/main/java/" + r.leaseClass.replaceAll(".", "/") + ".java"] = jvmLeaseSource(r);
			ports.push(`    static final ResourcePort<${r.leaseClass}> K${r.index} = new ResourcePort<>(${r.leaseClass}.class, "${r.ledger}", ${r.index}, ${r.tag});`);
		}
		java("Resources", "final class Resources {\n    private Resources() {}\n" + ports.join("\n") + "\n}\n");
		java("ResourcePort", (await readFile(new URL("./resource-port.java", import.meta.url), "utf8")).split("package __PACKAGE__;\n")[1]);
		const path = `src/main/java/${dir}/Wire.java`;
		files[path] = insertAt(files[path], `        static final MethodHandle CLEAR = bind("${wire.clear}", FunctionDescriptor.ofVoid(ADDRESS));\n`, "");
		files[path] = insertAt(files[path], "Native.CLEAR.invokeExact(out)", "success(call(Integer.MIN_VALUE))");
		files[path] = insertAt(files[path], "            case 5:", '            case 6: throw new IllegalStateException("Lean resource is closed");\n            case 5:');
		files[path] = insertAt(files[path], "    long scalar()", `    void leaseWords(int slot, long id, long scope) {
        word(slot, id); args.set(JAVA_LONG, 24L * slot + 8, scope);
    }
    long leaseId(int tag) {
        long id = out.get(JAVA_LONG, 0);
        if (out.get(JAVA_LONG, 24) != tag || id == 0 || leaseDomain() == 0 || out.get(JAVA_LONG, 16) != 0)
            throw corrupt("Invalid Lean resource identity");
        return id;
    }
    long leaseDomain() { return out.get(JAVA_LONG, 8); }
    void disownLease() { out.set(JAVA_LONG, 24, 0L); }
    long scalar()`);
	}
	const imports = tasks ? "import kotlinx.coroutines.future.await\nimport kotlinx.coroutines.flow.map\n" : "";
	files[`src/main/kotlin/${dir}/kotlin/Api.kt`] = `package ${ns}.kotlin\n${imports}object Api {\n${kotlin.join("\n")}\n}\n`;
	if(tasks)
	{
		const path = `src/main/java/${dir}/Wire.java`;
		files[path] = files[path].replace("    int call(int op)", "    int task(TaskPort<?> port, int op) { return port.call(op, arena, args, out, tags); }\n    int call(int op)");
		const assets = [["TaskReactor", "task-reactor"], ["TaskPort", "task-port"], ["Delivery", "task-delivery"]];
		if(retained) assets.push(["CallbackPort", "callback-port"], ["RetainedCallback", "retained-callback"]);
		for(const [name, asset] of assets) files[`src/main/java/${dir}/${name}.java`] = (await readFile(new URL("./" + asset + ".java", import.meta.url), "utf8"))
			.replace("__PACKAGE__", ns).replace("__WATCH__", options.watch).replace("__TASK__", options.task);
		if(retained)
		{
			// Keep copied-only packages free of callback classes or callback policy.
			const port = `src/main/java/${dir}/TaskPort.java`, delivery = `src/main/java/${dir}/Delivery.java`;
			files[port] = insertAt(files[port], "final class TaskPort", "class TaskPort");
			files[path] = insertAt(files[path], "private static IllegalStateException corrupt", `static void retireCallbackRuntime() {
        try { Native.RETIRE.invokeExact(); } catch (Throwable e) { throw new IllegalStateException("Cannot retire Lean runtime", e); }
    }
    static IllegalStateException corrupt`);
			files[delivery] = insertAt(files[delivery], "        @Override public boolean cancel", `        private void checkWait() { if (!isDone()) CallbackPort.checkWait(port); }
        @Override public T join() { checkWait(); return super.join(); }
        @Override public T get() throws InterruptedException, ExecutionException { checkWait(); return port instanceof CallbackPort<?> cb ? cb.checkedGet(this) : super.get(); }
        @Override public T get(long t, TimeUnit unit) throws InterruptedException, ExecutionException, TimeoutException { checkWait(); return port instanceof CallbackPort<?> cb ? cb.checkedGet(this,t,unit) : super.get(t,unit); }
        @Override public boolean cancel`);
		}
		java("TaskIOException", `public final class TaskIOException extends java.io.UncheckedIOException {
    private final String declaration;
    TaskIOException(String decl, String message) { super(decl + ": " + message, new java.io.IOException(message)); declaration = decl; }
    public String declaration() { return declaration; }
}\n`);
		files[`src/main/kotlin/${dir}/kotlin/TaskFlow.kt`] = (await readFile(new URL("./task-flow.kt", import.meta.url), "utf8")).replace("__PACKAGE__", ns);
	}
	files["binding-manifest.json"] = JSON.stringify({ generator: tasks ? "jvm-tasks-v1" : "jvm-sync-io-v1", namespace: ns, kotlin: { namespace: ns + ".kotlin" } });
	return { namespace: ns, files };
};
