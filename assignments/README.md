# Выполненные задания за недели 1–3

Главный документ: **Отчет_недели_1_2_3.docx**.

1. Созданы два учебных кошелька, получен 1 SOL в Devnet, выполнен перевод 0.001 SOL.
2. Разобраны два успешных перевода: обычный и перевод 0.002 SOL с Memo.
3. Реализован Rust CLI, выполнены debug/release сборки и три unit-теста.

## Публичные подтверждения

- [Получение тестового SOL](https://explorer.solana.com/tx/4VrDEjvhtRqD9C6txu5pPxcS2xn1A4HvBKjRu3oLy3wJV3VGhsYUU5b6R5h8togZnvqZTfQAQmZ3Lto6pCm1jgQA?cluster=devnet)
- [Первая транзакция](https://explorer.solana.com/tx/4tr2LyQi2eUEFnr7NRH6adyichZEm5NrKNSzrzdRCNyaUJrjzPBZHPdMxUqpJEnvxNykCpvhTq41cMCtRSAPPDCj?cluster=devnet)
- [Перевод с Memo](https://explorer.solana.com/tx/2D8JeEBRGvkSRqr8KLL4ji6TidRkpYtkUbQ6zT4CaeGZotwpuqD6xnZXDi1Cpt8vUoWF148uRDuN7RKSX6MxjX1C?cluster=devnet)

Все три транзакции подтверждены как Finalized без ошибок.

## Состав папок

- `evidence/` — исходные данные RPC, финальные статусы, снимки Explorer, результаты CLI.
- `week3-cli/` — Rust-исходники, Cargo.toml, Cargo.lock, README, готовая Windows-программа и demo.cmd.
- `network/` — скрипты реальных Devnet-переводов и проверки результатов, package.json и package-lock.json.

Открой `week3-cli/demo.cmd` двойным щелчком для демонстрации третьего задания.
Для независимой проверки через RPC установи Node.js, затем в `network` выполни:

```powershell
npm ci --ignore-scripts
node verify.mjs
```

В архиве нет приватных ключей и node_modules. Оригинальные учебные ключи остаются
только на исходном компьютере в `.private/`.
Скрипт devnet.mjs для повторной отправки требует оригинальные ключи; verify.mjs только читает публичные данные.

## Коротко для защиты

- Account — запись состояния по адресу. Программа получает список нужных аккаунтов.
- Instruction — вызов одной программы с аккаунтами и данными.
- Transaction — подписанный набор инструкций. Signature позволяет найти его в Explorer.
- Signer подтверждает действие подписью; writable разрешает изменение аккаунта.
- В переводе A является signer, writable и fee payer; B — writable без подписи.
- Memo добавляет текст в журнал; во второй транзакции System и Memo вызваны последовательно.
- 1 SOL = 1 000 000 000 lamports. u64 и проверяемые операции исключают дробное округление и переполнение.
- Rust CLI — учебная модель в памяти; реальные Devnet-транзакции находятся в evidence.
