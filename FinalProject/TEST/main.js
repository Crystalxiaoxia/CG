// --- START OF FILE main.js ---

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.152.2/build/three.module.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.152.2/examples/jsm/controls/OrbitControls.js';
import { OfficialPathTracer } from './officialPathTracer.js';
import { createFishTank } from './fishTank.js';
import { loadObjects } from './object.js';
import { FishMovement } from './fishMovement.js';
import { PlantMovement } from './plantMovement.js';
import { FishingSystem } from './fishingSystem.js'; 
import { BubbleSystem } from './bubbles.js'; // 导入气泡
import { GUI } from 'lil-gui'; // 导入 GUI
// 导入坐标系统常量
import { FLOOR_Y, TABLE_HEIGHT, TANK_BOTTOM_Y, LEG_BOTTOM_Y, LEG_TOP_Y, TABLE_THICKNESS, TABLE_TOP_SURFACE_Y } from './object.js';

const container = document.getElementById('container');
const scene = new THREE.Scene();

// ===== 1. 定义全局控制参数 =====
const settings = {
    ambientIntensity: 0.6,    // 环境光强度
    lightRotationSpeed: 1.0,  // 灯光转速倍率
    enableReflection: true,   // 是否开启反射
    enableWaves: true,        // 是否开启水波
    enableBubbles: true,      // 是否开启气泡
    fishingMode: false,       // 钓鱼模式开关
};

let bubbleSystem; // 声明气泡系统变量

// ===== 创建天空盒（背景环境） =====
let skybox;

function createSkybox() {
    const textureLoader = new THREE.TextureLoader();
    
    // 设置基础路径
    const basePath = 'textures/sky/';

    // 加载所有贴图
    // 注意：Web 路径请使用正斜杠 /
    const texRight  = textureLoader.load(basePath + 'Skysky.jpg');
    const texLeft   = textureLoader.load(basePath + 'Skysky.jpg');
    const texTop    = textureLoader.load(basePath + 'sky.jpg');  
    const texFront  = textureLoader.load(basePath + 'Skysky.jpg');
    const texBack   = textureLoader.load(basePath + 'Skysky.jpg');

    // 辅助函数：统一设置贴图参数
    const setupTex = (tex) => {
        tex.magFilter = THREE.LinearFilter;
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        tex.colorSpace = THREE.SRGBColorSpace; 
    };

    [texRight, texLeft, texTop, texFront, texBack].forEach(setupTex);

    // 创建材质数组
    // 顺序: [ +X, -X, +Y, -Y, +Z, -Z ]
    const skyboxMaterials = [
        new THREE.MeshLambertMaterial({ map: texRight, side: THREE.BackSide }), // Right
        new THREE.MeshLambertMaterial({ map: texLeft,  side: THREE.BackSide }), // Left
        new THREE.MeshLambertMaterial({ map: texTop,side: THREE.BackSide }), // Top
        new THREE.MeshLambertMaterial({ color: 0x111111, side: THREE.BackSide }), // Bottom
        new THREE.MeshLambertMaterial({ map: texFront, side: THREE.BackSide }), // Front
        new THREE.MeshLambertMaterial({ map: texBack,  side: THREE.BackSide })  // Back
    ];

    const skyboxSize = 150; 
    const skyboxGeometry = new THREE.BoxGeometry(skyboxSize, skyboxSize, skyboxSize);
    
    skybox = new THREE.Mesh(skyboxGeometry, skyboxMaterials);
    skybox.name = 'skybox';
    scene.add(skybox);
    return skybox;
}

createSkybox();

