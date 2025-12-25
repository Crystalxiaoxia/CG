// pathTracingRenderer.js
// 基于 GPU 着色器的路径追踪渲染器实现
// 实现真正的光线追踪：从相机发射光线，追踪光线与场景的交互

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.152.2/build/three.module.js';

export class PathTracingRenderer {
    constructor(renderer) {
        this.renderer = renderer;
        this.scene = null;
        this.camera = null;
        this.samples = 0;
        this.maxBounces = 4;
        this.resolution = new THREE.Vector2();
        
        // 创建渲染目标用于累积采样
        this.renderTarget = new THREE.WebGLRenderTarget(1, 1, {
            type: THREE.FloatType,
            format: THREE.RGBAFormat,
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter
        });
        
        // 创建全屏四边形用于显示结果
        this.quadGeometry = new THREE.PlaneGeometry(2, 2);
        this.initShaders();
        
        this.quadScene = new THREE.Scene();
        this.quadMesh = new THREE.Mesh(this.quadGeometry, this.quadMaterial);
        this.quadScene.add(this.quadMesh);
        
        // 创建正交相机用于全屏渲染
        this.quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    }
    
    initShaders() {
        // 路径追踪顶点着色器（全屏四边形）
        const vertexShader = `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `;
        
        // 路径追踪片段着色器 - 实现真正的光线追踪
        const fragmentShader = `
            precision highp float;
            
            uniform float time;
            uniform vec2 resolution;
            uniform vec3 uCameraPosition;
            uniform vec3 uCameraTarget;
            uniform float uCameraFov;
            uniform float uSamples;
            uniform int uMaxBounces;
            uniform sampler2D uSceneTexture;
            
            varying vec2 vUv;
            
            // 随机数生成（用于蒙特卡洛采样）
            float random(vec2 st) {
                return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
            }
            
            // 光线-球体相交测试
            vec2 intersectSphere(vec3 ro, vec3 rd, vec3 center, float radius) {
                vec3 oc = ro - center;
                float b = dot(oc, rd);
                float c = dot(oc, oc) - radius * radius;
                float discriminant = b * b - c;
                if (discriminant < 0.0) return vec2(-1.0);
                float t = -b - sqrt(discriminant);
                if (t < 0.001) t = -b + sqrt(discriminant);
                return vec2(t, t < 0.001 ? -1.0 : 1.0);
            }
            
            // 光线-平面相交测试
            float intersectPlane(vec3 ro, vec3 rd, vec3 p, vec3 n) {
                float denom = dot(n, rd);
                if (abs(denom) < 0.001) return -1.0;
                float t = dot(p - ro, n) / denom;
                return t > 0.001 ? t : -1.0;
            }
            
            // 光线-盒子相交测试（用于鱼缸）
            vec2 intersectBox(vec3 ro, vec3 rd, vec3 boxMin, vec3 boxMax) {
                vec3 invRd = 1.0 / rd;
                vec3 t0 = (boxMin - ro) * invRd;
                vec3 t1 = (boxMax - ro) * invRd;
                vec3 tMin = min(t0, t1);
                vec3 tMax = max(t0, t1);
                float near = max(max(tMin.x, tMin.y), tMin.z);
                float far = min(min(tMax.x, tMax.y), tMax.z);
                return vec2(near, far < near ? -1.0 : 1.0);
            }
            
            // 场景相交测试结构
            struct HitInfo {
                float t;
                vec3 normal;
                vec3 albedo;
                vec3 emission;
                float roughness;
                float metalness;
                bool isGlass;
            };
            
            // 简化的场景相交测试（实际应用中应该使用 BVH）
            HitInfo intersectScene(vec3 ro, vec3 rd) {
                HitInfo hit;
                hit.t = 1000.0;
                hit.normal = vec3(0.0, 1.0, 0.0);
                hit.albedo = vec3(0.5);
                hit.emission = vec3(0.0);
                hit.roughness = 0.5;
                hit.metalness = 0.0;
                hit.isGlass = false;
                
                // 测试地面（大平面）
                float groundT = intersectPlane(ro, rd, vec3(0.0, 0.0, 0.0), vec3(0.0, 1.0, 0.0));
                if (groundT > 0.001 && groundT < hit.t) {
                    vec3 hitPoint = ro + rd * groundT;
                    // 地面范围很大
                    if (length(hitPoint.xz) < 50.0) {
                        hit.t = groundT;
                        hit.normal = vec3(0.0, 1.0, 0.0);
                        hit.albedo = vec3(0.4, 0.4, 0.4);
                        hit.roughness = 0.8;
                    }
                }
                
                // 测试鱼缸底部（玻璃）
                float bottomT = intersectPlane(ro, rd, vec3(0.0, 0.0, 0.0), vec3(0.0, 1.0, 0.0));
                if (bottomT > 0.001 && bottomT < hit.t && abs(ro.y + rd.y * bottomT) < 0.1) {
                    vec3 hitPoint = ro + rd * bottomT;
                    if (abs(hitPoint.x) < 5.0 && abs(hitPoint.z) < 5.0) {
                        hit.t = bottomT;
                        hit.normal = vec3(0.0, 1.0, 0.0);
                        hit.albedo = vec3(0.9, 0.9, 0.95);
                        hit.isGlass = true;
                        hit.roughness = 0.0;
                    }
                }
                
                // 测试鱼缸玻璃壁（简化：只测试主要的面）
                vec3 boxMin = vec3(-5.0, 0.0, -5.0);
                vec3 boxMax = vec3(5.0, 10.0, 5.0);
                vec2 boxHit = intersectBox(ro, rd, boxMin, boxMax);
                if (boxHit.x > 0.001 && boxHit.x < hit.t) {
                    vec3 hitPoint = ro + rd * boxHit.x;
                    // 检查是否在玻璃表面附近
                    float distToWall = min(
                        min(abs(hitPoint.x - 5.0), abs(hitPoint.x + 5.0)),
                        min(abs(hitPoint.z - 5.0), abs(hitPoint.z + 5.0))
                    );
                    if (distToWall < 0.1 && hitPoint.y > 0.0 && hitPoint.y < 10.0) {
                        hit.t = boxHit.x;
                        if (abs(hitPoint.x - 5.0) < 0.1 || abs(hitPoint.x + 5.0) < 0.1) {
                            hit.normal = vec3(sign(hitPoint.x), 0.0, 0.0);
                        } else {
                            hit.normal = vec3(0.0, 0.0, sign(hitPoint.z));
                        }
                        hit.albedo = vec3(0.9, 0.9, 0.95);
                        hit.isGlass = true;
                        hit.roughness = 0.0;
                    }
                }
                
                // 测试水面（简化）
                float waterT = intersectPlane(ro, rd, vec3(0.0, 9.7, 0.0), vec3(0.0, 1.0, 0.0));
                if (waterT > 0.001 && waterT < hit.t) {
                    vec3 hitPoint = ro + rd * waterT;
                    if (abs(hitPoint.x) < 4.85 && abs(hitPoint.z) < 4.85) {
                        hit.t = waterT;
                        hit.normal = vec3(0.0, 1.0, 0.0);
                        // 添加水波扰动
                        float wave = sin(hitPoint.x * 2.0 + time * 2.0) * 0.1;
                        hit.normal = normalize(vec3(wave, 1.0, wave));
                        hit.albedo = vec3(0.2, 0.5, 0.9);
                        hit.isGlass = true;
                        hit.roughness = 0.1;
                    }
                }
                
                // 测试光源（作为发光球体，更大更亮）
                // 注意：光源应该在最后测试，这样其他物体可以遮挡它产生阴影
                vec2 lightHit = intersectSphere(ro, rd, vec3(0.0, 25.0, 0.0), 3.0);
                if (lightHit.x > 0.001 && lightHit.x < hit.t) {
                    // 只有在没有其他物体遮挡时才看到光源
                    hit.t = lightHit.x;
                    hit.normal = normalize((ro + rd * hit.t) - vec3(0.0, 25.0, 0.0));
                    hit.albedo = vec3(1.0);
                    hit.emission = vec3(50.0, 50.0, 50.0); // 更强的发光
                    hit.roughness = 0.0;
                }
                
                // 添加一些简化的物体（模拟鱼缸内的物体）
                // 测试鱼缸底部区域的一些球体（模拟石头）
                vec2 stoneHit1 = intersectSphere(ro, rd, vec3(2.0, 1.0, 2.0), 0.8);
                if (stoneHit1.x > 0.001 && stoneHit1.x < hit.t && stoneHit1.x < 10.0) {
                    hit.t = stoneHit1.x;
                    hit.normal = normalize((ro + rd * hit.t) - vec3(2.0, 1.0, 2.0));
                    hit.albedo = vec3(0.5, 0.4, 0.3);
                    hit.roughness = 0.9;
                }
                
                vec2 stoneHit2 = intersectSphere(ro, rd, vec3(-2.0, 1.0, -2.0), 0.8);
                if (stoneHit2.x > 0.001 && stoneHit2.x < hit.t && stoneHit2.x < 10.0) {
                    hit.t = stoneHit2.x;
                    hit.normal = normalize((ro + rd * hit.t) - vec3(-2.0, 1.0, -2.0));
                    hit.albedo = vec3(0.5, 0.4, 0.3);
                    hit.roughness = 0.9;
                }
                
                // 测试一些鱼（简化为小球体）
                vec2 fishHit1 = intersectSphere(ro, rd, vec3(1.0, 5.0, 1.0), 0.3);
                if (fishHit1.x > 0.001 && fishHit1.x < hit.t && fishHit1.x < 10.0) {
                    hit.t = fishHit1.x;
                    hit.normal = normalize((ro + rd * hit.t) - vec3(1.0, 5.0, 1.0));
                    hit.albedo = vec3(0.8, 0.6, 0.4);
                    hit.roughness = 0.3;
                }
                
                vec2 fishHit2 = intersectSphere(ro, rd, vec3(-1.5, 6.0, -1.5), 0.3);
                if (fishHit2.x > 0.001 && fishHit2.x < hit.t && fishHit2.x < 10.0) {
                    hit.t = fishHit2.x;
                    hit.normal = normalize((ro + rd * hit.t) - vec3(-1.5, 6.0, -1.5));
                    hit.albedo = vec3(0.4, 0.6, 0.9);
                    hit.roughness = 0.3;
                }
                
                return hit;
            }
            
            // 计算菲涅尔反射
            float fresnel(vec3 incident, vec3 normal, float ior) {
                float cosi = clamp(dot(incident, normal), -1.0, 1.0);
                float etai = 1.0, etat = ior;
                if (cosi > 0.0) {
                    float temp = etai;
                    etai = etat;
                    etat = temp;
                }
                float sint = etai / etat * sqrt(max(0.0, 1.0 - cosi * cosi));
                if (sint >= 1.0) {
                    return 1.0; // 全反射
                }
                float cost = sqrt(max(0.0, 1.0 - sint * sint));
                cosi = abs(cosi);
                float rs = ((etat * cosi) - (etai * cost)) / ((etat * cosi) + (etai * cost));
                float rp = ((etai * cosi) - (etat * cost)) / ((etai * cosi) + (etat * cost));
                return (rs * rs + rp * rp) / 2.0;
            }
            
            // 路径追踪主函数
            vec3 traceRay(vec3 ro, vec3 rd, vec2 pixel) {
                vec3 color = vec3(0.0);
                vec3 throughput = vec3(1.0);
                
                    for (int bounce = 0; bounce < 4; bounce++) {
                        if (bounce >= uMaxBounces) break;
                    
                    HitInfo hit = intersectScene(ro, rd);
                    
                    if (hit.t < 999.0) {
                        vec3 hitPoint = ro + rd * hit.t;
                        
                        // 添加发光
                        color += throughput * hit.emission;
                        
                        // 如果是玻璃，计算反射和折射
                        if (hit.isGlass) {
                            float fr = fresnel(-rd, hit.normal, 1.5);
                            vec3 reflectDir = reflect(rd, hit.normal);
                            
                            // 根据菲涅尔系数混合反射和折射
                            if (random(pixel + float(bounce)) < fr) {
                                // 反射
                                rd = reflectDir;
                                ro = hitPoint + hit.normal * 0.01;
                                throughput *= hit.albedo;
                            } else {
                                // 折射
                                vec3 refractDir = refract(rd, hit.normal, 1.0 / 1.5);
                                if (length(refractDir) < 0.001) {
                                    // 全反射
                                    rd = reflectDir;
                                } else {
                                    rd = refractDir;
                                }
                                ro = hitPoint - hit.normal * 0.01;
                                throughput *= hit.albedo;
                            }
                        } else {
                            // 漫反射材质
                            // 计算直接光照（带阴影）
                            vec3 lightPos = vec3(0.0, 25.0, 0.0);
                            vec3 lightDir = normalize(lightPos - hitPoint);
                            float distToLight = length(lightPos - hitPoint);
                            
                            // 阴影测试：从命中点向光源发射阴影光线
                            HitInfo shadowHit = intersectScene(hitPoint + hit.normal * 0.01, lightDir);
                            float shadowFactor = 1.0;
                            
                            // 如果阴影光线在到达光源前就碰到了物体，说明在阴影中
                            if (shadowHit.t > 0.001 && shadowHit.t < distToLight - 0.1) {
                                // 在阴影中，但仍然有一些环境光
                                shadowFactor = 0.1; // 软阴影：不完全黑
                            }
                            
                            float ndotl = max(dot(hit.normal, lightDir), 0.0);
                            float attenuation = 1.0 / (1.0 + 0.1 * distToLight + 0.01 * distToLight * distToLight);
                            
                            // 直接光照（带阴影）
                            color += throughput * hit.albedo * ndotl * 20.0 * attenuation * shadowFactor;
                            
                            // 环境光（让场景更亮，但阴影区域更暗）
                            float ambientFactor = mix(0.1, 0.3, shadowFactor); // 阴影区域环境光更少
                            color += throughput * hit.albedo * vec3(0.2, 0.25, 0.3) * ambientFactor;
                            
                            // 漫反射反弹（蒙特卡洛采样）
                            vec3 randomDir = normalize(hit.normal + vec3(
                                random(pixel + vec2(float(bounce), 0.0)) * 2.0 - 1.0,
                                random(pixel + vec2(float(bounce), 1.0)) * 2.0 - 1.0,
                                random(pixel + vec2(float(bounce), 2.0)) * 2.0 - 1.0
                            ));
                            rd = randomDir;
                            ro = hitPoint + hit.normal * 0.01;
                            throughput *= hit.albedo * 0.7;
                        }
                    } else {
                        // 天空颜色（环境光，更亮）
                        float skyGradient = max(0.0, rd.y);
                        vec3 skyColor = mix(
                            vec3(0.2, 0.2, 0.25),
                            vec3(0.6, 0.8, 1.0),
                            skyGradient
                        );
                        color += throughput * skyColor * 1.0; // 增加天空光强度
                        break;
                    }
                    
                    // 俄罗斯轮盘赌（提前终止低贡献路径）
                    float p = max(throughput.x, max(throughput.y, throughput.z));
                    if (random(pixel + vec2(float(bounce), 3.0)) > p) break;
                    throughput /= p;
                }
                
                return color;
            }
            
            void main() {
                vec2 uv = vUv;
                vec2 pixel = uv * resolution;
                
                // 计算相机方向
                vec3 forward = normalize(uCameraTarget - uCameraPosition);
                vec3 right = normalize(cross(forward, vec3(0.0, 1.0, 0.0)));
                vec3 up = cross(right, forward);
                
                float fov = tan(uCameraFov * 0.5);
                vec2 offset = (uv * 2.0 - 1.0) * vec2(resolution.x / resolution.y, 1.0);
                
                // 添加随机偏移（抗锯齿）
                vec2 jitter = vec2(
                    random(pixel + vec2(uSamples, 0.0)) - 0.5,
                    random(pixel + vec2(uSamples, 1.0)) - 0.5
                ) * 0.5;
                offset += jitter * fov / resolution;
                
                vec3 rd = normalize(forward + right * offset.x * fov + up * offset.y * fov);
                
                // 路径追踪
                vec3 color = traceRay(uCameraPosition, rd, pixel);
                
                // 累积采样（渐进式渲染）
                vec3 prevColor = texture2D(uSceneTexture, uv).rgb;
                color = mix(prevColor, color, 1.0 / max(uSamples + 1.0, 1.0));
                
                gl_FragColor = vec4(color, 1.0);
            }
        `;
        
        this.quadMaterial = new THREE.ShaderMaterial({
            vertexShader,
            fragmentShader,
            uniforms: {
                time: { value: 0 },
                resolution: { value: this.resolution },
                uCameraPosition: { value: new THREE.Vector3() },
                uCameraTarget: { value: new THREE.Vector3() },
                uCameraFov: { value: Math.PI / 3 },
                uSamples: { value: 0 },
                uMaxBounces: { value: this.maxBounces },
                uSceneTexture: { value: this.renderTarget.texture }
            }
        });
    }
    
