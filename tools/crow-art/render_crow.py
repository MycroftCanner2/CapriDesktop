"""Render Crow Companion animation frames from the CC0 Pixor crow (pixor.art/library/creatures/crow).

blender -b --python render_crow.py -- <out_dir> [anim ...]
Every frame is posed procedurally from the model's rig (Root, Body, Head, Tail, Wing.L/R, Leg.L/R).
"""
import bpy, math, mathutils, sys, os, bmesh

argv = sys.argv[sys.argv.index('--') + 1:]
OUT = argv[0]
ONLY = set(argv[1:])
HERE = os.path.dirname(os.path.abspath(__file__))
TAU = math.tau

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=os.path.join(HERE, 'pixor-library-crow/model/crow.glb'))
for o in list(bpy.data.objects):
    if o.name == 'Icosphere':
        bpy.data.objects.remove(o)
rig = bpy.data.objects['Crow rig']
rig.animation_data_clear()
for o in bpy.data.objects:
    if o.animation_data: o.animation_data_clear()
for pb in rig.pose.bones:
    pb.rotation_mode = 'XYZ'

# --- materials: glossy black feathers with a blue-violet sheen
def principled(mat):
    return next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
feather = bpy.data.materials['Crow feather']
b = principled(feather)
b.inputs['Base Color'].default_value = (0.035, 0.035, 0.055, 1)
b.inputs['Roughness'].default_value = 0.38
if 'Coat Weight' in b.inputs:
    b.inputs['Coat Weight'].default_value = 0.35
    b.inputs['Coat Tint'].default_value = (0.55, 0.6, 1.0, 1)
iron = principled(bpy.data.materials['Dark iron'])
iron.inputs['Base Color'].default_value = (0.05, 0.05, 0.065, 1)
iron.inputs['Roughness'].default_value = 0.5
eye_mat = bpy.data.materials['Eye white']
eye = principled(eye_mat)
EYE_BASE = (0.92, 0.92, 0.88, 1)

# --- blink shape key: squash each eye toward its own centre
eyes = bpy.data.objects['Crow eyes']
eyes.shape_key_add(name='Basis')
blink = eyes.shape_key_add(name='Blink')
verts = eyes.data.vertices
for side in (1, -1):
    idx = [v.index for v in verts if v.co.x * side > 0]
    cz = sum(verts[i].co.z for i in idx) / len(idx)
    for i in idx:
        p = blink.data[i].co
        p.z = cz + (p.z - cz) * 0.08

sc = bpy.context.scene
sc.render.engine = 'CYCLES'
sc.cycles.device = 'CPU'
sc.cycles.samples = 48
sc.cycles.use_denoising = False
sc.render.film_transparent = True
sc.render.resolution_x = sc.render.resolution_y = 320
sc.render.image_settings.color_mode = 'RGBA'
sc.view_settings.view_transform = 'Standard'

cam = bpy.data.cameras.new('cam'); cam.type = 'ORTHO'; cam.ortho_scale = 0.44
camo = bpy.data.objects.new('cam', cam); sc.collection.objects.link(camo); sc.camera = camo
TARGET = mathutils.Vector((0, 0, 0.14))

def place_camera(angle_deg, elev=0.22, scale=0.44, target=TARGET):
    a = math.radians(angle_deg)
    camo.location = target + mathutils.Vector((math.cos(a), math.sin(a), elev))
    camo.rotation_euler = (target - camo.location).to_track_quat('-Z', 'Y').to_euler()
    cam.ortho_scale = scale

def light(name, kind, energy, rot, color=(1, 1, 1)):
    l = bpy.data.lights.new(name, kind); l.energy = energy; l.color = color
    o = bpy.data.objects.new(name, l); sc.collection.objects.link(o); o.rotation_euler = [math.radians(r) for r in rot]
    return l
