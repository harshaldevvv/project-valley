# AI asset API pricing and budgets (researched 2026-10-16)

Prices come from the official pricing pages on that date. **[inferred]** marks our own estimates. Re-check the terms before spending real money.

## Tripo 3D API

### Billing and limits
- Pay-as-you-go at **$0.01 per credit**. Top-ups start at $1; presets are $50, $100 and $250. There is no API subscription.
- New accounts get 300 free credits, valid for 2 weeks.
- **API V2 shuts down on 2026-11-01.** Use V3.
- Rate limit: 10 concurrent generations, 5 on the P1 model.

### Credit costs

| Operation | H2/H3 models | P1 model |
|---|---|---|
| Text-to-3D, untextured / textured | 10 / 20 | 30 / 40 |
| Image-to-3D or multiview, untextured / textured | 20 / 30 | 40 / 50 |
| HD texture | +20 | +20 |
| Smart low-poly option (at generation) | +10 | — |
| Smart low-poly (post-process) | 30 | 30 |
| Auto-rig | 25 | 25 |
| Animation retarget | 10 per animation | 10 per animation |
| Format conversion | 5 | 5 |
| Retopology | 10–40 | 10–40 |
| Smart UV | 20 | 20 |

### Commercial rights
- **Commercial rights need paid credits.** Assets from free or trial credits fall under CC BY or are retained by Tripo, so never ship trial-credit assets.

## Google Gemini image API

- **No free API tier for images.** Free use exists only interactively in AI Studio.
- All outputs carry an invisible **SynthID watermark**. That doesn't matter for concept and reference images.

| Model | Price per 1K image | Batch API (50% off) |
|---|---|---|
| Nano Banana 2.1 | $0.034 | $0.017 |
| Nano Banana 2 | $0.067 | $0.034 |
| Nano Banana Pro (2K) | $0.134 | $0.067 |

## ElevenLabs

### Plans

| Plan | Price per month | Credits | Commercial use |
|---|---|---|---|
| Free | $0 | 10k | No |
| Starter | $6 | 30k | Yes |
| Creator | $22 ($11 for the first month) | 121k | Yes |
| Pro | $99 | 600k | Yes |
| Scale | $299 | 1.8M | Yes |

### Credit costs
- **Sound effects:** 200 credits per generation.
- **Music:** 900 credits per minute.
- **Text-to-speech:** about 1 credit per character, and about half that on the Flash model.
- **[inferred]** Content generated while subscribed stays licensed after you cancel. Verify this before relying on it.

## Budgets

| Scenario | Content | Tripo | Gemini | ElevenLabs | Realistic total | Upper limit |
|---|---|---|---|---|---|---|
| **A (lean)** | 60 hero models, 10 rigged characters, 150 images, 300 SFX, 15 tracks, 200 voice lines | $50–120 | $3–40 | $33 (Creator × 2 months) | **~$140** | **~$260** |
| **B (heavy)** | 300 models, 30 rigged characters, 600 images, 800 SFX, 40 tracks, 1000 voice lines | $320–760 | $10–160 | $121 (Pro + Creator) | **$450–800** | **~$1,220** |

These are one-off costs, not monthly. Most of the game's thousands of objects are built by code in Blender for $0, because modular kits, props, buildings and foliage are procedural. AI is only for the hero assets.

### Cost levers
- **Tripo** is 60–75% of the spend.
  - Filter concept art cheaply in Gemini Batch before paying for 3D.
  - Use the H3 model for props.
  - Use the +10 low-poly option rather than the 30-credit post-process.
- **Bulk SFX** from CC0 sources (Sonniss GDC bundles, Freesound CC0, Kenney) can cut the ElevenLabs bill by 50–80%.

## Local or free alternatives

Our RTX 3050 Ti has 4 GB of VRAM, which is too small for most of these:

| Option | VRAM needed | Verdict on our GPU |
|---|---|---|
| Hunyuan3D 2.1 | ~10 GB for shape, ~29 GB with texture | No |
| Hunyuan3D 2mini | ~5–6 GB, shape only | Borderline |
| Stable Audio Open | — | Unlikely to fit |
| SD 1.5 | — | Fits, but slow |
| SDXL / Flux | — | Very slow |

None of these beats Gemini's $0.02–0.03 per image once you count the time. Long runs would also heat the laptop.

## Sources
- developers.tripo3d.ai/en/pricing
- docs.tripo3d.ai/get-started/pricing.html
- docs.tripo3d.ai/get-started/rate-limits.html
- tripo3d.ai/terms
- tripo3d.ai/blog/commercial-use-ai-3d-models
- ai.google.dev/gemini-api/docs/pricing
- elevenlabs.io/pricing
- elevenlabs.io/pricing/api
- support.google.com/gemini/answer/16722517
