"""Static control layout for design review; no application behavior."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

out = Path(__file__).parent / "設定欄案_v0.1.png"
im = Image.new("RGB", (1480, 1030), "#f1f3f5")
d = ImageDraw.Draw(im)
ink, muted, line = "#25313c", "#64717e", "#c9d0d7"
fonts = {}

def font(size):
    if size not in fonts:
        fonts[size] = ImageFont.truetype("C:/Windows/Fonts/meiryo.ttc", size)
    return fonts[size]

def text(x, y, value, size=22, color=ink):
    d.text((x, y), value, font=font(size), fill=color)

def box(rect, label=None, size=22, selected=False):
    d.rounded_rectangle(rect, radius=10, fill="#e5eef6" if selected else "white", outline=line, width=2)
    if label:
        x1,y1,x2,y2=rect
        width=d.textlength(label,font=font(size))
        assert width<x2-x1-10,label
        text((x1+x2-width)/2,(y1+y2)/2-size*0.7,label,size)

text(40, 22, "自由モードの設定欄案", 34)
text(40, 82, "設定欄案 v0.1  /  構成の相談用・未合意  /  停止して編集中", 21, muted)
for x,title,value,kind in [(40,"中継点 A を選択","0.5","処理"),
                           (770,"道 S → A を選択","1.0","移動")]:
    box((x,150,x+670,780))
    text(x+28,169,title,28)
    text(x+28,223,"選んだ点や道の設定を、この欄に表示",21,muted)
    text(x+28,282,f"{kind}時間（秒）",23)
    box((x+28,330,x+286,386),value,27,selected=True)
    box((x+304,330,x+458,386),"−0.1",22)
    box((x+476,330,x+630,386),"＋0.1",22)
    minimum="0秒以上・0.1秒刻み" if kind=="処理" else "0.1秒以上・0.1秒刻み"
    text(x+28,402,minimum,20,muted)
    text(x+28,458,"使用状態",23)
    box((x+28,502,x+316,551),"使用可",22,selected=True)
    box((x+336,502,x+630,551),"使用不可",22)
    if kind=="移動":
        text(x+28,575,"道の向き",22)
        for left,right,label,selected in [(28,218,"S → A",True),(232,422,"A → S",False),(436,630,"両方向",False)]:
            box((x+left,616,x+right,665),label,21,selected)
    else:
        text(x+28,593,"新しい中継点は0.5秒から開始",21,muted)
    box((x+28,705,x+630,755),"削除する内容を確認",22)
text(40,810,"点の削除では、接続している道も確認画面に示します。",22)
text(40,854,"出発点：一つを保ち、位置を変更。戻った粒の処理時間を設定できます。",21)
text(40,896,"鐘：受信して終了。処理時間の入力欄は設けず、削除は確認後に行います。",21)
text(40,951,"配置・文言の案です。実際の入力、タッチ操作、対象端末での動作は未検証です。",20,muted)
im.save(out)
print(out.resolve())
