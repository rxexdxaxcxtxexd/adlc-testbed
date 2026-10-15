// Builds the Sheet tabs and Drive tree through the Store adapter. Safe to run twice.

function initProject(store) {
  Object.keys(SCHEMA).forEach(function (tab) { store.ensureTab(tab, SCHEMA[tab]); });
  [DRIVE_ROOT, DRIVE_CONFIG, DRIVE_INBOX, DRIVE_PROJECTS].forEach(function (p) { store.ensureFolder(p); });
  store.writeFile(DRIVE_CONFIG, 'tolerance-matrix.json', JSON.stringify(TOLERANCE_MATRIX, null, 2), 'application/json');
}

function addProjectFolders(store, project, subs) {
  store.ensureFolder(projectFolderPath(project));
  subs.forEach(function (sub) {
    var base = subFolderPath(project, sub);
    store.ensureFolder(base);
    RECORD_FOLDERS.forEach(function (f) { store.ensureFolder(base + '/' + f); });
  });
}
