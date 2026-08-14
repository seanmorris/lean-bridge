#!/usr/bin/env node
/**
 * Tests the managed registry consumers workflow.
 *
 * @file
 */


import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

import {
	STEADY_STATE_BOX_VALUE,
	STEADY_STATE_MEASURED_ITERATIONS,
	STEADY_STATE_OPERATION,
	STEADY_STATE_WARMUP_ITERATIONS,
	writeConsumerPerformance,
} from "../src/adoption/consumer-performance.mjs";

const execute = promisify(execFile);
const options = new Map();
for(let index = 2; index < process.argv.length; index += 2) options.set(process.argv[index], process.argv[index + 1]);
for(const required of ["--nuget", "--maven", "--rubygem"]) if(!options.has(required)) throw new Error(`missing ${required}`);
const dotnet = options.get("--dotnet") ?? process.env.LEAN_BRIDGE_DOTNET ?? "dotnet";
const java = options.get("--java") ?? process.env.LEAN_BRIDGE_JAVA ?? "java";
const javac = options.get("--javac") ?? process.env.LEAN_BRIDGE_JAVAC ?? "javac";
const kotlin = options.get("--kotlin") ?? process.env.LEAN_BRIDGE_KOTLIN ?? "kotlin";
const kotlinc = options.get("--kotlinc") ?? process.env.LEAN_BRIDGE_KOTLINC ?? "kotlinc";
const maven = options.get("--mvn") ?? process.env.LEAN_BRIDGE_MAVEN ?? "mvn";
const ruby = options.get("--ruby") ?? process.env.LEAN_BRIDGE_RUBY ?? "ruby";
const gem = options.get("--gem") ?? process.env.LEAN_BRIDGE_GEM ?? "gem";
const nugetRoot = resolve(options.get("--nuget"));
const mavenRoot = resolve(options.get("--maven"));
const rubyGem = resolve(options.get("--rubygem"));
const scratch = await mkdtemp(join(tmpdir(), "lean-bridge-managed-registry-"));

const run = async (command, args, settings = {}) => {
	try
	{
		return await execute(command, args, { maxBuffer: 32 * 1024 * 1024, ...settings });
	} catch(error)
	{
		throw new Error(`${command} failed\n${error.stdout ?? ""}${error.stderr ?? ""}`, { cause: error });
	}
};

const write = async (path, value) => {
	await mkdir(dirname(path), { recursive: true });
	await writeFile(path, value);
};

const parseMeasurement = stdout => {
	const value = JSON.parse(stdout.trim().split("\n").at(-1));
	if(
		value.iterations !== STEADY_STATE_MEASURED_ITERATIONS
    || !Number.isFinite(value.durationNanoseconds) || value.durationNanoseconds <= 0
    || value.checksum !== STEADY_STATE_BOX_VALUE * value.iterations
    || value.operationIterations !== 10_000
    || ["initializationNanoseconds", "copiedValueNanoseconds", "callbackNanoseconds", "callableNanoseconds", "peakRssBytes"]
      .some(field => !Number.isFinite(value[field]) || value[field] <= 0)
	) throw new Error(`invalid managed registry performance result: ${stdout}`);
	return value;
};

