import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { fileURLToPath } from 'node:url';
import net from 'node:net';
import http from 'node:http';
import https from 'node:https';

const counters = {
  signed: 0, sends: 0, secretKeyConstruction: 0, generatedKeys: 0,
  nativeNetwork: 0, latestBlockhash: 0, parsedTokenAccounts: 0,
  accountSubscriptions: 0, balanceReads: 0, quoteFetches: 0,
  swapFetches: 0, tradingQuotes: 0, tradingSwapRequests: 0,
  externalPrivateKeyReads: 0, modelCalls: 0,
};
const denyNetwork = () => { counters.nativeNetwork++; throw new Error('Native network forbidden in keyless fixture'); };
net.Socket.prototype.connect = denyNetwork;
http.request = denyNetwork;
http.get = denyNetwork;
https.request = denyNetwork;
https.get = denyNetwork;
syncBuiltinESMExports();

const { AgentRuntime, ModelType } = await import('@elizaos/core');
const { Connection, Keypair, PublicKey, SystemProgram, TransactionMessage, VersionedTransaction } = await import('@solana/web3.js');
const { solanaPlugin, SolanaService, SolanaWalletService } = await import('@elizaos/plugin-solana');
const principal = '11111111111111111111111111111111';
const recipient = 'So11111111111111111111111111111111111111112';
const mint = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const blockhash = principal;
const unsignedTransaction = new VersionedTransaction(new TransactionMessage({
  payerKey: new PublicKey(principal), recentBlockhash: blockhash,
  instructions: [SystemProgram.transfer({ fromPubkey: new PublicKey(principal), toPubkey: new PublicKey(recipient), lamports: 1 })],
}).compileToV0Message()).serialize();
const swapTransaction = Buffer.from(unsignedTransaction).toString('base64');
VersionedTransaction.prototype.sign = () => { counters.signed++; throw new Error('Signing forbidden in keyless fixture'); };
Keypair.fromSecretKey = () => { counters.secretKeyConstruction++; throw new Error('Secret-key construction forbidden in keyless fixture'); };
Keypair.generate = () => { counters.generatedKeys++; throw new Error('Key generation forbidden in keyless fixture'); };
Connection.prototype.getLatestBlockhash = async () => { counters.latestBlockhash++; return { blockhash, lastValidBlockHeight: 1000 }; };
Connection.prototype.getParsedTokenAccountsByOwner = async () => { counters.parsedTokenAccounts++; return { context: { slot: 1 }, value: [] }; };
Connection.prototype.getMultipleAccountsInfo = async (keys) => {
  counters.balanceReads++;
  return keys.map(() => ({ lamports: 100_000_000_000, owner: new PublicKey(principal), data: Buffer.alloc(0), executable: false, rentEpoch: 0 }));
};
Connection.prototype.onAccountChange = () => { counters.accountSubscriptions++; return 1; };
Connection.prototype.removeAccountChangeListener = async () => {};
Connection.prototype.sendTransaction = async () => { counters.sends++; throw new Error('Sending forbidden in keyless fixture'); };
Connection.prototype.sendRawTransaction = async () => { counters.sends++; throw new Error('Sending forbidden in keyless fixture'); };
Connection.prototype.confirmTransaction = async () => { counters.sends++; throw new Error('Confirmation forbidden in keyless fixture'); };
globalThis.fetch = async (url, options) => {
  const value = String(url);
  if (value.startsWith('https://quote-api.jup.ag/v6/quote?')) {
    counters.quoteFetches++;
    return new Response(JSON.stringify({ inputMint: recipient, outputMint: mint, inAmount: '1000000', outAmount: '1000', otherAmountThreshold: '900', routePlan: [] }), { status: 200 });
  }
  if (value === 'https://quote-api.jup.ag/v6/swap' && options?.method === 'POST') {
    counters.swapFetches++;
    const request = JSON.parse(options.body);
    assert.equal(request.userPublicKey, principal);
    return new Response(JSON.stringify({ swapTransaction }), { status: 200 });
  }
  counters.nativeNetwork++;
  throw new Error('Unexpected fetch forbidden in keyless fixture');
};

const aliases = ['SOLANA_PRIVATE_KEY', 'WALLET_PRIVATE_KEY', 'WALLET_SECRET_KEY', 'WALLET_SECRET_SALT', 'HELIUS_API_KEY', 'BIRDEYE_API_KEY'];
for (const alias of aliases) assert.equal(process.env[alias], undefined, `Environment alias must be absent: ${alias}`);
const cache = new Map([['solana/walletData', { totalUsd: '0', totalSol: '0', items: [] }]]);
const adapter = {
  getCache: async (key) => cache.get(key),
  setCache: async (key, value) => { cache.set(key, value); return true; },
  log: async () => {},
};
const runtime = new AgentRuntime({
  character: { name: 'Solanaut keyless published fixture', bio: 'Synthetic public-key-only fixture', settings: { SOLANA_PUBLIC_KEY: principal, SOLANA_RPC_URL: 'https://api.devnet.solana.com' } },
  settings: {}, adapter,
});
for (const alias of aliases) assert.equal(runtime.getSetting(alias), null);
let modelResult;
runtime.registerModel(ModelType.TEXT_LARGE, async () => { counters.modelCalls++; return JSON.stringify(modelResult); }, 'synthetic-fixture', 100);
await solanaPlugin.init({}, runtime);
assert.deepEqual(runtime.actions.map((action) => action.name), ['TRANSFER_SOLANA', 'SWAP_SOLANA']);
const service = new SolanaService(runtime);
runtime.services.set('chain_solana', [service]);
const wallet = new SolanaWalletService(runtime);
await new Promise((resolve) => setImmediate(resolve));
assert.equal(service.getPublicKey().toBase58(), principal);
assert.equal(service.keypair, null);
assert.deepEqual(Object.keys(service.exchangeRegistry), []);
const results = [];
const before = () => structuredClone(counters);
const delta = (start) => Object.fromEntries(Object.entries(counters).map(([key, value]) => [key, value - start[key]]));
const message = { entityId: '00000000-0000-0000-0000-000000000001', content: { text: 'synthetic transfer request' } };
const state = { values: {}, data: {}, text: '' };

