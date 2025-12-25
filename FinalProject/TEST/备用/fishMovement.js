// fishMovement.js
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.152.2/build/three.module.js';
import { TANK_WIDTH, WATER_TOP, TANK_BOTTOM_Y } from './object.js';

class Fish {
    constructor(mesh){
        this.mesh=mesh;
        this.velocity=new THREE.Vector3((Math.random()-0.5)*2,(Math.random()-0.5)*0.5,(Math.random()-0.5)*2);
        this.acceleration=new THREE.Vector3();
        this.maxSpeed=2; this.maxForce=0.3;
    }
    update(fishes, dt=1){
        const randomForce=new THREE.Vector3((Math.random()-0.5)*this.maxForce,(Math.random()-0.5)*this.maxForce*0.5,(Math.random()-0.5)*this.maxForce);
        this.acceleration.copy(randomForce);

        // ===== 鱼缸边界限制（防止鱼游出玻璃） =====
        const margin = 1.2; // 安全边距，考虑鱼模型大小
        const halfWidth = TANK_WIDTH / 2 - margin;
        const halfDepth = TANK_WIDTH / 2 - margin;
        const yMin = TANK_BOTTOM_Y + 1 + margin * 0.2;
        const yMax = TANK_BOTTOM_Y + WATER_TOP - margin;
        let vel=this.velocity.clone(); const speed=vel.length(); const wallForce=0.05;

        if(this.mesh.position.x<-halfWidth+0.5) vel.x+=wallForce*(-halfWidth+0.5-this.mesh.position.x);
        if(this.mesh.position.x>halfWidth-0.5) vel.x+=wallForce*(halfWidth-0.5-this.mesh.position.x);
        if(this.mesh.position.z<-halfDepth+0.5) vel.z+=wallForce*(-halfDepth+0.5-this.mesh.position.z);
        if(this.mesh.position.z>halfDepth-0.5) vel.z+=wallForce*(halfDepth-0.5-this.mesh.position.z);
        if(this.mesh.position.y<yMin+0.5) vel.y+=wallForce*(yMin+0.5-this.mesh.position.y);
        if(this.mesh.position.y>yMax-0.5) vel.y+=wallForce*(yMax-0.5-this.mesh.position.y);

        this.velocity.lerp(vel.setLength(speed || this.maxSpeed),0.1);
        this.mesh.position.addScaledVector(this.velocity,dt);

        // 硬性位置裁剪，绝对不允许出界
        this.mesh.position.x = THREE.MathUtils.clamp(this.mesh.position.x, -halfWidth, halfWidth);
        this.mesh.position.z = THREE.MathUtils.clamp(this.mesh.position.z, -halfDepth, halfDepth);
        this.mesh.position.y = THREE.MathUtils.clamp(this.mesh.position.y, yMin, yMax);

        if(this.velocity.length()>0){
            this.mesh.rotation.y=Math.atan2(this.velocity.x,this.velocity.z);
            this.mesh.rotation.x=-Math.atan2(this.velocity.y,new THREE.Vector2(this.velocity.x,this.velocity.z).length());
        }
        const time=performance.now()*0.002; const wave=Math.sin(time*5+this.mesh.position.x*0.3)*0.15;
        this.mesh.rotation.y+=wave*0.2; this.mesh.rotation.z=wave*0.1;
    }
}

export const FishMovement={
    init(fishMeshes){ window.fishObjs=fishMeshes.map(f=>new Fish(f)); },
    update(dt){ if(window.fishObjs) window.fishObjs.forEach(f=>f.update(window.fishObjs,dt)); }
};
