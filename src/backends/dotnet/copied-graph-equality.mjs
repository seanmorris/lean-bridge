/**
 * Bounded, stack-independent equality for generated recursive C# values.
 *
 * @file
 */

/** Internal traversal is shared by named records, options and results. */
export const dotnetGraphEquality = `internal interface IGraphValue
{
    int GraphTag { get; }
    int GraphCount { get; }
    object? GraphField(int index);
}

internal static class GraphValues
{
    private readonly record struct Entry(object? Value, global::System.Type? Type, int Count, int Tag);
    private readonly record struct Frame(object? Value, int Depth, int Index, int Count);

    // Keep only the current ancestry, not every object encountered. Repeated
    // references to an acyclic subtree have the same value as independent copies.
    private sealed class Cursor
    {
        private readonly global::System.Collections.Generic.Stack<Frame> pending = new();
        private readonly global::System.Collections.Generic.HashSet<object> active = new(global::System.Collections.Generic.ReferenceEqualityComparer.Instance);
        private int remaining = 262144;
        internal Cursor(object? root) => pending.Push(new(root, 0, -1, 0));
        internal bool Take(out Entry entry)
        {
            while (pending.TryPop(out var frame))
            {
                var value = frame.Value;
                if (frame.Index >= 0)
                {
                    if (frame.Index == frame.Count)
                    {
                        if (!value!.GetType().IsValueType) active.Remove(value);
                        continue;
                    }
                    pending.Push(frame with { Index = frame.Index + 1 });
                    object? child = value switch
                    {
                        IGraphValue graph => graph.GraphField(frame.Index),
                        global::System.Array array => array.GetValue(frame.Index),
                        global::System.Runtime.CompilerServices.ITuple tuple => tuple[frame.Index],
                        _ => throw new global::System.InvalidOperationException("Invalid graph traversal frame")
                    };
                    pending.Push(new(child, frame.Depth + 1, -1, 0));
                    continue;
                }
                if (frame.Depth > 128 || --remaining < 0)
                    throw new global::System.ArgumentException("Lean Bridge value comparison exceeds 128 levels or 262144 node visits");
                var type = value?.GetType();
                int count = -1, tag = 0;
                if (value is IGraphValue graphValue)
                {
                    count = graphValue.GraphCount;
                    tag = graphValue.GraphTag;
                }
                else if (value is global::System.Array array && value is not byte[])
                {
                    if (!type!.IsSZArray) throw new global::System.ArgumentException("Expected a zero-based, one-dimensional copied array");
                    count = array.Length;
                }
                else if (value is global::System.Runtime.CompilerServices.ITuple tuple
                    && type!.IsGenericType && type.GetGenericTypeDefinition() == typeof(global::System.ValueTuple<,>))
                    count = tuple.Length;
                else if (value is not (null or Unit or bool or byte or ushort or uint or ulong or sbyte or short or int or long
                    or float or double or string or byte[] or global::System.Text.Rune or global::System.Numerics.BigInteger))
                    throw new global::System.ArgumentException("Unsupported copied value in structural comparison");
                if (count > remaining) throw new global::System.ArgumentException("Lean Bridge value comparison exceeds 262144 node visits");
                if (count >= 0 && !type!.IsValueType && !active.Add(value!))
                    throw new global::System.ArgumentException("Cyclic copied values cannot be compared");
                if (count >= 0) pending.Push(new(value, frame.Depth, 0, count));
                // Array covariance does not change the copied payload. A
                // TreeLeaf[] supplied to a Tree[] field equals its Tree[] copy.
                entry = new(value, value is global::System.Array && value is not byte[] ? typeof(global::System.Array) : type, count, tag);
                return true;
            }
            entry = default;
            return false;
        }
    }

    internal static bool Equal(object? left, object? right)
    {
        var a = new Cursor(left);
        var b = new Cursor(right);
        bool equal = true;
        while (true)
        {
            bool moreA = a.Take(out var x), moreB = b.Take(out var y);
            if (!moreA && !moreB) return equal;
            // Continue after a mismatch so cycles or limits in later fields
            // cannot hide behind an unequal prefix or a reference shortcut.
            if (!moreA || !moreB || x.Type != y.Type || x.Count != y.Count || x.Tag != y.Tag) { equal = false; continue; }
            if (x.Count >= 0) continue;
            if (x.Value is byte[] bytes)
                equal &= global::System.MemoryExtensions.SequenceEqual<byte>(bytes, (byte[])y.Value!);
            else equal &= global::System.Object.Equals(x.Value, y.Value);
        }
    }

    internal static int Hash(object? value)
    {
        var cursor = new Cursor(value);
        var hash = new global::System.HashCode();
        while (cursor.Take(out var entry))
        {
            hash.Add(entry.Type); hash.Add(entry.Count); hash.Add(entry.Tag);
            if (entry.Count >= 0) continue;
            if (entry.Value is byte[] bytes)
            {
                hash.Add(bytes.Length);
                foreach (var item in bytes) hash.Add(item);
            }
            else hash.Add(entry.Value);
        }
        return hash.ToHashCode();
    }

    internal static string Format(object value)
    {
        var cursor = new Cursor(value);
        var text = new global::System.Text.StringBuilder();
        bool truncated = false;
        while (cursor.Take(out var entry))
        {
            if (text.Length >= 4096) { truncated = true; continue; }
            if (text.Length != 0) text.Append(' ');
            if (entry.Count >= 0) text.Append(entry.Type!.Name).Append('[').Append(entry.Tag).Append(':').Append(entry.Count).Append(']');
            else if (entry.Value is byte[] bytes) text.Append("bytes[").Append(bytes.Length).Append(']');
            else if (entry.Value is string content)
            {
                int length = global::System.Math.Min(content.Length, 4096 - text.Length);
                text.Append(content, 0, length); truncated |= length != content.Length;
            }
            else if (entry.Value is global::System.Numerics.BigInteger integer && integer.GetByteCount() > 256)
                text.Append("BigInteger[").Append(integer.GetByteCount()).Append(" bytes]");
            else text.Append(entry.Value ?? "null");
            if (text.Length > 4096) { text.Length = 4096; truncated = true; }
        }
        if (truncated) text.Append("...");
        return text.ToString();
    }
}
`;

