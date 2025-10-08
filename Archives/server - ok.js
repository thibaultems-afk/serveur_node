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
const TOKEN_URL = process.env.KLEOS_TOKEN_URL;
const API_BASE = process.env.KLEOS_API_BASE;
const CLIENT_ID = process.env.KLEOS_CLIENT_ID;
const CLIENT_SECRET = process.env.KLEOS_CLIENT_SECRET;
const SCOPES = process.env.KLEOS_SCOPES || 'kleosStateful kleosLegal kleosLegalApiClient';

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ---------------- TOKEN ----------------
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

// ---------------- ROUTES ----------------

// 1️⃣ Types de dossier
app.get('/api/case-types', async (req, res) => {
  try {
    const token = await getToken();
    const response = await axios.get(`${API_BASE}/caseTypes`, {
      headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' },
      httpsAgent: new https.Agent({ rejectUnauthorized: false })
    });
    res.json(response.data.result.items);
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data || err.message });
  }
});

// 2️⃣ Créer contact, dossier et uploader fichiers
app.post('/api/submit-case', upload.array('documents'), async (req, res) => {
  try {
    const token = await getToken();
    const {
      nom,
      prenom,
      email,
      contactType, // 'N' ou 'L'
      street,
      city,
      postalCode,
      country,
      typeDossier
    } = req.body;

    // --- a) Créer contact ---
    const contactPayload = {
      firstName: prenom,
      lastName: nom,
      type: contactType, // 'N' ou 'L'
      reference: `${nom}_${prenom}_${Date.now()}`,
      mainAddress: {
        street,
        town: city,
        zipCode: postalCode,
        country
      },
      emails: email ? [{ address: email }] : []
    };

    console.log('Contact payload:', contactPayload);

    const contactResp = await axios.put(`${API_BASE}/contacts`, contactPayload, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json-patch+json',
        'Accept': 'application/json'
      },
      httpsAgent: new https.Agent({ rejectUnauthorized: false })
    });

    const contactJson = contactResp.data;
    const identityID = contactJson.result;

    // --- b) Créer le dossier ---
    const now = new Date().toISOString();
    const casePayload = {
      caseTypeID: typeDossier,
      title: `${nom} ${prenom}`,
      name: `${nom} ${prenom}`,
      creationDate: now,
      parties: [{ identityID }]
    };

    const caseResp = await axios.put(`${API_BASE}/cases`, casePayload, {
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      httpsAgent: new https.Agent({ rejectUnauthorized: false })
    });

    const caseJson = caseResp.data;
    const caseID = caseJson.result?.id;

    // --- c) Upload documents ---
    const uploaded = [];
    if (req.files && req.files.length) {
      for (const file of req.files) {
        const form = new FormData();
        form.append('file', file.buffer, file.originalname);
        form.append('caseID', caseID);

        try {
          const uploadResp = await axios.post(`${API_BASE}/documents/upload`, form, {
            headers: { 'Authorization': `Bearer ${token}`, ...form.getHeaders() },
            httpsAgent: new https.Agent({ rejectUnauthorized: false })
          });
          uploaded.push({ name: file.originalname, success: true, info: uploadResp.data });
        } catch (err) {
          uploaded.push({ name: file.originalname, success: false, info: err.response?.data || err.message });
        }
      }
    }

    res.json({ success: true, contact: contactJson, case: caseJson, uploads: uploaded });
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data || err.message });
  }
});

// 3️⃣ Serve index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
