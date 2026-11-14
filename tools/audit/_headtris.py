import bpy, sys
bpy.ops.wm.open_mainfile(filepath=sys.argv[sys.argv.index('--')+1])
b=next(o for o in bpy.data.objects if o.type=='MESH')
h=sum(1 for p in b.data.polygons if all(b.data.vertices[i].co.z>1.55 for i in p.vertices))
hd=sum(1 for p in b.data.polygons if all(abs(b.data.vertices[i].co.x)>0.66 for i in p.vertices))
print('HEADTRIS',h,'HANDTRIS',hd,'TOTAL',len(b.data.polygons))
