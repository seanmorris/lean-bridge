/**
 * Execute an installed ordinary Lean API in PHP-Wasm.
 *
 * @file
 */
import assert from 'node:assert/strict';
import { PhpNode } from 'php-wasm/PhpNode.mjs';
import api from '@example/willow-php-wasm';

const php = new PhpNode({ version: '8.4', sharedLibs: [api] });
php.addEventListener('output', event => {
  for(const part of event.detail) process.stdout.write(part);
});
php.addEventListener('error', event => {
  for(const part of event.detail) process.stderr.write(part);
});
const status = await php.run(String.raw`<?php
require_once '${api.autoload}';
use Brick\Math\BigInteger;
echo LeanWillow\echo_u32(BigInteger::of('4294967295'));
`);
assert.equal(status, 0);
