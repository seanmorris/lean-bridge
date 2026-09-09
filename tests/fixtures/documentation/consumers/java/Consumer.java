import java.util.Arrays;
import org.leanbridge.alpha.Alpha;
import org.leanbridge.alpha.Box;
import org.leanbridge.alpha.CallbackThrewException;
import org.leanbridge.alpha.DisposedResourceException;
import org.leanbridge.alpha.OwnedTransform;
import org.leanbridge.alpha.Payload;

public final class Consumer {
    private static void check(boolean condition, String message) {
        if (!condition) throw new IllegalStateException(message);
    }

    public static void main(String[] args) {
        try (Box box = new Box(42L); OwnedTransform adder = Alpha.makeAdder(2L)) {
            check(box.read() == 42L && box.identity() == box, "Box identity");
            System.out.println("Box: " + box.read());

            Payload payload = Alpha.roundTrip(new Payload(
                true, 41L, "Lean λ", new byte[]{0, (byte)255}, new long[]{0L, 0xffff_ffffL}));
            check(!payload.enabled() && payload.count() == 42L && payload.label().equals("Lean λ")
                && Arrays.equals(payload.bytes(), new byte[]{0, (byte)255})
                && Arrays.equals(payload.values(), new long[]{0L, 0xffff_ffffL}), "Payload");
            System.out.println("Payload count: " + payload.count());

            long callback = Alpha.withCallback(40L, value -> value + 2L);
            check(callback == 44L, "Callback result");
            System.out.println("Callback: " + callback);
            check(adder.apply(40L) == 42L, "Returned callable");
            System.out.println("Callable: " + adder.apply(40L));

            try {
                Alpha.withCallback(40L, value -> { throw new IllegalStateException("callback marker"); });
                throw new IllegalStateException("Callback failure was accepted");
            } catch (CallbackThrewException error) {
                check(error.getCause() instanceof IllegalStateException
                    && error.getCause().getMessage().equals("callback marker"), "Callback cause");
            }

            adder.close();
            adder.close();
            box.close();
            box.close();
            try {
                box.read();
                throw new IllegalStateException("Closed Box was accepted");
            } catch (DisposedResourceException expected) { }
            try {
                adder.apply(40L);
                throw new IllegalStateException("Closed callable was accepted");
            } catch (DisposedResourceException expected) { }
            System.out.println("Errors and cleanup: passed");
        }
    }
}
