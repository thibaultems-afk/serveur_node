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

// ----- FONCTION POUR VÉRIFIER LES DOCUMENTS DANS UN DOSSIER -----
async function listDocumentsInFolder(caseID, folderID) {
  try {
    const token = await getToken();
    const res = await axios.get(`${API_BASE}/documents`, {
      headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' },
      params: { caseId: caseID, folderId: folderID },
      httpsAgent: new https.Agent({ rejectUnauthorized: false })
    });

    const documents = res.data.result?.items || [];
    if (documents.length === 0) {
      console.log(`Aucun document trouvé dans le folder ${folderID} du case ${caseID}.`);
    } else {
      console.log(`Documents dans le folder ${folderID} du case ${caseID}:`);
      documents.forEach(doc => {
        console.log(`- ${doc.title} (ID: ${doc.id}, créé le ${doc.creationDate})`);
      });
    }
  } catch (err) {
    console.error(`Erreur pour folderId ${folderID}:`, err.response?.data || err.message);
  }
}

// ----- LANCEMENT -----
const CASE_ID = 108; // 🔹 Remplacer par le caseID réel
checkDocuments(CASE_ID);
