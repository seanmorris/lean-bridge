/**
 * Implements the generate module in the .NET backend.
 *
 * @file
 */

import { compileManagedAlphaModel, managedBindingManifest } from "../managed/alpha-model.mjs";
import { auditManagedBindingPackage } from "../managed/package-audit.mjs";

const publicSource = model => `using System;

namespace LeanBridge.Alpha;

/// <summary>A copied Lean value with explicit primitive mappings.</summary>
public sealed record Payload
{
    public bool Enabled { get; }
    public uint Count { get; }
    public string Label { get; }
    public ReadOnlyMemory<byte> Bytes { get; }
    public ReadOnlyMemory<uint> Values { get; }

    public Payload(bool enabled, uint count, string label, ReadOnlyMemory<byte> bytes, ReadOnlyMemory<uint> values)
    {
        Enabled = enabled;
        Count = count;
        Label = label ?? throw new ArgumentNullException(nameof(label));
        Bytes = bytes.ToArray();
        Values = values.ToArray();
    }
}

/// <summary>A synchronous host or Lean transform.</summary>
public delegate uint Transform(uint value);

public class LeanBridgeException : Exception
{
    internal LeanBridgeException(string message) : base(message) { }
}

public sealed class DisposedResourceException : LeanBridgeException
{
    internal DisposedResourceException(string message) : base(message) { }
}

public sealed class CallbackThrewException : LeanBridgeException
{
    internal CallbackThrewException(string message, Exception? inner = null) : base(message)
    {
        if (inner is not null) Data["callbackException"] = inner;
    }
}

/// <summary>An identity-bearing Lean Box owned by this wrapper.</summary>
public sealed class Box : IDisposable
{
    private readonly BoxState state;

    public Box(uint value) => state = Runtime.CreateBox(value);

    public uint Read() => Runtime.ReadBox(state);

    public Box Identity()
    {
        Runtime.VerifyIdentity(state);
        return this;
    }

    public void Dispose() => state.Dispose();
}

/// <summary>An owned callable returned by Lean.</summary>
public sealed class OwnedTransform : IDisposable
{
    private readonly TransformState state;
    internal OwnedTransform(TransformState state) => this.state = state;
    public uint Invoke(uint value) => Runtime.CallTransform(state, value);
    public void Dispose() => state.Dispose();
}

/// <summary>Direct functions exported by ${model.component.name}.</summary>
public static class Alpha
{
    public static Payload RoundTrip(Payload payload) => Runtime.RoundTrip(payload ?? throw new ArgumentNullException(nameof(payload)));
    public static uint WithCallback(uint value, Transform transform) => Runtime.WithCallback(value, transform ?? throw new ArgumentNullException(nameof(transform)));
    public static OwnedTransform MakeAdder(uint @base) => new(Runtime.MakeAdder(@base));
}
`;

