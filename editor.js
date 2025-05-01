import { Terminal } from '/@xterm/xterm';
import { FitAddon } from '/@xterm/addon-fit';

document.addEventListener('DOMContentLoaded', async () => {
    console.log("Editor DOMContentLoaded event triggered.");
    try {
        console.log("Fetching current project ID...");
        const projectId = await getCurrentProjectId();
        console.log("Current project ID fetched:", projectId);
        if (!projectId) {
            console.warn("No project ID found. Handling missing project scenario.");
            handleMissingProject("No project selected.");
            return;
        }

        console.log("Fetching project data from storage with project ID:", projectId);
        currentProject = await getProjectFromStorage(projectId);
        console.log("Loaded project data:", currentProject);
        if (!currentProject) {
            console.warn("Failed to load project data for project ID:", projectId);
            handleMissingProject("Failed to load project data.");
            return;
        }

        console.log("Fetching user settings...");
        currentSettings = await getSettings();
        console.log("Loaded user settings:", currentSettings);

        console.log("Ensuring project integrity for project:", currentProject);
        ensureProjectIntegrity();

        console.log("Updating UI with project name...");
        editorProjectNameH1.textContent = `RyxIDE - ${currentProject.name || 'Untitled'}`;
        console.log("UI project name updated to:", editorProjectNameH1.textContent);
        document.title = `RyxIDE - ${currentProject.name || 'Editor'}`;
        console.log("Document title updated to:", document.title);

        console.log("Updating credits...");
        updateCredits();

        console.log("Setting up base event listeners...");
        setupBaseEventListeners();

        console.log("Initializing terminal...");
        terminalManager.initializeTerminal();

        console.log("Setting up Monaco editor...");
        setupMonaco();
    } catch (err) {
        console.error("Editor initialization failed with error:", err);
        alert("Failed to initialize the editor. Please check the console.");
        console.log("Displaying error message in DOM...");
        document.body.innerHTML = `<div style="padding: 20px; color: red;"><h1>Init Error</h1><pre>${escapeHtml(String(err))}</pre></div>`;
    }
});

function handleMissingProject(message) {
    console.warn("Handling missing project with message:", message);
    console.log("Alerting user with message:", message + " Redirecting to dashboard.");
    alert(message + " Redirecting to dashboard.");
    console.log("Setting current project ID to null...");
    try {
        setCurrentProjectId(null);
        console.log("Current project ID set to null successfully.");
    } catch (err) {
        console.error("Error setting current project ID to null:", err);
    }
    console.log("Redirecting to dashboard (index.html)...");
    window.location.href = 'index.html';
}

function ensureProjectIntegrity() {
    console.log("Ensuring project integrity for current project:", currentProject);
    if (!currentProject.files) {
        console.warn("Project files missing. Initializing empty files array.");
        currentProject.files = [];
        console.log("Initialized empty files array:", currentProject.files);
    }
    if (!currentProject.aiChats || !Array.isArray(currentProject.aiChats) || currentProject.aiChats.length === 0) {
        console.warn("AI chats missing or invalid. Creating default chat.");
        const defaultChatId = generateUUID();
        console.log("Generated default chat ID:", defaultChatId);
        currentProject.aiChats = [{ id: defaultChatId, name: 'Chat 1', messages: [], createdAt: Date.now() }];
        currentProject.currentAiChatId = defaultChatId;
        console.log("Created default AI chat:", currentProject.aiChats);
        console.log("Set current AI chat ID to:", defaultChatId);
    }
    if (!currentProject.currentAiChatId || !currentProject.aiChats.find(c => c.id === currentProject.currentAiChatId)) {
        console.warn("Current AI chat ID missing or invalid. Setting to first chat.");
        const newChatId = currentProject.aiChats[0]?.id || null;
        currentProject.currentAiChatId = newChatId;
        console.log("Set current AI chat ID to:", newChatId);
    }
    console.log("Validating and fixing AI chat messages...");
    currentProject.aiChats.forEach(chat => {
        if (!chat.messages) {
            console.warn(`Chat ${chat.id} missing messages. Initializing empty messages array.`);
            chat.messages = [];
            console.log(`Initialized empty messages array for chat ${chat.id}:`, chat.messages);
        }
        const originalLength = chat.messages.length;
        chat.messages = chat.messages.filter(msg => {
            const isValid = msg && msg.role && typeof msg.parts === 'string';
            if (!isValid) console.warn(`Invalid message found in chat ${chat.id}:`, msg);
            return isValid;
        });
        console.log(`Filtered messages for chat ${chat.id}. Original length: ${originalLength}, New length: ${chat.messages.length}`);
    });
    console.log("Project integrity ensured:", currentProject);
}