const dotnetRoot = join(scratch, "dotnet");
await write(join(dotnetRoot, "Consumer.csproj"), `<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net8.0</TargetFramework><ImplicitUsings>enable</ImplicitUsings><Nullable>enable</Nullable></PropertyGroup><ItemGroup><PackageReference Include="LeanBridge.Alpha" Version="0.0.0" /></ItemGroup></Project>\n`);
await write(join(dotnetRoot, "Program.cs"), `using System.Diagnostics;
using LeanBridge.Alpha;
var initializationStarted = Stopwatch.GetTimestamp();
using var box = new Box(${STEADY_STATE_BOX_VALUE});
_ = box.Read();
var initializationNanoseconds = (Stopwatch.GetTimestamp() - initializationStarted) * 1_000_000_000.0 / Stopwatch.Frequency;
if (box.Read() != ${STEADY_STATE_BOX_VALUE} || !ReferenceEquals(box.Identity(), box)) throw new Exception("Box contract failed");
var boxState = typeof(Box).GetField("state", System.Reflection.BindingFlags.Instance | System.Reflection.BindingFlags.NonPublic)!.GetValue(box)!;
var runtimeType = typeof(Box).Assembly.GetType("LeanBridge.Alpha.Runtime", true)!;
var compositionRead = runtimeType.GetMethod("CompositionRead", System.Reflection.BindingFlags.Static | System.Reflection.BindingFlags.NonPublic)!;
if ((uint)compositionRead.Invoke(null, new[] { boxState })! != ${STEADY_STATE_BOX_VALUE}) throw new Exception("Beta composition contract failed");
var snapshotRead = runtimeType.GetMethod("Snapshot", System.Reflection.BindingFlags.Static | System.Reflection.BindingFlags.NonPublic)!;
var sharedSnapshot = (uint[])snapshotRead.Invoke(null, null)!;
if (!sharedSnapshot.SequenceEqual(new uint[] { 1, 2, 2, 1 })) throw new Exception($"shared runtime snapshot failed: {string.Join(',', sharedSnapshot)}");
var payload = Alpha.RoundTrip(new Payload(true, 41, "Lean λ", new byte[] { 0, 255 }, new uint[] { 0, uint.MaxValue }));
if (payload.Enabled || payload.Count != 42 || !payload.Bytes.Span.SequenceEqual(new byte[] { 0, 255 })) throw new Exception("Payload contract failed");
var callbackThread = Environment.CurrentManagedThreadId;
if (Alpha.WithCallback(40, value => { if (Environment.CurrentManagedThreadId != callbackThread) throw new Exception("callback changed threads"); return value + 2; }) != 44) throw new Exception("callback contract failed");
try { Alpha.WithCallback(40, _ => throw new InvalidOperationException("callback marker")); throw new Exception("callback failure was accepted"); } catch (InvalidOperationException exception) when (exception.Message == "callback marker") { }
using var adder = Alpha.MakeAdder(2); if (adder.Invoke(40) != 42) throw new Exception("callable contract failed");
const int operationIterations = 10000;
var operationPayload = new Payload(true, 41, "Lean λ", new byte[] { 0, 255 }, new uint[] { 0, uint.MaxValue });
var operationStarted = Stopwatch.GetTimestamp();
for (var index = 0; index < operationIterations; index += 1) _ = Alpha.RoundTrip(operationPayload);
var copiedValueNanoseconds = (Stopwatch.GetTimestamp() - operationStarted) * 1_000_000_000.0 / Stopwatch.Frequency;
operationStarted = Stopwatch.GetTimestamp();
for (var index = 0; index < operationIterations; index += 1) _ = Alpha.WithCallback(40, value => value + 2);
var callbackNanoseconds = (Stopwatch.GetTimestamp() - operationStarted) * 1_000_000_000.0 / Stopwatch.Frequency;
operationStarted = Stopwatch.GetTimestamp();
for (var index = 0; index < operationIterations; index += 1) _ = adder.Invoke(40);
var callableNanoseconds = (Stopwatch.GetTimestamp() - operationStarted) * 1_000_000_000.0 / Stopwatch.Frequency;
for (var index = 0; index < ${STEADY_STATE_WARMUP_ITERATIONS}; index += 1) _ = box.Read();
ulong checksum = 0; var started = Stopwatch.GetTimestamp();
for (var index = 0; index < ${STEADY_STATE_MEASURED_ITERATIONS}; index += 1) checksum += box.Read();
var duration = (Stopwatch.GetTimestamp() - started) * 1_000_000_000.0 / Stopwatch.Frequency;
adder.Dispose(); adder.Dispose(); box.Dispose(); box.Dispose();
try { box.Read(); throw new Exception("stale Box use was accepted"); } catch (DisposedResourceException) { }
if (!((uint[])snapshotRead.Invoke(null, null)!).SequenceEqual(new uint[] { 1, 2, 2, 0 })) throw new Exception("native cleanup snapshot failed");
Console.WriteLine(System.Text.Json.JsonSerializer.Serialize(new { iterations = ${STEADY_STATE_MEASURED_ITERATIONS}, durationNanoseconds = (long)duration, checksum, initializationNanoseconds = (long)initializationNanoseconds, operationIterations, copiedValueNanoseconds = (long)copiedValueNanoseconds, callbackNanoseconds = (long)callbackNanoseconds, callableNanoseconds = (long)callableNanoseconds, peakRssBytes = Process.GetCurrentProcess().PeakWorkingSet64 }));
`);
const dotnetEnvironment = { ...process.env, DOTNET_CLI_HOME: join(scratch, "dotnet-home"), DOTNET_CLI_TELEMETRY_OPTOUT: "1", DOTNET_NOLOGO: "1", NUGET_PACKAGES: join(scratch, "nuget-cache") };
await run(dotnet, ["restore", join(dotnetRoot, "Consumer.csproj"), "--source", nugetRoot, "--ignore-failed-sources", "--nologo"], { env: dotnetEnvironment });
await run(dotnet, ["build", join(dotnetRoot, "Consumer.csproj"), "--configuration", "Release", "--no-restore", "--nologo", "--disable-build-servers"], { env: dotnetEnvironment });
const dotnetMeasurement = parseMeasurement((await run(dotnet, [join(dotnetRoot, "bin/Release/net8.0/Consumer.dll")], { env: dotnetEnvironment })).stdout);

