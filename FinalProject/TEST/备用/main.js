// main.js
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.152.2/build/three.module.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.152.2/examples/jsm/controls/OrbitControls.js';
import { OfficialPathTracer } from './officialPathTracer.js';
import { createFishTank } from './fishTank.js';
import { loadObjects } from './object.js';
import { FishMovement } from './fishMovement.js';
import { PlantMovement } from './plantMovement.js';
import { BubbleSystem } from './bubbles.js';

const container = document.getElementById('container');
const scene = new THREE.Scene();

// ===== 创建天空盒（背景环境） =====
let skybox;
function createSkybox() {
    const textureLoader = new THREE.TextureLoader();
    const backgroundTexture = textureLoader.load('textures/background.png');
    backgroundTexture.magFilter = THREE.LinearFilter;
    backgroundTexture.minFilter = THREE.LinearMipmapLinearFilter;
    
    // 创建一个大立方体作为天空盒（缩小以保持场景比例）
    const skyboxSize = 150;
    const skyboxGeometry = new THREE.BoxGeometry(skyboxSize, skyboxSize, skyboxSize);
    
    // 创建6个面的材质
    const skyboxMaterials = [
        new THREE.MeshBasicMaterial({ map: backgroundTexture, side: THREE.BackSide }), // 右
        new THREE.MeshBasicMaterial({ map: backgroundTexture, side: THREE.BackSide }), // 左
        new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.BackSide }),        // 顶（白色）
        new THREE.MeshBasicMaterial({ color: 0x222222, side: THREE.BackSide }),        // 底（深灰）
        new THREE.MeshBasicMaterial({ map: backgroundTexture, side: THREE.BackSide }), // 前
        new THREE.MeshBasicMaterial({ map: backgroundTexture, side: THREE.BackSide })  // 后
    ];
    
    skybox = new THREE.Mesh(skyboxGeometry, skyboxMaterials);
    skybox.name = 'skybox'; // 标记为天空盒，路径追踪中会跳过
    scene.add(skybox);
    return skybox;
}

createSkybox();

// ===== 导入坐标系统常量 =====
import { FLOOR_Y, TABLE_HEIGHT, TANK_BOTTOM_Y, LEG_BOTTOM_Y, LEG_TOP_Y, TABLE_THICKNESS, TABLE_TOP_SURFACE_Y } from './object.js';

// ===== 创建地板 =====
function createFloor() {
    const floorTexture = new THREE.TextureLoader().load('textures/floor.png');
    floorTexture.wrapS = THREE.RepeatWrapping;
    floorTexture.wrapT = THREE.RepeatWrapping;
    floorTexture.repeat.set(2, 2);
    floorTexture.colorSpace = THREE.SRGBColorSpace;

    const floorGeometry = new THREE.PlaneGeometry(200, 200);
    const floorMaterial = new THREE.MeshPhongMaterial({ 
        map: floorTexture, 
        side: THREE.DoubleSide 
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    
    floor.rotation.x = -Math.PI / 2;
    
    // 加 0.1 的偏移量，防止和天空盒底部重叠打架
    floor.position.y = FLOOR_Y + 0.1; 
    
    floor.receiveShadow = true;
    floor.name = 'floor'; // 确保名字是对的
    scene.add(floor);
    return floor;
}

createFloor();

// ===== 创建桌子（放在地板上，鱼缸放在桌子上） =====
function createTable() {
    const tableGroup = new THREE.Group();

    // 使用指定的桌腿端点：上端 LEG_TOP_Y， 下端 LEG_BOTTOM_Y
    const tableThickness = TABLE_THICKNESS;
    const tableTopSurfaceY = TABLE_TOP_SURFACE_Y; // 顶表面
    const tableTopCenterY = tableTopSurfaceY - tableThickness / 2;

    // 桌面（大平面）
    const tableTopGeometry = new THREE.BoxGeometry(40, tableThickness, 30);
    const tableTopMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x8B7355,  // 棕色木质
        shininess: 20
    });
    const tableTop = new THREE.Mesh(tableTopGeometry, tableTopMaterial);
    tableTop.position.y = tableTopCenterY;
    tableTop.castShadow = true;
    tableTop.receiveShadow = true;
    tableGroup.add(tableTop);
    
    // 四条桌腿：高度为 (腿顶 -> 腿底)
    const legHeight = tableTopCenterY - LEG_BOTTOM_Y + tableThickness/2;
    const legGeometry = new THREE.BoxGeometry(1.2, legHeight, 1.2);
    const legMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x654321,  // 深棕色
        shininess: 10
    });
    
    const legCenterY = LEG_BOTTOM_Y + legHeight / 2;
    const legPositions = [
        [-18, legCenterY, -13],  // 左前
        [18, legCenterY, -13],   // 右前
        [-18, legCenterY, 13],   // 左后
        [18, legCenterY, 13]     // 右后
    ];
    
    legPositions.forEach(pos => {
        const leg = new THREE.Mesh(legGeometry, legMaterial);
        leg.position.set(pos[0], pos[1], pos[2]);
        leg.castShadow = true;
        leg.receiveShadow = true;
        tableGroup.add(leg);
    });
    
    tableGroup.name = 'table'; // 标记为桌子
    scene.add(tableGroup);
    return tableGroup;
}

