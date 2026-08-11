const MAX_QUERY_LENGTH = 800;
const MAX_CONVERSATION_ID_LENGTH = 128;
const MAX_RESPONSE_BYTES = 64 * 1024;
const DIFY_TIMEOUT_MS = 30_000;

const ALLOWED_ORIGINS = new Set([
    "https://jimkollevik.com",
    "https://www.jimkollevik.com",
    "https://jimkollevik-github-io.vercel.app"
]);

function applySecurityHeaders(res) {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-Robots-Tag", "noindex, nofollow");
}

function applyCorsHeaders(req, res) {
    const origin = req.headers.origin;

    if (!origin || !ALLOWED_ORIGINS.has(origin)) {
        return false;
    }

    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Max-Age", "86400");
    res.setHeader("Vary", "Origin");

    return true;
}

function sendError(res, status, message) {
    return res.status(status).json({ error: message });
}

function isValidConversationId(value) {
    return (
        value === undefined ||
        value === null ||
        value === "" ||
        (
            typeof value === "string" &&
            value.length <= MAX_CONVERSATION_ID_LENGTH &&
            /^[a-zA-Z0-9_-]+$/.test(value)
        )
    );
}

export default async function handler(req, res) {
    applySecurityHeaders(res);

    const isAllowedOrigin = applyCorsHeaders(req, res);

    if (req.method === "OPTIONS") {
        return isAllowedOrigin
            ? res.status(204).end()
            : sendError(res, 403, "Origin not allowed");
    }

    if (req.method !== "POST") {
        res.setHeader("Allow", "POST, OPTIONS");
        return sendError(res, 405, "Method not allowed");
    }

    if (!isAllowedOrigin) {
        return sendError(res, 403, "Origin not allowed");
    }

    const contentType = req.headers["content-type"] || "";

    if (!contentType.toLowerCase().startsWith("application/json")) {
        return sendError(res, 415, "Content-Type must be application/json");
    }

    const body = req.body;

    if (!body || typeof body !== "object" || Array.isArray(body)) {
        return sendError(res, 400, "Invalid request body");
    }

    const { query, conversation_id: conversationId } = body;

    if (typeof query !== "string" || !query.trim()) {
        return sendError(res, 400, "Please enter a question");
    }

    if (query.length > MAX_QUERY_LENGTH) {
        return sendError(
            res,
            413,
            `Questions can contain at most ${MAX_QUERY_LENGTH} characters`
        );
    }

    if (!isValidConversationId(conversationId)) {
        return sendError(res, 400, "Invalid conversation identifier");
    }

    const apiKey = process.env.DIFY_API_KEY;

    if (!apiKey) {
        return sendError(res, 503, "The chat is temporarily unavailable");
    }

    const payload = {
        inputs: {},
        query: query.trim(),
        response_mode: "streaming",
        user: "portfolio_visitor"
    };

    if (conversationId) {
        payload.conversation_id = conversationId;
    }

    const controller = new AbortController();
    const timeout = setTimeout(
        () => controller.abort(),
        DIFY_TIMEOUT_MS
    );

    try {
        const difyResponse = await fetch(
            "https://api.dify.ai/v1/chat-messages",
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload),
                signal: controller.signal
            }
        );

        if (!difyResponse.ok || !difyResponse.body) {
            return sendError(res, 502, "The chat service could not answer right now");
        }

        res.writeHead(200, {
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-cache, no-store, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        });

        const reader = difyResponse.body.getReader();
        let responseBytes = 0;

        while (true) {
            const { done, value } = await reader.read();

            if (done) {
                break;
            }

            responseBytes += value.byteLength;

            if (responseBytes > MAX_RESPONSE_BYTES) {
                controller.abort();
                break;
            }

            res.write(Buffer.from(value));
        }

        return res.end();
    } catch (error) {
        if (res.headersSent) {
            return res.end();
        }

        if (error?.name === "AbortError") {
            return sendError(res, 504, "The chat request took too long");
        }

        return sendError(res, 502, "The chat service could not answer right now");
    } finally {
        clearTimeout(timeout);
    }
}
