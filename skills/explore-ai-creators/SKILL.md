---
name: explore-ai-creators
description: Query the public AI Creator Index for creators, representative posts, products, podcasts, articles, open-source projects, topics, original links, evidence grades, verification status, and recent or historical popularity. Use when a user asks what a tracked creator mentioned, requests only A-grade sources, wants recent themes or high-heat content, or needs traceable source links without logging in or scraping platforms.
---

# Explore AI Creators

Use the bundled query script as the source of truth. Do not infer missing creators, links, evidence grades, or verification results.

## Workflow

1. Translate the request into filters:
   - creator name or ID
   - mention type such as `podcast`, `product`, `open_source`, `paper`, or `event`
   - topic or free-text query
   - evidence grade `A`, `B`, or `C`
   - period `recent` or `historical`
2. Run:

```bash
node scripts/query.mjs --creator "小盖" --type podcast
```

3. Add filters only when the user asks:

```bash
node scripts/query.mjs --creator "小盖" --grade A --type open_source
node scripts/query.mjs --creator "小盖" --period recent --query "Agent"
node scripts/query.mjs --creator "小盖" --ranking recent
```

4. Return the matching item, its linked post, original source URL, evidence grade, verification status, and last verification date.
5. State `未解决` when a C-grade item has no stable source. Never create a plausible replacement URL.

## Version and offline behavior

- Run `node scripts/query.mjs --status` when freshness matters.
- Run `node scripts/query.mjs --refresh` to check the GitHub manifest and update the local cache.
- If the remote manifest is not configured or the network is unavailable, use `references/snapshot.json` and explicitly label the answer as an installation snapshot.
- Verify downloaded data against the manifest SHA256 before caching it.

## Boundaries

- Read and query only.
- Do not log in, scrape, publish, or modify Xiaohongshu or other platforms.
- Do not imitate a creator's style.
- Treat evidence grade as source-chain completeness, not proof that an opinion is correct.
- Read [references/schema.md](references/schema.md) only when field meanings or evidence rules are needed.
