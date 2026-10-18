namespace LeanBridge.Inheritedcheckedrecords;

/// <summary>The sole runtime value of Lean Unit.</summary>
public readonly record struct Unit;

/// <summary>A failure reported by a compiled Lean call.</summary>
public sealed class LeanBridgeException : global::System.Exception
{
    public int Status { get; }
    internal LeanBridgeException(int status, string message) : base(message) => Status = status;
}
/// <summary>A copied Lean record.</summary>
public sealed record Span(global::System.Numerics.BigInteger Lo, global::System.Numerics.BigInteger Hi)
{
    public bool Equals(Span? other) => other is not null
        && global::System.Collections.StructuralComparisons.StructuralEqualityComparer.Equals(Lo, other.Lo)
        && global::System.Collections.StructuralComparisons.StructuralEqualityComparer.Equals(Hi, other.Hi);
    public override int GetHashCode()
    {
        var hash = new global::System.HashCode();
        hash.Add(typeof(Span));
        hash.Add(global::System.Collections.StructuralComparisons.StructuralEqualityComparer.GetHashCode(Lo!));
        hash.Add(global::System.Collections.StructuralComparisons.StructuralEqualityComparer.GetHashCode(Hi!));
        return hash.ToHashCode();
    }
}
/// <summary>A copied Lean record.</summary>
public sealed record Ticket(Span ToSpan, global::System.Numerics.BigInteger Word)
{
    public bool Equals(Ticket? other) => other is not null
        && global::System.Collections.StructuralComparisons.StructuralEqualityComparer.Equals(ToSpan, other.ToSpan)
        && global::System.Collections.StructuralComparisons.StructuralEqualityComparer.Equals(Word, other.Word);
    public override int GetHashCode()
    {
        var hash = new global::System.HashCode();
        hash.Add(typeof(Ticket));
        hash.Add(global::System.Collections.StructuralComparisons.StructuralEqualityComparer.GetHashCode(ToSpan!));
        hash.Add(global::System.Collections.StructuralComparisons.StructuralEqualityComparer.GetHashCode(Word!));
        return hash.ToHashCode();
    }
}
/// <summary>A copied Lean record.</summary>
public sealed record Stamped(Ticket ToTicket, global::System.Numerics.BigInteger Mark)
{
    public bool Equals(Stamped? other) => other is not null
        && global::System.Collections.StructuralComparisons.StructuralEqualityComparer.Equals(ToTicket, other.ToTicket)
        && global::System.Collections.StructuralComparisons.StructuralEqualityComparer.Equals(Mark, other.Mark);
    public override int GetHashCode()
    {
        var hash = new global::System.HashCode();
        hash.Add(typeof(Stamped));
        hash.Add(global::System.Collections.StructuralComparisons.StructuralEqualityComparer.GetHashCode(ToTicket!));
        hash.Add(global::System.Collections.StructuralComparisons.StructuralEqualityComparer.GetHashCode(Mark!));
        return hash.ToHashCode();
    }
}

/// <summary>The functions selected by the Lean package author.</summary>
public static class Api
{
    /// <remarks>Checked Lean Fin bounds: result projects proof-backed record payload fields; result.toSpan projects proof-backed record payload fields; result.word projects the Subtype base value.</remarks>
    public static Ticket Produce(global::System.Numerics.BigInteger @value0) => Interop.Runtime.Call0(@value0);
    /// <remarks>Checked Lean Fin bounds: result projects proof-backed record payload fields; result.toTicket projects proof-backed record payload fields; result.toTicket.toSpan projects proof-backed record payload fields; result.toTicket.word projects the Subtype base value; result.mark &lt; 8.</remarks>
    public static Stamped ProduceStamped(global::System.Numerics.BigInteger @value0) => Interop.Runtime.Call1(@value0);
}
