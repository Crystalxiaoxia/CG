var canvas;
var gl;
var program;

var vBuffer, cBuffer;//顶点属性数组

// ================== 全局交互参数 ====================
var modelScale; //物体整体缩放因子
var theta; // 相机绕Y轴旋转角度
var phi;   // 相机绕X轴旋转角度
var isOrth; // 投影方式（正交 / 透视）
var fov;   // 透视投影视角

var modelPos = [0, 0, 0]; // ✅ 新增：模型的平移位置
var lastMouseX = 0, lastMouseY = 0;
var isDragging = false;

// 矩阵
var ModelMatrix;
var ViewMatrix;
var ProjectionMatrix;

// shader 统一变量
var u_ModelMatrix, u_ViewMatrix, u_ProjectionMatrix;
var u_Flag;

/* ***********窗口加载时调用:程序环境初始化程序****************** */
window.onload = function() {
    canvas = document.getElementById("canvas");
    gl = canvas.getContext('webgl2');
    if (!gl) { alert("WebGL isn't available"); }

    program = initShaders(gl, "shaders/3d-wandering.vert", "shaders/3d-wandering.frag");
    gl.useProgram(program);

    resize();

    gl.enable(gl.DEPTH_TEST);
    gl.clearColor(1.0, 1.0, 1.0, 1.0);

    // buffer 初始化
    vBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);
    var vPosition = gl.getAttribLocation(program, "vPosition");
    gl.vertexAttribPointer(vPosition, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vPosition);

    cBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, cBuffer);
    var vColor = gl.getAttribLocation(program, "vColor");
    gl.vertexAttribPointer(vColor, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vColor);

    // uniform 变量
    u_ModelMatrix = gl.getUniformLocation(program, "u_ModelMatrix");
    u_ViewMatrix = gl.getUniformLocation(program, "u_ViewMatrix");
    u_ProjectionMatrix = gl.getUniformLocation(program, "u_ProjectionMatrix");
    u_Flag = gl.getUniformLocation(program, "u_Flag");

    initViewingParameters();

    vertextsXYZ();
    generateCube();

    SendData();
    render();

    // 注册事件
    window.onkeydown = onKeyDown;
    canvas.onmousedown = onMouseDown;
    canvas.onmouseup = onMouseUp;
    canvas.onmousemove = onMouseMove;
    window.onresize = resize;
};

/* *********** 键盘交互 *********** */
function onKeyDown(e) {
    const step = 0.1; // 移动步长
    switch (e.keyCode) {
        case 90:    // Z-模型沿Y轴旋转
            modelScale *=1.1;
            break;
        case 67:    // C-模型沿Y轴反向旋转
            modelScale *= 0.9;
            break;

        case 87:    // W-视点绕X轴顺时针旋转5度
            phi -= 5;
            break;
        case 83:    // S-视点绕X轴逆时针旋转5度
            phi += 5;
            break;
        case 65:    // A-视点绕Y轴顺时针旋转5度
            theta -= 5;
            break;
        case 68:    // D-视点绕Y轴逆时针旋转5度
            theta += 5;
            break;
                
        case 80:    // P-切换投影方式
            isOrth = !isOrth;
            break;
        case 77:    // M-放大俯仰角，给了一个限制范围
            fov = Math.min(fov + 5, 170);
            break;
        case 78:    // N-较小俯仰角
            fov = Math.max(fov - 5, 5);
            break; 			
        
        case 32:    // 空格-复位
            initViewingParameters();
            break;
              
        case 82: // R - 设置后向面剔除（开启）
            // 启用剔除并剔除背面（BACK）
            gl.enable(gl.CULL_FACE);
            gl.cullFace(gl.BACK); 
            alert("开启后向面剔除");
            break;
        case 84: // T - 关闭面剔除
            gl.disable(gl.CULL_FACE);
            alert("关闭后向面剔除");
            break;

        case 66: // B - 开启深度缓存消隐算法
            gl.enable(gl.DEPTH_TEST);
            alert("开启深度缓存消隐算法");
            break;
        case 86: // V - 关闭深度缓存（不进行深度测试）
            gl.disable(gl.DEPTH_TEST);
            alert("关闭深度缓存消隐算法");
            break;
    }
    render();
}

/* *********** 鼠标拖动控制相机 *********** */
function onMouseDown(e) {
    isDragging = true;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
}
function onMouseUp(e) {
    isDragging = false;
}
function onMouseMove(e) {
    if (!isDragging) return;
    var dx = e.clientX - lastMouseX;
    var dy = e.clientY - lastMouseY;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;

    // 鼠标左右控制theta，上下控制phi
    theta += dx * 0.5;
    phi += dy * 0.5;
    phi = Math.max(5, Math.min(175, phi)); // 限制视角范围
    render();
}

/* 绘图界面随窗口交互缩放而相应变化，保持1:1防止图形变形 */
window.onresize = resize;
function resize(){
    var size = Math.min(document.body.clientWidth, document.body.clientHeight);
    canvas.width = size;
    canvas.height = size;
    gl.viewport( 0, 0, canvas.width, canvas.height );
    render();
}


