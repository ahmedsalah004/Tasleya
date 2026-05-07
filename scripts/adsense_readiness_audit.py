#!/usr/bin/env python3
import os,re
from html.parser import HTMLParser

ROUTES=["/","/games/","/play/","/categories/","/about/","/faq/","/contact/","/privacy/","/terms/","/map-game/","/films/","/games/auction/","/games/guess-from-hint/","/games/emoji-movies/","/games/forbidden-words/","/games/xo-intersection/","/articles/","/articles/perfect-game-night/","/articles/host-guide-game-modes/","/articles/trivia-memory-benefits/","/articles/arabic-trivia-history/","/articles/auction-strategy-guide/","/articles/team-play-tips/"]
UNKNOWN=["/nonexistent","/random-test-page-adsense-check","/games/nonexistent"]

class P(HTMLParser):
    def __init__(self):
        super().__init__(); self.h1=[]; self.text=[]; self.links=[]; self.in_h1=False
    def handle_starttag(self,tag,attrs):
        d=dict(attrs)
        if tag=="h1": self.in_h1=True
        if tag=="a" and "href" in d: self.links.append(d["href"])
    def handle_endtag(self,tag):
        if tag=="h1": self.in_h1=False
    def handle_data(self,data):
        t=data.strip()
        if not t:return
        self.text.append(t)
        if self.in_h1: self.h1.append(t)


TEXT_EXTENSIONS={".html",".js",".mjs",".css",".xml",".txt",".md",".json",".toml",".yml",".yaml",".py"}

def iter_text_files(base="."):
    for root,_,files in os.walk(base):
        for f in files:
            ext=os.path.splitext(f)[1].lower()
            if ext in TEXT_EXTENSIONS:
                yield os.path.join(root,f)

def route_to_file(route):
    return "index.html" if route=="/" else route.strip("/")+"/index.html"

def extract(pattern,html):
    m=re.search(pattern,html,re.I|re.S)
    return m.group(1).strip() if m else ""

print("=== Route content audit ===")
for route in ROUTES:
    fp=route_to_file(route)
    if not os.path.exists(fp):
        print(route,"MISSING FILE")
        continue
    html=open(fp,encoding='utf-8').read()
    p=P(); p.feed(html)
    arabic_chars=sum(1 for ch in "".join(p.text) if '\u0600'<=ch<='\u06FF')
    canonical=extract(r'rel=["\']canonical["\'][^>]*href=["\']([^"\']+)',html)
    robots=extract(r'<meta[^>]+name=["\']robots["\'][^>]+content=["\']([^"\']+)',html) or 'index(default)'
    print(f"{route} | h1={bool(p.h1)} | arabic_chars={arabic_chars} | canonical={canonical or 'none'} | robots={robots}")

print("\n=== Unknown route static expectation ===")
for route in UNKNOWN:
    fp=route_to_file(route)
    print(f"{route} -> {'exists (unexpected)' if os.path.exists(fp) else 'no file (should resolve to 404.html on static host)'}")

print("\n=== Internal link check ===")
all_html=[]
for root,_,files in os.walk('.'):
    for f in files:
        if f.endswith('.html'):
            all_html.append(os.path.join(root,f).lstrip('./'))
broken=[]
seen=set()
for fp in all_html:
    h=open(fp,encoding='utf-8').read(); p=P(); p.feed(h)
    for href in p.links:
        if not href.startswith('/') or href.startswith('//'): continue
        href=href.split('#')[0].split('?')[0] or '/'
        if href in seen: continue
        seen.add(href)
        target='index.html' if href=='/' else (href.strip('/')+'/index.html' if href.endswith('/') else href.lstrip('/'))
        if not os.path.exists(target): broken.append((fp,href))
print('broken_links=',len(broken))
for b in broken[:20]: print(' ',b)

print("\n=== AdSense publisher IDs ===")
hits=[]
for root,_,files in os.walk('.'):
    for f in files:
        pth=os.path.join(root,f)
        try: data=open(pth,encoding='utf-8',errors='ignore').read()
        except: continue
        for m in re.finditer(r'pub-[0-9]{10,}',data):
            hits.append((pth.lstrip('./'),m.group(0)))
uniq=sorted(set(v for _,v in hits))
print('publisher_ids=',uniq)
for p,v in hits[:50]: print(' ',v,p)
