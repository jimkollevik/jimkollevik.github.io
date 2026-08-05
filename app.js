const API_URL = '/api/chat';
let conversationId = "";

function handleKeyPress(e) {
    if (e.key === 'Enter') handleSend();
}

function sendSuggestion(text) {
    document.getElementById('user-input').value = text;
    handleSend();
    document.getElementById('suggestions').style.display = 'none'; 
}

async function handleSend() {
    const inputField = document.getElementById('user-input');
    const query = inputField.value.trim();
    if (!query) return;

    inputField.value = '';
    appendMessage(query, 'user');
    const agentMessageDiv = appendMessage('', 'agent');

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                query: query,
                conversation_id: conversationId
            })
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || "Serverfel");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop(); // Spara ofullständig rad

            for (const line of lines) {
                if (line.startsWith('data:')) {
                    try {
                        const parsed = JSON.parse(line.slice(5));
                        
                        if (parsed.conversation_id) {
                            conversationId = parsed.conversation_id; 
                        }

                        if (parsed.event === 'message' && parsed.answer) {
                            agentMessageDiv.innerText += parsed.answer;
                            const chatBox = document.getElementById('chat-box');
                            chatBox.scrollTop = chatBox.scrollHeight;
                        }
                    } catch (e) {
                        // Ignorera ofullständiga JSON-rader
                    }
                }
            }
        }
    } catch (error) {
        console.error("Detekterat fel:", error);
        agentMessageDiv.innerText = `Kunde inte hämta svar: ${error.message}`;
    }
}

function appendMessage(text, sender) {
    const chatBox = document.getElementById('chat-box');
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('message', sender);
    msgDiv.innerText = text;
    chatBox.appendChild(msgDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
    return msgDiv;
}
