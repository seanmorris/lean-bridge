import java.math.BigInteger;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.function.Supplier;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import org.leanbridge.fincontainers.Api;
import org.leanbridge.fincontainers.Option;

final class Probe {
    private Probe() { }
    private static final Pattern REJECTED = Pattern.compile("\\A(arg[0-9]+(?:\\[[0-9]+\\]|\\?)*) is not below its Fin ([0-9]+) bound\\z");
    private static final Pattern PRINTABLE = Pattern.compile("\\A[!-~]*\\z");
    private static String record = "", nonce = "", config = "";
    private static int[] expected = new int[0];
    private static ByteBuffer instrumentation() {
        try {
            byte[] bytes = Files.readAllBytes(Path.of(record));
            return bytes.length == 376 ? ByteBuffer.wrap(bytes).order(ByteOrder.LITTLE_ENDIAN) : null;
        } catch (java.io.IOException | RuntimeException error) { return null; }
    }
    private static String ascii(ByteBuffer bytes, int offset, int length) { return new String(bytes.array(), offset, length, StandardCharsets.ISO_8859_1); }
    private static long word(ByteBuffer bytes, int offset) { return Integer.toUnsignedLong(bytes.getInt(offset)); }
    private static long[] entries(ByteBuffer bytes) {
        long[] counts = new long[10];
        for (int k = 0; k < 10; k++) counts[k] = bytes.getLong(296 + 8 * k);
        return counts;
    }
    private static boolean ours(ByteBuffer bytes) {
        return bytes != null && ascii(bytes, 0, 8).equals("LBFCOGDB") && word(bytes, 8) == 1 && word(bytes, 12) == 10
            && ascii(bytes, 16, 64).equals(config) && ascii(bytes, 80, 32).equals(nonce)
            && bytes.getLong(112) == ProcessHandle.current().pid() && word(bytes, 120) == 1;
    }
    // Exactly the given armed mask, no conflicting or foreign definition and no counted entry.
    private static boolean quiet(ByteBuffer bytes, long armed) {
        if (word(bytes, 124) != armed || word(bytes, 128) != 0 || word(bytes, 132) != 0) return false;
        for (long count : entries(bytes)) if (count != 0) return false;
        return true;
    }
    private static boolean covered(ByteBuffer bytes) {
        for (int k = 0; k < 10; k++) if (bytes.getLong(136 + 8 * k) != 1 || bytes.getInt(216 + 4 * k) != expected[k]) return false;
        return true;
    }
    private static int[] indices(String text) {
        String[] parts = text.split(",", -1);
        int[] values = new int[parts.length];
        for (int k = 0; k < parts.length; k++) values[k] = parts[k].matches("[0-9]{1,3}") ? Integer.parseInt(parts[k]) : -1;
        return values;
    }
    public static void main(String[] args) {
        if (args.length == 4) { record = args[0]; nonce = args[1]; config = args[2]; expected = indices(args[3]); }
        ByteBuffer before = expected.length == 10 ? instrumentation() : null;
        if (!ours(before) || !quiet(before, 0)) { System.err.print("fin container record is not attached to this process with nothing armed\n"); System.err.flush(); System.exit(2); }
        if (!trigger()) { System.err.print("fin container load trigger countNone([]) did not return 0\n"); System.err.flush(); System.exit(4); }
        ByteBuffer after = instrumentation();
        if (!ours(after) || !quiet(after, 1023) || !covered(after)) { System.err.print("fin container columns are not all armed once at their verified definitions with no entries\n"); System.err.flush(); System.exit(3); }
        measure();
        System.out.flush();
    }
    // The explicit load trigger: a public call that counts in no column extracts and opens the verified libraries.
    private static boolean trigger() {
        try { return Api.countNone(new BigInteger[0]).equals(BigInteger.ZERO); }
        catch (RuntimeException error) { return false; }
    }
    private static BigInteger n(String digits) { return new BigInteger(digits); }
    private static void report(String step, String status) {
        ByteBuffer bytes = instrumentation();
        if (bytes == null) throw new IllegalStateException("fin container record is unreadable");
        StringBuilder line = new StringBuilder(step).append(' ').append(status);
        for (long count : entries(bytes)) line.append(' ').append(count);
        System.out.print(line.append('\n'));
    }
    private static String show(Object value) {
        if (value instanceof BigInteger number) return number.toString();
        if (value instanceof String text) return PRINTABLE.matcher(text).matches() ? text : null;
        if (value instanceof BigInteger[] numbers) return Arrays.stream(numbers).map(BigInteger::toString).collect(Collectors.joining(","));
        return null;
    }
    private static String status(Supplier<Object> call) {
        try {
            String text = show(call.get());
            return text == null ? "ok:unexpected" : "ok:" + text;
        } catch (IllegalArgumentException error) {
            var match = REJECTED.matcher(String.valueOf(error.getMessage()));
            return match.matches() ? "rejected:" + match.group(1) + ":" + match.group(2) : "error:IllegalArgumentException";
        } catch (RuntimeException error) { return "error:" + error.getClass().getSimpleName(); }
    }
    // Only the raw Option[] arguments of Api.present need these; every other call is checked.
    @SuppressWarnings({"unchecked", "rawtypes"})
    private static void measure() {
        report("start", "ok");
        report("invalid-array-first", status(() -> Api.mirrorAll(new BigInteger[]{n("10"), n("1"), n("2")})));
        report("invalid-array-middle", status(() -> Api.mirrorAll(new BigInteger[]{n("1"), n("10"), n("2")})));
        report("invalid-array-last", status(() -> Api.mirrorAll(new BigInteger[]{n("1"), n("2"), n("10")})));
        report("invalid-list-wide", status(() -> Api.sumHuge(new BigInteger[]{n("1"), n("1180591620717411303424")})));
        report("invalid-option-present", status(() -> Api.orDefault(Option.some(n("1")))));
        report("invalid-nested-present", status(() -> Api.present(new Option[]{Option.some(n("1")), Option.<BigInteger>none(), Option.some(n("10"))})));
        report("invalid-label-late", status(() -> Api.label(new String[]{"a", "b"}, new BigInteger[]{n("1"), n("4")})));
        report("valid-array", status(() -> Api.mirrorAll(new BigInteger[]{n("0"), n("9")})));
        report("valid-list-wide", status(() -> Api.sumHuge(new BigInteger[]{n("1180591620717411303423"), n("1")})));
        report("valid-option-absent", status(() -> Api.orDefault(Option.<BigInteger>none())));
        report("valid-option-present", status(() -> Api.orDefault(Option.some(n("0")))));
        report("valid-nested-present", status(() -> Api.present(new Option[]{Option.some(n("1")), Option.<BigInteger>none(), Option.some(n("9"))})));
        report("valid-label", status(() -> Api.label(new String[]{"a", "b"}, new BigInteger[]{n("1"), n("3")})));
        report("recovery-invalid-array", status(() -> Api.mirrorAll(new BigInteger[]{n("9"), n("10"), n("0")})));
        report("recovery-invalid-list", status(() -> Api.sumHuge(new BigInteger[]{n("1180591620717411303424")})));
        report("recovery-invalid-option", status(() -> Api.orDefault(Option.some(n("1")))));
        report("recovery-invalid-nested", status(() -> Api.present(new Option[]{Option.<BigInteger>none(), Option.some(n("10"))})));
        report("recovery-invalid-label", status(() -> Api.label(new String[]{"a"}, new BigInteger[]{n("4")})));
        report("recovery-valid-array", status(() -> Api.mirrorAll(new BigInteger[]{})));
        report("recovery-valid-list", status(() -> Api.sumHuge(new BigInteger[]{})));
        report("recovery-valid-option", status(() -> Api.orDefault(Option.<BigInteger>none())));
        report("recovery-valid-nested", status(() -> Api.present(new Option[]{Option.<BigInteger>none()})));
        report("recovery-valid-label", status(() -> Api.label(new String[]{"a"}, new BigInteger[]{n("0")})));
    }
}
