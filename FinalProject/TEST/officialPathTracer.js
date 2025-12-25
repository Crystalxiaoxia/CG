// officialPathTracer.js
// 基于 Three.js 官方路径追踪示例的实现
// 增强版：支持动态水面波浪法线扰动

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.152.2/build/three.module.js';
import { FLOOR_Y } from './object.js';

export class OfficialPathTracer {
    constructor(renderer, scene) {
        this.renderer = renderer;
        this.scene = scene;
        this.camera = null;
        this.samples = 0;
        this.maxBounces = 4;
        this.resolution = new THREE.Vector2();
        
        // 双缓冲渲染目标
        this.accumTargets = [
            new THREE.WebGLRenderTarget(1, 1, {
                type: THREE.FloatType,
                format: THREE.RGBAFormat,
                minFilter: THREE.LinearFilter,
                magFilter: THREE.LinearFilter
            }),
            new THREE.WebGLRenderTarget(1, 1, {
                type: THREE.FloatType,
                format: THREE.RGBAFormat,
                minFilter: THREE.LinearFilter,
                magFilter: THREE.LinearFilter
            })
        ];
        this.currentAccumIndex = 0;
        
        // 场景几何信息
        this.sceneData = {
            spheres: [],
            planes: [], // 现在平面包含：点、法线、颜色、是否是水、边界
            lights: []
        };
        
        this.initShaders();
        this.updateSceneData();
    }
    
    updateSceneData() {
        this.sceneData = {
            spheres: [],
            planes: [],
            lights: []
        };
        
        // 1. 添加地板 (无限平面)
        // 尝试获取地板颜色
        let floorColor = new THREE.Color(0.5, 0.5, 0.5);
        const floorObj = this.scene.getObjectByName && this.scene.getObjectByName('floor');
        if (floorObj && floorObj.material) {
            const fm = Array.isArray(floorObj.material) ? floorObj.material[0] : floorObj.material;
            if (fm.map) {
                // 如果有贴图，取一个平均色，或者手动指定木板色
                floorColor.setHex(0x8B7355); 
            } else if (fm.color) {
                floorColor.copy(fm.color);
            }
        }

        this.sceneData.planes.push({
            point: new THREE.Vector3(0, FLOOR_Y, 0),
            normal: new THREE.Vector3(0, 1, 0),
            albedo: floorColor,
            roughness: 0.8,
            isWater: false,
            // 地板设为极大边界
            min: new THREE.Vector2(-1000, -1000),
            max: new THREE.Vector2(1000, 1000)
        });

        // 2. 遍历场景
        this.scene.traverse((object) => {
            // 处理光源
            if (object.isLight) {
                if (object.isSpotLight || object.isPointLight || object.isDirectionalLight) {
                    let lightIntensity = object.intensity || 1;
                    lightIntensity = Math.max(lightIntensity * 3, 5); // 增强光强以适应路径追踪
                    
                    this.sceneData.lights.push({
                        position: object.position.clone(),
                        color: object.color.clone(),
                        intensity: lightIntensity,
                    });
                }
            }
            
            if (object.isMesh) {
                // 跳过天空盒 (通过Shader背景色处理)
                if (object.name === 'skybox') return;

                // 特殊处理水面
                if (object.name === 'water' || object.name === 'water_surface') {
                    // 获取水面的世界位置和大小
                    const box = new THREE.Box3().setFromObject(object);
                    const center = box.getCenter(new THREE.Vector3());
                    const size = box.getSize(new THREE.Vector3());

                    // 将水面作为一个平面添加
                    this.sceneData.planes.push({
                        point: new THREE.Vector3(0, center.y, 0), // 水面高度
                        normal: new THREE.Vector3(0, 1, 0),       // 朝上
                        albedo: new THREE.Color(0.7, 0.9, 1.0),   // 水体基础色
                        roughness: 0.05,
                        isWater: true, // 标记为水，Shader会对其进行法线扰动
                        // 记录边界 (x, z)
                        min: new THREE.Vector2(box.min.x, box.min.z),
                        max: new THREE.Vector2(box.max.x, box.max.z)
                    });
                    return; // 处理完水面后返回，不作为球体处理
                }
                
                // 处理其他物体（转换为球体近似）
                const geometry = object.geometry;
                const material = object.material;
                
                if (geometry) {
                    // 简单的包围球近似
                    const box = new THREE.Box3().setFromObject(object);
                    const center = box.getCenter(new THREE.Vector3());
                    const size = box.getSize(new THREE.Vector3());
                    
                    if (size.length() < 0.001) return;
                    
                    let albedo = new THREE.Color(0.8, 0.8, 0.8);
                    let roughness = 0.5;
                    let isGlass = false;

                    const mat = Array.isArray(material) ? material[0] : material;
                    if (mat) {
                        if (mat.color) albedo.copy(mat.color);
                        if (mat.roughness !== undefined) roughness = mat.roughness;
                        if (mat.transmission > 0.5 || mat.opacity < 0.5) isGlass = true;
                    }
                    
                    // 鱼缸玻璃如果是BoxGeometry，这里会被近似为球体，可能会有点穿模
                    // 为了简化，我们假设除了水和地板，其他都是球体近似
                    // (如果需要更精确的方块，需要增加Box相交检测)
                    const radius = Math.max(size.x, size.y, size.z) / 2;
                    
                    // 稍微缩小一点半径避免过度重叠
                    this.sceneData.spheres.push({
                        center: center,
                        radius: radius * 0.9, 
                        albedo: albedo,
                        roughness: roughness,
                        isGlass: isGlass
                    });
                }
            }
        });
    }
    