createTable();

const camera = new THREE.PerspectiveCamera(60, window.innerWidth/window.innerHeight, 0.1, 1000);
// 将相机放置在靠近天空盒底部的位置并朝向鱼缸中心
camera.position.set(30, FLOOR_Y + 20, 30);
camera.lookAt(0, TANK_BOTTOM_Y + 5, 0);

// ===== 轨道控制器：鼠标拖动观察 =====
const controls = new OrbitControls(camera, container);
controls.enableDamping = true;

// ===== WASD / 键盘移动设置 =====
const moveState = { forward: false, backward: false, left: false, right: false, up: false, down: false };
const moveSpeed = 10.0; // 单位：单位/秒，可调整

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

// 当相机移动时，重置路径追踪采样（获得更清晰的图像）
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

// ===== WebGL 渲染器（用于路径追踪） =====
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
container.appendChild(renderer.domElement);

// ===== 路径追踪渲染器 =====
let pathTracer = null;
let usePathTracing = true; // 默认启用路径追踪（作业要求）

// 初始化路径追踪渲染器
function initPathTracer() {
    try {
        // 创建官方风格的路径追踪渲染器
        pathTracer = new OfficialPathTracer(renderer, scene);
        pathTracer.setSize(window.innerWidth, window.innerHeight);
        pathTracer.setCamera(camera);
        pathTracer.maxBounces = 4; // 光线反弹次数
        pathTracer.reset(); // 初始化累积缓冲
        
        console.log('✅ 官方路径追踪渲染器初始化成功！');
        console.log('💡 提示：按 P 键可以在路径追踪和光栅化渲染之间切换');
        console.log('📊 路径追踪参数：最大反弹次数 =', pathTracer.maxBounces);
        console.log('📍 相机位置:', camera.position);
        console.log('🌍 检测到', pathTracer.sceneData.lights.length, '个光源');
        
        // 更新UI显示
        updateRenderInfo();
        
        // 监听键盘事件切换渲染模式
        window.addEventListener('keydown', (e) => {
            if (e.key === 'p' || e.key === 'P') {
                usePathTracing = !usePathTracing;
                
                if (usePathTracing && pathTracer) {
                    // 切换到路径追踪时，确保 pathTracer 有完整的场景数据
                    pathTracer.setScene(scene);
                    pathTracer.setCamera(camera);
                    pathTracer.reset();
                    console.log('🔄 切换到路径追踪模式');
                } else {
                    console.log('🔄 切换到光栅化模式');
                }
                
                updateRenderInfo();
            }
        });
        
        return true;
    } catch (error) {
        console.error('❌ 路径追踪渲染器初始化失败:', error);
        console.error('详细错误:', error.message);
        // 如果初始化失败，使用传统阴影渲染
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.sortObjects = true;
        usePathTracing = false;
        return false;
    }
}

// ===== 光照设置（路径追踪会自动计算全局光照） =====
// 环境光（来自天空的光线 + 来自地面的反弹光）
const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
scene.add(hemiLight);

