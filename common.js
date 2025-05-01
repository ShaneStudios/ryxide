const DB_NAME = 'RyxIDE_DB';
const DB_VERSION = 1;
const PROJECTS_STORE_NAME = 'projects';
const PROJECT_DATA_STORE_NAME = 'projectData';
const SETTINGS_STORE_NAME = 'settings';
const API_KEY_STORE_NAME = 'secrets';
const CURRENT_PROJECT_STORE_NAME = 'appState';

const DEFAULT_SETTINGS = { theme: 'vs-dark', autoSave: false, fontSize: 14, tabSize: 4, renderWhitespace: 'none', wordWrap: 'on' };

let dbPromise = null;

function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = (event) => {
            console.error("IndexedDB error:", event.target.error);
            reject(`IndexedDB error: ${event.target.error}`);
        };
        request.onsuccess = (event) => {
            resolve(event.target.result);
        };
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            console.log(`Upgrading IndexedDB from version ${event.oldVersion} to ${event.newVersion}`);
            if (!db.objectStoreNames.contains(PROJECTS_STORE_NAME)) {
                db.createObjectStore(PROJECTS_STORE_NAME, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains(PROJECT_DATA_STORE_NAME)) {
                db.createObjectStore(PROJECT_DATA_STORE_NAME, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains(SETTINGS_STORE_NAME)) {
                db.createObjectStore(SETTINGS_STORE_NAME, { keyPath: 'key' });
            }
            if (!db.objectStoreNames.contains(API_KEY_STORE_NAME)) {
                db.createObjectStore(API_KEY_STORE_NAME, { keyPath: 'key' });
            }
             if (!db.objectStoreNames.contains(CURRENT_PROJECT_STORE_NAME)) {
                db.createObjectStore(CURRENT_PROJECT_STORE_NAME, { keyPath: 'key' });
            }
        };
    });
    return dbPromise;
}

async function idbGet(storeName, key) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = (event) => reject(`IDB get error (${storeName}): ${event.target.error}`);
    });
}

async function idbGetAll(storeName) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = (event) => reject(`IDB getAll error (${storeName}): ${event.target.error}`);
    });
}

async function idbSet(storeName, value) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.put(value);
        request.onsuccess = () => resolve(true);
        request.onerror = (event) => {
             console.error(`IDB set error (${storeName}):`, event.target.error);
             reject(`IDB set error: ${event.target.error}`);
         };
         transaction.oncomplete = () => resolve(true);
         transaction.onerror = (event) => reject(`IDB transaction error (${storeName}): ${event.target.error}`);
    });
}

async function idbRemove(storeName, key) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.delete(key);
        request.onsuccess = () => resolve(true);
        request.onerror = (event) => reject(`IDB remove error (${storeName}): ${event.target.error}`);
        transaction.oncomplete = () => resolve(true);
        transaction.onerror = (event) => reject(`IDB transaction error (${storeName}): ${event.target.error}`);
    });
}

async function idbClear(storeName) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.clear();
        request.onsuccess = () => resolve(true);
        request.onerror = (event) => reject(`IDB clear error (${storeName}): ${event.target.error}`);
        transaction.oncomplete = () => resolve(true);
        transaction.onerror = (event) => reject(`IDB transaction error (${storeName}): ${event.target.error}`);
    });
}

async function clearAllStores() {
     const db = await openDB();
     const storesToClear = [
          PROJECTS_STORE_NAME, PROJECT_DATA_STORE_NAME, SETTINGS_STORE_NAME,
          API_KEY_STORE_NAME, CURRENT_PROJECT_STORE_NAME
     ];
     return new Promise((resolve, reject) => {
          if (storesToClear.length === 0) return resolve(true);
          const transaction = db.transaction(storesToClear, 'readwrite');
          transaction.onerror = (event) => reject(`IDB clear transaction error: ${event.target.error}`);
          transaction.oncomplete = () => resolve(true);
          storesToClear.forEach(storeName => {
               if (db.objectStoreNames.contains(storeName)) {
                    const request = transaction.objectStore(storeName).clear();
                    request.onerror = (event) => console.error(`Error clearing store ${storeName}:`, event.target.error);
               }
          });
     });
}

