import java.util.Arrays;
import org.leanbridge.glyphs.Api;
import org.leanbridge.glyphs.Label;
class Consumer {
    static int checks;
    static void check(boolean value) { if (!value) throw new AssertionError("Char check failed"); ++checks; }
    public static void main(String[] args) {
        int[] values = {__POINTS__};
        for (int value : values) {
            check(Api.keep(value) == value);
            check(Api.point(value) == value);
            check(Api.text(value).equals(new String(Character.toChars(value))));
            check(Api.choose(true, value, 'x') == value);
            check(Api.choose(false, 'x', value) == value);
            check(Arrays.equals(Api.keepArray(values), values));
            Label label = Api.keepLabel(new Label(value, values));
            check(label.marker() == value && Arrays.equals(label.line(), values));
            check(Arrays.deepEquals(Api.keepRows(new int[][]{values, {}, {value}}), new int[][]{values, {}, {value}}));
        }
        check(Api.sprout() == 0x1f331);
        check(Api.keepArray(new int[0]).length == 0);
        for (int bad : new int[]{-1, 0xd800, 0xdfff, 0x110000, Integer.MAX_VALUE}) {
            for (Runnable call : new Runnable[]{() -> Api.keep(bad), () -> Api.keepArray(new int[]{65, bad}),
                    () -> Api.keepRows(new int[][]{{65}, {bad}}),
                    () -> Api.keepLabel(new Label(bad, values)), () -> Api.keepLabel(new Label(65, new int[]{bad}))}) {
                boolean rejected = false;
                try { call.run(); } catch (IllegalArgumentException error) { rejected = true; }
                check(rejected); check(Api.keep(0x1f331) == 0x1f331);
            }
        }
        for (int i = 0; i < 1000; ++i) check(Arrays.equals(Api.keepRows(new int[][]{values, values})[1], values));
        System.out.println("char-ok:" + checks);
    }
}
