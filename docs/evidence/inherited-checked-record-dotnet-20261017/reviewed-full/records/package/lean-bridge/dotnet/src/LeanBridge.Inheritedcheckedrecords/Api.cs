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
/// <param name="Lo">Contract type: <c>nat</c>.</param>
/// <param name="Hi">Contract type: <c>nat</c>.</param>
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
/// <param name="ToSpan">Contract type: <c>Span</c>.</param>
/// <param name="Word">Contract type: <c>nat</c>.</param>
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
/// <param name="ToTicket">Contract type: <c>Ticket</c>.</param>
/// <param name="Mark">Contract type: <c>nat</c>.</param>
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
/// <remarks>Copied Lean aliases use their CLR target values. The binding manifest preserves their contract identities.
/// <list type="table">
/// <item><term><c>TicketAlias</c></term><description><c>Ticket</c> projects to <c>Ticket</c>.</description></item>
/// </list></remarks>
public static class Api
{
    /// <param name="value0">Contract type: <c>TicketAlias</c>.</param>
    /// <returns>Contract type: <c>nat</c>.</returns>
    /// <remarks>Checked Lean Fin bounds: value0 checked by InheritedCheckedRecords.mkTicket; value0.toSpan checked by InheritedCheckedRecords.normalizeSpan; value0.word checked by InheritedCheckedRecords.normalizeWord.</remarks>
    public static global::System.Numerics.BigInteger Aliased(Ticket @value0) => Interop.Runtime.Call0(@value0);
    /// <param name="value0">Contract type: <c>Ticket</c>.</param>
    /// <returns>Contract type: <c>Ticket</c>.</returns>
    /// <remarks>Checked Lean Fin bounds: value0 checked by InheritedCheckedRecords.normalizeTicket; value0.toSpan checked by InheritedCheckedRecords.mkSpan; value0.word checked by InheritedCheckedRecords.normalizeWord; result projects proof-backed record payload fields; result.toSpan projects proof-backed record payload fields; result.word projects the Subtype base value.</remarks>
    public static Ticket Echo(Ticket @value0) => Interop.Runtime.Call1(@value0);
    /// <param name="value0">Contract type: <c>Ticket</c>.</param>
    /// <returns>Contract type: <c>nat</c>.</returns>
    /// <remarks>Checked Lean Fin bounds: value0 checked by InheritedCheckedRecords.mkTicket; value0.toSpan checked by InheritedCheckedRecords.mkSpan; value0.word checked by InheritedCheckedRecords.mkWord.</remarks>
    public static global::System.Numerics.BigInteger First(Ticket @value0) => Interop.Runtime.Call2(@value0);
    /// <param name="value0">Contract type: <c>Stamped</c>.</param>
    /// <returns>Contract type: <c>nat</c>.</returns>
    /// <remarks>Checked Lean Fin bounds: value0 checked by InheritedCheckedRecords.mkStamped; value0.toTicket checked by InheritedCheckedRecords.mkTicket; value0.toTicket.toSpan checked by InheritedCheckedRecords.mkSpan; value0.toTicket.word checked by InheritedCheckedRecords.mkWord; value0.mark &lt; 8.</remarks>
    public static global::System.Numerics.BigInteger Nested(Stamped @value0) => Interop.Runtime.Call3(@value0);
    /// <param name="value0">Contract type: <c>Ticket</c>.</param>
    /// <returns>Contract type: <c>nat</c>.</returns>
    /// <remarks>Checked Lean Fin bounds: value0 checked by InheritedCheckedRecords.normalizeTicket; value0.toSpan checked by InheritedCheckedRecords.normalizeSpan; value0.word checked by InheritedCheckedRecords.normalizeWord.</remarks>
    public static global::System.Numerics.BigInteger Normalized(Ticket @value0) => Interop.Runtime.Call4(@value0);
    /// <param name="value0">Contract type: <c>Ticket</c>.</param>
    /// <param name="value1">Contract type: <c>Ticket</c>.</param>
    /// <returns>Contract type: <c>nat</c>.</returns>
    /// <remarks>Checked Lean Fin bounds: value0 checked by InheritedCheckedRecords.mkTicket; value0.toSpan checked by InheritedCheckedRecords.mkSpan; value0.word checked by InheritedCheckedRecords.mkWord; value1 checked by InheritedCheckedRecords.normalizeTicket; value1.toSpan checked by InheritedCheckedRecords.normalizeSpan; value1.word checked by InheritedCheckedRecords.normalizeWord.</remarks>
    public static global::System.Numerics.BigInteger Pair(Ticket @value0, Ticket @value1) => Interop.Runtime.Call5(@value0, @value1);
    /// <param name="value0">Contract type: <c>nat</c>.</param>
    /// <returns>Contract type: <c>Ticket</c>.</returns>
    /// <remarks>Checked Lean Fin bounds: result projects proof-backed record payload fields; result.toSpan projects proof-backed record payload fields; result.word projects the Subtype base value.</remarks>
    public static Ticket Produce(global::System.Numerics.BigInteger @value0) => Interop.Runtime.Call6(@value0);
    /// <param name="value0">Contract type: <c>nat</c>.</param>
    /// <returns>Contract type: <c>Stamped</c>.</returns>
    /// <remarks>Checked Lean Fin bounds: result projects proof-backed record payload fields; result.toTicket projects proof-backed record payload fields; result.toTicket.toSpan projects proof-backed record payload fields; result.toTicket.word projects the Subtype base value; result.mark &lt; 8.</remarks>
    public static Stamped ProduceStamped(global::System.Numerics.BigInteger @value0) => Interop.Runtime.Call7(@value0);
}
