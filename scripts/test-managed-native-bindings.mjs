#!/usr/bin/env node

import { execFile } from "node:child_process";
import { copyFile, mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";

import {
  STEADY_STATE_BOX_VALUE,
  STEADY_STATE_MEASURED_ITERATIONS,
  STEADY_STATE_OPERATION,
  STEADY_STATE_WARMUP_ITERATIONS,
  writeConsumerPerformance,
} from "../src/adoption/consumer-performance.mjs";
import { generateDotnetBindingPackage } from "../src/backends/dotnet/generate.mjs";
import { generateJvmBindingPackage } from "../src/backends/jvm/generate.mjs";
import { generateRubyBindingPackage } from "../src/backends/ruby/generate.mjs";
import { parseBindingIr } from "../src/binding-ir/canonical.mjs";
import { readFile } from "node:fs/promises";

const execute = promisify(execFile);
const options = new Map();
for (let index = 2; index < process.argv.length; index += 2) options.set(process.argv[index], process.argv[index + 1]);
const nativeOption = options.get("--native-root");
if (!nativeOption) throw new Error("Usage: test-managed-native-bindings.mjs --native-root PATH [--dotnet PATH] [--javac PATH] [--java PATH] [--ruby PATH]");
const nativeRoot = resolve(nativeOption);
const dotnet = options.get("--dotnet") ?? process.env.LEAN_BRIDGE_DOTNET ?? "dotnet";
const javac = options.get("--javac") ?? process.env.LEAN_BRIDGE_JAVAC ?? "javac";
const java = options.get("--java") ?? process.env.LEAN_BRIDGE_JAVA ?? "java";
const ruby = options.get("--ruby") ?? process.env.LEAN_BRIDGE_RUBY ?? "ruby";
const scratch = await mkdtemp(join(tmpdir(), "lean-bridge-managed-native-"));
const ir = parseBindingIr(await readFile("poc/lean-link-spike/bindings/alpha.binding-ir.json", "utf8"));

const run = async (command, args, settings = {}) => {
  try {
    return await execute(command, args, { maxBuffer: 32 * 1024 * 1024, ...settings });
  } catch (error) {
    throw new Error(`${command} failed\n${error.stdout ?? ""}${error.stderr ?? ""}`, { cause: error });
  }
};

const writePackage = async (root, files) => {
  for (const [path, source] of Object.entries(files)) {
    const destination = join(root, path);
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, source);
  }
};

const parseMeasurement = stdout => {
  const value = JSON.parse(stdout.trim().split("\n").at(-1));
  if (
    !Number.isSafeInteger(value.iterations) || value.iterations !== STEADY_STATE_MEASURED_ITERATIONS ||
    !Number.isFinite(value.durationNanoseconds) || value.durationNanoseconds <= 0 ||
    value.checksum !== STEADY_STATE_BOX_VALUE * value.iterations
  ) throw new Error(`invalid managed performance result: ${stdout}`);
  return value;
};

const dotnetRoot = join(scratch, "dotnet");
await writePackage(dotnetRoot, generateDotnetBindingPackage(ir));
await writeFile(join(dotnetRoot, "Consumer.csproj"), `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>Exe</OutputType><TargetFramework>net8.0</TargetFramework><ImplicitUsings>enable</ImplicitUsings><Nullable>enable</Nullable><EnableDefaultCompileItems>false</EnableDefaultCompileItems>
  </PropertyGroup>
  <ItemGroup><Compile Include="Program.cs"/><ProjectReference Include="src/LeanBridge.Alpha/LeanBridge.Alpha.csproj"/></ItemGroup>
</Project>
`);
await writeFile(join(dotnetRoot, "Program.cs"), `using System.Diagnostics;
using LeanBridge.Alpha;
using var box = new Box(${STEADY_STATE_BOX_VALUE});
if (box.Read() != ${STEADY_STATE_BOX_VALUE} || !ReferenceEquals(box.Identity(), box)) throw new Exception("Box contract failed");
var payload = Alpha.RoundTrip(new Payload(true, 41, "Lean λ", new byte[] { 0, 255 }, new uint[] { 0, uint.MaxValue }));
if (payload.Enabled || payload.Count != 42 || !payload.Bytes.Span.SequenceEqual(new byte[] { 0, 255 })) throw new Exception("Payload contract failed");
if (Alpha.WithCallback(40, value => value + 2) != 44) throw new Exception("callback contract failed");
using var adder = Alpha.MakeAdder(2); if (adder.Invoke(40) != 42) throw new Exception("callable contract failed");
for (var index = 0; index < ${STEADY_STATE_WARMUP_ITERATIONS}; index += 1) _ = box.Read();
ulong checksum = 0; var started = Stopwatch.GetTimestamp();
for (var index = 0; index < ${STEADY_STATE_MEASURED_ITERATIONS}; index += 1) checksum += box.Read();
var duration = (Stopwatch.GetTimestamp() - started) * 1_000_000_000.0 / Stopwatch.Frequency;
adder.Dispose(); adder.Dispose(); box.Dispose(); box.Dispose();
Console.WriteLine(System.Text.Json.JsonSerializer.Serialize(new { iterations = ${STEADY_STATE_MEASURED_ITERATIONS}, durationNanoseconds = (long)duration, checksum }));
`);
const dotnetHome = join(scratch, "dotnet-home");
await run(dotnet, ["build", join(dotnetRoot, "Consumer.csproj"), "--configuration", "Release", "--nologo", "--ignore-failed-sources", "--disable-build-servers"], {
  env: { ...process.env, DOTNET_CLI_HOME: dotnetHome, DOTNET_CLI_TELEMETRY_OPTOUT: "1", DOTNET_NOLOGO: "1", NUGET_PACKAGES: join(scratch, "nuget-packages") },
});
const dotnetOutput = join(dotnetRoot, "bin/Release/net8.0");
for (const name of ["liblean_bridge_native.so", "liblean_alpha_component.so"]) await copyFile(join(nativeRoot, name), join(dotnetOutput, name));
const dotnetMeasurement = parseMeasurement((await run(dotnet, [join(dotnetOutput, "Consumer.dll")], {
  env: { ...process.env, DOTNET_CLI_HOME: dotnetHome, DOTNET_CLI_TELEMETRY_OPTOUT: "1", DOTNET_NOLOGO: "1" },
})).stdout);

