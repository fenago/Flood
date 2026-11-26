# Password storage and Node crypto

Source: https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
Source: https://nodejs.org/api/crypto.html
Retrieved: 2026-11-26

Applies to: `CONSOLE_PASSWORD_HASH`, `/api/auth-login`, password re-entry on Approve.

## Algorithm choice (OWASP order)

1. **Argon2id** - first choice. Not in `node:crypto`, so it would need a native dependency.
2. **scrypt** - "should be used when the former is not available". Built into Node -> **our choice**.
3. bcrypt - legacy only; 72-byte input limit; work factor >= 10.
4. PBKDF2 - when FIPS-140 is required: HMAC-SHA256 **600,000** iterations (SHA512: 220,000).

### OWASP minimum scrypt settings (equivalent rows, pick one)

| N | memory | r | p |
|---|---|---|---|
| 2^17 | 128 MiB | 8 | 1 |
| 2^16 | 64 MiB | 8 | 2 |
| 2^15 | 32 MiB | 8 | 3 |
| 2^14 | 16 MiB | 8 | 5 |
| 2^13 | 8 MiB | 8 | 10 |

We use the first row: `scrypt$131072$8$1$<salt b64>$<hash b64>`. A Netlify function has 1024 MB
memory by default (Netlify functions configuration page), so 128 MiB is fine. ~0.3 s per hash measured
locally - acceptable for a single-owner login and adds natural brute-force cost.

### Argon2id rows (for reference)
m=47104 (46 MiB) t=1 p=1; m=19456 (19 MiB) t=2 p=1; m=12288 t=3; m=9216 t=4; m=7168 t=5 (all p=1).

## Salt and pepper

- Salt: unique and random per password. Node docs: salt "should be as unique as possible ... random
  and at least 16 bytes long". We store 16 random bytes in the hash string.
- Pepper: a shared secret kept *apart* from the hashes (secrets vault/HSM). Optional for us; if added,
  it would be another Functions-scoped secret and rotating it forces a password reset.

## Node `crypto.scrypt` facts

- `crypto.scrypt(password, salt, keylen[, options], callback)`; `crypto.scryptSync(...)`.
- Options: `cost`/`N` (power of two > 1, default **16384**), `blockSize`/`r` (default **8**),
  `parallelization`/`p` (default **1**), `maxmem` (default **32 * 1024 * 1024**).
- It is an error when roughly `128 * N * r > maxmem`. For N=2^17, r=8 that is 128 MiB, so the
  **default maxmem throws**; pass e.g. `maxmem: 160 * 1024 * 1024` (proved in the example test).
- Use the async form (or `promisify`) inside a handler so the event loop is not blocked.

## Node `crypto.timingSafeEqual(a, b)`

- Compares two `Buffer`/`TypedArray`/`DataView` values in constant time.
- **Throws if byte lengths differ** - check lengths first and return false.
- Node warns: it "does not guarantee that the surrounding code is timing-safe". Do not early-return on
  parse details that depend on secret data; keep the error message identical ("Wrong password").

## Other primitives used

- `crypto.randomBytes(size)` - session IDs, salts, job IDs.
- `crypto.createHmac("sha256", key)` - cookie signatures, CSRF tokens, job signatures. Use a label
  prefix per purpose (`session:`, `csrf:`, `job:`) so one MAC can never be replayed as another.

## Making the hash (owner, once, on their own machine)

```bash
node -e 'import("./knowledge/security-engineer/examples/session-auth.mjs").then(async m => console.log(await m.hashPassword(process.argv[1])))' 'their-password'
```
Paste the output into Netlify as `CONSOLE_PASSWORD_HASH` (Functions scope, secret). Clear shell
history afterwards, or type the password at a prompt instead of on the command line.

## Review checklist

- [ ] Hash parameters parsed and **bounded** before use (no downgrade via a tampered env var).
- [ ] `verifyPassword` never throws on malformed input; returns false.
- [ ] Login rate limit + lockout (doc 05 of netlify-engineer, skill `rate-limiting-cost-guards`).
- [ ] Password, hash and request body never logged.
