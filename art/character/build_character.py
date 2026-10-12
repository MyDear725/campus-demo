"""Original campus character, authored in Blender. Rebuild with blender -b -P this_file.
All geometry, skin weights, materials and motion clips are generated locally.
Coordinates: meters, Z up, face toward -Y. No downloaded character assets.
"""
import bpy, bmesh, math, os, json, sys
from mathutils import Vector
from math import sin, cos, pi

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.abspath(os.path.join(HERE, '../../assets/characters'))
os.makedirs(ASSETS, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for block in list(bpy.data.materials): bpy.data.materials.remove(block)
parts=[]

def material(name, color, rough=.65, metal=0):
    m=bpy.data.materials.new(name); m.diffuse_color=(*color,1); m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*color,1)
    bs.inputs['Roughness'].default_value=rough;bs.inputs['Metallic'].default_value=metal
    return m
skin=material('Skin_warm_porcelain',(.69,.43,.30),.73)
inner=material('Skin_soft_rose',(.57,.25,.20),.8)
mouthmat=material('Mouth_cavity',(.075,.018,.014),.9)
hair=material('Hair_ink_chestnut',(.019,.025,.032),.82)
hairlight=material('Hair_soft_highlights',(.030,.038,.050),.8)
navy=material('Jacket_midnight_teal',(.028,.095,.12),.82)
cream=material('Sleeves_oat_milk',(.78,.74,.62),.9)
rib=material('Ribbing_midnight',(.023,.047,.058),.9)
white=material('Ivory_cotton',(.90,.88,.79),.86)
pants=material('Trousers_slate',(.072,.087,.105),.87)
stitch=material('Seams',(.20,.24,.25),.9)
bagmat=material('Backpack_canvas',(.48,.31,.17),.9)
leather=material('Leather_tabs',(.22,.105,.045),.73)
metal=material('Hardware_brushed_brass',(.58,.39,.15),.3,.65)
black=material('Eyeliner',(.012,.014,.019),.7)
iris=material('Eyes_amber_brown',(.20,.115,.047),.28)
sole=material('Sneaker_rubber',(.74,.73,.66),.95)
accent=material('Amber_accent',(.78,.32,.075),.73)

def finish(obj,name,mat,bone='Chest'):
    obj.name=name;obj.data.materials.append(mat)
    for p in getattr(obj.data,'polygons',[]):p.use_smooth=True
    obj['bind_bone']=bone;parts.append(obj)
    return obj
def mesh(name,verts,faces,mat,bone='Chest',sub=0):
    data=bpy.data.meshes.new(name);data.from_pydata(verts,[],faces);data.update()
    obj=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(obj);finish(obj,name,mat,bone)
    if sub:
        mod=obj.modifiers.new('Surface refinement','SUBSURF');mod.levels=sub;mod.render_levels=sub
    return obj
def ell(name,loc,scale,mat,bone='Chest',segments=24,rings=16):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=rings,location=loc)
    ob=bpy.context.object;ob.scale=scale;return finish(ob,name,mat,bone)
def rounded(name,loc,scale,mat,bone='Chest',bevel=.025):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc);ob=bpy.context.object;ob.scale=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    mod=ob.modifiers.new('Tailored rounded edges','BEVEL');mod.width=bevel;mod.segments=3
    norm=ob.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
    return finish(ob,name,mat,bone)
def line(name,pts,thickness,mat,bone='Chest'):
    curve=bpy.data.curves.new(name,'CURVE');curve.dimensions='3D';curve.resolution_u=8
    curve.bevel_depth=thickness;curve.bevel_resolution=2
    spline=curve.splines.new('BEZIER');spline.bezier_points.add(len(pts)-1)
    for v,p in zip(spline.bezier_points,pts):v.co=p;v.handle_left_type='AUTO';v.handle_right_type='AUTO'
    ob=bpy.data.objects.new(name,curve);bpy.context.collection.objects.link(ob);return finish(ob,name,mat,bone)
