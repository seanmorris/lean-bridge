/**
 * Generate scoped copied-value conversions without exposing native layouts.
 *
 * @file
 */

const nativeAlignment = copy => copy.variant ? Math.max(4, ...copy.cases.flatMap(branch => branch.fields.map(field => nativeAlignment(field.type))))
	: copy.record || copy.compound ? Math.max(1, ...copy.fields.map(field => nativeAlignment(field.type)))
		: copy.aggregate ? 8 : ["unit", "bool", "uint8", "int8"].includes(copy.scalarName) ? 1
			: ["uint16", "int16"].includes(copy.scalarName) ? 2 : ["char", "uint32", "int32", "float32"].includes(copy.scalarName) ? 4 : 8;

/**
 * Render all unmanaged C structs, including nested and empty records.
 *
 * @param model - Closed copied-value C# model.
 */
export const copiedNativeTypes = model => model.surface.copies.filter(copy => copy.aggregate).map(copy => copy.variant ? `
${copy.cases.map((branch, index) => `[StructLayout(LayoutKind.Sequential)]
internal struct C${copy.index}_${index}
{
${branch.fields.length ? branch.fields.map((field, i) => `    internal ${model.nativeType(field.type)} F${i};`).join("\n") : "    internal byte Empty;"}
}`).join("\n")}
[StructLayout(LayoutKind.Explicit)]
internal struct V${copy.index}
{
${copy.cases.map((_, index) => `    [FieldOffset(0)] internal C${copy.index}_${index} Case${index};`).join("\n")}
}
[StructLayout(LayoutKind.Sequential)]
internal struct N${copy.index}
{
    internal uint Kind;
    internal V${copy.index} Cases;
}
` : `
[StructLayout(LayoutKind.Sequential)]
internal struct N${copy.index}
{
${copy.compound ? `${copy.compound === "tuple" ? "" : "    internal byte Flag;\n"}${copy.fields.map((field, index) => `    internal ${model.nativeType(field.type)} F${index};`).join("\n")}`
	: copy.record ? copy.fields.length ? copy.fields.map((field, index) => `    internal ${model.nativeType(field.type)} F${index};`).join("\n") : "    internal byte Empty;"
		: `    internal nint Data;
    internal nuint Length;
    internal nint Context;
    internal nint Release;${copy.scalarName === "int" ? "\n    internal byte Negative;" : ""}`}
}`).join("\n");

/**
 * Render input/output conversions for each admitted type exactly once.
 *
 * @param model - Closed copied-value C# model.
 */
