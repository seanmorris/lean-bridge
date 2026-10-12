namespace LeanBridge.Nominalsubtypes;

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
/// <param name="Payload">Contract type: <c>nat</c>.</param>
/// <param name="Digit">Contract type: <c>nat</c>.</param>
public sealed record Envelope(global::System.Numerics.BigInteger Payload, global::System.Numerics.BigInteger Digit)
{
    public bool Equals(Envelope? other) => other is not null
        && global::System.Collections.StructuralComparisons.StructuralEqualityComparer.Equals(Payload, other.Payload)
        && global::System.Collections.StructuralComparisons.StructuralEqualityComparer.Equals(Digit, other.Digit);
    public override int GetHashCode()
    {
        var hash = new global::System.HashCode();
        hash.Add(typeof(Envelope));
        hash.Add(global::System.Collections.StructuralComparisons.StructuralEqualityComparer.GetHashCode(Payload!));
        hash.Add(global::System.Collections.StructuralComparisons.StructuralEqualityComparer.GetHashCode(Digit!));
        return hash.ToHashCode();
    }
}
/// <summary>A copied Lean variant. Construct a named case.</summary>
public abstract record Event
{
    private protected Event() { }
}
/// <summary>A named Event constructor.</summary>
public sealed record EventEmpty() : Event
{
    public bool Equals(EventEmpty? other) => other is not null;
    public override int GetHashCode()
    {
        var hash = new global::System.HashCode();
        hash.Add(typeof(EventEmpty));

        return hash.ToHashCode();
    }
}
/// <summary>A named Event constructor.</summary>
/// <param name="Value">Contract type: <c>Envelope</c>.</param>
public sealed record EventBox(Envelope Value) : Event
{
    public bool Equals(EventBox? other) => other is not null
        && global::System.Collections.StructuralComparisons.StructuralEqualityComparer.Equals(Value, other.Value);
    public override int GetHashCode()
    {
        var hash = new global::System.HashCode();
        hash.Add(typeof(EventBox));
        hash.Add(global::System.Collections.StructuralComparisons.StructuralEqualityComparer.GetHashCode(Value!));
        return hash.ToHashCode();
    }
}
/// <summary>A named Event constructor.</summary>
/// <param name="Values">Contract type: <c>array&lt;option&lt;result&lt;nat, nat&gt;&gt;&gt;</c>.</param>
public sealed record EventChoices(Option<Result<global::System.Numerics.BigInteger, global::System.Numerics.BigInteger>>[] Values) : Event
{
    public bool Equals(EventChoices? other) => other is not null
        && global::System.Collections.StructuralComparisons.StructuralEqualityComparer.Equals(Values, other.Values);
    public override int GetHashCode()
    {
        var hash = new global::System.HashCode();
        hash.Add(typeof(EventChoices));
        hash.Add(global::System.Collections.StructuralComparisons.StructuralEqualityComparer.GetHashCode(Values!));
        return hash.ToHashCode();
    }
}
/// <summary>A copied Lean record.</summary>
/// <param name="Left">Contract type: <c>array&lt;option&lt;EnvelopeAlias&gt;&gt;</c>.</param>
/// <param name="Right">Contract type: <c>array&lt;option&lt;EnvelopeAlias&gt;&gt;</c>.</param>
public sealed record AliasPair(Option<Envelope>[] Left, Option<Envelope>[] Right)
{
    public bool Equals(AliasPair? other) => other is not null
        && global::System.Collections.StructuralComparisons.StructuralEqualityComparer.Equals(Left, other.Left)
        && global::System.Collections.StructuralComparisons.StructuralEqualityComparer.Equals(Right, other.Right);
    public override int GetHashCode()
    {
        var hash = new global::System.HashCode();
        hash.Add(typeof(AliasPair));
        hash.Add(global::System.Collections.StructuralComparisons.StructuralEqualityComparer.GetHashCode(Left!));
        hash.Add(global::System.Collections.StructuralComparisons.StructuralEqualityComparer.GetHashCode(Right!));
        return hash.ToHashCode();
    }
}
/// <summary>A copied Lean record.</summary>
/// <param name="Left">Contract type: <c>Envelope</c>.</param>
/// <param name="Right">Contract type: <c>Envelope</c>.</param>
public sealed record Pair(Envelope Left, Envelope Right)
{
    public bool Equals(Pair? other) => other is not null
        && global::System.Collections.StructuralComparisons.StructuralEqualityComparer.Equals(Left, other.Left)
        && global::System.Collections.StructuralComparisons.StructuralEqualityComparer.Equals(Right, other.Right);
    public override int GetHashCode()
    {
        var hash = new global::System.HashCode();
        hash.Add(typeof(Pair));
        hash.Add(global::System.Collections.StructuralComparisons.StructuralEqualityComparer.GetHashCode(Left!));
        hash.Add(global::System.Collections.StructuralComparisons.StructuralEqualityComparer.GetHashCode(Right!));
        return hash.ToHashCode();
    }
}

