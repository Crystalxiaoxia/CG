// fishTank.js
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.152.2/build/three.module.js';
import { TANK_WIDTH, TANK_DEPTH, WATER_TOP, TANK_BOTTOM_Y } from './object.js';

export function createFishTank(scene) {
    const TANK_HEIGHT = 10;
    const tankBottomY = TANK_BOTTOM_Y;

    // ===== 1. 鱼缸玻璃壁 (保持不变) =====
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

    // 辅助创建玻璃板的函数
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

    // 创建5个面
    createPanel(TANK_WIDTH, TANK_DEPTH, 0, tankBottomY, 0, -Math.PI/2); // 底
    // createPanel(TANK_WIDTH, TANK_DEPTH, 0, tankBottomY + TANK_HEIGHT, 0, Math.PI/2); // 顶(可选)
    createPanel(TANK_DEPTH, TANK_HEIGHT, -TANK_WIDTH/2, tankBottomY + TANK_HEIGHT/2, 0, 0, Math.PI/2); // 左
    createPanel(TANK_DEPTH, TANK_HEIGHT, TANK_WIDTH/2, tankBottomY + TANK_HEIGHT/2, 0, 0, -Math.PI/2); // 右
    createPanel(TANK_WIDTH, TANK_HEIGHT, 0, tankBottomY + TANK_HEIGHT/2, -TANK_DEPTH/2, 0, 0); // 后
    createPanel(TANK_WIDTH, TANK_HEIGHT, 0, tankBottomY + TANK_HEIGHT/2, TANK_DEPTH/2, 0, 0); // 前

    // ===== 2. 实体水体 (Volumetric Water) =====
    
    // 水体高度
    const waterHeight = WATER_TOP - 0.5;
    
    // 关键1：几何体变成长方体 BoxGeometry
    // 宽度/深度/高度，分段数(X, Y, Z)。注意 X和Z的分段数要高(64)，为了做波浪；Y只要1就够了。
    const waterGeometry = new THREE.BoxGeometry(
        TANK_WIDTH - 0.4, 
        waterHeight, 
        TANK_DEPTH - 0.4, 
        64, 1, 64 // 顶面高分段，侧面低分段
    );

    const textureLoader = new THREE.TextureLoader();
    const normalMap = textureLoader.load('textures/waternormals.jpg', (t) => {
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.repeat.set(2, 2);
    });

    const waterMaterial = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        
        // === 关键：体积感设置 ===
        transmission: 1.0,      // 全透射
        opacity: 1.0,
        
        // 模仿参考图：深海蓝绿色
        // 这是一个非常漂亮的青蓝色，光线穿过后会保留这个颜色
        attenuationColor: new THREE.Color(0x0088aa), 
        attenuationDistance: 15.0, // 光线穿透多远开始变色。数值越小，水越浑浊/深色
        
        thickness: 10.0,        // 必须给一个厚度值，告诉渲染器这是一个实体
        
        ior: 1.33,              // 水的折射率
        roughness: 0.05,
        metalness: 0.1,
        
        normalMap: normalMap,   // 波光粼粼的表面细节
        normalScale: new THREE.Vector2(0.5, 0.5),
        
        clearcoat: 1.0,
        side: THREE.DoubleSide // 双面渲染，保证从水里往外看也正常
    });

    // 关键2：Shader 智能顶点置换
    // 我们只需要【顶面】动，【侧面和底面】不动
    waterMaterial.onBeforeCompile = function (shader) {
        shader.uniforms.time = { value: 0 };
        shader.uniforms.waveStrength = { value: 0.3 }; 
        shader.uniforms.waveSpeed = { value: 1.5 };
        
        // 保存引用
        waterMaterial.userData.shader = shader;

        shader.vertexShader = `
            uniform float time;
            uniform float waveStrength;
            uniform float waveSpeed;
            
            float noise(vec2 st) {
                return sin(st.x * 12.0) * sin(st.y * 12.0); // 简易噪声
            }
        ` + shader.vertexShader;

        shader.vertexShader = shader.vertexShader.replace(
            '#include <begin_vertex>',
            `
            #include <begin_vertex>
            
            // ⭐️ 核心逻辑：只让顶部的顶点动
            // position.y > 0.0 代表这是长方体的上半部分
            // 我们稍微留一点余量，判断 y 是否接近顶部高度的一半
            
            float boxTopY = ${ (waterHeight / 2).toFixed(2) }; 
            
            // 如果顶点在盒子顶部附近 (允许微小误差)
            if (position.y > boxTopY - 0.1) {
                // 计算波浪
                float wave = sin(position.x * 0.5 + time * waveSpeed) * 0.4;
                wave += cos(position.z * 0.4 + time * waveSpeed * 0.8) * 0.4;
                
                // 应用高度偏移
                transformed.y += wave * waveStrength;
            }
            `
        );
    };

    const water = new THREE.Mesh(waterGeometry, waterMaterial);
    
    // 放置位置：长方体中心点
    // 底部在 tankBottomY，所以中心点在 tankBottomY + waterHeight/2
    water.position.set(0, tankBottomY + waterHeight / 2, 0);
    
    water.castShadow = true;   // 水体投射焦散阴影
    water.receiveShadow = true;
    water.name = 'Water'; 

    scene.add(water);

    // 动画更新
    water.userData = {
        update: function(dt) {
            if (normalMap) {
                normalMap.offset.x += dt * 0.03;
                normalMap.offset.y += dt * 0.01;
            }
            if (waterMaterial.userData.shader) {
                waterMaterial.userData.shader.uniforms.time.value += dt;
            }
        }
    };

    return { tank: null, water, plane: null };
}