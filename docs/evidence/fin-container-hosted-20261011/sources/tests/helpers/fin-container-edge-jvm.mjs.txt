/**
 * Preserve the complete Java and Kotlin consumers while counting their real public calls.
 * Kotlin's existing consumer intentionally calls the generated Java API through JVM interop.
 *
 * @file
 */
import assert from "node:assert/strict";
import { isAbsolute } from "node:path";
import { finContainerEdgeColumns, finContainerEdgeEntries } from "./fin-container-edge-dispatch.mjs";
import { finContainerEdgeConsumer } from "./fin-container-edges.mjs";

export const finContainerEdgeJvmChecks = Object.freeze({ java: 14089, kotlin: 14088 });

/** Independently enumerate both JVM consumers, including their explicit null-carrier calls. */
export const finContainerEdgeJvmExpected = Object.freeze((() => {
	const rows = [], counts = Array(8).fill(0);
	const add = (method, status) => {
		const index = finContainerEdgeEntries.indexOf(method);
		if(status === "ok")
		{
			counts[index + 2]++;
			if(index >= 4) counts[index - 4]++;
		}
		rows.push(Object.freeze([rows.length + 1, method, status, Object.freeze([...counts])]));
	};
	for(const status of ["ok", "fin", "ok"]) add("present", status);
	for(const status of ["ok", "ok", "fin"]) add("flatten", status);
	for(const method of finContainerEdgeEntries.slice(0, 3)) add(method, "ok");
	for(let value = 0; value < 3; value++)
		for(const method of finContainerEdgeEntries.slice(0, 3)) add(method, "fin");
	for(let value = 0; value < 3; value++) add("optionalDigits", "ok");
	for(let row = 0; row < 3; row++)
	{
		add("present", "fin"); add("optionalDigits", "fin");
		for(let column = 0; column < 3; column++) add("flatten", "fin");
	}
	add("present", "ok"); add("flatten", "ok");
	// Option.some(null) rejects while evaluating the argument, before optionalDigits is called.
	// Its original assertion remains in the consumer, but it is not a public API entry.
	for(const method of ["emptyArray", "emptyList"]) add(method, "null");
	for(const method of finContainerEdgeEntries.slice(0, 3)) add(method, "value");
	for(let value = 0; value < 3; value++) add("optionalDigits", "value");
	for(let cycle = 0; cycle < 1000; cycle++)
		for(const method of ["emptyArray", "emptyList", "emptyOption", "present", "flatten", "optionalDigits"])
		{ add(method, "fin"); add(method, "ok"); }
	return rows;
})());

/**
 * Require the host-specific success count and every measured call, not only final totals.
 *
 * @param stdout - Actual process output.
 * @param profile - Java or Kotlin.
 */
export const readFinContainerEdgeJvm = (stdout, profile) => {
	assert.ok(Object.hasOwn(finContainerEdgeJvmChecks, profile));
	assert.ok(typeof stdout === "string" && stdout.endsWith("\n"));
	const lines = stdout.slice(0, -1).split("\n");
	assert.equal(lines.pop(), `fin-container-ok:${finContainerEdgeJvmChecks[profile]}`);
	assert.equal(lines.length, finContainerEdgeJvmExpected.length);
	return lines.map((line, index) => {
		assert.match(line, new RegExp(`^edge-${profile} [1-9][0-9]* [A-Za-z]+ (?:ok|fin|null|value)(?: (?:0|[1-9][0-9]{0,14})){8}$`, "u"));
		const [, step, method, status, ...counts] = line.split(" ");
		const row = [Number(step), method, status, counts.map(Number)];
		assert.deepEqual(row, finContainerEdgeJvmExpected[index], `${profile} edge call ${index + 1}`);
		return row;
	});
};

/**
 * Keep all original assertions. The six local forwarders retain the actual public JVM signatures.
 *
 * @param model - Verified native model.
 * @param component - Original component identity.
 * @param profile - Java or Kotlin consumer, not a claim about a separate Kotlin facade.
 * @param jar - Absolute receipt-pinned component JAR, checked inside the JVM.
 */
