/**
 * Private owned-library loading layered on the unchanged shared PHP loader.
 *
 * @file
 */

/** Keep GMP and its adapter local while all PHP packages share the Lean core. */
export const ownedPhpLoader = String.raw`<?php
declare(strict_types=1);
namespace LeanBridge\OwnedNativeV1;

if (!class_exists(Runtime::class, false)) {
    final class Runtime
    {
        private static bool $failed = false;
        private static array $libraries = [];
        private static array $components = [];
        private static array $handles = [];
        private static ?\FFI $dl = null;

        public static function load(string $root, array $evidence, string $definitions): \FFI {
            \LeanBridge\CopiedNativeV1\Runtime::ensureProcess();
            if (self::$failed) throw new \RuntimeException('Owned native loading failed earlier in this process');
            $gmp = 'libgmp-lean-bridge.so.10';
            $required = [$evidence['library'], $evidence['componentLibrary'], $gmp,
                'libleanshared.so', 'liblean_bridge_native.so'];
            if (count(array_unique($required)) !== 5 || count($evidence['libraries']) !== 5)
                throw new \RuntimeException('Invalid owned native library inventory');
            foreach ($required as $name) {
                if (!is_string($name) || !preg_match('/\Alib[A-Za-z0-9_.-]+\.so(?:\.\d+)*\z/', $name)
                    || !isset($evidence['libraries'][$name]) || !is_string($evidence['libraries'][$name])
                    || !preg_match('/\A[a-f0-9]{64}\z/', $evidence['libraries'][$name]))
                    throw new \RuntimeException('Invalid owned native library inventory');
                if (isset(self::$libraries[$name]) && self::$libraries[$name]['hash'] !== $evidence['libraries'][$name])
                    throw new \RuntimeException('Conflicting builds of the same owned library: ' . $name);
            }
            // The existing loader authenticates every file, owns process/runtime
            // compatibility and pins only the shared core and Lean component.
            $shared = $evidence;
            $shared['library'] = $evidence['componentLibrary'];
            $shared['loadOrder'] = ['libleanshared.so', 'liblean_bridge_native.so', $evidence['componentLibrary']];
            \LeanBridge\CopiedNativeV1\Runtime::load($root, $shared, '');
            $id = $evidence['componentId'];
            if (isset(self::$components[$id])) {
                if (self::$components[$id]['identity'] !== $evidence['identity'])
                    throw new \RuntimeException('Conflicting builds of the same owned component');
                return self::$components[$id]['ffi'];
            }
            try {
                self::$dl ??= \FFI::cdef('void *dlopen(const char *, int);', 'libdl.so.2');
                foreach ([$gmp, $evidence['library']] as $name) {
                    if (isset(self::$libraries[$name])) continue;
                    $path = $root . '/' . $name;
                    // NOW | DEEPBIND | NODELETE, without GLOBAL. The adapter's
                    // dependency order places its private GMP before Lean.
                    $handle = self::$dl->dlopen($path, 2 | 8 | 4096);
                    if ($handle === null || \FFI::isNull($handle)) throw new \RuntimeException('Cannot load owned library: ' . $name);
                    self::$handles[] = $handle;
                    self::$libraries[$name] = ['hash' => $evidence['libraries'][$name], 'path' => $path];
                }
                $ffi = \FFI::cdef($definitions, self::$libraries[$evidence['library']]['path']);
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
