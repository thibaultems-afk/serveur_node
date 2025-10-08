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

// ---------------- Fonction utilitaire ----------------
function getCountryName(code) {
const countries = [
  { code: 'AF', name: 'Afghanistan' },
  { code: 'AL', name: 'Albanie' },
  { code: 'DZ', name: 'Algérie' },
  { code: 'AS', name: 'Samoa américaines' },
  { code: 'AD', name: 'Andorre' },
  { code: 'AO', name: 'Angola' },
  { code: 'AI', name: 'Anguilla' },
  { code: 'AQ', name: 'Antarctique' },
  { code: 'AG', name: 'Antigua-et-Barbuda' },
  { code: 'AR', name: 'Argentine' },
  { code: 'AM', name: 'Arménie' },
  { code: 'AW', name: 'Aruba' },
  { code: 'AU', name: 'Australie' },
  { code: 'AT', name: 'Autriche' },
  { code: 'AZ', name: 'Azerbaïdjan' },
  { code: 'BS', name: 'Bahamas' },
  { code: 'BH', name: 'Bahreïn' },
  { code: 'BD', name: 'Bangladesh' },
  { code: 'BB', name: 'Barbade' },
  { code: 'BY', name: 'Biélorussie' },
  { code: 'BE', name: 'Belgique' },
  { code: 'BZ', name: 'Belize' },
  { code: 'BJ', name: 'Bénin' },
  { code: 'BM', name: 'Bermudes' },
  { code: 'BT', name: 'Bhoutan' },
  { code: 'BO', name: 'Bolivie' },
  { code: 'BA', name: 'Bosnie-Herzégovine' },
  { code: 'BW', name: 'Botswana' },
  { code: 'BR', name: 'Brésil' },
  { code: 'BN', name: 'Brunei' },
  { code: 'BG', name: 'Bulgarie' },
  { code: 'BF', name: 'Burkina Faso' },
  { code: 'BI', name: 'Burundi' },
  { code: 'CV', name: 'Cap-Vert' },
  { code: 'KH', name: 'Cambodge' },
  { code: 'CM', name: 'Cameroun' },
  { code: 'CA', name: 'Canada' },
  { code: 'KY', name: 'Îles Caïmans' },
  { code: 'CF', name: 'République centrafricaine' },
  { code: 'TD', name: 'Tchad' },
  { code: 'CL', name: 'Chili' },
  { code: 'CN', name: 'Chine' },
  { code: 'CX', name: 'Île Christmas' },
  { code: 'CC', name: 'Îles Cocos' },
  { code: 'CO', name: 'Colombie' },
  { code: 'KM', name: 'Comores' },
  { code: 'CG', name: 'Congo' },
  { code: 'CD', name: 'République démocratique du Congo' },
  { code: 'CK', name: 'Îles Cook' },
  { code: 'CR', name: 'Costa Rica' },
  { code: 'CI', name: 'Côte d’Ivoire' },
  { code: 'HR', name: 'Croatie' },
  { code: 'CU', name: 'Cuba' },
  { code: 'CY', name: 'Chypre' },
  { code: 'CZ', name: 'République tchèque' },
  { code: 'DK', name: 'Danemark' },
  { code: 'DJ', name: 'Djibouti' },
  { code: 'DM', name: 'Dominique' },
  { code: 'DO', name: 'République dominicaine' },
  { code: 'EC', name: 'Équateur' },
  { code: 'EG', name: 'Égypte' },
  { code: 'SV', name: 'Salvador' },
  { code: 'GQ', name: 'Guinée équatoriale' },
  { code: 'ER', name: 'Érythrée' },
  { code: 'EE', name: 'Estonie' },
  { code: 'SZ', name: 'Eswatini' },
  { code: 'ET', name: 'Éthiopie' },
  { code: 'FK', name: 'Îles Falkland' },
  { code: 'FO', name: 'Îles Féroé' },
  { code: 'FJ', name: 'Fidji' },
  { code: 'FI', name: 'Finlande' },
  { code: 'FR', name: 'France' },
  { code: 'GF', name: 'Guyane française' },
  { code: 'PF', name: 'Polynésie française' },
  { code: 'TF', name: 'Terres australes françaises' },
  { code: 'GA', name: 'Gabon' },
  { code: 'GM', name: 'Gambie' },
  { code: 'GE', name: 'Géorgie' },
  { code: 'DE', name: 'Allemagne' },
  { code: 'GH', name: 'Ghana' },
  { code: 'GI', name: 'Gibraltar' },
  { code: 'GR', name: 'Grèce' },
  { code: 'GL', name: 'Groenland' },
  { code: 'GD', name: 'Grenade' },
  { code: 'GP', name: 'Guadeloupe' },
  { code: 'GU', name: 'Guam' },
  { code: 'GT', name: 'Guatemala' },
  { code: 'GG', name: 'Guernesey' },
  { code: 'GN', name: 'Guinée' },
  { code: 'GW', name: 'Guinée-Bissau' },
  { code: 'GY', name: 'Guyana' },
  { code: 'HT', name: 'Haïti' },
  { code: 'HN', name: 'Honduras' },
  { code: 'HK', name: 'Hong Kong' },
  { code: 'HU', name: 'Hongrie' },
  { code: 'IS', name: 'Islande' },
  { code: 'IN', name: 'Inde' },
  { code: 'ID', name: 'Indonésie' },
  { code: 'IR', name: 'Iran' },
  { code: 'IQ', name: 'Irak' },
  { code: 'IE', name: 'Irlande' },
  { code: 'IM', name: 'Île de Man' },
  { code: 'IL', name: 'Israël' },
  { code: 'IT', name: 'Italie' },
  { code: 'JM', name: 'Jamaïque' },
  { code: 'JP', name: 'Japon' },
  { code: 'JE', name: 'Jersey' },
  { code: 'JO', name: 'Jordanie' },
  { code: 'KZ', name: 'Kazakhstan' },
  { code: 'KE', name: 'Kenya' },
  { code: 'KI', name: 'Kiribati' },
  { code: 'KW', name: 'Koweït' },
  { code: 'KG', name: 'Kirghizistan' },
  { code: 'LA', name: 'Laos' },
  { code: 'LV', name: 'Lettonie' },
  { code: 'LB', name: 'Liban' },
  { code: 'LS', name: 'Lesotho' },
  { code: 'LR', name: 'Libéria' },
  { code: 'LY', name: 'Libye' },
  { code: 'LI', name: 'Liechtenstein' },
  { code: 'LT', name: 'Lituanie' },
  { code: 'LU', name: 'Luxembourg' },
  { code: 'MO', name: 'Macao' },
  { code: 'MG', name: 'Madagascar' },
  { code: 'MW', name: 'Malawi' },
  { code: 'MY', name: 'Malaisie' },
  { code: 'MV', name: 'Maldives' },
  { code: 'ML', name: 'Mali' },
  { code: 'MT', name: 'Malte' },
  { code: 'MH', name: 'Îles Marshall' },
  { code: 'MQ', name: 'Martinique' },
  { code: 'MR', name: 'Mauritanie' },
  { code: 'MU', name: 'Maurice' },
  { code: 'YT', name: 'Mayotte' },
  { code: 'MX', name: 'Mexique' },
  { code: 'FM', name: 'Micronésie' },
  { code: 'MD', name: 'Moldavie' },
  { code: 'MC', name: 'Monaco' },
  { code: 'MN', name: 'Mongolie' },
  { code: 'ME', name: 'Monténégro' },
  { code: 'MS', name: 'Montserrat' },
  { code: 'MA', name: 'Maroc' },
  { code: 'MZ', name: 'Mozambique' },
  { code: 'MM', name: 'Myanmar' },
  { code: 'NA', name: 'Namibie' },
  { code: 'NR', name: 'Nauru' },
  { code: 'NP', name: 'Népal' },
  { code: 'NL', name: 'Pays-Bas' },
  { code: 'NC', name: 'Nouvelle-Calédonie' },
  { code: 'NZ', name: 'Nouvelle-Zélande' },
  { code: 'NI', name: 'Nicaragua' },
  { code: 'NE', name: 'Niger' },
  { code: 'NG', name: 'Nigeria' },
  { code: 'NU', name: 'Niue' },
  { code: 'NF', name: 'Île Norfolk' },
  { code: 'KP', name: 'Corée du Nord' },
  { code: 'MK', name: 'Macédoine du Nord' },
  { code: 'MP', name: 'Îles Mariannes du Nord' },
  { code: 'NO', name: 'Norvège' },
  { code: 'OM', name: 'Oman' },
  { code: 'PK', name: 'Pakistan' },
  { code: 'PW', name: 'Palaos' },
  { code: 'PS', name: 'Palestine' },
  { code: 'PA', name: 'Panama' },
  { code: 'PG', name: 'Papouasie-Nouvelle-Guinée' },
  { code: 'PY', name: 'Paraguay' },
  { code: 'PE', name: 'Pérou' },
  { code: 'PH', name: 'Philippines' },
  { code: 'PL', name: 'Pologne' },
  { code: 'PT', name: 'Portugal' },
  { code: 'PR', name: 'Porto Rico' },
  { code: 'QA', name: 'Qatar' },
  { code: 'RE', name: 'Réunion' },
  { code: 'RO', name: 'Roumanie' },
  { code: 'RU', name: 'Russie' },
  { code: 'RW', name: 'Rwanda' },
  { code: 'BL', name: 'Saint-Barthélemy' },
  { code: 'SH', name: 'Sainte-Hélène' },
  { code: 'KN', name: 'Saint-Kitts-et-Nevis' },
  { code: 'LC', name: 'Sainte-Lucie' },
  { code: 'MF', name: 'Saint-Martin' },
  { code: 'PM', name: 'Saint-Pierre-et-Miquelon' },
  { code: 'VC', name: 'Saint-Vincent-et-les-Grenadines' },
  { code: 'WS', name: 'Samoa' },
  { code: 'SM', name: 'Saint-Marin' },
  { code: 'ST', name: 'Sao Tomé-et-Principe' },
  { code: 'SA', name: 'Arabie Saoudite' },
  { code: 'SN', name: 'Sénégal' },
  { code: 'RS', name: 'Serbie' },
  { code: 'SC', name: 'Seychelles' },
  { code: 'SL', name: 'Sierra Leone' },
  { code: 'SG', name: 'Singapour' },
  { code: 'SX', name: 'Saint-Martin (Pays-Bas)' },
  { code: 'SK', name: 'Slovaquie' },
  { code: 'SI', name: 'Slovénie' },
  { code: 'SB', name: 'Îles Salomon' },
  { code: 'SO', name: 'Somalie' },
  { code: 'ZA', name: 'Afrique du Sud' },
  { code: 'KR', name: 'Corée du Sud' },
  { code: 'SS', name: 'Soudan du Sud' },
  { code: 'ES', name: 'Espagne' },
  { code: 'LK', name: 'Sri Lanka' },
  { code: 'SD', name: 'Soudan' },
  { code: 'SR', name: 'Suriname' },
  { code: 'SJ', name: 'Svalbard et Jan Mayen' },
  { code: 'SE', name: 'Suède' },
  { code: 'CH', name: 'Suisse' },
  { code: 'SY', name: 'Syrie' },
  { code: 'TW', name: 'Taïwan' },
  { code: 'TJ', name: 'Tadjikistan' },
  { code: 'TZ', name: 'Tanzanie' },
  { code: 'TH', name: 'Thaïlande' },
  { code: 'TL', name: 'Timor-Leste' },
  { code: 'TG', name: 'Togo' },
  { code: 'TK', name: 'Tokelau' },
  { code: 'TO', name: 'Tonga' },
  { code: 'TT', name: 'Trinité-et-Tobago' },
  { code: 'TN', name: 'Tunisie' },
  { code: 'TR', name: 'Turquie' },
  { code: 'TM', name: 'Turkménistan' },
  { code: 'TC', name: 'Îles Turks-et-Caïcos' },
  { code: 'TV', name: 'Tuvalu' },
  { code: 'UG', name: 'Ouganda' },
  { code: 'UA', name: 'Ukraine' },
  { code: 'AE', name: 'Émirats arabes unis' },
  { code: 'GB', name: 'Royaume-Uni' },
  { code: 'US', name: 'États-Unis' },
  { code: 'UY', name: 'Uruguay' },
  { code: 'UZ', name: 'Ouzbékistan' },
  { code: 'VU', name: 'Vanuatu' },
  { code: 'VA', name: 'Vatican' },
  { code: 'VE', name: 'Venezuela' },
  { code: 'VN', name: 'Viêt Nam' },
  { code: 'WF', name: 'Wallis-et-Futuna' },
  { code: 'EH', name: 'Sahara occidental' },
  { code: 'YE', name: 'Yémen' },
  { code: 'ZM', name: 'Zambie' },
  { code: 'ZW', name: 'Zimbabwe' }
];
  const c = countries.find(c => c.code === code);
  return c ? c.name : code;
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
      contactType,
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
      email: email,
      type: contactType,
      reference: `${nom}_${prenom}_${Date.now()}`,
      mainAddress: {
        address1: street,
        town: city,
        zipCode: postalCode,
        countryCode: country,           	// Code ISO (FR)
        country: getCountryName(country) 	// Nom complet (France)
      } 
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
