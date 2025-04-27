const LS_PROJECTS_LIST_KEY = 'ryxide_projects_list_v3';
const LS_PROJECT_KEY_PREFIX = 'ryxide_project_v3_';
const LS_CURRENT_PROJECT_ID_KEY = 'ryxide_current_project_id_v3';
const LS_GEMINI_API_KEY = 'ryxide_gemini_api_key_v3';
const LS_SETTINGS_KEY = 'ryxide_settings_v3';
const DEFAULT_SETTINGS = {
    theme: 'vs-dark',
    autoSave: false,
};

function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function getLanguageFromFilename(filename) {
    const extension = filename?.split('.').pop()?.toLowerCase();
    const langMap = {
        'html': 'html', 'htm': 'html',
        'css': 'css',
        'js': 'javascript', 'mjs': 'javascript', 'cjs': 'javascript',
        'py': 'python',
        'md': 'markdown',
        'rb': 'ruby',
        'cs': 'csharp',
        'rs': 'rust',
        'java': 'java',
        'go': 'go',
        'php': 'php',
        'json': 'json',
        'xml': 'xml',
        'yaml': 'yaml', 'yml': 'yaml',
        'sh': 'shell', 'bash': 'shell',
        'cpp': 'cpp', 'c': 'c', 'h': 'c', 'hpp': 'cpp',
    };
    return langMap[extension] || 'plaintext';
}

function formatDate(timestamp) {
    if (!timestamp) return 'N/A';
    try {
        const date = new Date(timestamp);
        return date.toLocaleString(undefined, {
            dateStyle: 'short',
            timeStyle: 'short'
        });
    } catch (e) {
        return 'Invalid Date';
    }
}

function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') return '';
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}

function safeLocalStorageGet(key, defaultValue = null) {
    try {
        const item = localStorage.getItem(key);
        return (item !== null && item !== undefined) ? JSON.parse(item) : defaultValue;
    } catch (e) {
        console.error(`Error reading localStorage key "${key}":`, e);
        return defaultValue;
    }
}

function safeLocalStorageSet(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch (e) {
        console.error(`Error setting localStorage key "${key}":`, e);
        if (e.name === 'QuotaExceededError') {
            alert(`Storage limit reached! Cannot save data for "${key}".`);
        } else {
            alert(`Error saving data for key "${key}".`);
        }
        return false;
    }
}

function safeLocalStorageRemove(key) {
     try {
        localStorage.removeItem(key);
        return true;
     } catch(e) {
        console.error(`Error removing localStorage key "${key}":`, e);
        return false;
     }
}

function getAllProjectsList() { return safeLocalStorageGet(LS_PROJECTS_LIST_KEY, []); }
function saveAllProjectsList(list) { return safeLocalStorageSet(LS_PROJECTS_LIST_KEY, list); }
function getProjectFromStorage(projectId) { return projectId ? safeLocalStorageGet(LS_PROJECT_KEY_PREFIX + projectId) : null; }
function saveProjectToStorage(project) {
    if (!project?.id) return false;
    project.lastModified = Date.now();
    const saved = safeLocalStorageSet(LS_PROJECT_KEY_PREFIX + project.id, project);
    if (saved) {
        const projectsList = getAllProjectsList();
        const index = projectsList.findIndex(p => p.id === project.id);
        const summary = { id: project.id, name: project.name, lastModified: project.lastModified };
        if (index !== -1) {
            projectsList[index] = summary;
        } else {
             projectsList.push(summary);
        }
        saveAllProjectsList(projectsList);
    }
    return saved;
}
function deleteProjectFromStorage(projectId) {
    if (safeLocalStorageRemove(LS_PROJECT_KEY_PREFIX + projectId)) {
        const projectsList = getAllProjectsList();
        const updatedList = projectsList.filter(p => p.id !== projectId);
        return saveAllProjectsList(updatedList);
    }
    return false;
}
function setCurrentProjectId(projectId) {
    if (projectId) safeLocalStorageSet(LS_CURRENT_PROJECT_ID_KEY, projectId);
    else safeLocalStorageRemove(LS_CURRENT_PROJECT_ID_KEY);
}
function getCurrentProjectId() { return safeLocalStorageGet(LS_CURRENT_PROJECT_ID_KEY); }
function saveApiKey(key) { return safeLocalStorageSet(LS_GEMINI_API_KEY, key ?? ''); }
function getApiKey() { return safeLocalStorageGet(LS_GEMINI_API_KEY); }
function getSettings() { return safeLocalStorageGet(LS_SETTINGS_KEY, { ...DEFAULT_SETTINGS }); }
function saveSettings(settings) { return safeLocalStorageSet(LS_SETTINGS_KEY, settings); }

