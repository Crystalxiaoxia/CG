"use strict";

var canvas;
var gl;

var numTimesToSubdivide = 0; 
var points = []; //存放所生成的所有顶点的位置

var bufferId;
var colorbufferId;

var vertices = [
        vec2( -0.6, -0.6 ),
        vec2(  0,  0.6 ),
        vec2(  0.6, -0.6)
];

// ------------- add -------------
var colorsOfVertexs=[]; //存放所生成的所有顶点的颜色
var c1,c2,c3;
	c1 = vec4( 1.0, 0.0, 0.0, 1.0 );
	c2 = vec4( 0.0, 1.0, 0.0, 1.0 );
	c3 = vec4( 0.0, 0.0, 1.0, 1.0 );

var theta = 0.0;
var spead = 0.1;
var thetaLoc;
var centerX=0.0;
var centerXLoc;
var centerY=0.0;
var centerYLoc;

var animflag=false;
var sliderchangeflag=false;
var centerchageflag=false;//如果鼠标重新点击了中心，需要把新中心传递给shader

window.onload = function init()
{
    // 初始化Canvas画布
    var canvas = document.getElementById("gl-canvas");
    gl = canvas.getContext('webgl2');
    if (!gl) alert( "WebGL 2.0 isn't available" );

    gl.SwapIn
    // 设置视口和清除时的填充颜色
    gl.viewport( 0, 0, canvas.width, canvas.height );
    gl.clearColor( 1.0, 1.0, 1.0, 1.0 );

    // 生成 Sierpinski Gasket 顶点数据，保存到 points 中
    divideTriangle( vertices[0], vertices[1], vertices[2],numTimesToSubdivide);

    // 加载顶点着色器和片元着色器
    var program = initShaders(gl, "shaders/gasket2D.vert", "shaders/gasket2D.frag");
    gl.useProgram(program);

    // 初始化顶点位置缓冲
    // 缓冲的数据会被传输到着色器对应的变量当中
    bufferId = gl.createBuffer();
    gl.bindBuffer( gl.ARRAY_BUFFER, bufferId );	
	gl.bufferData( gl.ARRAY_BUFFER, flatten(points), gl.STATIC_DRAW );

    // 配置顶点属性，将顶点缓冲和着色器变量关联
    // gl.vertexAttribPointer(index, size, type, normalized, stride, pointer)
    var vPosition = gl.getAttribLocation( program, "aPosition" );
    gl.vertexAttribPointer( vPosition, 2, gl.FLOAT, false, 0, 0 );
    gl.enableVertexAttribArray( vPosition );
	
    colorbufferId = gl.createBuffer();
    gl.bindBuffer( gl.ARRAY_BUFFER, colorbufferId );	
	gl.bufferData( gl.ARRAY_BUFFER, flatten(colorsOfVertexs), gl.STATIC_DRAW );
	
    var vColor = gl.getAttribLocation( program, "aColor" );
    gl.vertexAttribPointer( vColor, 4, gl.FLOAT, false, 0, 0 );
    gl.enableVertexAttribArray( vColor );
	
    // 获取Uniform变量位置
	thetaLoc = gl.getUniformLocation( program, "theta" );
	centerXLoc = gl.getUniformLocation( program, "centerX" );
	centerYLoc = gl.getUniformLocation( program, "centerY" );
	
	// do rendering
	render();


    //*******增加滑动条的监听程序,重新生成顶点，重新绘制
	document.getElementById("slider").onchange = function(event) {
		//-------------------------------------------------------------------------
		//TODO: ？这里需要添加代码，重新生成顶点，并设置滑动条变化标志sliderchangeflag
		//-------------------------------------------------------------------------
        numTimesToSubdivide = parseInt(event.target.value);
		//points = ？;
		//colorsOfVertexs=？;
		//divideTriangle(？);
		//sliderchangeflag=？;		
        // 重置顶点和颜色数组
        points = [];
        colorsOfVertexs = [];

        // 使用新的递归次数重新生成顶点
        divideTriangle(vertices[0], vertices[1], vertices[2], numTimesToSubdivide);

        // 设置滑动条变化标志
        sliderchangeflag = true;

        // 重新绘制图形（这通常在render函数中进行调用）
        render(); 
    };	

	
	//*********增加鼠标点击事件,移动坐标中心
	//canvas.addEventListener("click", function(event) {
	canvas.addEventListener("mousedown", function(event){
		var x = event.clientX; // x coordinate of a mouse pointer
		var y = event.clientY; // y coordinate of a mouse pointer
		var rect = event.target.getBoundingClientRect() ;
		//---------------------------------------------------------------------------------
		 //TODO: 这里需要添加代码,获取鼠标点击位置的屏幕坐标（canvas坐标），并设置标志centerchageflag
		//--------------------------------------------------------------------------------
	     //centerX= ? ;
	     //centerY= ? ;
		 //centerchageflag=?;	 
        centerX = (x / canvas.width) * 2 - 1;  // 将X坐标标准化为[-1, 1]
        centerY = -((y / canvas.height) * 2 - 1); // 将Y坐标标准化为[-1, 1]
        centerchageflag = true;  // 标记中心已改变
	});
		
	//*******动画启动/停止监听器 Initialize event handlers
    document.getElementById("Animation").onclick = function () {
		//------------------------------------------
		//TODO: ？这里需要添加代码，切换图形是否旋转
		//-----------------------------------------
        //animflag = ();
         animflag = !animflag; // 切换旋转状态
    };
	document.getElementById("speadUp").onclick = function () {
		spead += 0.05; 
    };

	document.getElementById("speadDown").onclick = function () {
        if(spead - 0.05 >= 0){
            spead -= 0.05;
        }else spead == 0;
    };
};

