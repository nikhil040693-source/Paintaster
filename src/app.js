const { analyzeCollection } = globalThis.PaintasterAnalyzer;

const agents = [
  {
    id: "recon",
    name: "Recon Agent",
    role: "Maps imported API surface.",
    steps: [
      "Reading Postman collection",
      "Parsing folders and requests",
      "Mapping endpoints and HTTP methods",
      "Identifying authorization mechanisms",
    ],
    analyze: analyzeRecon,
  },
  {
    id: "enumeration",
    name: "Enumeration Agent",
    role: "Groups resources and object patterns.",
    steps: [
      "Building resource inventory",
      "Grouping paths by API resource",
      "Finding object identifier routes",
      "Checking public route candidates",
    ],
    analyze: analyzeEnumeration,
  },
  {
    id: "static",
    name: "Static Scan Agent",
    role: "Reviews collection metadata.",
    steps: [
      "Scanning request paths",
      "Reviewing request bodies",
      "Checking risky input names",
      "Summarizing static signals",
    ],
    analyze: analyzeStaticScan,
  },
  {
    id: "dynamic",
    name: "Dynamic Scan Agent",
    role: "Plans safe active checks.",
    steps: [
      "Checking whether a live target is configured",
      "Building safe request checklist",
      "Applying no-network demo guardrail",
      "Preparing dynamic scan recommendations",
    ],
    analyze: analyzeDynamicScan,
  },
  {
    id: "exploitation",
    name: "Exploitation Agent",
    role: "Creates validation chains.",
    steps: [
      "Reviewing chainable findings",
      "Selecting lab-only validation paths",
      "Adding human approval gates",
      "Preparing non-destructive exploit plan",
    ],
    analyze: analyzeExploitation,
  },
  {
    id: "vulnerability",
    name: "Vulnerability Agent",
    role: "Prioritizes security findings.",
    steps: [
      "Ranking findings by severity",
      "Mapping findings to endpoints",
      "Drafting remediation themes",
      "Preparing vulnerability summary",
    ],
    analyze: analyzeVulnerability,
  },
  {
    id: "reporting",
    name: "Reporting Agent",
    role: "Builds final test summary.",
    steps: [
      "Collecting agent outputs",
      "Summarizing API coverage",
      "Listing pending human checks",
      "Finalizing report",
    ],
    analyze: analyzeReporting,
  },
];

const state = {
  report: null,
  currentAgentIndex: -1,
  analyses: {},
  statuses: agents.map(() => "Not yet started"),
};

const elements = {
  collectionInput: document.querySelector("#collectionInput"),
  fileLabel: document.querySelector("#fileLabel"),
  agentList: document.querySelector("#agentList"),
  progressPanel: document.querySelector("#progressPanel"),
  activeAgentName: document.querySelector("#activeAgentName"),
  progressLabel: document.querySelector("#progressLabel"),
  progressPercent: document.querySelector("#progressPercent"),
  progressBar: document.querySelector("#progressBar"),
  analysisPanel: document.querySelector("#analysisPanel"),
  analysisTitle: document.querySelector("#analysisTitle"),
  analysisSummary: document.querySelector("#analysisSummary"),
  analysisBody: document.querySelector("#analysisBody"),
  confirmationPanel: document.querySelector("#confirmationPanel"),
  confirmationText: document.querySelector("#confirmationText"),
  confirmButton: document.querySelector("#confirmButton"),
  resultsPanel: document.querySelector("#resultsPanel"),
  collectionName: document.querySelector("#collectionName"),
  collectionMeta: document.querySelector("#collectionMeta"),
  endpointCount: document.querySelector("#endpointCount"),
  endpointTable: document.querySelector("#endpointTable"),
  errorPanel: document.querySelector("#errorPanel"),
  errorMessage: document.querySelector("#errorMessage"),
};

renderAgents();

