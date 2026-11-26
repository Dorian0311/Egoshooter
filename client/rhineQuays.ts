type Point=[number,number,number];
type Face=(points:Point[],tile:number,shade?:number)=>void;

/** Add quay details to the existing textured quarter batch. Local depth is measured out from the river wall. */
export function addRhineQuays(face:Face){
  for(const side of [-1,1]){
    const p=(d:number,y:number,z:number):Point=>[side*(30-d),y,z];
    function front(d:number,z0:number,z1:number,bottom:number,top:number,tile:number,tone:number){
      const corners=[p(d,bottom,z0),p(d,bottom,z1),p(d,top,z1),p(d,top,z0)];
      face(side===1?corners:corners.reverse(),tile,tone);
    }
    function top(d0:number,d1:number,z0:number,z1:number,y:number,tile:number,tone:number){
      const corners=[p(d0,y,z0),p(d1,y,z0),p(d1,y,z1),p(d0,y,z1)];
      face(side===1?corners:corners.reverse(),tile,tone);
    }
    function end(d0:number,d1:number,y0:number,y1:number,z:number,tile:number,tone:number,direction:number){
      const corners=[p(d0,y0,z),p(d0,y1,z),p(d1,y1,z),p(d1,y0,z)];
      face(side*direction===1?corners:corners.reverse(),tile,tone);
    }
    function block(d0:number,d1:number,z0:number,z1:number,low:number,high:number,tile:number,tone:number){
      front(d1,z0,z1,low,high,tile,tone);top(d0,d1,z0,z1,high,tile,tone);
      end(d0,d1,low,high,z0,tile,tone*.95,-1);end(d0,d1,low,high,z1,tile,tone*.95,1);
    }
    // River level lies at -4 m. Algae and flood-darkened stone occupy the lower courses.
    // Stagger joints between low and high courses instead of stretching a district tile over each wall.
    for(let row=0;row<3;row++){
      const bottom=[-4.58,-3.18,-1.49][row],high=[-3.18,-1.49,-.11][row];
      let start=-126-(row%2)*1.75;
      for(let section=0;start<126;section++){
        const length=3.55+.52*Math.sin(section*1.91+row*.83+side*.7);
        const z0=Math.max(-126,start),z1=Math.min(126,start+length);
        const shade=[.46,.76,.94][row]+.038*Math.sin(section*1.57+row*2.14);
        if(z1-z0>.03)front(.036,z0,z1,bottom,high,14,shade);
        start+=length;
      }
    }
    for(let z=-126;z<126;z+=2.4){
      // Setts projecting over the water leave the existing riverbank walking surface open.
      block(-.18,.36,z+.017,z+2.385,-.23,.071,14,1.13);
    }
    for(const z of [-58,-31,-12,12,38,62]){
      // Projecting battered pilasters carry a continuous cornice and break up the long flat wall.
      const corners=[p(.57,-4.35,z-.57),p(.57,-4.35,z+.57),p(.30,-.29,z+.42),p(.30,-.29,z-.42)];
      face(side===1?corners:corners.reverse(),14,.86);
      for(const e of [-1,1]){
        const pts=[p(0,-4.35,z+e*.57),p(.57,-4.35,z+e*.57),p(.30,-.29,z+e*.42),p(0,-.29,z+e*.42)];
        face(side*e===-1?pts:pts.reverse(),14,.76);
      }
      block(0,.46,z-.56,z+.56,-.47,-.24,14,1.03);
    }
    if(side===1){
      for(const z of [-12,12]){
        // Clipped corners carry the east-bank pilasters up from the river.
        // Above the coping the entire portal stays over water, outside the deck.
        const x=28.20;
        function course(y:number,rx:number,rz:number):Point[]{
          const cut=Math.min(rx,rz)*.28;
          return [[x-rx+cut,y,z+rz],[x+rx-cut,y,z+rz],[x+rx,y,z+rz-cut],[x+rx,y,z-rz+cut],
            [x+rx-cut,y,z-rz],[x-rx+cut,y,z-rz],[x-rx,y,z-rz+cut],[x-rx,y,z+rz-cut]];
        }
        const courses:[number,number,number,number][]=[
          [-4.46,1.82,1.68,.58],[-1.62,1.75,1.58,.71],[-.31,1.76,1.58,.88],[.08,1.43,1.43,.94],
          [.52,1.42,1.42,1.02],[.63,1.30,1.30,.83],[1.02,1.30,1.30,.90],[1.10,1.23,1.23,1.04],
          [3.42,1.19,1.19,.90],[4.76,1.17,1.17,.94],[4.84,1.30,1.30,.80],[5.03,1.35,1.35,1.05],
          [5.13,1.23,1.23,.91],[5.49,1.22,1.22,.83],[5.59,1.33,1.33,1.06],[5.98,.94,.94,.98]
        ];
        const [baseY,baseX,baseZ]=courses[0];
        let lower=course(baseY,baseX,baseZ);
        for(const [y,rx,rz,tone] of courses.slice(1)){
          const upper=course(y,rx,rz);
          for(let j=0;j<8;j++){
            const k=(j+1)%8;
            face([lower[j],lower[k],upper[k],upper[j]],14,tone);
          }
          lower=upper;
        }
        for(let j=0;j<8;j++)face([lower[j],lower[(j+1)%8],[x,6.20,z]],9,.90);
        // Blind round-headed panels on both approaches, enclosed by projecting
        // stone jambs and wedge-shaped arch stones. Keep their faces streetward.
        for(const view of [-1,1]){
          const at=(depth:number,y:number,width:number):Point=>[x+view*depth,y,z-view*width];
          const coreY=3.03,inner=.52,outer=.68;
          const ring=(r:number,a:number)=>at(1.253,coreY+r*Math.sin(a),r*Math.cos(a));
          face([at(1.23,1.47,-inner),at(1.23,1.47,inner),at(1.23,coreY,inner),at(1.23,coreY,-inner)],9,.51);
          for(let i=0;i<9;i++){
            const a=i*Math.PI/9,b=(i+1)*Math.PI/9;
            face([at(1.23,coreY,0),at(1.23,coreY+inner*Math.sin(a),inner*Math.cos(a)),
              at(1.23,coreY+inner*Math.sin(b),inner*Math.cos(b))],9,.51);
            face([ring(inner,a),ring(outer,a),ring(outer,b),ring(inner,b)],14,i===4?1.11:.99);
          }
          for(const start of [-outer,inner])
            face([at(1.25,1.43,start),at(1.25,1.43,start+outer-inner),at(1.25,coreY,start+outer-inner),at(1.25,coreY,start)],14,.98);
        }
      }
    }
    for(const z of (side===1?[-51,-22,46]:[-43,26,57])){
      const cy=-2.42,r=.63,outer=.86;
      front(.095,z-r,z+r,cy-.72,cy,9,.22);
      // A round-headed storm outfall with cut voussoirs, vertical grate bars and a wet stone sill.
      for(let i=0;i<11;i++){
        const a=i*Math.PI/11,b=(i+1)*Math.PI/11;
        const ring=(depth:number,rad:number,t:number)=>p(depth,cy+Math.sin(t)*rad,z+Math.cos(t)*rad);
        const core=[p(.093,cy,z),ring(.093,r,a),ring(.093,r,b)];
        face(side===1?core:core.reverse(),9,.21);
        const arch=[ring(.14,r,a+.013),ring(.14,outer,a+.013),ring(.14,outer,b-.013),ring(.14,r,b-.013)];
        face(side===1?arch:arch.reverse(),14,i===5?1.15:1.01);
      }
      for(const j of [-2,-1,0,1,2]){
        const dz=j*.21;
        block(.11,.17,z+dz-.025,z+dz+.025,cy-.71,cy+Math.sqrt(r*r-dz*dz)-.01,9,.49);
      }
      block(0,.37,z-.86,z+.86,cy-.85,cy-.71,14,.85);
    }
    // Mooring eyes hang on the river-facing wall, below the walking surface.
    for(const z of [-64,-39,-16,18,45,66]){
      block(.04,.17,z-.24,z+.24,-.68,-.33,9,.53);
      const center=-.73;
      for(let i=0;i<16;i++){
        const a=i*Math.PI/8,b=(i+1)*Math.PI/8;
        const ring=(r:number,t:number)=>p(.20,center+r*Math.sin(t),z+r*Math.cos(t));
        const strip=[ring(.23,a),ring(.29,a),ring(.29,b),ring(.23,b)];
        face(side===1?strip:strip.reverse(),9,.44);
      }
    }
    // Both flights are outside the playable z limits; their treads descend alongshore to the boat.
    const origin=side===1?-96:77;
    for(let step=0;step<22;step++){
      const z=origin+step*.61,tread=.04-step*.18;
      block(.03,2.0,z,z+.612,-4.44,tread,14,.93-.009*step);
      front(2.03,z+.012,z+.60,tread-.16,tread,14,1.07-.009*step);
    }
    block(.03,2.70,origin+13.43,origin+17.0,-4.44,-3.74,14,.75);
    for(const z of [origin+14.0,origin+16.45]){
      block(2.12,2.42,z-.17,z+.17,-3.75,-3.18,9,.51);
      block(2.06,2.48,z-.26,z+.26,-3.24,-3.13,9,.55);
    }
  }
}
