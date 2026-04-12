import { createECDH } from 'node:crypto';

function toBase64Url(buffer) {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

const ecdh = createECDH('prime256v1');
ecdh.generateKeys();

const publicKey = toBase64Url(ecdh.getPublicKey());
const privateKey = toBase64Url(ecdh.getPrivateKey());

console.log('Generated VAPID keys');
console.log('');
console.log(`VITE_VAPID_PUBLIC_KEY=${publicKey}`);
console.log(`WEB_PUSH_VAPID_PRIVATE_KEY=${privateKey}`);
console.log('WEB_PUSH_VAPID_SUBJECT=mailto:admin@example.com');
console.log('');
console.log('Notes:');
console.log('- VITE_VAPID_PUBLIC_KEY goes to Vercel Preview/Production env.');
console.log('- WEB_PUSH_VAPID_PRIVATE_KEY and WEB_PUSH_VAPID_SUBJECT are for server-side dispatch only.');
