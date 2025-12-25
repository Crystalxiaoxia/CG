/// FishingSystem.js
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.152.2/build/three.module.js';
import { TANK_WIDTH, TANK_DEPTH, WATER_TOP, TANK_BOTTOM_Y } from './object.js';

export const FishingSystem = (() => {

    let scene, camera, dom;
    let fishes = [];

    let rod, line, hook;
    let raycaster = new THREE.Raycaster();
    let mouse = new THREE.Vector2();

    let hookPoint = null;
    const catchRadius = 2.5; 
    const caughtFishes = new Set();
    
    let rodVisible = false; 
    let isReeling = false;  
    
    let waterMesh = null; 

    // =============================
    // 初始化
    // =============================
    function init(_scene, _camera, _dom, _fishes) {
        scene = _scene;
        camera = _camera;
        dom = _dom; // 这里的 dom 必须是承载 canvas 的 #container 元素
        fishes = _fishes;

        scene.traverse(obj => {
            if (obj.name === 'Water' || (obj.isMesh && obj.material && obj.material.attenuationColor)) {
                waterMesh = obj;
            }
        });

        createRod();
        createLine();
        createHook();

        // 🔴 修复：只有点击在 3D 视口区域内才触发钓鱼
        const clickHandler = (event) => {
            if (event.button === 2) { // 右键
                const rect = dom.getBoundingClientRect();
                // 检查点击是否在 3D 容器范围内
                if (
                    event.clientX >= rect.left && 
                    event.clientX <= rect.right && 
                    event.clientY >= rect.top && 
                    event.clientY <= rect.bottom
                ) {
                    event.preventDefault(); 
                    onMouseClick(event);
                }
            }
        };
        
        window.addEventListener('mousedown', clickHandler, false);
        
        // 阻止右键菜单（仅当鱼竿可见时）
        window.addEventListener('contextmenu', (e) => {
            if (rodVisible) {
                const rect = dom.getBoundingClientRect();
                if (e.clientX >= rect.left) e.preventDefault();
            }
        }, false);
        
        // 按 X 键切换鱼竿显示
        window.addEventListener('keydown', (e) => {
            if (e.key.toLowerCase() === 'x') {
                rodVisible = !rodVisible;
                rod.visible = rodVisible;
                
                if (!rodVisible) {
                    line.visible = false;
                    hook.visible = false;
                    hookPoint = null;
                    isReeling = false;
                    caughtFishes.forEach(fish => {
                        fish.userData.caught = false;
                    });
                    caughtFishes.clear();
                }
            }
        });
    }

    function createRod() {
        const rodGeom = new THREE.CylinderGeometry(0.08, 0.08, 10, 16);
        const rodMat = new THREE.MeshStandardMaterial({ color: 0x4a2c0a });
        rod = new THREE.Mesh(rodGeom, rodMat);
        rod.position.set(-TANK_WIDTH / 2 - 2.5, TANK_BOTTOM_Y + WATER_TOP + 5.0, 0);
        rod.rotation.z = Math.PI / 2.5; 
        rod.rotation.y = Math.PI / 16;  
        rod.castShadow = true;
        rod.visible = false; 
        scene.add(rod);
    }

    function createLine() {
        const points = [new THREE.Vector3(), new THREE.Vector3()];
        const geo = new THREE.BufferGeometry().setFromPoints(points);
        const mat = new THREE.LineBasicMaterial({ color: 0x333333, linewidth: 3 });
        line = new THREE.Line(geo, mat);
        line.visible = false;
        scene.add(line);
    }

    function createHook() {
        const hookGeom = new THREE.SphereGeometry(0.2, 16, 16);
        const hookMat = new THREE.MeshStandardMaterial({ 
            color: 0xff0000,
            emissive: 0xff3300,
            emissiveIntensity: 0.5,
            metalness: 0.5,
            roughness: 0.3
        });
        hook = new THREE.Mesh(hookGeom, hookMat);
        hook.castShadow = true;
        hook.visible = false;
        scene.add(hook);
    }

    // =============================
    // 鼠标点击放线 - 修正 NDC 坐标计算
    // =============================
    function onMouseClick(event) {
        if (!rodVisible) return;

        if (hookPoint && !isReeling) {
            isReeling = true;
            return;
        }

        if (isReeling) return;

        // 🔴 核心修正：考虑侧边栏偏移，计算相对于容器内部的坐标
        const rect = dom.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);

        const tankTopY = TANK_BOTTOM_Y + WATER_TOP;
        const tankTopPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -tankTopY);
        
        const hitPoint = new THREE.Vector3();
        const intersect = raycaster.ray.intersectPlane(tankTopPlane, hitPoint);
        
        if (!intersect) return;

        const margin = 1.0;
        const halfWidth = TANK_WIDTH / 2 - margin;
        const halfDepth = TANK_DEPTH / 2 - margin;
        
        if (Math.abs(hitPoint.x) > halfWidth || Math.abs(hitPoint.z) > halfDepth) return;

        hookPoint = new THREE.Vector3(hitPoint.x, tankTopY - 1.5, hitPoint.z);

        updateLine();
        line.visible = true;
        hook.visible = true;
        hook.position.copy(hookPoint);

        isReeling = false;
        caughtFishes.clear();
    }

    function getRodTip() {
        const rodLength = 5; 
        const tipOffset = new THREE.Vector3(0, -rodLength, 0);
        tipOffset.applyEuler(rod.rotation);
        return rod.position.clone().add(tipOffset);
    }

    function updateLine() {
        if (!hookPoint) return;
        const rodTip = getRodTip();
        const hookTop = new THREE.Vector3(hook.position.x, hook.position.y + 0.2, hook.position.z);
        const positions = line.geometry.attributes.position.array;
        positions[0] = rodTip.x; positions[1] = rodTip.y; positions[2] = rodTip.z;
        positions[3] = hookTop.x; positions[4] = hookTop.y; positions[5] = hookTop.z;
        line.geometry.attributes.position.needsUpdate = true;
    }

    function update(dt) {
        if (!hookPoint || !rodVisible) return;

        if (isReeling) {
            const rodTip = getRodTip();
            hookPoint.lerp(rodTip, 0.05);
            hook.position.copy(hookPoint);
            
            caughtFishes.forEach(fish => {
                fish.position.lerp(hookPoint, 0.08);
                fish.rotation.y += dt * 5;
                fish.rotation.x += dt * 3;
            });

            if (hookPoint.distanceTo(rodTip) < 0.5) {
                caughtFishes.forEach(fish => {
                    scene.remove(fish);
                    const index = fishes.indexOf(fish);
                    if (index > -1) fishes.splice(index, 1);
                });
                line.visible = false;
                hook.visible = false;
                hookPoint = null;
                isReeling = false;
                caughtFishes.clear();
            }
            updateLine();
            return;
        }

        fishes.forEach(fish => {
            if (caughtFishes.has(fish) || fish.userData.caught) return;
            const dx = fish.position.x - hookPoint.x;
            const dz = fish.position.z - hookPoint.z;
            const horizontalDistance = Math.sqrt(dx * dx + dz * dz);
            
            if (horizontalDistance < catchRadius) {
                caughtFishes.add(fish);
                fish.userData.caught = true;
                fish.userData.hookTarget = hookPoint;
            }
        });

        caughtFishes.forEach(fish => {
            fish.position.x += (hookPoint.x - fish.position.x) * 0.05;
            fish.position.z += (hookPoint.z - fish.position.z) * 0.05;
            fish.rotation.y += dt * 1;
        });

        const time = performance.now() * 0.001;
        hook.position.x = hookPoint.x + Math.sin(time * 2) * 0.1;
        hook.position.y = hookPoint.y + Math.sin(time * 3) * 0.05;
        hook.position.z = hookPoint.z + Math.cos(time * 2.5) * 0.1;

        updateLine();
    }

    return { init, update };
})();