export const config = {
    runtime: 'edge', 
};

export default async function handler(req) {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 200, headers });
    }

    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
    }

    const apiKey = process.env.DIFY_API_KEY;
    if (!apiKey) {
        return new Response(JSON.stringify({ error: 'DIFY_API_KEY saknas på Vercel-servern!' }), { status: 500, headers });
    }

    try {
        const { query, conversation_id } = await req.json();

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
            return new Response(JSON.stringify({ error: `Dify error: ${errorText}` }), { status: difyResponse.status, headers });
        }

        const streamHeaders = {
            ...headers,
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        };

        return new Response(difyResponse.body, {
            status: 200,
            headers: streamHeaders,
        });

    } catch (error) {
        return new Response(JSON.stringify({ error: 'Internt serverfel på Vercel' }), { status: 500, headers });
    }
}