    initShaders() {
        const vertexShader = `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `;
        
        const fragmentShader = `
            precision highp float;
            
            uniform float uTime;
            uniform vec2 uResolution;
            uniform vec3 uCameraPosition;
            uniform vec3 uCameraTarget;
            uniform float uCameraFov;
            uniform float uSamples;
            uniform int uMaxBounces;
            uniform sampler2D uAccumTexture;
            uniform float uEnableRipples;
            
            // --- 场景定义 ---
            #define MAX_SPHERES 30
            #define MAX_PLANES 5
            #define MAX_LIGHTS 5
            
            uniform int uNumSpheres;
            uniform vec3 uSphereCenters[MAX_SPHERES];
            uniform float uSphereRadii[MAX_SPHERES];
            uniform vec3 uSphereAlbedos[MAX_SPHERES];
            uniform float uSphereRoughness[MAX_SPHERES];
            uniform float uSphereIsGlass[MAX_SPHERES];
            
            uniform int uNumPlanes;
            uniform vec3 uPlanePoints[MAX_PLANES];
            uniform vec3 uPlaneNormals[MAX_PLANES];
            uniform vec3 uPlaneAlbedos[MAX_PLANES];
            uniform float uPlaneIsWater[MAX_PLANES]; // 新增：是否是水
            uniform vec4 uPlaneBounds[MAX_PLANES];   // 新增：边界 (minX, minZ, maxX, maxZ)
            
            uniform int uNumLights;
            uniform vec3 uLightPositions[MAX_LIGHTS];
            uniform vec3 uLightColors[MAX_LIGHTS];
            uniform float uLightIntensities[MAX_LIGHTS];
            
            varying vec2 vUv;
            
            // --- 工具函数 ---
            float random(vec2 st) {
                return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
            }
            
            // 生成动态波浪法线
            vec3 getWaterNormal(vec3 pos, float time) {
                // 叠加几个正弦波的导数来计算法线
                float dx = 0.0;
                float dz = 0.0;
                
                // 波浪参数：频率，振幅，速度
                // Wave 1
                float f1 = 0.8; float a1 = 0.15; float s1 = 1.5;
                dx += cos(pos.x * f1 + time * s1) * f1 * a1;
                dz += cos(pos.z * f1 * 0.8 + time * s1 * 1.1) * f1 * 0.8 * a1;
                
                // Wave 2
                float f2 = 2.0; float a2 = 0.05; float s2 = 3.0;
                dx += cos(pos.x * f2 + time * s2) * f2 * a2;
                dz += cos(pos.z * f2 + time * s2 * 1.2) * f2 * a2;
                
                // Wave 3 (Diagonal)
                float f3 = 1.5; float a3 = 0.08; float s3 = 2.0;
                float phase = (pos.x + pos.z) * f3 + time * s3;
                dx += cos(phase) * f3 * a3;
                dz += cos(phase) * f3 * a3;
                
                // 法线向量 (近似: [-dh/dx, 1, -dh/dz])
                return normalize(vec3(-dx, 1.0, -dz));
            }

            // --- 相交测试 ---
            
            vec2 intersectSphere(vec3 ro, vec3 rd, vec3 center, float radius) {
                vec3 oc = ro - center;
                float b = dot(oc, rd);
                float c = dot(oc, oc) - radius * radius;
                float d = b * b - c;
                if (d < 0.0) return vec2(-1.0);
                float t = -b - sqrt(d);
                if (t < 0.001) t = -b + sqrt(d);
                return vec2(t, t < 0.001 ? -1.0 : 1.0);
            }
            
            // 有限平面相交 (带边界检查)
            float intersectPlaneBounded(vec3 ro, vec3 rd, vec3 p, vec3 n, vec4 bounds) {
                float denom = dot(n, rd);
                if (abs(denom) < 0.001) return -1.0;
                float t = dot(p - ro, n) / denom;
                
                if (t > 0.001) {
                    vec3 hit = ro + rd * t;
                    // 检查边界 bounds: minX, minZ, maxX, maxZ
                    if (hit.x >= bounds.x && hit.x <= bounds.z &&
                        hit.z >= bounds.y && hit.z <= bounds.w) {
                        return t;
                    }
                }
                return -1.0;
            }
            
            struct HitInfo {
                float t;
                vec3 normal;
                vec3 albedo;
                vec3 emission;
                float roughness;
                bool isGlass;
            };
            
            HitInfo intersectScene(vec3 ro, vec3 rd) {
                HitInfo hit;
                hit.t = 10000.0; // Infinity
                hit.normal = vec3(0.0, 1.0, 0.0);
                hit.albedo = vec3(0.0);
                hit.emission = vec3(0.0);
                hit.roughness = 0.5;
                hit.isGlass = false;
                
                bool hitSomething = false;

                // 1. 球体
                for (int i = 0; i < MAX_SPHERES; i++) {
                    if (i >= uNumSpheres) break;
                    vec2 sHit = intersectSphere(ro, rd, uSphereCenters[i], uSphereRadii[i]);
                    if (sHit.x > 0.001 && sHit.x < hit.t) {
                        hit.t = sHit.x;
                        vec3 hitPoint = ro + rd * hit.t;
                        hit.normal = normalize(hitPoint - uSphereCenters[i]);
                        hit.albedo = uSphereAlbedos[i];
                        hit.roughness = uSphereRoughness[i];
                        hit.isGlass = uSphereIsGlass[i] > 0.5;
                        hitSomething = true;
                    }
                }
                
                // 2. 平面 (地板 & 水面)
                for (int i = 0; i < MAX_PLANES; i++) {
                    if (i >= uNumPlanes) break;
                    
                    float pT = intersectPlaneBounded(ro, rd, uPlanePoints[i], uPlaneNormals[i], uPlaneBounds[i]);
                    
                    if (pT > 0.001 && pT < hit.t) {
                        hit.t = pT;
                        vec3 hitPoint = ro + rd * hit.t;
                        
                        hit.albedo = uPlaneAlbedos[i];
                        
                        if (uPlaneIsWater[i] > 0.5) {
                            // 🔴 核心修改：判断是否开启细微涟漪
                            if (uEnableRipples > 0.5) {
                                hit.normal = getWaterNormal(hitPoint, uTime); // 开启数学计算的扰动法线
                            } else {
                                hit.normal = uPlaneNormals[i]; // 关闭时，使用绝对向上的平面法线
                            }
                            hit.isGlass = true;
                            hit.roughness = 0.02;
                        } else {
                            hit.normal = uPlaneNormals[i];
                            hit.isGlass = false;
                            hit.roughness = 0.8;
                        }
                        
                        hitSomething = true;
                    }
                }
                
                // 3. 光源 (作为可见的球体，防止光线无限反弹)
                for (int i = 0; i < MAX_LIGHTS; i++) {
                    if (i >= uNumLights) break;
                    vec2 lHit = intersectSphere(ro, rd, uLightPositions[i], 2.0); // 光源半径
                    if (lHit.x > 0.001 && lHit.x < hit.t) {
                        hit.t = lHit.x;
                        hit.emission = uLightColors[i] * uLightIntensities[i] * 5.0; // 让光源看起来很亮
                        hit.albedo = vec3(1.0); // 纯白核心
                        hitSomething = true;
                    }
                }
                
                if (!hitSomething) hit.t = -1.0;
                
                return hit;
            }
            
            // Fresnel 计算
            float fresnel(vec3 incident, vec3 normal, float ior) {
                float cosi = clamp(dot(incident, normal), -1.0, 1.0);
                float etai = 1.0, etat = ior;
                if (cosi > 0.0) { float t = etai; etai = etat; etat = t; }
                float sint = etai / etat * sqrt(max(0.0, 1.0 - cosi * cosi));
                if (sint >= 1.0) return 1.0; // 全反射
                float cost = sqrt(max(0.0, 1.0 - sint * sint));
                cosi = abs(cosi);
                float rs = ((etat * cosi) - (etai * cost)) / ((etat * cosi) + (etai * cost));
                float rp = ((etai * cosi) - (etat * cost)) / ((etai * cosi) + (etat * cost));
                return (rs * rs + rp * rp) / 2.0;
            }
            
            vec3 traceRay(vec3 ro, vec3 rd, vec2 pixel) {
                vec3 color = vec3(0.0);
                vec3 throughput = vec3(1.0);
                
                for (int bounce = 0; bounce < 5; bounce++) {
                    if (bounce >= uMaxBounces) break;
                    
                    HitInfo hit = intersectScene(ro, rd);
                    
                    if (hit.t > 0.0) {
                        vec3 hitPoint = ro + rd * hit.t;
                        
                        // 加上自发光 (光源)
                        color += throughput * hit.emission;
                        if (length(hit.emission) > 0.0) break; // 击中光源，停止追踪
                        
                        // 材质处理
                        if (hit.isGlass) {
                            // 玻璃/水面折射与反射
                            float ior = 1.33; // 水的折射率
                            float f = fresnel(rd, hit.normal, ior);
                            
                            // 俄罗斯轮盘赌决定是反射还是折射
                            if (random(pixel + vec2(float(bounce), uTime)) < f) {
                                rd = reflect(rd, hit.normal);
                                ro = hitPoint + hit.normal * 0.01;
                            } else {
                                vec3 refr = refract(rd, hit.normal, 1.0/ior);
                                if (length(refr) == 0.0) {
                                    rd = reflect(rd, hit.normal);
                                    ro = hitPoint + hit.normal * 0.01;
                                } else {
                                    rd = refr;
                                    ro = hitPoint - hit.normal * 0.01; // 进入介质内部
                                }
                            }
                            throughput *= hit.albedo; // 稍微染一点色
                        } else {
                            // 漫反射 (Lambertian)
                            // 直接光照采样 (Next Event Estimation - Simplified)
                            // 简单起见，这里只做间接弹射
                            
                            // 随机半球方向
                            vec3 rVec = normalize(vec3(
                                random(pixel + vec2(float(bounce), 0.1)) * 2.0 - 1.0,
                                random(pixel + vec2(float(bounce), 0.2)) * 2.0 - 1.0,
                                random(pixel + vec2(float(bounce), 0.3)) * 2.0 - 1.0
                            ));
                            if (dot(rVec, hit.normal) < 0.0) rVec = -rVec;
                            
                            rd = normalize(mix(reflect(rd, hit.normal), rVec, hit.roughness));
                            ro = hitPoint + hit.normal * 0.01;
                            
                            // 简单的环境光/直接光贡献近似
                            throughput *= hit.albedo;
                            
                            // 简单的阴影射线 (直接连接到光源)
                            for(int l=0; l<MAX_LIGHTS; l++) {
                                if(l >= uNumLights) break;
                                vec3 lDir = normalize(uLightPositions[l] - hitPoint);
                                float lDist = length(uLightPositions[l] - hitPoint);
                                HitInfo shadowHit = intersectScene(hitPoint + hit.normal * 0.02, lDir);
                                
                                // 如果没有遮挡，或者遮挡物是玻璃/水
                                if(shadowHit.t < 0.0 || shadowHit.t > lDist || shadowHit.isGlass) {
                                    float ndotl = max(dot(hit.normal, lDir), 0.0);
                                    float atten = 1.0 / (1.0 + 0.02 * lDist * lDist);
                                    // 水面下的焦散很难直接算，这里只要有光通过就行
                                    color += throughput * uLightColors[l] * uLightIntensities[l] * ndotl * atten * 0.5;
                                }
                            }
                        }
                    } else {
                        // 天空盒颜色
                        float y = max(rd.y, 0.0);
                        vec3 sky = mix(vec3(0.1, 0.1, 0.15), vec3(0.6, 0.8, 1.0), y);
                        color += throughput * sky;
                        break;
                    }
                    
                    // 吞吐量过低提前结束
                    if (length(throughput) < 0.01) break;
                }
                
                return color;
            }
            
            void main() {
                vec2 uv = vUv;
                vec2 pixel = uv * uResolution; // 用于随机种子
                
                // 相机射线生成
                float aspect = uResolution.x / uResolution.y;
                float fovScale = tan(uCameraFov * 0.5);
                
                // 简单的抗锯齿抖动
                vec2 jitter = vec2(random(pixel + vec2(uSamples, 0.0)), random(pixel + vec2(uSamples, 1.0))) - 0.5;
                vec2 ndc = (uv * 2.0 - 1.0) + (jitter / uResolution);
                ndc.x *= aspect;
                
                vec3 forward = normalize(uCameraTarget - uCameraPosition);
                vec3 right = normalize(cross(forward, vec3(0.0, 1.0, 0.0)));
                vec3 up = cross(right, forward);
                
                vec3 rd = normalize(forward + right * ndc.x * fovScale + up * ndc.y * fovScale);
                
                vec3 newColor = traceRay(uCameraPosition, rd, pixel + vec2(uSamples * 13.0));
                
                // 累积混合
                vec3 oldColor = texture2D(uAccumTexture, uv).rgb;
                float weight = 1.0 / (uSamples + 1.0);
                vec3 finalColor = mix(oldColor, newColor, weight);
                
                gl_FragColor = vec4(finalColor, 1.0);
            }
        `;
        
        // 增加 Uniform 数组大小定义
        const maxSpheres = 30;
        const maxPlanes = 5;
        const maxLights = 5;
        
        this.quadMaterial = new THREE.ShaderMaterial({
            vertexShader,
            fragmentShader,
            uniforms: {
                uEnableRipples: { value: 1.0 },
                uTime: { value: 0 },
                uResolution: { value: this.resolution },
                uCameraPosition: { value: new THREE.Vector3() },
                uCameraTarget: { value: new THREE.Vector3() },
                uCameraFov: { value: Math.PI / 3 },
                uSamples: { value: 0 },
                uMaxBounces: { value: this.maxBounces },
                uAccumTexture: { value: this.accumTargets[0].texture },
                
                // 几何体
                uNumSpheres: { value: 0 },
                uSphereCenters: { value: new Array(maxSpheres).fill(0).map(() => new THREE.Vector3()) },
                uSphereRadii: { value: new Float32Array(maxSpheres) },
                uSphereAlbedos: { value: new Array(maxSpheres).fill(0).map(() => new THREE.Vector3()) },
                uSphereRoughness: { value: new Float32Array(maxSpheres) },
                uSphereIsGlass: { value: new Float32Array(maxSpheres) },
                
                // 平面 (含水面特殊属性)
                uNumPlanes: { value: 0 },
                uPlanePoints: { value: new Array(maxPlanes).fill(0).map(() => new THREE.Vector3()) },
                uPlaneNormals: { value: new Array(maxPlanes).fill(0).map(() => new THREE.Vector3()) },
                uPlaneAlbedos: { value: new Array(maxPlanes).fill(0).map(() => new THREE.Vector3()) },
                uPlaneIsWater: { value: new Float32Array(maxPlanes) },
                uPlaneBounds: { value: new Array(maxPlanes).fill(0).map(() => new THREE.Vector4()) },
                
                // 光源
                uNumLights: { value: 0 },
                uLightPositions: { value: new Array(maxLights).fill(0).map(() => new THREE.Vector3()) },
                uLightColors: { value: new Array(maxLights).fill(0).map(() => new THREE.Vector3()) },
                uLightIntensities: { value: new Float32Array(maxLights) }
            }
        });
        
        this.quadGeometry = new THREE.PlaneGeometry(2, 2);
        this.quadScene = new THREE.Scene();
        this.quadMesh = new THREE.Mesh(this.quadGeometry, this.quadMaterial);
        this.quadScene.add(this.quadMesh);
        this.quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    }
    
