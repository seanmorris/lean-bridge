namespace LeanBridge.Nominalprimitivesubtypes;

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
/// <param name="UnitValue">Contract type: <c>unit</c>.</param>
/// <param name="BoolValue">Contract type: <c>bool</c>.</param>
/// <param name="Uint8Value">Contract type: <c>uint8</c>.</param>
/// <param name="Uint16Value">Contract type: <c>uint16</c>.</param>
/// <param name="Uint32Value">Contract type: <c>uint32</c>.</param>
/// <param name="Uint64Value">Contract type: <c>uint64</c>.</param>
/// <param name="Int8Value">Contract type: <c>int8</c>.</param>
/// <param name="Int16Value">Contract type: <c>int16</c>.</param>
/// <param name="Int32Value">Contract type: <c>int32</c>.</param>
/// <param name="Int64Value">Contract type: <c>int64</c>.</param>
/// <param name="NatValue">Contract type: <c>nat</c>.</param>
/// <param name="IntValue">Contract type: <c>int</c>.</param>
/// <param name="Float32Value">Contract type: <c>float32</c>.</param>
/// <param name="Float64Value">Contract type: <c>float64</c>.</param>
/// <param name="TextValue">Contract type: <c>string</c>.</param>
/// <param name="BytesValue">Contract type: <c>bytes</c>.</param>
/// <param name="CharValue">Contract type: <c>char</c>.</param>
/// <param name="UsizeValue">Contract type: <c>usize</c>.</param>
/// <param name="IsizeValue">Contract type: <c>isize</c>.</param>
/// <param name="Digit">Contract type: <c>nat</c>.</param>
public sealed record RawPacket(Unit UnitValue, bool BoolValue, byte Uint8Value, ushort Uint16Value, uint Uint32Value, ulong Uint64Value, sbyte Int8Value, short Int16Value, int Int32Value, long Int64Value, global::System.Numerics.BigInteger NatValue, global::System.Numerics.BigInteger IntValue, float Float32Value, double Float64Value, string TextValue, byte[] BytesValue, global::System.Text.Rune CharValue, ulong UsizeValue, long IsizeValue, global::System.Numerics.BigInteger Digit)
{
    public bool Equals(RawPacket? other) => other is not null
        && global::System.Collections.StructuralComparisons.StructuralEqualityComparer.Equals(UnitValue, other.UnitValue)
        && global::System.Collections.StructuralComparisons.StructuralEqualityComparer.Equals(BoolValue, other.BoolValue)
        && global::System.Collections.StructuralComparisons.StructuralEqualityComparer.Equals(Uint8Value, other.Uint8Value)
        && global::System.Collections.StructuralComparisons.StructuralEqualityComparer.Equals(Uint16Value, other.Uint16Value)
        && global::System.Collections.StructuralComparisons.StructuralEqualityComparer.Equals(Uint32Value, other.Uint32Value)
        && global::System.Collections.StructuralComparisons.StructuralEqualityComparer.Equals(Uint64Value, other.Uint64Value)
        && global::System.Collections.StructuralComparisons.StructuralEqualityComparer.Equals(Int8Value, other.Int8Value)
        && global::System.Collections.StructuralComparisons.StructuralEqualityComparer.Equals(Int16Value, other.Int16Value)
        && global::System.Collections.StructuralComparisons.StructuralEqualityComparer.Equals(Int32Value, other.Int32Value)
        && global::System.Collections.StructuralComparisons.StructuralEqualityComparer.Equals(Int64Value, other.Int64Value)
        && global::System.Collections.StructuralComparisons.StructuralEqualityComparer.Equals(NatValue, other.NatValue)
        && global::System.Collections.StructuralComparisons.StructuralEqualityComparer.Equals(IntValue, other.IntValue)
        && global::System.Collections.StructuralComparisons.StructuralEqualityComparer.Equals(Float32Value, other.Float32Value)
        && global::System.Collections.StructuralComparisons.StructuralEqualityComparer.Equals(Float64Value, other.Float64Value)
        && global::System.Collections.StructuralComparisons.StructuralEqualityComparer.Equals(TextValue, other.TextValue)
        && global::System.Collections.StructuralComparisons.StructuralEqualityComparer.Equals(BytesValue, other.BytesValue)
        && global::System.Collections.StructuralComparisons.StructuralEqualityComparer.Equals(CharValue, other.CharValue)
        && global::System.Collections.StructuralComparisons.StructuralEqualityComparer.Equals(UsizeValue, other.UsizeValue)
        && global::System.Collections.StructuralComparisons.StructuralEqualityComparer.Equals(IsizeValue, other.IsizeValue)
        && global::System.Collections.StructuralComparisons.StructuralEqualityComparer.Equals(Digit, other.Digit);
    public override int GetHashCode()
    {
        var hash = new global::System.HashCode();
        hash.Add(typeof(RawPacket));
        hash.Add(global::System.Collections.StructuralComparisons.StructuralEqualityComparer.GetHashCode(UnitValue!));
        hash.Add(global::System.Collections.StructuralComparisons.StructuralEqualityComparer.GetHashCode(BoolValue!));
        hash.Add(global::System.Collections.StructuralComparisons.StructuralEqualityComparer.GetHashCode(Uint8Value!));
        hash.Add(global::System.Collections.StructuralComparisons.StructuralEqualityComparer.GetHashCode(Uint16Value!));
        hash.Add(global::System.Collections.StructuralComparisons.StructuralEqualityComparer.GetHashCode(Uint32Value!));
        hash.Add(global::System.Collections.StructuralComparisons.StructuralEqualityComparer.GetHashCode(Uint64Value!));
        hash.Add(global::System.Collections.StructuralComparisons.StructuralEqualityComparer.GetHashCode(Int8Value!));
        hash.Add(global::System.Collections.StructuralComparisons.StructuralEqualityComparer.GetHashCode(Int16Value!));
        hash.Add(global::System.Collections.StructuralComparisons.StructuralEqualityComparer.GetHashCode(Int32Value!));
        hash.Add(global::System.Collections.StructuralComparisons.StructuralEqualityComparer.GetHashCode(Int64Value!));
        hash.Add(global::System.Collections.StructuralComparisons.StructuralEqualityComparer.GetHashCode(NatValue!));
        hash.Add(global::System.Collections.StructuralComparisons.StructuralEqualityComparer.GetHashCode(IntValue!));
        hash.Add(global::System.Collections.StructuralComparisons.StructuralEqualityComparer.GetHashCode(Float32Value!));
        hash.Add(global::System.Collections.StructuralComparisons.StructuralEqualityComparer.GetHashCode(Float64Value!));
        hash.Add(global::System.Collections.StructuralComparisons.StructuralEqualityComparer.GetHashCode(TextValue!));
        hash.Add(global::System.Collections.StructuralComparisons.StructuralEqualityComparer.GetHashCode(BytesValue!));
        hash.Add(global::System.Collections.StructuralComparisons.StructuralEqualityComparer.GetHashCode(CharValue!));
        hash.Add(global::System.Collections.StructuralComparisons.StructuralEqualityComparer.GetHashCode(UsizeValue!));
        hash.Add(global::System.Collections.StructuralComparisons.StructuralEqualityComparer.GetHashCode(IsizeValue!));
        hash.Add(global::System.Collections.StructuralComparisons.StructuralEqualityComparer.GetHashCode(Digit!));
        return hash.ToHashCode();
    }
}
/// <summary>A copied Lean record.</summary>
/// <param name="UnitValue">Contract type: <c>unit</c>.</param>
/// <param name="BoolValue">Contract type: <c>bool</c>.</param>
/// <param name="Uint8Value">Contract type: <c>uint8</c>.</param>
/// <param name="Uint16Value">Contract type: <c>uint16</c>.</param>
/// <param name="Uint32Value">Contract type: <c>uint32</c>.</param>
/// <param name="Uint64Value">Contract type: <c>uint64</c>.</param>
/// <param name="Int8Value">Contract type: <c>int8</c>.</param>
/// <param name="Int16Value">Contract type: <c>int16</c>.</param>
/// <param name="Int32Value">Contract type: <c>int32</c>.</param>
/// <param name="Int64Value">Contract type: <c>int64</c>.</param>
/// <param name="NatValue">Contract type: <c>nat</c>.</param>
/// <param name="IntValue">Contract type: <c>int</c>.</param>
/// <param name="Float32Value">Contract type: <c>float32</c>.</param>
/// <param name="Float64Value">Contract type: <c>float64</c>.</param>
/// <param name="TextValue">Contract type: <c>string</c>.</param>
/// <param name="BytesValue">Contract type: <c>bytes</c>.</param>
/// <param name="CharValue">Contract type: <c>char</c>.</param>
/// <param name="UsizeValue">Contract type: <c>usize</c>.</param>
/// <param name="IsizeValue">Contract type: <c>isize</c>.</param>
/// <param name="Digit">Contract type: <c>nat</c>.</param>
public sealed record Packet(Unit UnitValue, bool BoolValue, byte Uint8Value, ushort Uint16Value, uint Uint32Value, ulong Uint64Value, sbyte Int8Value, short Int16Value, int Int32Value, long Int64Value, global::System.Numerics.BigInteger NatValue, global::System.Numerics.BigInteger IntValue, float Float32Value, double Float64Value, string TextValue, byte[] BytesValue, global::System.Text.Rune CharValue, ulong UsizeValue, long IsizeValue, global::System.Numerics.BigInteger Digit)
{
    public bool Equals(Packet? other) => other is not null
        && global::System.Collections.StructuralComparisons.StructuralEqualityComparer.Equals(UnitValue, other.UnitValue)
        && global::System.Collections.StructuralComparisons.StructuralEqualityComparer.Equals(BoolValue, other.BoolValue)
        && global::System.Collections.StructuralComparisons.StructuralEqualityComparer.Equals(Uint8Value, other.Uint8Value)
        && global::System.Collections.StructuralComparisons.StructuralEqualityComparer.Equals(Uint16Value, other.Uint16Value)
        && global::System.Collections.StructuralComparisons.StructuralEqualityComparer.Equals(Uint32Value, other.Uint32Value)
        && global::System.Collections.StructuralComparisons.StructuralEqualityComparer.Equals(Uint64Value, other.Uint64Value)
        && global::System.Collections.StructuralComparisons.StructuralEqualityComparer.Equals(Int8Value, other.Int8Value)
        && global::System.Collections.StructuralComparisons.StructuralEqualityComparer.Equals(Int16Value, other.Int16Value)
        && global::System.Collections.StructuralComparisons.StructuralEqualityComparer.Equals(Int32Value, other.Int32Value)
        && global::System.Collections.StructuralComparisons.StructuralEqualityComparer.Equals(Int64Value, other.Int64Value)
        && global::System.Collections.StructuralComparisons.StructuralEqualityComparer.Equals(NatValue, other.NatValue)
        && global::System.Collections.StructuralComparisons.StructuralEqualityComparer.Equals(IntValue, other.IntValue)
        && global::System.Collections.StructuralComparisons.StructuralEqualityComparer.Equals(Float32Value, other.Float32Value)
        && global::System.Collections.StructuralComparisons.StructuralEqualityComparer.Equals(Float64Value, other.Float64Value)
        && global::System.Collections.StructuralComparisons.StructuralEqualityComparer.Equals(TextValue, other.TextValue)
        && global::System.Collections.StructuralComparisons.StructuralEqualityComparer.Equals(BytesValue, other.BytesValue)
        && global::System.Collections.StructuralComparisons.StructuralEqualityComparer.Equals(CharValue, other.CharValue)
        && global::System.Collections.StructuralComparisons.StructuralEqualityComparer.Equals(UsizeValue, other.UsizeValue)
        && global::System.Collections.StructuralComparisons.StructuralEqualityComparer.Equals(IsizeValue, other.IsizeValue)
        && global::System.Collections.StructuralComparisons.StructuralEqualityComparer.Equals(Digit, other.Digit);
    public override int GetHashCode()
    {
        var hash = new global::System.HashCode();
        hash.Add(typeof(Packet));
        hash.Add(global::System.Collections.StructuralComparisons.StructuralEqualityComparer.GetHashCode(UnitValue!));
        hash.Add(global::System.Collections.StructuralComparisons.StructuralEqualityComparer.GetHashCode(BoolValue!));
        hash.Add(global::System.Collections.StructuralComparisons.StructuralEqualityComparer.GetHashCode(Uint8Value!));
        hash.Add(global::System.Collections.StructuralComparisons.StructuralEqualityComparer.GetHashCode(Uint16Value!));
        hash.Add(global::System.Collections.StructuralComparisons.StructuralEqualityComparer.GetHashCode(Uint32Value!));
        hash.Add(global::System.Collections.StructuralComparisons.StructuralEqualityComparer.GetHashCode(Uint64Value!));
        hash.Add(global::System.Collections.StructuralComparisons.StructuralEqualityComparer.GetHashCode(Int8Value!));
        hash.Add(global::System.Collections.StructuralComparisons.StructuralEqualityComparer.GetHashCode(Int16Value!));
        hash.Add(global::System.Collections.StructuralComparisons.StructuralEqualityComparer.GetHashCode(Int32Value!));
        hash.Add(global::System.Collections.StructuralComparisons.StructuralEqualityComparer.GetHashCode(Int64Value!));
        hash.Add(global::System.Collections.StructuralComparisons.StructuralEqualityComparer.GetHashCode(NatValue!));
        hash.Add(global::System.Collections.StructuralComparisons.StructuralEqualityComparer.GetHashCode(IntValue!));
        hash.Add(global::System.Collections.StructuralComparisons.StructuralEqualityComparer.GetHashCode(Float32Value!));
        hash.Add(global::System.Collections.StructuralComparisons.StructuralEqualityComparer.GetHashCode(Float64Value!));
        hash.Add(global::System.Collections.StructuralComparisons.StructuralEqualityComparer.GetHashCode(TextValue!));
        hash.Add(global::System.Collections.StructuralComparisons.StructuralEqualityComparer.GetHashCode(BytesValue!));
        hash.Add(global::System.Collections.StructuralComparisons.StructuralEqualityComparer.GetHashCode(CharValue!));
        hash.Add(global::System.Collections.StructuralComparisons.StructuralEqualityComparer.GetHashCode(UsizeValue!));
        hash.Add(global::System.Collections.StructuralComparisons.StructuralEqualityComparer.GetHashCode(IsizeValue!));
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
/// <param name="Value">Contract type: <c>Packet</c>.</param>
public sealed record EventBox(Packet Value) : Event
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
/// <param name="Values">Contract type: <c>array&lt;option&lt;result&lt;Packet, Packet&gt;&gt;&gt;</c>.</param>
public sealed record EventChoices(Option<Result<Packet, Packet>>[] Values) : Event
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
/// <param name="Left">Contract type: <c>array&lt;option&lt;PacketAlias&gt;&gt;</c>.</param>
/// <param name="Right">Contract type: <c>array&lt;option&lt;PacketAlias&gt;&gt;</c>.</param>
public sealed record Pair(Option<Packet>[] Left, Option<Packet>[] Right)
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
/// <item><term><c>PacketAlias</c></term><description><c>Packet</c> projects to <c>Packet</c>.</description></item>
/// </list></remarks>
public static class Api
{
    /// <param name="arg0">Contract type: <c>RawPacket</c>.</param>
    /// <returns>Contract type: <c>option&lt;Packet&gt;</c>.</returns>
    /// <remarks>Checked Lean Fin bounds: result?.unitValue projects the Subtype base value; result?.boolValue projects the Subtype base value; result?.uint8Value projects the Subtype base value; result?.uint16Value projects the Subtype base value; result?.uint32Value projects the Subtype base value; result?.uint64Value projects the Subtype base value; result?.int8Value projects the Subtype base value; result?.int16Value projects the Subtype base value; result?.int32Value projects the Subtype base value; result?.int64Value projects the Subtype base value; result?.natValue projects the Subtype base value; result?.intValue projects the Subtype base value; result?.float32Value projects the Subtype base value; result?.float64Value projects the Subtype base value; result?.textValue projects the Subtype base value; result?.bytesValue projects the Subtype base value; result?.charValue projects the Subtype base value; result?.usizeValue projects the Subtype base value; result?.isizeValue projects the Subtype base value; result?.digit &lt; 3.</remarks>
    public static Option<Packet> Produce(RawPacket @arg0) => Interop.Runtime.Call0(@arg0);
    /// <param name="arg0">Contract type: <c>RawPacket</c>.</param>
    /// <returns>Contract type: <c>Event</c>.</returns>
    /// <remarks>Checked Lean Fin bounds: result.box.value.unitValue projects the Subtype base value; result.box.value.boolValue projects the Subtype base value; result.box.value.uint8Value projects the Subtype base value; result.box.value.uint16Value projects the Subtype base value; result.box.value.uint32Value projects the Subtype base value; result.box.value.uint64Value projects the Subtype base value; result.box.value.int8Value projects the Subtype base value; result.box.value.int16Value projects the Subtype base value; result.box.value.int32Value projects the Subtype base value; result.box.value.int64Value projects the Subtype base value; result.box.value.natValue projects the Subtype base value; result.box.value.intValue projects the Subtype base value; result.box.value.float32Value projects the Subtype base value; result.box.value.float64Value projects the Subtype base value; result.box.value.textValue projects the Subtype base value; result.box.value.bytesValue projects the Subtype base value; result.box.value.charValue projects the Subtype base value; result.box.value.usizeValue projects the Subtype base value; result.box.value.isizeValue projects the Subtype base value; result.box.value.digit &lt; 3; result.choices.values[*]?.ok.unitValue projects the Subtype base value; result.choices.values[*]?.ok.boolValue projects the Subtype base value; result.choices.values[*]?.ok.uint8Value projects the Subtype base value; result.choices.values[*]?.ok.uint16Value projects the Subtype base value; result.choices.values[*]?.ok.uint32Value projects the Subtype base value; result.choices.values[*]?.ok.uint64Value projects the Subtype base value; result.choices.values[*]?.ok.int8Value projects the Subtype base value; result.choices.values[*]?.ok.int16Value projects the Subtype base value; result.choices.values[*]?.ok.int32Value projects the Subtype base value; result.choices.values[*]?.ok.int64Value projects the Subtype base value; result.choices.values[*]?.ok.natValue projects the Subtype base value; result.choices.values[*]?.ok.intValue projects the Subtype base value; result.choices.values[*]?.ok.float32Value projects the Subtype base value; result.choices.values[*]?.ok.float64Value projects the Subtype base value; result.choices.values[*]?.ok.textValue projects the Subtype base value; result.choices.values[*]?.ok.bytesValue projects the Subtype base value; result.choices.values[*]?.ok.charValue projects the Subtype base value; result.choices.values[*]?.ok.usizeValue projects the Subtype base value; result.choices.values[*]?.ok.isizeValue projects the Subtype base value; result.choices.values[*]?.ok.digit &lt; 3; result.choices.values[*]?.error.unitValue projects the Subtype base value; result.choices.values[*]?.error.boolValue projects the Subtype base value; result.choices.values[*]?.error.uint8Value projects the Subtype base value; result.choices.values[*]?.error.uint16Value projects the Subtype base value; result.choices.values[*]?.error.uint32Value projects the Subtype base value; result.choices.values[*]?.error.uint64Value projects the Subtype base value; result.choices.values[*]?.error.int8Value projects the Subtype base value; result.choices.values[*]?.error.int16Value projects the Subtype base value; result.choices.values[*]?.error.int32Value projects the Subtype base value; result.choices.values[*]?.error.int64Value projects the Subtype base value; result.choices.values[*]?.error.natValue projects the Subtype base value; result.choices.values[*]?.error.intValue projects the Subtype base value; result.choices.values[*]?.error.float32Value projects the Subtype base value; result.choices.values[*]?.error.float64Value projects the Subtype base value; result.choices.values[*]?.error.textValue projects the Subtype base value; result.choices.values[*]?.error.bytesValue projects the Subtype base value; result.choices.values[*]?.error.charValue projects the Subtype base value; result.choices.values[*]?.error.usizeValue projects the Subtype base value; result.choices.values[*]?.error.isizeValue projects the Subtype base value; result.choices.values[*]?.error.digit &lt; 3.</remarks>
    public static Event ProduceChoices(RawPacket @arg0) => Interop.Runtime.Call1(@arg0);
    /// <param name="arg0">Contract type: <c>RawPacket</c>.</param>
    /// <returns>Contract type: <c>Event</c>.</returns>
    /// <remarks>Checked Lean Fin bounds: result.box.value.unitValue projects the Subtype base value; result.box.value.boolValue projects the Subtype base value; result.box.value.uint8Value projects the Subtype base value; result.box.value.uint16Value projects the Subtype base value; result.box.value.uint32Value projects the Subtype base value; result.box.value.uint64Value projects the Subtype base value; result.box.value.int8Value projects the Subtype base value; result.box.value.int16Value projects the Subtype base value; result.box.value.int32Value projects the Subtype base value; result.box.value.int64Value projects the Subtype base value; result.box.value.natValue projects the Subtype base value; result.box.value.intValue projects the Subtype base value; result.box.value.float32Value projects the Subtype base value; result.box.value.float64Value projects the Subtype base value; result.box.value.textValue projects the Subtype base value; result.box.value.bytesValue projects the Subtype base value; result.box.value.charValue projects the Subtype base value; result.box.value.usizeValue projects the Subtype base value; result.box.value.isizeValue projects the Subtype base value; result.box.value.digit &lt; 3; result.choices.values[*]?.ok.unitValue projects the Subtype base value; result.choices.values[*]?.ok.boolValue projects the Subtype base value; result.choices.values[*]?.ok.uint8Value projects the Subtype base value; result.choices.values[*]?.ok.uint16Value projects the Subtype base value; result.choices.values[*]?.ok.uint32Value projects the Subtype base value; result.choices.values[*]?.ok.uint64Value projects the Subtype base value; result.choices.values[*]?.ok.int8Value projects the Subtype base value; result.choices.values[*]?.ok.int16Value projects the Subtype base value; result.choices.values[*]?.ok.int32Value projects the Subtype base value; result.choices.values[*]?.ok.int64Value projects the Subtype base value; result.choices.values[*]?.ok.natValue projects the Subtype base value; result.choices.values[*]?.ok.intValue projects the Subtype base value; result.choices.values[*]?.ok.float32Value projects the Subtype base value; result.choices.values[*]?.ok.float64Value projects the Subtype base value; result.choices.values[*]?.ok.textValue projects the Subtype base value; result.choices.values[*]?.ok.bytesValue projects the Subtype base value; result.choices.values[*]?.ok.charValue projects the Subtype base value; result.choices.values[*]?.ok.usizeValue projects the Subtype base value; result.choices.values[*]?.ok.isizeValue projects the Subtype base value; result.choices.values[*]?.ok.digit &lt; 3; result.choices.values[*]?.error.unitValue projects the Subtype base value; result.choices.values[*]?.error.boolValue projects the Subtype base value; result.choices.values[*]?.error.uint8Value projects the Subtype base value; result.choices.values[*]?.error.uint16Value projects the Subtype base value; result.choices.values[*]?.error.uint32Value projects the Subtype base value; result.choices.values[*]?.error.uint64Value projects the Subtype base value; result.choices.values[*]?.error.int8Value projects the Subtype base value; result.choices.values[*]?.error.int16Value projects the Subtype base value; result.choices.values[*]?.error.int32Value projects the Subtype base value; result.choices.values[*]?.error.int64Value projects the Subtype base value; result.choices.values[*]?.error.natValue projects the Subtype base value; result.choices.values[*]?.error.intValue projects the Subtype base value; result.choices.values[*]?.error.float32Value projects the Subtype base value; result.choices.values[*]?.error.float64Value projects the Subtype base value; result.choices.values[*]?.error.textValue projects the Subtype base value; result.choices.values[*]?.error.bytesValue projects the Subtype base value; result.choices.values[*]?.error.charValue projects the Subtype base value; result.choices.values[*]?.error.usizeValue projects the Subtype base value; result.choices.values[*]?.error.isizeValue projects the Subtype base value; result.choices.values[*]?.error.digit &lt; 3.</remarks>
    public static Event ProduceEvent(RawPacket @arg0) => Interop.Runtime.Call2(@arg0);
    /// <param name="arg0">Contract type: <c>RawPacket</c>.</param>
    /// <returns>Contract type: <c>array&lt;option&lt;PacketAlias&gt;&gt;</c>.</returns>
    /// <remarks>Checked Lean Fin bounds: result[*]?.unitValue projects the Subtype base value; result[*]?.boolValue projects the Subtype base value; result[*]?.uint8Value projects the Subtype base value; result[*]?.uint16Value projects the Subtype base value; result[*]?.uint32Value projects the Subtype base value; result[*]?.uint64Value projects the Subtype base value; result[*]?.int8Value projects the Subtype base value; result[*]?.int16Value projects the Subtype base value; result[*]?.int32Value projects the Subtype base value; result[*]?.int64Value projects the Subtype base value; result[*]?.natValue projects the Subtype base value; result[*]?.intValue projects the Subtype base value; result[*]?.float32Value projects the Subtype base value; result[*]?.float64Value projects the Subtype base value; result[*]?.textValue projects the Subtype base value; result[*]?.bytesValue projects the Subtype base value; result[*]?.charValue projects the Subtype base value; result[*]?.usizeValue projects the Subtype base value; result[*]?.isizeValue projects the Subtype base value; result[*]?.digit &lt; 3.</remarks>
    public static Option<Packet>[] ProduceGroup(RawPacket @arg0) => Interop.Runtime.Call3(@arg0);
    /// <param name="arg0">Contract type: <c>RawPacket</c>.</param>
    /// <returns>Contract type: <c>Pair</c>.</returns>
    /// <remarks>Checked Lean Fin bounds: result.left[*]?.unitValue projects the Subtype base value; result.left[*]?.boolValue projects the Subtype base value; result.left[*]?.uint8Value projects the Subtype base value; result.left[*]?.uint16Value projects the Subtype base value; result.left[*]?.uint32Value projects the Subtype base value; result.left[*]?.uint64Value projects the Subtype base value; result.left[*]?.int8Value projects the Subtype base value; result.left[*]?.int16Value projects the Subtype base value; result.left[*]?.int32Value projects the Subtype base value; result.left[*]?.int64Value projects the Subtype base value; result.left[*]?.natValue projects the Subtype base value; result.left[*]?.intValue projects the Subtype base value; result.left[*]?.float32Value projects the Subtype base value; result.left[*]?.float64Value projects the Subtype base value; result.left[*]?.textValue projects the Subtype base value; result.left[*]?.bytesValue projects the Subtype base value; result.left[*]?.charValue projects the Subtype base value; result.left[*]?.usizeValue projects the Subtype base value; result.left[*]?.isizeValue projects the Subtype base value; result.left[*]?.digit &lt; 3; result.right[*]?.unitValue projects the Subtype base value; result.right[*]?.boolValue projects the Subtype base value; result.right[*]?.uint8Value projects the Subtype base value; result.right[*]?.uint16Value projects the Subtype base value; result.right[*]?.uint32Value projects the Subtype base value; result.right[*]?.uint64Value projects the Subtype base value; result.right[*]?.int8Value projects the Subtype base value; result.right[*]?.int16Value projects the Subtype base value; result.right[*]?.int32Value projects the Subtype base value; result.right[*]?.int64Value projects the Subtype base value; result.right[*]?.natValue projects the Subtype base value; result.right[*]?.intValue projects the Subtype base value; result.right[*]?.float32Value projects the Subtype base value; result.right[*]?.float64Value projects the Subtype base value; result.right[*]?.textValue projects the Subtype base value; result.right[*]?.bytesValue projects the Subtype base value; result.right[*]?.charValue projects the Subtype base value; result.right[*]?.usizeValue projects the Subtype base value; result.right[*]?.isizeValue projects the Subtype base value; result.right[*]?.digit &lt; 3.</remarks>
    public static Pair ProducePair(RawPacket @arg0) => Interop.Runtime.Call4(@arg0);
    /// <returns>Contract type: <c>uint32</c>.</returns>
    public static uint WordBits() => Interop.Runtime.Call5();
}
