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
             console.log("Terminal Ctrl+C pressed (no backend interrupt via HTTP)");
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

            const result = await response.json();

            if (response.ok) {
                if (result.stdout) {
                    displayOutput(result.stdout);
                }
                if (result.stderr) {
                    displayErrorOutput(result.stderr);
                }
                 if (result.stdout && !result.stdout.endsWith('\n') && !result.stderr) {
                      displayOutput('\n');
                 } else if (result.stderr && !result.stderr.endsWith('\n')) {
                      displayOutput('\n');
                 }

            } else {
                let errorMessage = `Error: ${response.status} ${response.statusText}`;
                if (result && result.error) {
                    errorMessage += `\nBackend: ${result.error}`;
                }
                 if (result && result.stdout) {
                      displayOutput("Partial Output (stdout):\n" + result.stdout);
                 }
                 if (result && result.stderr) {
                      displayErrorOutput("Partial Output (stderr):\n" + result.stderr);
                 }
                displayErrorOutput(errorMessage + "\n");
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
         return terminalPromptElement ? terminalPromptElement.textContent : '> ';
    }

    function setPromptBusy(busy) {
         if (!terminalPromptElement) return;
         if (busy) {
              terminalPromptElement.style.color = 'var(--text-warning)';
              terminalPromptElement.textContent = '$ ';
         } else {
              terminalPromptElement.style.color = 'var(--text-success)';
              terminalPromptElement.textContent = '> ';
         }
    }

    function displayCommand(command) {
        if (!terminalOutputElement) return;
        const promptText = getPromptText();
        displayOutput(`${promptText}${escapeHtml(command)}\n`);
    }

    function displayOutput(text) {
        if (!terminalOutputElement) return;
        terminalOutputElement.appendChild(document.createTextNode(text));
    }

    function displayErrorOutput(text) {
        if (!terminalOutputElement) return;
        const errorSpan = document.createElement('span');
        errorSpan.style.color = 'var(--text-danger)';
        errorSpan.appendChild(document.createTextNode(text));
        terminalOutputElement.appendChild(errorSpan);
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

function escapeHtml(unsafe) {
  if (typeof unsafe !== 'string') return '';
  return unsafe
      .replace(/&/g, "&")
      .replace(/</g, "<")
      .replace(/>/g, ">")
      .replace(/"/g, """)
      .replace(/'/g, "'");
}