    setSize(width, height) {
        this.resolution.set(width, height);
        this.accumTargets.forEach(rt => rt.setSize(width, height));
        if (this.quadMaterial.uniforms) {
            this.quadMaterial.uniforms.uResolution.value.set(width, height);
        }
    }
    
    setCamera(camera) {
        this.camera = camera;
    }
    
    setScene(scene) {
        this.scene = scene;
        this.updateSceneData();
        this.updateShaderUniforms();
    }
    
    updateShaderUniforms() {
        if (!this.quadMaterial || !this.quadMaterial.uniforms) return;
        
        const uniforms = this.quadMaterial.uniforms;
        const maxSpheres = 30;
        const maxPlanes = 5;
        const maxLights = 5;
        
        // 1. 更新球体
        const numSpheres = Math.min(this.sceneData.spheres.length, maxSpheres);
        uniforms.uNumSpheres.value = numSpheres;
        for (let i = 0; i < maxSpheres; i++) {
            if (i < numSpheres) {
                const s = this.sceneData.spheres[i];
                uniforms.uSphereCenters.value[i].copy(s.center);
                uniforms.uSphereRadii.value[i] = s.radius;
                uniforms.uSphereAlbedos.value[i].copy(s.albedo);
                uniforms.uSphereRoughness.value[i] = s.roughness;
                uniforms.uSphereIsGlass.value[i] = s.isGlass ? 1.0 : 0.0;
            }
        }
        
        // 2. 更新平面 (包含水面数据)
        const numPlanes = Math.min(this.sceneData.planes.length, maxPlanes);
        uniforms.uNumPlanes.value = numPlanes;
        for (let i = 0; i < maxPlanes; i++) {
            if (i < numPlanes) {
                const p = this.sceneData.planes[i];
                uniforms.uPlanePoints.value[i].copy(p.point);
                uniforms.uPlaneNormals.value[i].copy(p.normal);
                uniforms.uPlaneAlbedos.value[i].copy(p.albedo);
                uniforms.uPlaneIsWater.value[i] = p.isWater ? 1.0 : 0.0;
                // p.min 和 p.max 是 Vector2
                uniforms.uPlaneBounds.value[i].set(p.min.x, p.min.y, p.max.x, p.max.y);
            }
        }
        
        // 3. 更新光源
        const numLights = Math.min(this.sceneData.lights.length, maxLights);
        uniforms.uNumLights.value = numLights;
        for (let i = 0; i < maxLights; i++) {
            if (i < numLights) {
                const l = this.sceneData.lights[i];
                uniforms.uLightPositions.value[i].copy(l.position);
                uniforms.uLightColors.value[i].copy(l.color);
                uniforms.uLightIntensities.value[i] = l.intensity;
            }
        }
    }
    
