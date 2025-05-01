const PYTHON_BACKEND_URL = "https://ryxide-python-backend.onrender.com/execute";
const TERMINAL_EXECUTE_URL = "https://ryxide-python-backend.onrender.com/terminal";
let monacoEditor = null;
let xtermInstance = null;
let xtermFitAddon = null;
let currentFile = null;
let currentProject = null;
let editorState = { isSaved: true, activeTab: 'editor' };
const aiChatHistory = new Map();
let currentChatId = null;
function updateStatus(message, type = 'success') {
    const statusIndicator = document.getElementById('status-indicator');
    if (!statusIndicator) return;
    statusIndicator.textContent = message;
    statusIndicator.className = '';
    statusIndicator.classList.add(`status-${type}`);
    setTimeout(() => {
        statusIndicator.textContent = '';
        statusIndicator.className = '';
    }, 5000);
}
const fileManager = {
    files: [],
    initialize: async () => {
        const projectId = await getCurrentProjectId();
        if (!projectId) {
            updateStatus('No project selected', 'error');
            return;
        }
        currentProject = await getProjectFromStorage(projectId);
        if (!currentProject) {
            updateStatus('Failed to load project', 'error');
            return;
        }
        fileManager.files = currentProject.files || [];
        document.getElementById('editor-project-name').textContent = currentProject.name || 'Untitled';
        fileManager.renderList();
        if (fileManager.files.length > 0) {
            fileManager.selectFile(fileManager.files[0].id);
        }
    },
    renderList: () => {
        const fileList = document.getElementById('file-list');
        if (!fileList) return;
        fileList.innerHTML = '';
        fileManager.files.forEach(file => {
            const li = createDOMElement('li', {
                className: currentFile?.id === file.id ? 'active' : '',
                dataset: { fileId: file.id },
                listeners: {
                    click: () => fileManager.selectFile(file.id)
                },
                children: [
                    createDOMElement('i', { className: `fas fa-file file-icon ${getLanguageFromFilename(file.name)}` }),
                    createDOMElement('span', { textContent: file.name })
                ]
            });
            fileList.appendChild(li);
        });
    },
    selectFile: (fileId) => {
        const file = fileManager.files.find(f => f.id === fileId);
        if (!file) return;
        currentFile = file;
        fileManager.renderList();
        if (monacoEditor) {
            const model = monacoEditor.getModel();
            if (model) {
                model.setValue(file.content || '');
                monaco.editor.setModelLanguage(model, getLanguageFromFilename(file.name));
            }
        }
        const externalLink = document.getElementById('external-sandbox-link');
        const language = getLanguageFromFilename(file.name);
        externalLink.href = externalSandboxLinks[language] || '#';
        externalLink.style.display = externalSandboxLinks[language] ? 'inline-flex' : 'none';
    },
    addFile: async (name) => {
        if (!name || fileManager.files.some(f => f.name === name)) {
            updateStatus('Invalid or duplicate file name', 'error');
            return;
        }
        const newFile = {
            id: generateUUID(),
            name,
            content: starterContentByLanguage[getLanguageFromFilename(name)] || '',
            language: getLanguageFromFilename(name)
        };
        fileManager.files.push(newFile);
        await fileManager.saveProject();
        fileManager.renderList();
        fileManager.selectFile(newFile.id);
        updateStatus('File created', 'success');
    },
    renameFile: async (fileId, newName) => {
        if (!newName || fileManager.files.some(f => f.name === newName)) {
            updateStatus('Invalid or duplicate file name', 'error');
            return;
        }
        const file = fileManager.files.find(f => f.id === fileId);
        if (!file) return;
        file.name = newName;
        file.language = getLanguageFromFilename(newName);
        await fileManager.saveProject();
        fileManager.renderList();
        fileManager.selectFile(fileId);
        updateStatus('File renamed', 'success');
    },
    deleteFile: async (fileId) => {
        const index = fileManager.files.findIndex(f => f.id === fileId);
        if (index === -1) return;
        fileManager.files.splice(index, 1);
        await fileManager.saveProject();
        fileManager.renderList();
        if (fileManager.files.length > 0) {
            fileManager.selectFile(fileManager.files[0].id);
        } else {
            currentFile = null;
            if (monacoEditor) monacoEditor.setValue('');
        }
        updateStatus('File deleted', 'success');
    },
    saveProject: async () => {
        if (!currentProject) return;
        currentProject.files = fileManager.files;
        const success = await saveProjectToStorage(currentProject);
        if (success) {
            editorState.isSaved = true;
            updateStatus('Project saved', 'success');
        } else {
            updateStatus('Failed to save project', 'error');
        }
    }
};
const terminalManager = {
    initializeTerminal: () => {
        const terminalContainer = document.getElementById('terminal-container');
        if (!terminalContainer) return;
        xtermInstance = new Terminal({ cursorBlink: true });
        xtermFitAddon = new FitAddon();
        xtermInstance.loadAddon(xtermFitAddon);
        xtermInstance.open(terminalContainer);
        xtermFitAddon.fit();
        xtermInstance.onData(data => {
            if (data === '\r') {
                terminalManager.executeCommand(xtermInstance.buffer.active.getLine(xtermInstance.buffer.active.cursorY)?.toString().trim() || '');
            } else {
                xtermInstance.write(data);
            }
        });
        terminalManager.prompt();
    },
    prompt: () => {
        xtermInstance?.writeln('\r\n$ ');
    },
    executeCommand: async (command) => {
        if (!command) {
            terminalManager.prompt();
            return;
        }
        xtermInstance?.writeln('');
        if (!TERMINAL_EXECUTE_URL) {
            xtermInstance?.writeln('\r\n\x1b[1;31mError: Terminal backend URL not configured.\x1b[0m');
            terminalManager.prompt();
            return;
        }
        try {
            const response = await fetch(TERMINAL_EXECUTE_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ command })
            });
            const result = await response.json();
            if (result.error) {
                xtermInstance?.writeln(`\r\n\x1b[1;31mError: ${result.error}\x1b[0m`);
            } else {
                xtermInstance?.writeln(result.output || '');
            }
        } catch (error) {
            xtermInstance?.writeln(`\r\n\x1b[1;31mNetwork Error: ${error.message}\x1b[0m`);
        }
        terminalManager.prompt();
    }
};
const runtimeManager = {
    runCode: async () => {
        if (!currentFile) {
            updateStatus('No file selected', 'error');
            return;
        }
        const language = getLanguageFromFilename(currentFile.name);
        const code = monacoEditor?.getValue() || currentFile.content;
        const outputConsole = document.getElementById('output-console');
        const previewFrame = document.getElementById('preview-frame');
        const outputContainer = document.getElementById('output-console-container');
        if (outputConsole && outputContainer) {
            outputConsole.textContent = '';
            outputContainer.style.display = 'block';
        }
        if (previewFrame) previewFrame.src = 'about:blank';
        if (language === 'html') {
            if (previewFrame) {
                previewFrame.srcdoc = code;
                outputContainer.style.display = 'none';
            }
        } else if (language === 'javascript') {
            try {
                const consoleOutput = [];
                const originalConsoleLog = console.log;
                console.log = (...args) => {
                    consoleOutput.push(args.join(' '));
                    originalConsoleLog.apply(console, args);
                };
                eval(code);
                console.log = originalConsoleLog;
                if (outputConsole) outputConsole.textContent = consoleOutput.join('\n');
            } catch (error) {
                if (outputConsole) outputConsole.textContent = `Error: ${error.message}`;
                updateStatus('Execution error', 'error');
            }
        } else if (language === 'python' && PYTHON_BACKEND_URL) {
            try {
                const response = await fetch(PYTHON_BACKEND_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ code })
                });
                const result = await response.json();
                if (result.error) {
                    if (outputConsole) outputConsole.textContent = result.error;
                    updateStatus('Execution error', 'error');
                } else {
                    if (outputConsole) outputConsole.textContent = result.output || '';
                    updateStatus('Code executed', 'success');
                }
            } catch (error) {
                if (outputConsole) outputConsole.textContent = `Network Error: ${error.message}`;
                updateStatus('Network error', 'error');
            }
        } else if (externalSandboxLinks[language]) {
            updateStatus('Open in external sandbox to run', 'warning');
        } else {
            updateStatus('Language not supported', 'error');
        }
    }
};
const aiChatManager = {
    initialize: () => {
        const storedChats = localStorage.getItem('aiChatHistory');
        if (storedChats) {
            aiChatHistory.set(currentChatId, JSON.parse(storedChats));
        }
        if (!currentChatId) {
            currentChatId = generateUUID();
            aiChatHistory.set(currentChatId, []);
        }
        aiChatManager.renderMessages();
    },
    renderMessages: () => {
        const messagesContainer = document.getElementById('ai-chat-messages');
        if (!messagesContainer) return;
        messagesContainer.innerHTML = '';
        const messages = aiChatHistory.get(currentChatId) || [];
        if (messages.length === 0) {
            messagesContainer.innerHTML = '<p class="empty-chat">Start a new conversation!</p>';
            return;
        }
        messages.forEach((msg, index) => {
            const messageElement = createDOMElement('div', {
                className: `ai-message role-${msg.role}`,
                children: [
                    createDOMElement('div', { className: 'ai-avatar', textContent: msg.role === 'user' ? 'U' : 'AI' }),
                    createDOMElement('div', {
                        className: 'ai-message-content',
                        innerHTML: marked.parse(msg.content, { breaks: true })
                    })
                ]
            });
            const codeBlocks = messageElement.querySelectorAll('pre code');
            codeBlocks.forEach(block => {
                const wrapper = document.createElement('div');
                wrapper.className = 'code-block-wrapper';
                const header = document.createElement('div');
                header.className = 'code-block-header';
                const lang = block.className.replace('language-', '') || 'text';
                header.textContent = lang;
                const copyButton = createDOMElement('button', {
                    className: 'code-action-button',
                    textContent: 'Copy',
                    listeners: {
                        click: () => {
                            navigator.clipboard.writeText(block.textContent);
                            updateStatus('Code copied', 'success');
                        }
                    }
                });
                const applyButton = createDOMElement('button', {
                    className: 'code-action-button',
                    textContent: 'Apply',
                    listeners: {
                        click: () => aiChatManager.showApplyCodeModal(block.textContent, lang)
                    }
                });
                header.appendChild(copyButton);
                header.appendChild(applyButton);
                wrapper.appendChild(header);
                wrapper.appendChild(block.parentElement);
                block.parentElement.parentElement.replaceChild(wrapper, block.parentElement);
            });
            messagesContainer.appendChild(messageElement);
        });
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    },
    appendMessage: (role, content) => {
        const messages = aiChatHistory.get(currentChatId) || [];
        messages.push({ role, content });
        aiChatHistory.set(currentChatId, messages);
        localStorage.setItem('aiChatHistory', JSON.stringify(messages));
        aiChatManager.renderMessages();
    },
    showApplyCodeModal: (code, language) => {
        const modalBackdrop = document.getElementById('modal-backdrop');
        const applyModal = document.getElementById('ai-apply-modal');
        const fileSelector = document.getElementById('ai-apply-file-selector');
        const codePreview = document.getElementById('ai-apply-code-preview');
        if (!fileSelector || !codePreview || !modalBackdrop || !applyModal) return;
        fileSelector.innerHTML = '';
        fileManager.files.forEach(file => {
            const option = createDOMElement('option', {
                textContent: file.name,
                dataset: { fileId: file.id }
            });
            fileSelector.appendChild(option);
        });
        codePreview.textContent = code;
        showModal(modalBackdrop, applyModal);
    },
    applyCode: async (fileId, code) => {
        const file = fileManager.files.find(f => f.id === fileId);
        if (!file) return;
        file.content = code;
        if (currentFile?.id === fileId && monacoEditor) {
            monacoEditor.setValue(code);
        }
        await fileManager.saveProject();
        updateStatus('Code applied', 'success');
    },
    clearChat: () => {
        aiChatHistory.set(currentChatId, []);
        localStorage.setItem('aiChatHistory', JSON.stringify([]));
        aiChatManager.renderMessages();
        updateStatus('Chat cleared', 'success');
    },
    newChat: () => {
        currentChatId = generateUUID();
        aiChatHistory.set(currentChatId, []);
        localStorage.setItem('aiChatHistory', JSON.stringify([]));
        aiChatManager.renderMessages();
        updateStatus('New chat started', 'success');
    },
    handleSendMessage: async () => {
        const input = document.getElementById('ai-chat-input');
        const modeSelector = document.getElementById('ai-mode-selector');
        if (!input || !modeSelector) return;
        const message = input.value.trim();
        if (!message) return;
        const mode = modeSelector.value;
        let prompt = message;
        if (mode === 'code' && currentFile) {
            prompt = `Generate code for: ${message}\nCurrent file (${currentFile.name}):\n${monacoEditor?.getValue() || currentFile.content}`;
        } else if (mode === 'debug' && currentFile) {
            prompt = `Debug this code:\n${monacoEditor?.getValue() || currentFile.content}\nIssue: ${message}`;
        } else if (mode === 'explain' && currentFile) {
            prompt = `Explain this code:\n${monacoEditor?.getValue() || currentFile.content}`;
        }
        aiChatManager.appendMessage('user', message);
        input.value = '';
        const apiKey = await getApiKey();
        const messages = aiChatHistory.get(currentChatId) || [];
        const history = messages.map(msg => ({ role: msg.role, parts: [{ text: msg.content }] }));
        const response = await callGeminiApi(prompt, apiKey, history);
        if (response.error) {
            aiChatManager.appendMessage('model', `Error: ${response.error}`);
            updateStatus('AI request failed', 'error');
        } else {
            aiChatManager.appendMessage('model', response.text);
            updateStatus('AI response received', 'success');
        }
    }
};
async function setupMonaco() {
    const editorContainer = document.getElementById('editor-container');
    if (!editorContainer) return;
    require(['vs/editor/editor.main'], () => {
        monacoEditor = monaco.editor.create(editorContainer, {
            value: '',
            language: 'plaintext',
            theme: 'vs-dark',
            automaticLayout: true,
            minimap: { enabled: true },
            wordWrap: 'on',
            fontSize: 14
        });
        monacoEditor.onDidChangeModelContent(() => {
            if (currentFile) {
                currentFile.content = monacoEditor.getValue();
                editorState.isSaved = false;
            }
        });
        const settings = getSettings();
        settings.then(s => {
            monacoEditor.updateOptions({
                theme: s.theme,
                fontSize: s.fontSize,
                tabSize: s.tabSize,
                renderWhitespace: s.renderWhitespace,
                wordWrap: s.wordWrap
            });
        });
    });
}
function handleTabSwitch(tab) {
    const tabs = document.querySelectorAll('.tab-button');
    const contents = document.querySelectorAll('.tab-content');
    tabs.forEach(t => t.classList.remove('active'));
    contents.forEach(c => c.classList.remove('active'));
    document.querySelector(`.tab-button[data-tab="${tab}"]`)?.classList.add('active');
    document.getElementById(`${tab}-tab-content`)?.classList.add('active');
    editorState.activeTab = tab;
    if (tab === 'terminal' && xtermFitAddon) {
        xtermFitAddon.fit();
    }
}
function handleAutoSave() {
    if (!editorState.isSaved && currentProject) {
        fileManager.saveProject();
    }
}
async function initializeEditorPage() {
    await setupMonaco();
    terminalManager.initializeTerminal();
    aiChatManager.initialize();
    await fileManager.initialize();
    const tabs = document.querySelectorAll('.tab-button');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => handleTabSwitch(tab.dataset.tab));
    });
    document.getElementById('save-project-button')?.addEventListener('click', fileManager.saveProject);
    document.getElementById('new-file-button')?.addEventListener('click', () => showModal(document.getElementById('modal-backdrop'), document.getElementById('new-file-modal')));
    document.getElementById('rename-file-button')?.addEventListener('click', () => {
        if (currentFile) showModal(document.getElementById('modal-backdrop'), document.getElementById('rename-file-modal'));
    });
    document.getElementById('delete-file-button')?.addEventListener('click', () => {
        if (currentFile) fileManager.deleteFile(currentFile.id);
    });
    document.getElementById('new-file-create-button')?.addEventListener('click', async () => {
        const name = document.getElementById('new-file-name')?.value.trim();
        if (name) {
            await fileManager.addFile(name);
            hideModal(document.getElementById('modal-backdrop'), document.getElementById('new-file-modal'));
        }
    });
    document.getElementById('new-file-cancel-button')?.addEventListener('click', () => hideModal(document.getElementById('modal-backdrop'), document.getElementById('new-file-modal')));
    document.getElementById('rename-file-confirm-button')?.addEventListener('click', async () => {
        const newName = document.getElementById('rename-file-name')?.value.trim();
        if (newName && currentFile) {
            await fileManager.renameFile(currentFile.id, newName);
            hideModal(document.getElementById('modal-backdrop'), document.getElementById('rename-file-modal'));
        }
    });
    document.getElementById('rename-file-cancel-button')?.addEventListener('click', () => hideModal(document.getElementById('modal-backdrop'), document.getElementById('rename-file-modal')));
    document.getElementById('ai-apply-confirm-button')?.addEventListener('click', async () => {
        const fileSelector = document.getElementById('ai-apply-file-selector');
        const codePreview = document.getElementById('ai-apply-code-preview');
        if (fileSelector && codePreview) {
            const fileId = fileSelector.selectedOptions[0]?.dataset.fileId;
            if (fileId) {
                await aiChatManager.applyCode(fileId, codePreview.textContent);
                hideModal(document.getElementById('modal-backdrop'), document.getElementById('ai-apply-modal'));
            }
        }
    });
    document.getElementById('ai-apply-cancel-button')?.addEventListener('click', () => hideModal(document.getElementById('modal-backdrop'), document.getElementById('ai-apply-modal')));
    document.getElementById('ai-send-button')?.addEventListener('click', aiChatManager.handleSendMessage);
    document.getElementById('ai-clear-chat-button')?.addEventListener('click', aiChatManager.clearChat);
    document.getElementById('ai-new-chat-button')?.addEventListener('click', aiChatManager.newChat);
    document.getElementById('run-button')?.addEventListener('click', runtimeManager.runCode);
    document.getElementById('find-button')?.addEventListener('click', () => monacoEditor?.trigger('find', 'editor.action.startFind'));
    document.getElementById('replace-button')?.addEventListener('click', () => monacoEditor?.trigger('replace', 'editor.action.startFindReplace'));
    document.getElementById('goto-line-button')?.addEventListener('click', () => {
        const line = parseInt(document.getElementById('goto-line-input')?.value);
        if (line) monacoEditor?.revealLineInCenter(line);
    });
    document.getElementById('theme-selector')?.addEventListener('change', async (e) => {
        const theme = e.target.value;
        if (monacoEditor) monacoEditor.updateOptions({ theme });
        const settings = await getSettings();
        settings.theme = theme;
        await saveSettings(settings);
    });
    const themeSelector = document.getElementById('theme-selector');
    if (themeSelector) {
        ['vs', 'vs-dark', 'hc-black'].forEach(theme => {
            const option = createDOMElement('option', { textContent: theme, value: theme });
            themeSelector.appendChild(option);
        });
        getSettings().then(s => themeSelector.value = s.theme);
    }
    document.getElementById('ai-chat-input')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            aiChatManager.handleSendMessage();
        }
    });
    setInterval(handleAutoSave, 5000);
    window.addEventListener('resize', () => {
        if (editorState.activeTab === 'terminal' && xtermFitAddon) xtermFitAddon.fit();
    });
}
document.addEventListener('DOMContentLoaded', initializeEditorPage);
