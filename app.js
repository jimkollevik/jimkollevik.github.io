const API_URL =
    "https://jimkollevik-github-io.vercel.app/api/chat";

let conversationId = "";
let isSending = false;

const chatBox = document.getElementById("chat-box");
const inputField = document.getElementById("user-input");
const sendButton = document.getElementById("send-button");
const suggestions = document.getElementById("suggestions");
const loadingState = document.getElementById("loading-state");

const loadingMessages = [
    "Looking through my portfolio...",
    "Reviewing relevant experience...",
    "Connecting projects and outcomes..."
];

const typedIntro =
    document.getElementById("typed-intro");

const introText =
    "Hi, I'm Jim. Marketing technology is what I do. Building things is what I enjoy. Instead of scrolling through another portfolio, have a conversation with the AI I built to answer questions about me.";

let loadingMessageTimer = null;
let loadingMessageIndex = 0;

initializeChat();


/* =========================================================
   INITIALIZATION
========================================================= */

function initializeChat() {
    updateSendButton();

    inputField.addEventListener(
        "input",
        handleInput
    );

    inputField.addEventListener(
        "focus",
        () => {
            inputField
                .parentElement
                .classList
                .add("is-focused");
        }
    );

    inputField.addEventListener(
        "blur",
        () => {
            inputField
                .parentElement
                .classList
                .remove("is-focused");
        }
    );
}


function handleInput() {
    updateSendButton();
    resizeInput();
}


/* =========================================================
   KEYBOARD INPUT
========================================================= */

function handleKeyPress(event) {
    if (
        event.key === "Enter" &&
        !event.shiftKey
    ) {
        event.preventDefault();
        handleSend();
    }
}


/* =========================================================
   SUGGESTED QUESTIONS
========================================================= */

function sendSuggestion(text) {
    if (isSending) {
        return;
    }

    inputField.value = text;

    updateSendButton();
    resizeInput();

    inputField.focus();
}


/* =========================================================
   SEND MESSAGE
========================================================= */

async function handleSend() {
    const query =
        inputField.value.trim();

    if (!query || isSending) {
        return;
    }

    isSending = true;

    updateSendButton();
    activateConversationMode();

    appendMessage(
        query,
        "user"
    );

    inputField.value = "";

    updateSendButton();
    resizeInput();

const agentMessage =
    createAgentMessage();

agentMessage.dataset.rawText = "";

    showLoadingState();

    chatBox.classList.add(
        "is-streaming"
    );

    try {
        const response = await fetch(
            API_URL,
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body: JSON.stringify({
                    query,
                    conversation_id:
                        conversationId
                })
            }
        );

        if (!response.ok) {
            const errorText =
                await response.text();

            throw new Error(
                extractErrorMessage(
                    errorText,
                    response.status
                )
            );
        }

        if (!response.body) {
            throw new Error(
                "Streaming is not available in this browser."
            );
        }

        await readEventStream(
            response,
            agentMessage
        );

        if (
            !agentMessage
                .dataset
                .rawText
                .trim()
        ) {
            renderResponse(
                agentMessage,
                "I received an empty response. Please try again."
            );
        }
    } catch (error) {
        console.error(
            "Chat request failed:",
            error
        );

        hideLoadingState();

        agentMessage.classList.add(
            "error"
        );

        renderResponse(
            agentMessage,
            `I could not retrieve a response. ${error.message}`
        );
    } finally {
        isSending = false;

        chatBox.classList.remove(
            "is-streaming"
        );

        updateSendButton();
        scrollChat();

        inputField.focus();
    }
}


/* =========================================================
   CONVERSATION MODE
========================================================= */

function activateConversationMode() {
    document.body.classList.add(
        "is-chatting"
    );
}


/* =========================================================
   DIFY SSE STREAM
========================================================= */

