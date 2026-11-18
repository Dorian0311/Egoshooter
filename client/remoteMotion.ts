type Pose={x:number;y:number;z:number;yaw:number;pitch:number};
type Sample=Pose&{time:number};

/** Render remote actors on a short server-time history instead of chasing each
 * packet. A 100 ms buffer covers two 20 Hz snapshots; packet jitter only slowly
 * adjusts the clock. Never extrapolate through walls when packets stop. */
export class RemoteMotion {
 private samples:Sample[]=[];
 private clockOffset=0;
 private renderedAt=-Infinity;
 private pose:Pose={x:0,y:0,z:0,yaw:0,pitch:0};
 push(p:Pose,time:number,receivedAt:number,reset=false){
  const latest=this.samples.at(-1);
  if(!latest||reset||time<latest.time||time-latest.time>500||Math.hypot(p.x-latest.x,p.y-latest.y,p.z-latest.z)>3){
   this.samples.length=0;this.clockOffset=time-receivedAt;this.renderedAt=-Infinity;
  }else if(time>latest.time){
   this.clockOffset+=Math.max(-50,Math.min(50,time-receivedAt-this.clockOffset))*.05;
  }
  const sample={x:p.x,y:p.y,z:p.z,yaw:p.yaw,pitch:p.pitch,time};
  if(this.samples.at(-1)?.time===time)this.samples[this.samples.length-1]=sample;
  else this.samples.push(sample);
  if(this.samples.length>16)this.samples.shift();
 }
 sample(now:number):Readonly<Pose>{
  if(!this.samples.length)return this.pose;
  const time=Math.max(this.renderedAt,now+this.clockOffset-100);this.renderedAt=time;
  while(this.samples.length>2&&this.samples[1].time<=time)this.samples.shift();
  const a=this.samples[0],b=this.samples[1]??a;
  const alpha=b.time===a.time?1:Math.max(0,Math.min(1,(time-a.time)/(b.time-a.time)));
  this.pose.x=a.x+(b.x-a.x)*alpha;this.pose.y=a.y+(b.y-a.y)*alpha;this.pose.z=a.z+(b.z-a.z)*alpha;
  this.pose.yaw=a.yaw+Math.atan2(Math.sin(b.yaw-a.yaw),Math.cos(b.yaw-a.yaw))*alpha;
  this.pose.pitch=a.pitch+(b.pitch-a.pitch)*alpha;
  return this.pose;
 }
}
