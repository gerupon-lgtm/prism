"""Draw a static layout proposal; this is not application code."""

from pathlib import Path
from math import hypot
from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).parent / "画面配置案_v0.2.png"
im = Image.new("RGB", (1680, 1060), "#f1f3f5")
d = ImageDraw.Draw(im)
INK = "#25313c"
MUTED = "#64717e"
LINE = "#c9d0d7"
fonts = {}


def font(size):
    if size not in fonts:
        fonts[size] = ImageFont.truetype("C:/Windows/Fonts/meiryo.ttc", size)
    return fonts[size]


def text(x, y, label, size=20, color=INK):
    d.text((x, y), label, font=font(size), fill=color)


def box(bounds, fill="white", outline=LINE, radius=12):
    d.rounded_rectangle(bounds, radius, fill=fill, outline=outline, width=2)


def center(bounds, label, size=19, color=INK):
    x1, y1, x2, y2 = bounds
    length = d.textlength(label, font=font(size))
    assert length < x2 - x1 - 8, label
    text((x1 + x2 - length) / 2, (y1 + y2) / 2 - size * 0.7, label, size, color)


def button(bounds, label, size=18):
    box(bounds, fill="#fafbfc", radius=7)
    center(bounds, label, size)


def arrow(a, b, radius):
    dx, dy = b[0] - a[0], b[1] - a[1]
    length = hypot(dx, dy)
    ux, uy = dx / length, dy / length
    start = (a[0] + radius * ux, a[1] + radius * uy)
    end = (b[0] - radius * ux, b[1] - radius * uy)
    d.line((start, end), fill="#8f9ba6", width=3)
    tip = (end[0] - 11 * ux, end[1] - 11 * uy)
    d.polygon((end, (tip[0] - 5 * uy, tip[1] + 5 * ux),
               (tip[0] + 5 * uy, tip[1] - 5 * ux)), fill="#8f9ba6")


def node(x, y, label, radius, active=False):
    d.ellipse((x-radius, y-radius, x+radius, y+radius),
              fill="#e5eef6" if active else "white", outline=INK, width=2)
    center((x-radius, y-radius, x+radius, y+radius), label, 20)
    if active:
        d.ellipse((x+radius-8, y-radius-4, x+radius+4, y-radius+8), fill=INK)


def graph(points, radius, size):
    for a, b in [("S", "A"), ("A", "G"), ("S", "B"), ("B", "G")]:
        arrow(points[a], points[b], radius)
    for name, point in points.items():
        node(*point, name, radius, name == "A")
    for (a, b), label in [(("S", "A"), "1秒"), (("A", "G"), "1秒"),
                          (("S", "B"), "1.5秒"), (("B", "G"), "1.5秒")]:
        x = (points[a][0] + points[b][0]) / 2
        y = (points[a][1] + points[b][1]) / 2
        text(x-20, y-27 if a == "S" else y-25, label, size, MUTED)


text(40, 23, "庭と記録を同時に見る配置案", 34)
text(40, 79, "画面案 v0.2  /  配置方針は合意済み・詳細は調整中", 21, MUTED)
text(40, 129, "PC：右側に記録欄", 25)
text(1170, 129, "スマホ：下側に記録欄", 25)

# Desktop, with the record panel open and simulation time paused at 1.2 s.
box((40, 175, 1110, 915), radius=16)
text(65, 194, "音の庭（仮称）", 26)
text(830, 201, "自由  /  最速", 21)
d.line((60, 249, 1090, 249), fill=LINE, width=2)
text(65, 273, "一時停止   1.2秒", 21)
button((340, 262, 445, 308), "再開")
button((460, 262, 600, 308), "次の動作")
button((615, 262, 720, 308), "停止")
text(65, 334, "庭", 22)
box((60, 378, 775, 868), fill="#f8fafb", radius=10)
points = {"S": (175, 590), "A": (400, 490), "B": (400, 716), "G": (660, 590)}
graph(points, 32, 19)
text(142, 632, "出発点", 19, MUTED)
text(335, 531, "処理 0.5秒", 19, MUTED)
text(347, 757, "処理 0秒", 19, MUTED)
text(644, 632, "鐘", 19, MUTED)
text(85, 828, "粒1はAで処理中", 20)

box((797, 328, 1090, 868), fill="#ffffff", radius=10)
text(815, 347, "記録", 24)
button((1017, 347, 1076, 386), "閉じる", 14)
text(815, 407, "粒1  /  Aで処理中", 19)
d.line((815, 451, 1072, 451), fill=LINE, width=2)
for y, timestamp, event in [(472, "0.0秒", "Sから出発"),
                             (558, "1.0秒", "Aへ到着"),
                             (644, "1.0秒", "Aの処理開始")]:
    text(818, y, timestamp, 19, MUTED)
    text(818, y+31, event, 21)
