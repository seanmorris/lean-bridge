using LeanBridge.Checkedrecordvalueindices;
namespace CheckedRecordValueIndexProbe;
public static class Probe
{
    public const string Method0 = nameof(Api.TrueBoolIndex);
    public const string Method1 = nameof(Api.FalseBoolIndex);
    public const string Method2 = nameof(Api.AbStringIndex);
    public const string Method3 = nameof(Api.EmptyStringIndex);
    public const string Method4 = nameof(Api.UnicodeStringIndex);
    public const string Method5 = nameof(Api.EmptySizedIndex);
    public const string Method6 = nameof(Api.ZeroNatIndex);
    public const string Method7 = nameof(Api.WideNatIndex);
    public const string Result0 = nameof(Api.ProduceTrueBool);
    public const string Result1 = nameof(Api.ProduceFalseBool);
    public const string Result2 = nameof(Api.ProduceAb);
    public const string Result3 = nameof(Api.ProduceEmptyString);
    public const string Result4 = nameof(Api.ProduceUnicodeString);
    public const string Result5 = nameof(Api.ProduceEmptySized);
    public const string Result6 = nameof(Api.ProduceZeroNat);
    public const string Result7 = nameof(Api.ProduceWideNat);
    public static On? OnValue => null;
    public static Off? OffValue => null;
    public static Ab? AbValue => null;
    public static EmptyToken? EmptyTokenValue => null;
    public static UnicodeToken? UnicodeTokenValue => null;
    public static EmptySized? EmptySizedValue => null;
    public static ZeroToken? ZeroTokenValue => null;
    public static WideToken? WideTokenValue => null;
}