elements.collectionInput.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }

  resetWorkflow(file.name);

  try {
    const text = await file.text();
    const collection = JSON.parse(text);
    state.report = analyzeCollection(collection);
    renderEndpoints(state.report);
    await runAgent(0);
  } catch (error) {
    showError(error);
  }
});

elements.confirmButton.addEventListener("click", async () => {
  if (state.currentAgentIndex >= 0) {
    state.statuses[state.currentAgentIndex] = "Completed";
    renderAgents();
  }

  const nextIndex = state.currentAgentIndex + 1;
  elements.confirmationPanel.classList.add("hidden");

  if (nextIndex >= agents.length) {
    setProgress(100, "Pentest workflow complete");
    elements.progressPanel.classList.add("hidden");
    return;
  }

  await runAgent(nextIndex);
});

function resetWorkflow(fileName) {
  state.report = null;
  state.currentAgentIndex = -1;
  state.analyses = {};
  state.statuses = agents.map(() => "Not yet started");
  elements.fileLabel.textContent = fileName;
  elements.resultsPanel.classList.add("hidden");
  elements.errorPanel.classList.add("hidden");
  elements.analysisPanel.classList.add("hidden");
  elements.confirmationPanel.classList.add("hidden");
  elements.progressPanel.classList.remove("hidden");
  setProgress(0, "Preparing agent pipeline");
  renderAgents();
}

async function runAgent(index) {
  const agent = agents[index];
  state.currentAgentIndex = index;
  state.statuses[index] = "In progress";
  renderAgents();

  elements.progressPanel.classList.remove("hidden");
  elements.activeAgentName.textContent = agent.name;
  setProgress(0, `${agent.name} starting`);

  for (let stepIndex = 0; stepIndex < agent.steps.length; stepIndex += 1) {
    await wait(280);
    const percent = Math.round(((stepIndex + 1) / agent.steps.length) * 100);
    setProgress(percent, agent.steps[stepIndex]);
  }

  const analysis = agent.analyze(state.report, state.analyses);
  state.analyses[agent.id] = analysis;
  state.statuses[index] = "Waiting confirmation";
  renderAgents();
  renderAnalysis(agent, analysis);
}

function renderAgents() {
  elements.agentList.innerHTML = agents
    .map((agent, index) => {
      const status = state.statuses[index];
      const className = status === "In progress"
        ? "is-running"
        : status === "Completed"
          ? "is-complete"
          : status === "Waiting confirmation"
            ? "is-waiting"
            : "";

      return `
        <article class="agent-card ${className}">
          <span class="agent-name">${escapeHtml(agent.name)}</span>
          <span class="agent-status">${escapeHtml(status)}</span>
          <p>${escapeHtml(agent.role)}</p>
        </article>
      `;
    })
    .join("");
}

function renderAnalysis(agent, analysis) {
  elements.analysisPanel.classList.remove("hidden");
  elements.analysisTitle.textContent = `${agent.name} Analysis`;
  elements.analysisSummary.textContent = analysis.summary;
  elements.analysisBody.innerHTML = analysis.sections.map(renderAnalysisSection).join("");
  elements.confirmationText.textContent = `Review ${agent.name}'s analysis and confirm before the next agent starts.`;
  elements.confirmButton.textContent = state.currentAgentIndex === agents.length - 1
    ? "Confirm report complete"
    : `Confirm ${agent.name}`;
  elements.confirmationPanel.classList.remove("hidden");
}

function renderAnalysisSection(section) {
  const tag = section.ordered ? "ol" : "ul";
  return `
    <section class="analysis-block">
      <h3>${escapeHtml(section.title)}</h3>
      <${tag}>
        ${section.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
      </${tag}>
    </section>
  `;
}

function renderEndpoints(report) {
  const endpoints = report.endpoints;
  elements.collectionName.textContent = report.collection.name || "API Surface";
  elements.collectionMeta.textContent = `${report.collection.type} collection analyzed by Paintaster agents`;
  elements.endpointCount.textContent = `${endpoints.length} ${endpoints.length === 1 ? "endpoint" : "endpoints"}`;
  elements.endpointTable.innerHTML = endpoints.length
    ? endpoints.map(renderEndpointRow).join("")
    : `<tr><td colspan="3">No endpoints found in this collection.</td></tr>`;
  elements.resultsPanel.classList.remove("hidden");
}