function generateUUID() { return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => (c === 'x' ? Math.random() * 16 | 0 : Math.random() * 16 | 0 & 0x3 | 0x8).toString(16)); }
function getLanguageFromFilename(filename) { const ext = filename?.split('.').pop()?.toLowerCase(); const map = { html: 'html', htm: 'html', css: 'css', js: 'javascript', mjs: 'javascript', cjs: 'javascript', py: 'python', md: 'markdown', rb: 'ruby', cs: 'csharp', rs: 'rust', java: 'java', go: 'go', php: 'php', json: 'json', xml: 'xml', yaml: 'yaml', yml: 'yaml', sh: 'shell', bash: 'shell', cpp: 'cpp', c: 'c', h: 'c', hpp: 'cpp' }; return map[ext] || 'plaintext'; }
function formatDate(timestamp) { if (!timestamp) return 'N/A'; try { return new Date(timestamp).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }); } catch (e) { return 'Invalid Date'; } }
function escapeHtml(unsafe) { if (typeof unsafe !== 'string') return ''; return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;"); }

async function getAllProjectsList() { return await idbGetAll(PROJECTS_STORE_NAME) || []; }
async function saveAllProjectsList(list) { console.warn("saveAllProjectsList deprecated."); return true; }
async function getProjectFromStorage(projectId) {
    try {
        return projectId ? await idbGet(PROJECT_DATA_STORE_NAME, projectId) : null;
    } catch (error) {
        console.error("Failed to retrieve project data:", error);
        return null;
    }
}
async function saveProjectToStorage(project) { if (!project?.id) return false; project.lastModified = Date.now(); const summary = { id: project.id, name: project.name, lastModified: project.lastModified }; try { await idbSet(PROJECT_DATA_STORE_NAME, project); await idbSet(PROJECTS_STORE_NAME, summary); return true; } catch (e) { alert(`Failed to save project: ${e}`); return false; } }
async function deleteProjectFromStorage(projectId) { try { await idbRemove(PROJECT_DATA_STORE_NAME, projectId); await idbRemove(PROJECTS_STORE_NAME, projectId); return true; } catch (e) { alert(`Failed to delete project: ${e}`); return false; } }
async function setCurrentProjectId(projectId) { try { if (projectId) await idbSet(CURRENT_PROJECT_STORE_NAME, { key: 'currentProjectId', value: projectId }); else await idbRemove(CURRENT_PROJECT_STORE_NAME, 'currentProjectId'); return true; } catch (e) { console.error("Failed to set current project ID:", e); return false; } }
async function getCurrentProjectId() { const data = await idbGet(CURRENT_PROJECT_STORE_NAME, 'currentProjectId'); return data?.value || null; }
async function saveApiKey(key) { try { await idbSet(API_KEY_STORE_NAME, { key: 'geminiApiKey', value: key ?? '' }); return true; } catch (e) { alert(`Failed to save API key: ${e}`); return false; } }
async function getApiKey() { const data = await idbGet(API_KEY_STORE_NAME, 'geminiApiKey'); return data?.value || null; }
async function getSettings() {
    try {
        const data = await idbGet(SETTINGS_STORE_NAME, 'userSettings');
        return { ...DEFAULT_SETTINGS, ...(data?.value || {}) };
    } catch (error) {
        console.error("Failed to retrieve settings:", error);
        return DEFAULT_SETTINGS;
    }
}
async function saveSettings(settings) { try { await idbSet(SETTINGS_STORE_NAME, { key: 'userSettings', value: settings }); return true; } catch (e) { alert(`Failed to save settings: ${e}`); return false; } }

function showLoader(loaderOverlay, loaderTextElement, text = "Loading...") { if (loaderOverlay && loaderTextElement) { loaderTextElement.textContent = text; loaderOverlay.classList.remove('modal-hidden'); } }
function hideLoader(loaderOverlay) { if (loaderOverlay) { loaderOverlay.classList.add('modal-hidden'); } }
function showModal(modalBackdrop, modalElement) { if (!modalBackdrop || !modalElement) return; modalBackdrop.classList.remove('modal-hidden'); modalElement.classList.remove('modal-hidden'); const focusable = modalElement.querySelector('input:not([type="hidden"]), select, textarea, button:not([disabled])'); focusable?.focus(); }
function hideModal(modalBackdrop, ...modalElements) { if (!modalBackdrop) return; modalBackdrop.classList.add('modal-hidden'); modalElements.forEach(el => el?.classList.add('modal-hidden')); }

function createDOMElement(tag, options = {}) { const element = document.createElement(tag); if (options.className) element.className = options.className; if (options.textContent) element.textContent = options.textContent; if (options.innerHTML) element.innerHTML = options.innerHTML; if (options.title) element.title = options.title; if (options.id) element.id = options.id; if (options.dataset) { for (const key in options.dataset) { if (Object.hasOwnProperty.call(options.dataset, key)) { element.dataset[key] = options.dataset[key]; } } } if (options.listeners) { for (const event in options.listeners) { if (Object.hasOwnProperty.call(options.listeners, event)) { element.addEventListener(event, options.listeners[event]); } } } if (options.children) { options.children.forEach(child => { if (child instanceof Node) { element.appendChild(child); } }); } return element; }

async function callGeminiApi(prompt, apiKey, history = []) {
     if (!apiKey) { return { error: "API Key not set in Settings." }; }
     const modelName = "gemini-1.5-pro-latest";
     const API_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
     const systemInstruction = { role: "system", parts: [{ text: "You are RyxAI, a friendly, encouraging, and helpful coding assistant in the RyxIDE web editor. Format code blocks using standard Markdown." }] };
     const requestBody = { contents: [ ...history, { role: "user", parts: [{ text: prompt }] }], systemInstruction: systemInstruction, generationConfig: {} };
     try {
         const response = await fetch(API_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody) });
         const responseData = await response.json();
         if (!response.ok) { console.error("Gemini Error Rsp:", responseData); let msg = `API Error (${response.status}): ${responseData.error?.message || 'Unknown'}`; if (response.status === 400 && responseData.error?.message?.includes("API_KEY_INVALID")) msg = "Gemini Error: Invalid API Key."; else if (response.status === 429) msg += " (Quota exceeded)"; else if (response.status === 404) msg = `Gemini Error: Model '${modelName}' unavailable.`; return { error: msg }; }
         const generatedText = responseData.candidates?.[0]?.content?.parts?.[0]?.text;
         if (generatedText !== undefined) { return { text: generatedText }; }
         else { const reason = responseData.candidates?.[0]?.finishReason; if (reason === 'SAFETY' || reason === 'RECITATION') return { error: `Blocked by safety filter (Reason: ${reason}).` }; console.error("Gemini Empty Rsp:", responseData); return { error: "Failed to get text from API response." }; }
     } catch (error) { console.error("Gemini Fetch Error:", error); return { error: `Network Error: ${error.message}.` }; }
}

