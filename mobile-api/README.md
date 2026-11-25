# Flex Daddies store app: accounts server

The store app's own accounts and database. Separate from flexdaddies.com, which is never touched from here.

- `src/handle.ts`: sign in with a 6-digit email code, stay signed in, name and units, sign out, delete my account. No passwords.
- `migrations/`: the database tables.
- `dev-server.ts`: runs it on a Mac for testing (`npm run dev`). The code is shown in the app; no email is sent.
- `test/`: `npm test` (needs Node 24 or newer; no installs).
- `wrangler.jsonc`: for Cloudflare, once the database exists there.

Not done yet: sending the email (needs a sending service and DNS records), Sign in with Apple, Sign in with Google, and putting this on Cloudflare.
