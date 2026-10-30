import org.leanbridge.host_null_demo.Api;
import org.leanbridge.host_null_demo.Option;
import org.leanbridge.host_null_demo.Packet;

final class Consumer {
    private static int checks;
    private static void check(boolean condition, String message) {
        ++checks;
        if (!condition) throw new AssertionError(message);
    }
    public static void main(String[] args) {
        check(Api.echo(null) == null, "direct null");
        check(Api.echo(42L).equals(42L), "direct value");
        check(Api.nullableOption(null) == null, "nullable Option null");
        check(Api.nullableOption(Option.none()).equals(Option.none()), "nullable Option none");
        check(Api.nullableOption(Option.some(42L)).equals(Option.some(42L)), "nullable Option some");
        check(Api.optionalNullable(Option.none()).equals(Option.none()), "optional nullable none");
        check(Api.optionalNullable(Option.some(null)).equals(Option.some(null)), "optional nullable null");
        check(Api.optionalNullable(Option.some(42L)).equals(Option.some(42L)), "optional nullable value");

        var packet = new Packet(null, Option.none(), Option.some(null));
        var echoed = Api.echoPacket(packet);
        check(echoed.direct() == null, "record direct null");
        check(echoed.nullableOption().equals(Option.none()), "record nullable Option");
        check(echoed.optionalNullable().equals(Option.some(null)), "record optional nullable");
        check(echoed.equals(packet), "record equality");

        var callbackCalls = new int[] { 0 };
        check(Api.callHost(null, value -> {
            ++callbackCalls[0];
            check(value == null, "callback null parameter");
            return Option.none();
        }).equals(Option.none()), "callback tagged result");
        check(Api.callHost(42L, value -> {
            ++callbackCalls[0];
            check(value.equals(42L), "callback value parameter");
            return null;
        }) == null, "callback null result");
        check(callbackCalls[0] == 2, "callback count");

        var closure = Api.makeClosure(Option.some(77L));
        check(!closure.isClosed(), "closure initially open");
        check(closure.invoke(null).equals(Option.some(77L)), "closure null parameter");
        check(closure.invoke(2L).equals(Option.some(77L)), "closure value parameter");
        closure.close();
        check(closure.isClosed(), "closure closed");
        var rejected = false;
        try { closure.invoke(null); }
        catch (IllegalStateException error) { rejected = true; }
        check(rejected, "closed closure rejected");

        System.out.println("host-null-java:" + checks);
    }
}