// 模拟太阳光（平行光，从斜上方照射）- 确保产生阴影
const sunLight = new THREE.DirectionalLight(0xFFD89B, 0.7);
sunLight.position.set(30, 40, 30);
// 将太阳目标指向地板高度，确保阴影朝向正确的目标区域
sunLight.target.position.set(0, FLOOR_Y, 0);
sunLight.castShadow = true;
// 扩大阴影相机范围以覆盖地板和桌子区域
sunLight.shadow.camera.left = -80;
sunLight.shadow.camera.right = 80;
sunLight.shadow.camera.top = 80;
sunLight.shadow.camera.bottom = -80;
sunLight.shadow.camera.near = 0.1;
sunLight.shadow.camera.far = 1000;
sunLight.shadow.mapSize.set(8192, 8192);
sunLight.shadow.bias = -0.001; // 更激进的偏置以减少阴影条纹
sunLight.shadow.normalBias = 0.1; // 增加法线偏置
sunLight.shadow.autoUpdate = true;
scene.add(sunLight);
scene.add(sunLight.target);

// 聚光灯（模拟鱼缸上方灯）- 产生清晰的阴影
const spotLight = new THREE.SpotLight(0xffffff, 1.5, 100, Math.PI / 4, 0.3, 1);
spotLight.position.set(0, 25, 0);
spotLight.target.position.set(0, 5, 0);
spotLight.castShadow = true;
spotLight.shadow.mapSize.set(4096, 4096);
spotLight.shadow.bias = -0.0008;
spotLight.shadow.normalBias = 0.05;
spotLight.shadow.autoUpdate = true;
scene.add(spotLight);
scene.add(spotLight.target);

// 点光源（补充光照，更柔和）
const pointLight = new THREE.PointLight(0xffffff, 0.8, 50);
pointLight.position.set(15, 15, 15);
scene.add(pointLight);

// ===== 创建鱼缸 =====
const { tank, water, plane } = createFishTank(scene);

// ===== 创建气泡 =====
//const bubbleSystem = new BubbleSystem(scene, renderer, 120);

// ===== 添加焦散光源 (Fake Caustics) =====
let causticsData = null;

function createCaustics() {
    const textureLoader = new THREE.TextureLoader();
    // 注意：请确保 textures 文件夹下有 caustics.jpg
    const causticsTexture = textureLoader.load('textures/caustics.jpg'); 
    causticsTexture.wrapS = THREE.RepeatWrapping;
    causticsTexture.wrapT = THREE.RepeatWrapping;
    causticsTexture.repeat.set(2, 2); 

    // 创建一个聚光灯专门用来投射焦散纹理
    const causticsLight = new THREE.SpotLight(0xffffff, 4.0); // 强度设高一点
    causticsLight.position.set(0, 35, 0); // 放在比较高的地方
    causticsLight.target.position.set(0, TANK_BOTTOM_Y, 0); // 指向鱼缸底部
    causticsLight.penumbra = 0.5; // 边缘柔和度
    causticsLight.angle = Math.PI / 6; // 照射角度
    causticsLight.distance = 100;
    
    // 关键：将纹理投射出去
    causticsLight.map = causticsTexture; 
    
    // 开启阴影，这样鱼游过时会遮挡焦散，非常真实
    causticsLight.castShadow = true; 
    causticsLight.shadow.mapSize.set(1024, 1024);
    
    scene.add(causticsLight);
    scene.add(causticsLight.target);

    // 保存引用以便在动画中更新
    causticsData = { light: causticsLight, texture: causticsTexture };
    return causticsData;
}

// 初始化焦散
createCaustics();

// ===== 加载鱼/海藻/石头 =====
loadObjects(scene, objects => {
    FishMovement.init(objects.fishes);
    PlantMovement.init(objects.grass);
    
    // 初始化路径追踪渲染器
    const pathTracingAvailable = initPathTracer();
    
    if (pathTracingAvailable && pathTracer) {
        // 设置场景到路径追踪渲染器（会自动提取场景几何信息）
        pathTracer.setScene(scene);
        // 路径追踪需要重置采样（当场景变化时）
        pathTracer.reset();
    }
    
    animate();
});