def loft(name,rings,mat,bone='Chest',segments=32,sub=1):
    # rings: (center_x, center_y, height, half_width, half_depth)
    vs=[];fs=[]
    for x,y,z,rx,ry in rings:
        for j in range(segments):
            a=2*pi*j/segments;vs.append((x+rx*cos(a),y+ry*sin(a),z))
    for i in range(len(rings)-1):
        for j in range(segments):
            a=i*segments+j;b=i*segments+(j+1)%segments;fs.append((a,b,b+segments,a+segments))
    fs.append(tuple(range(segments-1,-1,-1)));fs.append(tuple((len(rings)-1)*segments+j for j in range(segments)))
    return mesh(name,vs,fs,mat,bone,sub)
def tube(name,points,radii,mat,bone,depth=.85,segments=16):
    vs=[];fs=[]
    for i,p in enumerate(points):
        p=Vector(p);t=Vector(points[min(i+1,len(points)-1)])-Vector(points[max(0,i-1)])
        t.normalize();u=Vector((1,0,0));u=(u-t*u.dot(t)).normalized();v=t.cross(u).normalized()
        for j in range(segments):
            a=2*pi*j/segments;vs.append(tuple(p+u*cos(a)*radii[i]+v*sin(a)*radii[i]*depth))
    for i in range(len(points)-1):
        for j in range(segments):a=i*segments+j;b=i*segments+(j+1)%segments;fs.append((a,b,b+segments,a+segments))
    fs.append(tuple(range(segments-1,-1,-1)));fs.append(tuple((len(points)-1)*segments+j for j in range(segments)))
    return mesh(name,vs,fs,mat,bone,1)

# Facial topology follows a shaped jaw, cheeks and forehead, rather than a sphere.
head=loft('Face_shaped_jaw',[(0,-.014,1.468,.025,.035),(0,-.013,1.484,.061,.056),(0,-.006,1.517,.093,.079),(0,0,1.558,.112,.096),(0,.002,1.601,.122,.103),(0,.007,1.647,.123,.105),(0,.012,1.693,.111,.100),(0,.014,1.729,.084,.077),(0,.014,1.75,.029,.027)],skin,'Head',40,2)
ell('Neck',(0,.005,1.442),(.049,.048,.076),skin,'Neck')
for side in [-1,1]:
    ell('Ear', (side*.12,.006,1.583),(.020,.024,.039),skin,'Head')
    ell('Ear_inner',(side*.132,-.011,1.585),(.010,.008,.021),inner,'Head')
    x=side*.047;z=1.611
    # Almond surfaces, upper eyelids and smaller amber irises.
    verts=[(x,-.100,z)];n=24
    for j in range(n):
        a=2*pi*j/n;xx=.029*cos(a);zz=.012*sin(a)*(1-.15*abs(cos(a)))
        verts.append((x+xx,-.101+abs(xx)*.22,z+zz+side*xx*.10))
    mesh('Eye_sclera',verts,[(0,j+1,(j+1)%n+1) for j in range(n)],white,'Head')
    ell('Iris',(x,-.105,z),(.011,.003,.012),iris,'Head',20,12)
    ell('Pupil',(x,-.108,z),(.005,.0018,.009),black,'Head',16,10)
    ell('Eye_catchlight',(x-.003,-.110,z+.004),(.0025,.001,.003),white,'Head',12,8)
    line('Upper_lid',[(x-.029,-.096,z-.003*side),(x-.015,-.105,z+.010),(x+.006,-.107,z+.012),(x+.029,-.096,z+.003*side)],.0028,black,'Head')
    line('Lower_lid',[(x-.024,-.098,z-.005),(x,-.104,z-.011),(x+.023,-.098,z-.003)],.0012,inner,'Head')
    line('Brow',[(x-.026,-.093,1.643),(x,-.101,1.648),(x+.024,-.091,1.641)],.004,hair,'Head')
ell('Nose_bridge',(0,-.097,1.583),(.010,.014,.027),skin,'Head')
ell('Nose_tip',(0,-.111,1.570),(.012,.011,.010),skin,'Head',20,12)
line('Mouth', [(-.021,-.092,1.539),(0,-.098,1.537),(.020,-.092,1.54)],.0018,inner,'Head')
ell('Lower_lip',(0,-.096,1.533),(.014,.002,.0028),skin,'Head')
ell('Mouth_open',(0,-.095,1.537),(.013,.0015,.0006),mouthmat,'Head',20,12)

