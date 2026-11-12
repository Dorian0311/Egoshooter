import json,numpy as np
from scipy.spatial import cKDTree
from pathlib import Path
root=Path('public/shooter/characters/greatcoat');body=json.load(open('public/shooter/characters/humanoid.json'));base=np.array(body['positions']).reshape(-1,3);si=np.array(body['skinIndex']).reshape(-1,4);sw=np.array(body['skinWeight']).reshape(-1,4)
pieces=json.load(open(Path('research/greatcoat-source-geometry.json')));tree=cKDTree(base)
for p in pieces:
 pos=np.array(p['positions']).reshape(-1,3);
 if p['name']=='BODY':pos[:,1]+=np.clip((pos[:,1]-1.1)/.4,0,1)*.075
 p['positions']=pos.ravel().tolist();distance,index=tree.query(pos,k=3);outI=[];outW=[]
 for i in range(len(pos)):
  factors=1/np.maximum(distance[i],.005);factors/=factors.sum();weights={}
  for vertex,factor in zip(index[i],factors):
   for bone,w in zip(si[vertex],sw[vertex]):weights[int(bone)]=weights.get(int(bone),0)+float(w*factor)
  top=sorted(weights.items(),key=lambda x:-x[1])[:4]
  while len(top)<4:top.append((0,0))
  total=sum(v for _,v in top);outI.extend(k for k,_ in top);outW.extend(round(v/total,6) for _,v in top)
 p['skinIndex']=outI;p['skinWeight']=outW
 for key in ['positions','normal','uv']:p[key]=[round(v,6) for v in p[key]]
(root/'rigged.json').write_text(json.dumps(pieces,separators=(',',':')))
print('Rigged vertices',sum(len(p['positions'])//3 for p in pieces))
