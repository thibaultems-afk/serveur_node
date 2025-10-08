require('dotenv').config();
const express = require('express');
const axios = require('axios');
const FormData = require('form-data');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const https = require('https');

const app = express();
const upload = multer();

const PORT = process.env.PORT || 3000;
const TOKEN_URL = process.env.KLEOS_TOKEN_URL || 'https://ids.kleosapp.com/KLEOSIDENTITYv4/connect/token';
const API_BASE = process.env.KLEOS_API_BASE || 'https://eu.kleosapp.com/api';
const CLIENT_ID = process.env.KLEOS_CLIENT_ID;
const CLIENT_SECRET = process.env.KLEOS_CLIENT_SECRET;
const SCOPES = process.env.KLEOS_SCOPES || 'kleosStateful kleosLegal kleosLegalApiClient';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.warn('WARNING: KLEOS_CLIENT_ID or KLEOS_CLIENT_SECRET not set. Copy .env.example to .env and set them.');
}

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ------------------ TOKEN ------------------ //
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
      httpsAgent: new https.Agent({ rejectUnauthorized: false }) // seulement si nécessaire
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

// ------------------ ROUTES ------------------ //

// /api/case-types : récupérer les types de dossiers
app.get('/api/case-types', async (req, res) => {
  try {
    const token = await getToken();
    const response = await axios.get(`${API_BASE}/caseTypes`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      },
      httpsAgent: new https.Agent({ rejectUnauthorized: false })
    });

    if (!response.headers['content-type']?.includes('application/json')) {
      console.error('Unexpected /caseTypes response (not JSON):', response.data);
      return res.status(500).json({ error: 'Unexpected response from Kleos API', raw: response.data });
    }

    res.json(response.data);
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: err.message });
  }
});

// /api/submit-case : formulaire + fichiers
app.post('/api/submit-case', upload.array('documents'), async (req, res) => {
  try {
    const token = await getToken();
    const { nom, prenom, email, typeDossier } = req.body;

    // 1) Créer contact
    const contactPayload = {
      firstname: prenom,
      lastname: nom,
      emails: email ? [{ address: email }] : []
    };

    const contactResp = await axios.put(`${API_BASE}/contacts`, contactPayload, {
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      httpsAgent: new https.Agent({ rejectUnauthorized: false })
    });

    const contactJson = contactResp.data;

    // 2) Créer case/dossier
    const identityID = contactJson.id || contactJson.identityID || contactJson.identityId || contactJson.ID || contactJson.Id;
    const casePayload = {
      caseTypeID: typeDossier,
      title: `${nom} ${prenom}`.trim(),
      parties: [{ identityID }]
    };

    const caseResp = await axios.put(`${API_BASE}/cases`, casePayload, {
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      httpsAgent: new https.Agent({ rejectUnauthorized: false })
    });

    const caseJson = caseResp.data;
    const caseID = caseJson.id || caseJson.caseID || caseJson.caseId;

    // 3) Upload documents
    const uploaded = [];
    if (req.files && req.files.length) {
      for (const file of req.files) {
        const form = new FormData();
        form.append('file', file.buffer, file.originalname);
        form.append('caseID', caseID);

        try {
          const uploadResp = await axios.post(`${API_BASE}/documents/upload`, form, {
            headers: { 
              'Authorization': `Bearer ${token}`,
              ...form.getHeaders()
            },
            httpsAgent: new https.Agent({ rejectUnauthorized: false })
          });

          uploaded.push({ name: file.originalname, success: true, info: uploadResp.data });
        } catch (err) {
          console.error('Upload failed for', file.originalname, err.response?.data || err.message);
          uploaded.push({ name: file.originalname, success: false, info: err.response?.data || err.message });
        }
      }
    }

    res.json({ success: true, contact: contactJson, case: caseJson, uploads: uploaded });
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: err.message });
  }
});

// Serve index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ------------------ START SERVER ------------------ //
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
