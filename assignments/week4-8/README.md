# Задания 4–8 недели — Бимано Алишер

Один учебный проект развивается по заданиям силлабуса:

| Неделя | Что сделано | Публичная проверка |
|---|---|---|
| 4 | Первая Rust-программа `hello` опубликована и вызвана в Devnet | [вызов](https://explorer.solana.com/tx/3EN3JektHqLy7DCRRKQYUFqhqbo8CxfHJhkhuA4nWbVC3fAKbp3CsgX9xCkoPHzZxsPTTZn6TrqpYCcRYbYcTvJN?cluster=devnet) |
| 5 | Та же программа обновлена до Anchor; создан Counter PDA, значение увеличено до 2 | [Counter PDA](https://explorer.solana.com/address/DN31y2A2AkG1rL1RZsH6KDrp6e2N5Gd8ndG86Jw3RMms?cluster=devnet) |
| 6 | Создан и обновлён профиль PDA с именем и описанием | [Profile PDA](https://explorer.solana.com/address/2qQzUeM2PmuYoA6zpqy2BtSfj2LTQky4yoMxsKiRESzC?cluster=devnet) |
| 7 | Создан Token 2022 с именем и символом в on-chain metadata; выпущено 1000 ALPR, переведено 25 ALPR | [Mint](https://explorer.solana.com/address/CiLa9Mxo4pTNoRV2qwdgcZZVWBjAdnanEyqn3oYFwCUc?cluster=devnet), [перевод](https://explorer.solana.com/tx/4dM79kE7H2oQX2epMxU79zcwP4GdDQ2nNmFEMDDw6wBwxgir5XhCHCbtDkF1Eouh7TAgZ3cL7j7iUJ9wFaeBUjXV?cluster=devnet) |
| 8 | Сделан InvoiceFlow: два счёта в Devnet, оплата 5 ALPR и веб-страница с их статусами | [оплаченный счёт](https://explorer.solana.com/address/4PH11X1rdkwqsmKKyV8dc7ATAM9YiGn9M7CXomB8WDVn?cluster=devnet), [перевод](https://explorer.solana.com/tx/L6BTirqHmcs8dBqwzRrArw6aiSfBAgYzZzqDzU16KE3GRUoJqxoRJdyHskoQeXLNz51e6AFimGuRJFsmtNHuFmM?cluster=devnet) |

## Запуск веб-прототипа

```powershell
cd assignments/week4-8
npm ci
npm run dev
```

Открыть адрес, который покажет Vite (обычно `http://127.0.0.1:5173/`). Два учебных счёта видны без кошелька. Для нового счёта или оплаты нужен Phantom в Devnet. Клиенту нужны ALPR и немного тестового SOL на комиссию. При создании счёта сохранить ссылку на его PDA из карточки.

## Состав проекта

- `week4-hello/` — исходник первой простой Solana-программы.
- `programs/alisher_profile/` — Anchor-программа с инструкциями предыдущих недель и `create_invoice`, `pay_invoice`, `cancel_invoice`.
- `client/hello.mjs` — вызов первой версии программы.
- `client/demo.mjs` — работа с Anchor-программой через RPC.
- `client/token.mjs` — выпуск токена, метаданные и перевод.
- `client/invoice-demo.mjs` — создание двух счетов и оплата одного из них.
- `src/`, `index.html` — страница InvoiceFlow.
- `evidence/` — публичные адреса и подписи транзакций. Приватных ключей здесь нет.

Программа находится по адресу `5EHY5pYduZMone4MRBy45Lkrrofupq1G3R1ADV9w7qXU` в Devnet. Токен — `CiLa9Mxo4pTNoRV2qwdgcZZVWBjAdnanEyqn3oYFwCUc`. Метаданные токена содержат имя `Alisher Profile Token` и символ `ALPR`. Поле URI пустое, поэтому отдельной картинки у токена нет.

Ключи для запуска скриптов записи на этом компьютере хранятся отдельно в `.private/` и не входят в отчёты и архив. Devnet SOL и ALPR здесь учебные и не имеют денежной стоимости. Счёт #20261001 на 5 ALPR оплачен; #20261002 на 8 ALPR ждёт оплаты. В текущей версии список новых счетов хранится только в браузере создателя; публичную ссылку на PDA можно передать клиенту. Для полноценного сервиса нужен поиск счетов по кошельку и платёжный токен с реальной стоимостью.