light('key', 'SUN', 2.6, (45, 0, 35), (1.0, 0.96, 0.9))
light('rim', 'SUN', 4.5, (100, 0, 200), (0.55, 0.65, 1.0))
light('fill', 'SUN', 0.9, (60, 0, -60), (0.8, 0.85, 1.0))
world = bpy.data.worlds.new('w'); sc.world = world; world.use_nodes = True
world.node_tree.nodes['Background'].inputs[0].default_value = (0.6, 0.65, 0.75, 1)
world.node_tree.nodes['Background'].inputs[1].default_value = 0.35

P = rig.pose.bones
REST_SCALE = rig.scale.copy()

def pose(root_z=0.0, root_y=0.0, body_pitch=0.0, body_roll=0.0, body_yaw=0.0, head_pitch=0.0, head_yaw=0.0, head_roll=0.0,
         tail_pitch=0.0, wing_open=0.0, wing_flap=0.0, leg_l=0.0, leg_r=0.0, fluff=1.0, blink_v=0.0, red=False):
    for pb in P:
        pb.location = (0, 0, 0); pb.rotation_euler = (0, 0, 0); pb.scale = (1, 1, 1)
    # Root bone's local axes: Y is up the bone. Location is in bone space -> (x, y=up, z)
    P['Root'].location = (0, root_z, root_y)
    P['Body'].rotation_euler = (body_pitch, body_yaw, body_roll)
    P['Body'].scale = (fluff, fluff, fluff)
    P['Head'].rotation_euler = (head_pitch, head_yaw, head_roll)
    P['Tail'].rotation_euler = (tail_pitch, 0, 0)
    w = wing_open + wing_flap
    # X lifts the wing up over the back, Z spreads it out from the body
    spread = 0.5 * max(0.0, wing_open)
    P['Wing.L'].rotation_euler = (w, 0, spread)
    P['Wing.R'].rotation_euler = (w, 0, -spread)
    P['Leg.L'].rotation_euler = (leg_l, 0, 0)
    P['Leg.R'].rotation_euler = (leg_r, 0, 0)
    blink.value = blink_v
    eye.inputs['Base Color'].default_value = (0.95, 0.08, 0.05, 1) if red else EYE_BASE
    if 'Emission Color' in eye.inputs:
        eye.inputs['Emission Color'].default_value = (1, 0.05, 0.02, 1)
        eye.inputs['Emission Strength'].default_value = 3.0 if red else 0.0

s = math.sin
def blink_at(t, at=0.82, width=0.06):
    d = abs(t - at)
    return max(0.0, 1 - d / width) if d < width else 0.0

