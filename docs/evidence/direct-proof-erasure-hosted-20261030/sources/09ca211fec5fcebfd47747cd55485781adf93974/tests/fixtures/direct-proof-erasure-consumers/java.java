import org.leanbridge.directprooferasure.Api;

final class Consumer {
    private Consumer() { }
    public static void main(String[] arguments) {
        if (arguments.length != 0) throw new AssertionError("unexpected arguments");
        int checks = 0;
        for (long value = 0; value < 1005; ++value) {
            if (Api.keep(value) != value) throw new AssertionError("payload changed");
            ++checks;
        }
        System.out.println("direct-proof-java:" + checks);
    }
}
