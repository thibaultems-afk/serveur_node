require('dotenv').config();
const axios = require('axios');
const https = require('https');

const TOKEN_URL = process.env.KLEOS_TOKEN_URL;
const API_BASE = process.env.KLEOS_API_BASE;
const CLIENT_ID = process.env.KLEOS_CLIENT_ID;
const CLIENT_SECRET = process.env.KLEOS_CLIENT_SECRET;
const SCOPES = process.env.KLEOS_SCOPES || 'kleosStateful kleosLegal kleosLegalApiClient';

let tokenCache = null;
const CONTACT_ID = 1990;

// Récupérer le token
async function getToken() {
  if (tokenCache && tokenCache.expiresAt > Date.now()) return tokenCache.token;

  const params = new URLSearchParams();
  params.append('grant_type', 'client_credentials');
  params.append('client_id', CLIENT_ID);
  params.append('client_secret', CLIENT_SECRET);
  params.append('scope', SCOPES);

  const res = await axios.post(TOKEN_URL, params.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    httpsAgent: new https.Agent({ rejectUnauthorized: false })
  });

  const token = res.data.access_token;
  const expiresIn = res.data.expires_in || 300;
  tokenCache = { token, expiresAt: Date.now() + (expiresIn - 30) * 1000 };
  return token;
}

// Endpoints suspects à tester
const ENDPOINTS = [
  `contacts/${CONTACT_ID}/additional-info`,
  `contacts/${CONTACT_ID}/details`,
  `contacts/${CONTACT_ID}/extra-fields`,
  `contacts/${CONTACT_ID}/identity`,
  `contacts/${CONTACT_ID}/extended`,
  `contacts/${CONTACT_ID}/custom-fields`
];

async function scanEndpoints() {
  const token = await getToken();

  for (const path of ENDPOINTS) {
    const url = `${API_BASE}/${path}`;
    try {
      const res = await axios.get(url, {
        headers: { 'Authorization': `Bearer ${token}` },
        httpsAgent: new https.Agent({ rejectUnauthorized: false })
      });
      console.log(`✅ Endpoint trouvé : ${url}`);
      console.log(JSON.stringify(res.data, null, 2));
    } catch (err) {
      console.log(`❌ ${url} -> ${err.response?.status || err.message}`);
    }
  }
}

scanEndpoints();
