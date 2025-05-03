const TerminalManager = (() => {
    const NODE_BACKEND_URL = 'https://ryxide-backend-terminal.onrender.com/execute';

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

        console.log("Terminal Initialized. Node Backend Target:", NODE_BACKEND_URL);

        terminalInputElement.addEventListener('keydown', handleKeyDown);
        terminalOutputElement.addEventListener('click', () => {
            if (!isExecuting) {
                terminalInputElement.focus();
            }
        });

        displayOutput("Welcome to RyxTerminal (Experimental Multi-Backend Mode)\n");
        displayOutput("Type 'help' for commands. 'git clone'/'wget' proxied.\n");
        displayOutput("Note: Still mostly stateless via HTTP.\n");
        ensureInputFocus();
    }

    function handleKeyDown(event) {
        if (isExecuting) {
            event.preventDefault();
            return;
        }

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
        } else if (event.key === 'ArrowUp') {
             event.preventDefault();
             navigateHistory(-1);
        } else if (event.key === 'ArrowDown') {
             event.preventDefault();
             navigateHistory(1);
        } else if (event.key === 'l' && event.ctrlKey) {
             event.preventDefault();
             clearOutput();
        } else if (event.key === 'c' && event.ctrlKey) {
             console.log("Terminal Ctrl+C pressed (cannot interrupt backend via HTTP)");
        }
    }

     function navigateHistory(direction) {
         if (commandHistory.length === 0) return;
         const newIndex = historyIndex + direction;

         if (newIndex >= -1 && newIndex < commandHistory.length) {
              historyIndex = newIndex;
              if (historyIndex === -1) {
                   terminalInputElement.value = '';
              } else {
                   terminalInputElement.value = commandHistory[historyIndex];
              }
               terminalInputElement.selectionStart = terminalInputElement.selectionEnd = terminalInputElement.value.length;
         }
     }

     function addToHistory(command) {
          if (!command || (commandHistory.length > 0 && commandHistory[commandHistory.length - 1] === command)) {
                return;
          }
          commandHistory.push(command);
          if (commandHistory.length > 50) {
               commandHistory.shift();
          }
     }

    function logBackendMessages(responseHeaders) {
        console.groupCollapsed("[Backend Logs]");
        let foundLogs = false;
        responseHeaders.forEach((value, name) => {
            if (name.toLowerCase().startsWith('x-log-proxy-') || name.toLowerCase().startsWith('x-log-python-')) {
                const prefix = name.toLowerCase().startsWith('x-log-python-') ? "🐍 Python:" : "⦿ Node:";
                console.log(`${prefix} ${value}`);
                foundLogs = true;
            }
        });
        if (!foundLogs) {
            console.log("No specific log headers found.");
        }
        console.groupEnd();
    }

    async function processCommand(command) {
        if (command.toLowerCase() === 'clear') {
            clearOutput();
            return;
        }
        if (command.toLowerCase() === 'help') {
             displayHelp();
             return;
        }

        isExecuting = true;
        setPromptBusy(true);
        terminalInputElement.disabled = true;

        try {
            const response = await fetch(NODE_BACKEND_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ command: command })
            });

            logBackendMessages(response.headers);

            const contentType = response.headers.get("content-type");

            if (!response.ok) {
                 let errorData;
                 let errorText = `Error: ${response.status} ${response.statusText}\n`;
                 try {
                      errorData = await response.json();
                      if (errorData.error) errorText += `Backend Error: ${errorData.error}\n`;
                      if (errorData.details) errorText += `Details: ${errorData.details}\n`;
                      if (errorData.stderr) displayErrorOutput(`Stderr: ${errorData.stderr}\n`);
                      if (errorData.stdout) displayOutput(`Stdout: ${errorData.stdout}\n`);
                 } catch (e) {
                      const textError = await response.text();
                      errorText += `Response Body: ${textError}\n`;
                 }
                 console.error("Node Backend Request Failed:", response.status, errorText);
                 displayErrorOutput(errorText);

            } else if (contentType && contentType.includes("application/zip")) {
                 displayOutput("Received file archive. Unpacking...\n");
                 const zipBlob = await response.blob();
                 await handleZipResponse(zipBlob);

            } else if (contentType && contentType.includes("application/json")) {
                 const result = await response.json();
                  if (result.stdout) {
                      displayOutput(result.stdout);
                      if (!result.stdout.endsWith('\n')) displayOutput('\n');
                  }
                  if (result.stderr) {
                      displayErrorOutput(result.stderr);
                      if (!result.stderr.endsWith('\n')) displayOutput('\n');
                  }
                  if (result.error){
                        displayErrorOutput(`Error Field: ${result.error}\n`);
                  }
                   if (!result.stdout && !result.stderr && !result.error) {
                   }

            } else {
                 const textResponse = await response.text();
                 console.warn("Received unexpected successful response type:", contentType, textResponse);
                 displayErrorOutput(`Warn: Unexpected response type from backend (${contentType || 'unknown'}).\n`);
                 displayOutput(textResponse + '\n');
            }

        } catch (error) {
            console.error("Terminal fetch network error:", error);
            displayErrorOutput(`Network Error: Failed to connect to Node backend.\nCheck browser console & backend status.\n${error.message}\n`);
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
               console.error("JSZip not found. Make sure it's included in editor.html.");
               return;
          }
          const fileManager = window.fileManager;
          const saveProject = window.saveProjectToStorage;
          const getCurrentProj = () => window.currentProject;
          const genId = window.generateUUID;
          const getLang = window.getLanguageFromFilename;
          const updateStat = window.updateStatus;

          if (!fileManager || !saveProject || !getCurrentProj || !genId || !getLang || !updateStat) {
               displayErrorOutput("Error: Cannot access required IDE functions (fileManager, saveProjectToStorage, etc.).\n");
               console.error("Missing required IDE functions. Ensure they are exposed globally (e.g., window.fileManager = ...).");
               return;
          }
           let project = getCurrentProj();
           if(!project || !project.files) {
                displayErrorOutput("Error: Cannot access current project file list.\n");
                console.error("Current project or project.files is missing.");
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
                         displayErrorOutput("Error saving updated project to IndexedDB.\n");
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
          displayOutput("RyxIDE Terminal Help (HTTP Proxy Mode):\n\n");
          displayOutput("  Client-Side:\n");
          displayOutput("    clear       Clear the terminal screen (or Ctrl+L)\n");
          displayOutput("    help        Show this help message\n\n");
          displayOutput("  Proxied Commands (Downloads files into IDE):\n");
          displayOutput("    git clone <url> [dir]  Clones repo into IDE files\n");
          displayOutput("    wget <url>             Downloads file into IDE files\n");
          displayOutput("  Other Commands (Executed remotely, output shown):\n");
          displayOutput("    ls, pwd, mkdir, touch, cp, mv, rm, cat, echo, curl, ping, git status/pull/push/..., node, npm, python, etc.\n\n");
          displayOutput("  Keyboard Shortcuts:\n");
          displayOutput("    Enter       Execute command\n");
          displayOutput("    ArrowUp     Previous command in history\n");
          displayOutput("    ArrowDown   Next command in history\n");
          displayOutput("    Ctrl+L      Clear screen\n\n");
          displayOutput("  LIMITATIONS:\n");
          displayOutput("  * Mostly Stateless: 'cd', 'export' don't persist.\n");
          displayOutput("  * No Interactivity: 'vim', 'python' REPL, etc. won't work.\n");
          displayOutput("  * No Streaming Output: Output appears after command finishes.\n");
          displayOutput("  * Timeouts Apply: Long commands/downloads might fail.\n");
          scrollToBottom();
     }

    function getPromptText() {
         return isExecuting ? '$ ' : '> ';
    }

    function setPromptBusy(busy) {
         if (!terminalPromptElement) return;
         terminalPromptElement.textContent = getPromptText();
         terminalPromptElement.style.color = busy ? 'var(--text-warning)' : 'var(--text-success)';
    }

    function displayCommand(command) {
        if (!terminalOutputElement) return;
        const promptText = '> ';
        if (typeof escapeHtml !== 'function') {
             console.error("escapeHtml function not found!");
             terminalOutputElement.appendChild(document.createTextNode(`${promptText}${command}\n`));
        } else {
            displayOutput(`${promptText}${escapeHtml(command)}\n`);
        }
    }

    function displayOutput(text) {
        if (!terminalOutputElement || text === null || typeof text === 'undefined') return;
        terminalOutputElement.appendChild(document.createTextNode(String(text)));
        scrollToBottom();
    }

    function displayErrorOutput(text) {
        if (!terminalOutputElement || text === null || typeof text === 'undefined') return;
        const errorSpan = document.createElement('span');
        errorSpan.style.color = 'var(--text-danger)';
        errorSpan.appendChild(document.createTextNode(String(text)));
        terminalOutputElement.appendChild(errorSpan);
        scrollToBottom();
    }

     function clearOutput() {
          if (terminalOutputElement) {
               terminalOutputElement.innerHTML = '';
          }
           displayOutput(getPromptText());
     }

    function scrollToBottom() {
        if (terminalOutputElement) {
            requestAnimationFrame(() => {
                terminalOutputElement.scrollTop = terminalOutputElement.scrollHeight;
            });
        }
    }

     function ensureInputFocus() {
         setTimeout(() => {
              if (terminalInputElement && !terminalInputElement.disabled) {
                   terminalInputElement.focus();
              }
         }, 0);
     }

    return {
        initialize: initialize
    };
})();

console.log("terminal.js (multi-backend proxy mode) parsed.");
