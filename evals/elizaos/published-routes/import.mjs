import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const plugin = await import('@elizaos/plugin-solana');
const core = await import('@elizaos/core');
const interfaces = await import('@elizaos/service-interfaces');
assert.equal(typeof core.AgentRuntime, 'function');
assert.equal(typeof plugin.solanaPlugin.init, 'function');
assert.equal(typeof interfaces.IWalletService, 'function');
const versions = {};
for (const name of ['@elizaos/plugin-solana', '@elizaos/core', '@elizaos/service-interfaces', 'form-data', 'whatwg-url', 'zod']) {
  versions[name] = JSON.parse(readFileSync(require.resolve(`${name}/package.json`), 'utf8')).version;
}
console.log(JSON.stringify({ node: process.version, versions, pluginExports: Object.keys(plugin), imported: true }));
