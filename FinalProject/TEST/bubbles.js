// bubbles.js
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.152.2/build/three.module.js';
import { TANK_WIDTH, TANK_DEPTH, WATER_TOP, TANK_BOTTOM_Y } from './object.js';

export class BubbleSystem {
    // ⚠️ 注意：构造函数增加了一个 renderer 参数，用于实时拍照
    constructor(scene, renderer, count = 120) {
        this.count = count;
        this.scene = scene;
        this.renderer = renderer;

        // === 1. 创建实时反射相机 (CubeCamera) ===
        // 分辨率设为 256 即可，气泡很小，不需要太高清，保证流畅度
        const cubeRenderTarget = new THREE.WebGLCubeRenderTarget(256, {
            generateMipmaps: true,
            minFilter: THREE.LinearMipmapLinearFilter,
            format: THREE.RGBAFormat,
            colorSpace: THREE.SRGBColorSpace
        });

        // 创建全景相机
        this.cubeCamera = new THREE.CubeCamera(0.1, 1000, cubeRenderTarget);
        
        // 把相机放在鱼缸中心位置，这样反射的视角最自然
        this.cubeCamera.position.set(0, TANK_BOTTOM_Y + WATER_TOP / 2, 0);
        scene.add(this.cubeCamera);

        // === 2. 几何体 ===
        const geometry = new THREE.SphereGeometry(1, 32, 32);

        // === 3. 物理材质 ===
        const material = new THREE.MeshPhysicalMaterial({
            color: 0xffffff,
            transmission: 1.0,
            opacity: 1.0,
            roughness: 0.0,
            metalness: 0.1, // 保持少量金属感
            
            // ⭐️ 关键：把全景相机的拍摄结果作为环境贴图
            envMap: cubeRenderTarget.texture,
            envMapIntensity: 2.0, // 强度
            
            ior: 1.45,
            thickness: 0.1,
            specularIntensity: 2.0,
            clearcoat: 1.0,
            clearcoatRoughness: 0.0,
            side: THREE.FrontSide
        });

        // === 4. 实例化网格 ===
        this.mesh = new THREE.InstancedMesh(geometry, material, count);
        this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.mesh.castShadow = true; 
        scene.add(this.mesh);

        // === 5. 初始化粒子 ===
        this.particles = [];
        this.dummy = new THREE.Object3D();

        for (let i = 0; i < count; i++) {
            this.particles.push({
                x: 0, y: -1000, z: 0,
                baseScale: 0, 
                speed: 0.6 + Math.random() * 0.8,
                angle: Math.random() * Math.PI * 2,
                wobblePhase: Math.random() * Math.PI * 2,
                active: false,
                maxSize: 0.06 + Math.random() * 0.06, 
                growthRate: 0.3 + Math.random() * 0.3
            });
            
            this.dummy.position.set(0, -1000, 0);
            this.dummy.scale.set(0, 0, 0);
            this.dummy.updateMatrix();
            this.mesh.setMatrixAt(i, this.dummy.matrix);
        }
    }

    update(dt, time) {
        if (!this.mesh.visible) return;

        // === ⭐️ 核心：每一帧都更新反射画面 ===
        if (this.renderer && this.cubeCamera) {
            // 1. 先把自己隐藏起来 (防止气泡反射气泡自己，产生怪异遮挡)
            this.mesh.visible = false;
            
            // 2. 拍照 (更新环境贴图)
            this.cubeCamera.update(this.renderer, this.scene);
            
            // 3. 再把自己显示出来
            this.mesh.visible = true;
        }

        const fishes = window.fishObjs || [];
        const spawnRate = 0.06; 
        let needsUpdate = false;

        for (let i = 0; i < this.count; i++) {
            const p = this.particles[i];
            
            if (p.active) {
                p.y += p.speed * dt;
                
                // 螺旋上升
                const radius = 0.05; 
                const spiralSpeed = 3.0;
                const offsetX = Math.sin(time * spiralSpeed + p.angle) * radius;
                const offsetZ = Math.cos(time * spiralSpeed + p.angle) * radius;
                
                // 生长
                if (p.baseScale < p.maxSize) { 
                    p.baseScale += p.growthRate * dt;
                }
                
                // 形变
                const wobbleFrequency = 8.0; 
                const wobbleAmount = 0.15;   
                const deformation = Math.sin(time * wobbleFrequency + p.wobblePhase) * wobbleAmount;
                
                const scaleY = p.baseScale * (1 + deformation);
                const scaleXZ = p.baseScale * (1 - deformation * 0.5);

                // 死亡
                if (p.y > TANK_BOTTOM_Y + WATER_TOP) {
                    p.active = false;
                    p.y = -1000;
                    p.baseScale = 0;
                }

                this.dummy.position.set(p.x + offsetX, p.y, p.z + offsetZ);
                this.dummy.scale.set(scaleXZ, scaleY, scaleXZ);
                this.dummy.updateMatrix();
                
                this.mesh.setMatrixAt(i, this.dummy.matrix);
                needsUpdate = true;

            } else {
                if (fishes.length > 0 && Math.random() < spawnRate) {
                    const randomFish = fishes[Math.floor(Math.random() * fishes.length)];
                    p.active = true;
                    const fishDir = new THREE.Vector3(0, 0, 1).applyEuler(randomFish.mesh.rotation);
                    p.x = randomFish.mesh.position.x + fishDir.x * 0.75;
                    p.y = randomFish.mesh.position.y + 0.15;
                    p.z = randomFish.mesh.position.z + fishDir.z * 0.75;
                    p.baseScale = 0.02; 
                    p.wobblePhase = Math.random() * Math.PI * 2; 
                    
                    this.dummy.position.set(p.x, p.y, p.z);
                    this.dummy.scale.set(p.baseScale, p.baseScale, p.baseScale);
                    this.dummy.updateMatrix();
                    this.mesh.setMatrixAt(i, this.dummy.matrix);
                    needsUpdate = true;
                }
            }
        }
        
        if (needsUpdate) {
            this.mesh.instanceMatrix.needsUpdate = true;
        }
    }
}