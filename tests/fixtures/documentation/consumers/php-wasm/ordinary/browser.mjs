/**
 * Execute an installed ordinary Lean API in browser-hosted PHP.
 *
 * @file
 */
import { PhpWeb } from '/php-host/PhpWeb.mjs';
import api from '@example/willow-php-wasm';

const output = globalThis.document.querySelector('#result');
try
{
	const php = new PhpWeb({ version: '8.4', autoTransaction: false, sharedLibs: [api] });
	let stderr = '';
	php.addEventListener('output', event => {
		for(const part of event.detail) output.textContent += part;
	});
	php.addEventListener('error', event => {
		for(const part of event.detail) stderr += part;
	});
	const status = await php.run(String.raw`<?php
require_once '${api.autoload}';
use LeanWillow\BigInteger;
echo LeanWillow\echo_u32(BigInteger::fromDecimal('4294967295'));
`);
	if(status !== 0 || stderr) throw new Error(stderr || `PHP exited with status ${status}`);
	output.dataset.state = 'ready';
} catch(error)
{
	output.textContent = error.message;
	output.dataset.state = 'error';
	throw error;
}