function showLoader(loaderOverlay, loaderTextElement, text = "Loading...") {
    if (loaderOverlay && loaderTextElement) {
        loaderTextElement.textContent = text;
        loaderOverlay.classList.remove('modal-hidden');
    }
}

function hideLoader(loaderOverlay) {
     if (loaderOverlay) {
        loaderOverlay.classList.add('modal-hidden');
     }
}

function showModal(modalBackdrop, modalElement) {
    if (!modalBackdrop || !modalElement) return;
    modalBackdrop.classList.remove('modal-hidden');
    modalElement.classList.remove('modal-hidden');
    const focusable = modalElement.querySelector('input:not([type="hidden"]), select, textarea, button:not([disabled])');
    focusable?.focus();
}

function hideModal(modalBackdrop, ...modalElements) {
     if (!modalBackdrop) return;
     modalBackdrop.classList.add('modal-hidden');
     modalElements.forEach(el => el?.classList.add('modal-hidden'));
}

function createDOMElement(tag, options = {}) {
    const element = document.createElement(tag);
    if (options.className) element.className = options.className;
    if (options.textContent) element.textContent = options.textContent;
    if (options.innerHTML) element.innerHTML = options.innerHTML;
    if (options.title) element.title = options.title;
    if (options.id) element.id = options.id;
    if (options.dataset) {
        for (const key in options.dataset) {
            if (Object.hasOwnProperty.call(options.dataset, key)) {
                 element.dataset[key] = options.dataset[key];
            }
        }
    }
    if (options.listeners) {
        for (const event in options.listeners) {
             if (Object.hasOwnProperty.call(options.listeners, event)) {
                element.addEventListener(event, options.listeners[event]);
            }
        }
    }
    if (options.children) {
        options.children.forEach(child => {
            if (child instanceof Node) {
                element.appendChild(child);
            }
        });
    }
    return element;
}

async function callGeminiApi(prompt, apiKey, history = []) {
     if (!apiKey) {
        return { error: "API Key not set. Please add it in Settings." };
     }

     const modelName = "gemini-1.5-flash-latest";
     const API_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

     const requestBody = {
         contents: [
             ...history,
             {
                 role: "user",
                 parts: [{ text: prompt }]
             }
         ],
         generationConfig: {}
     };

     try {
         const response = await fetch(API_ENDPOINT, {
             method: 'POST',
             headers: { 'Content-Type': 'application/json', },
             body: JSON.stringify(requestBody)
         });

         const responseData = await response.json();

         if (!response.ok) {
             console.error("Gemini REST API Error Response:", responseData);
             let errorMessage = `API Error (${response.status}): ${responseData.error?.message || 'Unknown API error.'}`;
             if (responseData.error?.details) {
                errorMessage += ` Details: ${JSON.stringify(responseData.error.details)}`;
             }
              if (response.status === 400) errorMessage += " (Check API key or request format)";
              if (response.status === 429) errorMessage += " (Quota exceeded)";
             return { error: errorMessage };
         }

         const generatedText = responseData.candidates?.[0]?.content?.parts?.[0]?.text;

         if (generatedText !== undefined) {
             return { text: generatedText };
         } else {
             console.error("Gemini REST API - Unexpected response structure:", responseData);
             const finishReason = responseData.candidates?.[0]?.finishReason;
             const safetyRatings = responseData.promptFeedback?.safetyRatings || responseData.candidates?.[0]?.safetyRatings;
             if (finishReason === 'SAFETY' || finishReason === 'RECITATION' || safetyRatings?.some(r => r.blocked)) {
                 return { error: `Content generation blocked due to safety reasons (Finish Reason: ${finishReason}).` };
             }
             return { error: "Failed to extract generated text from API response." };
         }

     } catch (error) {
         console.error("Network or Fetch Error calling Gemini REST API:", error);
         return { error: `Network Error: ${error.message}. Could not reach Gemini API.` };
     }
}