const mavenRepository = join(mavenRoot, "repository");
const localRepository = join(scratch, "maven-repository");
await run(maven, ["--batch-mode", "--quiet", `-Dmaven.repo.local=${localRepository}`, "org.apache.maven.plugins:maven-dependency-plugin:3.8.1:get", "-Dartifact=org.leanbridge:lean-alpha:0.0.0", `-DremoteRepositories=lean-bridge::default::${pathToFileURL(mavenRepository).href}`, "-Dtransitive=false"]);
const jar = join(localRepository, "org/leanbridge/lean-alpha/0.0.0/lean-alpha-0.0.0.jar");
const jvmRoot = join(scratch, "jvm");
await write(join(jvmRoot, "Consumer.java"), `package org.leanbridge.alpha;
import java.net.URLClassLoader;
import java.nio.file.Path;
import java.util.Arrays;
public final class Consumer {
  private static long peakRssBytes() throws Exception {
    for (String line : java.nio.file.Files.readAllLines(Path.of("/proc/self/status"))) {
      if (line.startsWith("VmHWM:")) return Long.parseLong(line.replaceAll("[^0-9]", "")) * 1024L;
    }
    throw new AssertionError("VmHWM is unavailable");
  }
  private static void verifyClassLoaders(String jarPath) throws Exception {
    for (int index = 0; index < 2; index++) {
      try (URLClassLoader loader = new URLClassLoader(new java.net.URL[]{Path.of(jarPath).toUri().toURL()}, ClassLoader.getPlatformClassLoader())) {
        Class<?> type = Class.forName("org.leanbridge.alpha.Box", true, loader);
        Object value = type.getConstructor(long.class).newInstance(19L);
        if (!Long.valueOf(19L).equals(type.getMethod("read").invoke(value))) throw new AssertionError("class-loader Box contract failed");
        type.getMethod("close").invoke(value);
      }
    }
  }
  public static void main(String[] args) throws Exception {
  long initializationStarted = System.nanoTime();
  Box initializedBox = new Box(${STEADY_STATE_BOX_VALUE});
  initializedBox.read();
  long initializationNanoseconds = System.nanoTime() - initializationStarted;
  try (Box box = initializedBox) {
    if (box.read() != ${STEADY_STATE_BOX_VALUE} || box.identity() != box) throw new AssertionError("Box contract failed");
    if (Runtime.compositionRead(box) != ${STEADY_STATE_BOX_VALUE}) throw new AssertionError("Beta composition contract failed");
    Runtime.Snapshot shared = Runtime.snapshot();
    if (shared.runtimeInitRuns() != 1 || shared.componentInitRuns() != 2 || shared.attachedComponents() != 2 || shared.liveIdentities() != 1) throw new AssertionError("shared runtime snapshot failed");
    Payload payload = Alpha.roundTrip(new Payload(true, 41, "Lean λ", new byte[]{0, (byte)255}, new long[]{0, 0xffff_ffffL}));
    if (payload.enabled() || payload.count() != 42 || !Arrays.equals(payload.bytes(), new byte[]{0, (byte)255})) throw new AssertionError("Payload contract failed");
    Thread callbackThread = Thread.currentThread();
    if (Alpha.withCallback(40, value -> { if (Thread.currentThread() != callbackThread) throw new AssertionError("callback changed threads"); return value + 2; }) != 44) throw new AssertionError("callback contract failed");
    try { Alpha.withCallback(40, value -> { throw new IllegalStateException("callback marker"); }); throw new AssertionError("callback failure was accepted"); } catch (CallbackThrewException expected) { }
    try (OwnedTransform adder = Alpha.makeAdder(2)) { if (adder.apply(40) != 42) throw new AssertionError("callable contract failed"); adder.close(); }
    final int operationIterations = 10000;
    Payload operationPayload = new Payload(true, 41, "Lean λ", new byte[]{0, (byte)255}, new long[]{0, 0xffff_ffffL});
    long operationStarted = System.nanoTime();
    for (int index = 0; index < operationIterations; index++) Alpha.roundTrip(operationPayload);
    long copiedValueNanoseconds = System.nanoTime() - operationStarted;
    operationStarted = System.nanoTime();
    for (int index = 0; index < operationIterations; index++) Alpha.withCallback(40, value -> value + 2);
    long callbackNanoseconds = System.nanoTime() - operationStarted;
    long callableNanoseconds;
    try (OwnedTransform operationAdder = Alpha.makeAdder(2)) {
      operationStarted = System.nanoTime();
      for (int index = 0; index < operationIterations; index++) operationAdder.apply(40);
      callableNanoseconds = System.nanoTime() - operationStarted;
    }
    for (int index = 0; index < ${STEADY_STATE_WARMUP_ITERATIONS}; index += 1) box.read();
    long checksum = 0; long started = System.nanoTime();
    for (int index = 0; index < ${STEADY_STATE_MEASURED_ITERATIONS}; index += 1) checksum += box.read();
    long duration = System.nanoTime() - started; box.close(); box.close();
    try { box.read(); throw new AssertionError("stale Box use was accepted"); } catch (DisposedResourceException expected) { }
    if (Runtime.snapshot().liveIdentities() != 0) throw new AssertionError("native cleanup snapshot failed");
    verifyClassLoaders(System.getProperty("lean.bridge.test.jar"));
    if (Runtime.snapshot().runtimeInitRuns() != 1 || Runtime.snapshot().componentInitRuns() != 2 || Runtime.snapshot().liveIdentities() != 0) throw new AssertionError("class-loader runtime contract failed");
    System.out.printf("{\\\"iterations\\\":${STEADY_STATE_MEASURED_ITERATIONS},\\\"durationNanoseconds\\\":%d,\\\"checksum\\\":%d,\\\"initializationNanoseconds\\\":%d,\\\"operationIterations\\\":%d,\\\"copiedValueNanoseconds\\\":%d,\\\"callbackNanoseconds\\\":%d,\\\"callableNanoseconds\\\":%d,\\\"peakRssBytes\\\":%d}%n", duration, checksum, initializationNanoseconds, operationIterations, copiedValueNanoseconds, callbackNanoseconds, callableNanoseconds, peakRssBytes());
  }
} }\n`);
await mkdir(join(jvmRoot, "classes"), { recursive: true });
await run(javac, ["--release", "22", "-g:none", "-encoding", "UTF-8", "-cp", jar, "-d", join(jvmRoot, "classes"), join(jvmRoot, "Consumer.java")]);
const jvmMeasurement = parseMeasurement((await run(java, ["--enable-native-access=ALL-UNNAMED", `-Dlean.bridge.test.jar=${jar}`, "-cp", `${join(jvmRoot, "classes")}:${jar}`, "org.leanbridge.alpha.Consumer"])).stdout);

