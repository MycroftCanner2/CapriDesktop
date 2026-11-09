import sys, runpy, math, mathutils
sys.argv = ['x', '--', '/tmp/crowicon', 'none']
ns = runpy.run_path('/workspace/crow-art/render_crow.py')
import bpy
sc = ns['sc']; sc.render.resolution_x = sc.render.resolution_y = 1024; sc.cycles.samples = 96
ns['place_camera'](-28, elev=0.12, scale=0.3, target=mathutils.Vector((0, -0.01, 0.15)))
ns['pose'](head_roll=0.18, head_yaw=-0.15, fluff=1.03)
bpy.context.view_layer.update()
sc.render.filepath = '/workspace/crow-art/icon_raw.png'
bpy.ops.render.render(write_still=True)
