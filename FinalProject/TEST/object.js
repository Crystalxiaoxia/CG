// objects.js
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.152.2/build/three.module.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.152.2/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'https://cdn.jsdelivr.net/npm/three@0.152.2/examples/jsm/utils/SkeletonUtils.js';

export const TANK_WIDTH = 10;
export const TANK_DEPTH = 10;
export const WATER_TOP = 10;
export const FLOOR_Y = -75;        
export const LEG_BOTTOM_Y = FLOOR_Y;   
const LEG_TOP_Y_ORIG = 5;        
export const TABLE_THICKNESS = 0.5;

const ORIGINAL_TABLE_TOP_SURFACE_Y = LEG_TOP_Y_ORIG + TABLE_THICKNESS;
const ORIGINAL_TABLE_HEIGHT = ORIGINAL_TABLE_TOP_SURFACE_Y - FLOOR_Y;
const NEW_TABLE_HEIGHT = ORIGINAL_TABLE_HEIGHT * 0.5; 

export const TABLE_TOP_SURFACE_Y = FLOOR_Y + NEW_TABLE_HEIGHT; 
export const LEG_TOP_Y = TABLE_TOP_SURFACE_Y - TABLE_THICKNESS; 
export const TABLE_HEIGHT = TABLE_TOP_SURFACE_Y - FLOOR_Y;        
export const TANK_BOTTOM_Y = TABLE_TOP_SURFACE_Y;  
const FISH_COUNT = 15;

function fixMaterial(obj) {
    obj.traverse(n => {
        if (n.isMesh) {
            n.castShadow = true;
            n.receiveShadow = true; 
            n.shadowSide = THREE.DoubleSide; 
            if (n.material) {
                const materials = Array.isArray(n.material) ? n.material : [n.material];
                materials.forEach(mat => {
                    mat.side = THREE.DoubleSide;
                    mat.depthWrite = true;
                    if (mat.transparent === true || mat.map || mat.alphaMap) {
                        mat.alphaTest = 0.5; 
                        mat.transparent = false; 
                        mat.needsUpdate = true;
                    }
                });
            }
        }
    });
}

export function randomNonOverlapPosition(existingObjects, radius, yLevel=0){
    let pos = new THREE.Vector3(); 
    let attempts = 0;
    const wallPadding = 1.5; 
    const safeWidth = Math.max(0.1, TANK_WIDTH - (radius + wallPadding) * 2);
    const safeDepth = Math.max(0.1, TANK_DEPTH - (radius + wallPadding) * 2);

    while(attempts < 50) {
        attempts++;
        pos.set(
            (Math.random() - 0.5) * safeWidth,
            yLevel + TANK_BOTTOM_Y,
            (Math.random() - 0.5) * safeDepth
        );
        let overlap = false;
        for (const obj of existingObjects) {
            if (pos.distanceTo(obj.position) < radius * 1.5 + 1.0) { 
                overlap = true; 
                break;
            }
        }
        if (!overlap) break;
    }
    return pos;
}

