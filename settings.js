document.addEventListener('DOMContentLoaded', () => {
    const apiKeyInput = document.getElementById('gemini-api-key-input');
    const saveApiKeyButton = document.getElementById('save-api-key-button');
    const apiKeyStatus = document.getElementById('api-key-status');
    const clearAllDataButton = document.getElementById('clear-all-data-button');
    const backToDashboardButton = document.getElementById('back-to-dashboard-button');
    const themeSelector = document.getElementById('theme-selector');
    const autoSaveToggle = document.getElementById('auto-save-toggle');

    let currentSettings = {};

    async function loadSettingsDisplay() {
        try {
            currentSettings = await getSettings();
            const key = await getApiKey();
            apiKeyInput.value = key || '';
            updateApiKeyStatus(!!key);
            themeSelector.value = currentSettings.theme;
            autoSaveToggle.checked = currentSettings.autoSave;
        } catch (error) {
            console.error("Failed to load settings:", error);
            alert("Error loading settings display.");
        }
    }

    function updateApiKeyStatus(isSet) {
         if (isSet) {
             apiKeyStatus.textContent = 'API Key is saved locally.';
             apiKeyStatus.className = 'status-message status-success';
         } else {
             apiKeyStatus.textContent = 'API Key not set.';
             apiKeyStatus.className = 'status-message status-error';
         }
    }

    async function handleSaveApiKey() {
        const key = apiKeyInput.value.trim();
        let saved = false;
        let cleared = false;
        const currentKey = await getApiKey();

        if (!key) {
            if(currentKey && confirm("Are you sure you want to clear the saved API Key?")) {
                 saved = await saveApiKey('');
                 cleared = saved;
            } else if (!currentKey) {
                return;
            } else {
                 return;
            }
        } else {
            saved = await saveApiKey(key);
        }

        if (cleared) {
            apiKeyStatus.textContent = 'Saved API Key cleared.';
            apiKeyStatus.className = 'status-message status-warning';
            apiKeyInput.value = '';
        } else if (saved) {
            apiKeyStatus.textContent = 'API Key saved successfully!';
            apiKeyStatus.className = 'status-message status-success';
        } else if (!cleared) {
            apiKeyStatus.textContent = 'Failed to save API Key.';
            apiKeyStatus.className = 'status-message status-error';
        }
    }

     async function handleSaveEditorSettings() {
         currentSettings.theme = themeSelector.value;
         currentSettings.autoSave = autoSaveToggle.checked;
         const saved = await saveSettings(currentSettings);
         if (saved) {
             console.log("Editor settings saved:", currentSettings);
         }
     }

    async function handleClearAllData() {
        if (confirm("DANGER ZONE!\n\nDelete ALL RyxIDE data (projects, chats, settings, API key)?\n\nNO UNDO!")) {
            if (confirm("FINAL CONFIRMATION: Really delete everything?")) {
                 try {
                      await clearAllStores(); // Use the new common.js function
                      alert("All RyxIDE data has been cleared from this browser.");
                      await loadSettingsDisplay();
                 } catch (e) {
                      console.error("Error clearing data:", e);
                      alert("An error occurred while clearing data.");
                 }
             }
        }
    }

    function setupEventListeners() {
        saveApiKeyButton.addEventListener('click', handleSaveApiKey);
        clearAllDataButton.addEventListener('click', handleClearAllData);
        backToDashboardButton.addEventListener('click', () => { window.location.href = 'index.html'; }); // Updated link
        themeSelector.addEventListener('change', handleSaveEditorSettings);
        autoSaveToggle.addEventListener('change', handleSaveEditorSettings);
    }

    async function init() {
        await loadSettingsDisplay();
        setupEventListeners();
    }

    init().catch(err => {
         console.error("Settings Initialization failed:", err);
         alert("Failed to initialize the settings page.");
    });
});
