const API_URL = '/api/chat';
let conversationId = "";

function handleKeyPress(e) {
    if (e.key === 'Enter') handleSend();
}

function sendSuggestion(text) {
    document.getElementById('user-input').value = text;
    handleSend();
    // Döljer förslagen efter första klicket för att rensa spelytan
    document.getElementById('suggestions').style.display = 'none'; 
}

async function handleSend() {
    const inputField = document.getElementById('user-input');
    const query = inputField.value.trim();
    if (!query) return;

    inputField.value = '';

    // 1. Rendera användarens text i UI
    appendMessage(query, 'user');

    // 2. Skapa en tom bubbla för agentens strömmande svar
    const agentMessageDiv = appendMessage('', 'agent');
    agentMessageDiv.innerText = "Tänker...";

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                query: query,
                conversation_id: conversationId // Skickas med för att hålla minnet vid liv
            })
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || "Okänt serverfel");
        }

        // Rensa bort "Tänker..." då strömmen har startat
        agentMessageDiv.innerText = "";

        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = '';

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; // Spara sista raden om den är delad

            for (const line of lines) {
                const cleanLine = line.trim();
                if (cleanLine.startsWith('data:')) {
                    try {
                        const parsed = JSON.parse(cleanLine.slice(5).trim());
                        
                        // Sparar conversation_id från första paketet för nästa fråga
                        if (parsed.conversation_id) {
                            conversationId = parsed.conversation_id; 
                        }

                        // Om raden innehåller text (answer), strömma ut den i gränssnittet
                        if (parsed.event === 'message' && parsed.answer) {
                            agentMessageDiv.innerText += parsed.answer;
                            
                            // Scrolla ner automatiskt under pågående streaming
                            const chatBox = document.getElementById('chat-box');
                            chatBox.scrollTop = chatBox.scrollHeight;
                        }
                    } catch (e) {
                        // Ignorera ljudlöst om något oväntat skulle hända
                    }
                }
            }
        }
    } catch (error) {
        console.error("Fel fångat i frontend:", error);
        agentMessageDiv.innerText = `Kunde inte hämta svar. Felmeddelande: ${error.message}`;
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
