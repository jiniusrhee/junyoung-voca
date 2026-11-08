"""몽타주: mont.py <출력.png> <높이> <이름...>  (phone/<이름>_s.png 또는 .png, 이름표 포함)"""
import sys, os
from PIL import Image, ImageDraw
here=os.path.dirname(os.path.abspath(__file__)); ph=os.path.join(os.path.dirname(here),'phone')
out,H,names=sys.argv[1],int(sys.argv[2]),sys.argv[3:]
ims=[]
for f in names:
    p=os.path.join(ph,f+'_s.png'); p=p if os.path.exists(p) else os.path.join(ph,f+'.png')
    if not os.path.exists(p): print('missing',f); continue
    im=Image.open(p).convert('RGB'); im=im.resize((int(im.width*H/im.height),H))
    d=ImageDraw.Draw(im); d.rectangle((0,0,150,20),fill=(0,0,0)); d.text((4,3),f,fill=(0,255,255)); ims.append(im)
W=sum(i.width for i in ims)+6*(len(ims)-1); c=Image.new('RGB',(W,H),(60,60,60)); x=0
for i in ims: c.paste(i,(x,0)); x+=i.width+6
c.save(out); print(out,c.size)