# name: (frames, camera angle, fn(t) -> pose kwargs)
ANIMS = {
    'idle': (12, 0, lambda t: dict(root_z=0.002 * s(TAU * t), body_pitch=0.03 * s(TAU * t), head_pitch=0.05 * s(TAU * t + 1),
                                   tail_pitch=0.08 * s(TAU * t * 2), blink_v=blink_at(t))),
    'standing': (12, 0, lambda t: dict(head_yaw=0.55 * s(TAU * t), head_roll=0.12 * s(TAU * t), body_pitch=-0.05,
                                       tail_pitch=0.05 * s(TAU * t * 2), blink_v=blink_at(t, 0.5))),
    'walking': (8, 0, lambda t: dict(root_z=0.012 * abs(s(TAU * t)), body_pitch=0.08 + 0.05 * s(TAU * t * 2), head_pitch=-0.1 * s(TAU * t * 2),
                                     leg_l=0.55 * s(TAU * t), leg_r=-0.55 * s(TAU * t), tail_pitch=0.1 * s(TAU * t * 2))),
    'happy': (12, 0, lambda t: dict(root_z=0.045 * max(0.0, s(TAU * t)), body_pitch=-0.1 * max(0.0, s(TAU * t)),
                                    wing_open=0.35 * max(0.0, s(TAU * t)), wing_flap=0.25 * s(TAU * t * 3) * max(0.0, s(TAU * t)),
                                    leg_l=-0.3 * max(0.0, s(TAU * t)), leg_r=-0.3 * max(0.0, s(TAU * t)), head_pitch=0.15 * s(TAU * t),
                                    tail_pitch=0.15 * s(TAU * t))),
    'curious': (10, -25, lambda t: dict(head_roll=0.45 + 0.08 * s(TAU * t), head_yaw=0.25 * s(TAU * t), body_pitch=0.08,
                                        blink_v=blink_at(t, 0.7))),
    'talking': (8, 0, lambda t: dict(head_pitch=-0.35 * max(0.0, s(TAU * t)), body_pitch=0.12 * max(0.0, s(TAU * t)),
                                     fluff=1 + 0.05 * max(0.0, s(TAU * t)), tail_pitch=0.25 * max(0.0, s(TAU * t)),
                                     wing_open=0.12 * max(0.0, s(TAU * t)))),
    'sleep': (8, 0, lambda t: dict(head_pitch=0.55, head_roll=0.2, body_pitch=0.05, fluff=1.06 + 0.02 * s(TAU * t),
                                   root_z=-0.01, tail_pitch=-0.1, blink_v=1.0)),
    'ojos': (12, -90, lambda t: dict(head_yaw=0.12 * s(TAU * t), head_roll=0.1 * s(TAU * t * 0.5), blink_v=blink_at(t, 0.6, 0.08))),
    'closed': (8, -30, lambda t: dict(fluff=1.14 + 0.03 * s(TAU * t * 2), wing_open=0.5, head_pitch=-0.15, body_pitch=-0.05,
                                      tail_pitch=0.35, red=True, head_roll=0.05 * s(TAU * t * 2))),
    'asustada': (8, 0, lambda t: dict(root_z=0.06 + 0.02 * s(TAU * t), wing_open=0.9, wing_flap=0.7 * s(TAU * t * 2), body_pitch=-0.25,
                                      head_pitch=-0.2, leg_l=-0.6, leg_r=-0.6, tail_pitch=0.3)),
    'capri2': (8, 0, lambda t: dict(root_z=0.03 + 0.012 * s(TAU * t), wing_open=0.8, wing_flap=0.75 * s(TAU * t), body_pitch=0.05,
                                    leg_l=-0.7, leg_r=-0.7, tail_pitch=0.1 * s(TAU * t))),
    'idle_front': (1, -90, lambda t: dict()),
    # Tallow's own actions
    'lean': (10, 0, lambda t: dict(body_pitch=-0.28, head_pitch=-0.2, root_y=0.015, head_yaw=0.25 * s(TAU * t), tail_pitch=0.2,
                                   blink_v=blink_at(t, 0.4))),
    'droop': (10, 0, lambda t: dict(head_pitch=0.45 + 0.04 * s(TAU * t), body_pitch=0.15, tail_pitch=-0.35, wing_open=-0.05,
                                    fluff=0.97, blink_v=0.5 + 0.5 * blink_at(t, 0.5, 0.2))),
    'love': (12, -20, lambda t: dict(head_roll=0.25 * s(TAU * t), body_roll=0.08 * s(TAU * t), fluff=1.05, head_pitch=0.1,
                                     blink_v=0.65)),
    'fluff': (8, 0, lambda t: dict(fluff=1.2 + 0.04 * s(TAU * t * 2), wing_open=0.3, tail_pitch=0.45, head_pitch=-0.1,
                                   body_pitch=-0.05)),
    'alarm': (8, 0, lambda t: dict(root_z=0.03 * abs(s(TAU * t)), wing_open=0.7, wing_flap=0.6 * s(TAU * t * 2), head_pitch=-0.45,
                                   body_pitch=-0.2, tail_pitch=0.4, fluff=1.08)),
}

CAM = {'ojos': dict(scale=0.2, elev=0.03, target=mathutils.Vector((0, -0.05, 0.215)))}

os.makedirs(OUT, exist_ok=True)
for name, (n, ang, fn) in ANIMS.items():
    if ONLY and name not in ONLY:
        continue
    place_camera(ang, **CAM.get(name, {}))
    d = os.path.join(OUT, name); os.makedirs(d, exist_ok=True)
    for i in range(n):
        pose(**fn(i / n))
        bpy.context.view_layer.update()
        sc.render.filepath = os.path.join(d, f'raw_{i}.png')
        bpy.ops.render.render(write_still=True)
    print('rendered', name, n)
