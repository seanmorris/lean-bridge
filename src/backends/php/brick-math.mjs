/**
 * Exact, offline-reproducible Brick Math dependency for generated PHP packages.
 *
 * @file
 */
import { sha256 } from "../../capsule/node.mjs";
import source from "./brick-math.source.json" with { type: "json" };

export const brickMathRequirement = Object.freeze({ "brick/math": "1.0.0" });

/** Read the pinned upstream package without fetching dependencies during builds. */
export const brickMathSources = () => {
	if(source.name !== "brick/math" || source.version !== "1.0.0"
		|| source.commit !== "2effe05d2177c451b86c6a073196a4034c02f211" || source.license !== "MIT")
		throw new Error("Unexpected Brick Math source identity");
	return Object.fromEntries(Object.entries(source.files).map(([path, entry]) => {
		if(!/^(?:LICENSE|composer\.json|src\/[A-Za-z0-9_/]+\.php)$/.test(path) || sha256(entry.source) !== entry.sha256)
			throw new Error(`Brick Math source identity differs: ${path}`);
		return [path, entry.source];
	}));
};

/** Bundle the pinned dependency for PHP-Wasm hosts that do not use Composer. */
export const bundledBrickMath = () => ({
	...Object.fromEntries(Object.entries(brickMathSources()).map(([path, text]) => [`dependencies/brick-math/${path}`, text]))
	, "dependencies/brick-math/autoload.php": String.raw`<?php
declare(strict_types=1);

// Composer autoloaders take precedence when an application supplies Brick Math.
spl_autoload_register(static function (string $class): void {
    $prefix = 'Brick\\Math\\';
    if (!str_starts_with($class, $prefix)) return;
    $suffix = substr($class, strlen($prefix));
    if (preg_match('/^[A-Za-z_][A-Za-z0-9_]*(?:\\\\[A-Za-z_][A-Za-z0-9_]*)*$/D', $suffix) !== 1) return;
    $path = __DIR__ . '/src/' . str_replace('\\', '/', $suffix) . '.php';
    if (is_file($path)) require $path;
});
`
});
