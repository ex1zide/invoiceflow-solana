import { Buffer } from 'buffer/';
import { Connection, PublicKey, SystemProgram, Transaction, TransactionInstruction } from '@solana/web3.js';
import { getAssociatedTokenAddressSync, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
import './style.css';
globalThis.Buffer = Buffer;
const rpc = new Connection('https://api.devnet.solana.com', 'confirmed');
const programId = new PublicKey('5EHY5pYduZMone4MRBy45Lkrrofupq1G3R1ADV9w7qXU');
const mint = new PublicKey('CiLa9Mxo4pTNoRV2qwdgcZZVWBjAdnanEyqn3oYFwCUc');
const merchant = new PublicKey('GthSheRw2tjCYCzq7sft6mZxZVDh8qN7JfvmGuce6V67');
const samples = [{ id: 20261001, merchant, payment: 'L6BTirqHmcs8dBqwzRrArw6aiSfBAgYzZzqDzU16KE3GRUoJqxoRJdyHskoQeXLNz51e6AFimGuRJFsmtNHuFmM' }, { id: 20261002, merchant }];
const $ = id => document.getElementById(id);
const link = (type, value) => `https://explorer.solana.com/${type}/${value}?cluster=devnet`;
const u64 = value => { const b = Buffer.alloc(8); b.writeBigUInt64LE(BigInt(value)); return b; };
const str = value => { const bytes = Buffer.from(value, 'utf8'); const size = Buffer.alloc(4); size.writeUInt32LE(bytes.length); return Buffer.concat([size, bytes]); };
const key = (pubkey, isSigner = false, isWritable = false) => ({ pubkey, isSigner, isWritable });
const pda = (owner, id) => PublicKey.findProgramAddressSync([Buffer.from('invoice'), owner.toBuffer(), u64(id)], programId)[0];
const message = value => { $('message').textContent = value; };
let wallet = null;
async function disc(name) { return Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`global:${name}`))).subarray(0, 8); }
function decode(data, address) {
  let pos = 8;
  const id = Number(data.readBigUInt64LE(pos)); pos += 8;
  const merchant = new PublicKey(data.subarray(pos, pos + 32)); pos += 32;
  const customer = new PublicKey(data.subarray(pos, pos + 32)); pos += 32;
  const tokenMint = new PublicKey(data.subarray(pos, pos + 32)); pos += 32;
  const amount = Number(data.readBigUInt64LE(pos)); pos += 8;
  const length = data.readUInt32LE(pos); pos += 4;
  const title = data.subarray(pos, pos + length).toString('utf8'); pos += length;
  const status = ['Ожидает оплаты', 'Оплачен', 'Отменён'][data[pos]];
  return { id, merchant, customer, tokenMint, amount, title, status, address };
}
async function send(name, keys, args = []) {
  if (!wallet) throw new Error('Подключи Phantom и выбери Devnet.');
  const latest = await rpc.getLatestBlockhash();
  const tx = new Transaction({ feePayer: wallet, recentBlockhash: latest.blockhash }).add(new TransactionInstruction({ programId, keys, data: Buffer.concat([await disc(name), ...args]) }));
  const result = await window.solana.signAndSendTransaction(tx);
  await rpc.confirmTransaction({ ...latest, signature: result.signature }, 'confirmed');
  message(`Готово. Транзакция: ${result.signature}`);
  return result.signature;
}
async function pay(invoice) {
  if (!wallet) throw new Error('Подключи кошелёк клиента в Phantom.');
  if (!wallet.equals(invoice.customer)) throw new Error('Оплатить может только клиент, указанный в счёте.');
  const customerToken = getAssociatedTokenAddressSync(invoice.tokenMint, wallet, false, TOKEN_2022_PROGRAM_ID);
  const merchantToken = getAssociatedTokenAddressSync(invoice.tokenMint, invoice.merchant, false, TOKEN_2022_PROGRAM_ID);
  await send('pay_invoice', [key(invoice.address, false, true), key(wallet, true), key(invoice.merchant), key(invoice.tokenMint), key(customerToken, false, true), key(merchantToken, false, true), key(TOKEN_2022_PROGRAM_ID)]);
  await refresh();
}
function card(invoice) {
  const el = document.createElement('article'); el.className = 'invoice';
  const statusClass = invoice.status === 'Оплачен' ? 'paid' : invoice.status === 'Отменён' ? 'cancelled' : 'pending';
  el.innerHTML = `<div class="invoice-top"><small>СЧЁТ #${invoice.id}</small><span class="pill ${statusClass}">${invoice.status}</span></div><h3></h3><p class="amount">${(invoice.amount / 100).toFixed(2)} ALPR</p><div class="addresses"><span>Исполнитель: ${invoice.merchant.toBase58()}</span><span>Клиент: ${invoice.customer.toBase58()}</span></div><div class="invoice-links"><a target="_blank" rel="noreferrer">Счёт в Explorer ↗</a></div>`;
  el.querySelector('h3').textContent = invoice.title;
  el.querySelector('a').href = link('address', invoice.address.toBase58());
  const share = document.createElement('a'); const shareUrl = new URL(location.href); shareUrl.searchParams.set('invoice', invoice.address.toBase58()); share.href = shareUrl.href; share.textContent = 'Ссылка клиенту ↗'; el.querySelector('.invoice-links').append(share);
  if (invoice.payment) { const proof = document.createElement('a'); proof.textContent = 'Перевод ↗'; proof.href = link('tx', invoice.payment); proof.target = '_blank'; proof.rel = 'noreferrer'; el.querySelector('.invoice-links').append(proof); }
  if (invoice.status === 'Ожидает оплаты') { const button = document.createElement('button'); button.textContent = 'Оплатить'; button.onclick = () => pay(invoice).catch(error => message(error.message)); el.querySelector('.invoice-links').append(button); }
  return el;
}
async function refresh() {
  $('program-link').href = link('address', programId.toBase58());
  const visible = [...samples, ...JSON.parse(localStorage.getItem('invoiceflow-invoices') || '[]').map(item => ({ id: item.id, merchant: new PublicKey(item.merchant) }))];
  const sharedAddress = new URLSearchParams(location.search).get('invoice');
  let shared = null;
  if (sharedAddress) { try { shared = new PublicKey(sharedAddress); } catch { message('Ссылка на счёт содержит неверный адрес.'); } }
  const [program, ...accounts] = await Promise.all([rpc.getAccountInfo(programId), ...visible.map(item => rpc.getAccountInfo(pda(item.merchant, item.id))), ...(shared ? [rpc.getAccountInfo(shared)] : [])]);
  $('program-status').textContent = program?.executable ? 'Программа работает' : 'Программа недоступна';
  const list = $('invoice-list'); list.replaceChildren();
  const invoices = accounts.slice(0, visible.length).map((account, i) => account && { ...decode(Buffer.from(account.data), pda(visible[i].merchant, visible[i].id)), payment: visible[i].payment }).filter(Boolean);
  if (shared && accounts[visible.length]?.owner.equals(programId) && !invoices.some(item => item.address.equals(shared))) invoices.unshift(decode(Buffer.from(accounts[visible.length].data), shared));
  invoices.forEach(invoice => list.append(card(invoice)));
  if (!invoices.length) list.textContent = 'Счета пока не найдены.';
  $('updated').textContent = `Загружено из Devnet · ${invoices.length} счёта`;
}
$('connect').onclick = async () => { try { if (!window.solana?.isPhantom) throw new Error('Установи Phantom и переключись на Devnet.'); wallet = (await window.solana.connect()).publicKey; $('connect').textContent = `${wallet.toBase58().slice(0, 5)}…${wallet.toBase58().slice(-5)}`; message(`Кошелёк ${wallet.toBase58()} подключён.`); } catch(error) { message(error.message); } };
$('create').onclick = async () => { try {
  if (!wallet) throw new Error('Подключи Phantom и выбери Devnet.');
  const customer = new PublicKey($('customer').value.trim());
  const amount = Number($('amount').value);
  const title = $('title').value.trim();
  if (!Number.isSafeInteger(amount * 100) || amount <= 0) throw new Error('Укажи сумму ALPR с точностью до двух знаков.');
  if (!title || Buffer.byteLength(title) > 64) throw new Error('Название должно быть от 1 до 64 байт.');
  const id = Date.now();
  const address = pda(wallet, id);
  await send('create_invoice', [key(address, false, true), key(wallet, true, true), key(customer), key(mint), key(SystemProgram.programId)], [u64(id), u64(amount * 100), str(title)]);
  const saved = JSON.parse(localStorage.getItem('invoiceflow-invoices') || '[]'); saved.push({ id, merchant: wallet.toBase58() }); localStorage.setItem('invoiceflow-invoices', JSON.stringify(saved));
  await refresh();
  const shareUrl = new URL(location.href); shareUrl.searchParams.set('invoice', address.toBase58());
  message(`Счёт создан. Отправь клиенту ссылку: ${shareUrl.href}`);
} catch(error) { message(error.message); } };
refresh().catch(error => message(`Не удалось загрузить Devnet: ${error.message}`));
