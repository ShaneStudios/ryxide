const TerminalManager = (() => {
    let terminalOutputElement = null;
    let terminalInputElement = null;
    let terminalPromptElement = null;
    let commandHistory = [];
    let historyIndex = -1;

    function initialize(outputEl, inputEl, promptEl) {
        terminalOutputElement = outputEl;
        terminalInputElement = inputEl;
        terminalPromptElement = promptEl;

        if (!terminalOutputElement || !terminalInputElement || !terminalPromptElement) {
            console.error("Terminal elements not found during initialization.");
            return;
        }

        terminalInputElement.addEventListener('keydown', handleKeyDown);
        terminalOutputElement.addEventListener('click', () => terminalInputElement.focus());

        displayOutput("Welcome to RyxTerminal (Experimental)\n");
        terminalInputElement.focus();
    }

    function handleKeyDown(event) {
        if (event.key === 'Enter') {
            event.preventDefault();
            const command = terminalInputElement.value.trim();
            terminalInputElement.value = '';

            if (command) {
                displayCommand(command);
                addToHistory(command);
                processCommand(command);
            } else {
                 displayOutput(getPromptText() + "\n");
            }
             scrollToBottom();
             historyIndex = -1;
        } else if (event.key === 'ArrowUp') {
             event.preventDefault();
             navigateHistory(-1);
        } else if (event.key === 'ArrowDown') {
             event.preventDefault();
             navigateHistory(1);
        } else if (event.key === 'l' && event.ctrlKey) {
             event.preventDefault();
             clearOutput();
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

    function processCommand(command) {
        if (command.toLowerCase() === 'help') {
            displayOutput("Available commands (simulated):\n");
            displayOutput("  help   - Show this help message\n");
            displayOutput("  clear  - Clear the terminal screen (or Ctrl+L)\n");
            displayOutput("  echo   - Print text to the terminal\n");
            displayOutput("  date   - Show the current date and time\n");
            displayOutput("  pwd    - Print working directory (simulated)\n");
            displayOutput("  ls     - List directory contents (simulated)\n");
            displayOutput("  whoami - Display current user (simulated)\n");
        } else if (command.toLowerCase() === 'clear') {
            clearOutput();
        } else if (command.toLowerCase().startsWith('echo ')) {
            displayOutput(command.substring(5) + "\n");
        } else if (command.toLowerCase() === 'date') {
            displayOutput(new Date().toString() + "\n");
        } else if (command.toLowerCase() === 'pwd') {
            displayOutput("/home/user/ryxide_project\n");
        } else if (command.toLowerCase() === 'ls') {
            displayOutput("index.html  style.css  script.js  README.md\n");
        } else if (command.toLowerCase() === 'whoami') {
            displayOutput("ryx_user\n");
        } else {
            displayOutput(`Command not found: ${escapeHtml(command)}\n`);
        }
    }

    function getPromptText() {
         return terminalPromptElement ? terminalPromptElement.textContent : '> ';
    }

    function displayCommand(command) {
        if (!terminalOutputElement) return;
        const promptText = getPromptText();
        displayOutput(`${promptText}${escapeHtml(command)}\n`);
    }

    function displayOutput(text) {
        if (!terminalOutputElement) return;
        terminalOutputElement.appendChild(document.createTextNode(text));
        scrollToBottom();
    }

     function clearOutput() {
          if (terminalOutputElement) {
               terminalOutputElement.innerHTML = '';
               displayOutput("RyxTerminal Cleared.\n");
          }
     }

    function scrollToBottom() {
        if (terminalOutputElement) {
            terminalOutputElement.scrollTop = terminalOutputElement.scrollHeight;
        }
    }

    return {
        initialize: initialize
    };
})();
