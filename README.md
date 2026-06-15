# Soroban Guardrail Client

Polished web preview for Soroban Guardrail, an open-source contract doctor for Soroban smart contracts.

The client demonstrates the product experience contributors will build toward:

- deployment readiness score,
- severity-based findings,
- selected rule explanation,
- suggested Rust/Soroban fix snippets,
- CI copy flow for GitHub Actions.

## Run

```powershell
npm install
npm run build
npm start
```

The preview server listens on `http://localhost:5173`.

## Wave-ready contributor tracks

- Add more scanner report states to the UI.
- Improve responsive dashboard behavior.
- Add upload/paste contract entry points.
- Convert scanner demo data into typed fixtures.
- Add visual regression or smoke tests.
