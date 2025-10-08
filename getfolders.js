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

// ----- Récupérer tous les folders d’un case -----
async function listDocumentFolders(caseId, maxLevels = 10) {
  const token = await getToken();
  const res = await axios.get(`${API_BASE}/documentfolders/${caseId}?maxLevels=${maxLevels}`, {
    headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' },
    httpsAgent: new https.Agent({ rejectUnauthorized: false })
  });
  return res.data.result || [];
}

// ----- Récupérer les documents réels d’un folder -----
async function listFolderDocuments(caseId, folderId) {
  const token = await getToken();
  try {
    const res = await axios.get(`${API_BASE}/documents`, {
      headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' },
      params: { caseId, folderId },
      httpsAgent: new https.Agent({ rejectUnauthorized: false })
    });
    return res.data.result?.items || [];
  } catch (err) {
    console.error(`Erreur pour folderId ${folderId}:`, err.response?.status, err.response?.data || err.message);
    return [];
  }
}

// ----- Parcours récursif pour afficher folders et documents -----
async function printFoldersWithDocs(folders, caseId, parentName = '') {
  for (const folder of folders) {
    const fullName = parentName ? `${parentName} / ${folder.name}` : folder.name;
    console.log(`\nFolder: ${fullName} (ID: ${folder.id})`);

    // documents réels dans le folder
    const docs = await listFolderDocuments(caseId, folder.id);
    if (docs.length) {
      docs.forEach(doc => console.log(`  Document: ${doc.title || doc.name} (ID: ${doc.id})`));
    } else {
      console.log('  Aucun document.');
    }

    // enfants
    if (folder.children && folder.children.length > 0) {
      await printFoldersWithDocs(folder.children, caseId, fullName);
    }
  }
}

// ----- LANCEMENT -----
(async () => {
  const caseId = 108; // Remplacer par le caseID réel
  console.log(`\n===== Documents du case ${caseId} =====`);

  try {
    const folders = await listDocumentFolders(caseId);
    await printFoldersWithDocs(folders, caseId);
  } catch (err) {
    console.error('Erreur en listant les folders :', err.response?.data || err.message);
  }
})();
