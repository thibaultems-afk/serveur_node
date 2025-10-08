const express = require('express');
const axios = require('axios');
const querystring = require('querystring');
require('dotenv').config();

const app = express();
const port = 3000;

// ⚠️ Remplis ces valeurs depuis ton client Kleos
const clientId = process.env.CLIENT_ID; // ex: KleosFR.webpage_FormationThibault
const clientSecret = process.env.CLIENT_SECRET; // si applicable
const redirectUri = 'http://localhost:3000/callback'; // doit matcher ce que Kleos a enregistré
const kleosAuthUrl = 'https://ids.kleosapp.com/KLEOSIDENTITYv4/connect/authorize';
const kleosTokenUrl = 'https://ids.kleosapp.com/KLEOSIDENTITYv4/connect/token';
const kleosApiUrl = 'https://kleosapp.api.wolterskluwer.cloud/api';

// --- étape 1 : redirection pour autorisation ---
app.get('/login', (req, res) => {
    const params = querystring.stringify({
        client_id: clientId,
        response_type: 'code',
        scope: 'openid profile email kleosLegalApiClient', // à adapter selon Kleos
        redirect_uri: redirectUri
    });
    res.redirect(`${kleosAuthUrl}?${params}`);
});

// --- étape 2 : callback OAuth ---
app.get('/callback', async (req, res) => {
    const code = req.query.code;
    if (!code) return res.send('Erreur : code manquant');

    try {
        // échange du code contre un access token
        const response = await axios.post(kleosTokenUrl, querystring.stringify({
            grant_type: 'authorization_code',
            code,
            redirect_uri: redirectUri,
            client_id: clientId,
            client_secret: clientSecret // si ton client en a besoin
        }), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        const { access_token } = response.data;
        res.send(`Token obtenu : <pre>${JSON.stringify(response.data, null, 2)}</pre>`);
    } catch (err) {
        console.error(err.response?.data || err);
        res.send(`Erreur lors de la récupération du token : ${err.response?.data?.error}`);
    }
});

// --- étape 3 : exemple d'appel API Kleos ---
app.get('/cases', async (req, res) => {
    const token = req.query.token; // récupéré depuis l'étape 2
    if (!token) return res.send('Token manquant');

    try {
        const response = await axios.get(`${kleosApiUrl}/cases`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        res.json(response.data);
    } catch (err) {
        console.error(err.response?.data || err);
        res.send(`Erreur lors de l'appel à l'API : ${err.response?.data?.error}`);
    }
});

app.listen(port, () => console.log(`Server running on http://localhost:${port}`));
