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

// ----- FONCTION POUR LISTER LES PARTIES D'UN DOSSIER -----
async function listCaseParties(caseId) {
  try {
    const token = await getToken();
    const res = await axios.get(`${API_BASE}/cases/${caseId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      },
      httpsAgent: new https.Agent({ rejectUnauthorized: false })
    });

    const caseData = res.data.result;
    console.log(`\n===== Parties du dossier ${caseId} (${caseData.name}) =====\n`);

    if (caseData.parties && caseData.parties.length) {
      caseData.parties.forEach((p, i) => {
        console.log(`Party #${i + 1}:`);
        console.log(`  IdentityID: ${p.identityId}`);
        console.log(`  IdentityFullName: ${p.identityFullName}`);
        console.log(`  TypeCode: ${p.typeCode}`);
        console.log(`  Reference: ${p.reference}`);
        console.log(`  Linked Identities: ${p.linkedIdentities ? JSON.stringify(p.linkedIdentities) : 'None'}`);
      });
    } else {
      console.log('Aucune partie trouvée dans ce dossier.');
    }

    // parties externes si présentes
    if (caseData.externalParties && caseData.externalParties.length) {
      console.log(`\n===== Parties externes =====\n`);
      caseData.externalParties.forEach((p, i) => {
        console.log(`External Party #${i + 1}:`);
        console.log(`  IdentityID: ${p.identityId}`);
        console.log(`  IdentityFullName: ${p.identityFullName}`);
        console.log(`  TypeCode: ${p.typeCode}`);
        console.log(`  Reference: ${p.reference}`);
      });
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
// Utilise l'ID que tu m'as donné : 108
listCaseParties(108);
