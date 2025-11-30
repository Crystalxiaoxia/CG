#version 300 es
precision mediump float;

out vec4 FragColor;

uniform float ambientStrength, specularStrength, diffuseStrength,shininess;
uniform float fogDensity;
uniform vec3 fogColor;    // 雾的颜色（通常为灰、白、天蓝）
uniform float fogStart;   // 开始有雾的距离
uniform float fogEnd;     // 全雾距离
uniform float u_alpha;  // 透明度参数
uniform float u_shadowCasterAlpha;  // 投射阴影物体的透明度

in vec3 Normal;//法向量
in vec3 FragPos;//相机观察的片元位置
in vec2 TexCoord;//纹理坐标
in vec4 FragPosLightSpace;//光源观察的片元位置

uniform vec3 viewPos;//相机位置
uniform vec4 u_lightPosition; //光源位置	
uniform vec3 lightColor;//入射光颜色

uniform sampler2D diffuseTexture;
uniform sampler2D depthTexture;
uniform samplerCube cubeSampler; //盒子纹理采样器


// TODO3: 添加阴影计算
float shadowCalculation(vec4 fragPosLightSpace, vec3 normal, vec3 lightDir)
{
    // 1. 透视除法
    vec3 projCoords = fragPosLightSpace.xyz / fragPosLightSpace.w;
    // 2. 变换到 [0,1] 的范围
    projCoords = projCoords * 0.5 + 0.5;

    // 3. 解决超出视锥体远平面的问题
    if(projCoords.z > 1.0)
        return 0.0;

    // 4. 获取当前片元的深度
    float currentDepth = projCoords.z;

    // 5. 计算 Bias (偏移量) 防止阴影波纹 (Shadow Acne)
    float bias = max(0.005 * (1.0 - dot(normal, lightDir)), 0.0005);

    // 阴影反走样 (PCF)
    float shadow = 0.0;
    vec2 texelSize = 1.0 / vec2(textureSize(depthTexture, 0));
    // 3x3 采样，平滑阴影边缘
    for(int x = -1; x <= 1; ++x)
    {
        for(int y = -1; y <= 1; ++y)
        {
            float pcfDepth = texture(depthTexture, projCoords.xy + vec2(x, y) * texelSize).r; 
            shadow += (currentDepth - bias > pcfDepth) ? 1.0 : 0.0;        
        }    
    }
    shadow /= 9.0; // 取平均值

    return shadow;
}

void main()
{
    
    //采样纹理颜色
    vec3 TextureColor = texture(diffuseTexture, TexCoord).xyz;

    //计算光照颜色
 	vec3 norm = normalize(Normal);
	vec3 lightDir;
	if(u_lightPosition.w==1.0) 
        lightDir = normalize(u_lightPosition.xyz - FragPos);
	else lightDir = normalize(u_lightPosition.xyz);
	vec3 viewDir = normalize(viewPos - FragPos);
	vec3 halfDir = normalize(viewDir + lightDir);


    /*TODO2:根据phong shading方法计算ambient,diffuse,specular*/
    // 1. 环境光 (Ambient)
    vec3 ambient = ambientStrength* lightColor;

    // 2. 漫反射 (Diffuse)
    float diff = max(dot(norm, lightDir), 0.0);
    vec3 diffuse = diffuseStrength * diff * lightColor;

    // 3. 高光 (Specular) - Blinn-Phong
    float spec = pow(max(dot(norm, halfDir), 0.0), shininess);
    vec3 specular = specularStrength * spec * lightColor;

    vec3 lightReflectColor = (ambient + diffuse + specular);

    // 判定是否阴影
    float shadow = shadowCalculation(FragPosLightSpace, norm, lightDir);
    shadow *= u_shadowCasterAlpha; // 使用阴影投射者的透明度

    // 颜色混合
    vec3 resultColor = (1.0 - shadow / 2.0) * lightReflectColor * TextureColor;
    //vec3 resultColor = (ambient + (1.0 - shadow) * (diffuse + specular)) * TextureColor;

    //计算雾因子
    float dist = length(viewPos - FragPos);
    float fogFactor = exp(-fogDensity * fogDensity * dist * dist);
    fogFactor = clamp(fogFactor, 0.0, 1.0);

    // 混合雾
    vec3 finalColor = mix(fogColor, resultColor, fogFactor);
    // 雾也影响透明度
    // 物理原理：雾越浓，物体越像雾本身（不透明）
    float finalAlpha = mix(1.0, u_alpha, fogFactor);
    FragColor = vec4(finalColor, finalAlpha);
}