    setSize(width, height) {
        this.resolution.set(width, height);
        this.renderTarget.setSize(width, height);
        if (this.quadMaterial && this.quadMaterial.uniforms) {
            this.quadMaterial.uniforms.resolution.value.set(width, height);
        }
    }
    
    setCamera(camera) {
        this.camera = camera;
    }
    
    setScene(scene) {
        this.scene = scene;
    }
    
    reset() {
        this.samples = 0;
        // 清空渲染目标
        this.renderer.setRenderTarget(this.renderTarget);
        this.renderer.clear();
        this.renderer.setRenderTarget(null);
    }
    
    render() {
        if (!this.camera) return;
        
        this.samples++;
        
        // 更新着色器uniforms
        if (this.quadMaterial && this.quadMaterial.uniforms) {
            this.quadMaterial.uniforms.time.value = performance.now() * 0.001;
            this.quadMaterial.uniforms.uCameraPosition.value.copy(this.camera.position);
            
            // 计算相机目标点
            const target = new THREE.Vector3();
            this.camera.getWorldDirection(target);
            target.multiplyScalar(10.0).add(this.camera.position);
            this.quadMaterial.uniforms.uCameraTarget.value.copy(target);
            
            this.quadMaterial.uniforms.uCameraFov.value = this.camera.fov * Math.PI / 180.0;
            this.quadMaterial.uniforms.uSamples.value = this.samples;
            this.quadMaterial.uniforms.uMaxBounces.value = this.maxBounces;
        }
        
        // 渲染到纹理（累积采样）
        this.renderer.setRenderTarget(this.renderTarget);
        this.renderer.render(this.quadScene, this.quadCamera);
        
        // 渲染到屏幕
        this.renderer.setRenderTarget(null);
        this.renderer.render(this.quadScene, this.quadCamera);
    }
}
