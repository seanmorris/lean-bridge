/**
 * Interpreter-wide verified loading for installed ordinary PHP CLI packages.
 *
 * @file
 */
import { canonicalJson, sha256 } from "../../capsule/node.mjs";

/** One process-local loader shared without a jointly owned Composer file. */
export const copiedPhpLoader = String.raw`<?php
declare(strict_types=1);
namespace LeanBridge\CopiedNativeV1;

if (!class_exists(Runtime::class, false)) {
    final class Runtime
    {
        private static ?int $pid = null;
        private static ?string $identity = null;
        private static bool $failed = false;
        private static array $libraries = [];
        private static array $components = [];
        private static array $handles = [];
        private static ?\FFI $dl = null;

        public static function ensureProcess(): void {
            if (self::$pid !== null && self::$pid !== getmypid()) {
                throw new \RuntimeException('Start a fresh PHP process after fork to use Lean packages');
            }
        }

        public static function load(string $root, array $evidence, string $definitions): \FFI {
            if (PHP_VERSION_ID < 80200 || PHP_VERSION_ID >= 90000 || PHP_ZTS || PHP_SAPI !== 'cli'
                || PHP_OS_FAMILY !== 'Linux' || php_uname('m') !== 'x86_64' || PHP_INT_SIZE !== 8
                || pack('L', 1) !== "\x01\0\0\0" || !extension_loaded('FFI')) {
                throw new \RuntimeException('This package requires PHP 8.2+ NTS CLI on Linux x86-64 with FFI enabled');
            }
            self::ensureProcess();
            if (self::$failed) throw new \RuntimeException('Lean native loading failed earlier in this process');
            if (self::$identity !== null && self::$identity !== $evidence['runtimeIdentity']) {
                throw new \RuntimeException('Incompatible Lean runtime identities');
            }
            foreach ($evidence['libraries'] as $name => $hash) {
                $path = $root . '/' . $name;
                if (is_link($path) || !is_file($path) || hash_file('sha256', $path) !== $hash) {
                    throw new \RuntimeException('Native library differs from compiled evidence: ' . $name);
                }
                if (isset(self::$libraries[$name]) && self::$libraries[$name]['hash'] !== $hash) {
                    throw new \RuntimeException('Conflicting builds of the same native library: ' . $name);
                }
            }
            $id = $evidence['componentId'];
            if (isset(self::$components[$id])) {
                if (self::$components[$id]['identity'] !== $evidence['identity']) {
                    throw new \RuntimeException('Conflicting builds of the same Lean component');
                }
                return self::$components[$id]['ffi'];
            }
            try {
                self::$dl ??= \FFI::cdef('void *dlopen(const char *, int); void *dlsym(void *, const char *);', 'libdl.so.2');
                if (self::$identity === null) {
                    $maps = file_get_contents('/proc/self/maps');
                    if ($maps === false) throw new \RuntimeException('Lean loading requires readable /proc/self/maps');
                    if (self::$dl->dlsym(null, 'lean_initialize_runtime_module') !== null
                        || preg_match('~/liblean(?:shared|_bridge_native)\.so(?: \(deleted\))?$~m', $maps)) {
                        throw new \RuntimeException('A foreign Lean runtime is already loaded in this process');
                    }
                }
                foreach ($evidence['loadOrder'] as $name) {
                    if (isset(self::$libraries[$name])) continue;
                    $path = $root . '/' . $name;
                    // Hold global, non-unloadable mappings for the process lifetime.
                    $handle = self::$dl->dlopen($path, 2 | 256 | 4096);
                    if ($handle === null || \FFI::isNull($handle)) throw new \RuntimeException('Cannot load native library: ' . $name);
                    self::$handles[] = $handle;
                    self::$libraries[$name] = ['hash' => $evidence['libraries'][$name], 'path' => $path];
                }
                $ffi = \FFI::cdef($definitions, self::$libraries[$evidence['library']]['path']);
                self::$identity = $evidence['runtimeIdentity'];
                self::$pid = getmypid();
                self::$components[$id] = ['identity' => $evidence['identity'], 'ffi' => $ffi];
                return $ffi;
            } catch (\Throwable $error) {
                self::$failed = true;
                throw $error;
            }
        }
    }
}
`;

/**
 * Bind a component's lazy loader to its verified native inventories.
 *
 * @param evidence - Closed compiled inputs, or null for uncompiled generation.
 */
export const copiedPhpAssets = evidence => !evidence ? "throw new \\RuntimeException('Build a compiled native PHP release before calling this API');" : `return \\LeanBridge\\CopiedNativeV1\\Runtime::load(__DIR__ . '/../../native/linux-x64', json_decode(<<<'EVIDENCE'\n${canonicalJson({ ...evidence, identity: sha256(canonicalJson(evidence)), loadOrder: ["libleanshared.so", "liblean_bridge_native.so", ...Object.keys(evidence.libraries).filter(name => ![evidence.library, "libleanshared.so", "liblean_bridge_native.so"].includes(name)), evidence.library] }).trim()}\nEVIDENCE, true, 512, JSON_THROW_ON_ERROR), self::DEFINITIONS);`;