// ===== 创建地板 =====
function createFloor() {
    // 尝试加载地板贴图，如果没有则使用默认颜色
    const textureLoader = new THREE.TextureLoader();
    const floorTexture = textureLoader.load('textures/floor4.jpg', undefined, undefined, () => {
        console.warn("⚠️ 地板贴图未找到");
    });
    
    floorTexture.wrapS = THREE.RepeatWrapping;
    floorTexture.wrapT = THREE.RepeatWrapping;
    floorTexture.repeat.set(1, 1);
    floorTexture.colorSpace = THREE.SRGBColorSpace;

    const floorGeometry = new THREE.PlaneGeometry(200, 200);
    const floorMaterial = new THREE.MeshPhongMaterial({ 
        map: floorTexture, 
        color: 0xcccccc, // 备用颜色
        side: THREE.DoubleSide 
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = FLOOR_Y + 0.1; // 防止重叠
    
    floor.receiveShadow = true;
    floor.name = 'floor';
    scene.add(floor);
    return floor;
}

createFloor();

// ===== 创建桌子 =====
// 在 main.js 中修改 createTable 函数

function createTable() {
    const tableGroup = new THREE.Group();
    const textureLoader = new THREE.TextureLoader();

    // 1. 加载贴图 (注意：Web路径建议使用正斜杠 /)
    const path = 'models/plywood/textures/';
    const diffuseMap = textureLoader.load(path + 'plywood_diff_1k.jpg');
    const normalMap = textureLoader.load(path + 'plywood_nor_gl_1k.jpg');
    const roughnessMap = textureLoader.load(path + 'plywood_rough_1k.jpg');

    // 设置贴图重复（可选，根据桌子大小调整）
    [diffuseMap, normalMap, roughnessMap].forEach(tex => {
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(2, 1.5); // 调整重复次数让纹理看起来自然
    });

    const tableThickness = TABLE_THICKNESS;
    const tableTopSurfaceY = TABLE_TOP_SURFACE_Y;
    const tableTopCenterY = tableTopSurfaceY - tableThickness / 2;

    // 2. 创建桌面材质 (PBR)
    const tableTopMaterial = new THREE.MeshStandardMaterial({ 
        map: diffuseMap,
        normalMap: normalMap,
        roughnessMap: roughnessMap,
        roughness: 1.0, // 配合 roughnessMap 使用
        color: 0xffffff // 基础色设为白色，以免影响贴图颜色
    });

    // 桌面
    const tableTopGeometry = new THREE.BoxGeometry(40, tableThickness, 30);
    const tableTop = new THREE.Mesh(tableTopGeometry, tableTopMaterial);
    tableTop.position.y = tableTopCenterY;
    tableTop.castShadow = true;
    tableTop.receiveShadow = true;
    tableTop.name = "table_top"; // 给个名字方便光追器识别
    tableGroup.add(tableTop);
    
    // 3. 桌腿使用较深色的材质
    const legMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x3d2b1f, 
        roughness: 0.9 
    });
    
    const legHeight = tableTopCenterY - LEG_BOTTOM_Y + tableThickness/2;
    const legGeometry = new THREE.BoxGeometry(1.2, legHeight, 1.2);
    
    const legCenterY = LEG_BOTTOM_Y + legHeight / 2;
    const legPositions = [
        [-18, legCenterY, -13], [18, legCenterY, -13],
        [-18, legCenterY, 13], [18, legCenterY, 13]
    ];
    
    legPositions.forEach(pos => {
        const leg = new THREE.Mesh(legGeometry, legMaterial);
        leg.position.set(pos[0], pos[1], pos[2]);
        leg.castShadow = true;
        leg.receiveShadow = true;
        tableGroup.add(leg);
    });
    
    tableGroup.name = 'table';
    scene.add(tableGroup);
    return tableGroup;
}

createTable();

// ===== 相机设置 =====
const camera = new THREE.PerspectiveCamera(60, window.innerWidth/window.innerHeight, 0.1, 1000);
camera.position.set(30, FLOOR_Y + 20, 30);
camera.lookAt(0, TANK_BOTTOM_Y + 5, 0);

// ===== 轨道控制器 =====
const controls = new OrbitControls(camera, container);
controls.enableDamping = true;

// ===== 移动逻辑 =====
const moveState = { forward: false, backward: false, left: false, right: false, up: false, down: false };
const moveSpeed = 10.0;

window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (k === 'w') moveState.forward = true;
    if (k === 's') moveState.backward = true;
    if (k === 'a') moveState.left = true;
    if (k === 'd') moveState.right = true;
    if (k === 'q') moveState.down = true;
    if (k === 'e') moveState.up = true;
});

window.addEventListener('keyup', (e) => {
    const k = e.key.toLowerCase();
    if (k === 'w') moveState.forward = false;
    if (k === 's') moveState.backward = false;
    if (k === 'a') moveState.left = false;
    if (k === 'd') moveState.right = false;
    if (k === 'q') moveState.down = false;
    if (k === 'e') moveState.up = false;
});

let lastCameraPosition = camera.position.clone();
let lastCameraRotation = camera.rotation.clone();
controls.addEventListener('change', () => {
    if (pathTracer && usePathTracing) {
        const posChanged = !camera.position.equals(lastCameraPosition);
        const rotChanged = !camera.rotation.equals(lastCameraRotation);
        if (posChanged || rotChanged) {
            pathTracer.reset();
            lastCameraPosition.copy(camera.position);
            lastCameraRotation.copy(camera.rotation);
        }
    }
});

// ===== 渲染器设置 =====
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
container.appendChild(renderer.domElement);

// ===== 路径追踪 =====
let pathTracer = null;
let usePathTracing = true;