const projectTemplates = { web_basic: [ { name: 'index.html', language: 'html', content: `<!DOCTYPE html>\n<html lang="en">\n<head>\n\t<meta charset="UTF-8">\n\t<title>\${projectName}</title>\n\t<link rel="stylesheet" href="style.css">\n</head>\n<body>\n\t<h1>Hello, \${projectName}!</h1>\n\t<p>Welcome.</p>\n\t<script src="script.js"></script>\n</body>\n</html>` }, { name: 'style.css', language: 'css', content: `body { font-family: sans-serif; padding: 20px; } h1 { color: steelblue; }` }, { name: 'script.js', language: 'javascript', content: `console.log('\${projectName} loaded!');\ndocument.addEventListener('DOMContentLoaded', () => { console.log('DOM ready'); });` }], python_basic: [ { name: 'main.py', language: 'python', content: `import sys\n\nprint(f"Hello from Python {sys.version} in \${projectName}!")\n\ndef main():\n\tprint("Running...")\n\nif __name__ == "__main__":\n\tmain()` } ], markdown_basic: [ { name: 'README.md', language: 'markdown', content: `# \${projectName}\n\nREADME for \${projectName}.` } ], empty: [] };

const starterContentByLanguage = { html: `<!DOCTYPE html>\n<html>\n<head><title>New</title></head>\n<body>\n\t\n</body>\n</html>`, css: `body {\n\t\n}`, javascript: `console.log("new JS");`, python: `import sys\nprint("Python")`, markdown: `# New File`, ruby: `puts "Ruby"`, csharp: `using System;\nclass P{static void Main(){Console.WriteLine("C#");}}`, java: `class Main{public static void main(String[]a){System.out.println("Java");}}`, cpp: `#include <iostream>\nint main() { std::cout << "C++"; return 0; }`, rust: `fn main() { println!("Rust"); }`, go: `package main\nimport "fmt"\nfunc main(){fmt.Println("Go");}`, php: `<?php echo "PHP"; ?>`, json: `{\n\t"key": "value"\n}`, plaintext: `` };

const externalSandboxLinks = { java: "https://www.jdoodle.com/online-java-compiler/", csharp: "https://dotnetfiddle.net/", cpp: "https://www.onlinegdb.com/online_c++_compiler", rust: "https://play.rust-lang.org/", go: "https://go.dev/play/", php: "https://paiza.io/en/projects/new?language=php", c: "https://www.onlinegdb.com/online_c_compiler" };
