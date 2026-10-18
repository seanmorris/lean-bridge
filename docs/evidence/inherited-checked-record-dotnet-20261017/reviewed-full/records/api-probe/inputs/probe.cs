using LeanBridge.Inheritedcheckedrecords;
namespace InheritedCheckedRecordProbe;
public static class Probe
{
    public const string Method0 = nameof(Api.First);
    public const string Method1 = nameof(Api.Normalized);
    public const string Method2 = nameof(Api.Pair);
    public const string Method3 = nameof(Api.Aliased);
    public const string Method4 = nameof(Api.Nested);
    public const string Method5 = nameof(Api.Echo);
    public const string ProduceMethod = nameof(Api.Produce);
    public const string ProduceStampedMethod = nameof(Api.ProduceStamped);
    public static Span? SpanValue => null;
    public static Ticket? TicketValue => null;
    public static Stamped? StampedValue => null;
}