    reset() {
        this.samples = 0;
        this.accumTargets.forEach(rt => {
            this.renderer.setRenderTarget(rt);
            this.renderer.clear();
        });
        this.renderer.setRenderTarget(null);
    }
    
    render() {
        if (!this.camera) return;
        
        this.samples++;
        
        // 更新动态物体（如果有）
        this.updateSceneData();
        this.updateShaderUniforms();
        
        const srcIndex = this.currentAccumIndex;
        const dstIndex = 1 - this.currentAccumIndex;
        
        const u = this.quadMaterial.uniforms;
        u.uTime.value = performance.now() * 0.001; // 驱动水波运动
        u.uCameraPosition.value.copy(this.camera.position);
        
        if (window.settings) {
            u.uEnableRipples.value = window.settings.enableWaves ? 1.0 : 0.0;
        }

        const target = new THREE.Vector3();
        this.camera.getWorldDirection(target);
        target.add(this.camera.position);
        u.uCameraTarget.value.copy(target);
        u.uCameraFov.value = this.camera.fov * Math.PI / 180.0;
        u.uSamples.value = this.samples;
        u.uAccumTexture.value = this.accumTargets[srcIndex].texture;
        
        this.renderer.setRenderTarget(this.accumTargets[dstIndex]);
        this.renderer.render(this.quadScene, this.quadCamera);
        
        this.renderer.setRenderTarget(null);
        this.renderer.render(this.quadScene, this.quadCamera);
        
        this.currentAccumIndex = dstIndex;
    }
}