function postMonacoSetup() {
    console.log("Running post-Monaco setup...");
    currentOpenFileId = currentProject.openFileId || currentProject.files[0]?.id || null;
    console.log("Determined current open file ID:", currentOpenFileId);
    
    console.log("Rendering file list...");
    try {
        fileManager.renderList();
        console.log("File list rendered successfully.");
    } catch (err) {
        console.error("Error rendering file list:", err);
    }

    if (currentOpenFileId) {
        console.log("Opening file with ID:", currentOpenFileId);
        try {
            fileManager.open(currentOpenFileId, true);
            console.log("File opened successfully with ID:", currentOpenFileId);
        } catch (err) {
            console.error("Error opening file with ID:", currentOpenFileId, "Error:", err);
        }
    } else {
        console.log("No file to open. Setting default editor state.");
        try {
            updateRunButtonState();
            console.log("Run button state updated.");
        } catch (err) {
            console.error("Error updating run button state:", err);
        }
        if (editor) {
            console.log("Setting default editor value...");
            editor.setValue("// Welcome!");
            console.log("Editor value set to default.");
            monaco.editor.setModelLanguage(editor.getModel(), 'plaintext');
            console.log("Editor language set to plaintext.");
        } else {
            console.warn("Editor instance not available to set default state.");
        }
    }
    
    console.log("Loading AI chats...");
    try {
        aiChatManager.loadChats();
        console.log("AI chats loaded successfully.");
    } catch (err) {
        console.error("Error loading AI chats:", err);
    }
    
    console.log("Applying settings...");
    applySettings();
    
    console.log("Setting editor dirty state to false...");
    setEditorDirty(false);
    
    console.log("Setting up editor-specific event listeners...");
    try {
        setupEditorSpecificEventListeners();
        console.log("Editor-specific event listeners set up successfully.");
    } catch (err) {
        console.error("Error setting up editor-specific event listeners:", err);
    }
    
    console.log("Fitting terminal...");
    try {
        terminalManager.fitTerminal();
        console.log("Terminal fitted successfully.");
    } catch (err) {
        console.error("Error fitting terminal:", err);
    }
}

function applySettings() {
    console.log("Applying editor and terminal settings with current settings:", currentSettings);
    if (editor) {
        console.log("Applying Monaco editor settings...");
        try {
            monaco.editor.setTheme(currentSettings.theme);
            console.log("Monaco editor theme set to:", currentSettings.theme);
            editor.updateOptions({
                fontSize: currentSettings.fontSize || 14,
                tabSize: currentSettings.tabSize || 4,
                renderWhitespace: currentSettings.renderWhitespace || 'none',
                wordWrap: currentSettings.wordWrap || 'on'
            });
            console.log("Monaco editor options updated:", {
                fontSize: currentSettings.fontSize || 14,
                tabSize: currentSettings.tabSize || 4,
                renderWhitespace: currentSettings.renderWhitespace || 'none',
                wordWrap: currentSettings.wordWrap || 'on'
            });
        } catch (err) {
            console.error("Error applying Monaco editor settings:", err);
        }
    } else {
        console.warn("Editor instance not available to apply settings.");
    }
    
    console.log("Updating theme selector header...");
    themeSelectorHeader.value = currentSettings.theme;
    console.log("Theme selector header updated to:", currentSettings.theme);
    
    if (xtermInstance) {
        console.log("Applying Xterm theme...");
        try {
            const theme = getXtermTheme(currentSettings.theme);
            xtermInstance.setOption('theme', theme);
            console.log("Xterm theme applied:", theme);
        } catch (err) {
            console.error("Error applying Xterm theme:", err);
        }
    } else {
        console.warn("Xterm instance not available to apply theme.");
    }
}

