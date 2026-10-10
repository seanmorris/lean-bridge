/**
 * Exact C# primitive conversion over the owned C ABI, including GMP views.
 *
 * @file
 */

/**
 * Emit bounded input snapshots and independent managed output values.
 *
 * @param node - Checked native scalar node and raw C# layout.
 */
export const ownedDotnetScalar = node => {
	const { name, raw } = node;
	if(name === "unit") return { input: ["return 0;"], output: ['if (*value != 0) throw new OwnedInvalidNative("Invalid native Unit");', "return default;"] };
	if(name === "bool") return { input: ["return value ? (byte)1 : (byte)0;"], output: ['return *value switch { 0 => false, 1 => true, _ => throw new OwnedInvalidNative("Invalid native Bool") };'] };
	if(name === "char") return {
		input: ['if (!global::System.Text.Rune.IsValid(value.Value)) throw new global::System.ArgumentException("Invalid Unicode scalar");', "return (uint)value.Value;"]
		, output: ['if (!global::System.Text.Rune.IsValid((int)*value)) throw new OwnedInvalidNative("Invalid native Char");', "return new global::System.Text.Rune((int)*value);"]
	};
	if(["nat", "int"].includes(name)) return {
		input: [
			...name === "nat" ? ['if (value.Sign < 0) throw new global::System.ArgumentOutOfRangeException(nameof(value), "Nat cannot be negative");'] : []
			, "var magnitude = global::System.Numerics.BigInteger.Abs(value);"
			, "var length = value.IsZero ? 0 : checked((magnitude.GetByteCount(isUnsigned: true) + 7) / 8);"
			, "scope.Native((nuint)sizeof(OwnedMpz)); scope.Native((nuint)length, 8);"
			, "var data = scope.Allocate<ulong>((nuint)length);"
			, "if (!scope.CheckOnly && length != 0 && !magnitude.TryWriteBytes(new global::System.Span<byte>((void*)data, checked(length * 8)), out _, isUnsigned: true, isBigEndian: false))"
			, '    throw new global::System.InvalidOperationException("BigInteger conversion failed");'
			, "return scope.Store(new OwnedMpz { Allocated = length, Length = value.Sign < 0 ? -length : length, Data = data });"
		]
		, output: [
			"scope.Native((nuint)sizeof(OwnedMpz));"
			, "var integer = Checked<OwnedMpz>(*value, 1, 8);"
			, 'if (integer->Length == int.MinValue || integer->Allocated < 0) throw new OwnedInvalidNative("Invalid GMP integer size");'
			, ...name === "nat" ? ['if (integer->Length < 0) throw new OwnedInvalidNative("Negative native Nat");'] : []
			, "var count = global::System.Math.Abs(integer->Length);"
			, 'if (count > integer->Allocated) throw new OwnedInvalidNative("GMP integer exceeds allocation");'
			, "scope.Native((nuint)count, 8); scope.Storage((nuint)count, 8); scope.Storage(64);"
			, "var digits = Checked<ulong>(integer->Data, (nuint)count, 8);"
			, 'if (count != 0 && digits[count - 1] == 0) throw new OwnedInvalidNative("Noncanonical GMP magnitude");'
			, "Checkpoint();"
			, "var result = new global::System.Numerics.BigInteger(new global::System.ReadOnlySpan<byte>(digits, checked(count * 8)), isUnsigned: true, isBigEndian: false);"
			, "return integer->Length < 0 ? -result : result;"
		]
	};
	if(name === "string" || name === "bytes") return {
		input: [
			"global::System.ArgumentNullException.ThrowIfNull(value);"
			, `var length = ${name === "string" ? "Utf8.GetByteCount(value)" : "value.Length"};`
			, "scope.Native((nuint)length);"
			, "var data = scope.Allocate<byte>((nuint)length);"
			, `if (!scope.CheckOnly) ${name === "string" ? "Utf8.GetBytes(value, new global::System.Span<byte>((void*)data, length));" : "global::System.MemoryExtensions.AsSpan<byte>(value).CopyTo(new global::System.Span<byte>((void*)data, length));"}`
			, `return new ${raw} { Data = data, Length = (nuint)length };`
		]
		, output: [
			"scope.Native(value->Length);"
			, "var data = Checked<byte>(value->Data, value->Length, 1);"
			, "var bytes = new global::System.ReadOnlySpan<byte>(data, checked((int)value->Length));"
			, ...name === "string" ? ["try", "{"
				, "    scope.Storage((nuint)Utf8.GetCharCount(bytes), 2); scope.Storage(32);"
				, "    Checkpoint(); return Utf8.GetString(bytes);", "}"
				, "catch (global::System.Text.DecoderFallbackException)"
				, '{ throw new OwnedInvalidNative("Invalid native UTF-8"); }'
			] : ["scope.Storage(value->Length); scope.Storage(32);", "Checkpoint(); return bytes.ToArray();"]
		]
	};
	return { input: ["return value;"], output: ["return *value;"] };
};
