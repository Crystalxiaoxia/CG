// --- fishTank.js ---
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.152.2/build/three.module.js';
import { TANK_WIDTH, TANK_DEPTH, WATER_TOP, TANK_BOTTOM_Y } from './object.js';

export function createFishTank(scene) {
    const TANK_HEIGHT = 10;
    const tankBottomY = TANK_BOTTOM_Y;

    // 1. 玻璃壁 (保持原有设置)
    const glassMat = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        transmission: 1.0,
        opacity: 0.3,
        metalness: 0,
        roughness: 0,
        ior: 1.5,
        thickness: 0.5,
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false
    });

    const createPanel = (w, h, x, y, z, rx, ry) => {
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), glassMat);
        mesh.position.set(x, y, z);
        if(rx) mesh.rotation.x = rx;
        if(ry) mesh.rotation.y = ry;
        mesh.castShadow = false;
        mesh.receiveShadow = false;
        scene.add(mesh);
        return mesh;
    };

    createPanel(TANK_DEPTH, TANK_HEIGHT, -TANK_WIDTH/2, tankBottomY + TANK_HEIGHT/2, 0, 0, Math.PI/2);
    createPanel(TANK_DEPTH, TANK_HEIGHT, TANK_WIDTH/2, tankBottomY + TANK_HEIGHT/2, 0, 0, -Math.PI/2);
    createPanel(TANK_WIDTH, TANK_HEIGHT, 0, tankBottomY + TANK_HEIGHT/2, -TANK_DEPTH/2, 0, 0);
    createPanel(TANK_WIDTH, TANK_HEIGHT, 0, tankBottomY + TANK_HEIGHT/2, TANK_DEPTH/2, 0, 0);

    // 2. 实体水体 (修正点：提升几何精度 + 复杂波浪算法)
    const waterHeight = WATER_TOP - 0.5;
    const waterGeometry = new THREE.BoxGeometry(
        TANK_WIDTH - 0.4, 
        waterHeight, 
        TANK_DEPTH - 0.4, 
        256, 1, 256 // 🔴 提升分段数以支持细腻波浪
    );

    const textureLoader = new THREE.TextureLoader();
    const normalMap = textureLoader.load('textures/waternormals.jpg', (t) => {
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.repeat.set(4, 4); // 🔴 增加重复率
    });

    const waterMaterial = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        transmission: 0.98,
        opacity: 1.0,
        attenuationColor: new THREE.Color(0x70d0ff), 
        attenuationDistance: 40.0, 
        thickness: 10.0,
        ior: 1.33,
        roughness: 0.02,
        metalness: 0.1,
        normalMap: normalMap,
        normalScale: new THREE.Vector2(0.8, 0.8), // 初始细微涟漪强度
        clearcoat: 1.0,
        side: THREE.FrontSide,
        depthWrite: false 
    });

    waterMaterial.onBeforeCompile = function (shader) {
        shader.uniforms.time = { value: 0 };
        shader.uniforms.waveStrength = { value: 0.4 }; 
        waterMaterial.userData.shader = shader; 
        
        // 🔴 注入四层波浪叠加算法
        shader.vertexShader = `
            uniform float time;
            uniform float waveStrength;
            float calculateWave(vec2 p, float t, float freq, float amp, float speed, vec2 dir) {
                return amp * sin(dot(p, dir) * freq + t * speed);
            }
        ` + shader.vertexShader;

        shader.vertexShader = shader.vertexShader.replace(
            '#include <begin_vertex>',
            `
            #include <begin_vertex>
            float boxTopY = ${ (waterHeight / 2).toFixed(2) }; 
            if (position.y > boxTopY - 0.1) {
                vec2 posBase = position.xz;
                float h = 0.0;
                h += calculateWave(posBase, time, 1.2, 0.25, 2.5, vec2(1.0, 0.2));
                h += calculateWave(posBase, time, 2.1, 0.15, 3.2, vec2(-0.7, 0.8));
                h += calculateWave(posBase, time, 0.8, 0.20, 1.8, vec2(0.3, -0.9));
                h += calculateWave(posBase, time, 3.5, 0.05, 4.5, vec2(0.1, 0.1));
                transformed.y += h * waveStrength;
            }
            `
        );
    };

    const water = new THREE.Mesh(waterGeometry, waterMaterial);
    water.position.set(0, tankBottomY + waterHeight / 2 + 0.01, 0);
    water.castShadow = false;   
    water.receiveShadow = false;
    water.name = 'Water'; 

    scene.add(water);

    water.userData = {
        update: function(dt) {
            if (normalMap) {
                normalMap.offset.x += dt * 0.05;
                normalMap.offset.y += dt * 0.03;
            }
            if (waterMaterial.userData.shader) {
                waterMaterial.userData.shader.uniforms.time.value += dt;
            }
        }
    };

    return { tank: null, water, plane: null };
}