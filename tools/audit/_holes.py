import bpy, bmesh, sys
bpy.ops.wm.open_mainfile(filepath=sys.argv[sys.argv.index('--')+1])
b=next(o for o in bpy.data.objects if o.type=='MESH')
bm=bmesh.new(); bm.from_mesh(b.data)
be=[e for e in bm.edges if e.is_boundary]; nm=[e for e in bm.edges if not e.is_manifold]
print('HOLES verts',len(bm.verts),'faces',len(bm.faces),'boundary edges',len(be),'nonmanifold',len(nm))
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.006)
be=[e for e in bm.edges if e.is_boundary]
print('HOLES after weld: verts',len(bm.verts),'boundary',len(be))