# Sculpted hair cap with a raised front hairline and longer nape.
vs=[];fs=[];nr=12;ns=48
for i in range(nr+1):
    for j in range(ns):
        phi=2*pi*j/ns;front=max(0,-sin(phi));theta=(.025+(1.98-.83*front)*i/nr)
        vs.append((.132*sin(theta)*cos(phi),.014+.116*sin(theta)*sin(phi),1.64+.137*cos(theta)))
for i in range(nr):
    for j in range(ns):a=i*ns+j;b=i*ns+(j+1)%ns;fs.append((a,b,b+ns,a+ns))
mesh('Hair_cap',vs,fs,hair,'Head',1)
# Overlapping ribbon-shaped locks form a continuous swept fringe.
fringe_specs=[
    ([(-.113,-.012,1.73),(-.118,-.073,1.713),(-.103,-.10,1.668),(-.078,-.093,1.635)],.027),
    ([(-.086,-.020,1.749),(-.094,-.081,1.730),(-.060,-.115,1.684),(-.018,-.115,1.642)],.039),
    ([(-.038,.004,1.773),(-.042,-.079,1.750),(.012,-.12,1.697),(.044,-.111,1.649)],.042),
    ([(.014,.015,1.773),(.022,-.072,1.748),(.069,-.109,1.701),(.09,-.087,1.660)],.035),
    ([(.068,.025,1.755),(.095,-.051,1.725),(.126,-.073,1.675),(.121,-.052,1.621)],.026)]
for i,(control,width_max) in enumerate(fringe_specs):
    points=[Vector(p) for p in control]
    vv=[];ff=[];rows=10;cols=7
    for j in range(rows):
        t=j/(rows-1);p=(1-t)**3*points[0]+3*(1-t)**2*t*points[1]+3*(1-t)*t*t*points[2]+t**3*points[3]
        width=.003+width_max*sin(pi*t)**.55
        if j==rows-1:width=.0005
        for k in range(cols):
            u=2*k/(cols-1)-1;vv.append((p.x+u*width,p.y-.004*(1-u*u),p.z+.001*(1-u*u)))
    for j in range(rows-1):
        for k in range(cols-1):a=j*cols+k;ff.append((a,a+1,a+1+cols,a+cols))
    lock=mesh('Swept_fringe_%02d'%i,vv,ff,hair,'Head',1)
    solid=lock.modifiers.new('Hair thickness','SOLIDIFY');solid.thickness=.006
for side in [-1,1]:
    lock=mesh('Temple_lock',[(side*.103,-.057,1.698),(side*.130,-.024,1.675),(side*.129,-.006,1.614),(side*.111,-.036,1.594),(side*.111,-.064,1.653)],[(0,1,2,3,4)],hair,'Head')
    solid=lock.modifiers.new('Temple thickness','SOLIDIFY');solid.thickness=.008

# Tailored varsity jacket, inset shirt, ribbed hem and brass zipper.
loft('Jacket_body',[(0,.012,.90,.157,.098),(0,.008,.917,.171,.108),(0,.006,.97,.172,.114),(0,.008,1.07,.173,.109),(0,.009,1.19,.203,.123),(0,.012,1.31,.219,.116),(0,.015,1.365,.192,.094),(0,.012,1.39,.105,.069)],navy,'Chest',40,2)
loft('Jacket_hem',[(0,.008,.884,.161,.101),(0,.008,.90,.173,.111),(0,.008,.935,.173,.113),(0,.008,.945,.165,.106)],rib,'Hips')
loft('Hem_ivory_stripe',[(0,.008,.903,.174,.113),(0,.008,.914,.174,.113)],cream,'Hips',40,0)
loft('Collar',[(0,.009,1.357,.088,.073),(0,.009,1.389,.082,.066),(0,.009,1.425,.060,.057)],cream,'Chest')
loft('Collar_stripe',[(0,.009,1.397,.079,.065),(0,.009,1.404,.072,.062)],navy,'Chest',32,0)
line('Front_zipper',[(0,-.108,.942),(0,-.105,1.08),(0,-.116,1.20),(0,-.098,1.31),(0,-.065,1.372)],.0035,metal)
rounded('Zipper_pull',(0,-.129,1.28),(.012,.008,.024),metal,bevel=.004)
for side in [-1,1]:
    line('Pocket_welt',[(side*.085,-.101,.99),(side*.145,-.083,1.065)],.009,rib)
    line('Pocket_piping',[(side*.085,-.110,.994),(side*.144,-.092,1.07)],.0018,cream)
    line('Shoulder_seam',[(side*.086,-.04,1.383),(side*.17,-.062,1.364),(side*.224,-.045,1.307)],.002,stitch)
