const API_URL = "https://jimkollevik-github-io.vercel.app/api/chat";

let conversationId = "";


/**
 * Send message when pressing Enter
 */
function handleKeyPress(event) {
    if (event.key === "Enter") {
        handleSend();
    }
}


/**
 * Send predefined suggestion
 */
function sendSuggestion(text) {
    document.getElementById("user-input").value = text;
    handleSend();

    document.getElementById("suggestions").style.display = "none";
}


/**
 * Send user message to AI agent
 */
async function handleSend() {

    const inputField = document.getElementById("user-input");
    const query = inputField.value.trim();


    if (!query) {
        return;
    }


    inputField.value = "";


    // Render user message
    appendMessage(query, "user");


    // Create empty AI response container
    const agentMessageDiv = appendMessage("", "agent");

    agentMessageDiv.innerText = "Thinking...";


    try {

        const response = await fetch(API_URL, {

            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                query,
                conversation_id: conversationId
            })
        });



        if (!response.ok) {

            const errorText = await response.text();

            throw new Error(errorText);
        }



        agentMessageDiv.innerText = "";


        await readStream(
            response,
            agentMessageDiv
        );


    } catch (error) {

        console.error(
            "Chat error:",
            error
        );


        agentMessageDiv.innerText =
            "Could not retrieve response. Error: " +
            error.message;
    }
}



/**
 * Read Server Sent Events stream from Dify
 */
async function readStream(
    response,
    messageElement
) {


    const reader = response.body.getReader();

    const decoder = new TextDecoder("utf-8");


    let buffer = "";



    while (true) {


        const {
            done,
            value
        } = await reader.read();



        if (done) {
            break;
        }



        buffer += decoder.decode(
            value,
            {
                stream: true
            }
        );



        const events = buffer.split("\n\n");


        buffer = events.pop();



        for (const event of events) {


            const dataLine = event
                .split("\n")
                .find(line =>
                    line.startsWith("data:")
                );



            if (!dataLine) {
                continue;
            }



            const json = dataLine
                .replace("data:", "")
                .trim();



            try {


                const parsed = JSON.parse(json);



                if (parsed.conversation_id) {

                    conversationId =
                        parsed.conversation_id;
                }



                if (
                    parsed.event === "message" &&
                    parsed.answer
                ) {

                    messageElement.innerText +=
                        parsed.answer;


                    scrollChat();
                }



            } catch (error) {

                console.warn(
                    "Could not parse SSE event",
                    error
                );
            }
        }
    }
}



/**
 * Add message bubble to chat
 */
function appendMessage(
    text,
    sender
) {


    const chatBox =
        document.getElementById("chat-box");


    const message =
        document.createElement("div");


    message.classList.add(
        "message",
        sender
    );


    message.innerText = text;


    chatBox.appendChild(message);


    scrollChat();


    return message;
}



/**
 * Keep chat scrolled to latest message
 */
function scrollChat() {

    const chatBox =
        document.getElementById("chat-box");


    chatBox.scrollTop =
        chatBox.scrollHeight;
}