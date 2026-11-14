import bpy, sys
bpy.ops.wm.open_mainfile(filepath=sys.argv[sys.argv.index('--')+1])
b=next(o for o in bpy.data.objects if o.type=='MESH')
side=-1 if 'L' in sys.argv[-1] else 1
vs=[v.co for v in b.data.vertices if side*v.co.x>0.5]
x=0.52
while x<0.85:
    s=[v for v in vs if x<=side*v.x<x+0.02]
    if s: print(round(x,2),len(s),'y',round(min(v.y for v in s),3),round(max(v.y for v in s),3),'z',round(min(v.z for v in s),3),round(max(v.z for v in s),3))
    x+=0.02
