using LeanBridge.Nestedcheckedrecords;
namespace NestedCheckedRecordProbe;
public static class Probe
{
    public const string Method0 = nameof(Api.First);
    public const string Method1 = nameof(Api.Second);
    public const string Method2 = nameof(Api.Pair);
    public const string Method3 = nameof(Api.InArray);
    public const string Method4 = nameof(Api.InList);
    public const string Method5 = nameof(Api.InOption);
    public const string Method6 = nameof(Api.InProduct);
    public const string Method7 = nameof(Api.InExcept);
    public const string Method8 = nameof(Api.InHolder);
    public const string Method9 = nameof(Api.InChoice);
    public const string Method10 = nameof(Api.EchoArray);
    public static Packet? PacketValue => null;
    public static Option<Packet> OptionValue => default;
    public static Result<Packet, Packet> ResultValue => default;
    public static Holder? HolderValue => null;
    public static Choice? ChoiceValue => null;
    public static ChoiceEmpty? ChoiceEmptyValue => null;
    public static ChoicePacket? ChoicePacketValue => null;
}
