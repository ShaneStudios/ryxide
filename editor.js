import { Terminal } from '/@xterm/xterm';
import { FitAddon } from '/@xterm/addon-fit';

document.addEventListener('DOMContentLoaded', async () => {
    console.log("Editor DOMContentLoaded event triggered.");
    try {
        console.log("Fetching current project ID...");
        const projectId = await getCurrentProjectId();
        console.log("Current project ID:", projectId);
        if (!projectId) {
            console.warn("No project ID found.");
            handleMissingProject("No project selected.");
            return;
        }

        console.log("Fetching project data from storage...");
        currentProject = await getProjectFromStorage(projectId);
        console.log("Loaded project data:", currentProject);
        if (!currentProject) {
            console.warn("Failed to load project data.");
            handleMissingProject("Failed to load project data.");
            return;
        }

        console.log("Fetching user settings...");
        currentSettings = await getSettings();
        console.log("Loaded settings:", currentSettings);

        console.log("Ensuring project integrity...");
        ensureProjectIntegrity();

        console.log("Updating UI with project name...");
        editorProjectNameH1.textContent = `RyxIDE - ${currentProject.name || 'Untitled'}`;
        document.title = `RyxIDE - ${currentProject.name || 'Editor'}`;

        console.log("Updating credits...");
        updateCredits();

        console.log("Setting up base event listeners...");
        setupBaseEventListeners();

        console.log("Initializing terminal...");
        terminalManager.initializeTerminal();

        console.log("Setting up Monaco editor...");
        setupMonaco();
    } catch (err) {
        console.error("Editor Initialization failed:", err);
        alert("Failed to initialize the editor. Please check the console.");
        document.body.innerHTML = `<div style="padding: 20px; color: red;"><h1>Init Error</h1><pre>${escapeHtml(String(err))}</pre></div>`;
    }
});

function handleMissingProject(message) {
    console.warn("Handling missing project:", message);
    alert(message + " Redirecting to dashboard.");
    setCurrentProjectId(null);
    window.location.href = 'index.html';
}

function ensureProjectIntegrity() {
    console.log("Ensuring project integrity...");
    if (!currentProject.files) {
        console.warn("Project files missing. Initializing empty files array.");
        currentProject.files = [];
    }
    if (!currentProject.aiChats || !Array.isArray(currentProject.aiChats) || currentProject.aiChats.length === 0) {
        console.warn("AI chats missing or invalid. Creating default chat.");
        const defaultChatId = generateUUID();
        currentProject.aiChats = [{ id: defaultChatId, name: 'Chat 1', messages: [], createdAt: Date.now() }];
        currentProject.currentAiChatId = defaultChatId;
    }
    if (!currentProject.currentAiChatId || !currentProject.aiChats.find(c => c.id === currentProject.currentAiChatId)) {
        console.warn("Current AI chat ID missing or invalid. Setting to first chat.");
        currentProject.currentAiChatId = currentProject.aiChats[0]?.id || null;
    }
    currentProject.aiChats.forEach(chat => {
        if (!chat.messages) {
            console.warn(`Chat ${chat.id} missing messages. Initializing empty messages array.`);
            chat.messages = [];
        }
        chat.messages = chat.messages.filter(msg => msg && msg.role && typeof msg.parts === 'string');
    });
    console.log("Project integrity ensured:", currentProject);
}

function postMonacoSetup() {
    console.log("Running post-Monaco setup...");
    currentOpenFileId = currentProject.openFileId || currentProject.files[0]?.id || null;
    console.log("Current open file ID:", currentOpenFileId);
    fileManager.renderList();
    if (currentOpenFileId) {
        console.log("Opening file with ID:", currentOpenFileId);
        fileManager.open(currentOpenFileId, true);
    } else {
        console.log("No file to open. Setting default editor state.");
        updateRunButtonState();
        if (editor) {
            editor.setValue("// Welcome!");
            monaco.editor.setModelLanguage(editor.getModel(), 'plaintext');
        }
    }
    console.log("Loading AI chats...");
    aiChatManager.loadChats();
    console.log("Applying settings...");
    applySettings();
    console.log("Setting editor dirty state to false...");
    setEditorDirty(false);
    console.log("Setting up editor-specific event listeners...");
    setupEditorSpecificEventListeners();
    console.log("Fitting terminal...");
    terminalManager.fitTerminal();
}

function applySettings() {
    console.log("Applying editor and terminal settings...");
    if (editor) {
        console.log("Applying Monaco editor settings...");
        monaco.editor.setTheme(currentSettings.theme);
        editor.updateOptions({
            fontSize: currentSettings.fontSize || 14,
            tabSize: currentSettings.tabSize || 4,
            renderWhitespace: currentSettings.renderWhitespace || 'none',
            wordWrap: currentSettings.wordWrap || 'on'
        });
    }
    console.log("Updating theme selector header...");
    themeSelectorHeader.value = currentSettings.theme;
    if (xtermInstance) {
        console.log("Applying Xterm theme...");
        xtermInstance.setOption('theme', getXtermTheme(currentSettings.theme));
    }
}

