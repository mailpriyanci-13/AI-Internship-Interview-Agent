const OLLAMA_MODEL = "llama3.2:1b";
const OLLAMA_API_URL = "http://127.0.0.1:11434/api/generate";

let selectedPrep = "";
let currentTrackData = { type: "", inputs: "" };

const screenMain = document.getElementById('screen-main');
const screenPrep = document.getElementById('screen-prep');
const screenForm = document.getElementById('screen-form');
const screenLoading = document.getElementById('screen-loading');
const screenDashboard = document.getElementById('screen-dashboard');

// Legacy Red Chat Box hiding logic
const legacyChatInput = document.getElementById('chat-input');
if (legacyChatInput) {
    let legacyCard = legacyChatInput.parentElement.parentElement;
    let exitBtn = document.getElementById('btn-exit');
    if (legacyCard && exitBtn && legacyCard.contains(exitBtn)) {
        legacyCard.parentElement.appendChild(exitBtn);
    }
    if (legacyCard) {
        legacyCard.style.display = 'none';
    }
}

function showScreen(screenElement) {
    document.querySelectorAll('.screen').forEach(s => {
        s.classList.remove('active');
        s.classList.add('hidden');
    });
    screenElement.classList.remove('hidden');
    screenElement.classList.add('active');
}

document.getElementById('btn-continue').addEventListener('click', () => {
    chrome.storage.local.get(['lastDashboardTitle', 'lastDashboardContent', 'lastTrack', 'lastSubsystemsHtml', 'lastAnalytics'], (result) => {
        if (result.lastTrack) {
            selectedPrep = result.lastTrack;
            buildDashboardUI(result.lastDashboardTitle || "WORKSPACE HUB", result.lastSubsystemsHtml, result.lastAnalytics);
            showScreen(screenDashboard);
        } else {
            document.getElementById('dash-title').innerText = "CONTINUED SESSION";
            document.getElementById('dash-content').innerText = "No previous session data found.";
            showScreen(screenDashboard);
        }
    });
});

document.getElementById('btn-create').addEventListener('click', () => {
    showScreen(screenPrep);
});

document.getElementById('btn-memory').addEventListener('click', () => {
    document.getElementById('dash-title').innerText = "Agent Memory Vault";
    
    chrome.storage.local.get(['memoryVault'], (result) => {
        let vaultHtml = `<div style="font-size: 11px; color: #6b7280; font-weight: 700; margin-bottom: 10px; letter-spacing: 0.5px;">STORED CONTEXT & CODE ARTIFACTS</div>`;
        let vault = result.memoryVault || [];
        
        if (vault.length > 0) {
            vault.forEach(item => {
                vaultHtml += `
                <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; margin-bottom: 10px; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
                    <div style="color: #4f46e5; font-weight: 700; font-size: 13px; margin-bottom: 4px;">${item.title || 'Execution Record'}</div>
                    <div style="color: #6b7280; font-size: 11px; margin-bottom: 6px;">Executed: ${item.time}</div>
                    <div style="background: #1e1e2f; color: #a5b4fc; border-radius: 6px; padding: 10px; font-family: monospace; font-size: 11px;">
                        <div style="color: #93c5fd; margin-bottom: 4px;">Input Data:<br>"${item.prompt}"</div>
                        <div style="color: #34d399; margin-top: 6px;">Status -> ${item.status}</div>
                    </div>
                </div>`;
            });
        } else {
            vaultHtml += `<div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; color: #6b7280; font-size: 12px;">Memory Vault is currently empty.</div>`;
        }

        document.getElementById('dash-content').innerHTML = vaultHtml;
    });

    showScreen(screenDashboard);
});

const prepRadios = document.querySelectorAll('input[name="prepType"]');
const btnPrepNext = document.getElementById('btn-prep-next');

prepRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
        selectedPrep = e.target.value;
        btnPrepNext.disabled = false;
    });
});

document.getElementById('back-to-main').addEventListener('click', () => showScreen(screenMain));

btnPrepNext.addEventListener('click', () => {
    setupFormScreen(selectedPrep);
    showScreen(screenForm);
});

const dynamicInputs = document.getElementById('dynamic-inputs');
const resumeUpload = document.getElementById('resume-upload');
const btnAnalyze = document.getElementById('btn-analyze');
let inputFields = [];

