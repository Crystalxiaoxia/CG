var points = []; //顶点的属性：坐标数组
var colors = []; //顶点的属性：颜色数组

const VertexColors = [
    vec4( 0.0, 0.0, 0.0, 1.0 ),  // black
    vec4( 0.0, 0.0, 1.0, 1.0 ),  // blue
    vec4( 1.0, 0.0, 0.0, 1.0 ),  // red
    vec4( 0.0, 0.5, 0.0, 1.0 ),  // light-green        
    vec4( 0.0, 0.0, 0.5, 1.0 ),  // light-blue
    vec4( 0.5, 0.0, 0.0, 1.0 ),  // light-red
    vec4( 0.0, 1.0, 0.0, 1.0 ),  // green
    vec4( 0.5, 0.5, 0.5, 1.0 )   // grey
];// 常量颜色

/****************************************************
 * 坐标轴模型：X轴，Y轴，Z轴的顶点位置和颜色,(-1,1)范围内定义 
 ****************************************************/
function vertextsXYZ()
{
    const len = 0.9;
    var XYZaxis = [
        vec4(-len,  0.0,  0.0, 1.0), // X
        vec4( len,  0.0,  0.0, 1.0),
        vec4( len, 0.0, 0.0, 1.0),
        vec4(len-0.01, 0.01, 0.0, 1.0),
        vec4(len, 0.0, 0.0, 1.0),
        vec4(len-0.01, -0.01, 0.0, 1.0),
        
        vec4( 0.0, -len,  0.0, 1.0), // Y
        vec4( 0.0,  len,  0.0, 1.0),
        vec4( 0.0, len,0.0, 1.0),
        vec4(0.01, len-0.01, 0.0, 1.0),
        vec4(0.0, len, 0.0, 1.0),
        vec4(-0.01, len-0.01, 0.0, 1.0),
        
        vec4( 0.0,  0.0, -len, 1.0), // Z
        vec4( 0.0,  0.0,  len, 1.0),
        vec4( 0.0, 0.0, len, 1.0),
        vec4( 0.01, 0.0,  len-0.01, 1.0),
        vec4( 0.0, 0.0, len, 1.0),
        vec4( -0.01,0.0,  len-0.01, 1.0)
    ];
    
    var XYZColors = [
        vec4(1.0, 0.0, 0.0, 1.0),  // red
        vec4(0.0, 1.0, 0.0, 1.0),  // green
        vec4(0.0, 0.0, 1.0, 1.0),  // blue
    ];
    
    for (var i = 0; i < XYZaxis.length; i++){    
        points.push(XYZaxis[i]);
        var j = Math.trunc(i/6); // JS取整运算Math.trunc//每个方向轴用6个顶点
        colors.push(XYZColors[j]);
    }
}

/****************************************************
 * 立方体模型生成
 ****************************************************/
function generateCube()
{
    quad( 1, 0, 3, 2 ); //Z正-前
    quad( 4, 5, 6, 7 ); //Z负-后
    
    quad( 2, 3, 7, 6 ); //X正-右
    quad( 5, 4, 0, 1 ); //X负-左
    
    quad( 6, 5, 1, 2 ); //Y正-上
    quad( 3, 0, 4, 7 ); //Y负-下
} 

function quad(a, b, c, d) 
{
	const vertexMC = 0.5; // 顶点分量X,Y,Z到原点距离
    var vertices = [
        vec4( -vertexMC, -vertexMC,  vertexMC, 1.0 ), //Z正前面左下角点V0，顺时针四点0~3
        vec4( -vertexMC,  vertexMC,  vertexMC, 1.0 ),
        vec4(  vertexMC,  vertexMC,  vertexMC, 1.0 ),
        vec4(  vertexMC, -vertexMC,  vertexMC, 1.0 ),
        vec4( -vertexMC, -vertexMC, -vertexMC, 1.0 ),   //Z负后面左下角点V4，顺时针四点4~7
        vec4( -vertexMC,  vertexMC, -vertexMC, 1.0 ),
        vec4(  vertexMC,  vertexMC, -vertexMC, 1.0 ),
        vec4(  vertexMC, -vertexMC, -vertexMC, 1.0 )
    ];

    var indices = [ a, b, c, a, c, d ];
    for ( var i = 0; i < indices.length; ++i ) {
        points.push(vertices[indices[i]]);  // 保存一个顶点坐标到定点给数组vertices中        
        colors.push(VertexColors[a]); // 立方体每面为单色
    }
}

