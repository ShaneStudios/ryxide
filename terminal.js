const TerminalManager = (() => {
    const BACKEND_URL = 'https://ryxide-backend-terminal.onrender.com/execute';

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

        terminalInputElement.addEventListener('keydown', handleKeyDown);
        terminalOutputElement.addEventListener('click', () => {
            if (!isExecuting) {
                terminalInputElement.focus();
            }
        });

        displayOutput("Welcome to RyxTerminal (Connected to Backend)\n");
        displayOutput("Type 'help' for common Linux commands.\n");
        displayOutput("Note: This is a stateless terminal via HTTP.\n");
        displayOutput("Commands like 'cd' won't persist. Long tasks might time out.\n");
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
            const response = await fetch(BACKEND_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ command: command })
            });

            const responseText = await response.text();
            let result = {};

            if (!response.ok) {
                 console.error(`Backend Error (Status: ${response.status}):`, responseText);
                 let errorMsg = `Error: ${response.status} ${response.statusText}\n`;
                 try {
                      result = JSON.parse(responseText);
                      if(result.error) errorMsg += `Backend: ${result.error}\n`;
                      if(result.stderr) displayErrorOutput(`Stderr: ${result.stderr}\n`);
                      if(result.stdout) displayOutput(`Stdout: ${result.stdout}\n`);
                 } catch(e) {
                      errorMsg += `Backend Response: ${responseText}\n`;
                 }
                 displayErrorOutput(errorMsg);

            } else {
                 try {
                      result = JSON.parse(responseText);
                      if (result.stdout) {
                           displayOutput(result.stdout);
                           if (!result.stdout.endsWith('\n')) {
                                displayOutput('\n');
                           }
                      }
                      if (result.stderr) {
                           displayErrorOutput(result.stderr);
                            if (!result.stderr.endsWith('\n')) {
                                displayOutput('\n');
                           }
                      }
                      if (!result.stdout && !result.stderr) {
                           displayOutput('\n');
                      }

                 } catch (jsonError) {
                      console.error("Failed to parse JSON response despite OK status:", responseText);
                      displayErrorOutput(`Error: Received non-JSON response from backend (Status: ${response.status})\n`);
                      displayErrorOutput(responseText + "\n");
                 }
            }

        } catch (error) {
            console.error("Terminal fetch error:", error);
            displayErrorOutput(`Network Error: Failed to connect to backend.\n${error.message}\n`);
        } finally {
            isExecuting = false;
            setPromptBusy(false);
            terminalInputElement.disabled = false;
            scrollToBottom();
            ensureInputFocus();
        }
    }

     function displayHelp() {
         displayOutput("RyxIDE Terminal Help (HTTP Backend Mode):\n");
         displayOutput("  This terminal sends commands to a remote server for execution.\n");
         displayOutput("  Standard Linux/Bash commands should work (e.g., ls, pwd, echo, cat, grep, mkdir, rm, touch, wget, curl, git, node, python, etc.).\n\n");
         displayOutput("  Client-side Commands:\n");
         displayOutput("    clear     - Clear the terminal screen (or Ctrl+L)\n");
         displayOutput("    help      - Show this help message\n\n");
         displayOutput("  Keyboard Shortcuts:\n");
         displayOutput("    Enter     - Execute command\n");
         displayOutput("    ArrowUp   - Previous command in history\n");
         displayOutput("    ArrowDown - Next command in history\n");
         displayOutput("    Ctrl+L    - Clear screen\n\n");
         displayOutput("  Limitations:\n");
         displayOutput("  * No persistent state: 'cd' has no lasting effect.\n");
         displayOutput("  * No interactive commands (like 'python' REPL or 'ssh').\n");
         displayOutput("  * No real-time output streaming.\n");
         displayOutput("  * Commands may time out (server limits).\n");
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
        displayOutput(`${promptText}${escapeHtml(command)}\n`);
    }

    function displayOutput(text) {
        if (!terminalOutputElement || !text) return;
        terminalOutputElement.appendChild(document.createTextNode(String(text)));
        scrollToBottom();
    }

    function displayErrorOutput(text) {
        if (!terminalOutputElement || !text) return;
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

console.log("terminal.js parsed and TerminalManager should be defined now.");
