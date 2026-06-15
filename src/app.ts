type FindingKey = "auth" | "events" | "storage";

const findingCopy: Record<FindingKey, { title: string; body: string; code: string }> = {
  auth: {
    title: "Missing authorization gate",
    body:
      "This function writes contract state but does not require caller authorization. Add `caller.require_auth()` before accepting sensitive input.",
    code: `pub fn admin_set_config(env: Env, caller: Address, config: Config) {
    caller.require_auth();
    env.storage().instance().set(&DataKey::Config, &config);
}`
  },
  events: {
    title: "No event emitted after state change",
    body:
      "This function updates contract state silently. Emitting a Soroban event makes the change traceable for indexers, dashboards, and auditors.",
    code: `env.events().publish(
    (symbol_short!("deposit"), caller.clone()),
    (asset, amount)
);`
  },
  storage: {
    title: "Instance storage may grow without bounds",
    body:
      "The scanner found a collection written to instance storage without a visible cap or pruning path. Consider bounded keys, temporary storage, or archival strategy.",
    code: `let key = DataKey::Position(user.clone(), position_id);
env.storage().persistent().set(&key, &position);`
  }
};

const runScanButton = document.getElementById("runScanButton");
const copyCiButton = document.getElementById("copyCiButton");
const scanOutput = document.getElementById("scanOutput");
const scoreValue = document.getElementById("scoreValue");
const criticalCount = document.getElementById("criticalCount");
const detailTitle = document.getElementById("detailTitle");
const detailBody = document.getElementById("detailBody");
const detailCode = document.getElementById("detailCode");
const findings = document.querySelectorAll<HTMLButtonElement>(".finding");

runScanButton?.addEventListener("click", () => {
  if (runScanButton instanceof HTMLButtonElement) {
    runScanButton.textContent = "Scan complete";
  }
  if (scanOutput) {
    scanOutput.textContent = `$ guardrail scan ./contracts --profile strict
✓ parsed 4 Rust modules
✓ loaded 12 Soroban rules
✓ checked auth, events, storage, tests, CI
! 1 critical, 2 high, 4 medium
→ report saved to guardrail-report.json`;
  }
  if (scoreValue) scoreValue.textContent = "88";
  if (criticalCount) criticalCount.textContent = "0";
});

findings.forEach((finding) => {
  finding.addEventListener("click", () => {
    const key = finding.dataset.finding as FindingKey | undefined;
    if (!key) return;
    const copy = findingCopy[key];
    findings.forEach((item) => item.classList.remove("active"));
    finding.classList.add("active");
    if (detailTitle) detailTitle.textContent = copy.title;
    if (detailBody) detailBody.textContent = copy.body;
    if (detailCode) detailCode.textContent = copy.code;
  });
});

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
  } catch {
    copyCiButton.textContent = "Copy manually";
  }

  window.setTimeout(() => {
    copyCiButton.textContent = "Copy CI snippet";
  }, 1400);
});