/****************************************************
 * 球体模型生成：由四面体递归生成
 ****************************************************/
function generateSphere(){
    // 细分次数和顶点
    const numTimesToSubdivide = 5; // 球体细分次数
    var va = vec4(0.0, 0.0, -1.0, 1.0);
    var vb = vec4(0.0, 0.942809, 0.333333, 1.0);
    var vc = vec4(-0.816497, -0.471405, 0.333333, 1.0);
    var vd = vec4(0.816497, -0.471405, 0.333333, 1.0);
    
    function triangle(a, b, c) {
        points.push(a);
        points.push(b);
        points.push(c);
        
        colors.push(vec4(0.0, 1.0, 1.0, 1.0));
        colors.push(vec4(1.0, 0.0, 1.0, 1.0));
        colors.push(vec4(0.0, 1.0, 0.0, 1.0));
    };

    function divideTriangle(a, b, c, count) {
        if ( count > 0 ) {
            var ab = mix( a, b, 0.5);
            var ac = mix( a, c, 0.5);
            var bc = mix( b, c, 0.5);

            ab = normalize(ab, true);
            ac = normalize(ac, true);
            bc = normalize(bc, true);

            divideTriangle(  a, ab, ac, count - 1 );
            divideTriangle( ab,  b, bc, count - 1 );
            divideTriangle( bc,  c, ac, count - 1 );
            divideTriangle( ab, bc, ac, count - 1 );
        }
        else {
            triangle( a, b, c );
        }
    }

    function tetrahedron(a, b, c, d, n) {
        divideTriangle(a, b, c, n);
        divideTriangle(d, c, b, n);
        divideTriangle(a, d, b, n);
        divideTriangle(a, c, d, n);
    };

    tetrahedron(va, vb, vc, vd, numTimesToSubdivide); // 递归细分生成球体
}

/****************************************************
* TODO1: 墨西哥帽模型生成，等距细分得z,x，函数计算得到y
****************************************************/
// function generateHat()
// {
    
//     // 这里(x,z)是区域（-1，-1）到（1，1）平均划分成nRows*nColumns得到的交点坐标；
//     var nRows = 11; // 线数，实际格数=nRows-1,
//     var nColumns = 11; // 线数,实际格数=nColumns-1

//     // 嵌套数组data用于存储网格上交叉点的高值(y)值。
//     var data = new Array(nRows);
//     for(var i = 0; i < nRows; i++) {
//         data[i] = new Array(nColumns);
//     };
    
//     // todo：遍历网格上每个点，求点的高度(即Y值)

    
//     // todo：顶点数据按每四个片元构成一个四边形网格图元，存放顶点属性用points.push(),colors.push()，颜色可以随意

	
// }

// function generateHat()
// {
//     var nRows = 21; // 细分行数，越大越平滑
//     var nColumns = 21; // 细分列数
//     var data = new Array(nRows);

//     for (var i = 0; i < nRows; i++) {
//         data[i] = new Array(nColumns);
//     }

//     // 坐标范围 (-1, 1)
//     var xMin = -1.0, xMax = 1.0;
//     var zMin = -1.0, zMax = 1.0;

//     var dx = (xMax - xMin) / (nColumns - 1);
//     var dz = (zMax - zMin) / (nRows - 1);

//     // ① 遍历网格点，计算 y = sin(pi*r)/(pi*r)
//     for (var i = 0; i < nRows; i++) {
//         for (var j = 0; j < nColumns; j++) {
//             var x = xMin + j * dx;
//             var z = zMin + i * dz;
//             var r = Math.sqrt(x*x + z*z);
//             var y = (r === 0.0) ? 1.0 : Math.sin(Math.PI * r) / (Math.PI * r);
//             data[i][j] = vec4(x, y, z, 1.0);
//         }
//     }

//     // ② 将每个网格转为两个三角形
//     for (var i = 0; i < nRows - 1; i++) {
//         for (var j = 0; j < nColumns - 1; j++) {
//             var p1 = data[i][j];
//             var p2 = data[i][j+1];
//             var p3 = data[i+1][j];
//             var p4 = data[i+1][j+1];

//             // 三角形1: p1, p2, p3
//             points.push(p1);
//             points.push(p2);
//             points.push(p3);

