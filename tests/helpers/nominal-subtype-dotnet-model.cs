// Synthetic caller controls, not Lean compilation or installed acceptance.
using System;
using System.Linq;
using System.Numerics;
using Item = LeanBridge.Nominalsubtypes.Option<LeanBridge.Nominalsubtypes.Envelope>;
using Choice = LeanBridge.Nominalsubtypes.Option<LeanBridge.Nominalsubtypes.Result<System.Numerics.BigInteger, System.Numerics.BigInteger>>;
using Branch = LeanBridge.Nominalsubtypes.Result<System.Numerics.BigInteger, System.Numerics.BigInteger>;

namespace LeanBridge.Nominalsubtypes;

// Dishonest host equality must not conceal faulty payloads from the caller.
public abstract class DishonestEquality
{
    public override bool Equals(object? other) => true;
    public override int GetHashCode() => 0;
}
public sealed class Envelope(BigInteger payload, BigInteger digit) : DishonestEquality
{
    public BigInteger Payload { get; } = payload;
    public BigInteger Digit { get; } = digit;
}
public sealed class AliasPair(Item[] left, Item[] right) : DishonestEquality
{
    public Item[] Left { get; } = left;
    public Item[] Right { get; } = right;
}
#if !RESULT_ONLY
public sealed class Pair(Envelope left, Envelope right) : DishonestEquality
{
    public Envelope Left { get; } = left;
    public Envelope Right { get; } = right;
}
#endif
public abstract class Event : DishonestEquality;
public sealed class EventEmpty : Event;
public sealed class EventBox(Envelope value) : Event { public Envelope Value { get; } = value; }
public sealed class EventChoices(Choice[] values) : Event { public Choice[] Values { get; } = values; }
public readonly struct Option<T>
{
    readonly T value;
    Option(T value) { this.value = value; IsSome = true; }
    public bool IsSome { get; }
    public T Value => IsSome ? value : throw new InvalidOperationException();
    public static Option<T> None => default;
    public static Option<T> Some(T value) => new(value);
    public override bool Equals(object? other) => true;
    public override int GetHashCode() => 0;
}
public readonly struct Result<T, E>
{
    readonly int state;
    readonly T value;
    readonly E error;
    Result(int state, T value, E error) { this.state = state; this.value = value; this.error = error; }
    public bool IsOk => state == 1;
    public bool IsError => state == 2;
    public T Value => IsOk ? value : throw new InvalidOperationException();
    public E Error => IsError ? error : throw new InvalidOperationException();
    public static Result<T, E> Ok(T value) => new(1, value, default!);
    public static Result<T, E> Err(E error) => new(2, default!, error);
    public override bool Equals(object? other) => true;
    public override int GetHashCode() => 0;
}
public static class Api
{
    static bool Mutant(string name) => Environment.GetEnvironmentVariable("NOMINAL_DOTNET_MUTANT") == name;
    static BigInteger Nat(BigInteger value)
    {
        if (value.Sign < 0 && !Mutant("negative-nat")) throw new ArgumentOutOfRangeException(nameof(value));
        return value;
    }
    static Envelope Wrap(BigInteger value) => new(value, 2);
    static Item[] Groups(BigInteger value) => new[] { Item.None, Item.Some(Wrap(value + 1)) };
    public static BigInteger Scalar(BigInteger value) => Nat(value) + (Mutant("scalar") ? 0 : 1);
    public static Envelope ProduceEnvelope(BigInteger value)
    {
        var result = Nat(value) + 1;
        return Wrap(Mutant("truncate-envelope") ? result & ulong.MaxValue : result);
    }
    public static BigInteger[] ArrayValues(BigInteger value) => Mutant("short-array") ? new[] { Nat(value) + 1 } : new[] { Nat(value) + 1, value + 2 };
    public static BigInteger[] ListValues(BigInteger value) => new[] { Nat(value) + 1, value + 2 };
    public static Option<BigInteger> Optional(BigInteger value) => Nat(value).IsZero ? Option<BigInteger>.None : Option<BigInteger>.Some(value + 1);
    public static (BigInteger, BigInteger) Product(BigInteger value) => (Nat(value) + 1, value + 2);
    public static Branch Branch(BigInteger value) => Nat(value).IsZero ? global::LeanBridge.Nominalsubtypes.Result<BigInteger, BigInteger>.Err(value + 1) : global::LeanBridge.Nominalsubtypes.Result<BigInteger, BigInteger>.Ok(value + 1);
    public static Item[] GroupValues(BigInteger value) => Groups(Nat(value));
    public static AliasPair PairValues(BigInteger value)
    {
        var left = Groups(Nat(value)); var right = Groups(value + 1);
        if (Mutant("missing-pair-values")) right = Array.Empty<Item>();
        return Mutant("swap-pair") ? new AliasPair(right, left) : new AliasPair(left, right);
    }
    public static Event EventValue(BigInteger value) => Mutant("missing-event-value") ? new EventEmpty() : new EventBox(Wrap(Nat(value) + 1));
    public static Event EventEmpty(BigInteger value) { Nat(value); return new EventEmpty(); }
    public static Event EventChoices(BigInteger value)
    {
        Nat(value);
        if (Mutant("missing-event-choices")) return new EventEmpty();
        return new EventChoices(new[] { Choice.None, Choice.Some(global::LeanBridge.Nominalsubtypes.Result<BigInteger, BigInteger>.Ok(value + 1)),
            Choice.Some(Mutant("wrong-choice-tag") ? global::LeanBridge.Nominalsubtypes.Result<BigInteger, BigInteger>.Ok(value + 2) : global::LeanBridge.Nominalsubtypes.Result<BigInteger, BigInteger>.Err(value + 2)) });
    }
    public static BigInteger[] NoItems(BigInteger value) { Nat(value); return Array.Empty<BigInteger>(); }
#if !RESULT_ONLY
    static string Path(int index) => (Environment.GetEnvironmentVariable("NOMINAL_DOTNET_ROUTE") == "reviewed" ? "value" : "arg") + index;
    static ArgumentException Error(string message) => new(Mutant("wrong-error-path") ? "wrong path" : message);
    static void Fin(BigInteger value, string path)
    {
        Nat(value);
        if (value >= 3) throw Error(path + " is not below its Fin 3 bound");
    }
    static void CheckEnvelope(Envelope value, string path)
    {
        ArgumentNullException.ThrowIfNull(value);
        Nat(value.Payload); Fin(value.Digit, path + ".digit");
    }
    static void CheckGroups(Item[] value, string path)
    {
        ArgumentNullException.ThrowIfNull(value);
        for (int index = 0; index < value.Length; index++)
            if (value[index].IsSome) CheckEnvelope(value[index].Value, $"{path}[{index}]?");
    }
    static BigInteger Normalize(BigInteger value, string path, int amount)
    {
        if (value >= (amount == 1 ? 100 : 90)) throw Error(path + " was rejected by NominalSubtypes." + (amount == 1 ? "plusOne" : "plusTwo"));
        return value + amount;
    }
    static Envelope Transform(Envelope value, string path, int amount) => new(Normalize(value.Payload, path + ".payload", amount), value.Digit);
    static Item[] TransformGroups(Item[] values, string path, int amount) => values.Select((item, index) =>
        item.IsSome ? Item.Some(Transform(item.Value, $"{path}[{index}]?", amount)) : Item.None).ToArray();
    static BigInteger Sum(Item[] values) => values.Where(item => item.IsSome).Aggregate(BigInteger.Zero, (sum, item) => sum + item.Value.Payload);
    public static BigInteger First(Envelope value)
    {
        CheckEnvelope(value, Path(0)); return Mutant("first") ? value.Payload : Transform(value, Path(0), 1).Payload;
    }
    public static BigInteger Second(Envelope value)
    {
        CheckEnvelope(value, Path(0)); return Transform(value, Path(0), Mutant("second") ? 1 : 2).Payload;
    }
    public static Envelope Echo(Envelope value) { CheckEnvelope(value, Path(0)); return Transform(value, Path(0), 1); }
    public static BigInteger Combine(Envelope left, Envelope right)
    {
        if (Mutant("fin-after-subtype")) Transform(left, Path(0), 1);
        CheckEnvelope(left, Path(0)); CheckEnvelope(right, Path(1));
        return Transform(left, Path(0), 1).Payload * (Mutant("combine") ? 1 : 100) + Transform(right, Path(1), 2).Payload;
    }
    public static BigInteger Nested(Pair value)
    {
        ArgumentNullException.ThrowIfNull(value);
        string left = Path(0) + ".left", right = Path(0) + ".right";
        CheckEnvelope(value.Left, left); CheckEnvelope(value.Right, right);
        return Transform(value.Left, left, 1).Payload * (Mutant("nested") ? 1 : 100) + Transform(value.Right, right, 2).Payload;
    }
    public static BigInteger Aliases(Item[] left, Item[] right)
    {
        CheckGroups(left, Path(0)); CheckGroups(right, Path(1));
        return Sum(TransformGroups(left, Path(0), 1)) + Sum(TransformGroups(right, Path(1), 2));
    }
    public static Item[] EchoGroups(Item[] value)
    {
        CheckGroups(value, Path(0));
        var result = TransformGroups(value, Path(0), 1);
        if (Mutant("mutate-accepted-input") && value.Length > 0) value[0] = Item.Some(Wrap(55));
        return result;
    }
    public static AliasPair EchoPair(AliasPair value)
    {
        ArgumentNullException.ThrowIfNull(value);
        string left = Path(0) + ".left", right = Path(0) + ".right";
        CheckGroups(value.Left, left); CheckGroups(value.Right, right);
        try { return new AliasPair(TransformGroups(value.Left, left, 1), TransformGroups(value.Right, right, 2)); }
        catch (ArgumentException)
        {
            if (Mutant("mutate-rejected-input") && value.Left.Length > 0) value.Left[0] = Item.Some(Wrap(55));
            throw;
        }
    }
    public static BigInteger InspectAliasPair(AliasPair value) { var result = EchoPair(value); return Sum(result.Left) + Sum(result.Right); }
    static Event TransformEvent(Event value, int one, int two)
    {
        ArgumentNullException.ThrowIfNull(value);
        if (value is EventEmpty) return new EventEmpty();
        if (value is EventBox box)
        {
            string path = Path(0) + ".box.value"; CheckEnvelope(box.Value, path);
            return new EventBox(Transform(box.Value, path, one));
        }
        if (value is EventChoices choices)
        {
            foreach (var item in choices.Values)
                if (item.IsSome && !item.Value.IsOk && !item.Value.IsError)
                {
                    if (Mutant("default-result")) return new EventEmpty();
                    throw new ArgumentException("Uninitialized result", nameof(value));
                }
            return new EventChoices(choices.Values.Select((item, index) =>
            {
                if (!item.IsSome) return Choice.None;
                var branch = item.Value;
                var result = Normalize(branch.IsOk ? branch.Value : branch.Error,
                    $"{Path(0)}.choices.values[{index}]?.{(branch.IsOk ? "ok" : "error")}", branch.IsOk ? one : two);
                return Choice.Some(branch.IsOk ? global::LeanBridge.Nominalsubtypes.Result<BigInteger, BigInteger>.Ok(result) : global::LeanBridge.Nominalsubtypes.Result<BigInteger, BigInteger>.Err(result));
            }).ToArray());
        }
        throw new ArgumentException("Unknown event", nameof(value));
    }
    static BigInteger EventSum(Event value) => value switch
    {
        EventEmpty _ => BigInteger.Zero,
        EventBox box => box.Value.Payload,
        EventChoices choices => choices.Values.Where(item => item.IsSome).Aggregate(BigInteger.Zero,
            (sum, item) => sum + (item.Value.IsOk ? item.Value.Value : item.Value.Error)),
        _ => throw new InvalidOperationException()
    };
    public static BigInteger EventFirst(Event value) => EventSum(TransformEvent(value, 1, 2));
    public static BigInteger EventSecond(Event value) => EventSum(TransformEvent(value, 2, 1));
    public static Event EchoEvent(Event value) => TransformEvent(value, 1, 2);
    public static BigInteger PlainFin(BigInteger value) { if (!Mutant("plain-fin")) Fin(value, Path(0)); return value; }
#endif
}
