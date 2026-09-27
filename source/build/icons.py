from playwright.sync_api import sync_playwright
import os
OUT=os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),"src","icons"); os.makedirs(OUT,exist_ok=True)
def svg(maskable):
    pad = 0 if maskable else 0
    r = 0 if maskable else 112
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#16d6a0"/><stop offset="1" stop-color="#067a59"/></linearGradient>
<radialGradient id="b" cx=".2" cy=".1" r="1"><stop offset="0" stop-color="#1c3a78"/><stop offset=".6" stop-color="#0e142d"/></radialGradient></defs>
<rect width="512" height="512" rx="{r}" fill="url(#b)"/>
<g transform="translate(256 262) scale({0.78 if maskable else 1})">
<circle r="150" fill="url(#g)"/>
<path d="M0 -104c14 50 70 78 70 142a70 70 0 0 1-140 0c0-31 14-50 31-67 4 22 14 36 28 43C-14 -24 -10 -62 0 -104Z" fill="#fff"/>
<circle cx="0" cy="44" r="24" fill="#0e8f69"/>
</g></svg>'''
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":512,"height":512})
    for name,mask,size in [("icon-512.png",False,512),("icon-192.png",False,192),("maskable-512.png",True,512),("apple-touch-icon.png",True,180)]:
        pg.set_viewport_size({"width":size,"height":size})
        sv = svg(mask).replace('width="512" height="512"', 'width="%d" height="%d"' % (size, size))
        pg.set_content('<html><body style="margin:0;background:transparent">' + sv + '</body></html>')
        pg.screenshot(path=f"{OUT}/{name}",omit_background=True)
    b.close()
print("icons ok")