rounded('Chest_badge',(-.11,-.110,1.269),(.041,.008,.053),cream,bevel=.008)
line('Badge_monogram',[(-.119,-.116,1.286),(-.119,-.116,1.254),(-.104,-.116,1.254),(-.10,-.116,1.263),(-.10,-.116,1.279),(-.104,-.116,1.286),(-.119,-.116,1.286)],.002,navy)

for side,suffix in [(-1,'L'),(1,'R')]:
    upper='UpperArm_'+suffix;lower='Forearm_'+suffix;hand='Hand_'+suffix
    sleeve=tube('Continuous_sleeve_'+suffix,[(side*.173,.012,1.347),(side*.220,.009,1.338),(side*.244,.005,1.285),(side*.262,.005,1.20),(side*.277,.003,1.10),(side*.290,-.005,1.027),(side*.308,-.016,.933),(side*.313,-.02,.881)],[.046,.070,.072,.062,.052,.054,.048,.037],cream,upper,.92)
    sleeve['elbow_blend']=suffix
    tube('Ribbed_cuff_'+suffix,[(side*.308,-.017,.925),(side*.314,-.02,.871)],[.041,.037],rib,lower,.92)
    tube('Cuff_stripe_'+suffix,[(side*.312,-.020,.897),(side*.313,-.020,.906)],[.039,.040],cream,lower,.92)
    ell('Palm_'+suffix,(side*.319,-.020,.832),(.037,.023,.052),skin,hand)
    for i in range(4):
        xx=side*(.296+i*.014)
        tube('Finger_'+suffix+str(i),[(xx,-.023,.817),(xx,-.027,.785),(xx,-.033,.767+abs(i-1)*.008)],[.009,.008,.005],skin,hand,.88,10)
    tube('Thumb_'+suffix,[(side*.289,-.022,.847),(side*.280,-.047,.826),(side*.281,-.05,.801)],[.013,.011,.007],skin,hand,.9,10)
    leg='Thigh_'+suffix;shin='Shin_'+suffix;foot='Foot_'+suffix
    # A continuous leg with interpolated knee weights, avoiding cylinder joints.
    legmesh=loft('Trouser_leg_'+suffix,[(side*.105,0,.916,.083,.089),(side*.106,0,.87,.089,.091),(side*.11,0,.73,.084,.085),(side*.114,-.006,.57,.070,.070),(side*.114,-.006,.51,.067,.066),(side*.112,0,.42,.068,.070),(side*.11,.004,.23,.052,.058),(side*.11,.003,.155,.048,.051)],pants,leg,24,2)
    legmesh['knee_blend']=suffix
    line('Trouser_outer_seam_'+suffix,[(side*.195,0,.86),(side*.19,0,.72),(side*.183,0,.59)],.0018,stitch,leg)
    line('Trouser_lower_seam_'+suffix,[(side*.181,0,.48),(side*.165,0,.30),(side*.158,0,.17)],.0018,stitch,shin)
    loft('Sock_'+suffix,[(side*.11,.002,.119,.043,.044),(side*.11,.002,.19,.043,.044)],white,shin,24,0)
    rounded('Shoe_outsole_'+suffix,(side*.11,-.045,.032),(.136,.267,.040),sole,foot,.018)
    rounded('Shoe_midsole_'+suffix,(side*.11,-.047,.056),(.134,.264,.034),white,foot,.018)
    loft('Sneaker_upper_'+suffix,[(side*.11,-.045,.058,.064,.123),(side*.11,-.045,.086,.064,.123),(side*.11,-.040,.114,.055,.110),(side*.11,-.006,.142,.048,.060),(side*.11,.005,.161,.039,.042)],cream,foot,32,2)
    rounded('Heel_panel_'+suffix,(side*.11,.061,.104),(.085,.021,.068),navy,foot,.015)
    for i in range(4):
        y=-.084+i*.022;z=.144+i*.004
        line('Sneaker_laces',[(side*.11-.031,y,z),(side*.11,y-.004,z+.006),(side*.11+.031,y,z)],.003,white,foot)
    for offset in [-.042,.042]:
        line('Shoe_side_trim',[(side*.11+offset,-.114,.081),(side*.11+offset,-.031,.099),(side*.11+offset,.04,.106)],.003,navy,foot)