/* ****************************************
*  渲染函数render 
*******************************************/
function render(){    
    // 用背景色清屏
    gl.clear( gl.COLOR_BUFFER_BIT );
    
    // 构造观察流程中需要的三各变换矩阵
    ModelMatrix=formModelMatrix();//M:模型变换矩阵
    ViewMatrix=formViewMatrix(); //V:视点变换矩阵
    ProjectionMatrix=formProjectMatrix(); //投影变换矩阵
    
    // 传递变换矩阵    
    gl.uniformMatrix4fv( u_ModelMatrix, false, flatten(ModelMatrix) );     
    gl.uniformMatrix4fv( u_ViewMatrix, false, flatten(ViewMatrix) ); 
    gl.uniformMatrix4fv( u_ProjectionMatrix, false, flatten(ProjectionMatrix) ); 
	
    // 标志位设为0，用顶点数据绘制坐标系
    gl.uniform1i( u_Flag, 0 );
    gl.drawArrays( gl.LINES, 0, 6 ); // 绘制X轴，从0开始，读6个点
    gl.drawArrays( gl.LINES, 6, 6 ); // 绘制y轴，从6开始，读6个点
    gl.drawArrays( gl.LINES, 12, 6 ); // 绘制z轴，从12开始，读6个点        

    // 标志位设为1，用顶点数据绘制 面单色立方体
    gl.uniform1i( u_Flag, 1 );
    gl.drawArrays( gl.TRIANGLES, 18, points.length - 18 ); // 绘制物体,都是三角形网格表面
}


/* ****************************************************
* 初始化或复位：需要将交互参数及变换矩阵设置为初始值
********************************************************/
function initViewingParameters(){
	modelScale=1.0;		
    theta = 0;     
	phi = 90;	
    isOrth = true;     
	fov = 120;
	
    // 重置矩阵
	ModelMatrix = mat4(); //单位矩阵
    ViewMatrix = mat4();//单位矩阵
    ProjectionMatrix = mat4();//单位矩阵

    // 默认状态（关闭剔除，开启深度测试）
    gl.disable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);
    gl.cullFace(gl.BACK);
};


/****************************************************************
* 初始及交互菜单选择不同图形后，需要重新发送顶点属性数据给GPU
******************************************************************/
function SendData(){
    var pointsData = flatten(points);
    var colorsData = flatten(colors);

    gl.bindBuffer( gl.ARRAY_BUFFER, vBuffer );
    gl.bufferData( gl.ARRAY_BUFFER, pointsData, gl.STATIC_DRAW );
    gl.bindBuffer( gl.ARRAY_BUFFER, cBuffer );
    gl.bufferData( gl.ARRAY_BUFFER, colorsData, gl.STATIC_DRAW );
}


/********************************************************
* 交互菜单选择不同图形后，需要重新生成顶点数据并渲染
******************************************************/
function modelChange(model) {
    const canvas = document.getElementById("canvas");
    const container = document.getElementById("container");

    if (model === 'solar') {
        // 🔸 隐藏 WebGL 画布
        canvas.style.display = "none";
        // 🔸 显示 Three.js 太阳系
        container.style.display = "block";

        // 若 Three.js 未初始化，则重新加载 main.js
        if (typeof window.initThreeJS === "function") {
            window.initThreeJS(); // 重新初始化
        }
        return;
    } else {
        // 🔸 切换回 WebGL
        container.style.display = "none";
        canvas.style.display = "block";
    }

    // ===============================
    // 原本的 WebGL 模型逻辑（保留）
    // ===============================
    points = [];
    colors = [];

    switch(model){
        case 'cube':
            vertextsXYZ();
            generateCube();
            break;
        case 'sphere':
            vertextsXYZ();
            generateSphere();
            break;
        case 'hat':
            vertextsXYZ();
            generateHat();
            break;
    }

    SendData(); //重新发送数据
    render(); //重新渲染
}



/* ****************************************************
 * 生成观察流水管线中的 M,V,P矩阵  
********************************************************/
function formModelMatrix() {
    var s = modelScale;
    var scaleMatrix = mat4(
        s, 0, 0, 0,
        0, s, 0, 0,
        0, 0, s, 0,
        0, 0, 0, 1
    );
    var translateMatrix = mat4(
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        modelPos[0], modelPos[1], modelPos[2], 1
    );
    return mult(translateMatrix, scaleMatrix);
}

/* *********** 视图矩阵（相机位置根据theta/phi） *********** */
function formViewMatrix() {
    var radius = 3.0;
    var th = radians(theta);
    var ph = radians(phi);

    var ex = radius * Math.sin(ph) * Math.sin(th);
    var ey = radius * Math.cos(ph);
    var ez = radius * Math.sin(ph) * Math.cos(th);

    var eye = vec3(ex, ey, ez);
    var at = vec3(0.0, 0.0, 0.0);
    var up = vec3(0.0, 1.0, 0.0);

    var forward = normalize(subtract(at, eye));
    if (Math.abs(dot(forward, up)) > 0.999) {
        up = vec3(0.0, 0.0, 1.0);
    }
    return lookAt(eye, at, up);
}

/* *********** 投影矩阵 *********** */
function formProjectMatrix() {
    var near = 0.1, far = 100.0;
    var aspect = canvas.width / canvas.height;

    if (isOrth) {
        var half = 1.5;
        var left = -half * aspect, right = half * aspect;
        var bottom = -half, ytop = half;
        return ortho(left, right, bottom, ytop, near, far);
    } else {
        return perspective(fov, aspect, near, far);
    }
}


