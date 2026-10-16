namespace LeanBridge.Nestedcheckedrecords;

/// <summary>The sole runtime value of Lean Unit.</summary>
public readonly record struct Unit;
/// <summary>A copied Lean Option. Default is None; Some retains its payload, including nested None.</summary>
public readonly record struct Option<T>
{
    private readonly T value;
    private Option(T value) { this.value = value; IsSome = true; }
    public bool IsSome { get; }
    public bool IsNone => !IsSome;
    public T Value => IsSome ? value : throw new global::System.InvalidOperationException("None has no value");
    public static Option<T> None => default;
    public static Option<T> Some(T value) => new(value);
    public bool Equals(Option<T> other) => IsSome == other.IsSome
        && (!IsSome || global::System.Collections.StructuralComparisons.StructuralEqualityComparer.Equals(value, other.value));
    public override int GetHashCode() => global::System.HashCode.Combine(IsSome,
        IsSome ? global::System.Collections.StructuralComparisons.StructuralEqualityComparer.GetHashCode(value!) : 0);
    public override string ToString() => IsSome ? $"Some({value})" : "None";
}
/// <summary>A copied Lean Except. Use Ok or Err; default has no branch and cannot cross the boundary.</summary>
public readonly record struct Result<T, E>
{
    private readonly byte state;
    private readonly T value;
    private readonly E error;
    private Result(byte state, T value, E error) { this.state = state; this.value = value; this.error = error; }
    public bool IsOk => state == 1;
    public bool IsError => state == 2;
    public bool IsInitialized => IsOk || IsError;
    public T Value => IsOk ? value : throw new global::System.InvalidOperationException("Result has no success value");
    public E Error => IsError ? error : throw new global::System.InvalidOperationException("Result has no error value");
    public static Result<T, E> Ok(T value) => new(1, value, default!);
    public static Result<T, E> Err(E error) => new(2, default!, error);
    public bool Equals(Result<T, E> other) => state == other.state && (state switch
    {
        1 => global::System.Collections.StructuralComparisons.StructuralEqualityComparer.Equals(value, other.value),
        2 => global::System.Collections.StructuralComparisons.StructuralEqualityComparer.Equals(error, other.error),
        _ => true
    });
    public override int GetHashCode() => global::System.HashCode.Combine(state, state switch
    {
        1 => global::System.Collections.StructuralComparisons.StructuralEqualityComparer.GetHashCode(value!),
        2 => global::System.Collections.StructuralComparisons.StructuralEqualityComparer.GetHashCode(error!),
        _ => 0
    });
    public override string ToString() => IsOk ? $"Ok({value})" : IsError ? $"Err({error})" : "Uninitialized Result";
}

/// <summary>A failure reported by a compiled Lean call.</summary>
public sealed class LeanBridgeException : global::System.Exception
{
    public int Status { get; }
    internal LeanBridgeException(int status, string message) : base(message) => Status = status;
}
/// <summary>A copied Lean record.</summary>
public sealed record Packet(global::System.Numerics.BigInteger Digit, global::System.Numerics.BigInteger Word)
{
    public bool Equals(Packet? other) => other is not null
        && global::System.Collections.StructuralComparisons.StructuralEqualityComparer.Equals(Digit, other.Digit)
        && global::System.Collections.StructuralComparisons.StructuralEqualityComparer.Equals(Word, other.Word);
    public override int GetHashCode()
    {
        var hash = new global::System.HashCode();
        hash.Add(typeof(Packet));
        hash.Add(global::System.Collections.StructuralComparisons.StructuralEqualityComparer.GetHashCode(Digit!));
        hash.Add(global::System.Collections.StructuralComparisons.StructuralEqualityComparer.GetHashCode(Word!));
        return hash.ToHashCode();
    }
}
/// <summary>A copied Lean variant. Construct a named case.</summary>
public abstract record Choice
{
    private protected Choice() { }
}
/// <summary>A named Choice constructor.</summary>
public sealed record ChoiceEmpty() : Choice
{
    public bool Equals(ChoiceEmpty? other) => other is not null;
    public override int GetHashCode()
    {
        var hash = new global::System.HashCode();
        hash.Add(typeof(ChoiceEmpty));

        return hash.ToHashCode();
    }
}
/// <summary>A named Choice constructor.</summary>
public sealed record ChoicePacket(Packet Value) : Choice
{
    public bool Equals(ChoicePacket? other) => other is not null
        && global::System.Collections.StructuralComparisons.StructuralEqualityComparer.Equals(Value, other.Value);
    public override int GetHashCode()
    {
        var hash = new global::System.HashCode();
        hash.Add(typeof(ChoicePacket));
        hash.Add(global::System.Collections.StructuralComparisons.StructuralEqualityComparer.GetHashCode(Value!));
        return hash.ToHashCode();
    }
}
/// <summary>A copied Lean record.</summary>
public sealed record Holder(Packet Packet, global::System.Numerics.BigInteger Tag)
{
    public bool Equals(Holder? other) => other is not null
        && global::System.Collections.StructuralComparisons.StructuralEqualityComparer.Equals(Packet, other.Packet)
        && global::System.Collections.StructuralComparisons.StructuralEqualityComparer.Equals(Tag, other.Tag);
    public override int GetHashCode()
    {
        var hash = new global::System.HashCode();
        hash.Add(typeof(Holder));
        hash.Add(global::System.Collections.StructuralComparisons.StructuralEqualityComparer.GetHashCode(Packet!));
        hash.Add(global::System.Collections.StructuralComparisons.StructuralEqualityComparer.GetHashCode(Tag!));
        return hash.ToHashCode();
    }
}

