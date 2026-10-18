namespace LeanBridge.Checkedrecordvalueindices;

/// <summary>The sole runtime value of Lean Unit.</summary>
public readonly record struct Unit;

/// <summary>A failure reported by a compiled Lean call.</summary>
public sealed class LeanBridgeException : global::System.Exception
{
    public int Status { get; }
    internal LeanBridgeException(int status, string message) : base(message) => Status = status;
}
/// <summary>A copied Lean record.</summary>
public sealed record Ab(global::System.Numerics.BigInteger Size)
{
    public bool Equals(Ab? other) => other is not null
        && global::System.Collections.StructuralComparisons.StructuralEqualityComparer.Equals(Size, other.Size);
    public override int GetHashCode()
    {
        var hash = new global::System.HashCode();
        hash.Add(typeof(Ab));
        hash.Add(global::System.Collections.StructuralComparisons.StructuralEqualityComparer.GetHashCode(Size!));
        return hash.ToHashCode();
    }
}
/// <summary>A copied Lean record.</summary>
public sealed record EmptySized(global::System.Numerics.BigInteger[] Data)
{
    public bool Equals(EmptySized? other) => other is not null
        && global::System.Collections.StructuralComparisons.StructuralEqualityComparer.Equals(Data, other.Data);
    public override int GetHashCode()
    {
        var hash = new global::System.HashCode();
        hash.Add(typeof(EmptySized));
        hash.Add(global::System.Collections.StructuralComparisons.StructuralEqualityComparer.GetHashCode(Data!));
        return hash.ToHashCode();
    }
}
/// <summary>A copied Lean record.</summary>
public sealed record EmptyToken(global::System.Numerics.BigInteger Count)
{
    public bool Equals(EmptyToken? other) => other is not null
        && global::System.Collections.StructuralComparisons.StructuralEqualityComparer.Equals(Count, other.Count);
    public override int GetHashCode()
    {
        var hash = new global::System.HashCode();
        hash.Add(typeof(EmptyToken));
        hash.Add(global::System.Collections.StructuralComparisons.StructuralEqualityComparer.GetHashCode(Count!));
        return hash.ToHashCode();
    }
}
/// <summary>A copied Lean record.</summary>
public sealed record Off(global::System.Numerics.BigInteger Count)
{
    public bool Equals(Off? other) => other is not null
        && global::System.Collections.StructuralComparisons.StructuralEqualityComparer.Equals(Count, other.Count);
    public override int GetHashCode()
    {
        var hash = new global::System.HashCode();
        hash.Add(typeof(Off));
        hash.Add(global::System.Collections.StructuralComparisons.StructuralEqualityComparer.GetHashCode(Count!));
        return hash.ToHashCode();
    }
}
/// <summary>A copied Lean record.</summary>
public sealed record On(global::System.Numerics.BigInteger Count)
{
    public bool Equals(On? other) => other is not null
        && global::System.Collections.StructuralComparisons.StructuralEqualityComparer.Equals(Count, other.Count);
    public override int GetHashCode()
    {
        var hash = new global::System.HashCode();
        hash.Add(typeof(On));
        hash.Add(global::System.Collections.StructuralComparisons.StructuralEqualityComparer.GetHashCode(Count!));
        return hash.ToHashCode();
    }
}
/// <summary>A copied Lean record.</summary>
public sealed record UnicodeToken(global::System.Numerics.BigInteger Count)
{
    public bool Equals(UnicodeToken? other) => other is not null
        && global::System.Collections.StructuralComparisons.StructuralEqualityComparer.Equals(Count, other.Count);
    public override int GetHashCode()
    {
        var hash = new global::System.HashCode();
        hash.Add(typeof(UnicodeToken));
        hash.Add(global::System.Collections.StructuralComparisons.StructuralEqualityComparer.GetHashCode(Count!));
        return hash.ToHashCode();
    }
}
/// <summary>A copied Lean record.</summary>
public sealed record WideToken(global::System.Numerics.BigInteger Count)
{
    public bool Equals(WideToken? other) => other is not null
        && global::System.Collections.StructuralComparisons.StructuralEqualityComparer.Equals(Count, other.Count);
    public override int GetHashCode()
    {
        var hash = new global::System.HashCode();
        hash.Add(typeof(WideToken));
        hash.Add(global::System.Collections.StructuralComparisons.StructuralEqualityComparer.GetHashCode(Count!));
        return hash.ToHashCode();
    }
}
/// <summary>A copied Lean record.</summary>
public sealed record ZeroToken(global::System.Numerics.BigInteger Count)
{
    public bool Equals(ZeroToken? other) => other is not null
        && global::System.Collections.StructuralComparisons.StructuralEqualityComparer.Equals(Count, other.Count);
    public override int GetHashCode()
    {
        var hash = new global::System.HashCode();
        hash.Add(typeof(ZeroToken));
        hash.Add(global::System.Collections.StructuralComparisons.StructuralEqualityComparer.GetHashCode(Count!));
        return hash.ToHashCode();
    }
}

/// <summary>The functions selected by the Lean package author.</summary>
public static class Api
{
    /// <remarks>Checked Lean Fin bounds: result projects proof-backed record payload fields.</remarks>
    public static Ab ProduceAb() => Interop.Runtime.Call0();
    /// <remarks>Checked Lean Fin bounds: result projects proof-backed record payload fields.</remarks>
    public static EmptySized ProduceEmptySized() => Interop.Runtime.Call1();
    /// <remarks>Checked Lean Fin bounds: result projects proof-backed record payload fields.</remarks>
    public static EmptyToken ProduceEmptyString(global::System.Numerics.BigInteger @value0) => Interop.Runtime.Call2(@value0);
    /// <remarks>Checked Lean Fin bounds: result projects proof-backed record payload fields.</remarks>
    public static Off ProduceFalseBool() => Interop.Runtime.Call3();
    /// <remarks>Checked Lean Fin bounds: result projects proof-backed record payload fields.</remarks>
    public static On ProduceTrueBool() => Interop.Runtime.Call4();
    /// <remarks>Checked Lean Fin bounds: result projects proof-backed record payload fields.</remarks>
    public static UnicodeToken ProduceUnicodeString(global::System.Numerics.BigInteger @value0) => Interop.Runtime.Call5(@value0);
    /// <remarks>Checked Lean Fin bounds: result projects proof-backed record payload fields.</remarks>
    public static WideToken ProduceWideNat(global::System.Numerics.BigInteger @value0) => Interop.Runtime.Call6(@value0);
    /// <remarks>Checked Lean Fin bounds: result projects proof-backed record payload fields.</remarks>
    public static ZeroToken ProduceZeroNat(global::System.Numerics.BigInteger @value0) => Interop.Runtime.Call7(@value0);
}