document.getElementById('back-to-prep').addEventListener('click', () => showScreen(screenPrep));

function setupFormScreen(type) {
    dynamicInputs.innerHTML = '';
    inputFields = [];
    resumeUpload.value = "";
    btnAnalyze.disabled = true;

    if (type === "internship") {
        document.getElementById('form-title').innerText = "Internship Details";
        addInput("Target Role/Company", "text", "role");
        addInput("Current Education", "text", "education");
    } else if (type === "interview") {
        document.getElementById('form-title').innerText = "Interview Details";
        addInput("Current Status/Role", "text", "status");
    } else if (type === "skills") {
        document.getElementById('form-title').innerText = "Skill Development";
        addInput("Skills you already know", "text", "skills");
    }

    inputFields.forEach(input => input.addEventListener('input', validateForm));
    resumeUpload.addEventListener('change', validateForm);
}

function addInput(label, type, id) {
    const div = document.createElement('div');
    div.className = 'input-group';
    div.innerHTML = `<label>${label}</label><input type="${type}" id="${id}">`;
    dynamicInputs.appendChild(div);
    inputFields.push(document.getElementById(id));
}

function validateForm() {
    let allTextFilled = inputFields.every(input => input.value.trim() !== "");
    let resumeUploaded = resumeUpload.files.length > 0;
    btnAnalyze.disabled = !(allTextFilled && resumeUploaded);
}

btnAnalyze.addEventListener('click', async () => {
    showScreen(screenLoading);

    let userData = inputFields.map(input => `${input.previousSibling.innerText}: ${input.value}`).join(', ');
    currentTrackData = { type: selectedPrep, inputs: userData };

    let prompt = `Analyze profile for ${selectedPrep} track with details: ${userData}. Provide short constructive feedback.`;
    let currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    try {
        const response = await fetch(OLLAMA_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                model: OLLAMA_MODEL, 
                prompt: prompt, 
                stream: false,
                options: { num_predict: 120, temperature: 0.2 } 
            })
        });

        if (!response.ok) throw new Error("Server error");

        const data = await response.json();
        const outputText = data.response;

        // Distinct Header Titles for each Track
        let titleText = "Internship Workspace Hub";
        if (selectedPrep === 'interview') {
            titleText = "Interview Workspace Hub";
        } else if (selectedPrep === 'skills') {
            titleText = "Skill Development Hub";
        }

        let subsystemsHtml = getSubsystemsHtml(selectedPrep);
        let analyticsHtml = getAnalyticsHtml(outputText);

        buildDashboardUI(titleText, subsystemsHtml, analyticsHtml);

        chrome.storage.local.get(['memoryVault'], (result) => {
            let vault = result.memoryVault || [];
            vault.unshift({
                title: titleText,
                time: currentTime,
                prompt: userData,
                status: "Successfully Initialized."
            });
            
            chrome.storage.local.set({ 
                lastDashboardTitle: titleText,
                lastSubsystemsHtml: subsystemsHtml,
                lastAnalytics: analyticsHtml,
                lastTrack: selectedPrep,
                memoryVault: vault
            });
        });

        showScreen(screenDashboard);

    } catch (error) {
        document.getElementById('dash-content').innerText = "Error connecting to Ollama. Ensure Ollama is running.";
        showScreen(screenDashboard);
    }
});

