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
      httpsAgent: new https.Agent({ rejectUnauthorized: false }) // pour test local
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

// ----- FONCTION POUR LISTER LES FOLDERS D’UN CASE -----
async function listFolders(caseID) {
  try {
    const token = await getToken();
    const res = await axios.get(`${API_BASE}/api/documentfolders/${caseID}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      },
      httpsAgent: new https.Agent({ rejectUnauthorized: false })
    });

    const folders = res.data.result?.items || [];
    if (folders.length === 0) {
      console.log(`Aucun folder trouvé pour le case ${caseID}.`);
    } else {
      console.log(`Folders pour le case ${caseID}:`);
      folders.forEach(f => console.log(`- ${f.name} (ID: ${f.id})`));
    }

    return folders;
  } catch (err) {
    console.error('Erreur en listant les folders :', err.response?.data || err.message);
    return [];
  }
}

// ----- LANCEMENT -----
const CASE_ID = 108; // Remplacer par le caseID réel
listFolders(CASE_ID);
