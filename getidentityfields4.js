require('dotenv').config();
const axios = require('axios');
const https = require('https');

// ----- CONFIG -----
const TOKEN_URL = process.env.KLEOS_TOKEN_URL;
const API_BASE = process.env.KLEOS_API_BASE; 
const CLIENT_ID = process.env.KLEOS_CLIENT_ID;
const CLIENT_SECRET = process.env.KLEOS_CLIENT_SECRET;
const SCOPES = process.env.KLEOS_SCOPES || 'kleosStateful kleosLegal kleosLegalApiClient';

// ----- CACHE DU TOKEN -----
let tokenCache = null;

// ----- FONCTION POUR OBTENIR LE TOKEN -----
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

// ----- FONCTION POUR LISTER LES SOUS-CHAMPS D'UN OBJET -----
function listSubFields(obj, objName) {
  if (!obj) return;
  console.log(`\n=== Sous-champs de ${objName} ===`);
  Object.keys(obj).forEach(k => console.log(`${objName}.${k}`));
}

// ----- FONCTION POUR LISTER TOUS LES CHAMPS RELEVANTS -----
async function listContactFields() {
  try {
    const token = await getToken();
    const res = await axios.get(`${API_BASE}/contacts:new`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      },
      httpsAgent: new https.Agent({ rejectUnauthorized: false })
    });

    const contact = res.data.result;

    // Champs principaux
    console.log("=== Champs principaux ===");
    Object.keys(contact).forEach(k => console.log(k));

    // Sous-champs ciblés
    listSubFields(contact.mainAddress, "mainAddress");

    if (contact.addresses && contact.addresses.length > 0) {
      contact.addresses.forEach((addr, i) => listSubFields(addr, `addresses[${i}]`));
    }

    if (contact.bankAccounts && contact.bankAccounts.length > 0) {
      contact.bankAccounts.forEach((ba, i) => listSubFields(ba, `bankAccounts[${i}]`));
    }

    if (contact.contacts && contact.contacts.length > 0) {
      contact.contacts.forEach((c, i) => listSubFields(c, `contacts[${i}]`));
    }

    // Extra fields
    const extraFields = contact.extraFieldValues || [];
    console.log("\n=== Extra fields ===");
    extraFields.forEach(f => {
      console.log(`- ${f.extraFieldName} (ID: ${f.extraFieldID}, Groupe: ${f.extraFieldGroupDescription}, Type: ${f.extraFieldDataType})`);
    });

  } catch (err) {
    if (err.response) {
      console.error('Erreur API :', err.response.status, err.response.data);
    } else {
      console.error('Erreur :', err.message);
    }
  }
}

// ----- LANCEMENT -----
listContactFields();