# The backpack is a focal point in the actual third-person camera.
rounded('Backpack_main',(0,.17,1.16),(.267,.16,.348),bagmat,bevel=.055)
rounded('Backpack_front_pocket',(0,.265,1.066),(.218,.051,.13),bagmat,bevel=.026)
rounded('Backpack_top_flap',(0,.23,1.313),(.247,.09,.074),bagmat,bevel=.026)
line('Pocket_zipper',[(-.093,.295,1.116),(0,.298,1.12),(.093,.295,1.116)],.003,metal)
rounded('Leather_label',(0,.299,1.077),(.05,.006,.034),leather,bevel=.005)
line('Label_diamond',[(-.009,.303,1.077),(0,.303,1.087),(.009,.303,1.077),(0,.303,1.067),(-.009,.303,1.077)],.0015,metal)
line('Backpack_handle',[(-.047,.148,1.335),(-.043,.15,1.39),(.04,.15,1.39),(.047,.148,1.335)],.008,leather)
for side in [-1,1]:
    strap_points=[(side*.105,.21,1.32),(side*.12,.14,1.395),(side*.145,.045,1.407),(side*.148,-.047,1.38),(side*.155,-.10,1.30),(side*.158,-.105,1.20),(side*.160,-.088,1.10),(side*.16,-.075,1.035),(side*.17,0,1.0),(side*.14,.15,1.01),(side*.108,.205,1.02)]
    tube('Shoulder_strap',strap_points,[.018]*len(strap_points),bagmat,'Chest',.22,8)
    line('Bag_edge_stitch',[(side*.104,.277,1.026),(side*.106,.286,1.071),(side*.103,.278,1.105)],.0013,cream)
    rounded('Bag_strap_buckle',(side*.155,-.092,1.175),(.031,.012,.026),metal,bevel=.004)
line('Bag_zip_pull',[(.101,.294,1.116),(.103,.297,1.083),(.112,.297,1.087)],.0025,metal)
line('Keychain_cord',[(.127,.216,1.15),(.157,.244,1.075)],.002,leather)
ell('Amber_bag_charm',(.157,.244,1.057),(.014,.010,.024),accent)

# Build editable humanoid armature and real skin weights.
bpy.ops.object.select_all(action='DESELECT')
arm=bpy.data.armatures.new('CampusTraveler_Rig');rig=bpy.data.objects.new('CampusTraveler_Rig',arm)
bpy.context.collection.objects.link(rig);bpy.context.view_layer.objects.active=rig;rig.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
def bone(name,head,tail,parent=None):
    b=arm.edit_bones.new(name);b.head=head;b.tail=tail
    if parent:b.parent=arm.edit_bones[parent]
bone('Root',(0,0,0),(0,0,.25))
bone('Hips',(0,0,.90),(0,0,1.02),'Root')
bone('Spine',(0,0,1.02),(0,0,1.25),'Hips')
bone('Chest',(0,0,1.25),(0,0,1.39),'Spine')
bone('Neck',(0,0,1.39),(0,0,1.49),'Chest')
bone('Head',(0,0,1.49),(0,0,1.76),'Neck')
for side,suffix in [(-1,'L'),(1,'R')]:
    bone('UpperArm_'+suffix,(side*.211,.012,1.332),(side*.277,.003,1.09),'Chest')
    bone('Forearm_'+suffix,(side*.277,.003,1.09),(side*.313,-.02,.881),'UpperArm_'+suffix)
    bone('Hand_'+suffix,(side*.313,-.02,.881),(side*.319,-.024,.78),'Forearm_'+suffix)
    bone('Thigh_'+suffix,(side*.105,0,.90),(side*.114,-.006,.52),'Hips')
    bone('Shin_'+suffix,(side*.114,-.006,.52),(side*.11,.003,.14),'Thigh_'+suffix)
    bone('Foot_'+suffix,(side*.11,.003,.14),(side*.11,-.15,.065),'Shin_'+suffix)