const runtimeSource = () => `using System;
using System.IO;
using System.Reflection;
using System.Runtime.CompilerServices;
using System.Runtime.ExceptionServices;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

namespace LeanBridge.Alpha;

internal sealed class BoxState : IDisposable
{
    private nint handle;
    internal BoxState(nint handle) => this.handle = handle;
    internal nint Require() => handle != 0 ? handle : throw new DisposedResourceException("Box is closed");
    public void Dispose()
    {
        var value = Interlocked.Exchange(ref handle, 0);
        if (value != 0) Native.BoxDispose(ref value);
        GC.SuppressFinalize(this);
    }
    ~BoxState() => Dispose();
}

internal sealed class TransformState : IDisposable
{
    private nint handle;
    internal TransformState(nint handle) => this.handle = handle;
    internal nint Require() => handle != 0 ? handle : throw new DisposedResourceException("Transform is closed");
    public void Dispose()
    {
        var value = Interlocked.Exchange(ref handle, 0);
        if (value != 0) Native.TransformDispose(ref value);
        GC.SuppressFinalize(this);
    }
    ~TransformState() => Dispose();
}

internal sealed class CallbackState : IDisposable
{
    internal readonly Transform Transform;
    internal Exception? Exception;
    internal nint Message;
    internal CallbackState(Transform transform) => Transform = transform;
    public void Dispose()
    {
        if (Message != 0) Marshal.FreeCoTaskMem(Message);
        Message = 0;
    }
}

internal static class Runtime
{
    internal static uint[] Snapshot()
    {
        var snapshot = Native.Snapshot();
        return [snapshot.RuntimeInitRuns, snapshot.ComponentInitRuns, snapshot.AttachedComponents, snapshot.LiveIdentities];
    }

    internal static BoxState CreateBox(uint value)
    {
        var status = Native.BoxCreate(value, out var handle, out var error);
        Check(status, error);
        return new BoxState(handle);
    }

    internal static uint ReadBox(BoxState box)
    {
        var status = Native.BoxRead(box.Require(), out var value, out var error);
        Check(status, error);
        return value;
    }

    internal static uint CompositionRead(BoxState box) => Native.BetaRead(box.Require());

    internal static void VerifyIdentity(BoxState box)
    {
        var expected = box.Require();
        var status = Native.BoxIdentity(expected, out var actual, out var error);
        Check(status, error);
        if (actual != expected) throw new LeanBridgeException("Lean returned a different Box identity");
    }

    internal static unsafe Payload RoundTrip(Payload value)
    {
        var label = Marshal.StringToCoTaskMemUTF8(value.Label);
        var bytes = value.Bytes.ToArray();
        var values = value.Values.ToArray();
        var bytesPin = default(GCHandle);
        var valuesPin = default(GCHandle);
        try
        {
            if (bytes.Length != 0) bytesPin = GCHandle.Alloc(bytes, GCHandleType.Pinned);
            if (values.Length != 0) valuesPin = GCHandle.Alloc(values, GCHandleType.Pinned);
            var input = new NativePayload
            {
                Enabled = value.Enabled ? (byte)1 : (byte)0,
                Count = value.Count,
                Label = new NativeSlice { Data = label, Length = checked((nuint)Encoding.UTF8.GetByteCount(value.Label)) },
                Bytes = new NativeSlice { Data = bytes.Length == 0 ? 0 : bytesPin.AddrOfPinnedObject(), Length = checked((nuint)bytes.Length) },
                Values = new NativeSlice { Data = values.Length == 0 ? 0 : valuesPin.AddrOfPinnedObject(), Length = checked((nuint)values.Length) },
            };
            var status = Native.RoundTrip(in input, out var output, out var error);
            Check(status, error);
            try
            {
                var outputLabel = output.Label.Data == 0 ? string.Empty : Marshal.PtrToStringUTF8(output.Label.Data, checked((int)output.Label.Length))!;
                var outputBytes = new byte[checked((int)output.Bytes.Length)];
                if (outputBytes.Length != 0) Marshal.Copy(output.Bytes.Data, outputBytes, 0, outputBytes.Length);
                var outputValues = new uint[checked((int)output.Values.Length)];
                for (var index = 0; index < outputValues.Length; index += 1) outputValues[index] = unchecked((uint)Marshal.ReadInt32(output.Values.Data, index * sizeof(uint)));
                return new Payload(output.Enabled != 0, output.Count, outputLabel, outputBytes, outputValues);
            }
            finally
            {
                Native.PayloadClear(ref output);
            }
        }
        finally
        {
            Marshal.FreeCoTaskMem(label);
            if (bytesPin.IsAllocated) bytesPin.Free();
            if (valuesPin.IsAllocated) valuesPin.Free();
        }
    }

    internal static unsafe uint WithCallback(uint value, Transform transform)
    {
        using var callback = new CallbackState(transform);
        var token = GCHandle.Alloc(callback);
        try
        {
            var native = new NativeTransform { Call = (nint)(delegate* unmanaged[Cdecl]<nint, uint, uint*, NativeError*, int>)&InvokeCallback, Context = GCHandle.ToIntPtr(token) };
            var status = Native.WithCallback(value, in native, out var result, out var error);
            if (callback.Exception is not null) ExceptionDispatchInfo.Capture(callback.Exception).Throw();
            Check(status, error);
            return result;
        }
        finally
        {
            token.Free();
        }
    }

    [UnmanagedCallersOnly(CallConvs = [typeof(CallConvCdecl)])]
    private static unsafe int InvokeCallback(nint context, uint value, uint* output, NativeError* error)
    {
        var callback = (CallbackState)GCHandle.FromIntPtr(context).Target!;
        try
        {
            *output = callback.Transform(value);
            return 0;
        }
        catch (Exception exception)
        {
            callback.Exception = exception;
            callback.Message = Marshal.StringToCoTaskMemUTF8(exception.Message);
            error->Code = 101;
            error->Message = callback.Message;
            error->MessageLength = checked((nuint)Encoding.UTF8.GetByteCount(exception.Message));
            return 4;
        }
    }

    internal static TransformState MakeAdder(uint value)
    {
        var status = Native.MakeAdder(value, out var handle, out var error);
        Check(status, error);
        return new TransformState(handle);
    }

    internal static uint CallTransform(TransformState transform, uint value)
    {
        var status = Native.TransformCall(transform.Require(), value, out var result, out var error);
        Check(status, error);
        return result;
    }

    private static void Check(int status, NativeError error)
    {
        if (status == 0) return;
        var message = error.Message == 0 ? $"Lean call failed with status {status}" : Marshal.PtrToStringUTF8(error.Message, checked((int)error.MessageLength))!;
        throw error.Code switch
        {
            100 => new DisposedResourceException(message),
            101 => new CallbackThrewException(message),
            _ => new LeanBridgeException(message),
        };
    }
}

[StructLayout(LayoutKind.Sequential)]
internal struct NativeError { internal int Code; internal nint Message; internal nuint MessageLength; }
[StructLayout(LayoutKind.Sequential)]
internal struct NativeSlice { internal nint Data; internal nuint Length; internal nint Owner; internal nint Release; }
[StructLayout(LayoutKind.Sequential)]
internal struct NativePayload { internal byte Enabled; private byte p1, p2, p3; internal uint Count; internal NativeSlice Label; internal NativeSlice Bytes; internal NativeSlice Values; }
[StructLayout(LayoutKind.Sequential)]
internal struct NativeTransform { internal nint Call; internal nint Context; }
[StructLayout(LayoutKind.Sequential)]
internal struct NativeSnapshot
{
    internal uint AbiVersion;
    internal uint RuntimeState;
    internal uint RuntimeInitRuns;
    internal uint ComponentInitRuns;
    internal uint AttachedComponents;
    internal uint LiveIdentities;
    internal ulong RuntimeInstanceId;
    internal ulong IdentityDomainId;
}

internal static partial class Native
{
    private const string RuntimeLibrary = "liblean_bridge_native.so";
    private const string ComponentLibrary = "liblean_alpha_component.so";
    private const string CompositionLibrary = "liblean_beta_component.so";
    private static nint runtimeHandle;
    private static nint componentHandle;

    static Native()
    {
        NativeLibrary.SetDllImportResolver(typeof(Native).Assembly, ResolveLibrary);
    }

    private static nint ResolveLibrary(string libraryName, Assembly assembly, DllImportSearchPath? searchPath)
    {
        if (libraryName != RuntimeLibrary && libraryName != ComponentLibrary && libraryName != CompositionLibrary) return 0;
        var root = Environment.GetEnvironmentVariable("LEAN_BRIDGE_NATIVE_ROOT");
        if (string.IsNullOrWhiteSpace(root))
        {
            var packaged = Path.Combine(AppContext.BaseDirectory, "runtimes", "linux-x64", "native");
            root = File.Exists(Path.Combine(packaged, ComponentLibrary)) ? packaged : AppContext.BaseDirectory;
        }
        runtimeHandle = NativeLibrary.Load(Path.Combine(root, RuntimeLibrary));
        componentHandle = NativeLibrary.Load(Path.Combine(root, ComponentLibrary));
        if (libraryName == RuntimeLibrary) return runtimeHandle;
        return libraryName == ComponentLibrary ? componentHandle : NativeLibrary.Load(Path.Combine(root, CompositionLibrary));
    }

    [LibraryImport(RuntimeLibrary, EntryPoint = "lean_bridge_native_snapshot_read")]
    [UnmanagedCallConv(CallConvs = [typeof(CallConvCdecl)])]
    private static partial void SnapshotRead(out NativeSnapshot snapshot);
    internal static NativeSnapshot Snapshot() { SnapshotRead(out var snapshot); return snapshot; }

    [LibraryImport(ComponentLibrary, EntryPoint = "lean_alpha_box_create")]
    [UnmanagedCallConv(CallConvs = [typeof(CallConvCdecl)])]
    internal static partial int BoxCreate(uint value, out nint result, out NativeError error);
    [LibraryImport(ComponentLibrary, EntryPoint = "lean_alpha_box_read")]
    [UnmanagedCallConv(CallConvs = [typeof(CallConvCdecl)])]
    internal static partial int BoxRead(nint self, out uint result, out NativeError error);
    [LibraryImport(CompositionLibrary, EntryPoint = "lean_beta_composition_read")]
    [UnmanagedCallConv(CallConvs = [typeof(CallConvCdecl)])]
    internal static partial uint BetaRead(nint self);
    [LibraryImport(ComponentLibrary, EntryPoint = "lean_alpha_box_identity")]
    [UnmanagedCallConv(CallConvs = [typeof(CallConvCdecl)])]
    internal static partial int BoxIdentity(nint self, out nint result, out NativeError error);
    [LibraryImport(ComponentLibrary, EntryPoint = "lean_alpha_round_trip")]
    [UnmanagedCallConv(CallConvs = [typeof(CallConvCdecl)])]
    internal static partial int RoundTrip(in NativePayload payload, out NativePayload result, out NativeError error);
    [LibraryImport(ComponentLibrary, EntryPoint = "lean_alpha_with_callback")]
    [UnmanagedCallConv(CallConvs = [typeof(CallConvCdecl)])]
    internal static partial int WithCallback(uint value, in NativeTransform transform, out uint result, out NativeError error);
    [LibraryImport(ComponentLibrary, EntryPoint = "lean_alpha_make_adder")]
    [UnmanagedCallConv(CallConvs = [typeof(CallConvCdecl)])]
    internal static partial int MakeAdder(uint value, out nint result, out NativeError error);
    [LibraryImport(ComponentLibrary, EntryPoint = "lean_alpha_owned_transform_call")]
    [UnmanagedCallConv(CallConvs = [typeof(CallConvCdecl)])]
    internal static partial int TransformCall(nint self, uint value, out uint result, out NativeError error);
    [LibraryImport(ComponentLibrary, EntryPoint = "lean_alpha_box_dispose")]
    [UnmanagedCallConv(CallConvs = [typeof(CallConvCdecl)])]
    internal static partial void BoxDispose(ref nint self);
    [LibraryImport(ComponentLibrary, EntryPoint = "lean_alpha_owned_transform_dispose")]
    [UnmanagedCallConv(CallConvs = [typeof(CallConvCdecl)])]
    internal static partial void TransformDispose(ref nint self);
    [LibraryImport(ComponentLibrary, EntryPoint = "lean_alpha_payload_clear")]
    [UnmanagedCallConv(CallConvs = [typeof(CallConvCdecl)])]
    internal static partial void PayloadClear(ref NativePayload payload);
}
`;