export const finContainerEdgeJvmProbe = async (model, component, profile, jar) => {
	finContainerEdgeColumns(model, component);
	assert.ok(Object.hasOwn(finContainerEdgeJvmChecks, profile));
	assert.ok(typeof jar === "string" && isAbsolute(jar) && !jar.includes("\0"));
	const counter = `import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.function.Supplier;

public final class EdgeCounter {
    private EdgeCounter() { }
    private static String[] arguments;
    private static long step;
    private static void refuse(int code, String message) {
        System.err.println(message); System.exit(code);
        throw new AssertionError("System.exit returned");
    }
    private static ByteBuffer record() {
        try {
            byte[] bytes = Files.readAllBytes(Path.of(arguments[0]));
            return bytes.length == 328 ? ByteBuffer.wrap(bytes).order(ByteOrder.LITTLE_ENDIAN) : null;
        } catch (java.io.IOException | RuntimeException error) { return null; }
    }
    private static String text(ByteBuffer value, int offset, int size) {
        return new String(value.array(), offset, size, StandardCharsets.US_ASCII);
    }
    private static boolean ours(ByteBuffer value) {
        return value != null && text(value, 0, 8).equals("LBFEDGDB") && value.getInt(8) == 1
            && value.getInt(12) == 8 && text(value, 16, 64).equals(arguments[2])
            && text(value, 80, 32).equals(arguments[1]) && value.getLong(112) == ProcessHandle.current().pid()
            && value.getInt(120) == 1;
    }
    public static void initial(String[] args) {
        arguments = args;
        if (args.length != 4) refuse(2, "edge record is not attached with empty counters");
        ByteBuffer value = record();
        if (!ours(value)) refuse(2, "edge record is not attached with empty counters");
        for (int offset = 124; offset < 328; offset += 4) {
            int expected = offset >= 200 && offset < 232 ? -1 : 0;
            if (value.getInt(offset) != expected) refuse(2, "edge record is not attached with empty counters");
        }
        try {
            Path expected = Path.of(${JSON.stringify(jar)});
            for (String name : new String[]{"Api", "Option", "Runtime", "NativeAssets"}) {
                Class<?> type = Class.forName("org.leanbridge.fincontainers." + name, false, EdgeCounter.class.getClassLoader());
                Path actual = Path.of(type.getProtectionDomain().getCodeSource().getLocation().toURI());
                if (!actual.equals(expected) || !actual.toRealPath().equals(expected)) refuse(6, "unexpected JVM public class location");
            }
        } catch (Exception error) { refuse(6, "unexpected JVM public class location"); }
    }
    private static long[] counts() {
        ByteBuffer value = record();
        if (!ours(value) || value.getInt(124) != 255 || value.getInt(128) != 0 || value.getInt(132) != 0)
            refuse(3, "JVM edge definitions are not completely armed");
        String[] expected = arguments[3].split(",", -1);
        if (expected.length != 8) refuse(3, "JVM edge definitions are not completely armed");
        long[] result = new long[8];
        for (int i = 0; i < 8; ++i) {
            if (value.getLong(136 + i * 8) != 1 || !Integer.toString(value.getInt(200 + i * 4)).equals(expected[i]) || value.getInt(232 + i * 4) != 0)
                refuse(3, "JVM edge definitions are not completely armed");
            result[i] = value.getLong(264 + i * 8);
            if (result[i] < 0) refuse(3, "JVM edge definitions are not completely armed");
        }
        return result;
    }
    private static void recorded(int index, String name, String status, long[] before) {
        long[] after = counts();
        for (int column = 0; column < 8; ++column) {
            long delta = status.equals("ok") && (column == index + 2 || (index >= 4 && column == index - 4)) ? 1 : 0;
            if (after[column] != before[column] + delta) refuse(5, "wrong JVM edge dispatch count");
        }
        StringBuilder line = new StringBuilder("edge-${profile} ").append(++step).append(' ').append(name).append(' ').append(status);
        for (long count : after) line.append(' ').append(count);
        System.out.println(line);
    }
    static <T> T call(int index, String name, Supplier<T> action) {
        long[] before = counts();
        if (step == 0 && !Arrays.equals(before, new long[8])) refuse(5, "nonempty JVM edge counters before first call");
        T result;
        try { result = action.get(); }
        catch (RuntimeException error) {
            String status;
            if (error.getClass() == NullPointerException.class) status = "null";
            else if (error.getClass() == IllegalArgumentException.class && "Nat cannot be negative".equals(error.getMessage())) status = "value";
            else if (error.getClass() == IllegalArgumentException.class && error.getMessage() != null && error.getMessage().matches("arg[0-9]+(?:\\\\[[0-9]+\\\\]|\\\\?)* is not below its Fin [0-9]+ bound")) status = "fin";
            else throw error;
            recorded(index, name, status, before);
            throw error;
        }
        recorded(index, name, "ok", before);
        return result;
    }
}
`;
	const signatures = [
		["BigInteger[]", "BigInteger[]"], ["BigInteger[]", "BigInteger[]"]
		, ["Option<BigInteger>", "Option<BigInteger>"]
		, ["Option<BigInteger[]>", "Option<BigInteger[]>"]
		, ["Option<BigInteger>[]", "BigInteger[]"]
		, ["BigInteger[][]", "Option<BigInteger[]>"]
	];
	const api = `import java.math.BigInteger;
import org.leanbridge.fincontainers.Api;
import org.leanbridge.fincontainers.Option;
public final class EdgeApi {
    private EdgeApi() { }
${finContainerEdgeEntries.map((name, index) => `    public static ${signatures[index][1]} ${name}(${signatures[index][0]} value) {
        return EdgeCounter.call(${index}, "${name}", () -> Api.${name}(value));
    }`).join("\n")}
}
`;
	let consumer = await finContainerEdgeConsumer(profile);
	for(const name of finContainerEdgeEntries)
	{
		assert.ok(consumer.includes(`Api.${name}(`));
		consumer = consumer.replaceAll(`Api.${name}(`, `EdgeApi.${name}(`);
	}
	const marker = profile === "java" ? "    public static void main(String[] args) {" : "fun main() {";
	assert.equal(consumer.split(marker).length, 2);
	consumer = consumer.replace(marker, profile === "java" ? marker + "\n        EdgeCounter.initial(args);" : "fun main(args: Array<String>) {\n    EdgeCounter.initial(args)");
	return { consumer, counter, api };
};
