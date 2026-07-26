# AI Creator Index query schema

The snapshot contains five top-level collections:

- `creators`: identity, description, topics, `platform_accounts[]`, and a dated statistics snapshot.
- `posts`: platform-neutral original ID/URL, format, publication date, dated metrics, topics, and selection reason.
- `mentions`: a normalized product, podcast, article, person, paper, event, open-source project, prompt, workflow, or platform. Each mention links to existing posts and sources.
- `sources`: original URL, source type, evidence grade, verification status, last verification date, and note.
- `rankings`: named ordered lists of post IDs, currently `recent_92_days` and `historical`.

Evidence grades:

- `A`: original program, official page, original repository, official event record, or a claim directly present in the original post.
- `B`: the event is verified, but the specific claim or cause remains a retelling or secondary report.
- `C`: only the creator post or attachment is known; no stable public original source was found.

Verification status is one of `已验证`, `部分验证`, or `未解决`.
