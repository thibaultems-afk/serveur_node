require('dotenv').config();
const express = require('express');
const axios = require('axios');
const FormData = require('form-data');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const https = require('https');
const { countries, getCountryName } = require('./utils/countries');

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

// 1️⃣ Route pour les pays
app.get('/api/countries', (req, res) => {
  try {
    res.json(countries); // renvoie la liste complète depuis utils/countries.js
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Impossible de charger la liste des pays' });
  }
});

// 2️⃣ Route pour les types de dossier
app.get('/api/case-types', async (req, res) => {
  try {
    const token = await getToken();
    const response = await axios.get(`${API_BASE}/caseTypes`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      httpsAgent: new https.Agent({ rejectUnauthorized: false })
    });
    res.json(response.data.result.items);
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data || err.message });
  }
});

// 3️⃣ Contacts avec countryCode + country
app.get('/api/contacts', async (req, res) => {
  try {
    const token = await getToken();
    const response = await axios.get(`${API_BASE}/contacts`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      httpsAgent: new https.Agent({ rejectUnauthorized: false })
    });

    const contacts = response.data.result.items || [];
    const countriesList = contacts
      .map(c => {
        const addr = c.mainAddress;
        if (addr?.countryCode && addr?.country) {
          return { code: addr.countryCode, name: addr.country };
        }
        return null;
      })
      .filter(Boolean);

    const uniqueCountries = [];
    const seen = new Set();
    for (const c of countriesList) {
      if (!seen.has(c.code)) {
        seen.add(c.code);
        uniqueCountries.push(c);
      }
    }

    res.json(uniqueCountries);
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data || err.message });
  }
});

// 4️⃣ Créer contact, dossier et uploader fichiers
app.post('/api/submit-case', upload.array('documents'), async (req, res) => {
  try {
    console.log('Fichiers reçus:', req.files.map(f => ({ name: f.originalname, size: f.size })));

    const token = await getToken();
    const {
      nom, prenom, gender, email, formeJuridique, phone,
      contactType, street, city, postalCode, country, typeId
    } = req.body;

    const resolvedTypeId = typeId || '59';

    // Création contact
    const contactPayload = {
      firstName: prenom,
      lastName: nom,
      gender,
      email,
      legalForm: formeJuridique,
      phoneNumber: phone,
      type: contactType,
      typeId: resolvedTypeId,
      mainAddress: {
        address1: street,
        town: city,
        zipCode: postalCode,
        countryCode: country,
        country: getCountryName(country)
      }
    };
    console.log('Contact payload:', contactPayload);

    const contactResp = await axios.put(`${API_BASE}/contacts`, contactPayload, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json-patch+json', Accept: 'application/json' },
      httpsAgent: new https.Agent({ rejectUnauthorized: false })
    });
    console.log('Contact créé:', contactResp.data);
    const identityID = contactResp.data.result;

    // Création dossier
    const now = new Date().toISOString();
    const casePayload = {
      typeId: resolvedTypeId,
      title: `${nom} ${prenom}`,
      name: `${nom} ${prenom}`,
      creationDate: now,
      reference: `${nom}_${prenom}_${Date.now()}`,
      externalParties: [{ identityId: identityID, typeCode: 'POU', reference: '' }]
    };
    console.log('Case payload:', casePayload);

    const caseResp = await axios.put(`${API_BASE}/cases`, casePayload, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      httpsAgent: new https.Agent({ rejectUnauthorized: false })
    });
    console.log('Case créé:', caseResp.data);

    const caseID = caseResp.data.result?.id || caseResp.data.result;
    if (!caseID) return res.status(500).json({ error: 'Case creation failed', case: caseResp.data });

    // Upload des documents dans le folder fixe
    const folderId = 21;
    const uploaded = [];
    if (req.files && req.files.length) {
      for (const file of req.files) {
        try {
          const sanitizedFilename = file.originalname.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          const docPayload = {
            id: 0,
            title: sanitizedFilename,
            description: '',
            caseId: parseInt(caseID),
            folderId,
            readOnly: false,
            creationDate: new Date().toISOString()
          };
          const form = new FormData();
          form.append('document', JSON.stringify(docPayload), { contentType: 'application/json', filename: 'document.json' });
          form.append('file', file.buffer, { filename: sanitizedFilename, contentType: file.mimetype });

          const uploadResp = await axios.post(`${API_BASE}/documents/upload`, form, {
            headers: { Authorization: `Bearer ${token}`, ...form.getHeaders() },
            httpsAgent: new https.Agent({ rejectUnauthorized: false })
          });
          uploaded.push({ name: sanitizedFilename, success: true, info: uploadResp.data });
        } catch (err) {
          uploaded.push({ name: file.originalname, success: false, info: err.response?.data || err.message });
        }
      }
    }

    res.json({ success: true, contact: contactResp.data, case: caseResp.data, uploads: uploaded });

  } catch (err) {
    console.error('Erreur globale:', err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data || err.message });
  }
});

// ---------------- Serve index.html ----------------
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
