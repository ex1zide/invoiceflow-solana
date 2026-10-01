import { Connection, PublicKey } from '@solana/web3.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../evidence');
const summary = JSON.parse(fs.readFileSync(path.join(dir, 'summary.json'), 'utf8'));
const connection = new Connection('https://api.devnet.solana.com', { commitment: 'finalized', disableRetryOnRateLimit: true });
const history = await connection.getSignaturesForAddress(new PublicKey(summary.sender), {limit: 10}, 'finalized');
fs.writeFileSync(path.join(dir, 'wallet-history.json'), JSON.stringify(history, null, 2));
for (const h of history) {
  if (summary.transactions.some(t => t.signature === h.signature)) continue;
  const tx = await connection.getParsedTransaction(h.signature, {commitment: 'finalized', maxSupportedTransactionVersion: 0});
  if (tx && !tx.meta.err && tx.transaction.message.instructions.some(i => i.program === 'system' && i.parsed?.type === 'transfer' && i.parsed?.info?.destination === summary.sender)) {
    fs.writeFileSync(path.join(dir, 'airdrop.json'), JSON.stringify(tx, null, 2));
    summary.airdropSignature = h.signature;
    summary.transactions.push({label:'airdrop', signature: h.signature, explorer:`https://explorer.solana.com/tx/${h.signature}?cluster=devnet`, slot:tx.slot, blockTime:tx.blockTime, fee:tx.meta.fee, error:tx.meta.err});
    break;
  }
}
const statuses = await connection.getSignatureStatuses(summary.transactions.map(t=>t.signature), {searchTransactionHistory:true});
summary.transactions.forEach((t,i)=>{t.confirmationStatus=statuses.value[i]?.confirmationStatus;t.error=statuses.value[i]?.err;});
summary.verifiedAt = new Date().toISOString();
fs.writeFileSync(path.join(dir, 'summary.json'), JSON.stringify(summary, null, 2));
fs.writeFileSync(path.join(dir, 'final-statuses.json'), JSON.stringify(statuses, null, 2));
if (summary.transactions.some(t=>t.confirmationStatus!=='finalized' || t.error!==null)) throw new Error('Not all transactions finalized successfully');
console.log(JSON.stringify(summary, null, 2));
