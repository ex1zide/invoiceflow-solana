import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { Connection, Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction, sendAndConfirmTransaction } from '@solana/web3.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const owner = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(path.join(root, '.private/devnet-sender.json'), 'utf8'))));
const programId = new PublicKey(fs.readFileSync(path.join(root, 'assignments/week4-8-program-id.txt'), 'utf8').trim());
const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
const evidenceFile = path.join(root, 'assignments/week4-8/evidence/program.json');
fs.mkdirSync(path.dirname(evidenceFile), { recursive: true });
const evidence = fs.existsSync(evidenceFile) ? JSON.parse(fs.readFileSync(evidenceFile, 'utf8')) : {};
const save = () => fs.writeFileSync(evidenceFile, JSON.stringify(evidence, null, 2));
const discriminator = name => createHash('sha256').update(`global:${name}`).digest().subarray(0, 8);
const borshString = value => {
  const bytes = Buffer.from(value, 'utf8');
  const length = Buffer.alloc(4);
  length.writeUInt32LE(bytes.length);
  return Buffer.concat([length, bytes]);
};
const [counter] = PublicKey.findProgramAddressSync([Buffer.from('counter'), owner.publicKey.toBuffer()], programId);
const [profile] = PublicKey.findProgramAddressSync([Buffer.from('profile'), owner.publicKey.toBuffer()], programId);
evidence.cluster = 'devnet';
evidence.programId = programId.toBase58();
evidence.owner = owner.publicKey.toBase58();
evidence.counterPda = counter.toBase58();
evidence.profilePda = profile.toBase58();
evidence.programExplorer = `https://explorer.solana.com/address/${programId.toBase58()}?cluster=devnet`;
save();

async function invoke(name, accounts, args = []) {
  const ix = new TransactionInstruction({
    programId,
    keys: accounts,
    data: Buffer.concat([discriminator(name), ...args]),
  });
  return await sendAndConfirmTransaction(connection, new Transaction().add(ix), [owner], { commitment: 'confirmed' });
}
const key = (pubkey, isSigner, isWritable) => ({ pubkey, isSigner, isWritable });
if (!(await connection.getAccountInfo(programId))?.executable) {
  throw new Error('Программа ещё не опубликована в Devnet');
}
if (!evidence.helloSignature) {
  evidence.helloSignature = await invoke('hello', [key(owner.publicKey, true, false)]);
  save();
}
if (!await connection.getAccountInfo(counter)) {
  evidence.initializeCounterSignature = await invoke('initialize_counter', [
    key(counter, false, true), key(owner.publicKey, true, true), key(SystemProgram.programId, false, false),
  ]);
  save();
}
let counterInfo = await connection.getAccountInfo(counter);
let count = counterInfo.data.readBigUInt64LE(40);
while (count < 2n) {
  const sig = await invoke('increment', [key(counter, false, true), key(owner.publicKey, true, false)]);
  evidence.incrementSignatures ??= [];
  evidence.incrementSignatures.push(sig);
  save();
  counterInfo = await connection.getAccountInfo(counter);
  count = counterInfo.data.readBigUInt64LE(40);
}
if (!await connection.getAccountInfo(profile)) {
  evidence.createProfileSignature = await invoke('create_profile', [
    key(profile, false, true), key(owner.publicKey, true, true), key(SystemProgram.programId, false, false),
  ], [borshString('Бимано Алишер'), borshString('Изучаю Solana, Rust и Web3.')]);
  save();
}
if (!evidence.updateProfileSignature) {
  evidence.updateProfileSignature = await invoke('update_profile', [
    key(profile, false, true), key(owner.publicKey, true, false),
  ], [borshString('Бимано Алишер'), borshString('Мой учебный профиль в Devnet. Создал счётчик, PDA и токен ALPR.')]);
  save();
}
counterInfo = await connection.getAccountInfo(counter);
const profileInfo = await connection.getAccountInfo(profile);
let offset = 40;
const readString = () => { const n = profileInfo.data.readUInt32LE(offset); offset += 4; const value = profileInfo.data.subarray(offset, offset + n).toString('utf8'); offset += n; return value; };
evidence.counterValue = counterInfo.data.readBigUInt64LE(40).toString();
evidence.profile = { name: readString(), bio: readString() };
evidence.verifiedAt = new Date().toISOString();
save();
console.log(JSON.stringify(evidence, null, 2));
