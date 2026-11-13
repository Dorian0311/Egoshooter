/** Ambient routes on dry, unobstructed streets in both maps. */
export function wandererPose(index:number,timeSeconds:number){
 const x=[-65,65,-35,35][index],extent=index<2?32:16,speed=.65+index*.09;
 const travel=extent*2/speed,pause=4,period=2*(travel+pause);
 const phase=((timeSeconds+index*19)%period+period)%period;
 const returning=phase>=travel+pause,leg=returning?phase-travel-pause:phase;
 const distance=Math.min(leg,travel)*speed;
 return {x,z:returning?extent-distance:-extent+distance,yaw:returning?0:Math.PI,walking:leg<travel};
}