bpy.ops.object.mode_set(mode='OBJECT');rig.show_in_front=True
converted=[]
for obj in parts:
    bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj
    bpy.ops.object.convert(target='MESH');obj=bpy.context.object
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    bm=bmesh.new();bm.from_mesh(obj.data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(obj.data);bm.free()
    bn=obj.get('bind_bone','Chest')
    if 'knee_blend' in obj:
        suffix=obj['knee_blend'];up=obj.vertex_groups.new(name='Thigh_'+suffix);down=obj.vertex_groups.new(name='Shin_'+suffix)
        for v in obj.data.vertices:
            w=max(0,min(1,(v.co.z-.465)/.12));up.add([v.index],w,'REPLACE');down.add([v.index],1-w,'REPLACE')
    elif 'elbow_blend' in obj:
        suffix=obj['elbow_blend'];up=obj.vertex_groups.new(name='UpperArm_'+suffix);down=obj.vertex_groups.new(name='Forearm_'+suffix)
        for v in obj.data.vertices:
            w=max(0,min(1,(v.co.z-1.055)/.085));up.add([v.index],w,'REPLACE');down.add([v.index],1-w,'REPLACE')
    elif obj.name=='Jacket_body':
        chest=obj.vertex_groups.new(name='Chest');hip=obj.vertex_groups.new(name='Hips')
        for v in obj.data.vertices:
            w=max(0,min(1,(v.co.z-1.00)/.20));chest.add([v.index],w,'REPLACE');hip.add([v.index],1-w,'REPLACE')
    else:obj.vertex_groups.new(name=bn).add(list(range(len(obj.data.vertices))),1,'REPLACE')
    # Preserve semantic vertex selections through joining for editable facial shape keys.
    for feature in ['Eye_sclera','Iris','Pupil','Eye_catchlight','Upper_lid','Lower_lid','Brow','Mouth_open','Mouth','Lower_lip']:
        if obj.name.split('.')[0] == feature:
            obj.vertex_groups.new(name='Face_'+feature).add(list(range(len(obj.data.vertices))),1,'REPLACE')
    converted.append(obj)
bpy.ops.object.select_all(action='DESELECT')
for obj in converted:obj.select_set(True)
bpy.context.view_layer.objects.active=converted[0];bpy.ops.object.join()
body=bpy.context.object;body.name='CampusTraveler_SkinnedMesh'
body.shape_key_add(name='Basis')
face_groups={g.index:g.name[5:] for g in body.vertex_groups if g.name.startswith('Face_')}
for expression in ['Blink','Smile','Tired','Talk']:
    key=body.shape_key_add(name=expression)
    for v in body.data.vertices:
        feature=next((face_groups[g.group] for g in v.groups if g.group in face_groups),None)
        if not feature:continue
        co=key.data[v.index].co;x,y,z=v.co
        eye=feature in ['Eye_sclera','Iris','Pupil','Eye_catchlight','Upper_lid','Lower_lid']
        if expression in ['Blink','Tired'] and eye:
            amount=1 if expression=='Blink' else .4
            co.z=1.611+(z-1.611)*(1-.97*amount)
            if feature not in ['Upper_lid','Lower_lid']:co.y+=.015*amount
        if expression=='Smile':
            if feature=='Mouth':co.z+=.007*(min(1,abs(x)/.021)**1.5)
            if feature=='Brow':co.z+=.002
        if expression=='Tired':
            if feature=='Brow':co.z+=.004*(1-min(1,abs(x)/.08))
            if feature=='Mouth':co.z-=.002*min(1,abs(x)/.02)
        if expression=='Talk':
            if feature=='Mouth_open':co.z=1.535+(z-1.537)*12;co.y-=.005
            if feature=='Mouth':co.z-=.008*(1-min(1,abs(x)/.021)**2)
            if feature=='Lower_lip':co.z-=.007;co.y-=.002
mod=body.modifiers.new('Humanoid skin','ARMATURE');mod.object=rig;body.parent=rig
rig.animation_data_create()
for p in rig.pose.bones:p.rotation_mode='XYZ'
clips=[]
for name,length in [('Idle',80),('Walk',32),('Run',22),('Jump',12),('Fall',30),('Land',8),('Tired',48),('Talk',90)]:
    action=bpy.data.actions.new(name);rig.animation_data.action=action
    for frame in range(1,length+2,2):
        phase=(frame-1)/length*2*pi
        for b in rig.pose.bones:b.rotation_euler=(0,0,0);b.location=(0,0,0)
        if name=='Idle':
            rig.pose.bones['Chest'].rotation_euler.x=.012*sin(phase)
            rig.pose.bones['Head'].rotation_euler.z=.025*sin(phase)
            for suffix in ['L','R']:rig.pose.bones['Forearm_'+suffix].rotation_euler.x=-.07
        elif name in ['Walk','Run']:
            run=name=='Run';amp=.75 if run else .48
            for sign,suffix in [(1,'L'),(-1,'R')]:
                swing=sin(phase)*sign
                rig.pose.bones['Thigh_'+suffix].rotation_euler.x=amp*swing
                rig.pose.bones['Shin_'+suffix].rotation_euler.x=(1.3 if run else .72)*max(0,-swing)
                rig.pose.bones['Foot_'+suffix].rotation_euler.x=.12*swing
                rig.pose.bones['UpperArm_'+suffix].rotation_euler.x=-(.60 if run else .33)*swing
                rig.pose.bones['Forearm_'+suffix].rotation_euler.x=-.72 if run else -.16
            rig.pose.bones['Hips'].location.y=(.027 if run else .012)*(1-cos(phase*2))
            rig.pose.bones['Chest'].rotation_euler.x=.11 if run else .02
            rig.pose.bones['Chest'].rotation_euler.y=.045*sin(phase)
        elif name in ['Jump','Fall']:
            rig.pose.bones['Thigh_L'].rotation_euler.x=-.30;rig.pose.bones['Thigh_R'].rotation_euler.x=-.15
            rig.pose.bones['Shin_L'].rotation_euler.x=.5;rig.pose.bones['Shin_R'].rotation_euler.x=.3
            rig.pose.bones['UpperArm_L'].rotation_euler.x=-.3;rig.pose.bones['UpperArm_R'].rotation_euler.x=-.3
            rig.pose.bones['Forearm_L'].rotation_euler.x=-.4;rig.pose.bones['Forearm_R'].rotation_euler.x=-.4
            if name=='Fall':
                for suffix in ['L','R']:
                    rig.pose.bones['Thigh_'+suffix].rotation_euler.x=-.08
                    rig.pose.bones['Shin_'+suffix].rotation_euler.x=.16
                    rig.pose.bones['UpperArm_'+suffix].rotation_euler.z=.16 if suffix=='L' else -.16
        elif name=='Land':
            compression=sin(pi*(frame-1)/length)
            rig.pose.bones['Hips'].location.y=-.055*compression
            rig.pose.bones['Chest'].rotation_euler.x=.12*compression
            for suffix in ['L','R']:
                rig.pose.bones['Thigh_'+suffix].rotation_euler.x=-.23*compression
                rig.pose.bones['Shin_'+suffix].rotation_euler.x=.46*compression
                rig.pose.bones['Foot_'+suffix].rotation_euler.x=-.20*compression
                rig.pose.bones['Forearm_'+suffix].rotation_euler.x=-.15
        elif name=='Tired':
            rig.pose.bones['Chest'].rotation_euler.x=.16+.028*sin(phase)
            rig.pose.bones['Head'].rotation_euler.x=.09+.025*sin(phase+.6)
            for suffix in ['L','R']:
                rig.pose.bones['UpperArm_'+suffix].rotation_euler.x=-.12
                rig.pose.bones['Forearm_'+suffix].rotation_euler.x=-.25
        elif name=='Talk':
            rig.pose.bones['Head'].rotation_euler.x=.035*sin(phase*2)
            rig.pose.bones['Head'].rotation_euler.z=.035*sin(phase)
            rig.pose.bones['Chest'].rotation_euler.y=.025*sin(phase)
            rig.pose.bones['UpperArm_R'].rotation_euler.x=-.18-.08*sin(phase)
            rig.pose.bones['Forearm_R'].rotation_euler.x=-.65-.18*sin(phase)
            rig.pose.bones['Forearm_L'].rotation_euler.x=-.09
        for b in rig.pose.bones:
            b.keyframe_insert('rotation_euler',frame=frame,group=b.name)
            if b.name=='Hips':b.keyframe_insert('location',frame=frame,group=b.name)
    track=rig.animation_data.nla_tracks.new();track.name=name
    strip=track.strips.new(name,1,action);strip.action_frame_start=1;strip.action_frame_end=length+1
    clips.append(action)
rig.animation_data.action=None
for t in rig.animation_data.nla_tracks:t.mute=True
for b in rig.pose.bones:b.rotation_euler=(0,0,0);b.location=(0,0,0)
bpy.context.scene.render.fps=30

# Export only game geometry, with named animation clips.
bpy.ops.object.select_all(action='DESELECT');body.select_set(True);rig.select_set(True);bpy.context.view_layer.objects.active=rig
for t in rig.animation_data.nla_tracks:t.mute=False
bpy.ops.export_scene.gltf(filepath=os.path.join(ASSETS,'campus-traveler.glb'),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_force_sampling=True,export_nla_strips=True,export_yup=True)
for t in rig.animation_data.nla_tracks:t.mute=True
for b in rig.pose.bones:b.rotation_euler=(0,0,0);b.location=(0,0,0)
bpy.context.scene.frame_set(1)

# Editable studio presentation included in the .blend source.
ground=material('Studio_backdrop',(.14,.20,.21),.9)
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.008));bpy.context.object.name='Studio_floor';bpy.context.object.data.materials.append(ground)
def aim(obj,point):obj.rotation_euler=(Vector(point)-obj.location).to_track_quat('-Z','Y').to_euler()
def light(name,loc,power,size,color):
    data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size;data.color=color
    ob=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(ob);ob.location=loc;aim(ob,(0,0,1))
