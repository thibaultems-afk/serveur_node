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

// ----- FONCTION POUR PARCOURIR RÉCURSIVEMENT LES CHAMPS -----
function printFields(obj, prefix = '') {
  if (Array.isArray(obj)) {
    obj.forEach((item, index) => {
      printFields(item, `${prefix}[${index}].`);
    });
  } else if (obj && typeof obj === 'object') {
    for (const key of Object.keys(obj)) {
      if (obj[key] && typeof obj[key] === 'object') {
        printFields(obj[key], `${prefix}${key}.`);
      } else {
        console.log(`${prefix}${key}`);
      }
    }
  }
}

// ----- FONCTION POUR LISTER TOUS LES CHAMPS D’UNE FICHE CONTACT -----
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

    console.log("=== Champs standards et sous-champs ===");
    printFields(contact);

    console.log("\n=== Extra fields ===");
    const extraFields = contact.extraFieldValues || [];
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
