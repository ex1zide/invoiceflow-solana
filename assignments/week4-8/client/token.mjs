import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Connection, Keypair, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import {
  ExtensionType, LENGTH_SIZE, TYPE_SIZE, TOKEN_2022_PROGRAM_ID,
  createInitializeMetadataPointerInstruction, createInitializeMintInstruction,
  getMintLen, getOrCreateAssociatedTokenAccount, mintTo, transferChecked,
  getAccount, getMint, getTokenMetadata,
} from '@solana/spl-token';
import { createInitializeInstruction, pack } from '@solana/spl-token-metadata';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const secrets = path.join(root, '.private');
const evidenceFile = path.join(root, 'assignments/week4-8/evidence/token.json');
const mintKeyFile = path.join(secrets, 'week7-mint.json');
const readKey = file => Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(file, 'utf8'))));
const sender = readKey(path.join(secrets, 'devnet-sender.json'));
const recipient = readKey(path.join(secrets, 'devnet-recipient.json'));
const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
fs.mkdirSync(path.dirname(evidenceFile), { recursive: true });
const evidence = fs.existsSync(evidenceFile) ? JSON.parse(fs.readFileSync(evidenceFile, 'utf8')) : {};
const save = () => fs.writeFileSync(evidenceFile, JSON.stringify(evidence, null, 2));
let mint;
if (fs.existsSync(mintKeyFile)) mint = readKey(mintKeyFile);
else {
  mint = Keypair.generate();
  fs.writeFileSync(mintKeyFile, JSON.stringify(Array.from(mint.secretKey)));
}
const name = 'Alisher Profile Token';
const symbol = 'ALPR';
const uri = '';
const decimals = 2;
const mintSpace = getMintLen([ExtensionType.MetadataPointer]);
const metadata = {
  updateAuthority: sender.publicKey,
  mint: mint.publicKey,
  name,
  symbol,
  uri,
  additionalMetadata: [],
};
const fullSpace = mintSpace + TYPE_SIZE + LENGTH_SIZE + pack(metadata).length;
const rent = await connection.getMinimumBalanceForRentExemption(fullSpace);
evidence.cluster = 'devnet';
evidence.mint = mint.publicKey.toBase58();
evidence.sender = sender.publicKey.toBase58();
evidence.recipient = recipient.publicKey.toBase58();
evidence.program = TOKEN_2022_PROGRAM_ID.toBase58();
evidence.name = name;
evidence.symbol = symbol;
evidence.decimals = decimals;
save();

if (!await connection.getAccountInfo(mint.publicKey)) {
  const tx = new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: sender.publicKey,
      newAccountPubkey: mint.publicKey,
      lamports: rent,
      space: mintSpace,
      programId: TOKEN_2022_PROGRAM_ID,
    }),
    createInitializeMetadataPointerInstruction(
      mint.publicKey, sender.publicKey, mint.publicKey, TOKEN_2022_PROGRAM_ID,
    ),
    createInitializeMintInstruction(
      mint.publicKey, decimals, sender.publicKey, null, TOKEN_2022_PROGRAM_ID,
    ),
  );
  evidence.createMintSignature = await sendAndConfirmTransaction(connection, tx, [sender, mint]);
  save();
}

if (!await getTokenMetadata(connection, mint.publicKey, 'confirmed', TOKEN_2022_PROGRAM_ID)) {
  const ix = createInitializeInstruction({
    programId: TOKEN_2022_PROGRAM_ID,
    metadata: mint.publicKey,
    updateAuthority: sender.publicKey,
    mint: mint.publicKey,
    mintAuthority: sender.publicKey,
    name, symbol, uri,
  });
  evidence.metadataSignature = await sendAndConfirmTransaction(connection, new Transaction().add(ix), [sender]);
  save();
}

const senderToken = await getOrCreateAssociatedTokenAccount(
  connection, sender, mint.publicKey, sender.publicKey, false, 'confirmed', undefined, TOKEN_2022_PROGRAM_ID,
);
const recipientToken = await getOrCreateAssociatedTokenAccount(
  connection, sender, mint.publicKey, recipient.publicKey, false, 'confirmed', undefined, TOKEN_2022_PROGRAM_ID,
);
evidence.senderTokenAccount = senderToken.address.toBase58();
evidence.recipientTokenAccount = recipientToken.address.toBase58();
save();

const supply = (await getMint(connection, mint.publicKey, 'confirmed', TOKEN_2022_PROGRAM_ID)).supply;
if (supply === 0n) {
  evidence.mintToSignature = await mintTo(
    connection, sender, mint.publicKey, senderToken.address, sender, 100000n, [], undefined, TOKEN_2022_PROGRAM_ID,
  );
  save();
}
const recipientBalance = (await getAccount(connection, recipientToken.address, 'confirmed', TOKEN_2022_PROGRAM_ID)).amount;
if (recipientBalance === 0n) {
  evidence.transferSignature = await transferChecked(
    connection, sender, senderToken.address, mint.publicKey, recipientToken.address,
    sender, 2500n, decimals, [], undefined, TOKEN_2022_PROGRAM_ID,
  );
  save();
}
const mintInfo = await getMint(connection, mint.publicKey, 'confirmed', TOKEN_2022_PROGRAM_ID);
const senderInfo = await getAccount(connection, senderToken.address, 'confirmed', TOKEN_2022_PROGRAM_ID);
const recipientInfo = await getAccount(connection, recipientToken.address, 'confirmed', TOKEN_2022_PROGRAM_ID);
const onchainMetadata = await getTokenMetadata(connection, mint.publicKey, 'confirmed', TOKEN_2022_PROGRAM_ID);
evidence.supplyRaw = mintInfo.supply.toString();
evidence.senderBalanceRaw = senderInfo.amount.toString();
evidence.recipientBalanceRaw = recipientInfo.amount.toString();
evidence.onchainMetadata = {
  name: onchainMetadata?.name,
  symbol: onchainMetadata?.symbol,
  uri: onchainMetadata?.uri,
};
evidence.explorer = `https://explorer.solana.com/address/${mint.publicKey.toBase58()}?cluster=devnet`;
evidence.verifiedAt = new Date().toISOString();
save();
console.log(JSON.stringify(evidence, null, 2));
