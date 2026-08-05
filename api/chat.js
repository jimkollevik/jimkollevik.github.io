export default async function handler(req, res) {
    // Hantera CORS-headers för säkerhets skull
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Säkerställ att API-nyckeln faktiskt finns tillgänglig i Vercel
    const apiKey = process.env.DIFY_API_KEY;
    if (!apiKey) {
        console.error("FEL: Miljövariabeln DIFY_API_KEY saknas i Vercel-inställningarna!");
        return res.status(500).json({ error: 'API key is missing on server' });
    }

    try {
        const { query, conversation_id } = req.body;
        console.log(`Skickar fråga till Dify: "${query}" med kontext-ID: "${conversation_id || 'ny'}"`);

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
            const errorText = await difyResponse.text();
            console.error(`Dify API svarade med felkod ${difyResponse.status}:`, errorText);
            return res.status(difyResponse.status).json({ error: 'Fel från Dify API' });
        }

        // Sätt rätt headers för att webbläsaren ska fatta att det är en textström
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        // Överför Dify-strömmen direkt till Vercel-svaret (detta är säkrare på Vercel)
        const responseStream = difyResponse.body;
        
        // Vi läser av strömmen och skickar vidare direkt till frontend
        for await (const chunk of responseStream) {
            res.write(chunk);
        }
        
        res.end();

    } catch (error) {
        console.error("Internt serverfel i Vercel-funktionen:", error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}
