import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Connection, Keypair, PublicKey, Transaction, TransactionInstruction, sendAndConfirmTransaction } from '@solana/web3.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const owner = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(path.join(root, '.private/devnet-sender.json'), 'utf8'))));
const programId = new PublicKey(fs.readFileSync(path.join(root, 'assignments/week4-8-program-id.txt'), 'utf8').trim());
const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
const file = path.join(root, 'assignments/week4-8/evidence/hello.json');
const evidence = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
const program = await connection.getAccountInfo(programId);
if (!program?.executable) throw new Error('Программа пока не опубликована');
if (!evidence.helloSignature) {
  const ix = new TransactionInstruction({ programId, keys: [], data: Buffer.alloc(0) });
  evidence.helloSignature = await sendAndConfirmTransaction(connection, new Transaction().add(ix), [owner]);
}
evidence.programId = programId.toBase58();
evidence.owner = owner.publicKey.toBase58();
evidence.cluster = 'devnet';
evidence.programExplorer = `https://explorer.solana.com/address/${programId.toBase58()}?cluster=devnet`;
evidence.helloExplorer = `https://explorer.solana.com/tx/${evidence.helloSignature}?cluster=devnet`;
evidence.verifiedAt = new Date().toISOString();
fs.mkdirSync(path.dirname(file), { recursive: true });
fs.writeFileSync(file, JSON.stringify(evidence, null, 2));
console.log(JSON.stringify(evidence, null, 2));