/// <summary>The functions selected by the Lean package author.</summary>
/// <remarks>Copied Lean aliases use their CLR target values. The binding manifest preserves their contract identities.
/// <list type="table">
/// <item><term><c>EnvelopeAlias</c></term><description><c>Envelope</c> projects to <c>Envelope</c>.</description></item>
/// </list></remarks>
public static class Api
{
    /// <param name="arg0">Contract type: <c>array&lt;option&lt;EnvelopeAlias&gt;&gt;</c>.</param>
    /// <param name="arg1">Contract type: <c>array&lt;option&lt;EnvelopeAlias&gt;&gt;</c>.</param>
    /// <returns>Contract type: <c>nat</c>.</returns>
    /// <remarks>Checked Lean Fin bounds: arg0[*]?.payload checked by NominalSubtypes.plusOne; arg0[*]?.digit &lt; 3; arg1[*]?.payload checked by NominalSubtypes.plusTwo; arg1[*]?.digit &lt; 3.</remarks>
    public static global::System.Numerics.BigInteger Aliases(Option<Envelope>[] @arg0, Option<Envelope>[] @arg1) => Interop.Runtime.Call0(@arg0, @arg1);
    /// <param name="arg0">Contract type: <c>nat</c>.</param>
    /// <returns>Contract type: <c>array&lt;nat&gt;</c>.</returns>
    /// <remarks>Checked Lean Fin bounds: result[*] projects the Subtype base value.</remarks>
    public static global::System.Numerics.BigInteger[] ArrayValues(global::System.Numerics.BigInteger @arg0) => Interop.Runtime.Call1(@arg0);
    /// <param name="arg0">Contract type: <c>nat</c>.</param>
    /// <returns>Contract type: <c>result&lt;nat, nat&gt;</c>.</returns>
    /// <remarks>Checked Lean Fin bounds: result.ok projects the Subtype base value; result.error projects the Subtype base value.</remarks>
    public static Result<global::System.Numerics.BigInteger, global::System.Numerics.BigInteger> Branch(global::System.Numerics.BigInteger @arg0) => Interop.Runtime.Call2(@arg0);
    /// <param name="arg0">Contract type: <c>Envelope</c>.</param>
    /// <param name="arg1">Contract type: <c>Envelope</c>.</param>
    /// <returns>Contract type: <c>nat</c>.</returns>
    /// <remarks>Checked Lean Fin bounds: arg0.payload checked by NominalSubtypes.plusOne; arg0.digit &lt; 3; arg1.payload checked by NominalSubtypes.plusTwo; arg1.digit &lt; 3.</remarks>
    public static global::System.Numerics.BigInteger Combine(Envelope @arg0, Envelope @arg1) => Interop.Runtime.Call3(@arg0, @arg1);
    /// <param name="arg0">Contract type: <c>Envelope</c>.</param>
    /// <returns>Contract type: <c>Envelope</c>.</returns>
    /// <remarks>Checked Lean Fin bounds: arg0.payload checked by NominalSubtypes.plusOne; arg0.digit &lt; 3; result.payload projects the Subtype base value; result.digit &lt; 3.</remarks>
    public static Envelope Echo(Envelope @arg0) => Interop.Runtime.Call4(@arg0);
    /// <param name="arg0">Contract type: <c>Event</c>.</param>
    /// <returns>Contract type: <c>Event</c>.</returns>
    /// <remarks>Checked Lean Fin bounds: arg0.box.value.payload checked by NominalSubtypes.plusOne; arg0.box.value.digit &lt; 3; arg0.choices.values[*]?.ok checked by NominalSubtypes.plusOne; arg0.choices.values[*]?.error checked by NominalSubtypes.plusTwo; result.box.value.payload projects the Subtype base value; result.box.value.digit &lt; 3; result.choices.values[*]?.ok projects the Subtype base value; result.choices.values[*]?.error projects the Subtype base value.</remarks>
    public static Event EchoEvent(Event @arg0) => Interop.Runtime.Call5(@arg0);
    /// <param name="arg0">Contract type: <c>array&lt;option&lt;EnvelopeAlias&gt;&gt;</c>.</param>
    /// <returns>Contract type: <c>array&lt;option&lt;EnvelopeAlias&gt;&gt;</c>.</returns>
    /// <remarks>Checked Lean Fin bounds: arg0[*]?.payload checked by NominalSubtypes.plusOne; arg0[*]?.digit &lt; 3; result[*]?.payload projects the Subtype base value; result[*]?.digit &lt; 3.</remarks>
    public static Option<Envelope>[] EchoGroups(Option<Envelope>[] @arg0) => Interop.Runtime.Call6(@arg0);
    /// <param name="arg0">Contract type: <c>AliasPair</c>.</param>
    /// <returns>Contract type: <c>AliasPair</c>.</returns>
    /// <remarks>Checked Lean Fin bounds: arg0.left[*]?.payload checked by NominalSubtypes.plusOne; arg0.left[*]?.digit &lt; 3; arg0.right[*]?.payload checked by NominalSubtypes.plusTwo; arg0.right[*]?.digit &lt; 3; result.left[*]?.payload projects the Subtype base value; result.left[*]?.digit &lt; 3; result.right[*]?.payload projects the Subtype base value; result.right[*]?.digit &lt; 3.</remarks>
    public static AliasPair EchoPair(AliasPair @arg0) => Interop.Runtime.Call7(@arg0);
    /// <param name="arg0">Contract type: <c>nat</c>.</param>
    /// <returns>Contract type: <c>Event</c>.</returns>
    /// <remarks>Checked Lean Fin bounds: result.box.value.payload projects the Subtype base value; result.box.value.digit &lt; 3; result.choices.values[*]?.ok projects the Subtype base value; result.choices.values[*]?.error projects the Subtype base value.</remarks>
    public static Event EventChoices(global::System.Numerics.BigInteger @arg0) => Interop.Runtime.Call8(@arg0);
    /// <param name="arg0">Contract type: <c>nat</c>.</param>
    /// <returns>Contract type: <c>Event</c>.</returns>
    /// <remarks>Checked Lean Fin bounds: result.box.value.payload projects the Subtype base value; result.box.value.digit &lt; 3; result.choices.values[*]?.ok projects the Subtype base value; result.choices.values[*]?.error projects the Subtype base value.</remarks>
    public static Event EventEmpty(global::System.Numerics.BigInteger @arg0) => Interop.Runtime.Call9(@arg0);
    /// <param name="arg0">Contract type: <c>Event</c>.</param>
    /// <returns>Contract type: <c>nat</c>.</returns>
    /// <remarks>Checked Lean Fin bounds: arg0.box.value.payload checked by NominalSubtypes.plusOne; arg0.box.value.digit &lt; 3; arg0.choices.values[*]?.ok checked by NominalSubtypes.plusOne; arg0.choices.values[*]?.error checked by NominalSubtypes.plusTwo.</remarks>
    public static global::System.Numerics.BigInteger EventFirst(Event @arg0) => Interop.Runtime.Call10(@arg0);
    /// <param name="arg0">Contract type: <c>Event</c>.</param>
    /// <returns>Contract type: <c>nat</c>.</returns>
    /// <remarks>Checked Lean Fin bounds: arg0.box.value.payload checked by NominalSubtypes.plusTwo; arg0.box.value.digit &lt; 3; arg0.choices.values[*]?.ok checked by NominalSubtypes.plusTwo; arg0.choices.values[*]?.error checked by NominalSubtypes.plusOne.</remarks>
    public static global::System.Numerics.BigInteger EventSecond(Event @arg0) => Interop.Runtime.Call11(@arg0);
    /// <param name="arg0">Contract type: <c>nat</c>.</param>
    /// <returns>Contract type: <c>Event</c>.</returns>
    /// <remarks>Checked Lean Fin bounds: result.box.value.payload projects the Subtype base value; result.box.value.digit &lt; 3; result.choices.values[*]?.ok projects the Subtype base value; result.choices.values[*]?.error projects the Subtype base value.</remarks>
    public static Event EventValue(global::System.Numerics.BigInteger @arg0) => Interop.Runtime.Call12(@arg0);
    /// <param name="arg0">Contract type: <c>Envelope</c>.</param>
    /// <returns>Contract type: <c>nat</c>.</returns>
    /// <remarks>Checked Lean Fin bounds: arg0.payload checked by NominalSubtypes.plusOne; arg0.digit &lt; 3.</remarks>
    public static global::System.Numerics.BigInteger First(Envelope @arg0) => Interop.Runtime.Call13(@arg0);
    /// <param name="arg0">Contract type: <c>nat</c>.</param>
    /// <returns>Contract type: <c>array&lt;option&lt;EnvelopeAlias&gt;&gt;</c>.</returns>
    /// <remarks>Checked Lean Fin bounds: result[*]?.payload projects the Subtype base value; result[*]?.digit &lt; 3.</remarks>
    public static Option<Envelope>[] GroupValues(global::System.Numerics.BigInteger @arg0) => Interop.Runtime.Call14(@arg0);
    /// <param name="arg0">Contract type: <c>AliasPair</c>.</param>
    /// <returns>Contract type: <c>nat</c>.</returns>
    /// <remarks>Checked Lean Fin bounds: arg0.left[*]?.payload checked by NominalSubtypes.plusOne; arg0.left[*]?.digit &lt; 3; arg0.right[*]?.payload checked by NominalSubtypes.plusTwo; arg0.right[*]?.digit &lt; 3.</remarks>
    public static global::System.Numerics.BigInteger InspectAliasPair(AliasPair @arg0) => Interop.Runtime.Call15(@arg0);
    /// <param name="arg0">Contract type: <c>nat</c>.</param>
    /// <returns>Contract type: <c>list&lt;nat&gt;</c>.</returns>
    /// <remarks>Checked Lean Fin bounds: result[*] projects the Subtype base value.</remarks>
    public static global::System.Numerics.BigInteger[] ListValues(global::System.Numerics.BigInteger @arg0) => Interop.Runtime.Call16(@arg0);
    /// <param name="arg0">Contract type: <c>Pair</c>.</param>
    /// <returns>Contract type: <c>nat</c>.</returns>
    /// <remarks>Checked Lean Fin bounds: arg0.left.payload checked by NominalSubtypes.plusOne; arg0.left.digit &lt; 3; arg0.right.payload checked by NominalSubtypes.plusTwo; arg0.right.digit &lt; 3.</remarks>
    public static global::System.Numerics.BigInteger Nested(Pair @arg0) => Interop.Runtime.Call17(@arg0);
    /// <param name="arg0">Contract type: <c>nat</c>.</param>
    /// <returns>Contract type: <c>array&lt;nat&gt;</c>.</returns>
    /// <remarks>Checked Lean Fin bounds: result[*] projects the Subtype base value.</remarks>
    public static global::System.Numerics.BigInteger[] NoItems(global::System.Numerics.BigInteger @arg0) => Interop.Runtime.Call18(@arg0);
    /// <param name="arg0">Contract type: <c>nat</c>.</param>
    /// <returns>Contract type: <c>option&lt;nat&gt;</c>.</returns>
    /// <remarks>Checked Lean Fin bounds: result? projects the Subtype base value.</remarks>
    public static Option<global::System.Numerics.BigInteger> Optional(global::System.Numerics.BigInteger @arg0) => Interop.Runtime.Call19(@arg0);
    /// <param name="arg0">Contract type: <c>nat</c>.</param>
    /// <returns>Contract type: <c>AliasPair</c>.</returns>
    /// <remarks>Checked Lean Fin bounds: result.left[*]?.payload projects the Subtype base value; result.left[*]?.digit &lt; 3; result.right[*]?.payload projects the Subtype base value; result.right[*]?.digit &lt; 3.</remarks>
    public static AliasPair PairValues(global::System.Numerics.BigInteger @arg0) => Interop.Runtime.Call20(@arg0);
    /// <param name="arg0">Contract type: <c>nat</c>.</param>
    /// <returns>Contract type: <c>nat</c>.</returns>
    /// <remarks>Checked Lean Fin bounds: arg0 &lt; 3.</remarks>
    public static global::System.Numerics.BigInteger PlainFin(global::System.Numerics.BigInteger @arg0) => Interop.Runtime.Call21(@arg0);
    /// <param name="arg0">Contract type: <c>nat</c>.</param>
    /// <returns>Contract type: <c>Envelope</c>.</returns>
    /// <remarks>Checked Lean Fin bounds: result.payload projects the Subtype base value; result.digit &lt; 3.</remarks>
    public static Envelope ProduceEnvelope(global::System.Numerics.BigInteger @arg0) => Interop.Runtime.Call22(@arg0);
    /// <param name="arg0">Contract type: <c>nat</c>.</param>
    /// <returns>Contract type: <c>tuple&lt;nat, nat&gt;</c>.</returns>
    /// <remarks>Checked Lean Fin bounds: result.0 projects the Subtype base value; result.1 projects the Subtype base value.</remarks>
    public static (global::System.Numerics.BigInteger, global::System.Numerics.BigInteger) Product(global::System.Numerics.BigInteger @arg0) => Interop.Runtime.Call23(@arg0);
    /// <param name="arg0">Contract type: <c>nat</c>.</param>
    /// <returns>Contract type: <c>nat</c>.</returns>
    /// <remarks>Checked Lean Fin bounds: result projects the Subtype base value.</remarks>
    public static global::System.Numerics.BigInteger Scalar(global::System.Numerics.BigInteger @arg0) => Interop.Runtime.Call24(@arg0);
    /// <param name="arg0">Contract type: <c>Envelope</c>.</param>
    /// <returns>Contract type: <c>nat</c>.</returns>
    /// <remarks>Checked Lean Fin bounds: arg0.payload checked by NominalSubtypes.plusTwo; arg0.digit &lt; 3.</remarks>
    public static global::System.Numerics.BigInteger Second(Envelope @arg0) => Interop.Runtime.Call25(@arg0);
}
