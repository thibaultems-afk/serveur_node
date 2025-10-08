require('dotenv').config();
const axios = require('axios');
const https = require('https');

const TOKEN_URL = process.env.KLEOS_TOKEN_URL;
const API_BASE = process.env.KLEOS_API_BASE;
const CLIENT_ID = process.env.KLEOS_CLIENT_ID;
const CLIENT_SECRET = process.env.KLEOS_CLIENT_SECRET;
const SCOPES = process.env.KLEOS_SCOPES || 'kleosStateful kleosLegal kleosLegalApiClient';

let tokenCache = null;

async function getToken() {
  if (tokenCache && tokenCache.expiresAt > Date.now()) return tokenCache.token;

  const params = new URLSearchParams();
  params.append('grant_type', 'client_credentials');
  params.append('client_id', CLIENT_ID);
  params.append('client_secret', CLIENT_SECRET);
  params.append('scope', SCOPES);

  try {
    const res = await axios.post(TOKEN_URL, params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      httpsAgent: new https.Agent({ rejectUnauthorized: false })
    });

    const token = res.data.access_token;
    const expiresIn = res.data.expires_in || 300;
    tokenCache = { token, expiresAt: Date.now() + (expiresIn - 30) * 1000 };
    return token;
  } catch (err) {
    console.error('Erreur récupération token :', err.response?.data || err.message);
    throw err;
  }
}

async function listContacts() {
  try {
    const token = await getToken();
    const res = await axios.get(`${API_BASE}/contacts`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      },
      httpsAgent: new https.Agent({ rejectUnauthorized: false })
    });

    // On essaye de trouver le tableau réel de contacts
    let contacts = res.data.result;
    if (!Array.isArray(contacts)) {
      if (contacts.items && Array.isArray(contacts.items)) contacts = contacts.items;
      else if (contacts.data && Array.isArray(contacts.data)) contacts = contacts.data;
      else contacts = []; // Aucun contact trouvé
    }

    console.log(`\n===== Liste des contacts (${contacts.length}) =====\n`);
    contacts.forEach(c => {
      console.log(`ID: ${c.id}, Type: ${c.type}, Nom: ${c.lastName}, Prénom: ${c.firstName}, Email: ${c.email}`);
    });

  } catch (err) {
    if (err.response) {
      console.error('Erreur API :', err.response.status, err.response.data);
    } else {
      console.error('Erreur :', err.message);
    }
  }
}

listContacts();
