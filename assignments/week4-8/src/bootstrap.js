import { Buffer } from 'buffer/';
globalThis.Buffer = Buffer;
await import('./main.js');
