Source: https://docs.netlify.com/build/environment-variables/overview/
Source: https://docs.netlify.com/build/functions/environment-variables/
Source: https://docs.netlify.com/manage/security/secure-access-to-sites/rate-limiting/
Retrieved: 2026-11-26

# Environment variables and rate limiting

## 1. Environment variable scopes

| Scope | Covers |
|---|---|
| Builds | site builds, framework and function builds |
| Functions | Functions, Edge Functions, Netlify Server, On-demand Builders - "securely provide sensitive values ... such as API keys and tokens" |
| Runtime | forms and signed proxy redirects |
| Post processing | snippet injection |

- "On the Pro plan and above, you can set specific scopes for your environment variables." On lower plans a variable is in all scopes (inferred; unconfirmed wording). **Our design asks for Functions-only secrets, so it assumes Pro or higher** - flag to the owner.
- A variable must include the Functions scope to be visible to functions at runtime.

## 2. Deploy contexts for values

`Production`, `Deploy Previews`, `Branch deploys` (with per-`Branch` overrides or prefix match), `Preview server`, `Local development` (Netlify CLI).

## 3. Where variables can be set

- Netlify UI, CLI or API: available to functions.
- `netlify.toml`: available to builds and snippet injection **but not to Functions** ("environment variables declared in a Netlify configuration file (`netlify.toml`) are not available to serverless functions").
- Consequence: no secret and no function config value may live in `netlify.toml`. Non-secret function settings (`GITHUB_REPO`, `DAILY_TOKEN_BUDGET`) must also be set in the UI/CLI.

## 4. Secret values

- Mark a variable "Contains secret values" for "additional access restrictions and security features" (Secrets Controller). Details such as log masking and secret scanning are described on the linked Secrets Controller page (unconfirmed on the overview page itself).

## 5. Reading and size

- Documented in functions: `process.env.VARIABLE_NAME`.
- "If you're using Lambda compatibility mode, AWS's environment property limits apply: the total size of all environment variables cannot exceed 4 KB." The overview says values "should fall within AWS's environment property limits".
- Keep secrets few and short; a scrypt hash, an HMAC key, a Claude key and a GitHub token fit easily.

## 6. Rate limiting

Availability: "Basic functionality is available on all plans. Full functionality is available on Enterprise plans with High-Performance Edge."

```js
export const config = {
  path: "/api/agent-chat",
  rateLimit: {
    windowLimit: 20,   // requests per window
    windowSize: 60,    // seconds; "Maximum is 180."
    aggregateBy: ["ip", "domain"],
    // action: "rewrite", to: "/rate_limited.html"   // default is block with 429
  },
};
```

- Aggregation: per domain and IP, or per domain. The doc's example marks `aggregateBy: ["domain"]` as an "enterprise feature: enforce fair shared limit between all clients". Use `["ip", "domain"]`.
- Action: block (HTTP **429**) or rewrite to another path.
- "rate limits for functions cannot be defined in the `netlify.toml` configuration file."

### Rule count per project (important)

| Plan | Rules per project |
|---|---|
| Free (credit-based or legacy) / Starter / Personal | **2** |
| Pro (credit-based or legacy) / Enterprise | **5** |
| Enterprise with HP Edge | 100 |

**Design conflict:** docs/04-agent-console.md section 6 and the `rate-limiting-cost-guards` skill put a `rateLimit` on about 8 endpoints. That exceeds the 2 or 5 rules allowed per project (assuming each function's `rateLimit` counts as one rule - unconfirmed, but the most natural reading). Options:

| Option | Cost | Notes |
|---|---|---|
| A. Platform limits only on the riskiest endpoints (Pro: login, agent-chat, agent-job, proposal-approve, one spare) + Blobs counters for the rest | Small code in `lib/ratelimit.mjs` | Recommended; counters already exist for budgets |
| B. One path-pattern rule covering `/api/*` | One rule | Same limit for polling and login; too coarse |
| C. Enterprise plan | Money | Not justified for a hobby, non-commercial app |

Needs an owner decision and an ADR; route to `security-engineer` and `netlify-engineer`.

## 7. Cost guards that are not Netlify features

Per-day token budget, max tool rounds, `max_tokens`, login lockout: all implemented in our code with Blobs counters (see `rate-limiting-cost-guards` skill).