function getSubsystemsHtml(track) {
    if (track === 'interview') {
        return `
        <div style="font-size: 11px; font-weight: 700; color: #4b5563; margin-bottom: 8px; letter-spacing: 0.5px;">AGENT WORKSPACE SUBSYSTEMS</div>
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 12px;">
            <div class="sub-card" data-sub="HR Qs" style="background:#fff; border:1px solid #e5e7eb; border-radius:8px; padding:10px 4px; text-align:center; cursor:pointer;">
                <div style="color:#ec4899; font-size:16px; margin-bottom:2px;">❓</div>
                <div style="font-size:11px; font-weight:600; color:#db2777;">HR Qs</div>
            </div>
            <div class="sub-card" data-sub="Technical Qs" style="background:#fff; border:1px solid #e5e7eb; border-radius:8px; padding:10px 4px; text-align:center; cursor:pointer;">
                <div style="color:#ec4899; font-size:16px; margin-bottom:2px;">💻</div>
                <div style="font-size:11px; font-weight:600; color:#db2777;">Technical Qs</div>
            </div>
            <div class="sub-card" data-sub="Company Qs" style="background:#fff; border:1px solid #e5e7eb; border-radius:8px; padding:10px 4px; text-align:center; cursor:pointer;">
                <div style="color:#ec4899; font-size:16px; margin-bottom:2px;">🏢</div>
                <div style="font-size:11px; font-weight:600; color:#db2777;">Company Qs</div>
            </div>
            <div class="sub-card" data-sub="Coding Practice" style="background:#fff; border:1px solid #e5e7eb; border-radius:8px; padding:10px 4px; text-align:center; cursor:pointer;">
                <div style="color:#ec4899; font-size:16px; margin-bottom:2px;">⚡</div>
                <div style="font-size:11px; font-weight:600; color:#db2777;">Coding Practice</div>
            </div>
        </div>
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 12px;">
            <div class="sub-card" data-sub="Mock Interview" style="background:#fff; border:1px solid #e5e7eb; border-radius:8px; padding:10px 4px; text-align:center; cursor:pointer;">
                <div style="color:#ec4899; font-size:16px; margin-bottom:2px;">💬</div>
                <div style="font-size:11px; font-weight:600; color:#db2777;">Mock Interview</div>
            </div>
            <div class="sub-card" data-sub="Feedback" style="background:#fff; border:1px solid #e5e7eb; border-radius:8px; padding:10px 4px; text-align:center; cursor:pointer;">
                <div style="color:#ec4899; font-size:16px; margin-bottom:2px;">📊</div>
                <div style="font-size:11px; font-weight:600; color:#db2777;">Feedback</div>
            </div>
            <div class="sub-card" data-sub="Resources" style="background:#fff; border:1px solid #e5e7eb; border-radius:8px; padding:10px 4px; text-align:center; cursor:pointer;">
                <div style="color:#4f46e5; font-size:16px; margin-bottom:2px;">🔗</div>
                <div style="font-size:11px; font-weight:600; color:#4f46e5;">Resources</div>
            </div>
        </div>`;
    } else if (track === 'skills') {
        // Dedicated Subsystems for Skill Development
        return `
        <div style="font-size: 11px; font-weight: 700; color: #4b5563; margin-bottom: 8px; letter-spacing: 0.5px;">SKILL DEVELOPMENT SUBSYSTEMS</div>
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 12px;">
            <div class="sub-card" data-sub="Learning Path" style="background:#fff; border:1px solid #e5e7eb; border-radius:8px; padding:10px 4px; text-align:center; cursor:pointer;">
                <div style="color:#059669; font-size:16px; margin-bottom:2px;">🚀</div>
                <div style="font-size:11px; font-weight:600; color:#059669;">Learning Path</div>
            </div>
            <div class="sub-card" data-sub="Core Concepts" style="background:#fff; border:1px solid #e5e7eb; border-radius:8px; padding:10px 4px; text-align:center; cursor:pointer;">
                <div style="color:#059669; font-size:16px; margin-bottom:2px;">📚</div>
                <div style="font-size:11px; font-weight:600; color:#059669;">Core Concepts</div>
            </div>
            <div class="sub-card" data-sub="Mini Projects" style="background:#fff; border:1px solid #e5e7eb; border-radius:8px; padding:10px 4px; text-align:center; cursor:pointer;">
                <div style="color:#059669; font-size:16px; margin-bottom:2px;">🛠️</div>
                <div style="font-size:11px; font-weight:600; color:#059669;">Mini Projects</div>
            </div>
            <div class="sub-card" data-sub="Certifications" style="background:#fff; border:1px solid #e5e7eb; border-radius:8px; padding:10px 4px; text-align:center; cursor:pointer;">
                <div style="color:#059669; font-size:16px; margin-bottom:2px;">📜</div>
                <div style="font-size:11px; font-weight:600; color:#059669;">Certifications</div>
            </div>
        </div>
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 12px;">
            <div class="sub-card" data-sub="Daily Challenge" style="background:#fff; border:1px solid #e5e7eb; border-radius:8px; padding:10px 4px; text-align:center; cursor:pointer;">
                <div style="color:#059669; font-size:16px; margin-bottom:2px;">⚡</div>
                <div style="font-size:11px; font-weight:600; color:#059669;">Daily Challenge</div>
            </div>
            <div class="sub-card" data-sub="Skill Test" style="background:#fff; border:1px solid #e5e7eb; border-radius:8px; padding:10px 4px; text-align:center; cursor:pointer;">
                <div style="color:#059669; font-size:16px; margin-bottom:2px;">📊</div>
                <div style="font-size:11px; font-weight:600; color:#059669;">Skill Test</div>
            </div>
            <div class="sub-card" data-sub="Resources" style="background:#fff; border:1px solid #e5e7eb; border-radius:8px; padding:10px 4px; text-align:center; cursor:pointer;">
                <div style="color:#059669; font-size:16px; margin-bottom:2px;">📁</div>
                <div style="font-size:11px; font-weight:600; color:#059669;">Resources</div>
            </div>
        </div>`;
    } else {
        // Internship Track Subsystems
        return `
        <div style="font-size: 11px; font-weight: 700; color: #4b5563; margin-bottom: 8px; letter-spacing: 0.5px;">AGENT WORKSPACE SUBSYSTEMS</div>
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 12px;">
            <div class="sub-card" data-sub="Roadmap" style="background:#fff; border:1px solid #e5e7eb; border-radius:8px; padding:10px 4px; text-align:center; cursor:pointer;">
                <div style="color:#0284c7; font-size:16px; margin-bottom:2px;">🗺️</div>
                <div style="font-size:11px; font-weight:600; color:#0284c7;">Roadmap</div>
            </div>
            <div class="sub-card" data-sub="Topics" style="background:#fff; border:1px solid #e5e7eb; border-radius:8px; padding:10px 4px; text-align:center; cursor:pointer;">
                <div style="color:#4f46e5; font-size:16px; margin-bottom:2px;">📋</div>
                <div style="font-size:11px; font-weight:600; color:#4f46e5;">Topics</div>
            </div>
            <div class="sub-card" data-sub="Skills" style="background:#fff; border:1px solid #e5e7eb; border-radius:8px; padding:10px 4px; text-align:center; cursor:pointer;">
                <div style="color:#0284c7; font-size:16px; margin-bottom:2px;">🎯</div>
                <div style="font-size:11px; font-weight:600; color:#0284c7;">Skills</div>
            </div>
            <div class="sub-card" data-sub="Practice" style="background:#fff; border:1px solid #e5e7eb; border-radius:8px; padding:10px 4px; text-align:center; cursor:pointer;">
                <div style="color:#0284c7; font-size:16px; margin-bottom:2px;">⚡</div>
                <div style="font-size:11px; font-weight:600; color:#0284c7;">Practice</div>
            </div>
        </div>
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 12px;">
            <div class="sub-card" data-sub="Mock Tests" style="background:#fff; border:1px solid #e5e7eb; border-radius:8px; padding:10px 4px; text-align:center; cursor:pointer;">
                <div style="color:#0284c7; font-size:16px; margin-bottom:2px;">📝</div>
                <div style="font-size:11px; font-weight:600; color:#0284c7;">Mock Tests</div>
            </div>
            <div class="sub-card" data-sub="Progress" style="background:#fff; border:1px solid #e5e7eb; border-radius:8px; padding:10px 4px; text-align:center; cursor:pointer;">
                <div style="color:#0284c7; font-size:16px; margin-bottom:2px;">📈</div>
                <div style="font-size:11px; font-weight:600; color:#0284c7;">Progress</div>
            </div>
            <div class="sub-card" data-sub="Resources" style="background:#fff; border:1px solid #e5e7eb; border-radius:8px; padding:10px 4px; text-align:center; cursor:pointer;">
                <div style="color:#0284c7; font-size:16px; margin-bottom:2px;">📁</div>
                <div style="font-size:11px; font-weight:600; color:#0284c7;">Resources</div>
            </div>
        </div>`;
    }
}