function getXtermTheme(editorTheme) {
    console.log("Getting Xterm theme for editor theme:", editorTheme);
    const theme = editorTheme === 'vs' ? {
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
    console.log("Returning Xterm theme:", theme);
    return theme;
}

function setupMonaco() {
    console.log("Setting up Monaco editor...");
    try {
        console.log("Configuring RequireJS paths for Monaco...");
        require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.46.0/min/vs' } });
        console.log("RequireJS paths configured.");
    } catch (err) {
        console.error("Error configuring RequireJS paths:", err);
    }
    
    console.log("Setting up Monaco environment...");
    window.MonacoEnvironment = {
        getWorkerUrl: function (moduleId, label) {
            console.log("Loading Monaco worker for moduleId:", moduleId, "label:", label);
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
            const workerUrl = `${workerBase}${workerPath}`;
            console.log("Returning worker URL:", workerUrl);
            return workerUrl;
        }
    };
    
    console.log("Loading Monaco editor module...");
    require(['vs/editor/editor.main'], function () {
        try {
            console.log("Initializing Monaco editor instance with container:", editorContainer);
            editor = monaco.editor.create(editorContainer, {
                theme: currentSettings.theme,
                automaticLayout: true,
                minimap: { enabled: true },
                wordWrap: 'on',
                contextmenu: true,
                fontSize: 14,
                scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10 },
            });
            console.log("Monaco editor instance created successfully.");
            
            console.log("Setting up editor content change listener...");
            editor.onDidChangeModelContent((e) => {
                console.log("Editor content changed event triggered:", e);
                if (!e.isFlush && currentProject && currentOpenFileId) {
                    console.log("Editor content changed is not a flush event, project and file ID exist.");
                    console.log("Marking editor as dirty...");
                    setEditorDirty(true);
                    console.log("Handling auto-save due to content change...");
                    handleAutoSave();
                } else {
                    console.log("Content change ignored: Flush event or missing project/file ID.");
                }
            });
            console.log("Editor content change listener set up.");
            
            console.log("Setting up editor keybindings...");
            setupEditorKeybindings();
            console.log("Setting up Monaco completions...");
            setupMonacoCompletions();
            console.log("Running post-Monaco setup...");
            postMonacoSetup();
        } catch (error) {
            console.error("Monaco initialization error:", error);
            console.log("Displaying Monaco init error in editor container...");
            editorContainer.textContent = `Editor Init Error: ${error.message}. Reload.`;
            console.log("Disabling editor features due to init error...");
            disableEditorFeatures();
        }
    }, function (error) {
        console.error("Monaco module load error:", error);
        console.log("Displaying Monaco load error in editor container...");
        editorContainer.textContent = `Editor Load Error. Check connection/console. Error: ${error}`;
        console.log("Disabling editor features due to load error...");
        disableEditorFeatures();
    });
}

function disableEditorFeatures() {
    console.warn("Disabling editor features due to error.");
    try {
        console.log("Disabling save project button...");
        saveProjectButton.disabled = true;
        console.log("Disabling run button...");
        runButton.disabled = true;
        console.log("Hiding run external button...");
        runExternalButton.style.display = 'none';
        console.log("Disabling find button...");
        findButton.disabled = true;
        console.log("Disabling replace button...");
        replaceButton.disabled = true;
        console.log("Disabling go to line button...");
        gotoLineButton.disabled = true;
        console.log("Disabling go to line input...");
        gotoLineInput.disabled = true;
        console.log("Disabling rename file button...");
        renameFileButton.disabled = true;
        console.log("Disabling delete file button...");
        deleteFileButton.disabled = true;
        console.log("Disabling AI send button...");
        aiSendButton.disabled = true;
        console.log("Disabling AI chat input...");
        aiChatInput.disabled = true;
        console.log("Editor features disabled successfully.");
    } catch (err) {
        console.error("Error disabling editor features:", err);
    }
}

function setupEditorKeybindings() {
    console.log("Setting up editor keybindings...");
    if (!editor) {
        console.warn("Editor instance not available for keybindings setup.");
        return;
    }
    try {
        console.log("Adding Ctrl/Cmd + S keybinding for save project...");
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, handleSaveProject, '!suggestWidgetVisible && !findWidgetVisible && !renameInputVisible');
        console.log("Adding Ctrl/Cmd + F keybinding for find...");
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyF, () => {
            console.log("Running find action...");
            editor.getAction('actions.find').run();
        });
        console.log("Adding Ctrl/Cmd + H keybinding for find/replace...");
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyH, () => {
            console.log("Running find/replace action...");
            editor.getAction('editor.action.startFindReplaceAction').run();
        });
        console.log("Editor keybindings set up successfully.");
    } catch (err) {
        console.error("Error setting up editor keybindings:", err);
    }
}

