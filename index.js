document.addEventListener('DOMContentLoaded', () => {
    const projectListUl = document.getElementById('project-list');
    const noProjectsMessage = document.getElementById('no-projects-message');
    const newProjectButton = document.getElementById('new-project-button');
    const settingsButton = document.getElementById('settings-button');
    const modalBackdrop = document.getElementById('modal-backdrop');
    const newProjectModal = document.getElementById('new-project-modal');
    const projectNameInput = document.getElementById('project-name-input');
    const projectTemplateSelector = document.getElementById('project-template-selector');
    const createProjectConfirmButton = document.getElementById('create-project-confirm-button');
    const createProjectCancelButton = document.getElementById('create-project-cancel-button');
    const loaderOverlay = document.getElementById('loader-overlay');
    const loaderText = document.getElementById('loader-text');
    const creditsFooter = document.getElementById('credits-footer');

    function renderProjectItem(proj) {
        const nameSpan = createDOMElement('span', { className: 'project-name', textContent: proj.name || 'Untitled Project' });
        const modifiedSpan = createDOMElement('span', { className: 'project-modified', textContent: `Modified: ${formatDate(proj.lastModified)}` });
        const textDiv = createDOMElement('div', { className: 'project-info', children: [nameSpan, modifiedSpan] });

        const downloadBtn = createDOMElement('button', {
            className: 'action-button', title: 'Download Project as Zip', innerHTML: '<i class="fas fa-download"></i>',
            dataset: { projectId: proj.id }, listeners: { click: async (e) => { e.stopPropagation(); await handleDownloadProject(proj.id, proj.name); } }
        });
        const deleteBtn = createDOMElement('button', {
            className: 'action-button danger', title: 'Delete Project', innerHTML: '<i class="fas fa-trash"></i>',
            dataset: { projectId: proj.id }, listeners: { click: async (e) => { e.stopPropagation(); await handleDeleteProject(proj.id, proj.name); } }
        });
        const actionsDiv = createDOMElement('div', { className: 'project-actions', children: [downloadBtn, deleteBtn] });

        return createDOMElement('li', {
            dataset: { projectId: proj.id }, children: [textDiv, actionsDiv],
            listeners: { click: async () => await openProject(proj.id) }
        });
    }

    async function loadProjectList() {
        try {
            const projects = (await getAllProjectsList()).sort((a, b) => (b.lastModified || 0) - (a.lastModified || 0));
            projectListUl.innerHTML = '';
            noProjectsMessage.style.display = projects.length === 0 ? 'block' : 'none';
            projects.forEach(proj => projectListUl.appendChild(renderProjectItem(proj)));
        } catch (error) {
            console.error("Failed to load project list:", error);
            projectListUl.innerHTML = '<li>Error loading projects. Check console.</li>';
            noProjectsMessage.style.display = 'none';
        }
    }

    async function handleDeleteProject(projectId, projectName) {
        if (confirm(`Delete project "${projectName || 'Untitled'}"? Cannot be undone.`)) {
            const success = await deleteProjectFromStorage(projectId);
            if (success) {
                 await loadProjectList();
                 await updateCreditsDisplay();
            } else {
                 alert("Failed to delete project data from storage.");
            }
        }
    }

    async function handleDownloadProject(projectId, projectName) {
        const projectData = await getProjectFromStorage(projectId);
        if (!projectData || !projectData.files || typeof JSZip === 'undefined') {
            alert("Could not load project data or JSZip library."); return;
        }
        showLoader(loaderOverlay, loaderText, `Zipping ${projectName}...`);
        try {
            const zip = new JSZip();
            projectData.files.forEach(file => zip.file(file.name, file.content || ''));
            const metadata = { name: projectData.name, id: projectData.id, lastModified: projectData.lastModified, source: "RyxIDE_v3" };
            zip.file('ryxide_project_meta.json', JSON.stringify(metadata, null, 2));
            const content = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
            const link = createDOMElement('a', { href: URL.createObjectURL(content), download: `${(projectName || 'ryxide_project').replace(/[^a-z0-9_-]/gi, '_').toLowerCase()}.zip` });
            document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(link.href);
        } catch (err) { console.error("Zip Error:", err); alert("Failed to create zip file."); }
        finally { hideLoader(loaderOverlay); }
    }

    async function openProject(projectId) {
        await setCurrentProjectId(projectId);
        window.location.href = 'editor.html';
    }

    function openNewProjectModal() {
        projectNameInput.value = '';
        projectTemplateSelector.value = 'web_basic';
        showModal(modalBackdrop, newProjectModal);
    }

    async function handleCreateProject() {
        const name = projectNameInput.value.trim();
        const templateKey = projectTemplateSelector.value;
        if (!name) { alert('Please enter a project name.'); projectNameInput.focus(); return; }
        const projectsList = await getAllProjectsList();
        if (projectsList.some(p => p.name.toLowerCase() === name.toLowerCase())) {
            alert(`A project named "${name}" already exists.`);
            projectNameInput.focus(); return;
        }

        const newProject = {
            id: generateUUID(), name: name, files: [],
            aiChats: [{ id: generateUUID(), name: 'Chat 1', messages: [], createdAt: Date.now() }],
            currentAiChatId: null, lastModified: Date.now(), openFileId: null
        };
        newProject.currentAiChatId = newProject.aiChats[0].id;

        const templateFiles = projectTemplates[templateKey] || [];
        templateFiles.forEach(templateFile => {
            const fileId = generateUUID();
            const finalContent = templateFile.content.replace(/\$\{projectName\}/g, name);
            newProject.files.push({ id: fileId, name: templateFile.name, language: templateFile.language, content: finalContent });
             if (!newProject.openFileId) newProject.openFileId = fileId;
        });

        const saved = await saveProjectToStorage(newProject);
        if (saved) {
             hideModal(modalBackdrop, newProjectModal);
             await openProject(newProject.id);
        }
    }

    async function updateCreditsDisplay() {
         try {
            const projectCount = (await getAllProjectsList()).length;
            const countText = projectCount === 1 ? '1 project' : `${projectCount} projects`;
            creditsFooter.textContent = `${countText} stored locally.`;
         } catch (e) {
            creditsFooter.textContent = 'Error loading project count.';
         }
    }

    function setupEventListeners() {
        newProjectButton.addEventListener('click', openNewProjectModal);
        createProjectCancelButton.addEventListener('click', () => hideModal(modalBackdrop, newProjectModal));
        createProjectConfirmButton.addEventListener('click', handleCreateProject);
        settingsButton.addEventListener('click', () => { window.location.href = 'settings.html'; });
    }

    async function init() {
        await setCurrentProjectId(null);
        await loadProjectList();
        await updateCreditsDisplay();
        setupEventListeners();
    }

    init().catch(err => {
         console.error("Initialization failed:", err);
         alert("Failed to initialize the dashboard. Please check the console.");
         noProjectsMessage.textContent = "Error loading projects.";
         noProjectsMessage.style.display = 'block';
    });
});