const projectSource = model => `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
    <AllowUnsafeBlocks>true</AllowUnsafeBlocks>
    <GenerateDocumentationFile>true</GenerateDocumentationFile>
    <PackageId>LeanBridge.Alpha</PackageId>
    <Version>${model.component.version}</Version>
    <Description>Generated ${model.component.name} bindings for one shared Lean runtime.</Description>
  </PropertyGroup>
</Project>
`;

/**
 * Generates dotnet binding package from validated semantic input without introducing behavior outside the generated native-language binding pipeline.
 *
 * @param ir - Binding IR document that defines the source types and operations.
 */
export const compileDotnetPackageModel = ir => Object.freeze({
	ir
	, model: compileManagedAlphaModel(ir, "dotnet")
});

/**
 * Renders a deterministic .NET package layout from its compiled model.
 *
 * @param root0 - Compiled .NET package model.
 * @param root0.model - Managed projection model.
 */
export const renderDotnetPackageLayout = ({ model }) => {
	const publicFiles = ["src/LeanBridge.Alpha/Alpha.cs"];
	const internalFiles = ["src/LeanBridge.Alpha/Runtime.cs"];
	const packageFiles = ["src/LeanBridge.Alpha/LeanBridge.Alpha.csproj"];
	const files = {
		[publicFiles[0]]: publicSource(model)
		, [internalFiles[0]]: runtimeSource()
		, [packageFiles[0]]: projectSource(model)
		, "README.md": `# ${model.component.name} .NET binding\n\nGenerated direct C# APIs over one process-wide Lean runtime.\n\nBinding IR SHA-256: \`${model.bindingIrSha256}\`\n`
	};
	const manifest = managedBindingManifest({
		model
		, generator: "dotnet"
		, files: [...publicFiles, ...internalFiles, ...packageFiles, "README.md"]
		, publicFiles
		, internalFiles
		, packageFiles
	});
	files["binding-manifest.json"] = `${JSON.stringify(manifest, null, 2)}\n`;
	return Object.freeze(files);
};

/**
 * Validates, compiles, renders, and audits one .NET binding package.
 *
 * @param ir - Binding IR document.
 */
export const generateDotnetBindingPackage = ir => {
	const packageModel = compileDotnetPackageModel(ir);
	const files = renderDotnetPackageLayout(packageModel);
	auditManagedBindingPackage(packageModel.ir, files, "dotnet");
	return files;
};