for (const [name, tokenAddress] of [['SOL transfer action', null], ['SPL transfer action', mint]]) {
  const start = before();
  modelResult = { tokenAddress, recipient, amount: 1 };
  const callbacks = [];
  await runtime.actions.find((action) => action.name === 'TRANSFER_SOLANA').handler(runtime, message, state, {}, (value) => callbacks.push(value));
  assert.equal(callbacks.length, 1);
  assert.equal(callbacks[0].content.error, 'Private key not found in settings');
  assert.equal(delta(start).modelCalls, 1);
  results.push({ name, outcome: callbacks[0].content.error, counters: delta(start) });
}
{
  const start = before();
  modelResult = { inputTokenSymbol: 'SOL', outputTokenSymbol: 'USDC', inputTokenCA: recipient, outputTokenCA: mint, amount: 0.001 };
  const callbacks = [];
  await runtime.actions.find((action) => action.name === 'SWAP_SOLANA').handler(runtime, message, state, {}, (value) => callbacks.push(value));
  assert.equal(callbacks.length, 1);
  assert.equal(callbacks[0].content.error, 'Private key not found in settings');
  assert.equal(delta(start).quoteFetches, 1);
  assert.equal(delta(start).swapFetches, 1);
  results.push({ name: 'Swap action', outcome: callbacks[0].content.error, counters: delta(start) });
}
{
  const start = before();
  await assert.rejects(wallet.transferSol({ publicKey: new PublicKey(principal) }, new PublicKey(recipient), 1), /Failed to get wallet keypair/);
  assert.equal(delta(start).latestBlockhash, 1);
  results.push({ name: 'Wallet service transfer', outcome: 'Failed to get wallet keypair', counters: delta(start) });
}
{
  const start = before();
  const externalWallet = { publicKey: new PublicKey(principal) };
  Object.defineProperty(externalWallet, 'privateKey', { get() { counters.externalPrivateKeyReads++; return undefined; } });
  service.jupiterService = {
    estimateLamportsNeeded: () => 5_000,
    getQuote: async () => { counters.tradingQuotes++; return { totalLamportsNeeded: 5_000, inAmount: '1000000', outAmount: '1000', otherAmountThreshold: '900', slippageBps: 200, priceImpactPct: 0.1, routePlan: [] }; },
    executeSwap: async () => { counters.tradingSwapRequests++; return { swapTransaction }; },
  };
  const response = await service.executeSwap([{ keypair: externalWallet, amount: 1_000_000 }], { sourceTokenCA: recipient, targetTokenCA: mint });
  assert.deepEqual(response, { [principal]: { success: false } });
  assert.equal(delta(start).balanceReads, 1);
  assert.equal(delta(start).tradingQuotes, 1);
  assert.equal(delta(start).tradingSwapRequests, 1);
  assert.equal(delta(start).externalPrivateKeyReads, 1);
  results.push({ name: 'External wallet trading path', outcome: 'Missing external privateKey reaches actual bs58 decoder; response success false', counters: delta(start) });
}
assert.equal(counters.signed, 0);
assert.equal(counters.sends, 0);
assert.equal(counters.secretKeyConstruction, 0);
assert.equal(counters.generatedKeys, 0);
assert.equal(counters.nativeNetwork, 0);
assert.deepEqual(Object.keys(service.exchangeRegistry), []);
await service.stop();
const pluginFile = fileURLToPath(import.meta.resolve('@elizaos/plugin-solana'));
const hash = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');
const output = {
  node: process.version, pluginEntry: pluginFile, pluginSha256: hash(pluginFile),
  actualCoreRuntime: runtime instanceof AgentRuntime, publicOnly: runtime.getSetting('SOLANA_PUBLIC_KEY') === principal,
  privateAliasesAbsent: aliases.every((alias) => runtime.getSetting(alias) === null),
  noExchangeProviders: Object.keys(service.exchangeRegistry).length === 0,
  results, counters,
  limitations: ['Synthetic public addresses and unsigned transaction bytes', 'Model/cache/RPC/Jupiter/network boundary fixtures; published core and plugin methods unmodified', 'No keys, signatures, transaction sends or live service deployment', 'Builder-team component experiment, not independent RT-2 or complete ELZ-1/2/3 qualification'],
};
writeFileSync(new URL('route-results.json', import.meta.url), JSON.stringify(output, null, 2) + '\n');
console.log(JSON.stringify(output));
