const TerminalManager = (() => {
    const NODE_EXEC_URL = 'https://ryxide-backend-terminal.onrender.com/execute';
    const PYTHON_FETCH_URL = 'https://ryxide-backend-terminal-fetch.onrender.com/fetch-and-zip';

    let terminalOutputElement = null;
    let terminalInputElement = null;
    let terminalPromptElement = null;
    let commandHistory = [];
    let historyIndex = -1;
    let isExecuting = false;

    function initialize(outputEl, inputEl, promptEl) {
        terminalOutputElement = outputEl;
        terminalInputElement = inputEl;
        terminalPromptElement = promptEl;

        if (!terminalOutputElement || !terminalInputElement || !terminalPromptElement) {
            console.error("Terminal elements not found during initialization.");
            return;
        }

        console.log("Terminal Initializing...");
        console.log("Node Executor Target:", NODE_EXEC_URL);
        console.log("Python Fetcher Target:", PYTHON_FETCH_URL);

         if (NODE_EXEC_URL.includes('YOUR_') || PYTHON_FETCH_URL.includes('YOUR_')) {
             console.error("FATAL: Backend URLs are not configured in terminal.js!");
             displayErrorOutput("FATAL ERROR: Terminal backend URLs are not configured.\n");
         }

        if (typeof JSZip === 'undefined') {
            console.error("Terminal Initialize ERROR: JSZip library is NOT loaded or defined at this point!");
            displayErrorOutput("ERROR: Required ZIP library failed to load. File fetching commands will fail.\n");
        } else {
            console.log("Terminal Initialize: JSZip library found successfully.");
        }

        terminalInputElement.addEventListener('keydown', handleKeyDown);
        terminalOutputElement.addEventListener('click', () => {
            if (!isExecuting) {
                terminalInputElement.focus();
            }
        });

        displayOutput("Welcome to RyxTerminal (Dual Backend Mode)\n");
        displayOutput("Type 'help' for commands. Downloads (`git clone`, `wget`) handled by Python backend.\n");
        ensureInputFocus();
    }

    function handleKeyDown(event) {
        if (isExecuting) { event.preventDefault(); return; }

        if (event.key === 'Enter') {
            event.preventDefault();
            const command = terminalInputElement.value.trim();
            terminalInputElement.value = '';
            historyIndex = -1;
            if (command) {
                displayCommand(command);
                addToHistory(command);
                processCommand(command);
            } else {
                displayOutput(getPromptText() + "\n");
                scrollToBottom();
            }
        } else if (event.key === 'ArrowUp') { event.preventDefault(); navigateHistory(-1); }
        else if (event.key === 'ArrowDown') { event.preventDefault(); navigateHistory(1); }
        else if (event.key === 'l' && event.ctrlKey) { event.preventDefault(); clearOutput(); displayOutput(getPromptText()); }
        else if (event.key === 'c' && event.ctrlKey) { console.log("Terminal Ctrl+C pressed (no effect on backend)"); }
    }

     function navigateHistory(direction) {
         if (commandHistory.length === 0) return;
         const newIndex = historyIndex + direction;
         if (newIndex >= -1 && newIndex < commandHistory.length) {
              historyIndex = newIndex;
              terminalInputElement.value = (historyIndex === -1) ? '' : commandHistory[historyIndex];
              terminalInputElement.selectionStart = terminalInputElement.selectionEnd = terminalInputElement.value.length;
         }
     }

     function addToHistory(command) {
          if (!command || (commandHistory.length > 0 && commandHistory[commandHistory.length - 1] === command)) return;
          commandHistory.push(command);
          if (commandHistory.length > 50) commandHistory.shift();
     }

    function logBackendMessages(responseHeaders, backendType = "Node") {
        console.groupCollapsed(`[${backendType} Backend Logs]`);
        let foundLogs = false;
        responseHeaders.forEach((value, name) => {
            const lowerName = name.toLowerCase();
            if (lowerName.startsWith('x-log-proxy-') || lowerName.startsWith('x-log-python-')) {
                const prefix = lowerName.startsWith('x-log-python-') ? "🐍 Python:" : "⦿ Node:";
                console.log(`${prefix} ${value}`);
                foundLogs = true;
            }
        });
        if (!foundLogs) console.log("No specific log headers found.");
        console.groupEnd();
    }

    function parseDownloadCommand(command) {
        command = command.trim();
        let match;
        const gitRegex = /^git\s+clone(?:\s+--depth(?:=|\s+)\d+)?\s+(['"]?)(.+?)\1(?:\s+(['"]?)(.*?)\3)?$/;
        match = command.match(gitRegex);
        if (match) {
            console.log("Frontend detected git clone command");
            return { type: 'git', url: match[2], targetDir: match[4] };
        }
        const wgetRegexSimple = /^wget\s+(['"]?)([^ ]+?)\1$/;
        const wgetRegexP = /^wget\s+(?:.+?\s+)?-P\s+(['"]?)(.+?)\1\s+(?:.+?\s+)?(['"]?)(.+?)\3(?:\s+.*)?$/;
        const wgetRegexUrlP = /^wget\s+(?:.+?\s+)?(['"]?)(.+?)\1\s+(?:.+?\s+)?-P\s+(['"]?)(.+?)\3(?:\s+.*)?$/;
        match = command.match(wgetRegexP);
        if (match) {
            console.log("Frontend detected wget -P <dir> <url> command");
            return { type: 'wget', url: match[4], targetDir: match[2] };
        }
         match = command.match(wgetRegexUrlP);
        if (match) {
            console.log("Frontend detected wget <url> -P <dir> command");
            return { type: 'wget', url: match[2], targetDir: match[4] };
        }
         match = command.match(wgetRegexSimple);
        if (match) {
             console.log("Frontend detected simple wget <url> command");
            return { type: 'wget', url: match[2], targetDir: null };
        }
        return null;
    }

    async function processCommand(command) {
        if (command.toLowerCase() === 'clear') { clearOutput(); displayOutput(getPromptText()); return; }
        if (command.toLowerCase() === 'help') { displayHelp(); displayOutput(getPromptText()); return; }
         if (NODE_EXEC_URL.includes('YOUR_') || PYTHON_FETCH_URL.includes('YOUR_')) {
              displayErrorOutput("FATAL ERROR: Terminal backend URLs are not configured.\n");
              isExecuting = false; setPromptBusy(false); terminalInputElement.disabled = false; displayOutput(getPromptText()); ensureInputFocus();
              return;
         }

        isExecuting = true;
        setPromptBusy(true);
        terminalInputElement.disabled = true;

        const downloadInfo = parseDownloadCommand(command);
        let targetUrl = '';
        let options = {};
        let isDownload = false;
        let backendName = "Node";

        if (downloadInfo) {
            isDownload = true;
            backendName = "Python";
            targetUrl = PYTHON_FETCH_URL;
            options = {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(downloadInfo),
            };
            displayOutput(`Sending fetch request to Python backend for ${downloadInfo.type}...\n`);

        } else {
            isDownload = false;
            backendName = "Node";
            targetUrl = NODE_EXEC_URL;
            options = {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ command: command }),
            };
             displayOutput(`Sending command to Node backend...\n`);
        }

        try {
            const response = await fetch(targetUrl, options);
            logBackendMessages(response.headers, backendName);
            const contentType = response.headers.get("content-type");

            if (!response.ok) {
                const errorBodyText = await response.text();
                let errorDetail = "";
                try {
                    const errorJson = JSON.parse(errorBodyText);
                    errorDetail += `Backend Error: ${errorJson.error || 'Unknown JSON error'}\n`;
                    if (errorJson.details) errorDetail += `Details: ${errorJson.details}\n`;
                    if (errorJson.stderr) displayErrorOutput(`Stderr: ${errorJson.stderr}\n`);
                    if (errorJson.stdout) displayOutput(`Stdout: ${errorJson.stdout}\n`);
                } catch (e) { if (errorBodyText) { errorDetail += `Response Body: ${errorBodyText}\n`; } }
                console.error(`${backendName} Backend Request Failed (${response.status}):`, errorDetail || errorBodyText);
                displayErrorOutput(`Error: ${response.status} ${response.statusText}\n`);
                displayErrorOutput(errorDetail);

            } else if (isDownload && contentType && contentType.includes("application/zip")) {
                 displayOutput("Received file archive. Unpacking...\n");
                 const zipBlob = await response.blob();
                 await handleZipResponse(zipBlob);

            } else if (!isDownload && contentType && contentType.includes("application/json")) {
                 const result = await response.json();
                  if (result.stdout) displayOutput(result.stdout);
                  if (result.stderr) displayErrorOutput(result.stderr);
                  if (result.error) displayErrorOutput(`Error Field: ${result.error}\n`);
                  if ( (result.stdout && !result.stdout.endsWith('\n')) || (result.stderr && !result.stderr.endsWith('\n')) ) {
                      displayOutput('\n');
                  }

            } else {
                 const textResponse = await response.text();
                 console.warn(`Received unexpected successful response type from ${backendName} backend:`, contentType, textResponse);
                 displayErrorOutput(`Warn: Unexpected response type from ${backendName} (${contentType || 'unknown'}).\n`);
                 displayOutput(textResponse);
                  if (!textResponse.endsWith('\n')) displayOutput('\n');
            }

        } catch (error) {
            console.error(`Terminal fetch network error to ${backendName} backend:`, error);
            displayErrorOutput(`Network Error: Failed to connect to ${backendName} backend.\nCheck browser console & backend status.\n${error.message}\n`);
        } finally {
            isExecuting = false;
            setPromptBusy(false);
            terminalInputElement.disabled = false;
            if (terminalOutputElement.lastChild && terminalOutputElement.lastChild.textContent && !terminalOutputElement.lastChild.textContent.endsWith('\n')) {
                 displayOutput('\n');
            }
            displayOutput(getPromptText());
            scrollToBottom();
            ensureInputFocus();
        }
    }

     async function handleZipResponse(zipBlob) {
          if (typeof JSZip === 'undefined') {
               displayErrorOutput("Error: JSZip library not loaded. Cannot unpack files.\n");
               console.error("handleZipResponse ERROR: JSZip is not defined. Ensure it's loaded *before* terminal.js.");
               return;
          }
          const fileManager = window.fileManager;
          const saveProject = window.saveProjectToStorage;
          const getCurrentProj = () => window.currentProject;
          const genId = window.generateUUID;
          const getLang = window.getLanguageFromFilename;
          const updateStat = window.updateStatus;

          if (!fileManager || !saveProject || !getCurrentProj || !genId || !getLang || !updateStat) {
               displayErrorOutput("Error: Required IDE functions missing.\n");
               console.error("handleZipResponse ERROR: Missing required IDE functions (fileManager, etc.). Ensure they are exposed globally.");
               return;
          }
           let project = getCurrentProj();
           if(!project || !project.files) {
                displayErrorOutput("Error: Cannot access project files.\n");
                console.error("handleZipResponse ERROR: Current project or project.files is missing.");
                return;
           }

          try {
               displayOutput("Loading zip data...\n");
               const zip = await JSZip.loadAsync(zipBlob);
               let fileCount = 0;
               const addedFiles = [];
               let updatedProject = { ...project, files: [...project.files] };
               displayOutput("Unpacking files...\n");

               const filePromises = Object.keys(zip.files).map(async (relativePath) => {
                    const zipEntry = zip.files[relativePath];
                    if (!zipEntry.dir) {
                         try {
                              const fileContent = await zipEntry.async("string");
                              const fileName = relativePath;
                              const lang = getLang(fileName);
                              const existingFileIndex = updatedProject.files.findIndex(f => f.name === fileName);
                              const newFile = {
                                   id: existingFileIndex > -1 ? updatedProject.files[existingFileIndex].id : genId(),
                                   name: fileName,
                                   language: lang,
                                   content: fileContent
                              };
                              if (existingFileIndex > -1) {
                                   updatedProject.files[existingFileIndex] = newFile;
                              } else {
                                   updatedProject.files.push(newFile);
                              }
                              addedFiles.push(fileName);
                              fileCount++;
                         } catch (readError) {
                              console.error(`Error reading file ${relativePath} from zip:`, readError);
                              displayErrorOutput(`Error unpacking file: ${relativePath}\n`);
                         }
                    }
               });

               await Promise.all(filePromises);

               if (fileCount > 0) {
                    displayOutput(`Successfully unpacked and added/updated ${fileCount} file(s):\n`);
                    addedFiles.forEach(f => displayOutput(`  - ${f}\n`));
                    window.currentProject = updatedProject;
                    fileManager.renderList();
                    displayOutput("Saving updated project...\n");
                    const saved = await saveProject(updatedProject);
                    if(saved) {
                         updateStat(`${fileCount} file(s) added/updated & saved.`, 'success');
                         displayOutput("Project saved successfully.\n");
                    } else {
                         updateStat(`${fileCount} file(s) added/updated, but save failed!`, 'error');
                         displayErrorOutput("Error saving updated project.\n");
                    }
               } else {
                    displayOutput("Archive unpacked, but contained no files.\n");
               }

          } catch (error) {
               console.error("Error processing ZIP file:", error);
               displayErrorOutput(`Error unpacking archive: ${error.message}\n`);
          }
     }

     function displayHelp() {
          displayOutput("RyxIDE Terminal Help (Dual Backend Mode):\n\n");
          displayOutput("  Client-Side:\n");
          displayOutput("    clear       Clear the terminal screen (or Ctrl+L)\n");
          displayOutput("    help        Show this help message\n\n");
          displayOutput("  Download Commands (Uses Python Backend -> Adds to IDE):\n");
          displayOutput("    git clone <url> [dir]  Clones repo\n");
          displayOutput("    wget <url>             Downloads file\n");
          displayOutput("  Other Commands (Uses Node.js Backend -> Shows Output):\n");
          displayOutput("    ls, pwd, echo, cat, node, npm, python, git status/pull/..., etc.\n\n");
          displayOutput("  Keyboard Shortcuts:\n");
          displayOutput("    Enter, ArrowUp/Down, Ctrl+L\n\n");
          displayOutput("  LIMITATIONS:\n");
          displayOutput("  * Node commands are stateless ('cd' doesn't persist).\n");
          displayOutput("  * No interactive commands (vim, python REPL, etc.).\n");
          displayOutput("  * No streaming output.\n");
          displayOutput("  * Timeouts apply to all backend operations.\n");
     }

    function getPromptText() { return isExecuting ? '$ ' : '> '; }
    function setPromptBusy(busy) { if (terminalPromptElement) { terminalPromptElement.textContent = getPromptText(); terminalPromptElement.style.color = busy ? 'var(--text-warning)' : 'var(--text-success)'; } }
    function displayCommand(command) { if (!terminalOutputElement) return; displayOutput(`${'> '}${typeof escapeHtml === 'function' ? escapeHtml(command) : command}\n`); }
    function displayOutput(text) { if (!terminalOutputElement || text === null || typeof text === 'undefined') return; terminalOutputElement.appendChild(document.createTextNode(String(text))); scrollToBottom(); }
    function displayErrorOutput(text) { if (!terminalOutputElement || text === null || typeof text === 'undefined') return; const span = document.createElement('span'); span.style.color = 'var(--text-danger)'; span.appendChild(document.createTextNode(String(text))); terminalOutputElement.appendChild(span); scrollToBottom(); }
    function clearOutput() { if (terminalOutputElement) terminalOutputElement.innerHTML = ''; }
    function scrollToBottom() { if (terminalOutputElement) requestAnimationFrame(() => { terminalOutputElement.scrollTop = terminalOutputElement.scrollHeight; }); }
    function ensureInputFocus() { setTimeout(() => { if (terminalInputElement && !terminalInputElement.disabled) terminalInputElement.focus(); }, 0); }

    return { initialize: initialize };
})();

console.log("terminal.js (dual-backend direct mode) parsed.");
