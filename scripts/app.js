"use strict";
// Source files content mapping
const sourceCodeFiles = {
    "src/lib.rs": `use soroban_sdk::{contract, contractimpl, Env, Address, symbol_short};

#[contract]
pub struct GuardrailExample;

#[contractimpl]
impl GuardrailExample {
    // Initialize the contract and register the admin credentials
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
    }

    // Mutate configuration parameters
    pub fn admin_set_config(env: Env, caller: Address, config: Config) {
        // WARNING: Missing authorization gate!
        // Admin configuration updates must verify authorization credentials.
        env.storage().instance().set(&DataKey::Config, &config);
    }

    pub fn get_config(env: Env) -> Config {
        env.storage().instance().get(&DataKey::Config).unwrap()
    }
}`,
    "src/vault.rs": `use soroban_sdk::{contract, contractimpl, Env, Address, symbol_short, token};

#[contract]
pub struct Vault;

#[contractimpl]
impl Vault {
    pub fn deposit(env: Env, caller: Address, asset: Address, amount: i128) {
        caller.require_auth();
        
        let client = token::Client::new(&env, &asset);
        client.transfer(&caller, &env.current_contract_address(), &amount);
        
        let key = DataKey::Balance(caller.clone());
        let balance: i128 = env.storage().persistent().get(&key).unwrap_or(0);
        env.storage().persistent().set(&key, &(balance + amount));

        // WARNING: No event emitted after state change!
        // Missing event triggers make audits and off-chain sync impossible.
    }
}`,
    "src/state.rs": `use soroban_sdk::{contract, contractimpl, Env, Address};

#[contract]
pub struct Positions;

#[contractimpl]
impl Positions {
    pub fn create_position(env: Env, user: Address, position_id: u64, position: Position) {
        user.require_auth();
        
        // WARNING: Instance storage may grow without bounds!
        // Storing list items without an upper limit inside instance storage leads to lockouts.
        let key = DataKey::Position(user.clone(), position_id);
        env.storage().persistent().set(&key, &position);
    }
}`
};
// Finding copy
const findingsCatalog = {
    auth: {
        id: "AUTH-001",
        severity: "critical",
        title: "Missing authorization gate",
        file: "src/lib.rs",
        line: 21,
        recommendation: "This function writes contract state but does not require caller authorization. Add `caller.require_auth()` before writing admin-controlled configurations.",
        snippet: `pub fn admin_set_config(env: Env, caller: Address, config: Config) {
    caller.require_auth();
    env.storage().instance().set(&DataKey::Config, &config);
}`
    },
    events: {
        id: "EVT-002",
        severity: "high",
        title: "No event emitted after state change",
        file: "src/vault.rs",
        line: 16,
        recommendation: "This function updates contract state silently. Emitting a Soroban event makes the change traceable for indexers, dashboards, and auditors.",
        snippet: `env.events().publish(
    (symbol_short!("deposit"), caller.clone()),
    (asset, amount)
);`
    },
    storage: {
        id: "STO-003",
        severity: "medium",
        title: "Instance storage may grow without bounds",
        file: "src/state.rs",
        line: 10,
        recommendation: "The scanner found a collection written to instance storage without a visible cap or pruning path. Consider bounded keys, temporary storage, or archival strategy.",
        snippet: `let key = DataKey::Position(user.clone(), position_id);
env.storage().persistent().set(&key, &position);`
    }
};
// Local Application State
let currentReport = {
    score: 82,
    critical: 1,
    high: 2,
    medium: 4,
    passed: 18,
    history: [62, 65, 70, 68, 75, 74, 79, 82]
};
// DOM Query References
const runScanButton = document.getElementById("runScanButton");
const copyCiButton = document.getElementById("copyCiButton");
const scanOutput = document.getElementById("scanOutput");
const scoreValue = document.getElementById("scoreValue");
const scoreRingProgress = document.getElementById("scoreRingProgress");
const criticalCount = document.getElementById("criticalCount");
const highCount = document.getElementById("highCount");
const mediumCount = document.getElementById("mediumCount");
const passedCount = document.getElementById("passedCount");
const searchInput = document.getElementById("searchInput");
const activePathLeaf = document.getElementById("activePathLeaf");
const navItems = document.querySelectorAll(".nav-item");
const sections = document.querySelectorAll(".dashboard-section");
const findingsList = document.getElementById("findingsList");
const codeEditorGrid = document.getElementById("codeEditorGrid");
const activeFileName = document.getElementById("activeFileName");
const activeFileTab = document.getElementById("activeFileTab");
const lineChart = document.getElementById("lineChart");
const donutChart = document.getElementById("donutChart");
const donutLegend = document.getElementById("donutLegend");
const chartTooltip = document.getElementById("chartTooltip");
// 1. Single Page Navigation Logic
function initNavigation() {
    const switchSection = (sectionId) => {
        let targetSection = document.getElementById(`${sectionId}Section`);
        if (!targetSection) {
            targetSection = document.getElementById("overviewSection");
            sectionId = "overview";
        }
        sections.forEach(sec => sec.classList.remove("active"));
        targetSection?.classList.add("active");
        navItems.forEach(item => {
            if (item.dataset.section === sectionId) {
                item.classList.add("active");
            }
            else {
                item.classList.remove("active");
            }
        });
        if (activePathLeaf) {
            activePathLeaf.textContent = sectionId;
        }
    };
    // Nav item click event
    navItems.forEach(item => {
        item.addEventListener("click", (e) => {
            const section = item.dataset.section;
            if (section) {
                switchSection(section);
            }
        });
    });
    // Watch URL Hash Changes
    window.addEventListener("hashchange", () => {
        const hash = window.location.hash.substring(1);
        if (hash)
            switchSection(hash);
    });
    // Initial routing
    const initialHash = window.location.hash.substring(1);
    switchSection(initialHash || "overview");
}
// 2. SVG Charting Engine
function renderScoreRing() {
    if (!scoreRingProgress || !scoreValue)
        return;
    scoreValue.textContent = currentReport.score.toString();
    // Circumference: 2 * Math.PI * R = 2 * 3.14159 * 50 = 314
    const circumference = 314;
    const offset = circumference - (currentReport.score / 100) * circumference;
    scoreRingProgress.style.strokeDashoffset = offset.toString();
}
function renderDonutChart() {
    if (!donutChart || !donutLegend)
        return;
    donutChart.innerHTML = "";
    const stats = [
        { label: "Critical", count: currentReport.critical, color: "#ff3344" },
        { label: "High", count: currentReport.high, color: "#f59e0b" },
        { label: "Medium", count: currentReport.medium, color: "#3b82f6" },
        { label: "Passed", count: currentReport.passed, color: "#10b981" }
    ].filter(s => s.count > 0);
    const total = stats.reduce((acc, curr) => acc + curr.count, 0);
    let accumulatedAngle = 0;
    // Render SVG Paths
    stats.forEach((stat, index) => {
        const percentage = stat.count / total;
        const angle = percentage * 360;
        // Calculate polar coordinates for slices
        const radius = 65;
        const cx = 100;
        const cy = 100;
        const startAngle = accumulatedAngle;
        const endAngle = accumulatedAngle + angle;
        // SVG stroke dash offset method for donut arcs
        const circ = 2 * Math.PI * radius;
        const strokeDash = circ;
        const strokeOffset = circ - (percentage * circ);
        const rotation = startAngle - 90; // Align to 12 o'clock
        const circleElement = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circleElement.setAttribute("class", "donut-slice");
        circleElement.setAttribute("cx", cx.toString());
        circleElement.setAttribute("cy", cy.toString());
        circleElement.setAttribute("r", radius.toString());
        circleElement.setAttribute("fill", "none");
        circleElement.setAttribute("stroke", stat.color);
        circleElement.setAttribute("stroke-width", "18");
        circleElement.setAttribute("stroke-dasharray", `${strokeDash} ${strokeDash}`);
        circleElement.setAttribute("stroke-dashoffset", strokeOffset.toString());
        circleElement.setAttribute("transform", `rotate(${rotation} ${cx} ${cy})`);
        // Tooltip interations
        circleElement.addEventListener("mouseenter", () => {
            circleElement.setAttribute("opacity", "0.85");
        });
        circleElement.addEventListener("mouseleave", () => {
            circleElement.setAttribute("opacity", "1");
        });
        circleElement.addEventListener("click", () => {
            window.location.hash = "findings";
        });
        donutChart.appendChild(circleElement);
        accumulatedAngle += angle;
    });
    // Render Inner Center Total
    const textVal = document.createElementNS("http://www.w3.org/2000/svg", "text");
    textVal.setAttribute("class", "donut-center-text");
    textVal.setAttribute("x", "100");
    textVal.setAttribute("y", "95");
    textVal.setAttribute("font-size", "22");
    textVal.textContent = total.toString();
    donutChart.appendChild(textVal);
    const textLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
    textLabel.setAttribute("class", "donut-center-text");
    textLabel.setAttribute("x", "100");
    textLabel.setAttribute("y", "115");
    textLabel.setAttribute("font-size", "10");
    textLabel.setAttribute("fill", "#666");
    textLabel.textContent = "CHECKED RULES";
    donutChart.appendChild(textLabel);
    // Render Legend
    donutLegend.innerHTML = "";
    stats.forEach(stat => {
        const legendItem = document.createElement("div");
        legendItem.className = "legend-item";
        legendItem.innerHTML = `
      <span class="legend-color" style="background-color: ${stat.color}"></span>
      <span>${stat.label} (${stat.count})</span>
    `;
        legendItem.addEventListener("click", () => {
            window.location.hash = "findings";
            if (searchInput) {
                searchInput.value = stat.label;
                filterFindings(stat.label.toLowerCase());
            }
        });
        donutLegend.appendChild(legendItem);
    });
}
function renderLineChart() {
    if (!lineChart)
        return;
    // Clear dynamic elements, keep <defs>
    const defs = lineChart.querySelector("defs");
    lineChart.innerHTML = "";
    if (defs)
        lineChart.appendChild(defs);
    const data = currentReport.history;
    const paddingLeft = 40;
    const paddingRight = 20;
    const paddingTop = 20;
    const paddingBottom = 20;
    const width = 500;
    const height = 150;
    const chartWidth = width - paddingLeft - paddingRight;
    const chartHeight = height - paddingTop - paddingBottom;
    // Grid Lines
    const gridLevels = [0, 25, 50, 75, 100];
    gridLevels.forEach(level => {
        const y = paddingTop + chartHeight - (level / 100) * chartHeight;
        // Line path
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("class", "chart-grid-line");
        line.setAttribute("x1", paddingLeft.toString());
        line.setAttribute("y1", y.toString());
        line.setAttribute("x2", (width - paddingRight).toString());
        line.setAttribute("y2", y.toString());
        lineChart.appendChild(line);
        // Text Label
        const txt = document.createElementNS("http://www.w3.org/2000/svg", "text");
        txt.setAttribute("class", "chart-axis-text");
        txt.setAttribute("x", (paddingLeft - 8).toString());
        txt.setAttribute("y", (y + 3).toString());
        txt.setAttribute("text-anchor", "end");
        txt.textContent = level.toString();
        lineChart.appendChild(txt);
    });
    // Calculate coordinates
    const points = data.map((val, idx) => {
        const x = paddingLeft + (idx / (data.length - 1)) * chartWidth;
        const y = paddingTop + chartHeight - (val / 100) * chartHeight;
        return { x, y, val, idx };
    });
    // Create path strings
    let pathD = `M ${points[0].x} ${points[0].y}`;
    let areaD = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
        pathD += ` L ${points[i].x} ${points[i].y}`;
        areaD += ` L ${points[i].x} ${points[i].y}`;
    }
    areaD += ` L ${points[points.length - 1].x} ${paddingTop + chartHeight}`;
    areaD += ` L ${points[0].x} ${paddingTop + chartHeight} Z`;
    // Append Area Fill
    const areaElement = document.createElementNS("http://www.w3.org/2000/svg", "path");
    areaElement.setAttribute("class", "chart-path-area");
    areaElement.setAttribute("d", areaD);
    lineChart.appendChild(areaElement);
    // Append Line Stroke
    const pathElement = document.createElementNS("http://www.w3.org/2000/svg", "path");
    pathElement.setAttribute("class", "chart-path-line");
    pathElement.setAttribute("d", pathD);
    lineChart.appendChild(pathElement);
    // Append Interactive Points
    points.forEach((pt) => {
        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.setAttribute("class", "chart-data-point");
        circle.setAttribute("cx", pt.x.toString());
        circle.setAttribute("cy", pt.y.toString());
        circle.setAttribute("r", "4");
        // Mouse hover tooltips
        circle.addEventListener("mouseenter", (e) => {
            if (!chartTooltip)
                return;
            chartTooltip.textContent = `Scan ${pt.idx + 1}: ${pt.val}%`;
            chartTooltip.style.left = `${(pt.x / width) * 100}%`;
            chartTooltip.style.top = `${(pt.y / height) * 100 - 10}%`;
            chartTooltip.classList.add("visible");
        });
        circle.addEventListener("mouseleave", () => {
            chartTooltip?.classList.remove("visible");
        });
        lineChart.appendChild(circle);
    });
}
// 3. Split-Screen Code Explorer Logic
function renderCodeExplorer(findingKey) {
    if (!codeEditorGrid || !activeFileName)
        return;
    codeEditorGrid.innerHTML = "";
    const finding = findingsCatalog[findingKey];
    const fileContent = sourceCodeFiles[finding.file];
    if (!fileContent)
        return;
    activeFileName.textContent = finding.file;
    const lines = fileContent.split("\n");
    lines.forEach((line, index) => {
        const lineNumber = index + 1;
        const isHighlighted = lineNumber === finding.line;
        // Line Number Element
        const numEl = document.createElement("div");
        numEl.className = `line-number ${isHighlighted ? 'highlighted' : ''}`;
        numEl.textContent = lineNumber.toString();
        codeEditorGrid.appendChild(numEl);
        // Code Line Content Element
        const codeEl = document.createElement("div");
        codeEl.className = `code-line ${isHighlighted ? 'highlighted' : ''}`;
        codeEl.textContent = line || " ";
        codeEditorGrid.appendChild(codeEl);
        // Inject inline warning alert box under highlighted line
        if (isHighlighted) {
            const annotationEl = document.createElement("div");
            annotationEl.className = `code-annotation-alert severity-${finding.severity}`;
            const badgeStyle = finding.severity;
            annotationEl.innerHTML = `
        <div class="annotation-header">
          <span class="severity ${badgeStyle}">${finding.severity}</span>
          <h4>[${finding.id}] ${finding.title}</h4>
        </div>
        <div class="annotation-body">
          ${finding.recommendation}
        </div>
        <div class="annotation-fix">
          <div class="annotation-fix-title">Suggested Remediation</div>
          <pre><code>${finding.snippet}</code></pre>
        </div>
      `;
            codeEditorGrid.appendChild(annotationEl);
        }
    });
    // Automatically scroll Code Viewport to target line
    setTimeout(() => {
        const highlightedEl = codeEditorGrid.querySelector(".code-line.highlighted");
        if (highlightedEl) {
            highlightedEl.scrollIntoView({ behavior: "smooth", block: "center" });
        }
    }, 100);
}
// Register click events on Findings list items
function initFindingsActions() {
    const findings = document.querySelectorAll(".finding");
    findings.forEach(finding => {
        finding.addEventListener("click", () => {
            const key = finding.dataset.finding;
            if (!key)
                return;
            findings.forEach(f => f.classList.remove("active"));
            finding.classList.add("active");
            renderCodeExplorer(key);
        });
    });
}
// 4. Run Scan Action Simulator
function simulateScanProcess() {
    if (!runScanButton || !scanOutput)
        return;
    runScanButton.setAttribute("disabled", "true");
    runScanButton.innerHTML = `
    <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" class="btn-icon" style="animation: spin 1.2s infinite linear;"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"></path></svg>
    Scanning...
  `;
    // Style insertion for spinner
    if (!document.getElementById("btnSpinnerStyle")) {
        const style = document.createElement("style");
        style.id = "btnSpinnerStyle";
        style.innerHTML = "@keyframes spin { 100% { transform: rotate(360deg); } }";
        document.head.appendChild(style);
    }
    scanOutput.textContent = "$ guardrail scan ./contracts --profile=strict\nAnalyzing Cargo.toml dependencies...";
    setTimeout(() => {
        scanOutput.textContent += "\n✓ loaded 12 Soroban verification rules\n✓ parsing 4 Rust modules...";
    }, 400);
    setTimeout(() => {
        scanOutput.textContent += "\nAnalyzing src/lib.rs ...\nAnalyzing src/vault.rs ...\nAnalyzing src/state.rs ...";
    }, 900);
    setTimeout(() => {
        // Modify application state (representing fixed critical bug)
        currentReport.score = 88;
        currentReport.critical = 0;
        currentReport.high = 2;
        currentReport.medium = 4;
        currentReport.passed = 19;
        // Add new safety history point
        if (currentReport.history[currentReport.history.length - 1] !== 88) {
            currentReport.history.push(88);
            if (currentReport.history.length > 10)
                currentReport.history.shift();
        }
        // Refresh UI metrics
        if (criticalCount)
            criticalCount.textContent = "0";
        if (highCount)
            highCount.textContent = "2";
        if (mediumCount)
            mediumCount.textContent = "4";
        if (passedCount)
            passedCount.textContent = "19";
        renderScoreRing();
        renderDonutChart();
        renderLineChart();
        // Remove critical item from findings list
        const critFinding = findingsList?.querySelector('[data-finding="auth"]');
        if (critFinding) {
            critFinding.remove();
        }
        // Default select events finding in code explorer
        const highFinding = findingsList?.querySelector('[data-finding="events"]');
        if (highFinding) {
            highFinding.click();
        }
        scanOutput.textContent += `\n\n✓ Scan Finished.
--------------------------------------------------
Critical: 0 | High: 2 | Medium: 4 | Passed: 19
Scan Readiness Score: 88/100
→ Detailed analysis saved to guardrail-report.json`;
        runScanButton.removeAttribute("disabled");
        runScanButton.innerHTML = `
      <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" class="btn-icon"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
      Scan complete
    `;
        setTimeout(() => {
            runScanButton.innerHTML = `
        <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" class="btn-icon"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
        Run scan
      `;
        }, 2000);
    }, 1600);
}
// 5. Live Backend API Connector
async function checkBackendConnectivity() {
    const statusIndicator = document.querySelector(".status-indicator");
    const statusLabel = document.querySelector(".status-label");
    try {
        const res = await fetch("http://localhost:8787/health", { method: "GET" });
        if (res.ok) {
            statusIndicator?.classList.add("connected");
            if (statusLabel)
                statusLabel.textContent = "API Online";
            // Load live report data from API
            const scanRes = await fetch("http://localhost:8787/scan/demo");
            if (scanRes.ok) {
                const liveData = await scanRes.json();
                currentReport.score = liveData.score || currentReport.score;
                currentReport.critical = liveData.summary.critical ?? currentReport.critical;
                currentReport.high = liveData.summary.high ?? currentReport.high;
                currentReport.medium = liveData.summary.medium ?? currentReport.medium;
                currentReport.passed = liveData.summary.passed ?? currentReport.passed;
                if (criticalCount)
                    criticalCount.textContent = currentReport.critical.toString();
                if (highCount)
                    highCount.textContent = currentReport.high.toString();
                if (mediumCount)
                    mediumCount.textContent = currentReport.medium.toString();
                if (passedCount)
                    passedCount.textContent = currentReport.passed.toString();
                renderScoreRing();
                renderDonutChart();
                renderLineChart();
            }
        }
        else {
            throw new Error();
        }
    }
    catch {
        // Fallback to offline / mock settings
        statusIndicator?.classList.remove("connected");
        if (statusLabel)
            statusLabel.textContent = "Offline (Mock)";
    }
}
// 6. Search Bar Filter Logic
function filterFindings(query) {
    const findings = document.querySelectorAll(".finding");
    let firstVisible = null;
    for (const finding of findings) {
        const text = finding.innerText.toLowerCase();
        const matches = text.includes(query);
        if (matches) {
            finding.style.display = "flex";
            if (!firstVisible)
                firstVisible = finding;
        }
        else {
            finding.style.display = "none";
        }
    }
    // Switch explorer to first match
    if (firstVisible) {
        firstVisible.click();
    }
}
// 7. CI Copy Setup Action
function initCiSnippetCopy() {
    copyCiButton?.addEventListener("click", async () => {
        const snippet = `name: Soroban Guardrail
on: [pull_request]
jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npx soroban-guardrail scan ./contracts --format github`;
        try {
            await navigator.clipboard.writeText(snippet);
            copyCiButton.textContent = "Copied";
        }
        catch {
            copyCiButton.textContent = "Copy manually";
        }
        window.setTimeout(() => {
            copyCiButton.textContent = "Copy CI snippet";
        }, 1500);
    });
}
// Initialize application on load
window.addEventListener("DOMContentLoaded", () => {
    initNavigation();
    renderScoreRing();
    renderDonutChart();
    renderLineChart();
    renderCodeExplorer("auth");
    initFindingsActions();
    initCiSnippetCopy();
    // Run scan simulator trigger
    runScanButton?.addEventListener("click", simulateScanProcess);
    // Search input events
    searchInput?.addEventListener("input", (e) => {
        const query = e.target.value.toLowerCase();
        filterFindings(query);
    });
    // Execute async check for real backend
    checkBackendConnectivity();
});