const jvmRoot = join(scratch, "jvm");
const jvmFiles = generateJvmBindingPackage(ir);
await writePackage(jvmRoot, jvmFiles);
await writeFile(join(jvmRoot, "Consumer.java"), `import java.util.Arrays;
import org.leanbridge.alpha.*;
public final class Consumer {
  public static void main(String[] args) {
    try (Box box = new Box(${STEADY_STATE_BOX_VALUE})) {
      if (box.read() != ${STEADY_STATE_BOX_VALUE} || box.identity() != box) throw new AssertionError("Box contract failed");
      Payload payload = Alpha.roundTrip(new Payload(true, 41, "Lean λ", new byte[]{0, (byte)255}, new long[]{0, 0xffff_ffffL}));
      if (payload.enabled() || payload.count() != 42 || !Arrays.equals(payload.bytes(), new byte[]{0, (byte)255})) throw new AssertionError("Payload contract failed");
      if (Alpha.withCallback(40, value -> value + 2) != 44) throw new AssertionError("callback contract failed");
      try (OwnedTransform adder = Alpha.makeAdder(2)) { if (adder.apply(40) != 42) throw new AssertionError("callable contract failed"); adder.close(); }
      for (int index = 0; index < ${STEADY_STATE_WARMUP_ITERATIONS}; index += 1) box.read();
      long checksum = 0; long started = System.nanoTime();
      for (int index = 0; index < ${STEADY_STATE_MEASURED_ITERATIONS}; index += 1) checksum += box.read();
      long duration = System.nanoTime() - started; box.close();
      System.out.printf("{\\\"iterations\\\":${STEADY_STATE_MEASURED_ITERATIONS},\\\"durationNanoseconds\\\":%d,\\\"checksum\\\":%d}%n", duration, checksum);
    }
  }
}
`);
const javaSources = Object.keys(jvmFiles).filter(path => path.endsWith(".java")).sort().map(path => join(jvmRoot, path));
const classes = join(jvmRoot, "classes");
await mkdir(classes);
await run(javac, ["--release", "22", "-g:none", "-encoding", "UTF-8", "-d", classes, ...javaSources, join(jvmRoot, "Consumer.java")]);
const jvmMeasurement = parseMeasurement((await run(java, ["--enable-native-access=ALL-UNNAMED", "-cp", classes, "Consumer"], {
  env: { ...process.env, LEAN_BRIDGE_NATIVE_ROOT: nativeRoot },
})).stdout);

const rubyRoot = join(scratch, "ruby");
await writePackage(rubyRoot, generateRubyBindingPackage(ir));
await writeFile(join(rubyRoot, "consumer.rb"), `require "lean_bridge/alpha"
include LeanBridge
box = Alpha::Box.new(${STEADY_STATE_BOX_VALUE})
raise "Box contract failed" unless box.read == ${STEADY_STATE_BOX_VALUE} && box.identity.equal?(box)
payload = Alpha.round_trip(Alpha::Payload.new(enabled: true, count: 41, label: "Lean λ", bytes: "\\x00\\xff".b, values: [0, 2**32 - 1]))
raise "Payload contract failed" unless !payload.enabled && payload.count == 42 && payload.bytes.bytes == [0, 255]
raise "callback contract failed" unless Alpha.with_callback(40) { |value| value + 2 } == 44
adder = Alpha.make_adder(2); raise "callable contract failed" unless adder.call(40) == 42
${STEADY_STATE_WARMUP_ITERATIONS}.times { box.read }
checksum = 0; started = Process.clock_gettime(Process::CLOCK_MONOTONIC, :nanosecond)
${STEADY_STATE_MEASURED_ITERATIONS}.times { checksum += box.read }
duration = Process.clock_gettime(Process::CLOCK_MONOTONIC, :nanosecond) - started
adder.close; adder.close; box.close; box.close
require "json"; puts JSON.generate(iterations: ${STEADY_STATE_MEASURED_ITERATIONS}, durationNanoseconds: duration, checksum: checksum)
`);
const rubyMeasurement = parseMeasurement((await run(ruby, ["-I", join(rubyRoot, "lib"), join(rubyRoot, "consumer.rb")], {
  env: { ...process.env, LEAN_BRIDGE_NATIVE_ROOT: nativeRoot },
})).stdout);

const measurements = { dotnet: dotnetMeasurement, jvm: jvmMeasurement, ruby: rubyMeasurement };
for (const [consumer, measurement] of Object.entries(measurements)) {
  await writeConsumerPerformance({
    consumer,
    operation: STEADY_STATE_OPERATION,
    timingMode: "steady-state",
    scope: `steady-state installed-style generated ${consumer} API call`,
    iterations: measurement.iterations,
    durationNanoseconds: measurement.durationNanoseconds,
  });
}
process.stdout.write(`${JSON.stringify({ result: "passed", realLeanExecution: true, consumers: Object.keys(measurements), measurements }, null, 2)}\n`);
