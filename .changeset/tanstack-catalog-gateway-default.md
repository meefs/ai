---
"@cloudflare/tanstack-ai": patch
---

fix: default third-party catalog slugs to the account gateway on the Workers AI binding path

`createWorkersAiChat` in plain binding mode (`{ binding: env.AI }`, no `gateway`) called `env.AI.run(model, inputs)` with no gateway. That works for `@cf/*` models, but third-party `"<vendor>/<model>"` unified-billing catalog slugs (e.g. `deepseek/deepseek-v4-pro`) must route through an AI Gateway, so they never engaged unified billing.

The binding shim now detects a non-`@cf`/non-`dynamic` catalog slug and defaults it to the account `"default"` gateway (an explicitly configured `gateway` still wins). `@cf/*` and `dynamic/*` models keep the plain binding path unchanged. Resume only engages when a gateway was explicitly configured — the catalog auto-default is a routing concern, not a resume opt-in.