function renderEndpointRow(endpoint) {
  return `
    <tr>
      <td><span class="method-pill method-${escapeHtml(endpoint.method.toLowerCase())}">${escapeHtml(endpoint.method)}</span></td>
      <td class="path-cell">${escapeHtml(endpoint.path)}</td>
      <td class="auth-cell">${escapeHtml(formatAuth(endpoint))}</td>
    </tr>
  `;
}

function analyzeRecon(report) {
  const methods = countBy(report.endpoints, (endpoint) => endpoint.method);
  const auths = countBy(report.endpoints, formatAuth);

  return {
    summary: `Recon mapped ${report.endpoints.length} endpoint(s) from ${report.collection.name}.`,
    sections: [
      {
        title: "Endpoint Coverage",
        items: [
          `${report.endpoints.length} endpoint(s) discovered.`,
          `Methods observed: ${formatCounts(methods)}.`,
          `Authorization observed: ${formatCounts(auths)}.`,
        ],
      },
      {
        title: "First Observed Endpoints",
        items: report.endpoints.slice(0, 6).map((endpoint) => `${endpoint.method} ${endpoint.path}`),
      },
    ],
  };
}

function analyzeEnumeration(report) {
  const resources = countBy(report.endpoints, (endpoint) => endpoint.pathParts[1] || endpoint.pathParts[0] || "root");
  const objectRoutes = report.endpoints.filter((endpoint) => endpoint.signals.includes("object-id"));
  const noAuth = report.endpoints.filter((endpoint) => formatAuth(endpoint) === "No auth");

  return {
    summary: "Enumeration grouped the API surface into resources and object-level routes.",
    sections: [
      {
        title: "Resource Groups",
        items: Object.entries(resources).map(([resource, count]) => `${resource}: ${count} endpoint(s)`),
      },
      {
        title: "Routes To Review",
        items: [
          `${objectRoutes.length} route(s) include object identifiers.`,
          `${noAuth.length} route(s) appear unauthenticated in the collection.`,
          ...objectRoutes.slice(0, 4).map((endpoint) => `${endpoint.method} ${endpoint.path}`),
        ],
      },
    ],
  };
}

function analyzeStaticScan(report) {
  const sensitive = report.endpoints.filter((endpoint) => endpoint.signals.includes("sensitive"));
  const urlInputs = report.endpoints.filter((endpoint) => endpoint.signals.includes("url-input"));
  const fileInputs = report.endpoints.filter((endpoint) => endpoint.signals.includes("file"));

  return {
    summary: "Static scan reviewed collection metadata, paths, body fields, and risky input names.",
    sections: [
      {
        title: "Static Signals",
        items: [
          `${sensitive.length} sensitive resource route(s).`,
          `${urlInputs.length} route(s) with URL-like inputs.`,
          `${fileInputs.length} route(s) with file or upload signals.`,
          `${report.findings.length} total static finding candidate(s).`,
        ],
      },
      {
        title: "Top Static Findings",
        items: report.findings.slice(0, 5).map((finding) => `${finding.severity.toUpperCase()}: ${finding.title}`),
      },
    ],
  };
}

function analyzeDynamicScan(report) {
  const writeRoutes = report.endpoints.filter((endpoint) => ["POST", "PUT", "PATCH", "DELETE"].includes(endpoint.method));

  return {
    summary: "Dynamic scan is staged as a safe plan because no authorized live target was configured.",
    sections: [
      {
        title: "Dynamic Scan Status",
        items: [
          "No network requests were sent.",
          "Live testing requires written scope, base URL allowlist, test credentials, and rate limits.",
          `${writeRoutes.length} state-changing route(s) should use disposable records only.`,
        ],
      },
      {
        title: "Recommended Active Checks",
        items: [
          "Validate expected status codes for unauthenticated requests.",
          "Confirm object-level authorization with two owned lab accounts.",
          "Check input validation using harmless fixtures only.",
        ],
      },
    ],
  };
}

