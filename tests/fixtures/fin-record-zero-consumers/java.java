import java.math.BigInteger;
import java.util.List;
import java.util.Objects;
import java.util.function.Function;
import java.util.function.Supplier;
import org.leanbridge.finrecordzero.Api;
import org.leanbridge.finrecordzero.Fields;
import org.leanbridge.finrecordzero.Zero;
final class Consumer {
    private Consumer() { }
    private static int checks;
    static void check(boolean value) { if (!value) throw new AssertionError("check " + checks); checks++; }
    static BigInteger n(long value) { return BigInteger.valueOf(value); }
    static Fields fields(String member, BigInteger digit) {
        return new Fields("kept", new BigInteger[]{n(7), BigInteger.ONE.shiftLeft(100)},
            member.equals("array") ? new BigInteger[]{digit} : new BigInteger[0], member.equals("list") ? new BigInteger[]{digit} : new BigInteger[0]);
    }
    static Fields fields() { return fields("", n(0)); }
    static Fields[] row() { return new Fields[]{fields(), fields(), fields()}; }
    static <T> boolean refused(Function<T, ?> call, Supplier<T> build, String path) {
        T value = build.get(), before = build.get();
        try { call.apply(value); }
        catch (IllegalArgumentException error) {
            return error.getMessage().equals(path + " is not below its Fin 0 bound") && Objects.deepEquals(value, before);
        }
        return false;
    }
    public static void main(String[] args) {
        for (Function<Zero[], Zero[]> call : List.<Function<Zero[], Zero[]>>of(Api::arrayRecords, Api::listRecords)) {
            check(call.apply(new Zero[0]).length == 0);
            for (BigInteger digit : List.of(n(0), n(1), BigInteger.ONE.shiftLeft(100)))
                check(refused(call, () -> new Zero[]{new Zero(digit)}, "arg0[0].digit"));
            check(call.apply(new Zero[0]).length == 0);
        }
        check(Api.fieldCollections(fields()).equals(fields()));
        for (String member : List.of("array", "list")) for (BigInteger digit : List.of(n(0), n(1), BigInteger.ONE.shiftLeft(100)))
            check(refused(Api::fieldCollections, () -> fields(member, digit), "arg0." + member + "[0]"));
        check(Api.fieldCollections(fields()).equals(fields()));
        for (Function<Fields[], Fields[]> call : List.<Function<Fields[], Fields[]>>of(Api::arrayFields, Api::listFields)) {
            check(call.apply(new Fields[0]).length == 0);
            check(Objects.deepEquals(call.apply(row()), row()));
            for (int index = 0; index < 3; index++) for (String member : List.of("array", "list")) {
                final int k = index;
                check(refused(call, () -> { Fields[] values = row(); values[k] = fields(member, n(0)); return values; }, "arg0[" + index + "]." + member + "[0]"));
                check(Objects.deepEquals(call.apply(row()), row()));
            }
        }
        for (int index = 0; index < 1000; index++) {
            check(Api.fieldCollections(fields()).equals(fields()));
            final BigInteger digit = n(index);
            String member = index % 2 == 0 ? "array" : "list";
            check(refused(Api::fieldCollections, () -> fields(member, digit), "arg0." + member + "[0]"));
        }
        System.out.println("fin-record-zero-ok:" + checks);
    }
}
