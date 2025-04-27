document.addEventListener('DOMContentLoaded', () => {
    const apiKeyInput = document.getElementById('gemini-api-key-input');
    const saveApiKeyButton = document.getElementById('save-api-key-button');
    const apiKeyStatus = document.getElementById('api-key-status');
    const clearAllDataButton = document.getElementById('clear-all-data-button');
    const backToDashboardButton = document.getElementById('back-to-dashboard-button');
    const themeSelector = document.getElementById('theme-selector');
    const autoSaveToggle = document.getElementById('auto-save-toggle');
    let currentSettings = getSettings();
    function loadSettingsDisplay() {
        currentSettings = getSettings();
        const key = getApiKey();
        apiKeyInput.value = key || '';
        updateApiKeyStatus(!!key);
        themeSelector.value = currentSettings.theme;
        autoSaveToggle.checked = currentSettings.autoSave;
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
    function handleSaveApiKey() {
        const key = apiKeyInput.value.trim();
        let saved = false;
        let cleared = false;
        if (!key) {
            if (getApiKey() && confirm("Are you sure you want to clear the saved API Key?")) {
                 saved = saveApiKey('');
                 cleared = saved;
            } else if (!getApiKey()) {
                return;
            } else {
                 return;
            }
        } else {
            saved = saveApiKey(key);
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
     function handleSaveEditorSettings() {
         currentSettings.theme = themeSelector.value;
         currentSettings.autoSave = autoSaveToggle.checked;
         if(saveSettings(currentSettings)){
             console.log("Editor settings saved:", currentSettings);
             updateStatusMessage("Editor settings saved.", "success");
         }
     }
    function handleClearAllData() {
        if (confirm("DANGER ZONE!\n\nThis will permanently delete ALL RyxIDE projects, AI chat histories, editor settings, and your saved API key from THIS BROWSER.\n\nThis action CANNOT be undone.\n\nAre you absolutely sure you want to proceed?")) {
            if (confirm("FINAL CONFIRMATION: Really delete everything?")) {
                 try {
                     const keysToRemove = [];
                     for (let i = 0; i < localStorage.length; i++) {
                         const key = localStorage.key(i);
                         if (key && key.startsWith('ryxide_')) {
                             keysToRemove.push(key);
                         }
                     }
                     let cleared = true;
                     keysToRemove.forEach(key => {
                         if(!safeLocalStorageRemove(key)) {
                             cleared = false;
                         }
                      });
                     if (cleared) {
                          alert("All RyxIDE data has been successfully cleared from this browser.");
                          loadSettingsDisplay();
                     } else {
                          alert("An error occurred while clearing some RyxIDE data. Please check the browser console for details.");
                     }
                 } catch (e) {
                     console.error("Error during bulk data clearing:", e);
                     alert("An unexpected error occurred while clearing data.");
                 }
             }
        }
    }
    function setupEventListeners() {
        saveApiKeyButton.addEventListener('click', handleSaveApiKey);
        clearAllDataButton.addEventListener('click', handleClearAllData);
        backToDashboardButton.addEventListener('click', () => {
            window.location.href = 'index.html';
        });
        themeSelector.addEventListener('change', handleSaveEditorSettings);
        autoSaveToggle.addEventListener('change', handleSaveEditorSettings);
    }
    function init() {
        loadSettingsDisplay();
        setupEventListeners();
    }
    init();
});