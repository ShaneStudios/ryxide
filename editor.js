document.addEventListener('DOMContentLoaded', () => {
    const editorContainer = document.getElementById('editor-container');
    const runButton = document.getElementById('run-button');
    const runExternalButton = document.getElementById('run-external-button');
    const previewFrame = document.getElementById('preview-frame');
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
    let currentSettings = getSettings();
    let autoSaveTimeout = null;
    let pyodide = null, isPyodideLoading = false, isPyodideReady = false;
    let rubyVM = null, isRubyVMLoading = false, isRubyVMReady = false;
    let isDotnetRuntimeLoading = false, isDotnetRuntimeReady = false, dotnetRuntimeExports = null;

    function initializeEditorPage() {
        const projectId = getCurrentProjectId();
        if (!projectId) { handleMissingProject("No project selected."); return; }
        currentProject = getProjectFromStorage(projectId);
        if (!currentProject) { handleMissingProject("Failed to load project data."); return; }
        ensureProjectIntegrity();
        editorProjectNameH1.textContent = `RyxIDE - ${currentProject.name || 'Untitled'}`;
        document.title = `RyxIDE - ${currentProject.name || 'Editor'}`;
        currentSettings = getSettings();
        updateCredits();
        setupBaseEventListeners();
        setupMonaco();
    }

    function handleMissingProject(message) {
         alert(message + " Redirecting to dashboard.");
         setCurrentProjectId(null);
         window.location.href = 'index.html';
    }

    function ensureProjectIntegrity() {
         if (!currentProject.aiChats || !Array.isArray(currentProject.aiChats) || currentProject.aiChats.length === 0) {
             const defaultChatId = generateUUID();
             currentProject.aiChats = [{ id: defaultChatId, name: 'Chat 1', messages: [], createdAt: Date.now() }];
             currentProject.currentAiChatId = defaultChatId;
         }
          if (!currentProject.currentAiChatId || !currentProject.aiChats.find(c => c.id === currentProject.currentAiChatId)) {
              currentProject.currentAiChatId = currentProject.aiChats[0]?.id || null;
          }
    }

    function postMonacoSetup() {
         currentOpenFileId = currentProject.openFileId || currentProject.files[0]?.id || null;
         fileManager.renderList();
         if (currentOpenFileId) {
              fileManager.open(currentOpenFileId, true);
         } else {
              updateRunButtonState();
              if (editor) {
                  editor.setValue("// Welcome to RyxIDE!\n// Select or create a file from the left pane to get started.");
                  monaco.editor.setModelLanguage(editor.getModel(), 'plaintext');
              }
         }
         aiChatManager.loadChats();
         applySettings();
         setEditorDirty(false);
         setupEditorSpecificEventListeners();
    }

     function applySettings() {
        if (editor) {
            monaco.editor.setTheme(currentSettings.theme);
        }
        themeSelectorHeader.value = currentSettings.theme;
    }

    function setupMonaco() {
        require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.46.0/min/vs' }});
        window.MonacoEnvironment = {
            getWorkerUrl: function (moduleId, label) {
                const workerMap = {
                    'editorWorkerService': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.46.0/min/vs/editor/editor.worker.js',
                    'css': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.46.0/min/vs/language/css/css.worker.js',
                    'html': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.46.0/min/vs/language/html/html.worker.js',
                    'json': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.46.0/min/vs/language/json/json.worker.js',
                    'typescript': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.46.0/min/vs/language/typescript/ts.worker.js',
                    'javascript': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.46.0/min/vs/language/typescript/ts.worker.js'
                };
                const workerSrc = workerMap[label] || workerMap.editorWorkerService;
                return `data:text/javascript;charset=utf-8,${encodeURIComponent(`
                    self.MonacoEnvironment = { baseUrl: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.46.0/min/' };
                    importScripts('${workerSrc}');`
                )}`;
            }
        };
        require(['vs/editor/editor.main'], function() {
            try {
                 editor = monaco.editor.create(editorContainer, {
                     theme: currentSettings.theme,
                     automaticLayout: true,
                     minimap: { enabled: true },
                     wordWrap: 'on',
                     contextmenu: true,
                     fontSize: 14,
                     scrollbar: {
                         verticalScrollbarSize: 10,
                         horizontalScrollbarSize: 10
                     },
                 });
                 editor.onDidChangeModelContent((e) => {
                     if (!e.isFlush && currentProject && currentOpenFileId) {
                         setEditorDirty(true);
                         handleAutoSave();
                     }
                 });
                 setupEditorKeybindings();
                 setupMonacoCompletions();
                 postMonacoSetup();
             } catch (error) {
                 console.error("Fatal: Failed to initialize Monaco Editor instance:", error);
                 editorContainer.textContent = `Error initializing code editor: ${error.message}. Please try reloading the page or check the browser console.`;
                 disableEditorFeatures();
             }
        }, function(error) {
             console.error("Fatal: Failed to load Monaco Editor modules:", error);
             editorContainer.textContent = `Failed to load code editor library. Please check your internet connection and browser console. Error: ${error}`;
             disableEditorFeatures();
        });
    }

    function disableEditorFeatures(){
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
         if (!editor) return;
         editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, handleSaveProject, '!suggestWidgetVisible && !findWidgetVisible && !renameInputVisible');
         editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyF, () => editor.getAction('actions.find').run());
         editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyH, () => editor.getAction('editor.action.startFindReplaceAction').run());
    }

    function setupMonacoCompletions() {
         if (!window.monaco) { return; }
         monaco.languages.typescript.javascriptDefaults.setCompilerOptions({ target: monaco.languages.typescript.ScriptTarget.ES2016, allowNonTsExtensions: true });
         monaco.languages.registerCompletionItemProvider('javascript', { provideCompletionItems: (model, position) => { const word = model.getWordUntilPosition(position); const range = { startLineNumber: position.lineNumber, endLineNumber: position.lineNumber, startColumn: word.startColumn, endColumn: word.endColumn }; return { suggestions: [ { label: 'clog', detail: 'console.log()', documentation: 'Log a message to the console', kind: monaco.languages.CompletionItemKind.Snippet, insertText: 'console.log($1);', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range: range }, { label: 'fun', detail: 'function', documentation: 'Define a function', kind: monaco.languages.CompletionItemKind.Snippet, insertText: 'function ${1:name}($2) {\n\t$0\n}', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range: range }, { label: 'forloop', detail:'for loop', documentation: 'Standard for loop', kind: monaco.languages.CompletionItemKind.Snippet, insertText: 'for (let ${1:i} = 0; ${1:i} < ${2:array}.length; ${1:i}++) {\n\tconst ${3:element} = ${2:array}[${1:i}];\n\t$0\n}', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range: range }, { label: 'timeout', detail: 'setTimeout', documentation: 'setTimeout function', kind: monaco.languages.CompletionItemKind.Snippet, insertText: 'setTimeout(() => {\n\t$0\n}, ${1:1000});', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range: range }] }; }});
         monaco.languages.registerCompletionItemProvider('python', { provideCompletionItems: (model, position) => { const word = model.getWordUntilPosition(position); const range = { startLineNumber: position.lineNumber, endLineNumber: position.lineNumber, startColumn: word.startColumn, endColumn: word.endColumn }; return { suggestions: [ { label: 'fprint', detail: 'print(f"...")', documentation: 'Formatted print statement', kind: monaco.languages.CompletionItemKind.Snippet, insertText: 'print(f"$1")', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range: range }, { label: 'def', detail:'def function', documentation: 'Define function with docstring', kind: monaco.languages.CompletionItemKind.Snippet, insertText: 'def ${1:name}($2):\n\t"""$3"""\n\t$0', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range: range }, { label: 'class', detail:'class definition', documentation: 'Define class with __init__', kind: monaco.languages.CompletionItemKind.Snippet, insertText: 'class ${1:Name}:\n\tdef __init__(self, $2):\n\t\t$0', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range: range }] }; }});
         monaco.languages.registerCompletionItemProvider('html', { provideCompletionItems: (model, position) => { const word = model.getWordUntilPosition(position); const range = { startLineNumber: position.lineNumber, endLineNumber: position.lineNumber, startColumn: word.startColumn, endColumn: word.endColumn }; return { suggestions: [ { label: 'html5', detail: 'HTML5 Boilerplate', documentation: 'Basic HTML5 structure', kind: monaco.languages.CompletionItemKind.Snippet, insertText: '<!DOCTYPE html>\n<html lang="en">\n<head>\n\t<meta charset="UTF-8">\n\t<meta name="viewport" content="width=device-width, initial-scale=1.0">\n\t<title>${1:Document}</title>\n\t<link rel="stylesheet" href="${2:style.css}">\n</head>\n<body>\n\t$0\n\t<script src="${3:script.js}"></script>\n</body>\n</html>', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range: range }, { label: 'div', detail:'<div> element', documentation: 'Div with class attribute', kind: monaco.languages.CompletionItemKind.Snippet, insertText: '<div class="$1">\n\t$0\n</div>', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range: range }, { label: 'canvas', detail:'<canvas> element', documentation: 'HTML5 Canvas element', kind: monaco.languages.CompletionItemKind.Snippet, insertText: '<canvas id="$1" width="$2" height="$3"></canvas>', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range: range }] }; }});
    }

    function setEditorDirty(isDirty) {
        if (!currentOpenFileId && isDirty) isDirty = false;
        if (editorDirty === isDirty) return;
        editorDirty = isDirty;
        saveProjectButton.disabled = !isDirty;
        statusIndicator.textContent = isDirty ? '* Unsaved Changes' : '';
        statusIndicator.className = isDirty ? 'status-indicator status-warning' : 'status-indicator';
        document.title = `RyxIDE - ${currentProject?.name || 'Editor'}${isDirty ? '*' : ''}`;
    }

    function updateStatus(message, type = 'info', duration = 3000) {
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

    function handleSaveProject() {
        if (!currentProject || !editor) {
            return;
        }
        if (currentOpenFileId) {
            const file = currentProject.files.find(f => f.id === currentOpenFileId);
            if (file) {
                file.content = editor.getValue();
            } else {
                 updateStatus('Error: Open file data missing!', 'error', 5000);
                 return;
            }
        }
        if(saveProjectToStorage(currentProject)) {
            setEditorDirty(false);
            updateStatus(`Project saved.`, 'success');
        } else {
             updateStatus('Error Saving Project!', 'error', 5000);
        }
    }

    function handleAutoSave() {
        if (!currentSettings.autoSave || !editorDirty) return;
        clearTimeout(autoSaveTimeout);
        autoSaveTimeout = setTimeout(handleSaveProject, 1500);
    }

    const fileManager = {
        renderList: () => {
            if (!currentProject) return;
            fileListUl.innerHTML = '';
            currentProject.files.sort((a, b) => a.name.localeCompare(b.name)).forEach(file => {
                const iconClass = fileManager.getIconClass(file.name);
                const icon = createDOMElement('i', { className: `file-icon ${iconClass}` });
                const nameSpan = createDOMElement('span', { textContent: file.name });
                const li = createDOMElement('li', { dataset: { fileId: file.id }, title: file.name, children: [icon, nameSpan] });
                if (file.id === currentOpenFileId) li.classList.add('active');
                fileListUl.appendChild(li);
            });
            const fileSelected = !!currentOpenFileId;
            deleteFileButton.disabled = !fileSelected;
            renameFileButton.disabled = !fileSelected;
        },
        getIconClass: (filename) => {
             const lang = getLanguageFromFilename(filename);
             const iconMap = {html:'fab fa-html5',css:'fab fa-css3-alt',javascript:'fab fa-js-square',python:'fab fa-python',markdown:'fab fa-markdown',json:'fas fa-file-code',java:'fab fa-java',csharp:'fas fa-hashtag',cpp:'fas fa-plus',c:'fas fa-copyright',rust:'fab fa-rust',go:'fab fa-google',php:'fab fa-php',rb:'fas fa-gem',sh:'fas fa-terminal',xml:'fas fa-file-code',yaml:'fas fa-file-alt'};
             return iconMap[lang] || 'fas fa-file';
        },
        open: (fileId, force = false) => {
             if (!currentProject || !editor) return;
             if (!force && editorDirty && !confirm("Unsaved changes. Switch file anyway?")) return;
             const file = currentProject.files.find(f => f.id === fileId);
             if (!file) {
                  editor.setValue(`// Error: File not found (ID: ${fileId})`);
                  if (editor.getModel()) monaco.editor.setModelLanguage(editor.getModel(), 'plaintext');
                  currentOpenFileId = null; fileManager.renderList(); setEditorDirty(false); updateRunButtonState(); return;
             }
             currentOpenFileId = file.id; currentProject.openFileId = file.id;
             const modelUri = monaco.Uri.parse(`ryxide://project/${currentProject.id}/${file.id}/${file.name}`);
             let model = monaco.editor.getModel(modelUri);
             if (!model) { model = monaco.editor.createModel(file.content || '', file.language, modelUri); }
             else { if (model.getValue() !== (file.content || '')) model.setValue(file.content || ''); if (model.getLanguageId() !== file.language) monaco.editor.setModelLanguage(model, file.language); }
             editor.setModel(model); editor.focus();
             outputConsole.textContent = ''; previewFrame.srcdoc = '';
             fileManager.renderList(); setEditorDirty(false); updateRunButtonState();
        },
        handleNew: () => { fileNameInput.value = ''; showModal(modalBackdrop, newFileModal); },
        confirmNew: () => {
            const fileName = fileNameInput.value.trim(); if (!fileName || !currentProject) { alert("Invalid file name."); return; }
            if (currentProject.files.some(f => f.name.toLowerCase() === fileName.toLowerCase())) { alert(`File "${fileName}" already exists.`); fileNameInput.focus(); return; }
            const fileLang = getLanguageFromFilename(fileName); const newFile = { id: generateUUID(), name: fileName, language: fileLang, content: starterContentByLanguage[fileLang] || '' };
            currentProject.files.push(newFile); currentProject.openFileId = newFile.id;
            if(saveProjectToStorage(currentProject)) { fileManager.renderList(); fileManager.open(newFile.id, true); setEditorDirty(true); hideModal(modalBackdrop, newFileModal); }
        },
        handleRename: (fileIdToRename = null) => {
            const fileId = fileIdToRename || currentOpenFileId; if (!currentProject || !fileId) return;
            const file = currentProject.files.find(f => f.id === fileId); if (!file) { return; }
            newFileNameInput.value = file.name; renameFileModal.dataset.fileId = fileId; showModal(modalBackdrop, renameFileModal);
        },
        confirmRename: () => {
             const fileId = renameFileModal.dataset.fileId; const newName = newFileNameInput.value.trim(); if (!fileId || !newName || !currentProject) { alert("Invalid input."); return; }
             const file = currentProject.files.find(f => f.id === fileId); if (!file) { alert("File not found."); hideModal(modalBackdrop, renameFileModal); return; }
             if (newName === file.name) { hideModal(modalBackdrop, renameFileModal); return; }
             if (currentProject.files.some(f => f.name.toLowerCase() === newName.toLowerCase() && f.id !== fileId)) { alert(`Name "${newName}" exists.`); newFileNameInput.focus(); return; }
             const oldName = file.name; file.name = newName; file.language = getLanguageFromFilename(newName);
             if(saveProjectToStorage(currentProject)) {
                 setEditorDirty(true); fileManager.renderList();
                 if (currentOpenFileId === fileId && editor) {
                     const currentModelInstance = editor.getModel();
                     const oldUri = monaco.Uri.parse(`ryxide://project/${currentProject.id}/${fileId}/${oldName}`);
                     if (currentModelInstance && currentModelInstance.uri.toString() === oldUri.toString()) {
                         const newUri = monaco.Uri.parse(`ryxide://project/${currentProject.id}/${fileId}/${newName}`);
                         const currentContent = currentModelInstance.getValue(); const currentViewState = editor.saveViewState();
                         const newModel = monaco.editor.createModel(currentContent, file.language, newUri);
                         editor.setModel(newModel);
                         if (currentViewState) editor.restoreViewState(currentViewState);
                         editor.focus(); currentModelInstance.dispose();
                     } else { fileManager.open(fileId, true); }
                 }
                 hideModal(modalBackdrop, renameFileModal);
             }
        },
        handleDelete: () => {
            if (!currentProject || !currentOpenFileId) return; const fileToDelete = currentProject.files.find(f => f.id === currentOpenFileId); if (!fileToDelete) return;
            if (confirm(`Delete "${fileToDelete.name}"? Cannot be undone.`)) {
                const fileUri = monaco.Uri.parse(`ryxide://project/${currentProject.id}/${fileToDelete.id}/${fileToDelete.name}`);
                currentProject.files = currentProject.files.filter(f => f.id !== currentOpenFileId);
                const nextFileId = currentProject.files[0]?.id || null; currentProject.openFileId = nextFileId;
                if (saveProjectToStorage(currentProject)) {
                    setEditorDirty(false);
                    monaco.editor.getModel(fileUri)?.dispose();
                    if (nextFileId) fileManager.open(nextFileId, true);
                    else { currentOpenFileId = null; if (editor) editor.setModel(null); fileManager.renderList(); updateRunButtonState(); }
                }
            }
        }
    };

    function handleTabSwitch(event) {
         const button = event.target.closest('.tab-button'); if (!button) return;
         const tabName = button.dataset.tab;
         tabButtons.forEach(btn => btn.classList.toggle('active', btn === button));
         tabContents.forEach(content => content.classList.toggle('active', content.id === `${tabName}-tab-content`));
         if (tabName === 'editor' && editor) { setTimeout(() => editor.layout(), 0); editor.focus(); }
         else if (tabName === 'ai-chat') { aiChatInput.focus(); aiChatMessages.scrollTop = aiChatMessages.scrollHeight; }
    }

    const aiChatManager = {
        loadChats: () => {
             if (!currentProject?.aiChats) return; aiChatSelector.innerHTML = '';
             currentProject.aiChats.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
             currentProject.aiChats.forEach(chat => { const option = createDOMElement('option', { value: chat.id, textContent: chat.name || `Chat ${formatDate(chat.createdAt) || chat.id.substring(0,4)}` }); if (chat.id === currentProject.currentAiChatId) option.selected = true; aiChatSelector.appendChild(option); });
             aiChatManager.switchChat(currentProject.currentAiChatId);
             aiDeleteChatButton.disabled = currentProject.aiChats.length <= 1;
        },
        switchChat: (chatId) => {
             if (!currentProject?.aiChats) return; const chat = currentProject.aiChats.find(c => c.id === chatId);
             if (chat) { currentAiChat = chat; currentProject.currentAiChatId = chatId; aiChatManager.renderMessages(); if (aiChatSelector.value !== chatId) aiChatSelector.value = chatId; aiDeleteChatButton.disabled = currentProject.aiChats.length <= 1; }
             else { if(currentProject.aiChats.length > 0) aiChatManager.switchChat(currentProject.aiChats[0].id); else { currentAiChat = null; aiChatMessages.innerHTML = '<p class="empty-chat">No chats.</p>'; aiDeleteChatButton.disabled = true; } }
        },
        renderMessages: () => {
             aiChatMessages.innerHTML = '';
             if (!currentAiChat?.messages?.length) { aiChatMessages.innerHTML = '<p class="empty-chat">Ask AI...</p>'; return; }
             currentAiChat.messages.forEach(msg => aiChatManager.appendMessage(msg.role, msg.parts, msg.previewData));
             aiChatMessages.scrollTop = aiChatMessages.scrollHeight;
        },
        appendMessage: (role, parts, previewData = null) => {
            const avatar = createDOMElement('span', { className: 'ai-avatar', innerHTML: role === 'user' ? '<i class="fas fa-user"></i>' : '<i class="fas fa-robot"></i>' });
            const contentDiv = createDOMElement('div', { className: 'ai-message-content' });
            const messageDiv = createDOMElement('div', { className: `ai-message role-${role}`, children: [avatar, contentDiv] });
            const messageText = Array.isArray(parts) ? parts.map(p => p.text || '').join('') : (parts || '');
            if (role === 'model' && typeof marked !== 'undefined') {
                try {
                    const rawHtml = marked.parse(messageText, { breaks: true, gfm: true, mangle: false, headerIds: false });
                    const tempDiv = document.createElement('div'); tempDiv.innerHTML = rawHtml;
                    tempDiv.querySelectorAll('pre > code').forEach((codeElement) => {
                        const preElement = codeElement.parentElement; const lang = codeElement.className.replace('language-', '') || 'code'; const code = codeElement.textContent || ''; const copyId = `copy-${generateUUID()}`; codeElement.id = copyId;
                        const header = createDOMElement('div', { className: 'code-block-header', children: [ createDOMElement('span', { textContent: escapeHtml(lang) }), createDOMElement('div', { children: [ createDOMElement('button', { className: 'code-action-button copy-code-btn', dataset:{copyTarget: `#${copyId}`}, title: 'Copy Code', innerHTML: '<i class="fas fa-copy"></i>'}), previewData ? createDOMElement('button', { className: 'code-action-button apply-code-btn', dataset: { fileId: previewData.fileId, codeContent: code }, title: `Apply to ${escapeHtml(previewData.fileName)}`, innerHTML: '<i class="fas fa-paste"></i> Apply'}) : null ]}) ]});
                        const wrapper = createDOMElement('div', { className: 'code-block-wrapper' }); preElement.parentNode?.insertBefore(wrapper, preElement); wrapper.appendChild(header); wrapper.appendChild(preElement);
                    });
                    contentDiv.innerHTML = ''; while (tempDiv.firstChild) contentDiv.appendChild(tempDiv.firstChild);
                 } catch (e) { contentDiv.textContent = messageText; }
            } else { contentDiv.textContent = messageText; }
            aiChatMessages.appendChild(messageDiv); aiChatMessages.scrollTop = aiChatMessages.scrollHeight;
        },
         handleSendMessage: async () => {
              const messageText = aiChatInput.value.trim(); if (!messageText || currentAiApiCall) return;
              const apiKey = getApiKey(); if (!apiKey) { alert("Set Gemini API Key in Settings."); aiChatInput.focus(); return; }
              if (!currentAiChat) { return; }
              let contextPrompt = `You are RyxIDE AI. You will act and be as nice as needed, including greetings and sympathy, so on and so forth. You are in: Project: ${currentProject.name || 'Unnamed'}. `; const file = currentOpenFileId && editor ? currentProject.files.find(f=>f.id===currentOpenFileId):null; let currentFileData = null;
              if(file){ currentFileData = file; contextPrompt += `File: ${file.name} (${file.language}). `; const model = editor.getModel(); const sel = editor.getSelection(); const selTxt = sel && !sel.isEmpty() && model ? model.getValueInRange(sel) : null; if(selTxt){ contextPrompt+=`Selected:\n\`\`\`${file.language||''}\n${selTxt}\n\`\`\`\n`; } else { const content = model?.getValue() ?? file.content ?? ''; if(content.length < 4000) contextPrompt+=`Content:\n\`\`\`${file.language||''}\n${content}\n\`\`\`\n`; else contextPrompt+=`(File content large). `; }}
              const otherFiles = currentProject.files.filter(f => f.id !== currentOpenFileId).map(f => f.name).join(', '); if (otherFiles) contextPrompt += `Other files: ${otherFiles}.\n`; contextPrompt += `\nUser Query: ${messageText}`;
              const userMsg = { role: 'user', parts: messageText }; currentAiChat.messages.push(userMsg); aiChatManager.appendMessage(userMsg.role, userMsg.parts); aiChatInput.value = ''; aiSendButton.disabled = true; currentAiApiCall = true; aiChatInput.disabled = true;
              aiChatMessages.querySelector('.thinking')?.remove(); aiChatManager.appendMessage('model', 'Thinking...'); aiChatMessages.lastChild?.classList.add('thinking');
              const historyForApi = currentAiChat.messages.slice(0, -1).filter(msg => !(msg.parts && msg.parts.includes('Thinking...'))).map(msg => ({ role: msg.role, parts: [{ text: Array.isArray(msg.parts) ? msg.parts.map(p => p.text || '').join('') : (msg.parts || '') }] }));
              const result = await callGeminiApi(contextPrompt, apiKey, historyForApi);
              aiChatMessages.querySelector('.thinking')?.remove();
              let previewData = null; if (!result.error) { const aiMode = aiModeSelector.value; const codeBlockMatch = result.text?.match(/```(?:\w*\n)?([\s\S]*?)\n```/); if (aiMode === 'modify' && codeBlockMatch && currentFileData) { previewData = { fileId: currentFileData.id, fileName: currentFileData.name }; } const modelMsg = { role: 'model', parts: result.text || '', previewData }; currentAiChat.messages.push(modelMsg); aiChatManager.appendMessage(modelMsg.role, modelMsg.parts, previewData); saveProjectToStorage(currentProject); } else { aiChatManager.appendMessage('model', `Sorry, error: ${result.error}`); }
              aiSendButton.disabled = false; currentAiApiCall = false; aiChatInput.disabled = false; aiChatInput.focus(); aiChatMessages.scrollTop = aiChatMessages.scrollHeight;
         },
        handleNewChat: () => {
            if (!currentProject) return; const newChatId = generateUUID(); const newChatName = `Chat ${formatDate(Date.now()) || (currentProject.aiChats.length + 1)}`;
            const newChat = { id: newChatId, name: newChatName, messages: [], createdAt: Date.now() };
            currentProject.aiChats.push(newChat); currentProject.currentAiChatId = newChatId;
            if(saveProjectToStorage(currentProject)) aiChatManager.loadChats();
        },
        handleDeleteChat: () => {
            if (!currentProject || !currentAiChat || currentProject.aiChats.length <= 1) { alert("Cannot delete last chat."); return; }
            if (confirm(`Delete chat "${currentAiChat.name || 'this chat'}"?`)) {
                 currentProject.aiChats = currentProject.aiChats.filter(c => c.id !== currentAiChat.id);
                 currentProject.currentAiChatId = currentProject.aiChats[0]?.id || null;
                 if (saveProjectToStorage(currentProject)) aiChatManager.loadChats();
            }
        },
        handleCodeAction: (event) => {
             const button = event.target.closest('.code-action-button'); if (!button) return;
             if (button.classList.contains('copy-code-btn')) {
                  const targetSelector = button.dataset.copyTarget; const codeElement = aiChatMessages.querySelector(targetSelector);
                  if (codeElement) { navigator.clipboard.writeText(codeElement.textContent).then(() => { button.innerHTML = '<i class="fas fa-check"></i>'; updateStatus('Copied!', 'success', 1500); setTimeout(() => { button.innerHTML = '<i class="fas fa-copy"></i>'; }, 1500); }).catch(err => { updateStatus('Copy failed', 'error'); }); }
             } else if (button.classList.contains('apply-code-btn')) {
                   const fileId = button.dataset.fileId; const newContent = button.dataset.codeContent; const file = currentProject?.files.find(f => f.id === fileId);
                   if (file && newContent !== undefined) { aiApplyAction = { fileId, newContent }; aiApplyFilename.textContent = file.name; aiApplyCodePreview.textContent = newContent.substring(0, 500) + (newContent.length > 500 ? '\n... (truncated)' : ''); showModal(modalBackdrop, aiApplyModal); }
                   else { updateStatus('Error preparing apply action', 'error'); }
             }
        },
         confirmApplyCode: () => {
              if (!aiApplyAction || !editor || !currentProject) { alert("Cannot apply changes."); hideModal(modalBackdrop, aiApplyModal); return; }
              const { fileId, newContent } = aiApplyAction; const targetFile = currentProject.files.find(f => f.id === fileId); if (!targetFile) { alert(`Target file not found.`); hideModal(modalBackdrop, aiApplyModal); return; }
              if (currentOpenFileId === fileId) { const model = editor.getModel(); if (model) { const fullRange = model.getFullModelRange(); editor.executeEdits('ai-apply', [{ range: fullRange, text: newContent, forceMoveMarkers: true }]); setEditorDirty(true); updateStatus(`AI applied to editor for ${targetFile.name}.`, 'success'); } else { alert("Error: Editor model not found."); } }
              else { targetFile.content = newContent; if(saveProjectToStorage(currentProject)) updateStatus(`AI applied & saved to ${targetFile.name}.`, 'success'); else updateStatus(`Applied to ${targetFile.name}, but save failed!`, 'error'); }
              hideModal(modalBackdrop, aiApplyModal); aiApplyAction = null;
         }
    };

    const runtimeManager = {
        loadPyodideIfNeeded: async () => { if (isPyodideReady) return true; if (isPyodideLoading) { await new Promise(r => setTimeout(r,100)); return runtimeManager.loadPyodideIfNeeded();} isPyodideLoading = true; showLoader(loaderOverlay, loaderText, "Loading Python..."); updateCredits(); try { pyodide = await window.loadPyodide(); await pyodide.loadPackage(['micropip']); console.log('Pyodide loaded.'); isPyodideReady = true; return true; } catch (e) { console.error('Pyodide Load Error:', e); outputConsole.textContent = `Error loading Python: ${e?.message||e}`; isPyodideReady=false; return false; } finally { isPyodideLoading = false; hideLoader(loaderOverlay); } },
        loadRubyVMIfNeeded: async () => { if (isRubyVMReady) return true; if (isRubyVMLoading) { await new Promise(r=>setTimeout(r,100)); return runtimeManager.loadRubyVMIfNeeded(); } if (!window.DefaultRubyVM) { outputConsole.textContent = "Error: Ruby WASM module failed."; return false; } isRubyVMLoading = true; showLoader(loaderOverlay, loaderText, "Loading Ruby VM..."); updateCredits(); try { const m = await window.DefaultRubyVM(); rubyVM = new m.RubyVM(); const printOutput=(l,msg)=>{outputConsole.textContent+=(l==='error'?'Ruby Error: ':'')+msg+'\n';}; rubyVM.printSync=printOutput; rubyVM.printlnSync=printOutput; await rubyVM.init(); console.log('Ruby VM initialized.'); isRubyVMReady = true; return true; } catch (e) { console.error('Ruby Load Error:', e); outputConsole.textContent = `Error loading Ruby: ${e?.message||e}`; rubyVM=null; isRubyVMReady=false; return false; } finally { isRubyVMLoading = false; hideLoader(loaderOverlay); } },
        loadDotnetRuntimeIfNeeded: async () => { if (isDotnetRuntimeReady) return true; if (isDotnetRuntimeLoading) { await new Promise(r=>setTimeout(r,100)); return runtimeManager.loadDotnetRuntimeIfNeeded(); } if (typeof dotnet === 'undefined' || typeof dotnet.create !== 'function') { outputConsole.textContent = "Error: .NET WASM runtime script not found."; return false; } isDotnetRuntimeLoading = true; showLoader(loaderOverlay, loaderText, "Loading .NET Runtime (Exp)..."); updateCredits(); try { const { getAssemblyExports } = await dotnet.create(); dotnetRuntimeExports = { compileAndRunAsync: async (c) => { outputConsole.textContent += "-- Simulating C# Run --\n"; await new Promise(r=>setTimeout(r,1500)); const o=[], e=[]; if(c.includes("Hello"))o.push("Hello RyxIDE!"); if(c.includes("error"))e.push("Simulated Error."); return { success:e.length===0, errors:e, output:o }; } }; console.log('.NET Runtime Initialized (Simulated).'); isDotnetRuntimeReady = true; return true; } catch (e) { console.error('.NET Load Error:', e); outputConsole.textContent = `Error loading .NET: ${e.message}`; dotnetRuntimeExports=null; isDotnetRuntimeReady=false; return false; } finally { isDotnetRuntimeLoading = false; hideLoader(loaderOverlay); } },
        runCode: () => {
            if (!editor || !currentProject || !currentOpenFileId) return; const file = currentProject.files.find(f => f.id === currentOpenFileId); if (!file) return;
            const code = editor.getValue(); outputConsole.textContent = ''; previewFrame.srcdoc = '';
            updateStatus(`Running ${file.language}...`, 'info', 0);
            switch (file.language) {
                case 'html': runtimeManager.runHtmlPreview(); break;
                case 'javascript': runtimeManager.runJavaScriptCode(code); break;
                case 'css': runtimeManager.runCssPreview(code); break;
                case 'python': runtimeManager.runPythonCode(code); break;
                case 'markdown': runtimeManager.runMarkdownPreview(code); break;
                case 'ruby': runtimeManager.runRubyCode(code); break;
                case 'csharp': runtimeManager.runCSharpCode(code); break;
                case 'java': case 'cpp': case 'c': case 'rust': case 'go': case 'php':
                     outputConsole.textContent = `Use 'Run Externally' button for ${file.language}.`; updateStatus(`${file.language} needs external run.`, 'warning', 5000); break;
                default: outputConsole.textContent = `Run not configured for ${file.language}`; updateStatus(`Cannot run ${file.language}.`, 'info'); break;
            }
        },
        runHtmlPreview: () => { const htmlFile = currentProject?.files.find(f => f.id === currentOpenFileId && f.language === 'html'); if (!htmlFile) { outputConsole.textContent = "Current file is not HTML."; updateStatus('Preview failed', 'error'); return; } let htmlContent = editor?.getValue() ?? htmlFile.content ?? ''; let inlineStyles = ''; let inlineScripts = ''; try { const cssLinks = htmlContent.match(/<link.*?href=["'](.*?)["']/gi) || []; const scriptSrcs = htmlContent.match(/<script.*?src=["'](.*?)["']/gi) || []; cssLinks.forEach(tag => { const href = tag.match(/href=["'](.*?)["']/i)?.[1]; const rel = tag.match(/rel=["']stylesheet["']/i); if (href && rel) { const name = href.split('/').pop(); const cssFile = currentProject.files.find(f=>f.name===name&&f.language==='css'); if(cssFile) inlineStyles+=`\n/* ${escapeHtml(cssFile.name)} */\n${cssFile.content||''}\n`; } }); scriptSrcs.forEach(tag => { const src = tag.match(/src=["'](.*?)["']/i)?.[1]; if (src) { const name = src.split('/').pop(); const jsFile = currentProject.files.find(f=>f.name===name&&f.language==='javascript'); if(jsFile) inlineScripts+=`\n/* ${escapeHtml(jsFile.name)} */\n;(function(){\ntry {\n${jsFile.content||''}\n} catch(e) { console.error('Error in ${escapeHtml(jsFile.name)}:', e); }\n})();\n`; } }); const styleTag = inlineStyles ? `<style>\n${inlineStyles}\n</style>` : ''; const scriptTag = inlineScripts ? `<script>\n${inlineScripts}\nconsole.log("--- Injected Scripts Finished ---");\n</script>` : ''; if (htmlContent.includes('</head>')) htmlContent = htmlContent.replace('</head>', `${styleTag}\n</head>`); else htmlContent = styleTag + htmlContent; if (htmlContent.includes('</body>')) htmlContent = htmlContent.replace('</body>', `${scriptTag}\n</body>`); else htmlContent += scriptTag; previewFrame.srcdoc = htmlContent; outputConsole.textContent = 'HTML preview rendered.'; updateStatus('Preview Ready', 'success'); } catch (e) { console.error("HTML Preview Error:", e); outputConsole.textContent = `Preview Error: ${e.message}`; updateStatus('Preview failed', 'error'); } },
        runCssPreview: (code) => { const cssHtml = `<!DOCTYPE html><html><head><title>CSS</title><style>${escapeHtml(code)}</style></head><body><h1>Heading</h1><p>Paragraph</p><button class="primary">Button</button></body></html>`; previewFrame.srcdoc = cssHtml; outputConsole.textContent = 'CSS preview.'; updateStatus('Preview Ready', 'success');},
        runJavaScriptCode: (code) => { outputConsole.textContent = 'Running JS...\n---\n'; updateStatus('Running JS...', 'info', 0); const fullHtml = `<!DOCTYPE html><html><head><title>JS</title></head><body><script> const console = { log: (...a)=>parent.postMessage({type:'ryx-log',level:'log',args:a.map(x=>String(x))},'*'), error: (...a)=>parent.postMessage({type:'ryx-log',level:'error',args:a.map(x=>String(x))},'*'), warn: (...a)=>parent.postMessage({type:'ryx-log',level:'warn',args:a.map(x=>String(x))},'*'), info: (...a)=>parent.postMessage({type:'ryx-log',level:'info',args:a.map(x=>String(x))},'*'), clear: ()=>parent.postMessage({type:'ryx-log',level:'clear'},'*') }; window.onerror=(m,s,l,c,e)=>{console.error(\`Error: \${m} (\${l}:\${c})\`);return true;}; try { ${code}\n console.log('--- Script Finished ---'); } catch (e) { console.error('Runtime Error:', e.name, e.message); } </script></body></html>`; const listener = (e) => { if (e.source !== previewFrame.contentWindow || e.data?.type !== 'ryx-log') return; const { level, args } = e.data; if(level==='clear') outputConsole.textContent='Console cleared.\n'; else { const p = level==='error'?'ERROR: ':level==='warn'?'WARN: ':level==='info'?'INFO: ':''; outputConsole.textContent += p + args.join(' ') + '\n'; } outputConsole.scrollTop = outputConsole.scrollHeight; }; window.addEventListener('message', listener); previewFrame.srcdoc = fullHtml; setTimeout(() => { window.removeEventListener('message', listener); if (!outputConsole.textContent.includes('--- Script Finished ---') && !outputConsole.textContent.includes('Error:')) { outputConsole.textContent += '(Script may have finished silently or errored)\n'; } updateStatus('JS Finished', 'success'); }, 5000); },
        runPythonCode: async (code) => { const ready = await runtimeManager.loadPyodideIfNeeded(); if(!ready) { updateStatus('Py Runtime Fail', 'error'); return; } outputConsole.textContent='Running Python...\n---\n'; updateStatus('Running Py...', 'info', 0); showLoader(loaderOverlay, loaderText, "Running Python..."); try{ pyodide.setStdout({batched:(m)=>outputConsole.textContent+=m+'\n'}); pyodide.setStderr({batched:(m)=>outputConsole.textContent+=`PyError: ${m}\n`}); await pyodide.runPythonAsync(code); outputConsole.textContent+='\n--- Python Finished ---'; updateStatus('Py Finished', 'success');} catch(e){ console.error('Py error:', e); outputConsole.textContent+=`\n--- Py Error ---\n${e.message}`; updateStatus('Py Error', 'error');} finally { pyodide.setStdout({}); pyodide.setStderr({}); hideLoader(loaderOverlay); outputConsole.scrollTop=outputConsole.scrollHeight; }},
        runMarkdownPreview: (code) => { if(typeof marked==='undefined') { updateStatus('MD Preview Fail', 'error'); return; } try{ const html = marked.parse(code, { breaks: true, gfm: true, mangle: false, headerIds: false }); const fullHtml = `<!DOCTYPE html><html><head><title>MD</title><style>body{font-family:sans-serif;padding:1.5em;line-height:1.6;}pre{background:#f0f0f0;padding:1em;border-radius:4px;overflow-x:auto;}code:not(pre code){background:rgba(0,0,0,0.05);padding:2px 4px;}blockquote{border-left:4px solid #ccc;padding-left:1em;margin-left:0;color:#666;}table{border-collapse:collapse;}th,td{border:1px solid #ccc;padding:0.5em;}img{max-width:100%;}</style></head><body>${html}</body></html>`; previewFrame.srcdoc = fullHtml; outputConsole.textContent='Markdown rendered.'; updateStatus('MD Preview Ready', 'success');} catch(e){ outputConsole.textContent=`MD Error: ${e.message}`; updateStatus('MD Preview Fail', 'error');}},
        runRubyCode: async (code) => { const ready = await runtimeManager.loadRubyVMIfNeeded(); if(!ready || !rubyVM) { updateStatus('Ruby Runtime Fail', 'error'); return; } outputConsole.textContent='Running Ruby (Exp)...\n---\n'; updateStatus('Running Ruby...', 'info', 0); showLoader(loaderOverlay, loaderText, "Running Ruby..."); try { await rubyVM.evalAsync(code); outputConsole.textContent+='\n--- Ruby Finished ---'; updateStatus('Ruby Finished', 'success'); } catch(e){ console.error('Ruby error:', e); outputConsole.textContent+=`\n--- Ruby Error ---\n${e?.message||e}`; updateStatus('Ruby Error', 'error'); } finally { hideLoader(loaderOverlay); outputConsole.scrollTop=outputConsole.scrollHeight; }},
        runCSharpCode: async (code) => { const ready = await runtimeManager.loadDotnetRuntimeIfNeeded(); if (!ready || !dotnetRuntimeExports?.compileAndRunAsync) { outputConsole.textContent += "\n.NET env failed."; updateStatus('.NET Fail', 'error'); return; } outputConsole.textContent='Running C# (PoC)...\n---\n'; updateStatus('Running C#...', 'info', 0); showLoader(loaderOverlay, loaderText, "Running C#..."); try { const result = await dotnetRuntimeExports.compileAndRunAsync(code); if (result.output?.length > 0) outputConsole.textContent += result.output.join('\n') + '\n'; if (!result.success && result.errors?.length > 0) { outputConsole.textContent += '---\nErrors:\n' + result.errors.join('\n'); updateStatus('C# Error', 'error'); } else if(result.success) updateStatus('C# Finished', 'success'); else updateStatus('C# Finished (?)', 'warning'); } catch (e) { console.error('C# WASM Error:', e); outputConsole.textContent += `\n--- C# WASM Error ---\n${e?.message||e}`; updateStatus('C# Error', 'error'); } finally { hideLoader(loaderOverlay); outputConsole.scrollTop = outputConsole.scrollHeight; }}
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
        const features = new Set(['Monaco', 'Gemini']);
        if (isPyodideReady || isPyodideLoading) features.add('Pyodide');
        if (isRubyVMReady || isRubyVMLoading) features.add('Ruby(Exp)');
        if (isDotnetRuntimeReady || isDotnetRuntimeLoading) features.add('.NET(PoC)');
        if (typeof marked !== 'undefined') features.add('Marked');
        if (typeof JSZip !== 'undefined') features.add('JSZip');
        creditsElement.textContent = `Powered by: ${Array.from(features).join(', ')}.`;
    }

    function updateRunButtonState() {
         const file = currentProject?.files.find(f => f.id === currentOpenFileId);
         const lang = file?.language || 'plaintext';
         const runnableInternal = ['html', 'css', 'javascript', 'python', 'markdown', 'ruby', 'csharp'].includes(lang);
         const runnableExternalKey = lang === 'java' ? 'java' : (lang === 'cpp' || lang === 'c') ? 'cpp' : lang === 'rust' ? 'rust' : lang === 'go' ? 'go' : lang === 'php' ? 'php' : null;
         const externalLink = runnableExternalKey ? externalSandboxLinks[runnableExternalKey] : null;
         runButton.disabled = !runnableInternal;
         runButton.style.display = (runnableInternal || !externalLink) ? 'inline-flex' : 'none';
         runButton.title = runnableInternal ? `Run/Preview ${lang}` : 'Run/Preview not supported';
         runExternalButton.style.display = externalLink ? 'inline-flex' : 'none';
         if (externalLink) {
             runExternalButton.href = externalLink;
             runExternalButton.title = `Run ${lang} in External Sandbox`;
         }
    }

    initializeEditorPage();
});