function getXtermTheme(editorTheme) {
    console.log("Getting Xterm theme for editor theme:", editorTheme);
    return editorTheme === 'vs' ? {
        background: '#ffffff',
        foreground: '#000000',
        cursor: '#000000',
        selectionBackground: '#add6ff',
        selectionForeground: '#000000'
    } : {
        background: '#1e1e1e',
        foreground: '#cccccc',
        cursor: '#cccccc',
        selectionBackground: '#264f78',
        selectionForeground: '#ffffff'
    };
}

function setupMonaco() {
    console.log("Setting up Monaco editor...");
    require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.46.0/min/vs' } });
    window.MonacoEnvironment = {
        getWorkerUrl: function (moduleId, label) {
            console.log("Loading Monaco worker for label:", label);
            const workerMap = {
                'editorWorkerService': 'vs/editor/editor.worker.js',
                'css': 'vs/language/css/css.worker.js',
                'html': 'vs/language/html/html.worker.js',
                'json': 'vs/language/json/json.worker.js',
                'typescript': 'vs/language/typescript/ts.worker.js',
                'javascript': 'vs/language/typescript/ts.worker.js'
            };
            const workerBase = 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.46.0/min/';
            const workerPath = workerMap[label] || workerMap.editorWorkerService;
            return `${workerBase}${workerPath}`;
        }
    };
    require(['vs/editor/editor.main'], function () {
        try {
            console.log("Initializing Monaco editor instance...");
            editor = monaco.editor.create(editorContainer, {
                theme: currentSettings.theme,
                automaticLayout: true,
                minimap: { enabled: true },
                wordWrap: 'on',
                contextmenu: true,
                fontSize: 14,
                scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10 },
            });
            console.log("Setting up editor content change listener...");
            editor.onDidChangeModelContent((e) => {
                console.log("Editor content changed:", e);
                if (!e.isFlush && currentProject && currentOpenFileId) {
                    console.log("Marking editor as dirty...");
                    setEditorDirty(true);
                    console.log("Handling auto-save...");
                    handleAutoSave();
                }
            });
            console.log("Setting up editor keybindings...");
            setupEditorKeybindings();
            console.log("Setting up Monaco completions...");
            setupMonacoCompletions();
            console.log("Running post-Monaco setup...");
            postMonacoSetup();
        } catch (error) {
            console.error("Monaco Init Error:", error);
            editorContainer.textContent = `Editor Init Error: ${error.message}. Reload.`;
            disableEditorFeatures();
        }
    }, function (error) {
        console.error("Monaco Load Error:", error);
        editorContainer.textContent = `Editor Load Error. Check connection/console. Error: ${error}`;
        disableEditorFeatures();
    });
}

function disableEditorFeatures() {
    console.warn("Disabling editor features due to error.");
    saveProjectButton.disabled = true;
    runButton.disabled = true;
    runExternalButton.style.display = 'none';
    findButton.disabled = true;
    replaceButton.disabled = true;
    gotoLineButton.disabled = true;
    gotoLineInput.disabled = true;
    renameFileButton.disabled = true;
    deleteFileButton.disabled = true;
    aiSendButton.disabled = true;
    aiChatInput.disabled = true;
}

function setupEditorKeybindings() {
    console.log("Setting up editor keybindings...");
    if (!editor) return;
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, handleSaveProject, '!suggestWidgetVisible && !findWidgetVisible && !renameInputVisible');
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyF, () => editor.getAction('actions.find').run());
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyH, () => editor.getAction('editor.action.startFindReplaceAction').run());
}

