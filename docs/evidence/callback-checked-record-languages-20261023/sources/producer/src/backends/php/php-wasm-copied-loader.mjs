/**
 * Shared PHP-side first-call loading for the pinned Asyncify-enabled host.
 * Embedded in each compiled adapter; one class owns failures per PHP instance.
 *
 * @file
 */
export const copiedPhpWasmLoader = `namespace LeanBridge\\CopiedPhpWasmV1 {
if (!class_exists(Loader::class, false)) {
    final class Loader {
        private static ?string $failure = null;
        private static bool $loading = false;
        private static int $callbacks = 0;
        public static function enterCallback(): void { ++self::$callbacks; }
        public static function leaveCallback(): void { --self::$callbacks; }
        public static function load(string $library, string $function): void {
            if (self::$failure !== null) throw new \\RuntimeException(self::$failure);
            if (self::$loading) throw new \\RuntimeException('Reentrant PHP-Wasm extension loading is not supported');
            // dl may suspend the host to fetch or instantiate a side module.
            // The synchronous Lean stack cannot participate in that unwind.
            if (self::$callbacks !== 0) throw new \\RuntimeException('Cannot load a PHP-Wasm extension inside a synchronous Lean callback. Use its startup descriptor or call that package before entering the callback.');
            $registration = '/__lean_bridge/php_wasm_lazy/' . $library . '.txt';
            if (!is_file($registration) || file_get_contents($registration) !== $library) {
                throw new \\RuntimeException('Register this package lazy descriptor in dynamicLibs before PHP starts');
            }
            if (!function_exists('dl') || !ini_get('enable_dl')) {
                throw new \\RuntimeException('PHP-Wasm lazy loading requires enable_dl=1');
            }
            self::$loading = true;
            try {
                set_error_handler(static function (int $severity, string $message): never {
                    throw new \\RuntimeException($message);
                });
                try {
                    if (!dl($library) || !function_exists($function)) {
                        throw new \\RuntimeException('The generated Zend transport did not load');
                    }
                } finally { restore_error_handler(); }
            } catch (\\Throwable $error) {
                // Emscripten may retain a partially linked DSO after failure.
                // Do not attempt another lazy load in that PHP instance.
                self::$failure = 'PHP-Wasm extension loading failed; create a new PHP instance. ' . $error->getMessage();
                throw new \\RuntimeException(self::$failure, 0, $error);
            } finally { self::$loading = false; }
        }
    }
}
}
`;
