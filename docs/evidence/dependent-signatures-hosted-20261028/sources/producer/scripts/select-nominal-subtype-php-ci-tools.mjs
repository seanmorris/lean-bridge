/**
 * Record explicit native PHP tool identities before selecting installed CI cases.
 *
 * @file
 */
import assert from "node:assert/strict";
import { canonicalJson } from "../src/capsule/node.mjs";
import { selectNominalSubtypePhpCiTools } from "../tests/helpers/nominal-subtype-php-ci-tools.mjs";

const [php, composer, directory] = process.argv.slice(2);
assert.equal(process.argv.length, 5, "Usage: select-nominal-subtype-php-ci-tools.mjs /absolute/php /absolute/composer <existing-record-directory>");
process.stdout.write(canonicalJson(await selectNominalSubtypePhpCiTools({ php, composer }, directory)));