export function loadObjects(scene, callback) {
    const loader = new GLTFLoader();
    const objects = { fishes: [], grass: [], stone: [] };
    const bottomObjects = [];
    let fishLoaded = false, grassLoaded = false, stoneLoaded = false;

    function checkAllLoaded() { if(fishLoaded && grassLoaded && stoneLoaded) callback(objects); }

    // fish
    loader.load('./models/fish/scene.gltf', gltf => {
        const fishBase = gltf.scene;
        fixMaterial(fishBase); 

        for (let i = 0; i < FISH_COUNT; i++) {
            const fish = SkeletonUtils.clone(fishBase);
            const s = 0.5 + Math.random() * 0.3;
            fish.scale.set(s, s, s);
            const y = TANK_BOTTOM_Y + 1.5 + Math.random() * (WATER_TOP - 3);
            fish.position.set(
                (Math.random() - 0.5) * (TANK_WIDTH - 2), 
                y, 
                (Math.random() - 0.5) * (TANK_DEPTH - 2)
            );
            fish.rotation.y = Math.random() * Math.PI * 2;
            
            fish.userData.velocity = new THREE.Vector3(
                Math.random() - 0.5, 
                (Math.random() - 0.5) * 0.2, 
                Math.random() - 0.5
            ).normalize().multiplyScalar(2.0);

            fixMaterial(fish);
            scene.add(fish); objects.fishes.push(fish);
        }
        fishLoaded = true; checkAllLoaded();
    });

    // grass
    loader.load('./models/grass/scene.gltf', gltf => {
        const grassBase = gltf.scene; 
        const grassCount = Math.floor(Math.random() * 3) + 1;
        for (let i = 0; i < grassCount; i++) {
            const grass = SkeletonUtils.clone(grassBase);
            const scale = 0.5 + Math.random() * 1.5;
            grass.scale.set(scale, scale, scale);
            const radius = 1.0 * scale; 
            const pos = randomNonOverlapPosition(bottomObjects, radius, 0); 
            grass.position.copy(pos);
            grass.rotation.y = Math.random() * Math.PI * 2;
            fixMaterial(grass); 
            scene.add(grass); objects.grass.push(grass); bottomObjects.push(grass);
        }
        grassLoaded = true; checkAllLoaded();
    });

    // stone
    loader.load('./models/stone/scene.gltf', gltf => {
        const stone = gltf.scene; 
        stone.scale.set(6, 6, 6);
        const margin = 3.2;
        const cornerX = (Math.random() > 0.5 ? 1 : -1) * (TANK_WIDTH / 2 - margin);
        const cornerZ = (Math.random() > 0.5 ? 1 : -1) * (TANK_DEPTH / 2 - margin);
        stone.position.set(cornerX, TANK_BOTTOM_Y, cornerZ);
        stone.rotation.y = Math.random() * Math.PI * 2;
        fixMaterial(stone); 
        scene.add(stone); objects.stone.push(stone); bottomObjects.push(stone);
        stoneLoaded = true; checkAllLoaded();
    });

    // 海底地面 (平铺修正版)
    // 海底地面 (修复版)
    loader.load('./models/ground/coast_sand_rocks_02_1k.gltf', gltf => {
        let originalMesh = null;
        gltf.scene.traverse(child => {
            if (child.isMesh && !originalMesh) {
                originalMesh = child;
            }
        });

        if (originalMesh && originalMesh.material) {
            // 克隆材质，防止修改影响到原模型（如果有其他用途的话）
            const oldMat = originalMesh.material.clone();
            
            // 修正贴图属性
            const fixTexture = (tex) => {
                if (!tex) return;
                tex.wrapS = THREE.RepeatWrapping;
                tex.wrapT = THREE.RepeatWrapping;
                tex.repeat.set(2, 2); 
                // 🔴 关键修复 1: GLTF 贴图在 PlaneGeometry 上通常需要设为 false
                tex.flipY = false; 
                tex.needsUpdate = true;
            };

            fixTexture(oldMat.map);
            fixTexture(oldMat.normalMap);
            fixTexture(oldMat.roughnessMap);
            fixTexture(oldMat.aoMap);

            if (oldMat.map) oldMat.map.colorSpace = THREE.SRGBColorSpace;

            // 🔴 关键修复 2: 强制关闭透明，防止渲染层级问题
            oldMat.transparent = false;
            oldMat.depthWrite = true;
            oldMat.side = THREE.FrontSide; // 地面只需要渲染正面

            const planeGeo = new THREE.PlaneGeometry(TANK_WIDTH, TANK_DEPTH);
            const groundPlane = new THREE.Mesh(planeGeo, oldMat);
            
            groundPlane.rotation.x = -Math.PI / 2;

            // 🔴 关键修复 3: 抬高高度 (微移)，解决 Z-Fighting 闪烁问题
            // 确保它在桌子表面 (TANK_BOTTOM_Y) 之上一点点
            groundPlane.position.set(0, TANK_BOTTOM_Y + 0.02, 0); 
            
            groundPlane.receiveShadow = true;
            scene.add(groundPlane);
            
            bottomObjects.push(groundPlane);
            console.log("✅ 地面修复完成：解决了坐标冲突与贴图翻转");
        }
    });
}