function initPathTracer() {
    try {
        pathTracer = new OfficialPathTracer(renderer, scene);
        pathTracer.setSize(window.innerWidth, window.innerHeight);
        pathTracer.setCamera(camera);
        pathTracer.maxBounces = 4;
        pathTracer.reset();
        
        console.log('✅ 官方路径追踪渲染器初始化成功！');
        updateRenderInfo();
        
        // 按 P 切换模式
        window.addEventListener('keydown', (e) => {
            if (e.key === 'p' || e.key === 'P') {
                usePathTracing = !usePathTracing;
                if (usePathTracing && pathTracer) {
                    pathTracer.setScene(scene);
                    pathTracer.setCamera(camera);
                    pathTracer.reset();
                }
                updateRenderInfo();
            }
        });
        return true;
    } catch (error) {
        console.error('❌ 路径追踪初始化失败:', error);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        usePathTracing = false;
        return false;
    }
}

// ===== 光照 =====
const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
scene.add(hemiLight);

const sunLight = new THREE.DirectionalLight(0xFFD89B, 0.7);
sunLight.position.set(30, 40, 30);
sunLight.target.position.set(0, FLOOR_Y, 0);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(2048, 2048);
sunLight.shadow.camera.left = -80;
sunLight.shadow.camera.right = 80;
sunLight.shadow.camera.top = 80;
sunLight.shadow.camera.bottom = -80;
sunLight.shadow.bias = -0.001;
scene.add(sunLight);
scene.add(sunLight.target);

// const spotLight = new THREE.SpotLight(0xffffff, 1.5, 100, Math.PI / 4, 0.3, 1);
// spotLight.position.set(0, 25, 0);
// spotLight.target.position.set(0, 5, 0);
// spotLight.castShadow = true;
// spotLight.shadow.mapSize.set(2048, 2048);
// spotLight.shadow.bias = -0.0008;
// scene.add(spotLight);
// scene.add(spotLight.target);

// const pointLight = new THREE.PointLight(0xffffff, 0.8, 50);
// pointLight.position.set(15, 15, 15);
// scene.add(pointLight);

// ===== 创建鱼缸 =====
const { tank, water, plane } = createFishTank(scene);

// ===== 加载对象并启动 =====
loadObjects(scene, objects => {
    FishMovement.init(objects.fishes);
    PlantMovement.init(objects.grass);
    
    // 初始化钓鱼系统
    FishingSystem.init(scene, camera, renderer.domElement, objects.fishes);

    // === 初始化气泡系统 ===
    bubbleSystem = new BubbleSystem(scene, renderer, 120);

    const pathTracingAvailable = initPathTracer();
    if (pathTracingAvailable && pathTracer) {
        pathTracer.setScene(scene);
        pathTracer.reset();
    }
    
    initGUI(); // 初始化 GUI 菜单
    animate();
});

// ===== 2. 初始化 GUI 菜单 =====
function initGUI() {
    const gui = new GUI();
    gui.title('🐟 鱼缸控制面板');

    // 1. 环境光
    gui.add(settings, 'ambientIntensity', 0, 2).name('环境光强度').onChange(val => {
        hemiLight.intensity = val;
        if (pathTracer) pathTracer.reset();
    });

    // 2. 主灯转速
    gui.add(settings, 'lightRotationSpeed', 0, 5).name('灯光移动速度');

    // 3. 反射控制 (控制水体和气泡的反射强度)
    gui.add(settings, 'enableReflection').name('开启环境反射').onChange(val => {
        if (water && water.material) {
            water.material.ior = val ? 1.33 : 1.0; 
            water.material.reflectivity = val ? 1.0 : 0.0;
        }
        if (pathTracer) pathTracer.reset();
    });

    // 4. 水波控制
    gui.add(settings, 'enableWaves').name('细微涟漪波纹').onChange(val => {
        // --- 控制光栅化模式 ---
        if (water && water.material) {
            // 只修改法线缩放，不碰 waveStrength
            const s = val ? 0.8 : 0.0;
            water.material.normalScale.set(s, s);
        }

        // --- 控制路径追踪模式 ---
        if (pathTracer && pathTracer.quadMaterial) {
            pathTracer.quadMaterial.uniforms.uEnableRipples.value = val ? 1.0 : 0.0;
            pathTracer.reset(); // 重置采样
        }
    });

    // 5. 气泡控制
    gui.add(settings, 'enableBubbles').name('生成气泡').onChange(val => {
        if (bubbleSystem) bubbleSystem.mesh.visible = val;
    });

    // 6. 钓鱼控制 (同步按键 X 的逻辑)
    gui.add(settings, 'fishingMode').name('🎣 钓鱼模式').onChange(val => {
        // 模拟按下 X 键的逻辑
        const event = new KeyboardEvent('keydown', { key: 'x' });
        window.dispatchEvent(event);
    });
}

