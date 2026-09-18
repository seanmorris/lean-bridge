/**
 * Execute an installed ordinary Lean API in browser-hosted PHP.
 *
 * @file
 */
import { PhpWeb } from '/php-host/PhpWeb.mjs';
import { lazy as api } from '@example/willow-php-wasm';

const output = globalThis.document.querySelector('#result');
try
{
	const php = new PhpWeb({ version: '8.4', autoTransaction: false, dynamicLibs: [api] });
	let stderr = '';
	php.addEventListener('output', event => {
		for(const part of event.detail) output.textContent += part;
	});
	php.addEventListener('error', event => {
		for(const part of event.detail) stderr += part;
	});
	const status = await php.run(String.raw`<?php
require_once '${api.autoload}';
use Brick\Math\BigInteger;
echo LeanWillow\echo_u32(BigInteger::of('4294967295'));
`);
	if(status !== 0 || stderr) throw new Error(stderr || `PHP exited with status ${status}`);
	output.dataset.state = 'ready';
} catch(error)
{
	output.textContent = error.message;
	output.dataset.state = 'error';
	throw error;
}
