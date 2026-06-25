const { readCodexSnapshot } = require("../src/status-reader");

const snapshot = readCodexSnapshot();
console.log(JSON.stringify({
  generatedAt: snapshot.generatedAt,
  codexHome: snapshot.codexHome,
  projectCount: snapshot.projects.length,
  sessionCount: snapshot.projects.reduce((sum, project) => sum + project.sessions.length, 0),
  firstProject: snapshot.projects[0]?.name || null,
  error: snapshot.error || null
}, null, 2));