function getAnalyticsHtml(rawText) {
    return `
    <div style="background:#fff; border:1px solid #e5e7eb; border-radius:8px; padding:12px; margin-top:10px;">
        <div style="font-weight:700; color:#1f2937; margin-bottom:6px; font-size:12px;">⚠️ Critical Anomalies:</div>
        <div style="color:#4b5563; font-size:11px; margin-bottom:10px;">${rawText}</div>
        <div style="font-weight:700; color:#1f2937; margin-bottom:4px; font-size:12px;">🚀 Optimization Vectors:</div>
        <div style="color:#4b5563; font-size:11px;">Focus on strengthening core technical concepts and project execution aligned with your profile context.</div>
    </div>`;
}

function buildDashboardUI(title, subsystemsHtml, analyticsHtml) {
    document.getElementById('dash-title').innerText = title;
    
    let topMetricLabel = selectedPrep === 'skills' ? "SKILL INDEX" : "RESUME MATCH";

    let container = document.getElementById('dash-content');
    container.innerHTML = `
        <div style="display:flex; justify-content:space-between; background:#fff; border:1px solid #e5e7eb; border-radius:8px; padding:12px; margin-bottom:12px; text-align:center;">
            <div style="width:50%; border-right:1px solid #e5e7eb;">
                <div style="font-size:22px; font-weight:700; color:#4f46e5;">80</div>
                <div style="font-size:10px; color:#6b7280; font-weight:700;">${topMetricLabel}</div>
            </div>
            <div style="width:50%;">
                <div style="font-size:20px; font-weight:700; color:#10b981;">Ready</div>
                <div style="font-size:10px; color:#6b7280; font-weight:700;">AGENT STATE</div>
            </div>
        </div>

        ${subsystemsHtml}

        <div id="module-insight-box" style="background:#f5f3ff; border:1px dashed #7c3aed; border-radius:8px; padding:10px; margin-bottom:12px; display:none;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                <strong id="insight-title" style="color:#5b21b6; font-size:12px;">Module Insights</strong>
                <span id="close-insight" style="cursor:pointer; color:#7c3aed; font-weight:bold; font-size:14px;">&times;</span>
            </div>
            <div id="insight-content" style="color:#4c1d95; font-size:11px; line-height:1.4;">Select a subsystem module above to compile localized guidance via Ollama.</div>
        </div>

        ${analyticsHtml}
        
        <div style="margin-top: 15px; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; background: white;">
            <div style="padding: 10px; font-size: 12px; font-weight: bold; background: #f9fafb; border-bottom: 1px solid #e5e7eb;">Ask AI Anything</div>
            <div id="chat-history" style="padding: 10px; height: 100px; overflow-y: auto; font-size: 11px; color: #374151;"></div>
            <div style="display: flex; padding: 10px; border-top: 1px solid #e5e7eb; background: #fff;">
                <input type="text" id="ai-chat-input" placeholder="Type here..." style="flex: 1; padding: 8px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 11px; outline: none;">
                <button id="ai-chat-send" style="margin-left: 8px; padding: 8px 16px; background: #5c6bc0; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: bold;">Send</button>
            </div>
        </div>
    `;

    document.querySelectorAll('.sub-card').forEach(card => {
        card.addEventListener('click', async () => {
            let subName = card.getAttribute('data-sub');
            let insightBox = document.getElementById('module-insight-box');
            let insightTitle = document.getElementById('insight-title');
            let insightContent = document.getElementById('insight-content');

            insightBox.style.display = 'block';
            insightTitle.innerText = `${subName} Module Insights`;
            insightContent.innerText = "Compiling specific insights via Ollama...";

            let dynamicPrompt = "";
            // Customized prompts for Skill Development Subsystems
            if (subName === "Learning Path") {
                dynamicPrompt = `Create a step-by-step roadmap to master skills based on current user profile: ${currentTrackData.inputs}. Format as concise professional bullet points. Do not include introductory or concluding text.`;
            } else if (subName === "Core Concepts") {
                dynamicPrompt = `List 3 foundational concepts the user must master for: ${currentTrackData.inputs}. Format as concise professional bullet points. Do not include introductory or concluding text.`;
            } else if (subName === "Mini Projects") {
                dynamicPrompt = `Suggest 2 hands-on mini project ideas for practicing skills based on: ${currentTrackData.inputs}. Format as concise professional bullet points. Do not include introductory or concluding text.`;
            } else if (subName === "Certifications") {
                dynamicPrompt = `Recommend 2 valuable certifications or online learning paths for: ${currentTrackData.inputs}. Format as concise professional bullet points. Do not include introductory or concluding text.`;
            } else if (subName === "Daily Challenge") {
                dynamicPrompt = `Provide 1 practical coding/logic daily exercise challenge for: ${currentTrackData.inputs}. Format as concise professional bullet points. Do not include introductory or concluding text.`;
            } else if (subName === "Skill Test") {
                dynamicPrompt = `Provide 2 self-assessment quiz questions to test knowledge on: ${currentTrackData.inputs}. Format as concise professional bullet points. Do not include introductory or concluding text.`;
            } else if (subName === "Roadmap") {
                dynamicPrompt = `Create a strict 3-step timeline roadmap for a ${currentTrackData.type} position based on these details: ${currentTrackData.inputs}. Format as concise professional bullet points. Do not include introductory or concluding text.`;
            } else if (subName === "Topics") {
                dynamicPrompt = `List 3 highly specific study topics relevant for a ${currentTrackData.type} based on: ${currentTrackData.inputs}. Format as concise professional bullet points. Do not include introductory or concluding text.`;
            } else if (subName === "HR Qs") {
                dynamicPrompt = `Provide 2 common HR interview questions tailored for a candidate with these details: ${currentTrackData.inputs}. Format as concise professional bullet points. Do not include introductory or concluding text.`;
            } else if (subName === "Technical Qs") {
                dynamicPrompt = `Provide 2 technical interview questions for a ${currentTrackData.type} based on these inputs: ${currentTrackData.inputs}. Format as concise professional bullet points. Do not include introductory or concluding text.`;
            } else if (subName === "Skills") {
                dynamicPrompt = `List 3 technical skills the user should learn next based on their current profile: ${currentTrackData.inputs}. Format as concise professional bullet points. Do not include introductory or concluding text.`;
            } else if (subName === "Resources") {
                dynamicPrompt = `Recommend 2 specific types of resources or platforms for a candidate with details: ${currentTrackData.inputs}. Format as concise professional bullet points. Do not include introductory or concluding text.`;
            } else {
                dynamicPrompt = `Provide 2 professional bullet points specifically about the ${subName} aspect for a candidate with details: ${currentTrackData.inputs}. Format as concise professional bullet points. Do not include introductory or concluding text.`;
            }

            try {
                const response = await fetch(OLLAMA_API_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        model: OLLAMA_MODEL, 
                        prompt: dynamicPrompt, 
                        stream: false,
                        options: { num_predict: 100, temperature: 0.2 } 
                    })
                });
                const data = await response.json();
                insightContent.innerText = data.response;
            } catch (err) {
                insightContent.innerText = "Failed to fetch insights. Ensure Ollama is running.";
            }
        });
    });

    document.getElementById('close-insight').addEventListener('click', () => {
        document.getElementById('module-insight-box').style.display = 'none';
    });

    const chatSendBtn = document.getElementById('ai-chat-send');
    const chatInput = document.getElementById('ai-chat-input');
    const chatHistory = document.getElementById('chat-history');

    if (chatSendBtn && chatInput) {
        chatSendBtn.addEventListener('click', async () => {
            const userMsg = chatInput.value.trim();
            if (!userMsg) return;

            chatHistory.innerHTML += `<div style="margin-bottom: 8px;"><strong style="color: #374151;">You:</strong> <span style="color: #4b5563;">${userMsg}</span></div>`;
            chatInput.value = "";
            chatHistory.scrollTop = chatHistory.scrollHeight;

            let chatPrompt = `The user is in the ${currentTrackData.type} track with these details: ${currentTrackData.inputs}. The user asks: "${userMsg}". Provide a short, direct answer without extra conversational filler.`;

            try {
                const response = await fetch(OLLAMA_API_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        model: OLLAMA_MODEL, 
                        prompt: chatPrompt, 
                        stream: false,
                        options: { num_predict: 150, temperature: 0.3 } 
                    })
                });
                const data = await response.json();
                chatHistory.innerHTML += `<div style="margin-bottom: 8px;"><strong style="color: #5c6bc0;">AI:</strong> <span style="color: #4b5563;">${data.response}</span></div>`;
                chatHistory.scrollTop = chatHistory.scrollHeight;
            } catch (err) {
                chatHistory.innerHTML += `<div style="margin-bottom: 8px; color: red;"><strong>AI:</strong> Error connecting to Ollama.</div>`;
            }
        });

        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                chatSendBtn.click();
            }
        });
    }
}

document.getElementById('btn-exit').addEventListener('click', () => {
    showScreen(screenMain);
});