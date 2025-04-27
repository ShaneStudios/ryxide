document.addEventListener('DOMContentLoaded', () => {
    const editorView = document.getElementById('editor-view');
    const editorProjectNameH1 = document.getElementById('editor-project-name');
    const statusIndicator = document.getElementById('status-indicator');
    const creditsElement = document.getElementById('credits');
    const loaderOverlay = document.getElementById('loader-overlay');
    const loaderText = document.getElementById('loader-text');
    const backToDashboardButton = document.getElementById('back-to-dashboard-button');
    const saveProjectButton = document.getElementById('save-project-button');
    const themeSelectorHeader = document.getElementById('theme-selector-header');
    const findButton = document.getElementById('find-button');
    const replaceButton = document.getElementById('replace-button');
    const gotoLineInput = document.getElementById('goto-line-input');
    const gotoLineButton = document.getElementById('goto-line-button');
    const runButton = document.getElementById('run-button');
    const runExternalButton = document.getElementById('run-external-button');
    const shortcutsButton = document.getElementById('shortcuts-button');
    const filePane = document.getElementById('file-pane');
    const fileListUl = document.getElementById('file-list');
    const newFileButton = document.getElementById('new-file-button');
    const deleteFileButton = document.getElementById('delete-file-button');
    const renameFileButton = document.getElementById('rename-file-button');
    const editorTabsArea = document.getElementById('editor-tabs-area');
    const tabBar = document.querySelector('.tab-bar');
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    const editorContainer = document.getElementById('editor-container');
    const aiChatInterface = document.getElementById('ai-chat-interface');
    const aiChatSelector = document.getElementById('ai-chat-selector');
    const aiNewChatButton = document.getElementById('ai-new-chat-button');
    const aiDeleteChatButton = document.getElementById('ai-delete-chat-button');
    const aiModeSelector = document.getElementById('ai-mode-selector');
    const aiChatMessages = document.getElementById('ai-chat-messages');
    const aiChatInput = document.getElementById('ai-chat-input');
    const aiSendButton = document.getElementById('ai-send-button');
    const sidePane = document.getElementById('side-pane');
    const previewPane = document.getElementById('preview-pane');
    const previewFrame = document.getElementById('preview-frame');
    const outputConsoleContainer = document.getElementById('output-console-container');
    const outputConsole = document.getElementById('output-console');
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
        if (!projectId) {
            handleMissingProject("No project selected.");
            return;
        }
        currentProject = getProjectFromStorage(projectId);
        if (!currentProject) {
            handleMissingProject("Failed to load project data.");
            return;
        }
        ensureProjectIntegrity();
        editorProjectNameH1.textContent = `RyxIDE - ${currentProject.name || 'Untitled'}`;
        document.title = `RyxIDE - ${currentProject.name || 'Editor'}`;
        setupMonaco();
        updateCredits();
    }
    function handleMissingProject(message) {
         alert(message + " Redirecting to dashboard.");
         setCurrentProjectId(null);
         window.location.href = 'index.html';
    }
    function ensureProjectIntegrity() {
         if (!currentProject.aiChats || !Array.isArray(currentProject.aiChats) || currentProject.aiChats.length === 0) {
             console.warn("Project missing valid aiChats array. Initializing.");
             const defaultChatId = generateUUID();
             currentProject.aiChats = [{ id: defaultChatId, name: 'Chat 1', messages: [], createdAt: Date.now() }];
             currentProject.currentAiChatId = defaultChatId;
         }
          if (!currentProject.currentAiChatId || !currentProject.aiChats.find(c => c.id === currentProject.currentAiChatId)) {
              console.warn("Project currentAiChatId is invalid or missing. Resetting.");
              currentProject.currentAiChatId = currentProject.aiChats[0]?.id || null;
          }
    }
    function postMonacoSetup() {
         currentOpenFileId = currentProject.openFileId || currentProject.files[0]?.id || null;
         renderFileList();
         if (currentOpenFileId) {
              openFile(currentOpenFileId, true);
         } else {
              updateRunButtonState();
              if (editor) {
                  // editor.setValue("// No file open. Select or create a file from the left pane.");
                  // monaco.editor.setModelLanguage(editor.getModel(), 'plaintext');
                  // Heyo person checking the code! This set of comments is just some code being taken out for testing!
              }
         }
         loadAiChats();
         applySettings();
         setEditorDirty(false);
         setupEventListeners();
    }
     function applySettings() {
        if (editor) {
            monaco.editor.setTheme(currentSettings.theme);
        }
        themeSelectorHeader.value = currentSettings.theme;
        console.log("Applied settings:", currentSettings);
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
                return `data:text/javascript;charset=utf-8,${encodeURIComponent(`
                    self.MonacoEnvironment = { baseUrl: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.46.0/min/' };
                    importScripts('${workerMap[label] || workerMap.editorWorkerService}');`
                )}`;
            }
        };
        require(['vs/editor/editor.main'], function() {
            editor = monaco.editor.create(editorContainer, {
                theme: currentSettings.theme,
                automaticLayout: true,
                minimap: { enabled: true },
                wordWrap: 'on',
                contextmenu: true,
                fontSize: 14,
            });
            editor.onDidChangeModelContent((e) => {
                if (!e.isFlush && currentProject && currentOpenFileId) {
                    setEditorDirty(true);
                    handleAutoSave();
                }
            });
            setupEditorKeybindings();
            postMonacoSetup();
        });
    }
    function setupEditorKeybindings() {
         if (!editor) return;
         editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, handleSaveProject, '!suggestWidgetVisible && !findWidgetVisible');
         editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyF, () => editor.getAction('actions.find').run());
         editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyH, () => editor.getAction('editor.action.startFindReplaceAction').run());
    }
    function setEditorDirty(isDirty) {
        if (!currentOpenFileId && isDirty) isDirty = false;
        editorDirty = isDirty;
        saveProjectButton.disabled = !isDirty;
        statusIndicator.textContent = isDirty ? '* Unsaved Changes' : '';
        statusIndicator.className = isDirty ? 'status-warning' : '';
        document.title = `RyxIDE - ${currentProject?.name || 'Editor'}${isDirty ? '*' : ''}`;
    }
    function updateStatus(message, type = 'info', duration = 3000) {
         statusIndicator.textContent = message;
         statusIndicator.className = `status-${type}`;
         if (duration > 0) {
            setTimeout(() => {
                if (!editorDirty && statusIndicator.textContent === message) {
                    statusIndicator.textContent = '';
                    statusIndicator.className = '';
                }
            }, duration);
         }
    }
    function handleSaveProject() {
        if (!currentProject || !editor) return;
        if (currentOpenFileId) {
            const file = currentProject.files.find(f => f.id === currentOpenFileId);
            if (file) {
                file.content = editor.getValue();
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
        autoSaveTimeout = setTimeout(() => {
            console.log("Auto-saving project...");
            handleSaveProject();
        }, 1500);
    }
    const fileManager = {
        renderList: () => {
            if (!currentProject) return;
            fileListUl.innerHTML = '';
            currentProject.files.sort((a,b) => a.name.localeCompare(b.name)).forEach(file => {
                const icon = createDOMElement('i', { className: `file-icon ${fileManager.getIconClass(file.name)}` });
                const nameSpan = createDOMElement('span', { textContent: file.name });
                const li = createDOMElement('li', {
                    dataset: { fileId: file.id },
                    title: file.name,
                    children: [icon, nameSpan]
                });
                if (file.id === currentOpenFileId) li.classList.add('active');
                fileListUl.appendChild(li);
            });
            const fileSelected = !!currentOpenFileId;
            deleteFileButton.disabled = !fileSelected;
            renameFileButton.disabled = !fileSelected;
        },
        getIconClass: (filename) => {
             const lang = getLanguageFromFilename(filename);
             const iconMap = {
                 html: 'fab fa-html5', css: 'fab fa-css3-alt', javascript: 'fab fa-js-square',
                 python: 'fab fa-python', markdown: 'fab fa-markdown', json: 'fas fa-file-code',
                 java: 'fab fa-java', csharp: 'fas fa-hashtag', cpp: 'fas fa-plus',
                 c: 'fas fa-copyright',
                 rust: 'fab fa-rust', go: 'fab fa-google', php: 'fab fa-php',
                 rb: 'fas fa-gem',
                 sh: 'fas fa-terminal',
                 xml: 'fas fa-file-code',
                 yaml: 'fas fa-file-alt',
             };
             return iconMap[lang] || 'fas fa-file';
        },
        open: (fileId, force = false) => {
             if (!currentProject || !editor) return;
             if (!force && editorDirty && !confirm("You have unsaved changes in the current file. Switch anyway and discard changes?")) {
                 return;
             }
             const file = currentProject.files.find(f => f.id === fileId);
             if (!file) {
                  console.error(`File with ID ${fileId} not found in project ${currentProject.id}`);
                  editor.setValue(`// Error: File not found (ID: ${fileId})`);
                  monaco.editor.setModelLanguage(editor.getModel(), 'plaintext');
                  currentOpenFileId = null;
                  fileManager.renderList();
                  setEditorDirty(false);
                  updateRunButtonState();
                  return;
             }
             currentOpenFileId = file.id;
             currentProject.openFileId = file.id;
             const modelUri = monaco.Uri.parse(`ryxide://project/${currentProject.id}/${file.id}/${file.name}`);
             let model = monaco.editor.getModel(modelUri);
             if (!model) {
                 model = monaco.editor.createModel(file.content || '', file.language, modelUri);
                 console.log(`Created new model for ${file.name}`);
             } else {
                 if (model.getValue() !== (file.content || '')) {
                     model.setValue(file.content || '');
                     console.log(`Updated model content for ${file.name}`);
                 }
                 if (model.getLanguageId() !== file.language) {
                     monaco.editor.setModelLanguage(model, file.language);
                     console.log(`Updated model language for ${file.name} to ${file.language}`);
                 }
             }
             editor.focus();
             outputConsole.textContent = '';
             previewFrame.srcdoc = '';
             fileManager.renderList();
             setEditorDirty(false);
             updateRunButtonState();
        },
        handleNew: () => {
            fileNameInput.value = '';
            showModal(modalBackdrop, newFileModal);
        },
        confirmNew: () => {
            const fileName = fileNameInput.value.trim();
            if (!fileName || !currentProject) { alert("Please enter a valid file name."); return; }
            if (currentProject.files.some(f => f.name.toLowerCase() === fileName.toLowerCase())) {
                alert(`A file named "${fileName}" already exists in this project.`);
                fileNameInput.focus();
                return;
            }
            const fileLang = getLanguageFromFilename(fileName);
            const newFile = {
                id: generateUUID(),
                name: fileName,
                language: fileLang,
                content: starterContentByLanguage[fileLang] || ''
            };
            currentProject.files.push(newFile);
            currentProject.openFileId = newFile.id;
            if(saveProjectToStorage(currentProject)) {
                 fileManager.renderList();
                 fileManager.open(newFile.id, true);
                 setEditorDirty(true);
                 hideModal(modalBackdrop, newFileModal);
            }
        },
        handleRename: (fileIdToRename = null) => {
            const fileId = fileIdToRename || currentOpenFileId;
            if (!currentProject || !fileId) return;
            const file = currentProject.files.find(f => f.id === fileId);
            if (!file) { console.error("File to rename not found:", fileId); return; }
            newFileNameInput.value = file.name;
            renameFileModal.dataset.fileId = fileId;
            showModal(modalBackdrop, renameFileModal);
        },
        confirmRename: () => {
             const fileId = renameFileModal.dataset.fileId;
             const newName = newFileNameInput.value.trim();
             if (!fileId || !newName || !currentProject) { alert("Invalid input for renaming."); return; }
             const file = currentProject.files.find(f => f.id === fileId);
             if (!file) { alert("File not found. Cannot rename."); hideModal(modalBackdrop, renameFileModal); return; }
             if (newName === file.name) { hideModal(modalBackdrop, renameFileModal); return; }
             if (currentProject.files.some(f => f.name.toLowerCase() === newName.toLowerCase() && f.id !== fileId)) {
                 alert(`Another file named "${newName}" already exists.`);
                 newFileNameInput.focus();
                 return;
             }
             const oldName = file.name;
             file.name = newName;
             file.language = getLanguageFromFilename(newName);
             if(saveProjectToStorage(currentProject)) {
                 setEditorDirty(true);
                 fileManager.renderList();
                 if (currentOpenFileId === fileId && editor) {
                     const oldUri = monaco.Uri.parse(`ryxide://project/${currentProject.id}/${fileId}/${oldName}`);
                     const newUri = monaco.Uri.parse(`ryxide://project/${currentProject.id}/${fileId}/${newName}`);
                     const currentModel = editor.getModel();
                     if (currentModel && currentModel.uri.toString() === oldUri.toString()) {
                         // monaco.editor.getModel(oldUri)?.dispose();
                         // Be cautious with dispose, temporarily disabled for testing
                         let newModel = monaco.editor.getModel(newUri);
                         if (!newModel) {
                             newModel = monaco.editor.createModel(file.content || '', file.language, newUri);
                         } else {
                              monaco.editor.setModelLanguage(newModel, file.language);
                              // newModel.setValue(file.content || '');
                              // Temporarily disabled for testing
                         }
                         editor.setModel(newModel);
                         console.log(`Editor model updated for renamed file: ${newName}`);
                     } else {
                         const existingModel = monaco.editor.getModel(oldUri);
                         if (existingModel) {
                            console.warn(`Model exists for renamed file (${oldName}) but wasn't active. Language updated.`);
                            monaco.editor.setModelLanguage(existingModel, file.language);
                         }
                     }
                 }
                 hideModal(modalBackdrop, renameFileModal);
             }
        },
        handleDelete: () => {
            if (!currentProject || !currentOpenFileId) return;
            const fileToDelete = currentProject.files.find(f => f.id === currentOpenFileId);
            if (!fileToDelete) return;
            if (confirm(`Are you sure you want to permanently delete the file "${fileToDelete.name}"? This cannot be undone.`)) {
                const fileUri = monaco.Uri.parse(`ryxide://project/${currentProject.id}/${fileToDelete.id}/${fileToDelete.name}`);
                currentProject.files = currentProject.files.filter(f => f.id !== currentOpenFileId);
                const nextFileId = currentProject.files[0]?.id || null;
                currentProject.openFileId = nextFileId;
                if (saveProjectToStorage(currentProject)) {
                    setEditorDirty(false);
                    const modelToDelete = monaco.editor.getModel(fileUri);
                    if (modelToDelete) {
                        modelToDelete.dispose();
                        console.log(`Disposed model for deleted file: ${fileToDelete.name}`);
                    }
                    if (nextFileId) {
                        fileManager.open(nextFileId, true);
                    } else {
                        currentOpenFileId = null;
                        if (editor) editor.setModel(null);
                        fileManager.renderList();
                        updateRunButtonState();
                    }
                }
            }
        }
    };
    function handleTabSwitch(event) {
         const button = event.target.closest('.tab-button');
         if (!button) return;
         const tabName = button.dataset.tab;
         tabButtons.forEach(btn => btn.classList.toggle('active', btn === button));
         tabContents.forEach(content => content.classList.toggle('active', content.id === `${tabName}-tab-content`));
         if (tabName === 'editor' && editor) {
              setTimeout(() => editor.layout(), 0);
              editor.focus();
         } else if (tabName === 'ai-chat') {
             aiChatInput.focus();
             aiChatMessages.scrollTop = aiChatMessages.scrollHeight;
         }
    }
    const aiChatManager = {
        loadChats: () => {
             if (!currentProject?.aiChats) return;
             aiChatSelector.innerHTML = '';
             currentProject.aiChats.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
             currentProject.aiChats.forEach(chat => {
                 const option = createDOMElement('option', {
                     value: chat.id,
                     textContent: chat.name || `Chat ${formatDate(chat.createdAt)}`
                 });
                 if (chat.id === currentProject.currentAiChatId) option.selected = true;
                 aiChatSelector.appendChild(option);
             });
             aiChatManager.switchChat(currentProject.currentAiChatId);
        },
        switchChat: (chatId) => {
             if (!currentProject?.aiChats) return;
             const chat = currentProject.aiChats.find(c => c.id === chatId);
             if (chat) {
                 currentAiChat = chat;
                 currentProject.currentAiChatId = chatId;
                 aiChatManager.renderMessages();
                 aiChatSelector.value = chatId;
                 aiDeleteChatButton.disabled = currentProject.aiChats.length <= 1;
             } else {
                  console.warn(`Attempted to switch to non-existent chat: ${chatId}. Falling back.`);
                  if (currentProject.aiChats.length > 0) {
                      aiChatManager.switchChat(currentProject.aiChats[0].id);
                  } else {
                       currentAiChat = null;
                       aiChatMessages.innerHTML = '<p class="empty-chat">No chat history available.</p>';
                  }
             }
        },
        renderMessages: () => {
             aiChatMessages.innerHTML = '';
             if (!currentAiChat?.messages?.length) {
                 aiChatMessages.innerHTML = '<p class="empty-chat">Start the conversation by typing below!</p>';
                 return;
             }
             currentAiChat.messages.forEach(msg => aiChatManager.appendMessage(msg.role, msg.parts, msg.previewData));
             aiChatMessages.scrollTop = aiChatMessages.scrollHeight;
        },
        appendMessage: (role, parts, previewData = null) => {
            const avatar = createDOMElement('span', { className: 'ai-avatar', innerHTML: role === 'user' ? '<i class="fas fa-user"></i>' : '<i class="fas fa-robot"></i>' });
            const contentDiv = createDOMElement('div', { className: 'ai-message-content' });
            const messageDiv = createDOMElement('div', { className: `ai-message role-${role}`, children: [avatar, contentDiv] });
            if (role === 'model' && typeof marked !== 'undefined') {
                try {
                    const rawHtml = marked.parse(parts || '');
                    contentDiv.innerHTML = rawHtml.replace(/<pre><code(?: class="language-(\w+)")?>([\s\S]*?)<\/code><\/pre>/g, (match, lang, code) => {
                        const safeLang = escapeHtml(lang || 'code');
                        const copyId = `copy-${generateUUID()}`;
                        const header = createDOMElement('div', { className: 'code-block-header', children: [
                            createDOMElement('span', { textContent: safeLang }),
                            createDOMElement('div', { children: [
                                 createDOMElement('button', { className: 'code-action-button copy-code-btn', dataset:{copyTarget: `#${copyId}`}, title: 'Copy Code', innerHTML: '<i class="fas fa-copy"></i>'}),
                                 previewData ? createDOMElement('button', { className: 'code-action-button apply-code-btn', dataset: { fileId: previewData.fileId, codeContent: code }, title: `Apply to ${escapeHtml(previewData.fileName)}`, innerHTML: '<i class="fas fa-paste"></i> Apply'}) : null
                            ]})
                        ]});
                        const codeElement = createDOMElement('code', { id: copyId, className: lang ? `language-${lang}` : '', textContent: code });
                        const preElement = createDOMElement('pre', { children: [codeElement] });
                        const wrapper = createDOMElement('div', { className: 'code-block-wrapper', children: [header, preElement] });
                        return wrapper.outerHTML;
                     });
                 } catch (e) {
                     console.error("Markdown parsing error:", e);
                     contentDiv.textContent = parts;
                 }
            } else {
                 contentDiv.textContent = Array.isArray(parts) ? parts.map(p => p.text || '').join('') : (parts || '');
            }
            aiChatMessages.appendChild(messageDiv);
            aiChatMessages.scrollTop = aiChatMessages.scrollHeight;
        },
         handleSendMessage: async () => {
              const messageText = aiChatInput.value.trim();
              if (!messageText || currentAiApiCall) return;
              const apiKey = getApiKey();
              if (!apiKey) {
                  alert("Please set your Google Gemini API Key in Settings first.");
                  aiChatInput.focus();
                  return;
              }
              if (!currentAiChat) {
                   console.error("Cannot send message: No active AI chat.");
                   return;
              }
              let contextPrompt = `You are RyxAI, an AI assistant in a web-based IDE.\n`;
              contextPrompt += `Current Project: ${currentProject.name || 'Unnamed Project'}.\n`;
              let currentFileData = null;
              if (currentOpenFileId) {
                  const file = currentProject.files.find(f => f.id === currentOpenFileId);
                  if (file) {
                      currentFileData = file;
                      contextPrompt += `Current File: ${file.name} (Lang: ${file.language}).\n`;
                      const selection = editor?.getSelection();
                      const selectedText = selection && !selection.isEmpty() ? editor.getModel().getValueInRange(selection) : null;
                      if (selectedText) {
                           contextPrompt += `Selected Code:\n\`\`\`${file.language || ''}\n${selectedText}\n\`\`\`\n`;
                      } else {
                           const fileContent = editor?.getValue() ?? file.content ?? '';
                           if (fileContent.length < 4000) {
                                contextPrompt += `Full Content of ${file.name}:\n\`\`\`${file.language || ''}\n${fileContent}\n\`\`\`\n`;
                           } else {
                                contextPrompt += `(Content of ${file.name} is large, only showing selection if available).\n`;
                           }
                      }
                  }
              }
              const otherFiles = currentProject.files.filter(f => f.id !== currentOpenFileId).map(f => f.name).join(', ');
              if (otherFiles) contextPrompt += `Other files: ${otherFiles}.\n`;
              contextPrompt += `\nUser Query: ${messageText}`;
              const userMsg = { role: 'user', parts: messageText };
              currentAiChat.messages.push(userMsg);
              aiChatManager.appendMessage(userMsg.role, userMsg.parts);
              aiChatInput.value = '';
              aiSendButton.disabled = true;
              currentAiApiCall = true;
              aiChatInput.disabled = true;
              const thinkingMsg = aiChatMessages.querySelector('.thinking');
              if(thinkingMsg) thinkingMsg.remove();
              aiChatManager.appendMessage('model', 'Thinking...');
              aiChatMessages.lastChild?.classList.add('thinking');
              const historyForApi = currentAiChat.messages.slice(0, -1)
                  .filter(msg => !(msg.parts && msg.parts.includes('Thinking...')))
                  .map(msg => ({
                       role: msg.role,
                       parts: [{ text: Array.isArray(msg.parts) ? msg.parts.map(p => p.text || '').join('') : (msg.parts || '') }]
                  }));
              const result = await callGeminiApi(contextPrompt, apiKey, historyForApi);
              aiChatMessages.querySelector('.thinking')?.remove();
              let previewData = null;
              if (!result.error) {
                  const aiMode = aiModeSelector.value;
                  let responseText = result.text || '';
                  const codeBlockMatch = responseText.match(/```(?:\w*\n)?([\s\S]*?)\n```/);
                  if (aiMode === 'modify' && codeBlockMatch && currentFileData) {
                       previewData = {
                            fileId: currentFileData.id,
                            fileName: currentFileData.name
                       };
                       console.log("AI response contains code block in Modify mode for file:", currentFileData.name);
                  }
                  const modelMsg = { role: 'model', parts: responseText, previewData: previewData };
                  currentAiChat.messages.push(modelMsg);
                  aiChatManager.appendMessage(modelMsg.role, modelMsg.parts, previewData);
                  saveProjectToStorage(currentProject);
              } else {
                  aiChatManager.appendMessage('model', `Sorry, I encountered an error: ${result.error}`);
                  // currentAiChat.messages.push({ role: 'model', parts: `Error: ${result.error}` });
                  //This bit logs the error but won't save it to the chat, disabled for testing
              }
              aiSendButton.disabled = false;
              currentAiApiCall = false;
              aiChatInput.disabled = false;
              aiChatInput.focus();
              aiChatMessages.scrollTop = aiChatMessages.scrollHeight;
         },
        handleNewChat: () => {
            if (!currentProject) return;
            const newChatId = generateUUID();
            const newChatName = `Chat ${currentProject.aiChats.length + 1}`;
            const newChat = { id: newChatId, name: newChatName, messages: [], createdAt: Date.now() };
            currentProject.aiChats.push(newChat);
            currentProject.currentAiChatId = newChatId;
            if(saveProjectToStorage(currentProject)) {
                aiChatManager.loadChats();
            }
        },
        handleDeleteChat: () => {
            if (!currentProject || !currentAiChat || currentProject.aiChats.length <= 1) {
                 alert("Cannot delete the last chat history.");
                 return;
            }
            if (confirm(`Are you sure you want to delete the chat "${currentAiChat.name || 'this chat'}"? This cannot be undone.`)) {
                 currentProject.aiChats = currentProject.aiChats.filter(c => c.id !== currentAiChat.id);
                 currentProject.currentAiChatId = currentProject.aiChats[0]?.id || null;
                 if (saveProjectToStorage(currentProject)) {
                     aiChatManager.loadChats();
                 }
            }
        },
        handleCodeAction: (event) => {
             const button = event.target.closest('.code-action-button');
             if (!button) return;
             if (button.classList.contains('copy-code-btn')) {
                  const targetSelector = button.dataset.copyTarget;
                  const codeElement = document.querySelector(targetSelector);
                  if (codeElement) {
                       navigator.clipboard.writeText(codeElement.textContent).then(() => {
                           button.innerHTML = '<i class="fas fa-check"></i>';
                           updateStatus('Code copied!', 'success', 1500);
                           setTimeout(() => { button.innerHTML = '<i class="fas fa-copy"></i>'; }, 1500);
                       }).catch(err => {
                           console.error('Failed to copy code:', err);
                           updateStatus('Copy failed!', 'error');
                       });
                  }
             } else if (button.classList.contains('apply-code-btn')) {
                   const fileId = button.dataset.fileId;
                   const newContent = button.dataset.codeContent;
                   const file = currentProject?.files.find(f => f.id === fileId);
                   if (file && newContent !== undefined) {
                        aiApplyAction = { fileId, newContent };
                        aiApplyFilename.textContent = file.name;
                        aiApplyCodePreview.textContent = newContent.substring(0, 500) + (newContent.length > 500 ? '\n... (truncated)' : '');
                        showModal(modalBackdrop, aiApplyModal);
                   } else {
                        console.error("Could not find file or code content for AI apply action.", button.dataset);
                        updateStatus("Error preparing code application", 'error');
                   }
             }
        },
         confirmApplyCode: () => {
              if (!aiApplyAction || !editor || !currentProject) {
                  alert("Cannot apply changes. Action data missing or editor not ready.");
                  hideModal(modalBackdrop, aiApplyModal);
                  return;
              }
              const { fileId, newContent } = aiApplyAction;
              const targetFile = currentProject.files.find(f => f.id === fileId);
              if (!targetFile) {
                  alert(`Target file (ID: ${fileId}) not found in the project.`);
                  hideModal(modalBackdrop, aiApplyModal);
                  return;
              }
              if (currentOpenFileId === fileId) {
                  const model = editor.getModel();
                  if (model) {
                      const fullRange = model.getFullModelRange();
                      editor.executeEdits('ai-apply', [{
                          range: fullRange,
                          text: newContent,
                          forceMoveMarkers: true
                      }]);
                      targetFile.content = newContent;
                      setEditorDirty(true);
                      updateStatus(`AI changes applied to ${targetFile.name}.`, 'success');
                  } else {
                       alert("Error: Could not find editor model for the open file.");
                  }
              } else {
                  targetFile.content = newContent;
                  if(saveProjectToStorage(currentProject)){
                     updateStatus(`AI changes applied and saved to ${targetFile.name}.`, 'success');
                  } else {
                       updateStatus(`Applied changes to ${targetFile.name}, but failed to save project!`, 'error');
                  }
              }
              hideModal(modalBackdrop, aiApplyModal);
              aiApplyAction = null;
         }
    };
    const runtimeManager = {
        loadPyodideIfNeeded: async () => {
            if (isPyodideReady) return true;
            if (isPyodideLoading) { await new Promise(r => setTimeout(r,100)); return runtimeManager.loadPyodideIfNeeded();}
            isPyodideLoading = true;
            showLoader(loaderOverlay, loaderText, "Loading Python Runtime (Pyodide)...");
            updateCredits();
            try {
                pyodide = await window.loadPyodide();
                await pyodide.loadPackage(['micropip']);
                console.log('Pyodide loaded successfully');
                isPyodideReady = true;
                return true;
            } catch (error) {
                console.error('Failed to load Pyodide:', error);
                outputConsole.textContent = `Error loading Python environment: ${error?.message || error}\nPyodide may be blocked or failed to download.`;
                isPyodideReady = false;
                return false;
            } finally {
                isPyodideLoading = false;
                hideLoader(loaderOverlay);
            }
        },
        loadRubyVMIfNeeded: async () => {
            if (isRubyVMReady) return true;
            if (isRubyVMLoading) { await new Promise(r=>setTimeout(r,100)); return runtimeManager.loadRubyVMIfNeeded(); }
            if (!window.DefaultRubyVM) {
                 outputConsole.textContent = "Error: Ruby WASM module failed to load initially. Cannot run Ruby.";
                 return false;
            }
            isRubyVMLoading = true;
            showLoader(loaderOverlay, loaderText, "Loading Ruby VM (Experimental)...");
            updateCredits();
            try {
                const rubyModule = await window.DefaultRubyVM();
                rubyVM = new rubyModule.RubyVM();
                let stderr = "";
                const printOutput = (level, msg) => {
                    const prefix = level === 'error' ? 'Ruby Error: ' : '';
                    outputConsole.textContent += prefix + msg + '\n';
                     if(level === 'error') stderr += msg + '\n';
                };
                rubyVM.printSync = (level, msg) => printOutput(level, msg);
                rubyVM.printlnSync = (level, msg) => printOutput(level, msg);
                // Potential async versions I put here but left out due to the Ruby support being experimental
                // rubyVM.print = async (level, msg) => printOutput(level, msg);
                // rubyVM.println = async (level, msg) => printOutput(level, msg);
                await rubyVM.init();
                console.log('Ruby VM initialized successfully');
                isRubyVMReady = true;
                return true;
            } catch (error) {
                console.error('Failed to load/init Ruby VM:', error);
                outputConsole.textContent = `Error loading Ruby environment: ${error?.message || error}\nRuby WASM is experimental and may fail.`;
                rubyVM = null;
                isRubyVMReady = false;
                return false;
            } finally {
                isRubyVMLoading = false;
                hideLoader(loaderOverlay);
            }
        },
        loadDotnetRuntimeIfNeeded: async () => {
            if (isDotnetRuntimeReady) return true;
            if (isDotnetRuntimeLoading) { await new Promise(r=>setTimeout(r,100)); return runtimeManager.loadDotnetRuntimeIfNeeded(); }
            if (typeof dotnet === 'undefined' || typeof dotnet.create !== 'function') {
                 outputConsole.textContent = "Error: .NET WASM runtime script not loaded or invalid.\n(Requires a proper .NET SDK build output).";
                 return false;
            }
            isDotnetRuntimeLoading = true;
            showLoader(loaderOverlay, loaderText, "Loading .NET Runtime (Large Experimental!)...");
            updateCredits();
            try {
                const { getAssemblyExports /*, runMain */ } = await dotnet.create();
                dotnetRuntimeExports = {
                    compileAndRunAsync: async (csharpCode) => {
                        console.warn("Simulating C# compilation and execution in WASM.");
                        outputConsole.textContent += "--- Simulating C# Execution ---\n";
                        await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1500));
                        const fakeConsole = []; const fakeError = [];
                        if (csharpCode.includes("Console.WriteLine(\"Hello RyxIDE!\");")) fakeConsole.push("Hello RyxIDE!");
                        if (csharpCode.includes("invalid syntax")) fakeError.push("Simulated Compilation Error: Invalid syntax.");
                        if (csharpCode.includes("throw new Exception")) fakeError.push("Simulated Runtime Exception.");
                        const success = fakeError.length === 0;
                        if(!success) fakeConsole.push("Execution failed.");
                        else fakeConsole.push("Simulated execution finished.");
                        return { success, errors: fakeError, output: fakeConsole };
                    }
                };
                console.log('.NET WASM Runtime Initialized (Simulated).');
                isDotnetRuntimeReady = true;
                return true;
            } catch (error) {
                console.error('.NET WASM Runtime Load Error:', error);
                outputConsole.textContent = `Error loading .NET environment: ${error?.message || error}\nCheck console. This is highly experimental.`;
                dotnetRuntimeExports = null; isDotnetRuntimeReady = false;
                return false;
            } finally {
                isDotnetRuntimeLoading = false;
                hideLoader(loaderOverlay);
            }
        },
        runCode: () => {
            if (!editor || !currentProject || !currentOpenFileId) return;
            const file = currentProject.files.find(f => f.id === currentOpenFileId);
            if (!file) return;
            const code = editor.getValue();
            outputConsole.textContent = '';
            previewFrame.srcdoc = '';
            // file.content = code;
            // This might trigger auto-save, be careful, temporarily disabled for testing
            updateStatus(`Running ${file.language}...`, 'info', 0);
            switch (file.language) {
                case 'html': runtimeManager.runHtmlPreview(); break;
                case 'javascript': runtimeManager.runJavaScriptCode(code); break;
                case 'css': runtimeManager.runCssPreview(code); break;
                case 'python': runtimeManager.runPythonCode(code); break;
                case 'markdown': runtimeManager.runMarkdownPreview(code); break;
                case 'ruby': runtimeManager.runRubyCode(code); break;
                case 'csharp': runtimeManager.runCSharpCode(code); break;
                // Languages linking to external sandboxes (handled by updateRunButtonState)
                case 'java':
                case 'cpp':
                case 'c':
                case 'rust':
                case 'go':
                case 'php':
                     outputConsole.textContent = `Direct execution for ${file.language} is not supported here.\nUse the 'Run Externally' button to open in an online sandbox.`;
                     updateStatus(`${file.language} requires external execution.`, 'warning', 5000);
                     break;
                default:
                     outputConsole.textContent = `Preview/Run not configured for language: ${file.language}`;
                     updateStatus(`Cannot run ${file.language}.`, 'info');
                     break;
            }
            // setTimeout(() => { if(statusIndicator.textContent.startsWith('Running')) updateStatus(''); }, 1000);
            // Disabled for testing
        },
        runHtmlPreview: () => {
            const htmlFile = currentProject?.files.find(f => f.id === currentOpenFileId && f.language === 'html');
            if (!htmlFile) { outputConsole.textContent = "Current file is not HTML."; updateStatus('Preview failed', 'error'); return; }
            let htmlContent = editor.getValue() || htmlFile.content || '';
            let inlineStyles = ''; let inlineScripts = '';
            try {
                 const cssLinks = htmlContent.match(/<link.*?href=["'](.*?)["']/gi) || [];
                 const scriptSrcs = htmlContent.match(/<script.*?src=["'](.*?)["']/gi) || [];
                 cssLinks.forEach(tag => {
                     const hrefMatch = tag.match(/href=["'](.*?)["']/i);
                     const relMatch = tag.match(/rel=["']stylesheet["']/i);
                     if (hrefMatch && hrefMatch[1] && relMatch) {
                          const cssFileName = hrefMatch[1].split('/').pop();
                          const cssFile = currentProject.files.find(f => f.name === cssFileName && f.language === 'css');
                          if (cssFile) inlineStyles += `\n/* --- ${escapeHtml(cssFile.name)} --- */\n${cssFile.content || ''}\n`;
                     }
                 });
                 scriptSrcs.forEach(tag => {
                      const srcMatch = tag.match(/src=["'](.*?)["']/i);
                      if (srcMatch && srcMatch[1]) {
                          const jsFileName = srcMatch[1].split('/').pop();
                          const jsFile = currentProject.files.find(f => f.name === jsFileName && f.language === 'javascript');
                           if (jsFile) inlineScripts += `\n/* --- ${escapeHtml(jsFile.name)} --- */\n;(function(){\ntry {\n${jsFile.content || ''}\n} catch(e) { console.error('Error in ${escapeHtml(jsFile.name)}:', e); }\n})();\n`;
                      }
                 });
                 const styleTag = inlineStyles ? `<style>\n${inlineStyles}\n</style>` : '';
                 const scriptTag = inlineScripts ? `<script>\n${inlineScripts}\nconsole.log("--- Injected Scripts Finished ---");\n</script>` : '';
                 if (htmlContent.includes('</head>')) htmlContent = htmlContent.replace('</head>', `${styleTag}\n</head>`);
                 else htmlContent = styleTag + htmlContent;
                 if (htmlContent.includes('</body>')) htmlContent = htmlContent.replace('</body>', `${scriptTag}\n</body>`);
                 else htmlContent += scriptTag;
                 previewFrame.srcdoc = htmlContent;
                 outputConsole.textContent = 'HTML preview rendered. Linked CSS/JS included (basic detection). Check browser console for script errors.';
                 updateStatus('HTML Preview Ready', 'success');
            } catch (e) {
                 console.error("HTML Preview Error:", e);
                 outputConsole.textContent = `Error generating HTML preview: ${e.message}`;
                 updateStatus('Preview failed', 'error');
            }
        },
        runCssPreview: (code) => {
            const cssHtml = `<!DOCTYPE html><html><head><title>CSS Preview</title><style>${escapeHtml(code)}</style></head><body><h1>Styled Heading</h1><p>This paragraph is styled by the CSS code provided. Inspect elements to verify.</p><button class="button-like primary">Styled Button</button></body></html>`;
            previewFrame.srcdoc = cssHtml;
            outputConsole.textContent = 'CSS applied in preview pane.';
            updateStatus('CSS Preview Ready', 'success');
        },
        runJavaScriptCode: (code) => {
            outputConsole.textContent = 'Running JavaScript...\n---\n';
             try {
                 const scriptOutput = [];
                 const iframeConsole = {
                     log: (...args) => scriptOutput.push(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')),
                     error: (...args) => scriptOutput.push(`ERROR: ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')}`),
                     warn: (...args) => scriptOutput.push(`WARN: ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')}`),
                     info: (...args) => scriptOutput.push(`INFO: ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')}`),
                     clear: () => scriptOutput.length = 0
                 };
                 const fullHtml = `<!DOCTYPE html><html><head><title>JS Execution</title></head><body><script>
                    const console = {
                         log: (...args) => parent.postMessage({ type: 'ryx-log', level: 'log', args: args.map(a => String(a)) }, '*'),
                         error: (...args) => parent.postMessage({ type: 'ryx-log', level: 'error', args: args.map(a => String(a)) }, '*'),
                         warn: (...args) => parent.postMessage({ type: 'ryx-log', level: 'warn', args: args.map(a => String(a)) }, '*'),
                         info: (...args) => parent.postMessage({ type: 'ryx-log', level: 'info', args: args.map(a => String(a)) }, '*'),
                         clear: () => parent.postMessage({ type: 'ryx-log', level: 'clear' }, '*')
                    };
                    window.onerror = (message, source, lineno, colno, error) => {
                         console.error(\`Error: \${message} (at \${lineno}:\${colno})\`);
                         return true;
                    };
                    try {
                        ${code}
                        console.log('--- Script Execution Finished ---');
                    } catch (e) {
                        console.error('Runtime Error:', e.name, e.message);
                    }
                 </script></body></html>`;
                 const messageListener = (event) => {
                     if (event.source !== previewFrame.contentWindow || !event.data || event.data.type !== 'ryx-log') {
                         return;
                     }
                     const { level, args } = event.data;
                     if (level === 'clear') {
                         outputConsole.textContent = 'Console cleared by script.\n';
                     } else {
                         const prefix = level === 'error' ? 'ERROR: ' : level === 'warn' ? 'WARN: ' : level === 'info' ? 'INFO: ' : '';
                         outputConsole.textContent += prefix + args.join(' ') + '\n';
                     }
                     outputConsole.scrollTop = outputConsole.scrollHeight;
                 };
                 window.addEventListener('message', messageListener);
                 previewFrame.srcdoc = fullHtml;
                 setTimeout(() => {
                     window.removeEventListener('message', messageListener);
                     if (!outputConsole.textContent.includes('--- Script Execution Finished ---') && !outputConsole.textContent.includes('Error:')) {
                          outputConsole.textContent += '(Script might have finished without explicit logging or encountered an unhandled error)\n';
                     }
                     updateStatus('JavaScript Finished', 'success');
                 }, 5000);
             } catch (e) {
                 outputConsole.textContent += `\nJavaScript Setup Error: ${e.message}`;
                 console.error("JS Setup Error:", e);
                 updateStatus('JavaScript Error', 'error');
             }
        },
        runPythonCode: async (code) => {
            const ready = await runtimeManager.loadPyodideIfNeeded();
            if (!ready) { updateStatus('Python Runtime Failed', 'error'); return; }
            outputConsole.textContent = 'Running Python code...\n---\n';
            updateStatus('Running Python...', 'info', 0);
            showLoader(loaderOverlay, loaderText, "Running Python...");
            try {
                 pyodide.setStdout({ batched: (msg) => outputConsole.textContent += msg + '\n' });
                 pyodide.setStderr({ batched: (msg) => outputConsole.textContent += `PyError: ${msg}\n` });
                 await pyodide.runPythonAsync(code);
                 outputConsole.textContent += '\n--- Python execution finished ---';
                 updateStatus('Python Finished', 'success');
            } catch (error) {
                console.error('Python execution error:', error);
                outputConsole.textContent += `\n--- Python Error ---\n${error.message}\n(Check browser console for stack trace)`;
                updateStatus('Python Error', 'error');
            } finally {
                 pyodide.setStdout({});
                 pyodide.setStderr({});
                 hideLoader(loaderOverlay);
                 outputConsole.scrollTop = outputConsole.scrollHeight;
            }
        },
        runMarkdownPreview: (code) => {
             if (typeof marked === 'undefined') {
                 outputConsole.textContent = 'Error: Marked.js library not loaded.';
                 updateStatus('Markdown Preview Failed', 'error');
                 return;
             }
             try {
                 const html = marked.parse(code, {
                     mangle: false,
                     headerIds: false,
                     gfm: true,
                     breaks: true
                 });
                 const fullHtml = `<!DOCTYPE html><html><head><title>Markdown Preview</title><style>body{font-family: sans-serif; padding: 1.5em; color: #333; line-height: 1.6;} h1,h2,h3,h4 { border-bottom: 1px solid #eee; padding-bottom: 0.3em; margin-top: 1.5em; margin-bottom: 1em;} code:not(pre code){background-color:#f0f0f0; padding: 0.2em 0.4em; border-radius:3px;} pre{background-color:#f0f0f0; padding:1em; border-radius:4px; overflow-x: auto;} blockquote{border-left: 4px solid #ccc; margin-left: 0; padding-left: 1em; color: #666;} table{border-collapse: collapse;} th, td{border: 1px solid #ccc; padding: 0.5em;} th{background-color: #f0f0f0;} img{max-width: 100%;}</style></head><body>${html}</body></html>`;
                 previewFrame.srcdoc = fullHtml;
                 outputConsole.textContent = 'Markdown rendered to HTML in preview pane.';
                 updateStatus('Markdown Preview Ready', 'success');
             } catch (e) {
                  outputConsole.textContent = `Markdown Parsing Error: ${e.message}`;
                  console.error("Markdown Error:", e);
                  updateStatus('Markdown Preview Failed', 'error');
             }
        },
        runRubyCode: async (code) => {
            const ready = await runtimeManager.loadRubyVMIfNeeded();
            if (!ready || !rubyVM) { updateStatus('Ruby Runtime Failed', 'error'); return; }
            outputConsole.textContent = 'Running Ruby code (Experimental)...\n---\n';
            updateStatus('Running Ruby...', 'info', 0);
            showLoader(loaderOverlay, loaderText, "Running Ruby...");
            try {
                await rubyVM.evalAsync(code);
                outputConsole.textContent += '\n--- Ruby execution finished ---';
                updateStatus('Ruby Finished', 'success');
            } catch (error) {
                console.error('Ruby execution error:', error);
                outputConsole.textContent += `\n--- Ruby WASM Error ---\n${error?.message || error}\n(Check browser console)`;
                updateStatus('Ruby Error', 'error');
            } finally {
                 hideLoader(loaderOverlay);
                 outputConsole.scrollTop = outputConsole.scrollHeight;
            }
        },
        runCSharpCode: async (code) => {
            const dotnetReady = await runtimeManager.loadDotnetRuntimeIfNeeded();
            if (!dotnetReady || !dotnetRuntimeExports?.compileAndRunAsync) {
                outputConsole.textContent = outputConsole.textContent || "Failed to prepare .NET execution environment.";
                updateStatus('.NET Runtime Failed', 'error');
                return;
            }
            outputConsole.textContent = 'Compiling & Running C# via .NET WASM (Experimental PoC)...\n---\n';
            updateStatus('Running C#...', 'info', 0);
            showLoader(loaderOverlay, loaderText, "Running C#...");
            try {
                const result = await dotnetRuntimeExports.compileAndRunAsync(code);
                if (result.output?.length > 0) {
                     outputConsole.textContent += result.output.join('\n') + '\n';
                }
                if (!result.success && result.errors?.length > 0) {
                     outputConsole.textContent += '---\nErrors:\n' + result.errors.join('\n');
                     updateStatus('C# Error', 'error');
                } else if(result.success) {
                     updateStatus('C# Finished', 'success');
                } else {
                    updateStatus('C# Finished (Unknown State)', 'warning');
                }
            } catch (error) {
                console.error('C# WASM Execution Error:', error);
                outputConsole.textContent += `\n--- C# WASM Error ---\n${error?.message || error}\nCheck browser console.`;
                updateStatus('C# Error', 'error');
            } finally {
                hideLoader(loaderOverlay);
                outputConsole.scrollTop = outputConsole.scrollHeight;
            }
        }
    };
    const editorActions = {
        find: () => { if (editor) editor.getAction('actions.find').run(); },
        replace: () => { if (editor) editor.getAction('editor.action.startFindReplaceAction').run(); },
        gotoLine: () => {
            if (editor) {
                const line = parseInt(gotoLineInput.value, 10);
                if (!isNaN(line) && line > 0) {
                    try {
                        editor.revealLineInCenterIfOutsideViewport(line, monaco.editor.ScrollType.Smooth);
                        editor.setPosition({ lineNumber: line, column: 1 });
                        editor.focus();
                    } catch (e) {
                         console.error("Error going to line:", e);
                         updateStatus(`Invalid line number: ${line}`, 'error');
                    }
                } else if (gotoLineInput.value !== '') {
                     updateStatus(`Invalid line number entered.`, 'warning');
                }
                gotoLineInput.value = '';
            }
        },
        showShortcuts: () => { showModal(modalBackdrop, shortcutsModal); }
    };
    function setupEventListeners() {
        backToDashboardButton.addEventListener('click', () => {
            if (editorDirty && !confirm("You have unsaved changes. Discard changes and return to dashboard?")) return;
            setCurrentProjectId(null); window.location.href = 'index.html';
        });
        saveProjectButton.addEventListener('click', handleSaveProject);
        themeSelectorHeader.addEventListener('change', (e) => {
             currentSettings.theme = e.target.value; saveSettings(currentSettings); applySettings();
        });
        findButton.addEventListener('click', editorActions.find);
        replaceButton.addEventListener('click', editorActions.replace);
        gotoLineButton.addEventListener('click', editorActions.gotoLine);
        gotoLineInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') editorActions.gotoLine(); });
        runButton.addEventListener('click', runtimeManager.runCode);
        shortcutsButton.addEventListener('click', editorActions.showShortcuts);
        fileListUl.addEventListener('click', (e) => {
             const li = e.target.closest('li[data-file-id]');
             if (li) fileManager.open(li.dataset.fileId);
        });
         fileListUl.addEventListener('dblclick', (e) => {
             const li = e.target.closest('li[data-file-id]');
             if (li) fileManager.handleRename(li.dataset.fileId);
         });
        newFileButton.addEventListener('click', fileManager.handleNew);
        deleteFileButton.addEventListener('click', fileManager.handleDelete);
        renameFileButton.addEventListener('click', () => fileManager.handleRename());
        tabBar.addEventListener('click', handleTabSwitch);
        aiSendButton.addEventListener('click', aiChatManager.handleSendMessage);
        aiChatInput.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); aiChatManager.handleSendMessage(); } });
        aiChatSelector.addEventListener('change', (e) => aiChatManager.switchChat(e.target.value));
        aiNewChatButton.addEventListener('click', aiChatManager.handleNewChat);
        aiDeleteChatButton.addEventListener('click', aiChatManager.handleDeleteChat);
        aiChatMessages.addEventListener('click', aiChatManager.handleCodeAction);
        createFileCancelButton.addEventListener('click', () => hideModal(modalBackdrop, newFileModal));
        createFileConfirmButton.addEventListener('click', fileManager.confirmNew);
        renameFileCancelButton.addEventListener('click', () => hideModal(modalBackdrop, renameFileModal));
        renameFileConfirmButton.addEventListener('click', fileManager.confirmRename);
        aiApplyCancelButton.addEventListener('click', () => hideModal(modalBackdrop, aiApplyModal));
        aiApplyConfirmButton.addEventListener('click', aiChatManager.confirmApplyCode);
        shortcutsCloseButton?.addEventListener('click', () => hideModal(modalBackdrop, shortcutsModal));
        window.addEventListener('keydown', (e) => {
             if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                  if (!modalBackdrop.classList.contains('modal-hidden')) return;
                  e.preventDefault();
                  if (!saveProjectButton.disabled) handleSaveProject();
             }
        });
        window.addEventListener('beforeunload', (e) => {
             if (editorDirty) {
                 e.preventDefault();
                 e.returnValue = 'You have unsaved changes that will be lost if you leave the page.';
             }
        });
    }
    function updateCredits() {
        const features = new Set(['Monaco Editor', 'Gemini AI']);
        if (isPyodideReady || isPyodideLoading) features.add('Pyodide');
        if (isRubyVMReady || isRubyVMLoading) features.add('Ruby WASM (Exp.)');
        if (isDotnetRuntimeReady || isDotnetRuntimeLoading) features.add('.NET WASM (PoC)');
        if (typeof marked !== 'undefined') features.add('Marked.js');
        if (typeof JSZip !== 'undefined') features.add('JSZip');
        creditsElement.textContent = `Powered by: ${Array.from(features).join(', ')}.`;
    }
    initializeEditorPage();
});