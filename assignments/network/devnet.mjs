import { Connection, Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction, sendAndConfirmTransaction } from '@solana/web3.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const secrets = path.resolve(root, '../.private');
const evidence = path.join(root, 'evidence');
fs.mkdirSync(secrets, { recursive: true });
fs.mkdirSync(evidence, { recursive: true });
const rpc = 'https://api.devnet.solana.com';
const connection = new Connection(rpc, { commitment: 'confirmed', disableRetryOnRateLimit: true });
function wallet(name) {
  const file = path.join(secrets, `${name}.json`);
  if (!fs.existsSync(file)) {
    if (fs.existsSync(path.join(evidence, 'summary.json'))) {
      throw new Error('Original wallet keys are absent. Use verify.mjs for read-only verification of the submitted work.');
    }
    const key = Keypair.generate();
    fs.writeFileSync(file, JSON.stringify(Array.from(key.secretKey)), { flag: 'wx', mode: 0o600 });
  }
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(file, 'utf8'))));
}
const sender = wallet('devnet-sender');
const recipient = wallet('devnet-recipient');
const stateFile = path.join(evidence, 'summary.json');
const state = fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, 'utf8')) : {
  cluster: 'devnet', rpc, createdAt: new Date().toISOString(),
  sender: sender.publicKey.toBase58(), recipient: recipient.publicKey.toBase58(), transactions: []
};
const save = () => fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
const sleep = ms => new Promise(r => setTimeout(r, ms));
save();
console.log(JSON.stringify({ sender: state.sender, recipient: state.recipient, cluster: state.cluster }));

async function capture(label, signature) {
  let tx;
  for (let i = 0; i < 15; i++) {
    tx = await connection.getParsedTransaction(signature, { commitment: 'confirmed', maxSupportedTransactionVersion: 0 });
    if (tx) break;
    await sleep(2000);
  }
  if (!tx) throw new Error(`Not yet indexed: ${signature}`);
  fs.writeFileSync(path.join(evidence, `${label}.json`), JSON.stringify(tx, null, 2));
  const record = { label, signature, explorer: `https://explorer.solana.com/tx/${signature}?cluster=devnet`, slot: tx.slot, blockTime: tx.blockTime, fee: tx.meta.fee, error: tx.meta.err };
  const old = state.transactions.findIndex(x => x.label === label);
  if (old >= 0) state.transactions[old] = record; else state.transactions.push(record);
  save();
  console.log(JSON.stringify(record));
  if (tx.meta.err) throw new Error(`Transaction failed: ${JSON.stringify(tx.meta.err)}`);
}

if (process.argv[2] === 'setup') {
  state.balanceLamports = await connection.getBalance(sender.publicKey);
  save();
  if (state.balanceLamports < 5_000_000 && !state.airdropSignature) {
    const sig = await connection.requestAirdrop(sender.publicKey, 1_000_000_000);
    state.airdropSignature = sig; save();
    console.log('Airdrop submitted:', sig);
    await capture('airdrop', sig);
  }
  console.log('Balance:', await connection.getBalance(sender.publicKey));
} else if (process.argv[2] === 'complete') {
  const balance = await connection.getBalance(sender.publicKey);
  console.log('Balance:', balance);
  if (balance < 5_000_000) throw new Error('Fund the sender with at least 0.005 Devnet SOL.');
  if (state.airdropSignature && !state.transactions.some(x => x.label === 'airdrop')) await capture('airdrop', state.airdropSignature);
  for (const label of ['transfer', 'transfer-memo']) {
    const pending = state[`${label}Signature`];
    if (state.transactions.some(x => x.label === label)) continue;
    if (pending) { await capture(label, pending); continue; }
    const tx = new Transaction().add(SystemProgram.transfer({ fromPubkey: sender.publicKey, toPubkey: recipient.publicKey, lamports: label === 'transfer' ? 1_000_000 : 2_000_000 }));
    if (label === 'transfer-memo') tx.add(new TransactionInstruction({
      programId: new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'),
      keys: [{ pubkey: sender.publicKey, isSigner: true, isWritable: false }],
      data: Buffer.from('Solana course weeks 1-3: transaction detective', 'utf8')
    }));
    const sig = await sendAndConfirmTransaction(connection, tx, [sender], { commitment: 'confirmed' });
    state[`${label}Signature`] = sig; save();
    await capture(label, sig);
    await sleep(1000);
  }
  state.balanceLamports = await connection.getBalance(sender.publicKey);
  state.recipientBalanceLamports = await connection.getBalance(recipient.publicKey);
  save();
} else if (process.argv[2] === 'balance') {
  console.log('Balance:', await connection.getBalance(sender.publicKey));
} else {
  console.log('Usage: node devnet.mjs setup | complete | balance');
}
