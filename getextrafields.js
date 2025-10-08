require('dotenv').config();
const axios = require('axios');
const https = require('https');

// ----- CONFIG -----
const TOKEN_URL = process.env.KLEOS_TOKEN_URL;
const API_BASE = process.env.KLEOS_API_BASE; // exemple: https://kleosapp.api.wolterskluwer.cloud/api
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
      httpsAgent: new https.Agent({ rejectUnauthorized: false }) // à enlever si certificat valide
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

// ----- FONCTION POUR OBTENIR LES EXTRA FIELDS -----
async function getExtraFields() {
  try {
    const token = await getToken();
    const res = await axios.get(`${API_BASE}/contacts:new`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      },
      httpsAgent: new https.Agent({ rejectUnauthorized: false })
    });

    const extraFields = res.data.result.extraFieldValues || [];
    const siretField = extraFields.find(f => f.extraFieldName.toLowerCase() === "siret");

    if (siretField) {
      console.log("Champ SIRET trouvé :", siretField);
    } else {
      console.log("Champ SIRET non trouvé dans les extra fields.");
      console.log("Liste complète des extra fields :");
      console.log(extraFields.map(f => f.extraFieldName));
    }

  } catch (err) {
    if (err.response) {
      console.error('Erreur API :', err.response.status, err.response.data);
    } else {
      console.error('Erreur :', err.message);
    }
  }
}

// ----- LANCEMENT -----
getExtraFields();
