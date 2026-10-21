// Independent installed Java checks for generic Subtype compositions.
import java.math.BigInteger;
import java.util.function.Function;
import org.leanbridge.nominalsubtypes.*;

final class Consumer {
    static int checks, rejections;
    static BigInteger n(long value) { return BigInteger.valueOf(value); }
    static GenericNat generic(long value, long marker) { return new GenericNat(n(value), n(marker)); }
    static String snapshot(GenericNat value) { return value.value() + ":" + value.marker(); }
    static void check(boolean condition, String label) {
        if (!condition) throw new AssertionError("failed: " + label); checks++;
    }
    static void call(String name, GenericNat input, Function<GenericNat, GenericNat> action, GenericNat expected) {
        String before = snapshot(input); GenericNat result = action.apply(input);
        check(snapshot(result).equals(snapshot(expected)), name + " exact copied result");
        check(snapshot(input).equals(before), name + " input unchanged");
    }
    static void scalar(GenericNat input, BigInteger expected) {
        String before = snapshot(input);
        check(Api.genericUse(input).equals(expected), "genericUse exact result");
        check(snapshot(input).equals(before), "genericUse input unchanged");
    }
    static <T> void refused(String name, GenericNat input, Function<GenericNat, T> action, String constructor) {
        String before = snapshot(input);
        String expected = "arg0.value was rejected by NominalSubtypes." + constructor;
        try { action.apply(input); throw new AssertionError("accepted: " + expected); }
        catch (IllegalArgumentException error) {
            check(error.getClass() == IllegalArgumentException.class && expected.equals(error.getMessage()), name + " exact refusal");
        }
        check(snapshot(input).equals(before), name + " rejected input unchanged"); rejections++;
    }
    public static void main(String[] arguments) {
        if (arguments.length != 0) throw new AssertionError("Unexpected caller arguments");
        scalar(generic(40, 2), n(43));
        call("echoGenericFirst", generic(40, 2), Api::echoGenericFirst, generic(41, 2));
        call("echoGenericSecond", generic(40, 2), Api::echoGenericSecond, generic(42, 2));
        scalar(generic(99, 7), n(107));
        call("echoGenericFirst", generic(99, 7), Api::echoGenericFirst, generic(100, 7));
        refused("genericUse", generic(100, 2), Api::genericUse, "plusOne");
        refused("echoGenericFirst", generic(100, 2), Api::echoGenericFirst, "plusOne");
        refused("echoGenericSecond", generic(90, 2), Api::echoGenericSecond, "plusTwo");
        call("echoGenericSecond", generic(40, 2), Api::echoGenericSecond, generic(42, 2));
        System.out.println("{\"checks\":" + checks + ",\"rejections\":" + rejections + "}");
    }
}