/// <summary>The functions selected by the Lean package author.</summary>
public static class Api
{
    /// <remarks>Checked Lean Fin bounds: arg0[*] checked by NestedCheckedRecords.mkPacket; arg0[*].digit &lt; 10; arg0[*].word checked by NestedCheckedRecords.mkWord; result[*] projects proof-backed record payload fields; result[*].digit &lt; 10; result[*].word projects the Subtype base value.</remarks>
    public static Packet[] EchoArray(Packet[] @arg0) => Interop.Runtime.Call0(@arg0);
    /// <remarks>Checked Lean Fin bounds: arg0 checked by NestedCheckedRecords.mkPacket; arg0.digit &lt; 10; arg0.word checked by NestedCheckedRecords.mkWord.</remarks>
    public static global::System.Numerics.BigInteger First(Packet @arg0) => Interop.Runtime.Call1(@arg0);
    /// <remarks>Checked Lean Fin bounds: arg0[*] checked by NestedCheckedRecords.mkPacket; arg0[*].digit &lt; 10; arg0[*].word checked by NestedCheckedRecords.mkWord.</remarks>
    public static global::System.Numerics.BigInteger InArray(Packet[] @arg0) => Interop.Runtime.Call2(@arg0);
    /// <remarks>Checked Lean Fin bounds: arg0.packet.value checked by NestedCheckedRecords.mkPacket; arg0.packet.value.digit &lt; 10; arg0.packet.value.word checked by NestedCheckedRecords.normalizeWord.</remarks>
    public static global::System.Numerics.BigInteger InChoice(Choice @arg0) => Interop.Runtime.Call3(@arg0);
    /// <remarks>Checked Lean Fin bounds: arg0.ok checked by NestedCheckedRecords.normalizePacket; arg0.ok.digit &lt; 10; arg0.ok.word checked by NestedCheckedRecords.mkWord; arg0.error checked by NestedCheckedRecords.mkPacket; arg0.error.digit &lt; 10; arg0.error.word checked by NestedCheckedRecords.normalizeWord.</remarks>
    public static global::System.Numerics.BigInteger InExcept(Result<Packet, Packet> @arg0) => Interop.Runtime.Call4(@arg0);
    /// <remarks>Checked Lean Fin bounds: arg0.packet checked by NestedCheckedRecords.normalizePacket; arg0.packet.digit &lt; 10; arg0.packet.word checked by NestedCheckedRecords.mkWord.</remarks>
    public static global::System.Numerics.BigInteger InHolder(Holder @arg0) => Interop.Runtime.Call5(@arg0);
    /// <remarks>Checked Lean Fin bounds: arg0[*] checked by NestedCheckedRecords.normalizePacket; arg0[*].digit &lt; 10; arg0[*].word checked by NestedCheckedRecords.normalizeWord.</remarks>
    public static global::System.Numerics.BigInteger InList(Packet[] @arg0) => Interop.Runtime.Call6(@arg0);
    /// <remarks>Checked Lean Fin bounds: arg0? checked by NestedCheckedRecords.mkPacket; arg0?.digit &lt; 10; arg0?.word checked by NestedCheckedRecords.normalizeWord.</remarks>
    public static global::System.Numerics.BigInteger InOption(Option<Packet> @arg0) => Interop.Runtime.Call7(@arg0);
    /// <remarks>Checked Lean Fin bounds: arg0.0 checked by NestedCheckedRecords.mkPacket; arg0.0.digit &lt; 10; arg0.0.word checked by NestedCheckedRecords.mkWord; arg0.1 checked by NestedCheckedRecords.normalizePacket; arg0.1.digit &lt; 10; arg0.1.word checked by NestedCheckedRecords.normalizeWord.</remarks>
    public static global::System.Numerics.BigInteger InProduct((Packet, Packet) @arg0) => Interop.Runtime.Call8(@arg0);
    /// <remarks>Checked Lean Fin bounds: arg0 checked by NestedCheckedRecords.mkPacket; arg0.digit &lt; 10; arg0.word checked by NestedCheckedRecords.mkWord; arg1 checked by NestedCheckedRecords.normalizePacket; arg1.digit &lt; 10; arg1.word checked by NestedCheckedRecords.normalizeWord.</remarks>
    public static global::System.Numerics.BigInteger Pair(Packet @arg0, Packet @arg1) => Interop.Runtime.Call9(@arg0, @arg1);
    /// <remarks>Checked Lean Fin bounds: result[*] projects proof-backed record payload fields; result[*].digit &lt; 10; result[*].word projects the Subtype base value.</remarks>
    public static Packet[] ProduceArray(global::System.Numerics.BigInteger @arg0) => Interop.Runtime.Call10(@arg0);
    /// <remarks>Checked Lean Fin bounds: result? projects proof-backed record payload fields; result?.digit &lt; 10; result?.word projects the Subtype base value.</remarks>
    public static Option<Packet> ProduceOption(global::System.Numerics.BigInteger @arg0) => Interop.Runtime.Call11(@arg0);
    /// <remarks>Checked Lean Fin bounds: arg0 checked by NestedCheckedRecords.normalizePacket; arg0.digit &lt; 10; arg0.word checked by NestedCheckedRecords.normalizeWord.</remarks>
    public static global::System.Numerics.BigInteger Second(Packet @arg0) => Interop.Runtime.Call12(@arg0);
}