/** Closed options and results keep their active branch in structural traversal. */
export const dotnetGraphCompoundTypes = `/// <summary>A copied Lean Option. Default is None, distinct from Some(None).</summary>
public readonly record struct Option<T> : IGraphValue
{
    private readonly T value;
    private Option(T value) { this.value = value; IsSome = true; }
    public bool IsSome { get; }
    public bool IsNone => !IsSome;
    public T Value => IsSome ? value : throw new global::System.InvalidOperationException("None has no value");
    public static Option<T> None => default;
    public static Option<T> Some(T value) => new(value);
    int IGraphValue.GraphTag => IsSome ? 1 : 0;
    int IGraphValue.GraphCount => IsSome ? 1 : 0;
    object? IGraphValue.GraphField(int index) => index == 0 && IsSome ? value : throw new global::System.ArgumentOutOfRangeException(nameof(index));
    public bool Equals(Option<T> other) => GraphValues.Equal(this, other);
    public override int GetHashCode() => GraphValues.Hash(this);
    public override string ToString() => GraphValues.Format(this);
}

/// <summary>A copied Lean Except. Default is invalid; construct Ok(value) or Err(error).</summary>
public readonly record struct Result<T, E> : IGraphValue
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
    int IGraphValue.GraphTag => state;
    int IGraphValue.GraphCount => IsInitialized ? 1 : 0;
    object? IGraphValue.GraphField(int index) => index == 0 && IsInitialized ? (IsOk ? (object?)value : error) : throw new global::System.ArgumentOutOfRangeException(nameof(index));
    public bool Equals(Result<T, E> other) => GraphValues.Equal(this, other);
    public override int GetHashCode() => GraphValues.Hash(this);
    public override string ToString() => GraphValues.Format(this);
}
`;
