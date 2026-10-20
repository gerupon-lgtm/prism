# 6面テーマの追加画像（2026-10-21）

制作は組込みの画像生成ツールを使用。既存の`public/graphics/starwalk.png`を画風参照とし、深い青の星空・白い石造り・淡い金色・静謐さを継承した。参照画像そのものの置換はしていない。背景は1672×941px、鏡は1280×1280pxの透明PNG。採用前に出力画像を確認し、ゲーム内の重ね合わせは今回の表示検証で別に確認する。

| 配信ファイル | 使用面・テーマ | 生成元（Codexの生成画像保存先内） |
|---|---|---|
| `public/graphics/starreturn.png` | 25〜30／星環の帰廊 | `exec-957783fb-44fb-4b76-a5ca-c7d1508a6284.png` |
| `public/graphics/moonmirror.png` | 31〜36／月鏡の静殿 | `exec-a3efd479-c786-4074-b776-86628041dd83.png` |
| `public/graphics/stargate.png` | 37〜42／星刻の開廊 | `exec-bedd0843-813b-419e-be8e-a6244b81f1f9.png` |
| `public/graphics/mirror.png` | 鏡のパーツ・説明 | `exec-13ce71bc-bd61-40df-afb7-8aec47879654.png` |

星環の初回案は既存背景との差が弱かったため採用せず、円形回廊を明確にする指示で再生成した。中央の配線領域を空け、周辺と下側の建築で各セットの違いを表す。スマホの中央切抜きとPCの横長の両方を確認する。

## 最終生成指示

### 星環の帰廊（初回案への編集）

Use case: precise-object-edit. Edit this background into a DISTINCT new location for the 'return to the star' theme. Keep the quality, deep indigo star sky, realistic white marble, soft lavender clouds and pale gold lighting. CHANGE THE ARCHITECTURE AND COMPOSITION: replace the scattered islands with ONE graceful broken circular marble cloister, a continuous broad curving arcade wrapping from bottom left around the lower edge and rising at the right, like a circular return route viewed from a high oblique perspective. In the lower quarter show the curve of the ring and several elegant columns clearly, with another broken continuation at far upper left. Keep most of the upper and central area as quiet dark empty star sky. It must read as a circular returning path, not the previous scattered floating islands. This is final beautiful game background art; preserve no text, no characters, no prisms, no bells, no UI, no literal diagram lines. Wide16:9. A centered portrait crop must show the circular lower arcade and open sky.

### 月鏡の静殿

Use case: stylized-concept. Create a NEW finished game background for Prism Notes, six-level theme '月鏡の静殿' / palace of moon reflections. Input reference is STYLE ONLY: match refined painterly-realistic fantasy, deep navy blue sky, softly glowing white marble and pale gold details, serene beauty. New subject and composition: an ancient elegant white marble palace with tall silver-framed architectural mirrors and a perfectly still dark reflecting pool floating above clouds; a pale crescent moon reflected below, faint restrained rainbow caustics only on peripheral stone. Architectural forms frame far left/right edges, with a beautiful curved water terrace in the lower quarter. The central 65% is quiet dark blue star sky/low-contrast reflection, spacious and uncluttered for overlaying puzzle routes. Wide16:9 final art, sophisticated detailed stonework and atmospheric depth, not wireframe. Centered portrait crop must retain the moonlit reflecting terrace and subtle mirror silhouettes near its side edges. No characters, no game nodes, no prisms, no bells, no route lines, no readable text, no UI, no logos, no watermark. This must be a distinct location from floating islands and from the circular return cloister.

### 星刻の開廊

Use case: stylized-concept. Create a distinct finished wide16:9 background for the serene fantasy light-routing game Prism Notes. Theme: '星刻の開廊' / cloister of star cycles, for six levels with periodically opening prisms. Reference image only establishes visual style: rich deep indigo star sky, painterly realistic white marble ruins, lavender clouds, restrained pale gold light. NEW scene: a grand ancient celestial gate at the far right and a smaller matching gate at the far left, their white marble arcs containing subtle concentric astronomical orrery rings and softly lit aperture-like stone shutters. Tiny pale-gold light points suggest a slow cycle, no modern clock or numerals. A low semicircular marble stair and luminous cloud sea along the bottom. The central65% must be spacious, dark, low contrast, free of buildings, with a few delicate stars for graph puzzle overlay. Luxurious fine architectural detail at peripheral edges and bottom only. Centered portrait crop keeps cloud sea and curved celestial terrace while side cropped gates can remain hinted. Match calm beautiful established visual language, no sci-fi machinery, no characters, no game pieces, no prisms, no bells, no wires, no text, no logos, no watermark. Clearly different from circular return cloister and mirror-water palace.

### 鏡のパーツ

Use case: stylized-concept. Asset type: one transparent PNG game-piece sprite for Prism Notes, a light-reflecting MIRROR. Existing prism image is STYLE REFERENCE ONLY, not edit target. Create ONE elegant small celestial mirror on a very restrained white marble and pale gold swivel mount, centered isolated with generous transparent padding. Front three-quarter view, slightly tilted diamond/oval silver glass face with a subtle soft blue reflected star and a tiny restrained rainbow edge. It must be recognizable as a MIRROR, visibly different from the triangular prism, at only55px display. Richly rendered painterly realistic materials and fine gold detail matching the reference, luminous but sophisticated, strong clean silhouette, substantial solid object rather than wireframe, avoid an ornate cluttered pedestal. Keep mostly oval silver-blue reflection surface clear so a white single letter can be overlaid by code. No text, no character, no scene, no background, no extra objects, no UI, no logo, no watermark. Actual transparent background.
