// update_contact_additional_info.js
require('dotenv').config();
const axios = require('axios');
const https = require('https');

const TOKEN_URL = process.env.KLEOS_TOKEN_URL;
const API_BASE = process.env.KLEOS_API_BASE;
const CLIENT_ID = process.env.KLEOS_CLIENT_ID;
const CLIENT_SECRET = process.env.KLEOS_CLIENT_SECRET;
const SCOPES = process.env.KLEOS_SCOPES || 'kleosStateful kleosLegal kleosLegalApiClient';

// ID du contact à lire / modifier
const CONTACT_ID = 1990;

// Valeurs de test à écrire (remplace par ton SIRET réel si tu veux)
const TEST_COMMERCIAL_INFO = {
  siret: "12345678901234",            // SIRET 14 chiffres (ex: "12345678901234")
  siren: "123456789",                 // SIREN 9 chiffres
  registrationNumber: "RCS 2025 123", // Num. d'enregistrement
  registrationCity: "Paris", 
  nafCode: "6202A",
  tradeDirectory: "123456789",
  sign: "Nom commercial de test"
};

// UTIL : obtenir token (même code que tu connais)
let tokenCache = null;
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

// Essaye plusieurs GET variants (expand/include/fields) pour voir si additionalInfo est renvoyé
async function tryGetVariants(token) {
  const variants = [
    `${API_BASE}/contacts/${CONTACT_ID}`,
    `${API_BASE}/contacts/${CONTACT_ID}?expand=additionalInfo`,
    `${API_BASE}/contacts/${CONTACT_ID}?include=additionalInfo`,
    `${API_BASE}/contacts/${CONTACT_ID}?fields=additionalInfo`,
    `${API_BASE}/contacts/${CONTACT_ID}?expand=all`,
    `${API_BASE}/contacts/${CONTACT_ID}?include=all`
  ];

  for (const url of variants) {
    try {
      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        httpsAgent: new https.Agent({ rejectUnauthorized: false })
      });
      console.log(`\n✅ GET OK: ${url}`);
      console.log('Response keys:', Object.keys(res.data.result || res.data));
      // show any additionalInfo if present
      const maybe = (res.data.result && res.data.result.additionalInfo) || res.data.additionalInfo;
      console.log('additionalInfo:', JSON.stringify(maybe, null, 2));
    } catch (err) {
      console.log(`\n❌ GET ${url} -> ${err.response?.status || err.message}`);
      if (err.response?.data) console.log('Body:', JSON.stringify(err.response.data, null, 2));
    }
  }
}

// Tente d'envoyer une mise à jour en joignant additionalInfo directement
async function tryUpdateWithAdditionalInfo(token) {
  // Récupérer contact existant
  let contact;
  try {
    const res = await axios.get(`${API_BASE}/contacts/${CONTACT_ID}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      httpsAgent: new https.Agent({ rejectUnauthorized: false })
    });
    contact = res.data.result || res.data;
    console.log('\n→ Contact lu, id =', contact.id || CONTACT_ID);
  } catch (err) {
    console.error('\nImpossible de lire le contact avant MAJ :', err.response?.status || err.message);
    if (err.response?.data) console.error(err.response.data);
    return;
  }

  // Construire payload merged (on ajoute/écrase additionalInfo)
  const merged = {
    ...contact,
    additionalInfo: {
      ...(contact.additionalInfo || {}),
      commercial: { // nom de section plausible d'après UI "Activités commerciales"
        ...((contact.additionalInfo && contact.additionalInfo.commercial) || {}),
        ...TEST_COMMERCIAL_INFO
      }
    }
  };

  // Méthodes à tester : PUT /contacts (objet complet), PUT /contacts/{id}, PATCH /contacts/{id}
  const attempts = [
    { method: 'put', url: `${API_BASE}/contacts`, body: merged, desc: 'PUT /contacts (objet complet)' },
    { method: 'put', url: `${API_BASE}/contacts/${CONTACT_ID}`, body: merged, desc: `PUT /contacts/${CONTACT_ID}` },
    { method: 'patch', url: `${API_BASE}/contacts/${CONTACT_ID}`, body: merged, desc: `PATCH /contacts/${CONTACT_ID}` }
  ];

  for (const a of attempts) {
    try {
      console.log(`\n-> Tentative ${a.desc}`);
      const res = await axios({
        method: a.method,
        url: a.url,
        data: a.body,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        httpsAgent: new https.Agent({ rejectUnauthorized: false })
      });
      console.log(`✅ ${a.desc} OK: status ${res.status}`);
      console.log('Réponse:', JSON.stringify(res.data, null, 2));
      // stop on success
      return;
    } catch (err) {
      console.log(`❌ ${a.desc} -> ${err.response?.status || err.message}`);
      if (err.response?.data) console.log('Body:', JSON.stringify(err.response.data, null, 2));
    }
  }

  console.log('\nTous les essais de mise à jour ont échoué ou été rejetés.');
}

// Exécute le diagnostic
(async () => {
  const token = await getToken();
  console.log('Token obtenu, lancement des tests...');

  console.log('\n1) Tester GET variants pour additionalInfo');
  await tryGetVariants(token);

  console.log('\n2) Tenter de mettre à jour le contact avec additionalInfo (test values).');
  await tryUpdateWithAdditionalInfo(token);

  console.log('\nFin des tests. Si aucune tentative d\'écriture n\'a fonctionné, la prochaine option est :');
  console.log('- créer un extraField (SIRET) via l\'UI Admin ou via l\'endpoint extraFields si accessible,');
  console.log('- ou contacter le support Kleos pour obtenir le endpoint / param pour additionalInfo.');
})();
