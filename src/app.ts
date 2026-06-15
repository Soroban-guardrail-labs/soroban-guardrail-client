const primaryAction = document.getElementById("primaryAction");
const secondaryAction = document.getElementById("secondaryAction");

primaryAction?.addEventListener("click", () => {
  primaryAction.textContent = "Session ready";
});

secondaryAction?.addEventListener("click", () => {
  secondaryAction.textContent = "GET /health";
});