text(815, 778, "続きは再開後に記録", 18, MUTED)
text(65, 881, "庭の状態と、選んだ粒の記録を見比べる", 18, MUTED)

# Phone: the garden remains visible while records scroll within the lower pane.
box((1170, 175, 1620, 1015), radius=20)
text(1190, 195, "音の庭（仮称）", 24)
text(1190, 240, "自由 / 最速     一時停止 1.2秒", 18, MUTED)
button((1190, 285, 1295, 329), "再開", 18)
button((1305, 285, 1450, 329), "次の動作", 18)
button((1460, 285, 1598, 329), "停止", 18)
text(1190, 345, "庭", 20)
box((1190, 382, 1600, 664), fill="#f8fafb", radius=10)
points = {"S": (1238, 515), "A": (1378, 449), "B": (1378, 579), "G": (1551, 515)}
graph(points, 24, 15)
text(1318, 479, "処理0.5秒", 15, MUTED)
text(1338, 609, "処理0秒", 15, MUTED)
text(1206, 634, "粒1はAで処理中", 17)
box((1190, 684, 1600, 990), radius=10)
text(1206, 700, "記録：粒1", 21)
button((1515, 700, 1586, 735), "閉じる", 15)
d.line((1206, 751, 1580, 751), fill=LINE, width=2)
for y, label in [(770, "0.0秒   Sから出発"),
                 (825, "1.0秒   Aへ到着"),
                 (880, "1.0秒   Aの処理開始")]:
    text(1206, y, label, 19)
text(1206, 945, "記録欄の中をスクロール", 17, MUTED)
text(40, 963, "配置だけを相談する図です。色・オブジェの見た目・欄の大きさは後で調整します。", 21, MUTED)
text(40, 1005, "表示値は見本1の説明用。操作・画面サイズ・実機での動作は未検証です。", 21, MUTED)
im.save(OUT)
print(OUT.resolve())

# Additional review fixture for a short landscape viewport.
im = Image.new("RGB", (1680, 900), "#f1f3f5")
d = ImageDraw.Draw(im)
text(40, 28, "スマホ横向き：庭と記録を左右に分ける", 34)
text(40, 86, "横向きの配置案 v0.2  /  配置方針は合意済み・詳細は調整中", 21, MUTED)
text(60, 151, "操作欄を一列にまとめ、庭の高さを確保する案", 23)
box((60, 202, 1620, 736), radius=18)
text(82, 218, "音の庭（仮称）", 24)
text(340, 224, "自由 / 最速", 19, MUTED)
text(542, 224, "一時停止 1.2秒", 19)
button((1040, 215, 1160, 258), "再開", 19)
button((1175, 215, 1375, 258), "次の動作", 19)
button((1390, 215, 1598, 258), "停止", 19)
d.line((82, 276, 1598, 276), fill=LINE, width=2)
box((80, 295, 1078, 716), fill="#f8fafb", radius=10)
text(98, 308, "庭", 20)
points = {"S": (211, 510), "A": (561, 391), "B": (561, 610), "G": (949, 510)}
graph(points, 30, 19)
text(179, 552, "出発点", 19, MUTED)
text(498, 434, "処理0.5秒", 19, MUTED)
text(514, 653, "処理0秒", 19, MUTED)
text(933, 552, "鐘", 19, MUTED)
text(98, 680, "粒1はAで処理中", 19)
box((1098, 295, 1600, 716), radius=10)
text(1118, 311, "記録：粒1", 22)
button((1490, 310, 1580, 349), "閉じる", 17)
d.line((1118, 366, 1580, 366), fill=LINE, width=2)
for y, label in [(391, "0.0秒   Sから出発"),
                 (471, "1.0秒   Aへ到着"),
                 (551, "1.0秒   Aの処理開始")]:
    text(1120, y, label, 22)
text(1120, 663, "記録欄の中をスクロール", 19, MUTED)
text(60, 773, "回転で配置が変わっても、回路・粒・待ち列・実験の時計は保持します。", 22)
text(60, 822, "比率は説明用。小さな画面・横向きでの操作は実機で確認します。", 21, MUTED)
landscape_out = OUT.parent / "スマホ横向き配置案_v0.2.png"
im.save(landscape_out)
print(landscape_out.resolve())
