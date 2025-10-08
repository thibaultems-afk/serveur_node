require('dotenv').config();
const express = require('express');
const axios = require('axios');
const FormData = require('form-data');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const https = require('https');
const { Readable } = require('stream');
const { getCountryName } = require('./utils/countries');

const app = express();
const upload = multer();

const PORT = process.env.PORT || 3000;
const TOKEN_URL = process.env.KLEOS_TOKEN_URL;
const API_BASE = process.env.KLEOS_API_BASE;
const CLIENT_ID = process.env.KLEOS_CLIENT_ID;
const CLIENT_SECRET = process.env.KLEOS_CLIENT_SECRET;
const SCOPES = process.env.KLEOS_SCOPES || 'kleosStateful kleosLegal kleosLegalApiClient';

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

// ---------------- SUBMIT CASE ----------------
app.post('/api/submit-case', upload.array('documents'), async (req, res) => {
  try {
    console.log('Fichiers reçus (req.files):', req.files.map(f => ({
      originalname: f.originalname,
      mimetype: f.mimetype,
      size: f.size
    })));

    const token = await getToken();
    const { nom, prenom, gender, email, formeJuridique, phone, contactType, street, city, postalCode, country, typeId } = req.body;

    const resolvedTypeId = typeId || '59';

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
    console.log('Contact créé (resp):', contactResp.data);
    const identityID = contactResp.data.result;

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
    console.log('Case créé (resp):', caseResp.data);

    const caseID = caseResp.data.result?.id || caseResp.data.result;
    if (!caseID) {
      console.error('❌ Aucun caseID retourné, arrêt.');
      return res.status(500).json({ error: 'Case creation failed', case: caseResp.data });
    }
    console.log(`✅ CaseID utilisé pour les documents: ${caseID}`);

    // ---------------- UPLOAD DOCUMENTS ----------------
    const folderId = 21; // On force l'upload dans le folder ID 21
    const uploaded = [];

    if (req.files && req.files.length) {
      for (const file of req.files) {
        try {
          const sanitizedFilename = file.originalname.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          console.log(`➡️ Upload du fichier "${sanitizedFilename}" vers le folder ID: ${folderId}`);

          const docPayload = {
            id: 0,
            title: sanitizedFilename,
            description: '',
            caseId: parseInt(caseID),
            folderId,
            readOnly: false,
            creationDate: new Date().toISOString()
          };

          // Création d'un stream pour le JSON
          const jsonStream = new Readable();
          jsonStream.push(JSON.stringify(docPayload));
          jsonStream.push(null);

          const form = new FormData();
          form.append('document', jsonStream, { filename: 'document.json', contentType: 'application/json' });
          form.append('file', file.buffer, { filename: sanitizedFilename, contentType: file.mimetype });

          console.log('✅ FormData préparé pour upload: document + file');

          const uploadResp = await axios.post(`${API_BASE}/documents/upload`, form, {
            headers: { Authorization: `Bearer ${token}`, ...form.getHeaders() },
            httpsAgent: new https.Agent({ rejectUnauthorized: false })
          });

          console.log('✅ Upload réussi :', uploadResp.data);
          uploaded.push({ name: sanitizedFilename, success: true, info: uploadResp.data });
        } catch (err) {
          console.error('❌ Erreur upload :', err.response?.data || err.message);
          uploaded.push({ name: file.originalname, success: false, info: err.response?.data || err.message });
        }
      }
    }

    res.json({ success: true, contact: contactResp.data, case: caseResp.data, uploads: uploaded });

  } catch (err) {
    console.error('❌ ERREUR GLOBALE:', {
      status: err.response?.status,
      headers: err.response?.headers,
      data: err.response?.data
    });
    res.status(500).json({ error: err.response?.data || err.message });
  }
});

// ---------------- Serve index.html ----------------
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