light('Key_softbox',(-3,-4,5),500,4,(1,.87,.73));light('Fill_softbox',(3,-2,3),280,3,(.74,.85,1));light('Rim_softbox',(0,3,4),650,3,(1,.90,.74))
bpy.ops.object.camera_add(location=(2.6,-4.8,2.4));cam=bpy.context.object;cam.name='Character_portrait_camera';cam.data.type='ORTHO';cam.data.ortho_scale=2.18;aim(cam,(0,0,.93));bpy.context.scene.camera=cam
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=True
scene.render.resolution_x=900;scene.render.resolution_y=1050;scene.render.resolution_percentage=100
scene.world.color=(.22,.22,.22);scene.view_settings.view_transform='AgX'
scene.render.image_settings.file_format='PNG'
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type=='VIEW_3D':
            space=area.spaces.active;space.shading.type='SOLID';space.shading.color_type='MATERIAL'
            space.overlay.show_overlays=False;space.region_3d.view_location=(0,0,.94)
            space.region_3d.view_distance=3;space.region_3d.view_rotation=cam.rotation_euler.to_quaternion()
bpy.ops.object.select_all(action='DESELECT');body.select_set(True);bpy.context.view_layer.objects.active=body
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE,'campus-traveler.blend'))
summary={'vertices':len(body.data.vertices),'triangles':sum(len(p.vertices)-2 for p in body.data.polygons),'bones':len(arm.bones),'materials':len(body.data.materials),'clips':[a.name for a in clips],'expressions':[k.name for k in body.data.shape_keys.key_blocks if k.name!='Basis'],'height_m':round(body.dimensions.z,3)}
with open(os.path.join(HERE,'model-info.json'),'w',encoding='utf8') as f:json.dump(summary,f,ensure_ascii=False,indent=2)
for name,loc in ([] if '--skip-renders' in sys.argv else [('front',(2.2,-5,2.2)),('back',(-2.2,5,2.2))]):
    cam.location=loc;aim(cam,(0,0,.94));scene.render.filepath=os.path.join(HERE,'traveler-'+name+'.png');bpy.ops.render.render(write_still=True)
print('CHARACTER_COMPLETE',json.dumps(summary))