function setupMonacoCompletions() {
    console.log("Setting up Monaco completions...");
    if (!window.monaco) {
        console.warn("Monaco instance not found. Skipping completions setup.");
        return;
    }
    try {
        console.log("Setting JavaScript/TypeScript compiler options...");
        monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
            target: monaco.languages.typescript.ScriptTarget.ES2016,
            allowNonTsExtensions: true
        });
        console.log("JavaScript/TypeScript compiler options set.");

        console.log("Registering JavaScript completion provider...");
        monaco.languages.registerCompletionItemProvider('javascript', {
            provideCompletionItems: (model, position) => {
                console.log("Providing JavaScript completion items at position:", position);
                const word = model.getWordUntilPosition(position);
                const range = {
                    startLineNumber: position.lineNumber,
                    endLineNumber: position.lineNumber,
                    startColumn: word.startColumn,
                    endColumn: word.endColumn
                };
                const suggestions = [
                    { label: 'clog', detail: 'console.log()', kind: 17, insertText: 'console.log($1);', insertTextRules: 4, range },
                    { label: 'fun', detail: 'function', kind: 17, insertText: 'function ${1:name}($2) {\n\t$0\n}', insertTextRules: 4, range },
                    { label: 'forloop', detail: 'for loop', kind: 17, insertText: 'for (let ${1:i} = 0; ${1:i} < ${2:array}.length; ${1:i}++) {\n\tconst ${3:element} = ${2:array}[${1:i}];\n\t$0\n}', insertTextRules: 4, range },
                    { label: 'timeout', detail: 'setTimeout', kind: 17, insertText: 'setTimeout(() => {\n\t$0\n}, ${1:1000});', insertTextRules: 4, range }
                ];
                console.log("Returning JavaScript completion suggestions:", suggestions);
                return { suggestions };
            }
        });

        console.log("Registering Python completion provider...");
        monaco.languages.registerCompletionItemProvider('python', {
            provideCompletionItems: (model, position) => {
                console.log("Providing Python completion items at position:", position);
                const word = model.getWordUntilPosition(position);
                const range = {
                    startLineNumber: position.lineNumber,
                    endLineNumber: position.lineNumber,
                    startColumn: word.startColumn,
                    endColumn: word.endColumn
                };
                const suggestions = [
                    { label: 'fprint', detail: 'print(f"...")', kind: 17, insertText: 'print(f"$1")', insertTextRules: 4, range },
                    { label: 'def', detail: 'def function', kind: 17, insertText: 'def ${1:name}($2):\n\t"""$3"""\n\t$0', insertTextRules: 4, range },
                    { label: 'class', detail: 'class definition', kind: 17, insertText: 'class ${1:Name}:\n\tdef __init__(self, $2):\n\t\t$0', insertTextRules: 4, range }
                ];
                console.log("Returning Python completion suggestions:", suggestions);
                return { suggestions };
            }
        });

        console.log("Registering HTML completion provider...");
        monaco.languages.registerCompletionItemProvider('html', {
            provideCompletionItems: (model, position) => {
                console.log("Providing HTML completion items at position:", position);
                const word = model.getWordUntilPosition(position);
                const range = {
                    startLineNumber: position.lineNumber,
                    endLineNumber: position.lineNumber,
                    startColumn: word.startColumn,
                    endColumn: word.endColumn
                };
                const suggestions = [
                    { label: 'html5', detail: 'HTML5 Boilerplate', kind: 17, insertText: '<!DOCTYPE html>\n<html lang="en">\n<head>\n\t<meta charset="UTF-8">\n\t<meta name="viewport" content="width=device-width, initial-scale=1.0">\n\t<title>${1:Document}</title>\n\t<link rel="stylesheet" href="${2:style.css}">\n</head>\n<body>\n\t$0\n\t<script src="${3:script.js}"></script>\n</body>\n</html>', insertTextRules: 4, range },
                    { label: 'div', detail: '<div> element', kind: 17, insertText: '<div class="$1">\n\t$0\n</div>', insertTextRules: 4, range },
                    { label: 'canvas', detail: '<canvas> element', kind: 17, insertText: '<canvas id="$1" width="$2" height="$3"></canvas>', insertTextRules: 4, range }
                ];
                console.log("Returning HTML completion suggestions:", suggestions);
                return { suggestions };
            }
        });
        console.log("Monaco completions set up successfully.");
    } catch (err) {
        console.error("Error setting up Monaco completions:", err);
    }
}

