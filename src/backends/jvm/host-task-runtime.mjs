/** @file Generate the Java worker port for bound application classes and copied values. */
import { readFile } from "node:fs/promises";
import { installJvmTaskRuntime } from "./sync-io.mjs";

const asset = name => readFile(new URL("./" + name, import.meta.url), "utf8");
const change = (source, before, after) => {
	if(!source.includes(before) || source.indexOf(before) !== source.lastIndexOf(before)) throw new Error("Missing or ambiguous bound JVM task hook: " + before);
	return source.replace(before, () => after);
};

/**
 * Keep copied operations on the existing runtime owner. Only operations whose
 * payload can contain a Java object need a JNI frame. Both paths update the
 * same native handle; a throwing conversion must not lose a handle to close.
 *
 * @param o - Authenticated wire, owner symbol names, and Java namespace.
 */
export const jvmHostTaskRuntime = async o => {
	const { wire, ns, options } = o, files = {}, dir = ns.replaceAll(".", "/"), base = "src/main/java/" + dir + "/";
	const java = (name, source) => { files[base + name + ".java"] = "package " + ns + ";\n" + source; };
	if(!wire.wait || !wire.leases?.length || wire.leases.some(k => !k.host)) throw new TypeError("Expected JVM host worker wire");
	const retained = wire.methods.some(m => m.callbacks?.length);
	const p = base + "Wire.java", port = base + "TaskPort.java", cb = base + "CallbackPort.java";
	files[p] = (await asset("io-wire.java")).replace("__PACKAGE__", ns).replace("__INVOKE__", options.invoke).replace("__RETIRE__", options.retire);
	files[p] = change(files[p], '        static final MethodHandle CLEAR = bind("__CLEAR__", FunctionDescriptor.ofVoid(ADDRESS));\n', "");
	files[p] = change(files[p], "Native.CLEAR.invokeExact(out)", "success(call(Integer.MIN_VALUE))");
	files[p] = change(files[p], "            case 5:", '            case 6: throw new IllegalStateException("Lean worker is closed");\n            case 5:');
	await installJvmTaskRuntime({ files, ns, dir, retained, owned: false, java, options });
	files[base + "HostWorkerFrame.java"] = (await asset("host-worker-frame.java")).replace("__PACKAGE__", ns);
	files[p] = change(files[p], "    private final Arena arena;", "    final HostWorkerFrame host;\n    private final Arena arena;");
	files[p] = change(files[p], "        arena = Arena.ofConfined();", "        host = new HostWorkerFrame(slots);\n        arena = Arena.ofConfined();");
	files[p] = change(files[p], "port.call(op, arena,", "port.call(op, host, arena,");
	files[port] = change(files[port], "    private long id, domain;", `    private HostMembers binding;
    synchronized TaskPort<T> bound(HostMembers b) {
        if (binding != null || input == null || closed) throw new IllegalStateException("Cannot rebind Lean worker");
        binding=java.util.Objects.requireNonNull(b); return this;
    }
    private long id, domain;`);
	files[port] = change(files[port], "int call(int op, Arena", "int call(int op, HostWorkerFrame frame, Arena");
	files[port] = change(files[port], "        var dest = arena.allocate(JAVA_INT);", `        if (binding != null && (op == 0 || op == 2 || op == 7 || op == 8)) {
            var control = arena.allocate(8, 4); control.set(JAVA_INT, 4, -1);
            try { return frame.call(binding, method, op, args, h, out, tags, control); }
            finally { id=h.get(JAVA_LONG,0); domain=h.get(JAVA_LONG,8); fd=control.get(JAVA_INT,4); }
        }
        var dest = arena.allocate(JAVA_INT);`);
	// Completed futures must not keep the binder or user objects alive through their private port.
	files[port] = change(files[port], "final BiConsumer<Wire,Integer> factory", "BiConsumer<Wire,Integer> factory");
	files[port] = change(files[port], "final BiFunction<Wire,Integer,T> result", "BiFunction<Wire,Integer,T> result");
	files[port] = change(files[port], "closed = true; input = null;", "closed = true; input = null; binding = null; factory = null; result = null;");
	if(retained)
	{
		files[cb] = change(files[cb], "int call(int op, Arena", "int call(int op, HostWorkerFrame frame, Arena");
		files[cb] = change(files[cb], "super.call(op, a,", "super.call(op, frame, a,");
	}
	return files;
};
