require('dotenv').config();
const express = require('express');
const axios = require('axios');
const FormData = require('form-data');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const https = require('https');
const { getCountryName } = require('./utils/countries');

const app = express();
const upload = multer();

const PORT = process.env.PORT || 3000;
const TOKEN_URL = process.env.KLEOS_TOKEN_URL;
const API_BASE = process.env.KLEOS_API_BASE; // ex: https://kleosapp.api.wolterskluwer.cloud/api
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

  try {
    const res = await axios.post(TOKEN_URL, params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      httpsAgent: new https.Agent({ rejectUnauthorized: false }) // ok en dev, retire en prod
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

// ---------------- UTILITAIRES FOLDER ----------------
async function getDocumentFolders(caseId) {
  const token = await getToken();
  try {
    const res = await axios.get(`${API_BASE}/documentfolders/${caseId}?maxLevels=10`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      httpsAgent: new https.Agent({ rejectUnauthorized: false })
    });
    const folders = res.data.result || [];
    console.log(`Folders récupérés pour case ${caseId}:`, folders.map(f => ({ id: f.id, name: f.name })));
    return folders;
  } catch (err) {
    console.error('Erreur récupération documentfolders :', err.response?.data || err.message);
    throw err;
  }
}

async function createDocumentFolder(caseId, name, parentId = null) {
  const token = await getToken();
  const payload = { caseId: parseInt(caseId), name, parentId };
  try {
    const createRes = await axios.post(`${API_BASE}/documentfolders`, payload, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      httpsAgent: new https.Agent({ rejectUnauthorized: false })
    });
    console.log(`Folder créé via API:`, createRes.data);
    return createRes.data.result?.id;
  } catch (err) {
    console.error('Erreur création folder :', err.response?.data || err.message);
    throw err;
  }
}

async function getOrCreateExternalFolder(caseId) {
  console.log(`Vérification du folder "Documents Externes" pour le case ${caseId}...`);
  const folders = await getDocumentFolders(caseId);
  const existing = folders.find(f => f.name === 'Documents Externes');
  if (existing) {
    console.log(`Folder existant trouvé : "Documents Externes" (ID: ${existing.id})`);
    return existing.id;
  }
  console.log('Folder "Documents Externes" introuvable — création en cours...');
  const newId = await createDocumentFolder(caseId, 'Documents Externes', null);
  console.log(`Folder "Documents Externes" créé, ID: ${newId}`);
  return newId;
}

// ---------------- UTILITY: list documents by case+folder ----------------
async function listDocumentsInFolder(caseId, folderId) {
  const token = await getToken();
  try {
    const res = await axios.get(`${API_BASE}/documents`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      params: { caseId, folderId },
      httpsAgent: new https.Agent({ rejectUnauthorized: false })
    });
    const docs = res.data.result?.items || [];
    console.log(`Documents listés pour case ${caseId} / folder ${folderId}:`, docs.map(d => ({ id: d.id, title: d.title })));
    return docs;
  } catch (err) {
    console.error('Erreur listDocumentsInFolder :', err.response?.data || err.message);
    return [];
  }
}

// ---------------- SUBMIT CASE (REWRITTEN) ----------------
app.post('/api/submit-case', upload.array('documents'), async (req, res) => {
  try {
    console.log('--- Nouvelle requête /api/submit-case ---');
    console.log('Fichiers reçus (req.files):', Array.isArray(req.files) ? req.files.map(f => ({ originalname: f.originalname, mimetype: f.mimetype, size: f.size })) : req.files);

    const token = await getToken();
    const {
      nom, prenom, gender, email, formeJuridique, numintra,
      phone, contactType, street, city, postalCode, country, typeId
    } = req.body;

    const resolvedTypeId = typeId || '59';

    // --- Contact payload ---
    const contactPayload = {
      firstName: prenom,
      lastName: nom,
      gender,
      email,
      legalForm: formeJuridique,
      // vatNumber: numintra, // activate if needed
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
    if (!identityID) {
      console.warn('Aucun identityID retourné à la création du contact, arrêt.');
      return res.status(500).json({ error: 'Contact creation failed', details: contactResp.data });
    }

    // --- Case payload ---
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
    const caseID = caseResp.data.result?.id;
    if (!caseID) {
      console.warn('Aucun caseID retourné, arrêt.');
      return res.status(500).json({ error: 'Case creation failed', details: caseResp.data });
    }

    // --- Folder Documents Externes ---
    let folderId;
    try {
      folderId = await getOrCreateExternalFolder(caseID);
    } catch (err) {
      console.error('Impossible de récupérer/créer Documents Externes :', err);
      return res.status(500).json({ error: 'Folder creation failed', details: err.message || err });
    }
    console.log('Folder utilisé pour upload:', folderId);

    // --- Upload documents (one by one) ---
    const uploaded = [];
    if (!req.files || req.files.length === 0) {
      console.log('Aucun fichier à uploader (req.files vide)');
    } else {
      for (const file of req.files) {
        const sanitizedFilename = file.originalname.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        console.log(`--- Traitement du fichier: ${sanitizedFilename} (${file.mimetype}, ${file.size} bytes)`);

        // Prepare doc JSON exactly as Kleos expects
        const docPayload = {
          id: 0,
          title: sanitizedFilename,
          description: '',
          caseId: parseInt(caseID),
          folderId: folderId,
          readOnly: false,
          creationDate: new Date().toISOString()
        };
        console.log('Document payload (avant envoi):', docPayload);

        // Build multipart formdata, JSON first (no filename on JSON)
        const form = new FormData();
        form.append('document', JSON.stringify(docPayload));
        form.append('file', file.buffer, { filename: sanitizedFilename, contentType: file.mimetype });

        try {
          const uploadResp = await axios.post(`${API_BASE}/documents/upload`, form, {
            headers: { Authorization: `Bearer ${token}`, ...form.getHeaders() },
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
            httpsAgent: new https.Agent({ rejectUnauthorized: false })
          });

          console.log('Réponse upload:', uploadResp.data);
          uploaded.push({ name: sanitizedFilename, success: true, info: uploadResp.data });
        } catch (err) {
          // Log full error info
          console.error('Erreur lors de l\'upload pour', sanitizedFilename, ':', err.response?.status, err.response?.data || err.message);
          uploaded.push({ name: sanitizedFilename, success: false, info: err.response?.data || err.message });
        }
      }
    }

    // --- Vérification finale : lister les documents présents dans le folder (via /documents?caseId=&folderId=) ---
    console.log('Vérification finale : récupération des documents via /documents?caseId=&folderId=');
    let finalDocs = [];
    try {
      finalDocs = await listDocumentsInFolder(caseID, folderId);
      if (finalDocs.length === 0) {
        console.warn('Aucun document listé dans Kleos pour le folder après upload. Vérifier les réponses d\'upload ci-dessus.');
      } else {
        console.log('Documents présents après upload:', finalDocs.map(d => ({ id: d.id, title: d.title })));
      }
    } catch (err) {
      console.error('Erreur lors de la vérification finale des documents :', err);
    }

    // --- Réponse API ---
    return res.json({
      success: true,
      contact: contactResp.data,
      case: caseResp.data,
      uploads: uploaded,
      documentsInFolder: finalDocs
    });

  } catch (err) {
    console.error('Erreur générale submit-case :', err.response?.data || err.message || err);
    return res.status(500).json({ error: err.response?.data || err.message || err });
  }
});

// ---------------- Serve index.html ----------------
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