function setupMonacoCompletions() {
    console.log("Setting up Monaco completions...");
    if (!window.monaco) {
        console.warn("Monaco instance not found.");
        return;
    }
    monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
        target: monaco.languages.typescript.ScriptTarget.ES2016,
        allowNonTsExtensions: true
    });
    monaco.languages.registerCompletionItemProvider('javascript', {
        provideCompletionItems: (model, position) => {
            const word = model.getWordUntilPosition(position);
            const range = {
                startLineNumber: position.lineNumber,
                endLineNumber: position.lineNumber,
                startColumn: word.startColumn,
                endColumn: word.endColumn
            };
            return {
                suggestions: [
                    {
                        label: 'clog',
                        detail: 'console.log()',
                        kind: 17,
                        insertText: 'console.log($1);',
                        insertTextRules: 4,
                        range: range
                    },
                    {
                        label: 'fun',
                        detail: 'function',
                        kind: 17,
                        insertText: 'function ${1:name}($2) {\n\t$0\n}',
                        insertTextRules: 4,
                        range: range
                    },
                    {
                        label: 'forloop',
                        detail: 'for loop',
                        kind: 17,
                        insertText: 'for (let ${1:i} = 0; ${1:i} < ${2:array}.length; ${1:i}++) {\n\tconst ${3:element} = ${2:array}[${1:i}];\n\t$0\n}',
                        insertTextRules: 4,
                        range: range
                    },
                    {
                        label: 'timeout',
                        detail: 'setTimeout',
                        kind: 17,
                        insertText: 'setTimeout(() => {\n\t$0\n}, ${1:1000});',
                        insertTextRules: 4,
                        range: range
                    }
                ]
            };
        }
    });
    monaco.languages.registerCompletionItemProvider('python', {
        provideCompletionItems: (model, position) => {
            const word = model.getWordUntilPosition(position);
            const range = {
                startLineNumber: position.lineNumber,
                endLineNumber: position.lineNumber,
                startColumn: word.startColumn,
                endColumn: word.endColumn
            };
            return {
                suggestions: [
                    {
                        label: 'fprint',
                        detail: 'print(f"...")',
                        kind: 17,
                        insertText: 'print(f"$1")',
                        insertTextRules: 4,
                        range: range
                    },
                    {
                        label: 'def',
                        detail: 'def function',
                        kind: 17,
                        insertText: 'def ${1:name}($2):\n\t"""$3"""\n\t$0',
                        insertTextRules: 4,
                        range: range
                    },
                    {
                        label: 'class',
                        detail: 'class definition',
                        kind: 17,
                        insertText: 'class ${1:Name}:\n\tdef __init__(self, $2):\n\t\t$0',
                        insertTextRules: 4,
                        range: range
                    }
                ]
            };
        }
    });
    monaco.languages.registerCompletionItemProvider('html', {
        provideCompletionItems: (model, position) => {
            const word = model.getWordUntilPosition(position);
            const range = {
                startLineNumber: position.lineNumber,
                endLineNumber: position.lineNumber,
                startColumn: word.startColumn,
                endColumn: word.endColumn
            };
            return {
                suggestions: [
                    {
                        label: 'html5',
                        detail: 'HTML5 Boilerplate',
                        kind: 17,
                        insertText: '<!DOCTYPE html>\n<html lang="en">\n<head>\n\t<meta charset="UTF-8">\n\t<meta name="viewport" content="width=device-width, initial-scale=1.0">\n\t<title>${1:Document}</title>\n\t<link rel="stylesheet" href="${2:style.css}">\n</head>\n<body>\n\t$0\n\t<script src="${3:script.js}"></script>\n</body>\n</html>',
                        insertTextRules: 4,
                        range: range
                    },
                    {
                        label: 'div',
                        detail: '<div> element',
                        kind: 17,
                        insertText: '<div class="$1">\n\t$0\n</div>',
                        insertTextRules: 4,
                        range: range
                    },
                    {
                        label: 'canvas',
                        detail: '<canvas> element',
                        kind: 17,
                        insertText: '<canvas id="$1" width="$2" height="$3"></canvas>',
                        insertTextRules: 4,
                        range: range
                    }
                ]
            };
        }
    });
}

function setEditorDirty(isDirty) {
    console.log("Setting editor dirty state to:", isDirty);
    if (!currentOpenFileId && isDirty) isDirty = false;
    if (editorDirty === isDirty) return;
    editorDirty = isDirty;
    saveProjectButton.disabled = !isDirty;
    statusIndicator.textContent = isDirty ? '* Unsaved Changes' : '';
    statusIndicator.className = isDirty ? 'status-indicator status-warning' : 'status-indicator';
    document.title = `RyxIDE - ${currentProject?.name || 'Editor'}${isDirty ? '*' : ''}`;
}

function updateStatus(message, type = 'info', duration = 3000) {
    console.log("Updating status:", message, "Type:", type, "Duration:", duration);
    statusIndicator.textContent = message;
    statusIndicator.className = `status-indicator status-${type}`;
    if (duration > 0) {
        setTimeout(() => {
            if (!editorDirty && statusIndicator.textContent === message) {
                statusIndicator.textContent = '';
                statusIndicator.className = 'status-indicator';
            }
        }, duration);
    }
}

async function handleSaveProject() {
    console.log("Saving project...");
    if (!currentProject || !editor) {
        console.warn("No project or editor instance available for saving.");
        return;
    }
    if (currentOpenFileId) {
        const file = currentProject.files.find(f => f.id === currentOpenFileId);
        if (file) {
            file.content = editor.getValue();
            console.log("Updated file content:", file);
        } else {
            console.error("Error: Open file data missing!");
            updateStatus('Error: Open file data missing!', 'error', 5000);
            return;
        }
    }
    const saved = await saveProjectToStorage(currentProject);
    if (saved) {
        console.log("Project saved successfully.");
        setEditorDirty(false);
        updateStatus(`Project saved.`, 'success');
    } else {
        console.error("Error saving project.");
        updateStatus('Error Saving Project!', 'error', 5000);
    }
}

function handleAutoSave() {
    console.log("Handling auto-save...");
    if (!currentSettings.autoSave || !editorDirty) return;
    clearTimeout(autoSaveTimeout);
    autoSaveTimeout = setTimeout(() => {
        console.log("Auto-saving project...");
        handleSaveProject();
    }, 1500);
}
