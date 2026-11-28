#if WRONG_METER
using A = LeanBridge.Workshop;

internal static class WrongMeter {
    static void Apply(A.Bound<Meter> owner,A.Pair<object> pair) {
        owner.Flip(pair);
    }
}
#endif
