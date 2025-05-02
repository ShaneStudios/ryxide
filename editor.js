document.addEventListener('DOMContentLoaded', () => {
    const editorContainer = document.getElementById('editor-container');
    const runButton = document.getElementById('run-button');
    const runExternalButton = document.getElementById('run-external-button');
    const previewFrame = document.getElementById('preview-frame');
    const terminalContainer = document.getElementById('terminal-container');
    const outputConsole = document.getElementById('output-console');
    const loaderOverlay = document.getElementById('loader-overlay');
    const loaderText = document.getElementById('loader-text');
    const creditsElement = document.getElementById('credits');
    const statusIndicator = document.getElementById('status-indicator');
    const fileListUl = document.getElementById('file-list');
    const editorProjectNameH1 = document.getElementById('editor-project-name');
    const backToDashboardButton = document.getElementById('back-to-dashboard-button');
    const saveProjectButton = document.getElementById('save-project-button');
    const newFileButton = document.getElementById('new-file-button');
    const deleteFileButton = document.getElementById('delete-file-button');
    const renameFileButton = document.getElementById('rename-file-button');
    const themeSelectorHeader = document.getElementById('theme-selector-header');
    const findButton = document.getElementById('find-button');
    const replaceButton = document.getElementById('replace-button');
    const gotoLineInput = document.getElementById('goto-line-input');
    const gotoLineButton = document.getElementById('goto-line-button');
    const shortcutsButton = document.getElementById('shortcuts-button');
    const tabBar = document.querySelector('.tab-bar');
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    const aiChatInterface = document.getElementById('ai-chat-interface');
    const aiChatSelector = document.getElementById('ai-chat-selector');
    const aiNewChatButton = document.getElementById('ai-new-chat-button');
    const aiDeleteChatButton = document.getElementById('ai-delete-chat-button');
    const aiModeSelector = document.getElementById('ai-mode-selector');
    const aiChatMessages = document.getElementById('ai-chat-messages');
    const aiChatInput = document.getElementById('ai-chat-input');
    const aiSendButton = document.getElementById('ai-send-button');
    const modalBackdrop = document.getElementById('modal-backdrop');
    const newFileModal = document.getElementById('new-file-modal');
    const fileNameInput = document.getElementById('file-name-input');
    const createFileConfirmButton = document.getElementById('create-file-confirm-button');
    const createFileCancelButton = document.getElementById('create-file-cancel-button');
    const renameFileModal = document.getElementById('rename-file-modal');
    const newFileNameInput = document.getElementById('new-file-name-input');
    const renameFileConfirmButton = document.getElementById('rename-file-confirm-button');
    const renameFileCancelButton = document.getElementById('rename-file-cancel-button');
    const aiApplyModal = document.getElementById('ai-apply-modal');
    const aiApplyFilename = document.getElementById('ai-apply-filename');
    const aiApplyCodePreview = document.getElementById('ai-apply-code-preview');
    const aiApplyConfirmButton = document.getElementById('ai-apply-confirm-button');
    const aiApplyCancelButton = document.getElementById('ai-apply-cancel-button');
    const shortcutsModal = document.getElementById('shortcuts-modal');
    const shortcutsCloseButton = document.getElementById('shortcuts-close-button');

    let editor = null;
    let currentProject = null;
    let currentOpenFileId = null;
    let editorDirty = false;
    let currentAiChat = null;
    let currentAiApiCall = false;
    let aiApplyAction = null;
    let currentSettings = {};
    let autoSaveTimeout = null;
    let jqTerminal = null;
    let isTerminalProcessing = false;

    const PYTHON_BACKEND_URL = 'https://ryxide-python-executor.onrender.com/run';
    const TERMINAL_EXECUTE_URL = 'https://ryxide-backend-terminal.onrender.com/execute';

    async function initializeEditorPage() {
        const projectId = await getCurrentProjectId();
        if (!projectId) { handleMissingProject("No project selected."); return; }
        currentProject = await getProjectFromStorage(projectId);
        if (!currentProject) { handleMissingProject("Failed to load project data."); return; }
        currentSettings = await getSettings();
        ensureProjectIntegrity();
        editorProjectNameH1.textContent = `RyxIDE - ${currentProject.name || 'Untitled'}`;
        document.title = `RyxIDE - ${currentProject.name || 'Editor'}`;
        updateCredits();
        setupBaseEventListeners();
        terminalManager.initializeTerminal();
        setupMonaco();
    }

    function handleMissingProject(message) {
         alert(message + " Redirecting to dashboard.");
         setCurrentProjectId(null);
         window.location.href = 'index.html';
    }

    function ensureProjectIntegrity() {
         if (!currentProject.files) currentProject.files = [];
         if (!currentProject.aiChats || !Array.isArray(currentProject.aiChats) || currentProject.aiChats.length === 0) { const defaultChatId = generateUUID(); currentProject.aiChats = [{ id: defaultChatId, name: 'Chat 1', messages: [], createdAt: Date.now() }]; currentProject.currentAiChatId = defaultChatId; }
          if (!currentProject.currentAiChatId || !currentProject.aiChats.find(c => c.id === currentProject.currentAiChatId)) { currentProject.currentAiChatId = currentProject.aiChats[0]?.id || null; }
          currentProject.aiChats.forEach(chat => { if (!chat.messages) chat.messages = []; chat.messages = chat.messages.filter(msg => msg && msg.role && typeof msg.parts === 'string'); });
    }

    function postMonacoSetup() {
         currentOpenFileId = currentProject.openFileId || currentProject.files[0]?.id || null;
         fileManager.renderList();
         if (currentOpenFileId) { fileManager.open(currentOpenFileId, true); }
         else { updateRunButtonState(); if (editor) { editor.setValue("// Welcome!"); monaco.editor.setModelLanguage(editor.getModel(), 'plaintext'); } }
         aiChatManager.loadChats();
         applySettings();
         setEditorDirty(false);
         setupEditorSpecificEventListeners();
         terminalManager.fitTerminal();
    }

     function applySettings() {
        if (editor) { monaco.editor.setTheme(currentSettings.theme); editor.updateOptions({ fontSize: currentSettings.fontSize || 14, tabSize: currentSettings.tabSize || 4, renderWhitespace: currentSettings.renderWhitespace || 'none', wordWrap: currentSettings.wordWrap || 'on' }); }
        themeSelectorHeader.value = currentSettings.theme;
        terminalManager.applyTheme();
    }

    function getXtermTheme(editorTheme) {
        return editorTheme === 'vs' ? { background: '#ffffff', foreground: '#000000', cursor: '#000000', selectionBackground: '#add6ff', selectionForeground: '#000000' } : { background: '#1e1e1e', foreground: '#cccccc', cursor: '#cccccc', selectionBackground: '#264f78', selectionForeground: '#ffffff' };
    }

    function setupMonaco() {
        require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.46.0/min/vs' }});
        window.MonacoEnvironment = { getWorkerUrl: function (moduleId, label) { const workerMap = { 'editorWorkerService': 'vs/editor/editor.worker.js', 'css': 'vs/language/css/css.worker.js', 'html': 'vs/language/html/html.worker.js', 'json': 'vs/language/json/json.worker.js', 'typescript': 'vs/language/typescript/ts.worker.js', 'javascript': 'vs/language/typescript/ts.worker.js' }; const workerBase = 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.46.0/min/'; const workerPath = workerMap[label] || workerMap.editorWorkerService; return `${workerBase}${workerPath}`; }};
        require(['vs/editor/editor.main'], function() {
            try {
                 editor = monaco.editor.create(editorContainer, { theme: currentSettings.theme, automaticLayout: true, minimap: { enabled: true }, wordWrap: 'on', contextmenu: true, fontSize: 14, scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10 }, });
                 editor.onDidChangeModelContent((e) => { if (!e.isFlush && currentProject && currentOpenFileId) { setEditorDirty(true); handleAutoSave(); } });
                 setupEditorKeybindings(); setupMonacoCompletions(); postMonacoSetup();
             } catch (error) { console.error("Monaco Init Error:", error); editorContainer.textContent = `Editor Init Error: ${error.message}. Reload.`; disableEditorFeatures(); }
        }, function(error) { console.error("Monaco Load Error:", error); editorContainer.textContent = `Editor Load Error. Check connection/console. Error: ${error}`; disableEditorFeatures(); });
    }

    function disableEditorFeatures(){ saveProjectButton.disabled = true; runButton.disabled = true; runExternalButton.style.display = 'none'; findButton.disabled = true; replaceButton.disabled = true; gotoLineButton.disabled = true; gotoLineInput.disabled = true; renameFileButton.disabled = true; deleteFileButton.disabled = true; aiSendButton.disabled = true; aiChatInput.disabled = true; }
    function setupEditorKeybindings() { if (!editor) return; editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, handleSaveProject, '!suggestWidgetVisible && !findWidgetVisible && !renameInputVisible'); editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyF, () => editor.getAction('actions.find').run()); editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyH, () => editor.getAction('editor.action.startFindReplaceAction').run()); }
    function setupMonacoCompletions() { if (!window.monaco) { return; } monaco.languages.typescript.javascriptDefaults.setCompilerOptions({ target: monaco.languages.typescript.ScriptTarget.ES2016, allowNonTsExtensions: true }); monaco.languages.registerCompletionItemProvider('javascript', { provideCompletionItems: (model, position) => { const word=model.getWordUntilPosition(position); const range={startLineNumber:position.lineNumber,endLineNumber:position.lineNumber,startColumn:word.startColumn,endColumn:word.endColumn}; return { suggestions: [ { label: 'clog', detail: 'console.log()', kind: 17, insertText: 'console.log($1);', insertTextRules: 4, range: range }, { label: 'fun', detail: 'function', kind: 17, insertText: 'function ${1:name}($2) {\n\t$0\n}', insertTextRules: 4, range: range }, { label: 'forloop', detail:'for loop', kind: 17, insertText: 'for (let ${1:i} = 0; ${1:i} < ${2:array}.length; ${1:i}++) {\n\tconst ${3:element} = ${2:array}[${1:i}];\n\t$0\n}', insertTextRules: 4, range: range }, { label: 'timeout', detail: 'setTimeout', kind: 17, insertText: 'setTimeout(() => {\n\t$0\n}, ${1:1000});', insertTextRules: 4, range: range }] }; }}); monaco.languages.registerCompletionItemProvider('python', { provideCompletionItems: (model, position) => { const word=model.getWordUntilPosition(position); const range={startLineNumber:position.lineNumber,endLineNumber:position.lineNumber,startColumn:word.startColumn,endColumn:word.endColumn}; return { suggestions: [ { label: 'fprint', detail: 'print(f"...")', kind: 17, insertText: 'print(f"$1")', insertTextRules: 4, range: range }, { label: 'def', detail:'def function', kind: 17, insertText: 'def ${1:name}($2):\n\t"""$3"""\n\t$0', insertTextRules: 4, range: range }, { label: 'class', detail:'class definition', kind: 17, insertText: 'class ${1:Name}:\n\tdef __init__(self, $2):\n\t\t$0', insertTextRules: 4, range: range }] }; }}); monaco.languages.registerCompletionItemProvider('html', { provideCompletionItems: (model, position) => { const word=model.getWordUntilPosition(position); const range={startLineNumber:position.lineNumber,endLineNumber:position.lineNumber,startColumn:word.startColumn,endColumn:word.endColumn}; return { suggestions: [ { label: 'html5', detail: 'HTML5 Boilerplate', kind: 17, insertText: '<!DOCTYPE html>\n<html lang="en">\n<head>\n\t<meta charset="UTF-8">\n\t<meta name="viewport" content="width=device-width, initial-scale=1.0">\n\t<title>${1:Document}</title>\n\t<link rel="stylesheet" href="${2:style.css}">\n</head>\n<body>\n\t$0\n\t<script src="${3:script.js}"></script>\n</body>\n</html>', insertTextRules: 4, range: range }, { label: 'div', detail:'<div> element', kind: 17, insertText: '<div class="$1">\n\t$0\n</div>', insertTextRules: 4, range: range }, { label: 'canvas', detail:'<canvas> element', kind: 17, insertText: '<canvas id="$1" width="$2" height="$3"></canvas>', insertTextRules: 4, range: range }] }; }}); }
    function setEditorDirty(isDirty) { if (!currentOpenFileId && isDirty) isDirty = false; if (editorDirty === isDirty) return; editorDirty = isDirty; saveProjectButton.disabled = !isDirty; statusIndicator.textContent = isDirty ? '* Unsaved Changes' : ''; statusIndicator.className = isDirty ? 'status-indicator status-warning' : 'status-indicator'; document.title = `RyxIDE - ${currentProject?.name || 'Editor'}${isDirty ? '*' : ''}`; }
    function updateStatus(message, type = 'info', duration = 3000) { statusIndicator.textContent = message; statusIndicator.className = `status-indicator status-${type}`; if (duration > 0) { setTimeout(() => { if (!editorDirty && statusIndicator.textContent === message) { statusIndicator.textContent = ''; statusIndicator.className = 'status-indicator'; } }, duration); } }
    async function handleSaveProject() { if (!currentProject || !editor) { return; } if (currentOpenFileId) { const file = currentProject.files.find(f => f.id === currentOpenFileId); if (file) { file.content = editor.getValue(); } else { updateStatus('Error: Open file data missing!', 'error', 5000); return; } } const saved = await saveProjectToStorage(currentProject); if(saved) { setEditorDirty(false); updateStatus(`Project saved.`, 'success'); } else { updateStatus('Error Saving Project!', 'error', 5000); } }
    function handleAutoSave() { if (!currentSettings.autoSave || !editorDirty) return; clearTimeout(autoSaveTimeout); autoSaveTimeout = setTimeout(handleSaveProject, 1500); }

    const fileManager = {
        renderList: () => { if (!currentProject) return; fileListUl.innerHTML = ''; currentProject.files.sort((a, b) => a.name.localeCompare(b.name)).forEach(file => { const iconClass = fileManager.getIconClass(file.name); const icon = createDOMElement('i', { className: `file-icon ${iconClass}` }); const nameSpan = createDOMElement('span', { textContent: file.name }); const li = createDOMElement('li', { dataset: { fileId: file.id }, title: file.name, children: [icon, nameSpan] }); if (file.id === currentOpenFileId) li.classList.add('active'); fileListUl.appendChild(li); }); const fileSelected = !!currentOpenFileId; deleteFileButton.disabled = !fileSelected; renameFileButton.disabled = !fileSelected; },
        getIconClass: (filename) => { const lang = getLanguageFromFilename(filename); const iconMap = {html:'fab fa-html5',css:'fab fa-css3-alt',javascript:'fab fa-js-square',python:'fab fa-python',markdown:'fab fa-markdown',json:'fas fa-file-code',java:'fab fa-java',csharp:'fas fa-hashtag',cpp:'fas fa-plus',c:'fas fa-copyright',rust:'fab fa-rust',go:'fab fa-google',php:'fab fa-php',rb:'fas fa-gem',sh:'fas fa-terminal',xml:'fas fa-file-code',yaml:'fas fa-file-alt'}; return iconMap[lang] || 'fas fa-file'; },
        open: (fileId, force = false) => { if (!currentProject || !editor) return; if (!force && editorDirty && !confirm("Unsaved changes. Switch file anyway?")) return; const file = currentProject.files.find(f => f.id === fileId); if (!file) { editor.setValue(`// Error: File not found (ID: ${fileId})`); if (editor.getModel()) monaco.editor.setModelLanguage(editor.getModel(), 'plaintext'); currentOpenFileId = null; fileManager.renderList(); setEditorDirty(false); updateRunButtonState(); return; } currentOpenFileId = file.id; currentProject.openFileId = file.id; const modelUri = monaco.Uri.parse(`ryxide://project/${currentProject.id}/${file.id}/${file.name}`); let model = monaco.editor.getModel(modelUri); if (!model) { model = monaco.editor.createModel(file.content || '', file.language, modelUri); } else { if (model.getValue() !== (file.content || '')) model.setValue(file.content || ''); if (model.getLanguageId() !== file.language) monaco.editor.setModelLanguage(model, file.language); } editor.setModel(model); editor.focus(); previewFrame.srcdoc = ''; fileManager.renderList(); setEditorDirty(false); updateRunButtonState(); },
        handleNew: () => { fileNameInput.value = ''; showModal(modalBackdrop, newFileModal); },
        confirmNew: async () => { const fileName = fileNameInput.value.trim(); if (!fileName || !currentProject) { alert("Invalid file name."); return; } if (currentProject.files.some(f => f.name.toLowerCase() === fileName.toLowerCase())) { alert(`File "${fileName}" already exists.`); fileNameInput.focus(); return; } const fileLang = getLanguageFromFilename(fileName); const newFile = { id: generateUUID(), name: fileName, language: fileLang, content: starterContentByLanguage[fileLang] || '' }; currentProject.files.push(newFile); currentProject.openFileId = newFile.id; const saved = await saveProjectToStorage(currentProject); if(saved) { fileManager.renderList(); fileManager.open(newFile.id, true); setEditorDirty(true); hideModal(modalBackdrop, newFileModal); } },
        handleRename: (fileIdToRename = null) => { const fileId = fileIdToRename || currentOpenFileId; if (!currentProject || !fileId) return; const file = currentProject.files.find(f => f.id === fileId); if (!file) { return; } newFileNameInput.value = file.name; renameFileModal.dataset.fileId = fileId; showModal(modalBackdrop, renameFileModal); },
        confirmRename: async () => { const fileId = renameFileModal.dataset.fileId; const newName = newFileNameInput.value.trim(); if (!fileId || !newName || !currentProject) { alert("Invalid input."); return; } const file = currentProject.files.find(f => f.id === fileId); if (!file) { alert("File not found."); hideModal(modalBackdrop, renameFileModal); return; } if (newName === file.name) { hideModal(modalBackdrop, renameFileModal); return; } if (currentProject.files.some(f => f.name.toLowerCase() === newName.toLowerCase() && f.id !== fileId)) { alert(`Name "${newName}" exists.`); newFileNameInput.focus(); return; } const oldName = file.name; file.name = newName; file.language = getLanguageFromFilename(newName); const saved = await saveProjectToStorage(currentProject); if(saved) { setEditorDirty(true); fileManager.renderList(); if (currentOpenFileId === fileId && editor) { const currentModelInstance = editor.getModel(); const oldUri = monaco.Uri.parse(`ryxide://project/${currentProject.id}/${fileId}/${oldName}`); if (currentModelInstance && currentModelInstance.uri.toString() === oldUri.toString()) { const newUri = monaco.Uri.parse(`ryxide://project/${currentProject.id}/${fileId}/${newName}`); const currentContent = currentModelInstance.getValue(); const currentViewState = editor.saveViewState(); const newModel = monaco.editor.createModel(currentContent, file.language, newUri); editor.setModel(newModel); if (currentViewState) editor.restoreViewState(currentViewState); editor.focus(); currentModelInstance.dispose(); } else { fileManager.open(fileId, true); } } hideModal(modalBackdrop, renameFileModal); } },
        handleDelete: async () => { if (!currentProject || !currentOpenFileId) return; const fileToDelete = currentProject.files.find(f => f.id === currentOpenFileId); if (!fileToDelete) return; if (confirm(`Delete "${fileToDelete.name}"? Cannot be undone.`)) { const fileUri = monaco.Uri.parse(`ryxide://project/${currentProject.id}/${fileToDelete.id}/${fileToDelete.name}`); currentProject.files = currentProject.files.filter(f => f.id !== currentOpenFileId); const nextFileId = currentProject.files[0]?.id || null; currentProject.openFileId = nextFileId; const saved = await saveProjectToStorage(currentProject); if (saved) { setEditorDirty(false); monaco.editor.getModel(fileUri)?.dispose(); if (nextFileId) fileManager.open(nextFileId, true); else { currentOpenFileId = null; if (editor) editor.setModel(null); fileManager.renderList(); updateRunButtonState(); } } } }
    };

    function handleTabSwitch(event) {
         const button = event.target.closest('.tab-button'); if (!button) return; const tabName = button.dataset.tab;
         tabButtons.forEach(btn => btn.classList.toggle('active', btn === button)); tabContents.forEach(content => content.classList.toggle('active', content.id === `${tabName}-tab-content`));
         if (tabName === 'editor' && editor) { setTimeout(() => editor.layout(), 0); editor.focus(); }
         else if (tabName === 'terminal' && jqTerminal) { jqTerminal.focus(); }         else if (tabName === 'ai-chat') { aiChatInput.focus(); aiChatMessages.scrollTop = aiChatMessages.scrollHeight; }
    }

    const aiChatManager = {
        loadChats: () => { if (!currentProject?.aiChats) return; aiChatSelector.innerHTML = ''; currentProject.aiChats.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)); currentProject.aiChats.forEach(chat => { const option = createDOMElement('option', { value: chat.id, textContent: chat.name || `Chat ${formatDate(chat.createdAt) || chat.id.substring(0,4)}` }); if (chat.id === currentProject.currentAiChatId) option.selected = true; aiChatSelector.appendChild(option); }); aiChatManager.switchChat(currentProject.currentAiChatId); aiDeleteChatButton.disabled = currentProject.aiChats.length <= 1; },
        switchChat: (chatId) => { if (!currentProject?.aiChats) return; const chat = currentProject.aiChats.find(c => c.id === chatId); if (chat) { currentAiChat = chat; currentProject.currentAiChatId = chatId; aiChatManager.renderMessages(); if (aiChatSelector.value !== chatId) aiChatSelector.value = chatId; aiDeleteChatButton.disabled = currentProject.aiChats.length <= 1; } else { if(currentProject.aiChats.length > 0) aiChatManager.switchChat(currentProject.aiChats[0].id); else { currentAiChat = null; aiChatMessages.innerHTML = '<p class="empty-chat">No chats.</p>'; aiDeleteChatButton.disabled = true; } } },
        renderMessages: () => { aiChatMessages.innerHTML = ''; if (!currentAiChat?.messages?.length) { aiChatMessages.innerHTML = '<p class="empty-chat">Ask AI...</p>'; return; } currentAiChat.messages.forEach(msg => aiChatManager.appendMessage(msg.role, msg.parts, msg.previewData)); aiChatMessages.scrollTop = aiChatMessages.scrollHeight; },
        appendMessage: (role, parts, previewData = null) => { const avatar = createDOMElement('span', { className: 'ai-avatar', innerHTML: role === 'user' ? '<i class="fas fa-user"></i>' : '<i class="fas fa-robot"></i>' }); const contentDiv = createDOMElement('div', { className: 'ai-message-content' }); const messageDiv = createDOMElement('div', { className: `ai-message role-${role}`, children: [avatar, contentDiv] }); const messageText = typeof parts === 'string' ? parts : Array.isArray(parts) ? parts.map(p => p.text || '').join('') : ''; if (role === 'model' && typeof marked !== 'undefined') { try { const rawHtml = marked.parse(messageText, { breaks: true, gfm: true, mangle: false, headerIds: false }); const tempDiv = document.createElement('div'); tempDiv.innerHTML = rawHtml; tempDiv.querySelectorAll('pre > code').forEach((codeElement) => { const preElement = codeElement.parentElement; const lang = codeElement.className.replace('language-', '') || 'code'; const code = codeElement.textContent || ''; const copyId = `copy-${generateUUID()}`; codeElement.id = copyId; const header = createDOMElement('div', { className: 'code-block-header', children: [ createDOMElement('span', { textContent: escapeHtml(lang) }), createDOMElement('div', { children: [ createDOMElement('button', { className: 'code-action-button copy-code-btn', dataset:{copyTarget: `#${copyId}`}, title: 'Copy Code', innerHTML: '<i class="fas fa-copy"></i>'}), previewData ? createDOMElement('button', { className: 'code-action-button apply-code-btn', dataset: { fileId: previewData.fileId, codeContent: code }, title: `Apply to ${escapeHtml(previewData.fileName)}`, innerHTML: '<i class="fas fa-paste"></i> Apply'}) : null ]}) ]}); const wrapper = createDOMElement('div', { className: 'code-block-wrapper' }); preElement.parentNode?.insertBefore(wrapper, preElement); wrapper.appendChild(header); wrapper.appendChild(preElement); }); contentDiv.innerHTML = ''; while (tempDiv.firstChild) contentDiv.appendChild(tempDiv.firstChild); } catch (e) { contentDiv.textContent = messageText; } } else { contentDiv.textContent = messageText; } aiChatMessages.appendChild(messageDiv); aiChatMessages.scrollTop = aiChatMessages.scrollHeight; },
         handleSendMessage: async () => { const messageText = aiChatInput.value.trim(); if (!messageText || currentAiApiCall) return; const apiKey = await getApiKey(); if (!apiKey) { alert("Set Gemini API Key in Settings."); aiChatInput.focus(); return; } if (!currentAiChat) { return; } let contextPrompt = `You are RyxAI, a friendly and helpful coding assistant. Be conversational but concise. You are embedded in a web-based IDE.\n`; contextPrompt += `Current Project: ${currentProject.name || 'Unnamed Project'}.\n`; let currentFileData = null; if (currentOpenFileId && editor) { const file = currentProject.files.find(f=>f.id===currentOpenFileId); const model = editor.getModel(); if (file && model) { currentFileData = file; contextPrompt += `Current File: ${file.name} (Lang: ${file.language}).\n`; const selection = editor.getSelection(); const selectedText = selection && !selection.isEmpty() ? model.getValueInRange(selection) : null; if (selectedText) { contextPrompt += `User has selected this code:\n\`\`\`${file.language || ''}\n${selectedText}\n\`\`\`\n`; } else { const fileContent = model?.getValue() ?? file.content ?? ''; if (fileContent.length < 4000) { contextPrompt += `Full Content of ${file.name}:\n\`\`\`${file.language || ''}\n${fileContent}\n\`\`\`\n`; } else { contextPrompt += `(File ${file.name} content large, provide selection for context).\n`; }}}} const otherFiles = currentProject.files.filter(f => f.id !== currentOpenFileId).map(f => f.name).join(', '); if (otherFiles) contextPrompt += `Other project files (names only): ${otherFiles}.\n`; contextPrompt += `\n--- User Query ---\n${messageText}`; const userMsg = { role: 'user', parts: messageText }; currentAiChat.messages.push(userMsg); aiChatManager.appendMessage(userMsg.role, userMsg.parts); aiChatInput.value = ''; aiSendButton.disabled = true; currentAiApiCall = true; aiChatInput.disabled = true; aiChatMessages.querySelector('.thinking')?.remove(); aiChatManager.appendMessage('model', 'Thinking...'); aiChatMessages.lastChild?.classList.add('thinking'); const historyForApi = currentAiChat.messages.slice(0, -1).filter(msg => !(msg.parts && msg.parts.includes('Thinking...'))).map(msg => ({ role: msg.role, parts: [{ text: Array.isArray(msg.parts) ? msg.parts.map(p => p.text || '').join('') : (msg.parts || '') }] })); const result = await callGeminiApi(contextPrompt, apiKey, historyForApi); aiChatMessages.querySelector('.thinking')?.remove(); let previewData = null; if (!result.error) { const aiMode = aiModeSelector.value; const responseText = result.text || ''; const codeBlockMatch = responseText.match(/```(?:\w*\n)?([\s\S]*?)\n```/); if (aiMode === 'modify' && codeBlockMatch && currentFileData) { previewData = { fileId: currentFileData.id, fileName: currentFileData.name }; } const modelMsg = { role: 'model', parts: responseText, previewData: previewData }; currentAiChat.messages.push(modelMsg); aiChatManager.appendMessage(modelMsg.role, modelMsg.parts, previewData); await saveProjectToStorage(currentProject); } else { aiChatManager.appendMessage('model', `Sorry, error: ${result.error}`); } aiSendButton.disabled = false; currentAiApiCall = false; aiChatInput.disabled = false; aiChatInput.focus(); aiChatMessages.scrollTop = aiChatMessages.scrollHeight; },
        handleNewChat: async () => { if (!currentProject) return; const newChatId = generateUUID(); const newChatName = `Chat ${formatDate(Date.now()) || (currentProject.aiChats.length + 1)}`; const newChat = { id: newChatId, name: newChatName, messages: [], createdAt: Date.now() }; currentProject.aiChats.push(newChat); currentProject.currentAiChatId = newChatId; const saved = await saveProjectToStorage(currentProject); if(saved) aiChatManager.loadChats(); },
        handleDeleteChat: async () => { if (!currentProject || !currentAiChat || currentProject.aiChats.length <= 1) { alert("Cannot delete last chat."); return; } if (confirm(`Delete chat "${currentAiChat.name || 'this chat'}"?`)) { currentProject.aiChats = currentProject.aiChats.filter(c => c.id !== currentAiChat.id); currentProject.currentAiChatId = currentProject.aiChats[0]?.id || null; const saved = await saveProjectToStorage(currentProject); if (saved) aiChatManager.loadChats(); } },
        handleCodeAction: (event) => { const button = event.target.closest('.code-action-button'); if (!button) return; if (button.classList.contains('copy-code-btn')) { const targetSelector = button.dataset.copyTarget; const codeElement = aiChatMessages.querySelector(targetSelector); if (codeElement) { navigator.clipboard.writeText(codeElement.textContent).then(() => { button.innerHTML = '<i class="fas fa-check"></i>'; updateStatus('Copied!', 'success', 1500); setTimeout(() => { button.innerHTML = '<i class="fas fa-copy"></i>'; }, 1500); }).catch(err => { updateStatus('Copy failed', 'error'); }); } } else if (button.classList.contains('apply-code-btn')) { const fileId = button.dataset.fileId; const newContent = button.dataset.codeContent; const file = currentProject?.files.find(f => f.id === fileId); if (file && newContent !== undefined) { aiApplyAction = { fileId, newContent }; aiApplyFilename.textContent = file.name; aiApplyCodePreview.textContent = newContent.substring(0, 500) + (newContent.length > 500 ? '\n... (truncated)' : ''); showModal(modalBackdrop, aiApplyModal); } else { updateStatus('Error preparing apply action', 'error'); } } },
         confirmApplyCode: async () => { if (!aiApplyAction || !editor || !currentProject) { alert("Cannot apply changes."); hideModal(modalBackdrop, aiApplyModal); return; } const { fileId, newContent } = aiApplyAction; const targetFile = currentProject.files.find(f => f.id === fileId); if (!targetFile) { alert(`Target file not found.`); hideModal(modalBackdrop, aiApplyModal); return; } if (currentOpenFileId === fileId) { const model = editor.getModel(); if (model) { const fullRange = model.getFullModelRange(); editor.executeEdits('ai-apply', [{ range: fullRange, text: newContent, forceMoveMarkers: true }]); setEditorDirty(true); updateStatus(`AI applied to editor for ${targetFile.name}.`, 'success'); } else { alert("Error: Editor model not found."); } } else { targetFile.content = newContent; const saved = await saveProjectToStorage(currentProject); if(saved) updateStatus(`AI applied & saved to ${targetFile.name}.`, 'success'); else updateStatus(`Applied to ${targetFile.name}, but save failed!`, 'error'); } hideModal(modalBackdrop, aiApplyModal); aiApplyAction = null; }
    };

    const terminalManager = {
        initializeTerminal: () => {
            if (jqTerminal || typeof $ === 'undefined' || !$.terminal) {
                 if(!window.jQuery || !window.jQuery.terminal) {
                    console.error("jQuery or jQuery Terminal library not loaded.");
                    terminalContainer.textContent = 'Error: jQuery Terminal library not found.';
                    return;
                }
            }
             jqTerminal = $(terminalContainer).terminal(async (command, term) => {
                 if (command.trim()) {
                     await terminalManager.executeCommand(command.trim(), term);
                 } else {
                     term.echo('');
                 }
             }, {
                 greetings: 'RyxIDE Backend Terminal\nUse "run <filename>" or standard Linux commands.',
                 prompt: '[[b;green;]ryxide] $ ',
                 keymap: {
                     'CTRL+C': function(e, original) {
                         if (!jqTerminal?.paused()) { jqTerminal.echo('^C'); }
                         else { original(); }
                     }
                 },
                 outputLimit: 200,
                 scrollOnEcho: true,
                 height: '100%',
                 width: '100%',
                 exceptionHandler: function(exception) {
                     jqTerminal?.error(String(exception));
                 },
                 formatters: $.terminal.defaults.formatters.concat('html'),
                 finalize: (div) => {
                     terminalManager.applyTheme(div);
                 }
             });
             terminalManager.applyTheme();
        },
        applyTheme: (termDiv = null) => {
            const container = termDiv || $(terminalContainer).find('.terminal');
            if (!container.length) return;
            const themeClass = currentSettings.theme === 'vs' ? 'light' : 'dark';
            container.removeClass('light dark').addClass(themeClass);
        },
        fitTerminal: () => {},
        executeCommand: async (command, term) => {
             if (!TERMINAL_EXECUTE_URL) { term.error("Terminal backend URL not configured."); return; }
             if (isTerminalProcessing) return;
             isTerminalProcessing = true;
             term.pause();
             showLoader(loaderOverlay, loaderText, "Running Command...");
             updateStatus(`Running command...`, 'info', 0);
             try {
                 const response = await fetch(TERMINAL_EXECUTE_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ command: command }) });
                 const result = await response.json();
                 if (result.stdout) term.echo(result.stdout);
                 if (result.stderr) term.error(result.stderr);
                 if (!response.ok || result.exitCode !== 0) { updateStatus(`Cmd failed (Code: ${result.exitCode || response.status})`, 'error', 5000); term.error(`[[b;red;]Cmd failed - Exit: ${result.exitCode ?? 'N/A'}]`); }
                 else { updateStatus(`Command finished`, 'success'); }
             } catch (error) { term.error(`[[b;red;]Network/Fetch Error: ${error.message}]`); updateStatus('Command Network Error', 'error', 5000); }
             finally { hideLoader(loaderOverlay); term.resume(); isTerminalProcessing = false; }
        },
        executeCommandViaRun: async (lang, code) => {
             if (!jqTerminal) { alert("Terminal not initialized."); return; }
             const commandMap = { python: `python3`, ruby: `ruby`, c: `gcc temp.c -o temp_c -lm && ./temp_c`, cpp: `g++ temp.cpp -o temp_cpp -lstdc++ && ./temp_cpp`, csharp: `mcs temp.cs -out:temp_cs.exe && mono temp_cs.exe`, shell: `sh` };
             const cmdPrefix = commandMap[lang];
             if (!cmdPrefix) { alert(`Execution via terminal not set for ${lang}`); return; }

             const fileName = `temp.${{python: 'py', ruby:'rb', c:'c', cpp:'cpp', csharp:'cs', shell:'sh'}[lang]}`;
             const safeCode = btoa(unescape(encodeURIComponent(code)));
             const writeCmd = `echo '${safeCode}' | base64 -d > ${fileName}`;
             const runCmd = `${cmdPrefix} ${fileName}`;
             const cleanupCmd = `rm ${fileName} ${lang==='c'?'temp_c ':''}${lang==='cpp'?'temp_cpp ':''}${lang==='csharp'?'temp_cs.exe ':''}`;
             const fullCommand = `${writeCmd} && ${runCmd} ; ${cleanupCmd}`;

             jqTerminal.exec(fullCommand);
        }
    };

    const runtimeManager = {
        runCode: async () => { if (!editor || !currentProject || !currentOpenFileId) return; const file = currentProject.files.find(f => f.id === currentOpenFileId); if (!file) return; const code = editor.getValue(); previewFrame.srcdoc = ''; const lang = file.language; if (['html', 'css', 'javascript', 'markdown'].includes(lang)) { runtimeManager.runClientSide(file.language, code); return; } if (lang === 'python') { await runtimeManager.runPythonCode(code); return; } terminalManager.executeCommandViaRun(lang, code); },
        runClientSide: (lang, code) => { updateStatus(`Running ${lang}...`, 'info', 0); switch(lang) { case 'html': runtimeManager.runHtmlPreview(); break; case 'css': runtimeManager.runCssPreview(code); break; case 'javascript': runtimeManager.runJavaScriptCode(code); break; case 'markdown': runtimeManager.runMarkdownPreview(code); break; } },
        runHtmlPreview: () => { const htmlFile = currentProject?.files.find(f => f.id === currentOpenFileId && f.language === 'html'); if (!htmlFile) { updateStatus('Preview failed', 'error'); return; } let htmlContent = editor?.getValue() ?? htmlFile.content ?? ''; let inlineStyles = ''; let inlineScripts = ''; try { const cssLinks = htmlContent.match(/<link.*?href=["'](.*?)["']/gi) || []; const scriptSrcs = htmlContent.match(/<script.*?src=["'](.*?)["']/gi) || []; cssLinks.forEach(tag => { const href = tag.match(/href=["'](.*?)["']/i)?.[1]; const rel = tag.match(/rel=["']stylesheet["']/i); if (href && rel) { const name = href.split('/').pop(); const cssFile = currentProject.files.find(f=>f.name===name&&f.language==='css'); if(cssFile) inlineStyles+=`\n/* ${escapeHtml(cssFile.name)} */\n${cssFile.content||''}\n`; } }); scriptSrcs.forEach(tag => { const src = tag.match(/src=["'](.*?)["']/i)?.[1]; if (src) { const name = src.split('/').pop(); const jsFile = currentProject.files.find(f=>f.name===name&&f.language==='javascript'); if(jsFile) inlineScripts+=`\n/* ${escapeHtml(jsFile.name)} */\n;(function(){\ntry {\n${jsFile.content||''}\n} catch(e) { console.error('Error in ${escapeHtml(jsFile.name)}:', e); }\n})();\n`; } }); const styleTag = inlineStyles ? `<style>\n${inlineStyles}\n</style>` : ''; const scriptTag = inlineScripts ? `<script>\n${inlineScripts}\nconsole.log("--- Injected Scripts Finished ---");\n</script>` : ''; if (htmlContent.includes('</head>')) htmlContent = htmlContent.replace('</head>', `${styleTag}\n</head>`); else htmlContent = styleTag + htmlContent; if (htmlContent.includes('</body>')) htmlContent = htmlContent.replace('</body>', `${scriptTag}\n</body>`); else htmlContent += scriptTag; previewFrame.srcdoc = htmlContent; updateStatus('Preview Ready', 'success'); } catch (e) { console.error("HTML Preview Error:", e); updateStatus('Preview failed', 'error'); } },
        runCssPreview: (code) => { const cssHtml = `<!DOCTYPE html><html><head><title>CSS</title><style>${escapeHtml(code)}</style></head><body><h1>H</h1><p>P</p><button class="primary">B</button></body></html>`; previewFrame.srcdoc = cssHtml; updateStatus('Preview Ready', 'success');},
        runJavaScriptCode: (code) => { updateStatus('Running JS...', 'info', 0); if(outputConsole) outputConsole.textContent=''; const fullHtml = `<!DOCTYPE html><html><head><title>JS</title></head><body><script> const console = { log: (...a)=>parent.postMessage({type:'ryx-log',level:'log',args:a.map(x=>String(x))},'*'), error: (...a)=>parent.postMessage({type:'ryx-log',level:'error',args:a.map(x=>String(x))},'*'), warn: (...a)=>parent.postMessage({type:'ryx-log',level:'warn',args:a.map(x=>String(x))},'*'), info: (...a)=>parent.postMessage({type:'ryx-log',level:'info',args:a.map(x=>String(x))},'*'), clear: ()=>parent.postMessage({type:'ryx-log',level:'clear'},'*') }; window.onerror=(m,s,l,c,e)=>{console.error(\`Error: \${m} (\${l}:\${c})\`);return true;}; try { ${code}\n console.log('--- Script Finished ---'); } catch (e) { console.error('Runtime Error:', e.name, e.message); } </script></body></html>`; const listener = (e) => { if (e.source !== previewFrame.contentWindow || e.data?.type !== 'ryx-log') return; const { level, args } = e.data; if(level==='clear') outputConsole.textContent='Console cleared.\n'; else { const p = level==='error'?'ERROR: ':level==='warn'?'WARN: ':level==='info'?'INFO: ':''; outputConsole.textContent += p + args.join(' ') + '\n'; } outputConsole.scrollTop = outputConsole.scrollHeight; }; window.addEventListener('message', listener); previewFrame.srcdoc = fullHtml; setTimeout(() => { window.removeEventListener('message', listener); if (outputConsole && !outputConsole.textContent.includes('--- Script Finished ---') && !outputConsole.textContent.includes('Error:')) { outputConsole.textContent += '(Script may have finished silently or errored)\n'; } updateStatus('JS Finished', 'success'); }, 5000); },
        runPythonCode: async (code) => { if (!PYTHON_BACKEND_URL) { alert("Python backend URL not configured."); updateStatus('Py Backend Error', 'error'); return; } updateStatus('Running Python (Backend)...', 'info', 0); showLoader(loaderOverlay, loaderText, "Executing Python..."); const targetTerminal = jqTerminal; if (targetTerminal) { targetTerminal.echo('\n[[b;blue;] --- Sending Python to Backend --- ]'); } else { console.warn("Terminal not ready for Python output."); } try { const response = await fetch(PYTHON_BACKEND_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', }, body: JSON.stringify({ code: code }) }); const result = await response.json(); const writer = targetTerminal || { echo: (t)=>{console.log(t)}, error: (t)=>{console.error(t)} }; writer.echo('\n[[b;blue;] --- Backend Response Start --- ]'); if (result.stdout) writer.echo(result.stdout); if (result.stderr) writer.error(`--- STDERR ---\n${result.stderr}`); const exitMessage = result.exit_code === 0 ? `\n[[b;green;]--- Python finished (Backend) [Exit Code: 0] --- ]` : `\n[[b;red;]--- Python failed (Backend) [Exit Code: ${result.exit_code}] --- ]`; writer.echo(exitMessage); updateStatus(result.exit_code === 0 ? 'Python Finished' : 'Python Error', result.exit_code === 0 ? 'success' : 'error'); if (!response.ok) { writer.error(`Backend HTTP Error ${response.status}: ${result.error || response.statusText}`); updateStatus('Python Backend Error', 'error'); } } catch (error) { const writer = jqTerminal || console; writer.error(`\n--- ERROR ---\nNetwork/Fetch Error: ${error.message}`); updateStatus('Python Network Error', 'error', 5000); } finally { hideLoader(loaderOverlay); } },
        runMarkdownPreview: (code) => { if(typeof marked==='undefined') { updateStatus('MD Preview Fail', 'error'); return; } try{ const html = marked.parse(code, { breaks: true, gfm: true, mangle: false, headerIds: false }); const fullHtml = `<!DOCTYPE html><html><head><title>MD</title><style>body{font-family:sans-serif;padding:1.5em;line-height:1.6;}pre{background:#f0f0f0;padding:1em;border-radius:4px;overflow-x:auto;}code:not(pre code){background:rgba(0,0,0,0.05);padding:2px 4px;}blockquote{border-left:4px solid #ccc;padding-left:1em;margin-left:0;color:#666;}table{border-collapse:collapse;}th,td{border:1px solid #ccc;padding:0.5em;}img{max-width:100%;}</style></head><body>${html}</body></html>`; previewFrame.srcdoc = fullHtml; updateStatus('Preview Ready', 'success');} catch(e){ outputConsole.textContent=`MD Error: ${e.message}`; updateStatus('MD Preview Fail', 'error');}},
    };

    const editorActions = {
        find: () => { if (editor) editor.getAction('actions.find').run(); },
        replace: () => { if (editor) editor.getAction('editor.action.startFindReplaceAction').run(); },
        gotoLine: () => { if (!editor) return; const line = parseInt(gotoLineInput.value, 10); if (!isNaN(line) && line > 0) { try { const maxLine = editor.getModel()?.getLineCount() || 1; const targetLine = Math.max(1, Math.min(line, maxLine)); editor.revealLineInCenterIfOutsideViewport(targetLine, 0); editor.setPosition({ lineNumber: targetLine, column: 1 }); editor.focus(); } catch (e) { updateStatus(`Invalid line: ${line}`, 'warning');}} else if (gotoLineInput.value !== '') updateStatus('Invalid line.', 'warning'); gotoLineInput.value = ''; },
        showShortcuts: () => { showModal(modalBackdrop, shortcutsModal); }
    };

    function setupBaseEventListeners() {
        backToDashboardButton.addEventListener('click', () => { if (editorDirty && !confirm("Unsaved changes. Leave anyway?")) return; setCurrentProjectId(null); window.location.href = 'index.html'; });
        themeSelectorHeader.addEventListener('change', (e) => { currentSettings.theme = e.target.value; saveSettings(currentSettings); applySettings(); });
        shortcutsButton.addEventListener('click', editorActions.showShortcuts);
        tabBar.addEventListener('click', handleTabSwitch);
        newFileButton.addEventListener('click', fileManager.handleNew);
        deleteFileButton.addEventListener('click', fileManager.handleDelete);
        renameFileButton.addEventListener('click', () => fileManager.handleRename());
        fileListUl.addEventListener('click', (e) => { const li = e.target.closest('li[data-file-id]'); if (li) fileManager.open(li.dataset.fileId); });
        fileListUl.addEventListener('dblclick', (e) => { const li = e.target.closest('li[data-file-id]'); if (li) fileManager.handleRename(li.dataset.fileId); });
        aiChatSelector.addEventListener('change', (e) => aiChatManager.switchChat(e.target.value));
        aiNewChatButton.addEventListener('click', aiChatManager.handleNewChat);
        aiDeleteChatButton.addEventListener('click', aiChatManager.handleDeleteChat);
        aiChatMessages.addEventListener('click', aiChatManager.handleCodeAction);
        createFileCancelButton.addEventListener('click', () => hideModal(modalBackdrop, newFileModal));
        createFileConfirmButton.addEventListener('click', fileManager.confirmNew);
        renameFileCancelButton.addEventListener('click', () => hideModal(modalBackdrop, renameFileModal));
        renameFileConfirmButton.addEventListener('click', fileManager.confirmRename);
        aiApplyCancelButton.addEventListener('click', () => { hideModal(modalBackdrop, aiApplyModal); aiApplyAction = null; });
        aiApplyConfirmButton.addEventListener('click', aiChatManager.confirmApplyCode);
        shortcutsCloseButton?.addEventListener('click', () => hideModal(modalBackdrop, shortcutsModal));
        window.addEventListener('beforeunload', (e) => { if (editorDirty) { e.preventDefault(); e.returnValue = 'Unsaved changes will be lost.'; } });
        window.addEventListener('resize', () => { terminalManager.fitTerminal(); if (editor) editor.layout(); });
    }

    function setupEditorSpecificEventListeners() {
        if(!editor) { return; }
        saveProjectButton.addEventListener('click', handleSaveProject);
        findButton.addEventListener('click', editorActions.find);
        replaceButton.addEventListener('click', editorActions.replace);
        gotoLineButton.addEventListener('click', editorActions.gotoLine);
        gotoLineInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') editorActions.gotoLine(); });
        runButton.addEventListener('click', runtimeManager.runCode);
        aiSendButton.addEventListener('click', aiChatManager.handleSendMessage);
        aiChatInput.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); aiChatManager.handleSendMessage(); } });
        window.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key === 's') { if (modalBackdrop.classList.contains('modal-hidden')) { e.preventDefault(); if (!saveProjectButton.disabled) handleSaveProject(); } } });
    }

    function updateCredits() {
        const features = new Set(['Monaco', 'Gemini', 'jQuery Terminal', 'Render']);
        if (typeof marked !== 'undefined') features.add('Marked');
        if (typeof $ !== 'undefined' && $.terminal) features.add('jQuery');
        if (typeof JSZip !== 'undefined') features.add('JSZip');
        creditsElement.textContent = `Powered by: ${Array.from(features).join(', ')}.`;
    }

    function updateRunButtonState() {
         const file = currentProject?.files.find(f => f.id === currentOpenFileId);
         const lang = file?.language || 'plaintext';
         const runnableInternalClient = ['html', 'css', 'javascript', 'markdown'].includes(lang);
         const runnableBackendPython = lang === 'python';
         const runnableBackendTerminal = ['ruby', 'csharp', 'c', 'cpp', 'shell'].includes(lang);
         const runnableExternalKey = lang === 'java' ? 'java' : lang === 'go' ? 'go' : lang === 'php' ? 'php' : lang === 'rust' ? 'rust' : null;
         const externalLink = runnableExternalKey ? externalSandboxLinks[runnableExternalKey] : null;
         let canRun = runnableInternalClient || runnableBackendPython || runnableBackendTerminal;
         runButton.disabled = !canRun;
         runButton.style.display = 'inline-flex';
         runButton.title = canRun ? `Run/Preview ${lang}` : `Run not supported for ${lang}`;
         runExternalButton.style.display = externalLink ? 'inline-flex' : 'none';
         if (externalLink) { runExternalButton.href = externalLink; runExternalButton.title = `Run ${lang} in External Sandbox`; }
    }

    initializeEditorPage().catch(err => {
         console.error("Editor Initialization failed:", err);
         alert("Failed to initialize the editor. Please check the console.");
         document.body.innerHTML = `<div style="padding: 20px; color: red;"><h1>Init Error</h1><pre>${escapeHtml(String(err))}</pre></div>`;
    });
});