const kotlinRoot = join(scratch, "kotlin");
await write(join(kotlinRoot, "Consumer.kt"), `import org.leanbridge.alpha.Alpha
import org.leanbridge.alpha.Box

fun main() {
    Box(42).use { require(it.read() == 42L) }
    require(Alpha.withCallback(40) { value -> value + 2 } == 44L)
    Alpha.makeAdder(2).use { require(it.apply(40) == 42L) }
}
`);
await mkdir(join(kotlinRoot, "classes"), { recursive: true });
await run(kotlinc, ["-classpath", jar, "-d", join(kotlinRoot, "classes"), join(kotlinRoot, "Consumer.kt")]);
await run(kotlin, ["-J--enable-native-access=ALL-UNNAMED", "-classpath", `${join(kotlinRoot, "classes")}:${jar}`, "ConsumerKt"]);

const gemHome = join(scratch, "gem-home");
await run(gem, ["install", rubyGem, "--local", "--install-dir", gemHome, "--no-document"]);
const rubyRoot = join(scratch, "ruby");
await write(join(rubyRoot, "consumer.rb"), `require "lean_bridge/alpha"
include LeanBridge
initialization_started = Process.clock_gettime(Process::CLOCK_MONOTONIC, :nanosecond)
box = Alpha::Box.new(${STEADY_STATE_BOX_VALUE})
box.read
initialization_nanoseconds = Process.clock_gettime(Process::CLOCK_MONOTONIC, :nanosecond) - initialization_started
raise "Box contract failed" unless box.read == ${STEADY_STATE_BOX_VALUE} && box.identity.equal?(box)
raise "Beta composition contract failed" unless Alpha::Native.composition_read(box.instance_variable_get(:@state)) == ${STEADY_STATE_BOX_VALUE}
shared = Alpha::Native.snapshot
raise "shared runtime snapshot failed" unless shared.values_at(:runtime_init_runs, :component_init_runs, :attached_components, :live_identities) == [1, 2, 2, 1]
payload = Alpha.round_trip(Alpha::Payload.new(enabled: true, count: 41, label: "Lean λ", bytes: "\\x00\\xff".b, values: [0, 2**32 - 1]))
raise "Payload contract failed" unless !payload.enabled && payload.count == 42 && payload.bytes.bytes == [0, 255]
callback_thread = Thread.current
raise "callback contract failed" unless Alpha.with_callback(40) { |value| raise "callback changed threads" unless Thread.current.equal?(callback_thread); value + 2 } == 44
GC.compact if GC.respond_to?(:compact)
raise "GC compaction contract failed" unless box.read == ${STEADY_STATE_BOX_VALUE}
begin; Alpha.with_callback(40) { raise "callback marker" }; raise "callback failure was accepted"; rescue RuntimeError => error; raise unless error.message == "callback marker"; end
adder = Alpha.make_adder(2); raise "callable contract failed" unless adder.call(40) == 42
operation_iterations = 10_000
operation_payload = Alpha::Payload.new(enabled: true, count: 41, label: "Lean λ", bytes: "\\x00\\xff".b, values: [0, 2**32 - 1])
operation_started = Process.clock_gettime(Process::CLOCK_MONOTONIC, :nanosecond)
operation_iterations.times { Alpha.round_trip(operation_payload) }
copied_value_nanoseconds = Process.clock_gettime(Process::CLOCK_MONOTONIC, :nanosecond) - operation_started
operation_started = Process.clock_gettime(Process::CLOCK_MONOTONIC, :nanosecond)
operation_iterations.times { Alpha.with_callback(40) { |value| value + 2 } }
callback_nanoseconds = Process.clock_gettime(Process::CLOCK_MONOTONIC, :nanosecond) - operation_started
operation_started = Process.clock_gettime(Process::CLOCK_MONOTONIC, :nanosecond)
operation_iterations.times { adder.call(40) }
callable_nanoseconds = Process.clock_gettime(Process::CLOCK_MONOTONIC, :nanosecond) - operation_started
${STEADY_STATE_WARMUP_ITERATIONS}.times { box.read }
checksum = 0; started = Process.clock_gettime(Process::CLOCK_MONOTONIC, :nanosecond)
${STEADY_STATE_MEASURED_ITERATIONS}.times { checksum += box.read }
duration = Process.clock_gettime(Process::CLOCK_MONOTONIC, :nanosecond) - started
adder.close; adder.close; box.close; box.close
begin; box.read; raise "stale Box use was accepted"; rescue Alpha::DisposedResourceError; end
raise "native cleanup snapshot failed" unless Alpha::Native.snapshot[:live_identities] == 0
peak_rss_bytes = File.readlines("/proc/self/status").grep(/^VmHWM:/).first[/\\d+/].to_i * 1024
require "json"; puts JSON.generate(iterations: ${STEADY_STATE_MEASURED_ITERATIONS}, durationNanoseconds: duration, checksum: checksum, initializationNanoseconds: initialization_nanoseconds, operationIterations: operation_iterations, copiedValueNanoseconds: copied_value_nanoseconds, callbackNanoseconds: callback_nanoseconds, callableNanoseconds: callable_nanoseconds, peakRssBytes: peak_rss_bytes)
`);
const rubyMeasurement = parseMeasurement((await run(ruby, [join(rubyRoot, "consumer.rb")], { env: { ...process.env, GEM_HOME: gemHome, GEM_PATH: gemHome } })).stdout);

