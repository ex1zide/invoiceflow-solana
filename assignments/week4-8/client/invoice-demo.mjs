import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { Connection, Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction, sendAndConfirmTransaction } from '@solana/web3.js';
import { getAssociatedTokenAddressSync, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const keypair = name => Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(path.join(root, `.private/${name}.json`), 'utf8'))));
const merchant = keypair('devnet-sender');
const customer = keypair('devnet-recipient');
const programId = new PublicKey('5EHY5pYduZMone4MRBy45Lkrrofupq1G3R1ADV9w7qXU');
const mint = new PublicKey('CiLa9Mxo4pTNoRV2qwdgcZZVWBjAdnanEyqn3oYFwCUc');
const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
const evidencePath = path.join(root, 'assignments/week4-8/evidence/invoices.json');
const evidence = fs.existsSync(evidencePath) ? JSON.parse(fs.readFileSync(evidencePath, 'utf8')) : { cluster: 'devnet', programId: programId.toBase58(), mint: mint.toBase58(), invoices: [] };
const save = () => fs.writeFileSync(evidencePath, JSON.stringify(evidence, null, 2));
const disc = name => createHash('sha256').update(`global:${name}`).digest().subarray(0, 8);
const u64 = value => { const b = Buffer.alloc(8); b.writeBigUInt64LE(BigInt(value)); return b; };
const str = value => { const v = Buffer.from(value); const b = Buffer.alloc(4); b.writeUInt32LE(v.length); return Buffer.concat([b, v]); };
const key = (pubkey, isSigner = false, isWritable = false) => ({ pubkey, isSigner, isWritable });
const pda = id => PublicKey.findProgramAddressSync([Buffer.from('invoice'), merchant.publicKey.toBuffer(), u64(id)], programId)[0];
const customerToken = getAssociatedTokenAddressSync(mint, customer.publicKey, false, TOKEN_2022_PROGRAM_ID);
const merchantToken = getAssociatedTokenAddressSync(mint, merchant.publicKey, false, TOKEN_2022_PROGRAM_ID);
async function invoke(name, keys, signer, args = []) {
  return sendAndConfirmTransaction(connection, new Transaction().add(new TransactionInstruction({ programId, keys, data: Buffer.concat([disc(name), ...args]) })), [signer], { commitment: 'confirmed' });
}
async function ensureInvoice(id, title, amount, pay) {
  const account = pda(id);
  let record = evidence.invoices.find(item => item.id === id);
  if (!record) { record = { id, title, amountAlpr: amount / 100, address: account.toBase58(), merchant: merchant.publicKey.toBase58(), customer: customer.publicKey.toBase58() }; evidence.invoices.push(record); }
  if (!await connection.getAccountInfo(account)) {
    record.createSignature = await invoke('create_invoice', [key(account, false, true), key(merchant.publicKey, true, true), key(customer.publicKey), key(mint), key(SystemProgram.programId)], merchant, [u64(id), u64(amount), str(title)]);
    save();
  }
  if (pay) {
    const info = await connection.getAccountInfo(account);
    if (!info) throw new Error('Invoice not found after creation');
    const statusOffset = 8 + 8 + 32 + 32 + 32 + 8 + 4 + Buffer.byteLength(title);
    if (info.data[statusOffset] === 0) {
      record.paySignature = await invoke('pay_invoice', [key(account, false, true), key(customer.publicKey, true), key(merchant.publicKey), key(mint), key(customerToken, false, true), key(merchantToken, false, true), key(TOKEN_2022_PROGRAM_ID)], customer);
      save();
    }
  }
  const final = await connection.getAccountInfo(account);
  record.status = ['pending', 'paid', 'cancelled'][final.data[8 + 8 + 32 + 32 + 32 + 8 + 4 + Buffer.byteLength(title)]];
  save();
  console.log(`${id}: ${record.status} ${account.toBase58()}`);
}
await ensureInvoice(20261001, 'Дизайн лендинга', 500, true);
await ensureInvoice(20261002, 'Логотип для проекта', 800, false);