/*********绘图界面随窗口交互缩放而相应变化**************/
window.onresize = function(){
    canvas.width = document.body.clientWidth;
    canvas.height = document.body.clientHeight;
    gl.viewport( (canvas.width-canvas.height)/2, 0, canvas.height, canvas.height);
	
	render();
}

 
function triangle( a, b, c )
{

    points.push( a, b, c );	
	// ------------- add color -------------
	colorsOfVertexs.push(c1);
	colorsOfVertexs.push(c2);
	colorsOfVertexs.push(c3);
	// ------------- add color -------------
}

function divideTriangle( a, b, c, count )
{
    // check for end of recursion
    if ( count == 0 ) {
        triangle( a, b, c );
    }
    else {
        //bisect the sides找中点
        var ab = mix( a, b, 0.5 );
        var ac = mix( a, c, 0.5 );
        var bc = mix( b, c, 0.5 );

        count=count-1;        //count--;	
         		
        //three new triangles，递归调用
        divideTriangle( a, ab, ac, count );
		divideTriangle( ab,b, bc, count );
		divideTriangle( ac, bc, c, count );

    }
}


function render()
{
    countFPSAndPoint();
    gl.clear(gl.COLOR_BUFFER_BIT);

    if(animflag)//如果旋转控制按钮由切换，需要发送旋转角度给shader
	{
		theta += spead ;
		gl.uniform1f(thetaLoc, theta);		
	};


    if(sliderchangeflag)//如果slider值有变化需要发送Gasket2D 新初始顶点属性数据给shader
	{	
		gl.bindBuffer( gl.ARRAY_BUFFER, bufferId );	
		gl.bufferData( gl.ARRAY_BUFFER, flatten(points), gl.STATIC_DRAW );		
		gl.bindBuffer( gl.ARRAY_BUFFER, colorbufferId );	
		gl.bufferData( gl.ARRAY_BUFFER, flatten(colorsOfVertexs), gl.STATIC_DRAW );		
    }

	if(centerchageflag)//如果鼠标重新点击了中心，需要把新中心传递给shader
	{
		gl.uniform1f(centerXLoc, centerX);
		gl.uniform1f(centerYLoc, centerY);
    }
	
	gl.drawArrays( gl.TRIANGLES, 0, points.length );	
	sliderchangeflag=false;
	centerchageflag=false;

	// ------------- 请求下一帧 -------------
	requestAnimFrame(render);   
}

var frame = 0;
var allFrameCount = 0;
var lastTime = Date.now();
var lastFameTime = Date.now();
function  countFPSAndPoint() {
    var now = Date.now();  
    lastFameTime = now;
    // 不置 0，在动画的开头及结尾记录此值的差值算出 FPS
    allFrameCount++;
    frame++;
  
    if (now > 1000 + lastTime) {
        var fps = Math.round((frame * 1000) / (now - lastTime))
        console.log(`${new Date()} 1S内 FPS：`, fps);
		document.getElementById("label").innerHTML=("FPS: "+fps);
        frame = 0;
        lastTime = now;
    };

   // 显示顶点数（去重后的独立顶点）
    let uniqueVertices = [];
    for (let i = 0; i < points.length; i++) {
        let p = points[i];
        // 判断是否已经存在（比较坐标）
        if (!uniqueVertices.some(v => v[0] === p[0] && v[1] === p[1])) {
            uniqueVertices.push(p);
        }
    }
    document.getElementById("vertexCountLabel").innerText = "顶点数: " + uniqueVertices.length;


    // 显示顶点数 
    // document.getElementById("vertexCountLabel").innerText = "顶点数: " + points.length;
}


 