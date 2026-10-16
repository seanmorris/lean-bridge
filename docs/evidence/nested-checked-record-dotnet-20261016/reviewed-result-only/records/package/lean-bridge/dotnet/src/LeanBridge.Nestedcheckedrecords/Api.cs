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

/// <summary>The functions selected by the Lean package author.</summary>
public static class Api
{
    /// <remarks>Checked Lean Fin bounds: result[*] projects proof-backed record payload fields; result[*].digit &lt; 10; result[*].word projects the Subtype base value.</remarks>
    public static Packet[] ProduceArray(global::System.Numerics.BigInteger @value0) => Interop.Runtime.Call0(@value0);
    /// <remarks>Checked Lean Fin bounds: result? projects proof-backed record payload fields; result?.digit &lt; 10; result?.word projects the Subtype base value.</remarks>
    public static Option<Packet> ProduceOption(global::System.Numerics.BigInteger @value0) => Interop.Runtime.Call1(@value0);
}
