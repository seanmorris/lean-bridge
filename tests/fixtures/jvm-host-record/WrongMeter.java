import org.leanbridge.workshop.Api;
import org.leanbridge.workshop.Pair;
final class WrongMeter {
    static void call(Api.Bound<Installed.Meter> binding,Pair<Object> foreign) throws Exception {
        binding.flip(foreign);
    }
}