//             // 三角形2: p2, p4, p3
//             points.push(p2);
//             points.push(p4);
//             points.push(p3);

//             // 为每个顶点添加颜色，可根据高度 y 变化
//             var color1 = vec4((p1[1]+1)/2, 0.5, 1.0-(p1[1]+1)/2, 1.0); // 渐变色
//             for (var k = 0; k < 6; k++) {
//                 colors.push(color1);
//             }
//         }
//     }
// }

function generateHat() {
    var nRows = 21;
    var nColumns = 21;
    
    // 统一使用相同的坐标范围
    var coordinateRange = 2.2; // 统一使用2.5的范围
    
    var data = new Array(nRows);
    for(var i = 0; i < nRows; i++) {
        data[i] = new Array(nColumns);
    };
    
    // 计算高度数据
    for(var i = 0; i < nRows; i++) {
        for(var j = 0; j < nColumns; j++) {
            var x = (j / (nColumns - 1) * 2 - 1) * coordinateRange;
            var z = (i / (nRows - 1) * 2 - 1) * coordinateRange;
            
            var rSquared = x * x + z * z;
            var y = (1 - rSquared) * Math.exp(-rSquared / 2);
            data[i][j] = y;
        }
    }

    // 构建顶点
    for(var i = 0; i < nRows - 1; i++) {
        for(var j = 0; j < nColumns - 1; j++) {
            // 使用相同的坐标计算方法
            var x1 = (j / (nColumns - 1) * 2 - 1) * coordinateRange;
            var z1 = (i / (nRows - 1) * 2 - 1) * coordinateRange;
            var y1 = data[i][j];
            
            var x2 = ((j + 1) / (nColumns - 1) * 2 - 1) * coordinateRange;
            var z2 = (i / (nRows - 1) * 2 - 1) * coordinateRange;
            var y2 = data[i][j + 1];
            
            var x3 = ((j + 1) / (nColumns - 1) * 2 - 1) * coordinateRange;
            var z3 = ((i + 1) / (nRows - 1) * 2 - 1) * coordinateRange;
            var y3 = data[i + 1][j + 1];
            
            var x4 = (j / (nColumns - 1) * 2 - 1) * coordinateRange;
            var z4 = ((i + 1) / (nRows - 1) * 2 - 1) * coordinateRange;
            var y4 = data[i + 1][j];
            
            // 如果需要归一化到[-1,1]，使用适当的缩放因子
            var scale = 1.0 / coordinateRange;
            var v1 = vec4(x1 * scale, y1, z1 * scale, 1.0);
            var v2 = vec4(x2 * scale, y2, z2 * scale, 1.0);
            var v3 = vec4(x3 * scale, y3, z3 * scale, 1.0);
            var v4 = vec4(x4 * scale, y4, z4 * scale, 1.0);
            
            // 构建三角形（保持不变）
            points.push(v1, v2, v3, v1, v3, v4);
            
            // 颜色计算（保持不变）
            // ... 颜色代码 ...
            // 漂亮的颜色方案 - 根据高度使用渐变色彩
            var height1 = data[i][j];
            var height2 = data[i][j + 1];
            var height3 = data[i + 1][j + 1];
            var height4 = data[i + 1][j];
            
            // 定义几种漂亮的颜色
            var colorTop = vec4(1.0, 0.8, 0.6, 1.0);    // 浅橙色 - 帽顶
            var colorMiddle = vec4(0.9, 0.7, 0.3, 1.0); // 金色 - 帽身
            var colorRim = vec4(0.7, 0.5, 0.2, 1.0);    // 深金色 - 帽檐
            var colorEdge = vec4(0.5, 0.3, 0.1, 1.0);   // 深棕色 - 帽边
            
            // 为每个顶点计算颜色（基于高度）
            function getColorByHeight(height) {
                if (height > 0.5) return colorTop;
                if (height > 0) return colorMiddle;
                if (height > -0.2) return colorRim;
                return colorEdge;
            }
            
            // 为六个顶点分别设置颜色（两个三角形）
            colors.push(getColorByHeight(height1));
            colors.push(getColorByHeight(height2));
            colors.push(getColorByHeight(height3));
            colors.push(getColorByHeight(height1));
            colors.push(getColorByHeight(height3));
            colors.push(getColorByHeight(height4));
        }
    }
}