// ===== 动画循环 =====
function animate() {
    requestAnimationFrame(animate);

    const dt = 0.016;
    const timeNow = performance.now() * 0.001; // 获取秒数

    // 1. 水面动画更新
    if (water && water.material) {
        // 兼容旧的 ShaderMaterial
        if (water.material.uniforms && water.material.uniforms['time']) {
            water.material.uniforms['time'].value += dt;
        } 
        else if (water.material.uniforms && water.material.uniforms.time) {
            water.material.uniforms.time.value += dt;
            water.material.uniforms.cameraPos.value.copy(camera.position);
        }
        // 兼容第1步建议的 MeshPhysicalMaterial (如果有做)
        else if (water.material.normalMap) {
            water.material.normalMap.offset.x += dt * 0.05;
            water.material.normalMap.offset.y += dt * 0.03;
        }
        // 如果使用了 userData.update 自定义逻辑
        if (water.userData && water.userData.update) {
            water.userData.update(dt);
        }
    }

    // 2. 焦散纹理动画 (Caustics Animation)
    if (causticsData && causticsData.texture) {
        // 让焦散纹理滑动，模拟波光粼粼
        causticsData.texture.offset.x = (timeNow * 0.05) % 1;
        causticsData.texture.offset.y = (timeNow * 0.03) % 1;
    }

    //bubbleSystem.update(dt, performance.now() * 0.001);

    // 3. 物体运动更新
    if (window.fishObjs) FishMovement.update(dt);
    if (window.grassMeshes) PlantMovement.update(timeNow);

    // 4. 键盘移动摄像机
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
        // 同步 OrbitControls 的目标
        if (controls && controls.target) controls.target.add(moveVec);

        // 移动时重置路径追踪采样
        if (pathTracer && usePathTracing) {
            pathTracer.reset();
        }
    }

    controls.update();
    
    // 5. 光源移动（动态光照）
    // 太阳光缓慢旋转
    const sunAngle = timeNow * 0.1; // 稍微调慢一点
    sunLight.position.x = Math.cos(sunAngle) * 40;
    sunLight.position.z = Math.sin(sunAngle) * 40;
    sunLight.position.y = 35 + Math.sin(sunAngle * 0.5) * 15;
    sunLight.target.position.set(0, 5, 0);
    
    // 聚光灯移动
    spotLight.position.x = Math.sin(timeNow) * 8;
    spotLight.position.z = Math.cos(timeNow) * 8;
    spotLight.position.y = 25 + Math.sin(timeNow * 0.5) * 3;
    spotLight.target.position.set(0, 5, 0);
    
    // 点光源移动
    pointLight.position.x = Math.cos(timeNow * 0.7) * 10;
    pointLight.position.z = Math.sin(timeNow * 0.7) * 10;
    pointLight.position.y = 15 + Math.cos(timeNow * 1.2) * 2;
    
    // 6. 渲染
    if (usePathTracing && pathTracer) {
        // 路径追踪渲染逻辑
        pathTracer.setCamera(camera);
        pathTracer.render();
        updateSampleCount();
        
        renderer.autoClear = false;
        renderer.clearDepth();
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFShadowMap;
        renderer.state.buffers.depth.setTest(true);
        renderer.state.buffers.depth.setMask(true);
        renderer.render(scene, camera);
        renderer.autoClear = true;
    } else {
        // 普通渲染逻辑
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFShadowMap;
        renderer.render(scene, camera);
        
        const sampleEl = document.getElementById('sampleCount');
        if (sampleEl) sampleEl.textContent = '0';
    }
}

// ===== 更新渲染信息显示 =====
function updateRenderInfo() {
    const statusEl = document.getElementById('renderStatus');
    const sampleEl = document.getElementById('sampleCount');
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

// ===== 更新采样数显示 =====
function updateSampleCount() {
    const sampleEl = document.getElementById('sampleCount');
    if (sampleEl && pathTracer && usePathTracing) {
        sampleEl.textContent = pathTracer.samples || 0;
    }
}

// ===== 窗口自适应 =====
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth/window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    if (pathTracer) {
        pathTracer.setSize(window.innerWidth, window.innerHeight);
    }
});