function analyzeExploitation(report) {
  return {
    summary: "Exploitation Agent created non-destructive validation chains for human-approved lab testing.",
    sections: [
      {
        title: "Exploit Execution Status",
        items: [
          "No exploit payloads were executed.",
          "All exploitation steps are validation plans only.",
          `${report.chains.length} safe chain candidate(s) generated.`,
        ],
      },
      {
        title: "Chain Candidates",
        items: report.chains.length
          ? report.chains.map((chain) => `${chain.severity.toUpperCase()}: ${chain.title}`)
          : ["No multi-step chain candidates were generated."],
      },
    ],
  };
}

function analyzeVulnerability(report) {
  const severities = countBy(report.findings, (finding) => finding.severity);

  return {
    summary: "Vulnerability Agent prioritized the static and chain findings for review.",
    sections: [
      {
        title: "Severity Breakdown",
        items: Object.keys(severities).length
          ? Object.entries(severities).map(([severity, count]) => `${severity.toUpperCase()}: ${count}`)
          : ["No vulnerability candidates found."],
      },
      {
        title: "Prioritized Findings",
        items: report.findings.slice(0, 6).map((finding) => `${finding.severity.toUpperCase()}: ${finding.title}`),
      },
    ],
  };
}

function analyzeReporting(report, analyses) {
  return {
    summary: "Reporting Agent compiled the final Paintaster v0.1 assessment summary.",
    sections: [
      {
        title: "Final Summary",
        items: [
          `${report.collection.name} analyzed from imported collection.`,
          `${report.endpoints.length} endpoint(s), ${report.findings.length} finding candidate(s), ${report.chains.length} chain candidate(s).`,
          `${Object.keys(analyses).length + 1} agent analysis step(s) completed.`,
        ],
      },
      {
        title: "Next Human Actions",
        items: [
          "Confirm test scope and target ownership before any active scan.",
          "Add environment-aware base URL allowlisting before dynamic testing.",
          "Keep exploitation steps gated behind manual approval and disposable lab data.",
        ],
      },
    ],
  };
}

function formatAuth(endpoint) {
  const auth = String(endpoint.auth || "").toLowerCase();
  const headers = endpoint.headers.map((header) => header.toLowerCase());

  if (["none", "noauth", "no auth"].includes(auth)) {
    return "No auth";
  }

  if (auth === "bearer" || headers.includes("authorization")) {
    return "Bearer token";
  }

  if (auth === "basic") {
    return "Basic auth";
  }

  if (auth === "apikey" || auth === "api key" || headers.includes("x-api-key")) {
    return "API key";
  }

  if (auth === "oauth1" || auth === "oauth2") {
    return auth.toUpperCase();
  }

  if (auth === "declared") {
    return "Declared in spec";
  }

  if (auth === "unspecified" || !auth) {
    return "Unspecified";
  }

  return titleCase(auth);
}

function showError(error) {
  elements.progressPanel.classList.add("hidden");
  elements.resultsPanel.classList.add("hidden");
  elements.analysisPanel.classList.add("hidden");
  elements.errorMessage.textContent = error.message;
  elements.errorPanel.classList.remove("hidden");
}

function setProgress(percent, label) {
  elements.progressBar.style.width = `${percent}%`;
  elements.progressPercent.textContent = `${percent}%`;
  elements.progressLabel.textContent = label;
}

function countBy(items, getKey) {
  return items.reduce((counts, item) => {
    const key = getKey(item) || "Unknown";
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
}

function formatCounts(counts) {
  const entries = Object.entries(counts);
  return entries.length ? entries.map(([key, count]) => `${key}:${count}`).join(", ") : "none";
}

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function titleCase(value) {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
