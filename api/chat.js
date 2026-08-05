// Vi använder require istället för import eftersom Vercel vill ha CommonJS
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

module.exports = async function handler(req, res) {
    // Sätt CORS-headers direkt på det gamla hederliga viset
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const apiKey = process.env.DIFY_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'API key is missing on server' });
    }

    try {
        // I vanlig Node.js kan req.body ibland behöva parsas om det är en sträng
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        const { query, conversation_id } = body;

        const difyResponse = await fetch('https://dify.ai', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                inputs: {},
                query: query,
                user: "portfolio_visitor",
                response_mode: "streaming",
                conversation_id: conversation_id || ""
            })
        });

        if (!difyResponse.ok) {
            return res.status(difyResponse.status).json({ error: 'Dify error' });
        }

        // Sätt headers för strömning i Node.js
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        // Strömma datan bit för bit direkt till webbläsaren
        difyResponse.body.on('data', (chunk) => {
            res.write(chunk);
        });

        difyResponse.body.on('end', () => {
            res.end();
        });

    } catch (error) {
        return res.status(500).json({ error: 'Internal Server Error' });
    }
};