async function readEventStream(
    response,
    messageElement
) {
    const reader =
        response.body.getReader();

    const decoder =
        new TextDecoder("utf-8");

    let buffer = "";

    while (true) {
        const {
            value,
            done
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

        buffer = buffer.replace(
            /\r\n/g,
            "\n"
        );

        const eventBlocks =
            buffer.split("\n\n");

        buffer =
            eventBlocks.pop() || "";

        for (
            const eventBlock
            of eventBlocks
        ) {
            processEventBlock(
                eventBlock,
                messageElement
            );
        }
    }

    buffer += decoder.decode();

    if (buffer.trim()) {
        processEventBlock(
            buffer,
            messageElement
        );
    }
}


/* =========================================================
   PROCESS SSE EVENT
========================================================= */

function processEventBlock(
    eventBlock,
    messageElement
) {
    const dataLines = eventBlock
        .split("\n")
        .filter(
            line =>
                line.startsWith("data:")
        )
        .map(
            line =>
                line.slice(5).trim()
        );

    if (dataLines.length === 0) {
        return;
    }

    const payloadText =
        dataLines.join("\n");

    if (
        !payloadText ||
        payloadText === "[DONE]"
    ) {
        return;
    }

    let payload;

    try {
        payload =
            JSON.parse(payloadText);
    } catch {
        console.warn(
            "Ignored malformed SSE payload:",
            payloadText
        );

        return;
    }

    if (payload.conversation_id) {
        conversationId =
            payload.conversation_id;
    }

    if (
        payload.event === "message" &&
        payload.answer
    ) {

        hideLoadingState();


    messageElement.classList.remove(
        "is-waiting"
    );

        const currentText =
            messageElement
                .dataset
                .rawText || "";

        const updatedText =
            currentText +
            payload.answer;

        messageElement.dataset.rawText =
            updatedText;

        renderResponse(
            messageElement,
            updatedText
        );

        scrollChat();
    }

    if (payload.event === "error") {
        throw new Error(
            payload.message ||
            "Dify returned an error."
        );
    }
}


/* =========================================================
   MESSAGE RENDERING
========================================================= */

function appendMessage(
    text,
    sender
) {
    const message =
        document.createElement("article");

    message.classList.add(
        "message",
        sender
    );

    if (sender === "agent") {
        renderResponse(
            message,
            text
        );
    } else {
        message.textContent = text;
    }

    chatBox.appendChild(message);

    scrollChat();

    return message;
}

function createAgentMessage() {
    const message =
        document.createElement("article");

    message.classList.add(
        "message",
        "agent",
        "is-waiting"
    );

    chatBox.appendChild(message);

    return message;
}


/*
 * Render a small and safe subset of Markdown.
 *
 * Supported:
 * Paragraphs
 * Bullet lists
 * Numbered lists
 * Bold text
 * Inline code
 * Email addresses
 *
 * No raw HTML is inserted.
 */

function renderResponse(
    element,
    text
) {
    element.replaceChildren();

    const normalizedText = text
        .replace(/\r\n/g, "\n")
        .trimEnd();

    if (!normalizedText) {
        return;
    }

    const lines =
        normalizedText.split("\n");

    let currentList = null;
    let currentListType = null;

    for (const originalLine of lines) {
        const line =
            originalLine.trim();

        if (!line) {
            currentList = null;
            currentListType = null;

            continue;
        }

        const bulletMatch =
            line.match(
                /^[-*•]\s+(.+)$/
            );

        const numberedMatch =
            line.match(
                /^\d+[.)]\s+(.+)$/
            );

        if (bulletMatch) {
            if (
                !currentList ||
                currentListType !== "ul"
            ) {
                currentList =
                    document.createElement(
                        "ul"
                    );

                currentListType = "ul";

                element.appendChild(
                    currentList
                );
            }

            const item =
                document.createElement(
                    "li"
                );

            appendInlineContent(
                item,
                bulletMatch[1]
            );

            currentList.appendChild(item);

            continue;
        }

        if (numberedMatch) {
            if (
                !currentList ||
                currentListType !== "ol"
            ) {
                currentList =
                    document.createElement(
                        "ol"
                    );

                currentListType = "ol";

                element.appendChild(
                    currentList
                );
            }

            const item =
                document.createElement(
                    "li"
                );

            appendInlineContent(
                item,
                numberedMatch[1]
            );

            currentList.appendChild(item);

            continue;
        }

        currentList = null;
        currentListType = null;

        const paragraph =
            document.createElement("p");

        appendInlineContent(
            paragraph,
            line
        );

        element.appendChild(
            paragraph
        );
    }
}


/* =========================================================
   SAFE INLINE FORMATTING
========================================================= */