// ===== 动画循环 =====
function animate() {
    requestAnimationFrame(animate);

    const dt = 0.016;

    // 水面动画
    if (water && water.material) {
        if (water.material.uniforms && water.material.uniforms['time']) {
            water.material.uniforms['time'].value += dt;
        } else if (water.material.uniforms) {
            water.material.uniforms.time.value += dt;
            water.material.uniforms.cameraPos.value.copy(camera.position);
        }
    }

    // 钓鱼
    FishingSystem.update(dt);
    const time = performance.now() * 0.001; // 统一时间变量

    if (window.fishObjs) FishMovement.update(dt);
    if (window.grassMeshes) PlantMovement.update(performance.now()*0.001);

    // 气泡系统更新
    if (bubbleSystem && settings.enableBubbles) {
        bubbleSystem.update(dt, time);
    }

    // 摄像机移动
    const moveVec = new THREE.Vector3();
    if (moveState.forward || moveState.backward || moveState.left || moveState.right || moveState.up || moveState.down) {
        const dir = new THREE.Vector3();
        camera.getWorldDirection(dir);
        dir.y = 0; dir.normalize();
        const right = new THREE.Vector3();
        right.crossVectors(dir, camera.up).normalize();

        if (moveState.forward) moveVec.add(dir);
        if (moveState.backward) moveVec.addScaledVector(dir, -1);
        if (moveState.left) moveVec.addScaledVector(right, -1);
        if (moveState.right) moveVec.add(right);
        if (moveState.up) moveVec.add(camera.up);
        if (moveState.down) moveVec.addScaledVector(camera.up, -1);

        moveVec.normalize().multiplyScalar(moveSpeed * dt);
        camera.position.add(moveVec);
        if (controls && controls.target) controls.target.add(moveVec);

        if (pathTracer && usePathTracing) {
            pathTracer.reset();
        }
    }

    controls.update();
    
    // 灯光移动动画
    const lightTime = Date.now() * 0.0005 * settings.lightRotationSpeed;
    
    sunLight.position.x = Math.cos(lightTime * 0.2) * 40;
    sunLight.position.z = Math.sin(lightTime * 0.2) * 40;
    sunLight.position.y = 35 + Math.sin(lightTime * 0.1) * 15;
    
    // spotLight.position.x = Math.sin(lightTime) * 8;
    // spotLight.position.z = Math.cos(lightTime) * 8;
    // spotLight.position.y = 25 + Math.sin(lightTime * 0.5) * 3;
    
    // pointLight.position.x = Math.cos(lightTime * 0.7) * 10;
    // pointLight.position.z = Math.sin(lightTime * 0.7) * 10;
    // pointLight.position.y = 15 + Math.cos(lightTime * 1.2) * 2;
    
    // 如果设置了路径追踪，灯光移动时需要重置采样
    if (pathTracer && usePathTracing && settings.lightRotationSpeed > 0.1) {
        pathTracer.reset();
    }

    // 渲染
    if (usePathTracing && pathTracer) {
        pathTracer.setCamera(camera);
        pathTracer.render();
        updateSampleCount();
        
        // 混合光栅化（显示阴影等）
        renderer.autoClear = false;
        renderer.clearDepth();
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFShadowMap;
        renderer.state.buffers.depth.setTest(true);
        renderer.state.buffers.depth.setMask(true);
        renderer.render(scene, camera);
        renderer.autoClear = true;
    } else {
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFShadowMap;
        renderer.render(scene, camera);
        const sampleEl = document.getElementById('sampleCount');
        if (sampleEl) sampleEl.textContent = '0';
    }
}

function updateRenderInfo() {
    const statusEl = document.getElementById('renderStatus');
    const bounceEl = document.getElementById('bounceCount');
    
    if (statusEl) {
        if (usePathTracing && pathTracer) {
            statusEl.textContent = '路径追踪 (Ray Tracing)';
            statusEl.className = 'status';
        } else {
            statusEl.textContent = '光栅化渲染 (Rasterization)';
            statusEl.className = 'status off';
        }
    }
    if (bounceEl && pathTracer) {
        bounceEl.textContent = pathTracer.maxBounces;
    }
}

function updateSampleCount() {
    const sampleEl = document.getElementById('sampleCount');
    if (sampleEl && pathTracer && usePathTracing) {
        sampleEl.textContent = pathTracer.samples || 0;
    }
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth/window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    if (pathTracer) {
        pathTracer.setSize(window.innerWidth, window.innerHeight);
    }
});