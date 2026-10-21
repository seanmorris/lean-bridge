/**
 * Run dependent checked-record PHP-Wasm controls in their own bounded Core
 * partition. Installed acceptance remains separately gated.
 *
 * @file
 */
import "./helpers/dependent-checked-record-php-wasm-fixture-tests.mjs";
import "./helpers/dependent-checked-record-php-wasm-lean-tests.mjs";
import "./helpers/dependent-checked-record-php-wasm-installed-tests.mjs";
import "./helpers/dependent-checked-record-php-wasm-ci-report-tests.mjs";
import "./helpers/dependent-checked-record-php-wasm-ci-shell-tests.mjs";
import "./helpers/dependent-checked-record-php-wasm-ci-workflow-tests.mjs";
