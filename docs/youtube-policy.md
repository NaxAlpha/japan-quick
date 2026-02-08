# YouTube Content Policy Baseline for Japan Quick

Verified on: February 8, 2026 (UTC)
Owner: Pipeline Policy Checks (`script_light`, `asset_strong`)

## 1. Purpose

This document defines how Japan Quick classifies generated content for YouTube safety.

Status outputs:
- `CLEAN`: no policy findings that require warning or restriction.
- `WARN`: low-risk issue; upload can proceed as private with warning details.
- `REVIEW`: medium-risk issue; upload can proceed as private with review details.
- `BLOCK`: high-risk issue; upload is not allowed.

These statuses are derived from individual checks where each check returns one of:
- `PASS`
- `WARN`
- `REVIEW`
- `BLOCK`

## 2. Enforcement model in this project

Pipeline policy stages:
- `script_light` (Gemini 3 Flash): evaluate article + script text before asset generation.
- `asset_strong` (Gemini 3 Pro): evaluate article + script + generated images after asset generation.

Upload behavior:
- `CLEAN`: auto-upload with YouTube privacy set to `public`.
- `WARN`: auto-upload with YouTube privacy set to `private` and warning context retained.
- `REVIEW`: auto-upload with YouTube privacy set to `private` and review context retained.
- `BLOCK`: no upload; set upload status to blocked with explicit reasons.

## 3. Rule mapping by category

### 3.1 Deceptive practices and spam

Source category:
- YouTube spam, deceptive practices, and scams policy.

Local checks:
- Misleading certainty in titles/thumbnails versus article facts.
- Clickbait framing that materially conflicts with source evidence.
- Repetitive/templated low-value narrative structures.

Decision guidance:
- `BLOCK`: fabricated claim presented as fact.
- `REVIEW`: substantial mismatch between claim and source certainty.
- `WARN`: borderline sensational framing without direct fabrication.

### 3.2 Misinformation (election / medical / major civic harm)

Source category:
- YouTube misinformation policy, election misinformation policy, medical misinformation policy.

Local checks:
- Election process misrepresentation.
- Unsupported medical/public-safety directives.
- Confident factual claims not grounded in provided articles.

Decision guidance:
- `BLOCK`: prohibited misinformation pattern (election fraud certainty, harmful medical falsehood, etc.).
- `REVIEW`: sensitive claim stated with insufficient source grounding.
- `WARN`: imprecise wording that needs softer uncertainty framing.

### 3.3 Harmful and violent content

Source category:
- Harmful/dangerous, violent/graphic, suicide/self-harm policy pages.

Local checks:
- Graphic depictions or instructions.
- Glorification of harm/violence.
- Self-harm normalizing or encouraging language.

Decision guidance:
- `BLOCK`: graphic or instructional harmful content.
- `REVIEW`: potentially distressing depictions requiring human review.
- `WARN`: non-graphic but high-intensity framing requiring tone reduction.

### 3.4 Hate, harassment, abusive targeting

Source category:
- Hate speech and harassment/cyberbullying policy pages.

Local checks:
- Protected-group attacks.
- Dehumanizing framing.
- Targeted harassment language.

Decision guidance:
- `BLOCK`: direct hate/harassment violations.
- `REVIEW`: ambiguous hostile framing around protected groups.
- `WARN`: language with avoidable antagonistic framing.

### 3.5 Child safety

Source category:
- Child safety policy.

Local checks:
- Sexualized depiction of minors.
- Exploitative framing involving minors.

Decision guidance:
- `BLOCK`: any exploitative sexualized minor context.
- `REVIEW`: ambiguous age-sensitive depiction.

### 3.6 Manipulated / synthetic media disclosure

Source category:
- Altered or synthetic content policy.

Local checks:
- Synthetic disclosure consistency with generated workflow.
- Misleading presentation of synthetic visuals as literal footage.

Decision guidance:
- `REVIEW`: unclear contextual framing.
- `WARN`: minor disclosure inconsistency.
- `BLOCK`: intentionally deceptive synthetic framing.

### 3.7 Thumbnail and metadata integrity

Source category:
- YouTube thumbnail policy and metadata anti-deception guidance.

Local checks:
- Misleading thumbnail text/image mismatch.
- Forbidden branding/CTA artifacts in generated imagery:
  - subscribe button motifs
  - social icon overlays
  - channel logo/watermark inserts

Decision guidance:
- `BLOCK`: knowingly deceptive thumbnail claim.
- `REVIEW`: strong mismatch between thumbnail implication and content.
- `WARN`: branding/CTA clutter that should be removed.

### 3.8 Monetization risk (inauthentic content)

Source category:
- YouTube Partner Program monetization policies.
- Update noted by YouTube as of July 15, 2025 replacing "repetitious content" phrasing with "inauthentic content" terminology.

Local checks:
- Over-reused script structures with low novelty.
- Excessive template reuse that reduces originality signals.

Decision guidance:
- `REVIEW`: repeated low-originality pattern likely to reduce monetization eligibility.
- `WARN`: mild template overuse.

## 4. Stage-specific expectations

### 4.1 Script stage (`script_light`)

Inputs:
- selected articles
- generated script JSON

Must detect:
- unsupported sensitive claims
- hate/harassment patterns in text
- harmful/violent language concerns
- clickbait/deceptive metadata language

Gate:
- `BLOCK` halts progression to asset generation.

### 4.2 Asset stage (`asset_strong`)

Inputs:
- selected articles
- generated script JSON
- generated images (slide images and thumbnail)

Must detect:
- visual policy risks (graphic, hateful, deceptive, manipulative)
- branding/CTA artifacts in image outputs
- thumbnail mismatch and sensational abuse patterns

Gate:
- overall `BLOCK` halts progression to render/upload.

## 5. Source references

Primary YouTube help pages used for this baseline:
- Community Guidelines overview: https://support.google.com/youtube/answer/9288567
- Spam, deceptive practices, scams: https://support.google.com/youtube/answer/2801973
- Misinformation policies: https://support.google.com/youtube/answer/10834785
- Election misinformation: https://support.google.com/youtube/answer/10835034
- Medical misinformation: https://support.google.com/youtube/answer/13813322
- Harmful or dangerous content: https://support.google.com/youtube/answer/2801964
- Violent or graphic content: https://support.google.com/youtube/answer/2802008
- Hate speech: https://support.google.com/youtube/answer/2801939
- Harassment and cyberbullying: https://support.google.com/youtube/answer/2802268
- Child safety: https://support.google.com/youtube/answer/2801999
- Altered or synthetic content disclosures: https://support.google.com/youtube/answer/14328491
- Thumbnails policy: https://support.google.com/youtube/answer/9229980
- External links policy: https://support.google.com/youtube/answer/9054257
- Channel/account terminations: https://support.google.com/youtube/answer/2802168
- YouTube Partner Program monetization policies: https://support.google.com/youtube/answer/1311392

## 6. Operating notes

- This file defines policy intent and severity mapping.
- Machine-readable rules are maintained in `src/policy/youtube-policy-rules.ts`.
- Prompts and policy checkers should consume the machine-readable ruleset, not duplicate policy text.