export const copiedConversions = model => model.surface.copies.map(copy => {
	const i = copy.index, type = model.publicType(copy), native = model.nativeType(copy);
	let input, output;
	if(copy.variant)
	{
		input = `ArgumentNullException.ThrowIfNull(value);
        scope.Charge(1, sizeof(${native}));
        return value switch
        {
${copy.cases.map((branch, index) => `            ${branch.publicName}${branch.fields.length ? " branch" : ""} => new ${native} { Kind = ${index}${branch.fields.length ? `, Cases = new V${i} { Case${index} = new C${i}_${index} { ${branch.fields.map((field, j) => `F${j} = To${field.type.index}(branch.${field.publicName}${field.type.aggregate ? ", scope" : ""})`).join(", ")} } }` : ""} },`).join("\n")}
            _ => throw new ArgumentException("Expected a named ${copy.publicName} constructor", nameof(value))
        };`;
		output = `return value.Kind switch
        {
${copy.cases.map((branch, index) => `            ${index} => new ${branch.publicName}(${branch.fields.map((field, j) => `From${field.type.index}(value.Cases.Case${index}.F${j})`).join(", ")}),`).join("\n")}
            _ => throw new InvalidOperationException("Invalid native ${copy.publicName} constructor")
        };`;
	} else if(copy.compound)
	{
		const to = (field, value) => `To${field.type.index}(${value}${field.type.aggregate ? ", scope" : ""})`;
		const from = (field, index) => `From${field.type.index}(value.F${index})`;
		input = `scope.Charge(1, sizeof(${native}));\n        `;
		if(copy.compound === "option")
		{
			input += `return value.IsSome ? new ${native} { Flag = 1, F0 = ${to(copy.fields[0], "value.Value")} } : default;`;
			output = `return value.Flag switch { 0 => ${type}.None, 1 => ${type}.Some(${from(copy.fields[0], 0)}), _ => throw new InvalidOperationException("Invalid native Option flag") };`;
		} else if(copy.compound === "result")
		{
			input += `if (value.IsOk) return new ${native} { Flag = 1, F0 = ${to(copy.fields[0], "value.Value")} };
        if (value.IsError) return new ${native} { F1 = ${to(copy.fields[1], "value.Error")} };
        throw new ArgumentException("Lean Except requires Result.Ok or Result.Err; default(Result) has no branch", nameof(value));`;
			output = `return value.Flag switch { 1 => ${type}.Ok(${from(copy.fields[0], 0)}), 0 => ${type}.Err(${from(copy.fields[1], 1)}), _ => throw new InvalidOperationException("Invalid native Except flag") };`;
		} else
		{
			input += `return new ${native} { ${copy.fields.map((field, index) => `F${index} = ${to(field, `value.Item${index + 1}`)}`).join(", ")} };`;
			output = `return (${copy.fields.map(from).join(", ")});`;
		}
	} else if(copy.record)
	{
		input = `ArgumentNullException.ThrowIfNull(value);
        scope.Charge(1, sizeof(${native}));
        return new ${native} { ${copy.fields.map((field, index) => `F${index} = To${field.type.index}(value.${field.publicName}${field.type.aggregate ? ", scope" : ""})`).join(", ")} };`;
		output = `return new ${type}(${copy.fields.map((field, index) => `From${field.type.index}(value.F${index})`).join(", ")});`;
	} else if(copy.element)
	{
		const e = copy.element, et = model.nativeType(e);
		input = `ArgumentNullException.ThrowIfNull(value);
        var data = scope.Allocate(value.Length, sizeof(${et}), Math.Max(sizeof(${et}), IntPtr.Size));
        for (var index = 0; index < value.Length; index++) ((${et}*)data)[index] = To${e.index}(value[index]${e.aggregate ? ", scope" : ""});
        return new ${native} { Data = data, Length = (nuint)value.Length };`;
		output = `if (value.Length > (nuint)((16 * 1024 * 1024) / Math.Max(sizeof(${et}), IntPtr.Size)))
            throw new ArgumentException("Lean Bridge native sequence exceeds the 16 MiB copy limit");
        if (value.Length != 0 && (value.Data == 0 || (nuint)value.Data % ${nativeAlignment(e)} != 0))
            throw new InvalidOperationException("Invalid native sequence buffer");
        var result = global::System.GC.AllocateUninitializedArray<${model.publicType(e)}>(checked((int)value.Length));
        for (var index = 0; index < result.Length; index++) result[index] = From${e.index}(((${et}*)value.Data)[index]);
        return result;`;
	} else switch(copy.scalarName)
	{
		case "unit": input = "return 0;"; output = "return default;"; break;
		case "bool": input = "return value ? (byte)1 : (byte)0;"; output = "return value != 0;"; break;
		case "char": input = "return (uint)value.Value;"; output = "return new global::System.Text.Rune(value);"; break;
		case "string":
			input = `ArgumentNullException.ThrowIfNull(value);
        var length = Utf8.GetByteCount(value);
        var data = scope.Allocate(length, 1);
        Utf8.GetBytes(value, new Span<byte>((void*)data, length));
        return new ${native} { Data = data, Length = (nuint)length };`;
			output = "return Utf8.GetString(new ReadOnlySpan<byte>((void*)value.Data, checked((int)value.Length)));"; break;
		case "bytes":
			input = `ArgumentNullException.ThrowIfNull(value);
        var data = scope.Allocate(value.Length, 1);
        value.AsSpan().CopyTo(new Span<byte>((void*)data, value.Length));
        return new ${native} { Data = data, Length = (nuint)value.Length };`;
			output = "return new ReadOnlySpan<byte>((void*)value.Data, checked((int)value.Length)).ToArray();"; break;
		case "nat": case "int":
			input = `${copy.scalarName === "nat" ? 'if (value.Sign < 0) throw new ArgumentOutOfRangeException(nameof(value), "Lean Nat cannot be negative");\n        ' : ""}var magnitude = global::System.Numerics.BigInteger.Abs(value);
        var limbs = value.IsZero ? 0 : checked((magnitude.GetByteCount(isUnsigned: true) + 3) / 4);
        var data = scope.Allocate(limbs, sizeof(uint));
        if (limbs != 0 && !magnitude.TryWriteBytes(new Span<byte>((void*)data, checked(limbs * 4)), out _, isUnsigned: true, isBigEndian: false)) throw new InvalidOperationException("Integer conversion failed");
        return new ${native} { Data = data, Length = (nuint)limbs${copy.scalarName === "int" ? ", Negative = value.Sign < 0 ? (byte)1 : (byte)0" : ""} };`;
			output = `var result = new global::System.Numerics.BigInteger(new ReadOnlySpan<byte>((void*)value.Data, checked((int)value.Length * 4)), isUnsigned: true, isBigEndian: false);
        return ${copy.scalarName === "int" ? "value.Negative != 0 ? -result : result" : "result"};`; break;
		default: input = "return value;"; output = "return value;";
	}
	return `    private static ${native} To${i}(${type} value${copy.aggregate ? ", Scope scope" : ""})
    {
        ${input}
    }
    private static ${type} From${i}(${native} value)
    {
        ${output}
    }`;
}).join("\n");

/** Closed, copied C# compound values. No native discriminants enter the public API. */
export const copiedCompoundTypes = `/// <summary>A copied Lean Option. Default is None; Some retains its payload, including nested None.</summary>
public readonly record struct Option<T>
{
    private readonly T value;
    private Option(T value) { this.value = value; IsSome = true; }
    public bool IsSome { get; }
    public bool IsNone => !IsSome;
    public T Value => IsSome ? value : throw new global::System.InvalidOperationException("None has no value");
    public static Option<T> None => default;
    public static Option<T> Some(T value) => new(value);
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
    public override string ToString() => IsOk ? $"Ok({value})" : IsError ? $"Err({error})" : "Uninitialized Result";
}
`;

/** C# scoped scratch allocation. Native results use their own generated clear functions. */
export const copiedScope = `internal sealed unsafe class Scope : IDisposable
{
    private readonly global::System.Collections.Generic.List<nint> allocations = new();
    private int remaining = 16 * 1024 * 1024;
    internal void Charge(int count, int width)
    {
        if (count < 0 || width <= 0 || count > remaining / width) throw new ArgumentException("Lean Bridge copy budget exceeded (16 MiB per call)");
        remaining -= count * width;
    }
    internal nint Allocate(int count, int width, int chargeWidth = 0)
    {
        Charge(count, chargeWidth == 0 ? width : chargeWidth);
        if (count == 0) return 0;
        var data = (nint)NativeMemory.AllocZeroed(checked((nuint)count * (nuint)width));
        if (data == 0) throw new OutOfMemoryException();
        try { allocations.Add(data); }
        catch { NativeMemory.Free((void*)data); throw; }
        return data;
    }
    public void Dispose()
    {
        foreach (var data in allocations) NativeMemory.Free((void*)data);
        allocations.Clear();
    }
}`;