const projectTemplates = {
    web_basic: [
        { name: 'index.html', language: 'html', content: `<!DOCTYPE html>\n<html lang="en">\n<head>\n\t<meta charset="UTF-8">\n\t<title>\${projectName}</title>\n\t<link rel="stylesheet" href="style.css">\n</head>\n<body>\n\t<h1>Hello, \${projectName}!</h1>\n\t<p>Welcome to your new RyxIDE project.</p>\n\t<script src="script.js"></script>\n</body>\n</html>` },
        { name: 'style.css', language: 'css', content: `body {\n\tfont-family: sans-serif;\n\tpadding: 20px;\n\tline-height: 1.6;\n\tbackground-color: #f4f4f4;\n\tcolor: #333;\n}\n\nh1 {\n\tcolor: steelblue;\n}` },
        { name: 'script.js', language: 'javascript', content: `console.log('Project script for \${projectName} loaded!');\n\ndocument.addEventListener('DOMContentLoaded', () => {\n\tconsole.log('DOM fully loaded and parsed');\n\t\n});` }
    ],
    python_basic: [
        { name: 'main.py', language: 'python', content: `import sys\n\nprint(f"Hello from Python {sys.version} in \${projectName}!")\n\ndef main():\n\tprint("Running main function...")\n\t\n\nif __name__ == "__main__":\n\tmain()` }
    ],
     markdown_basic: [
        { name: 'README.md', language: 'markdown', content: `# \${projectName}\n\nThis is the README file for the \${projectName} project created in RyxIDE.` }
     ],
    empty: []
};

const starterContentByLanguage = {
     html: `<!DOCTYPE html>\n<html lang="en">\n<head>\n\t<meta charset="UTF-8">\n\t<title>New Page</title>\n\t<link rel="stylesheet" href="style.css">\n</head>\n<body>\n\t<h1>New HTML File</h1>\n\t<p>Content goes here.</p>\n\t<script src="script.js"></script>\n</body>\n</html>`,
     css: `body {\n\tfont-family: sans-serif;\n}`,
     javascript: `console.log("New JavaScript file created!");\n\n`,
     python: `import sys\n\nprint(f"Python {sys.version}")\n\n`,
     markdown: `# New Markdown File\n\n`,
     ruby: `# New Ruby File\n\nputs "Hello from Ruby!"\n`,
     csharp: `using System;\n\npublic class Program\n{\n\tpublic static void Main(string[] args)\n\t{\n\t\tConsole.WriteLine("New C# File!");\n\t}\n}`,
     java: `public class Main {\n\tpublic static void main(String[] args) {\n\t\tSystem.out.println("New Java File!");\n\t}\n}`,
     cpp: `#include <iostream>\n\nint main() {\n\tstd::cout << "New C++ File!" << std::endl;\n\treturn 0;\n}`,
     rust: `fn main() {\n\tprintln!("New Rust File!");\n}`,
     go: `package main\n\nimport "fmt"\n\nfunc main() {\n\tfmt.Println("New Go File!")\n}`,
     php: `<?php\n\necho "New PHP File!";\n?>`,
     json: `{\n\t"key": "value"\n}`,
     plaintext: ``,
 };

const externalSandboxLinks = {
    java: "https://www.jdoodle.com/online-java-compiler/",
    csharp: "https://dotnetfiddle.net/",
    cpp: "https://www.onlinegdb.com/online_c++_compiler",
    rust: "https://play.rust-lang.org/",
    go: "https://go.dev/play/",
    php: "https://paiza.io/en/projects/new?language=php",
    c: "https://www.onlinegdb.com/online_c_compiler",
};