const measurements = { dotnet: dotnetMeasurement, jvm: jvmMeasurement, ruby: rubyMeasurement };
for(const [consumer, measurement] of Object.entries(measurements))
{
	await writeConsumerPerformance({ consumer, operation: STEADY_STATE_OPERATION, timingMode: "steady-state", scope: `steady-state clean ${consumer} registry consumer`, iterations: measurement.iterations, durationNanoseconds: measurement.durationNanoseconds });
}
const receipts = {
	dotnet: JSON.parse(await readFile(join(nugetRoot, "package/lean-bridge/package-receipt.json"), "utf8"))
	, jvm: JSON.parse(await readFile(join(mavenRoot, "jar/META-INF/lean-bridge/package-receipt.json"), "utf8"))
	, ruby: JSON.parse(await readFile(join(gemHome, "gems/lean_bridge_alpha-0.0.0/lean-bridge/package-receipt.json"), "utf8"))
};
const packageBytes = {
	dotnet: (await stat(join(nugetRoot, "LeanBridge.Alpha.0.0.0.nupkg"))).size
	, jvm: (await stat(join(mavenRoot, "repository/org/leanbridge/lean-alpha/0.0.0/lean-alpha-0.0.0.jar"))).size
	, ruby: (await stat(rubyGem)).size
};
process.stdout.write(`${JSON.stringify({ result: "passed", packageInstallation: true, realLeanExecution: true, consumers: Object.keys(measurements), measurements, packageBytes, receipts }, null, 2)}\n`);
