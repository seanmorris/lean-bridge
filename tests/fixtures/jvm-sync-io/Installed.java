import java.math.BigInteger;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.concurrent.*;
import org.leanbridge.journal.*;

class Installed {
    static void check(boolean ok) { if (!ok) throw new AssertionError(); }
    static void invalid(Runnable call) {
        try { call.run(); throw new AssertionError("accepted an invalid value"); }
        catch (IllegalArgumentException | NullPointerException expected) { }
    }
    static long tid(String stat) { return Long.parseLong(stat.substring(0, stat.indexOf(' '))); }
    public static void main(String[] args) throws Throwable {
        final String key = "lean.bridge.jvm.native-library-v1.runtime";
        invalid(() -> Api.rtUint8(-1)); invalid(() -> Api.rtUint8(256));
        invalid(() -> Api.rtUint16(65536)); invalid(() -> Api.rtUint32(1L << 32));
        invalid(() -> Api.rtUint64(BigInteger.ONE.shiftLeft(64))); invalid(() -> Api.rtNat(BigInteger.ONE.negate()));
        invalid(() -> Api.rtChar(0xd800)); invalid(() -> Api.rtString("\uD800")); invalid(() -> Api.rtString(null));
        invalid(() -> Api.rtBytes(new byte[16 * 1024 * 1024 + 1])); check(System.getProperty(key) == null);
        if ("peer-first".equals(args[0])) check(org.leanbridge.clock.Api.read() == 71);
        check(Api.count() == 0 && Api.bump(2) == 2 && Api.echo(0xffffffffL) == 0xffffffffL);
        BigInteger n = BigInteger.ONE.shiftLeft(20000).add(BigInteger.valueOf(37));
        BigInteger u64 = BigInteger.ONE.shiftLeft(64).subtract(BigInteger.ONE);
        check(Api.rtNat(n).equals(n) && Api.rtInt(n.negate()).equals(n.negate()) && Api.rtNat(BigInteger.ZERO).signum() == 0);
        check(Api.rtUint64(u64).equals(u64) && Api.rtUsize(u64).equals(u64) && Api.rtIsize(Long.MIN_VALUE) == Long.MIN_VALUE);
        check(Api.rtBool(true) && !Api.rtBool(false) && Api.rtChar(0x1f98a) == 0x1f98a);
        Api.rtUnit(Unit.INSTANCE); check(Api.rtUint8(255) == 255 && Api.rtUint16(65535) == 65535 && Api.rtUint32(0xffffffffL) == 0xffffffffL);
        check(Api.rtInt8(Byte.MIN_VALUE) == Byte.MIN_VALUE && Api.rtInt16(Short.MIN_VALUE) == Short.MIN_VALUE
            && Api.rtInt32(Integer.MIN_VALUE) == Integer.MIN_VALUE && Api.rtInt64(Long.MIN_VALUE) == Long.MIN_VALUE);
        check(Float.floatToRawIntBits(Api.rtFloat32(-0f)) == Float.floatToRawIntBits(-0f) && Api.rtFloat64(Double.NEGATIVE_INFINITY) == Double.NEGATIVE_INFINITY);
        String text = "λ\0🦊"; byte[] bytes = {0, 1, -1}; check(Api.rtString(text).equals(text));
        byte[] copied = Api.rtBytes(bytes); bytes[1] = 22; check(copied[1] == 1 && copied != bytes);
        check(Api.choose(false, true, text).equals(new Result.Ok<>(text)));
        check(Api.choose(false, false, text).equals(new Result.Err<>(37L)));
        for (boolean tag : new boolean[]{true, false}) {
            try { Api.choose(true, tag, text); throw new AssertionError("lost EIO"); }
            catch (ChooseError e) {
                Result<String,Long> payload = e.payload(); check(e.declaration().equals("Journal.choose"));
                check(payload.equals(Api.choose(false, tag, text)));
            }
        }
        check(Api.nested(false, 1, n, text, bytes).equals(new Result.Err<>(new Result.Ok<>(n))));
        try { Api.nested(true, 2, n, text, bytes); throw new AssertionError(); }
        catch (NestedError e) {
            Result<String, Result<BigInteger, byte[]>> p = e.payload();
            check(p instanceof Result.Err<?,?> v && v.error() instanceof Result.Err<?,?> w && w.error() instanceof byte[] b && Arrays.equals(b, bytes) && b != bytes);
        }
        Path file = Path.of(args[1]); Api.store(file.toString(), text); check(Api.read(file.toString()).equals(text));
        try { Api.read(file + ".missing"); throw new AssertionError(); }
        catch (LeanIOException e) { check(e.declaration().equals("Journal.read") && e.getCause().getMessage().contains("missing")); }
        long owner = tid(Api.owner()), caller = tid(Files.readString(Path.of("/proc/thread-self/stat")));
        check(owner != caller && owner != ProcessHandle.current().pid() && owner == tid(org.leanbridge.clock.Api.owner()));
        try (var pool = Executors.newFixedThreadPool(3); var virtual = Executors.newVirtualThreadPerTaskExecutor()) {
            var jobs = new java.util.ArrayList<Future<?>>();
            for (int i = 0; i < 24; ++i) jobs.add((i % 2 == 0 ? pool : virtual).submit(() -> {
                check(tid(Api.owner()) == owner && tid(org.leanbridge.clock.Api.owner()) == owner);
                Api.bump(1);
            }));
            for (var job : jobs) job.get(15, TimeUnit.SECONDS);
        }
        check(Api.count() == 26 && Files.readString(file).equals(text));
        try (var peer = new java.net.URLClassLoader(new java.net.URL[]{Path.of(args[2]).toUri().toURL()}, ClassLoader.getPlatformClassLoader())) {
            var other = Class.forName("org.leanbridge.journal.Api", true, peer);
            check(other != Api.class && (long)other.getMethod("count").invoke(null) == 26L);
        }
        Observer.verifyAndRetire("peer-first".equals(args[0]));
        try { Api.bump(1); throw new AssertionError("retired runtime reused"); }
        catch (IllegalStateException e) { check(e.getMessage().contains("unavailable")); }
        System.out.println("Java: 19 scalars, typed returns and failures, file IO, one owner, 24 concurrent calls, zero native identities, retirement");
    }
}