function appendInlineContent(
    parent,
    text
) {
    const tokenPattern =
        /(\*\*[^*]+\*\*|`[^`]+`|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,})/g;

    let lastIndex = 0;
    let match;

    while (
        (
            match =
                tokenPattern.exec(text)
        ) !== null
    ) {
        if (
            match.index >
            lastIndex
        ) {
            parent.appendChild(
                document.createTextNode(
                    text.slice(
                        lastIndex,
                        match.index
                    )
                )
            );
        }

        const token = match[0];

        if (
            token.startsWith("**") &&
            token.endsWith("**")
        ) {
            const strong =
                document.createElement(
                    "strong"
                );

            strong.textContent =
                token.slice(2, -2);

            parent.appendChild(
                strong
            );
        } else if (
            token.startsWith("`") &&
            token.endsWith("`")
        ) {
            const code =
                document.createElement(
                    "code"
                );

            code.textContent =
                token.slice(1, -1);

            parent.appendChild(
                code
            );
        } else {
            const emailLink =
                document.createElement(
                    "a"
                );

            emailLink.href =
                `mailto:${token}`;

            emailLink.textContent =
                token;

            parent.appendChild(
                emailLink
            );
        }

        lastIndex =
            tokenPattern.lastIndex;
    }

    if (lastIndex < text.length) {
        parent.appendChild(
            document.createTextNode(
                text.slice(lastIndex)
            )
        );
    }
}


/* =========================================================
   LOADING STATE
========================================================= */

function showLoadingState() {
    if (!loadingState) {
        return;
    }

    loadingMessageIndex = 0;

    updateLoadingMessage();

    loadingState.hidden = false;
    loadingState.classList.remove(
        "hidden"
    );

    window.clearInterval(
        loadingMessageTimer
    );

    loadingMessageTimer =
        window.setInterval(
            () => {
                loadingMessageIndex =
                    (
                        loadingMessageIndex +
                        1
                    ) %
                    loadingMessages.length;

                updateLoadingMessage();
            },
            1800
        );

    scrollChat();
}


function updateLoadingMessage() {
    if (!loadingState) {
        return;
    }

    const textElement =
        loadingState.querySelector("p");

    if (textElement) {
        textElement.textContent =
            loadingMessages[
                loadingMessageIndex
            ];
    }
}


function hideLoadingState() {
    if (!loadingState) {
        return;
    }

    loadingState.hidden = true;
    loadingState.classList.add(
        "hidden"
    );

    window.clearInterval(
        loadingMessageTimer
    );

    loadingMessageTimer = null;
}


/* =========================================================
   INPUT STATE
========================================================= */

function updateSendButton() {
    const hasText =
        inputField.value.trim().length > 0;

    sendButton.disabled =
        !hasText || isSending;

    inputField.disabled =
        isSending;
}


function resizeInput() {
    if (
        inputField.tagName !==
        "TEXTAREA"
    ) {
        return;
    }

    inputField.style.height =
        "auto";

    inputField.style.height =
        `${Math.min(
            inputField.scrollHeight,
            160
        )}px`;
}


/* =========================================================
   SCROLLING
========================================================= */

function scrollChat() {
    window.requestAnimationFrame(
        () => {
            chatBox.scrollTo({
                top:
                    chatBox.scrollHeight,

                behavior:
                    window.matchMedia(
                        "(prefers-reduced-motion: reduce)"
                    ).matches
                        ? "auto"
                        : "smooth"
            });
        }
    );
}


/* =========================================================
   ERROR HANDLING
========================================================= */

function extractErrorMessage(
    errorText,
    status
) {
    if (!errorText) {
        return (
            `The request failed with status ${status}.`
        );
    }

    try {
        const parsed =
            JSON.parse(errorText);

        return (
            parsed.error ||
            parsed.message ||
            parsed.details ||
            `The request failed with status ${status}.`
        );
    } catch {
        const plainText = errorText
            .replace(/<[^>]*>/g, " ")
            .replace(/\s+/g, " ")
            .trim();

        return (
            plainText ||
            `The request failed with status ${status}.`
        );
    }
}

/* =========================================================
   INTRO ANIMATION
========================================================= */

async function runIntroAnimation() {
    if (!typedIntro) {
        document.body.classList.remove(
            "intro-pending"
        );

        return;
    }

    typedIntro.textContent = "";

    await wait(300);

    for (
        let index = 0;
        index < introText.length;
        index += 1
    ) {
        const character =
            introText[index];

        typedIntro.textContent +=
            character;

        await wait(
            getTypingDelay(character)
        );
    }

    document.body.classList.add(
        "intro-complete"
    );

    await wait(250);

    document.body.classList.remove(
        "intro-pending"
    );
}


function getTypingDelay(character) {
    if (character === "\n") {
        return 180;
    }

    if (
        character === "." ||
        character === "," ||
        character === "!"
    ) {
        return 220;
    }

    if (character === " ") {
        return 30;
    }

    return 38 + Math.random() * 34;
}


function wait(milliseconds) {
    return new Promise(
        resolve =>
            window.setTimeout(
                resolve,
                milliseconds
            )
    );
}


runIntroAnimation();