function setEditorDirty(isDirty) {
    console.log("Setting editor dirty state to:", isDirty);
    if (!currentOpenFileId && isDirty) {
        console.log("No current open file ID. Forcing dirty state to false.");
        isDirty = false;
    }
    if (editorDirty === isDirty) {
        console.log("Editor dirty state unchanged. Skipping update.");
        return;
    }
    editorDirty = isDirty;
    console.log("Updating save project button state to:", !isDirty);
    saveProjectButton.disabled = !isDirty;
    console.log("Updating status indicator text to:", isDirty ? '* Unsaved Changes' : '');
    statusIndicator.textContent = isDirty ? '* Unsaved Changes' : '';
    console.log("Updating status indicator class to:", isDirty ? 'status-indicator status-warning' : 'status-indicator');
    statusIndicator.className = isDirty ? 'status-indicator status-warning' : 'status-indicator';
    const newTitle = `RyxIDE - ${currentProject?.name || 'Editor'}${isDirty ? '*' : ''}`;
    console.log("Updating document title to:", newTitle);
    document.title = newTitle;
}

function updateStatus(message, type = 'info', duration = 3000) {
    console.log("Updating status with message:", message, "type:", type, "duration:", duration);
    statusIndicator.textContent = message;
    console.log("Status indicator text set to:", message);
    statusIndicator.className = `status-indicator status-${type}`;
    console.log("Status indicator class set to:", statusIndicator.className);
    if (duration > 0) {
        console.log("Scheduling status clear after duration:", duration);
        setTimeout(() => {
            if (!editorDirty && statusIndicator.textContent === message) {
                console.log("Clearing status indicator as no unsaved changes and message matches.");
                statusIndicator.textContent = '';
                statusIndicator.className = 'status-indicator';
                console.log("Status indicator cleared.");
            } else {
                console.log("Status not cleared: Editor dirty or message changed.");
            }
        }, duration);
    }
}

async function handleSaveProject() {
    console.log("Saving project...");
    if (!currentProject || !editor) {
        console.warn("No project or editor instance available for saving. Aborting save.");
        return;
    }
    if (currentOpenFileId) {
        console.log("Finding file with ID:", currentOpenFileId);
        const file = currentProject.files.find(f => f.id === currentOpenFileId);
        if (file) {
            console.log("File found:", file);
            file.content = editor.getValue();
            console.log("Updated file content for file ID:", currentOpenFileId, "Content:", file.content);
        } else {
            console.error("Error: Open file data missing for ID:", currentOpenFileId);
            updateStatus('Error: Open file data missing!', 'error', 5000);
            return;
        }
    } else {
        console.log("No current open file ID. Proceeding with project save without file update.");
    }
    console.log("Saving project to storage:", currentProject);
    try {
        const saved = await saveProjectToStorage(currentProject);
        if (saved) {
            console.log("Project saved successfully to storage.");
            setEditorDirty(false);
            updateStatus(`Project saved.`, 'success');
        } else {
            console.error("Error saving project: saveProjectToStorage returned false.");
            updateStatus('Error Saving Project!', 'error', 5000);
        }
    } catch (err) {
        console.error("Exception while saving project to storage:", err);
        updateStatus('Error Saving Project: ' + err.message, 'error', 5000);
    }
}

function handleAutoSave() {
    console.log("Handling auto-save with settings:", currentSettings, "editorDirty:", editorDirty);
    if (!currentSettings.autoSave || !editorDirty) {
        console.log("Auto-save skipped: Auto-save disabled or editor not dirty.");
        return;
    }
    console.log("Clearing previous auto-save timeout...");
    clearTimeout(autoSaveTimeout);
    console.log("Setting new auto-save timeout for 1500ms...");
    autoSaveTimeout = setTimeout(() => {
        console.log("Auto-saving project after timeout...");
        handleSaveProject();
    }, 1500);
}
