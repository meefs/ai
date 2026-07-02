---
"workers-ai-provider": patch
---

fix: route native unified-billing catalog slugs (e.g. `deepseek/deepseek-v4-pro`) through the run path

`workers-ai-provider@3.2.x` began treating any `"<vendor>/<model>"` id as a third-party AI Gateway catalog slug. This regressed models like `deepseek/deepseek-v4-pro` that Cloudflare serves natively on the unified-billing run path (`env.AI.run`): without `providers` the provider threw at construction, and with `providers: [openai]` it routed to the gateway universal `chat/completions` (BYOK) endpoint and returned auth errors.

`deepseek/*` is now on the unified run catalog (defaults to `env.AI.run`), matching pre-3.2 behavior. Unified-billing eligibility is decided per-model by Cloudflare's catalog, so BYOK-only deepseek models (e.g. `deepseek/deepseek-chat`) still work by opting into the gateway path per call (`transport: "gateway"` / `byok`). The rest of the OpenAI-wire long tail (`mistral`, `perplexity`, `cerebras`, `openrouter`, `fireworks`) is not on Cloudflare's unified run catalog — `env.AI.run` returns model-not-found for those — so they remain BYOK gateway-path providers.

When no `providers` are configured, a bare `"<vendor>/<model>"` id is now routed through the same hardened run path as `dynamic/*` routes: the gateway defaults to the account's `"default"` gateway (third-party unified billing needs one), `cacheTtl`/`skipCache`/`metadata`/`collectLog` are applied to the gateway options, and delegate-only options (`byok`, `transport: "gateway"`, `fallback`, `resume`, resume callbacks) now throw a clear error instead of being silently dropped.
