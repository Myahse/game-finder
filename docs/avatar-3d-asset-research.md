# 3D avatar asset research (Phase 1–2)

**Date:** 2026-03-23  
**Goal:** Replace hand-drawn SVG humans with **professional 3D assets** + **existing `PlayerAvatarConfig` JSON**.  
**Out of scope:** Ready Player Me (platform shut down Jan 31, 2026).

---

## Evaluation criteria

| Criterion | Notes |
|-----------|--------|
| Visual quality | Must look good *before* customization (sports / mobile-game bar) |
| Web | WebGL / glTF / VRM in browser |
| Mobile | Flutter: `model_viewer`, native GLB, or shared asset CDN |
| Customization | Hair, clothes, morphs, modular meshes |
| Commercial license | Bundle in commercial app, modify, serve from our infra |
| Redistribution | Can we ship GLBs in `public/avatar/` or only embed? |
| API vs assets | SDK (user-generated) vs owned asset library |

**License checklist (per candidate):**

- Commercial use?  
- Modification allowed?  
- Redistribution / bundling in app?  
- User customization / derivative clothing?  
- Attribution required?  
- Serve from our servers?

---

## Option A — Avatar SDKs / platforms

### 1. MetaPerson (Avatar SDK) — **Active**

| | |
|--|--|
| **Status** | Active; positioned as RPM replacement ([avatarsdk.com](https://avatarsdk.com/ready-player-me-alternative/)) |
| **Web** | iframe + JS API; GLB/glTF/FBX export ([docs](https://docs.metaperson.avatarsdk.com/js_api/)) |
| **Mobile** | Unity / Unreal / iOS / Android SDKs; Cloud API + on-prem “Local Compute” |
| **Customization** | Haircuts, split outfits (top/bottom/shoes), glasses, blendshapes ([REST API](https://docs.metaperson.avatarsdk.com/rest_api/)) |
| **Pricing** | Consumer creator credits; **Enterprise** for REST API / deep integration |
| **License** | **Commercial / Enterprise license required** for production API; terms per contract — not “drop GLB in repo” by default |

| Commercial | Modify | Bundle GLB | User custom | Attribution | Our CDN |
|------------|--------|------------|-------------|-------------|---------|
| Enterprise | Yes (export) | Embed in app; verify contract | Yes (creator) | Per contract | Yes with license |

**Fit:** Strong for **selfie → avatar** pipelines, less like a fixed **sports roster** unless you author outfits in their pipeline. Good if product vision is “scan your face, wear our kits.”

---

### 2. Avaturn — **Active**

| | |
|--|--|
| **Status** | Active ([avaturn.me](https://avaturn.me/pricing)) |
| **Web** | WebSDK (`cdn.avaturn.live`), session tokens; GLB/FBX/USDZ ([GitBook](https://avaturn.gitbook.io/avaturn-integration/)) |
| **Mobile** | Unity, Unreal, Android, iOS docs |
| **Customization** | Body, clothes, hair, glasses; ARKit blendshapes; custom garments on PRO |
| **Pricing** | **PRO ~$800/mo** (1k avatars/mo + API); free tier for limited integration |

| Commercial | Modify | Bundle GLB | User custom | Attribution | Our CDN |
|------------|--------|------------|-------------|-------------|---------|
| Developers program | Yes | GLB to your app; **verify dev T&C** | Yes | Per agreement | Serve exported GLB |

**Fit:** High-quality **realistic** humans; cost at scale. Sports-specific modular wardrobe needs **custom garments** upload (supported on PRO).

---

### 3. VRoid / VRM ecosystem — **Active (open format)**

| | |
|--|--|
| **Status** | VRM 1.0 spec; `@pixiv/three-vrm` maintained |
| **Web** | three.js + `@pixiv/three-vrm` |
| **Mobile** | UniVRM (Unity), native GLB/VRM loaders |
| **Customization** | Modular **trait** VRMs (hair, shirt, pants) merged via tools like [Character Studio](https://hackmd.io/@PLs0nuZZRwSgxLfjMgJUQg/r1u3py1Sa) |
| **License** | **Per-model** on VRoid Hub — corporate commercial + redistribution flags vary ([FAQ](https://vroid.pixiv.help/hc/en-us/articles/360014192953)) |

| Commercial | Modify | Bundle GLB | User custom | Attribution | Our CDN |
|------------|--------|------------|-------------|-------------|---------|
| **Per avatar** | Often yes | **Only if redistribution allowed** | Yes with trait pipeline | Per model | Yes if license allows |

**Fit:** Best **open pipeline** for modular hair/clothes **if we own or commission trait VRMs** with CC0/commercial license. **Do not** scrape random Hub models.

---

### 4. Genies / in3D / Wolf3D

Not fully re-verified in this pass. Treat as **verify before shortlist** — several consumer avatar apps pivoted or require B2B sales. **Do not assume** web GLB export without current docs.

---

### 5. Adobe Mixamo — **Active (animations + characters)**

| | |
|--|--|
| **Use** | Rigged humanoids + animations |
| **Formats** | FBX → convert to GLB |
| **License** | Commercial use in **embedded** games OK; **do not redistribute raw files** as downloadable assets ([Adobe community FAQ](https://community.adobe.com/questions-696/mixamo-faq-licensing-royalties-ownership-eula-and-tos-589400)) |

| Commercial | Modify | Bundle GLB | User custom | Attribution | Our CDN |
|------------|--------|------------|-------------|-------------|---------|
| Yes (in game) | Yes | **Embedded only** — not asset store | Limited (swap skins manually) | No | Ship inside app binary |

**Fit:** Prototype animations / placeholder rig — **not** Bitmoji-quality base mesh; visual bar usually too generic.

---

## Option B — Purchasable / open asset packs

### 6. ThreeDee — Cartoon Sports Gym Fitness Man

| | |
|--|--|
| **Quality** | Stylized athletic; rigged; **GLB included** ([product page](https://www.threedee.design/products/3d-models/cartoon-sports-gym-fitness-man/)) |
| **Modular** | Single character + gym props — **not** full hair/jersey swap library OOTB |
| **License** | **Royalty-free commercial** (read ThreeDee license PDF before purchase) |

| Commercial | Modify | Bundle GLB | User custom | Attribution | Our CDN |
|------------|--------|------------|-------------|-------------|---------|
| Yes (paid) | Yes (Blender source) | Yes in app | Requires art pipeline | Check license | Yes |

**Fit:** Strong **Phase 3 test** candidate for “one good athlete in Three.js” while building modular pipeline.

---

### 7. Sketchfab — “Mini Modular Character | Sports” (joaobaltieri)

| | |
|--|--|
| **Quality** | Low-poly stylized; **modular** hair, shirts, shorts, shoes ([store](https://sketchfab.com/3d-models/mini-modular-character-sports-cf591699d6a84ff3a5619fce4a62daeb)) |
| **License** | **Royalty-free purchase** — verify Sketchfab Standard vs editorial |

| Commercial | Modify | Bundle GLB | User custom | Attribution | Our CDN |
|------------|--------|------------|-------------|-------------|---------|
| Yes (RF purchase) | Yes | Yes if RF | Maps well to our registry IDs | Usually no | Yes |

**Fit:** Closest **off-the-shelf** match to desired folder structure (`hair/`, `tops/`, …). **Recommended to purchase + legal review** before production.

---

### 8. Quaternius — Ultimate Animated Character Pack

| | |
|--|--|
| **License** | **CC0** (pack page; newer packs may use QAL — read per pack) |
| **Formats** | FBX/OBJ/Blend — **not GLB**; convert in Blender |
| **Modular** | 50+ separate characters — **not** one base + swap parts |

| Commercial | Modify | Bundle GLB | User custom | Attribution | Our CDN |
|------------|--------|------------|-------------|-------------|---------|
| Yes | Yes | Yes | Poor fit for creator | No | Yes |

**Fit:** Free prototypes only — **visual bar too low-poly / inconsistent** for “premium sports identity.”

---

### 9. Polygonal Mind “100 Avatars” / VTubeMe CC0 stylized

| | |
|--|--|
| **License** | **CC0** (300 stylized) / CC BY for some ([vtubeme](https://vtubeme.com/free-vrm-avatars)) |
| **Formats** | VRM + some GLB |
| **Modular** | No — individual avatars |

**Fit:** VTuber style; check each for **athletic** look; OK for tech spike, not unified sports roster.

---

### 10. glTF avatar composition (open source pattern)

[johnsuperdev702/gltf-avatar-threejs](https://github.com/johnsuperdev702/gltf-avatar-threejs) — shared skeleton, swappable skins, visibility masks, bake to GLB.

**Fit:** **Architecture reference** for our `assetManifest` + Three.js loader — aligns with Option B modular packs once base rig is chosen.

---

## Shortlist (Phase 2)

| Rank | Approach | Why |
|------|----------|-----|
| **1** | **Owned modular GLB library** (e.g. Sketchfab Sports modular or commissioned rig) + Three.js + existing JSON | Matches product (sports kits, hair IDs), full control, bundle license |
| **2** | **VRM trait pipeline** (commission base + hair/jersey VRMs, `@pixiv/three-vrm`) | Same modularity; better anime/stylized; Flutter via UniVRM or GLB export |
| **3** | **MetaPerson / Avaturn Enterprise** | If roadmap is **user likeness** first; higher cost; sports wardrobe is secondary |

**Not shortlisted for production art:** hand-coded SVG, DiceBear, Quaternius-only, Mixamo-as-final-art.

---

## Recommended asset layout (repo)

```
web/public/avatar/
  base/male-athletic.glb          # rigged humanoid (A/T-pose)
  hair/{registry-id}.glb
  tops/{registry-id}.glb
  bottoms/{registry-id}.glb
  shoes/{registry-id}.glb
  accessories/{registry-id}.glb
  equipment/{registry-id}.glb
  LICENSES.md                     # per-file license record
```

**Do not commit** unlicensed downloads. `LICENSES.md` must cite purchase receipt / CC0 snapshot URL / contract ID.

---

## Phase 3 — Next engineering steps (in repo)

1. `ThreePlayerAvatarRenderer` + `PlayerAvatar3D` (react-three-fiber).  
2. `glb/assetManifest.ts` maps `PlayerAvatarConfig` → URLs + `available: boolean`.  
3. Studio preview: 3D when `VITE_AVATAR_RENDERER=glb`, else legacy SVG.  
4. Missing asset → **“Asset coming soon”** (no new SVG placeholders).  
5. Purchase/commission **one** base + basketball kit; drop GLBs; wire manifest.  
6. Flutter: load same manifest URLs via `model_viewer_plus` or shared WebView preview (Phase 4+).

---

## Height / body type (renderer rules)

- Do **not** `scale.set(s,s,s)` on root for height.  
- Prefer: morph targets (`height`, `shoulderWidth`, …) if present on asset.  
- Else: scale **leg bones** or lower-body group only (document per rig).  
- `bodyType` → morph or preset mapping in manifest.

---

## References

- MetaPerson Web: https://docs.metaperson.avatarsdk.com/web_integration/  
- Avaturn integration: https://avaturn.gitbook.io/avaturn-integration/  
- three-vrm: https://github.com/pixiv/three-vrm  
- VRoid commercial use: https://vroid.pixiv.help/hc/en-us/articles/360014192953  
- Mixamo FAQ (embedding): https://community.adobe.com/questions-696/mixamo-faq-licensing-royalties-ownership-eula-and-tos-589400  
