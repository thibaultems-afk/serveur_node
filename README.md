# Kleos Uploader - Example project

Small example Express app that demonstrates:
- OAuth2 client_credentials token fetch (server-side)
- Create contact (`PUT /api/contacts`)
- Create case (`PUT /api/cases`)
- Upload documents (`POST /api/documents/upload`)

**Important:** This is a starting point. Adjust payloads and response fields to match your Kleos instance responses.

## Setup

1. Install Node (>=14) and npm.
2. Copy `.env.example` to `.env` and fill your `KLEOS_CLIENT_ID` and `KLEOS_CLIENT_SECRET`.
3. Install dependencies:
   ```
   npm install
   ```
4. Start the server:
   ```
   npm start
   ```
5. Open http://localhost:3000 and test the form.

## Notes / Next steps

- The sample assumes `PUT /api/contacts` returns an object containing an `id` you can use to attach to the case. Adjust keys if Kleos uses other names.
- For production, add validation, logging, rate-limiting, CSRF protections and TLS.
- Consider storing tokens/secrets securely (Vault, Azure Key Vault) and implement retries for uploads.
