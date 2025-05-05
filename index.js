import { shapeEdges, shapeFromReflectionGroup, parseListOfInts, centerOfMass, maxRadius } from "./utils.js"

const colorModes = {
    'Outline': 0,
    'Outline Filled': 6,
    'Black & White': 1,
    'Rainbow': 2,
    'Dual Outline': 3,
    'Dual Color': 4,
    'Camera': 5,
}

const pInit = 4
const qInit = 6
const maxIter = 64
const group = new Array(pInit).fill(qInit)

const glOptions = new Map()
glOptions.set("g", group)
glOptions.set("mode", 0)
glOptions.set("render", true)

const canvas = document.createElement('canvas')
const gl = canvas.getContext('webgl')
const positionBuffer = gl.createBuffer()
gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -1, -1, 1, -1, -1,  1, //UL
    -1,  1, 1, -1, 1,  1, //BR
]), gl.STATIC_DRAW)
document.body.appendChild(canvas)

const camera = document.createElement('video')
camera.style.width = "512px"
camera.style.height = "512px"
camera.style.display = "none"
document.body.appendChild(camera)

function getCamera() {
    navigator.mediaDevices.getUserMedia({video:true,audio:false})
    .then((stream)=>{ 
        try {
            if ('srcObject' in camera) camera.srcObject = stream;
            else camera.src = window.URL.createObjectURL(stream);
        } catch (err) {camera.src = stream;}
    }, console.log);
    camera.play();
}

//gl events
function computeEdges() {
    const g = glOptions.get("g")
    shapeFromReflectionGroup(g)
    .then((shape) => {
        gl.uniform1i(glOptions.get("f_p"), g.length)
        const c = centerOfMass(shape, g.length)
        gl.uniform2f(glOptions.get("f_center"), c[0], c[1])
        const r = maxRadius(shape, c, g.length)
        //console.log(c, r)
        gl.uniform1f(glOptions.get("f_r"), r)
        const edges = shapeEdges(shape, g.length)
        gl.uniform3fv(glOptions.get("f_edges"), new Float32Array(edges))
    })
    .catch(console.log)
}

function computeResolution(width, height) {
    canvas.width = width
    canvas.height = height
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)
    gl.uniform3f(glOptions.get("f_resolution"), gl.canvas.width, gl.canvas.height, 1)
}

function computeTime(time) {
    gl.uniform1f(glOptions.get("f_time"), time/1000)
}

function computeCameraTexture() {
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, camera)
}

function computeColorMode(mode) {
    gl.uniform1i(glOptions.get("f_mode"), mode)
}

function computeIterationCount(iter) {
    gl.uniform1i(glOptions.get("f_iter"), iter)
}

//window events
window.onresize = () => {
    computeResolution(innerWidth, innerHeight)
}

//UI
const uDiv = document.createElement('div')
uDiv.style.position = 'absolute'
uDiv.style.top = "20px"
uDiv.style.left = "20px"
uDiv.style.display = "flex"
uDiv.style.maxWidth = "300px"
uDiv.style.flexWrap = "wrap"
const gInput = document.createElement('input')
gInput.type = 'text'
gInput.value = group.join(',')
gInput.addEventListener('change', () => {
    const nums = parseListOfInts(gInput.value)
    if(nums == null) {
        console.log(gInput.value)
        return
    }
    glOptions.set('g', nums)
    computeEdges()
})
uDiv.appendChild(gInput)
const cSelect = document.createElement('select')
for(const mode in colorModes) {
    const option = document.createElement('option')
    option.text = mode
    option.value = colorModes[mode]
    cSelect.add(option)
}
cSelect.addEventListener('change', (evt) => {
    const mode = Number.parseInt(cSelect[cSelect.selectedIndex].value)
    if(mode == colorModes['Camera'] && !(camera.src || camera.srcObject)) {
        getCamera()
    }
    //console.log(mode)
    glOptions.set("mode", mode)
    computeColorMode(mode)
})
cSelect.selectedIndex = 0
glOptions.set("mode", cSelect[0].value)
uDiv.appendChild(cSelect)
const pButton = document.createElement('button')
pButton.innerText = "Download"
pButton.addEventListener('click', () => {
    glOptions.set("render", false)
    const str = prompt("Image Dimensions (in Pixels)")
    const dim = parseInt(str)
    if(str != null && !isNaN(dim) && dim > 0) {
        computeResolution(dim, dim)
        gl.drawArrays(gl.TRIANGLES, 0, 6)
        const data = canvas.toDataURL("image/png", 1)
        const a = document.createElement('a')
        a.download = `Hyperbolic_Tiling_${gInput.value}.png`
        a.href = data
        a.click()
    }
    glOptions.set("render", true)
    computeResolution(innerWidth, innerHeight)
    requestAnimationFrame(render)
})
uDiv.appendChild(pButton)
const iRange = document.createElement('input')
iRange.type = 'range'
iRange.min = 1
iRange.max = maxIter
iRange.value = 1
iRange.addEventListener('change', (evt) => {
    computeIterationCount(iRange.value)
})
uDiv.appendChild(iRange)
document.body.appendChild(uDiv)

function createShader(gl, sourceCode, type) {
    const shader = gl.createShader(type)
    gl.shaderSource(shader, sourceCode)
    gl.compileShader(shader)
  
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const info = gl.getShaderInfoLog(shader)
        throw `Shader cannot compile. \n\n${info}`
    }
    return shader
}

function createProgram(gl, vertexShader, fragmentShader) {
    const program = gl.createProgram()
    gl.attachShader(program, vertexShader)
    gl.attachShader(program, fragmentShader)
    gl.linkProgram(program)

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        const info = gl.getProgramInfoLog(program)
        throw `Could not compile WebGL program. \n\n${info}`
    }
    return program
}

function render(time) {
    computeTime(time)
    if(glOptions.get("mode") == colorModes['Camera']) {
        computeCameraTexture()
    }
    gl.drawArrays(gl.TRIANGLES, 0, 6)
    if(glOptions.get("render")) {
        requestAnimationFrame(render)
    }
}

//main
(async () => {
    const vertSrc = await fetch("hyper.vs").then(res => res.text())
    const fragSrc = await fetch("hyper.fs").then(res => res.text())
    const vertexShader = createShader(gl, vertSrc, gl.VERTEX_SHADER)
    const fragmentShader = createShader(gl, fragSrc, gl.FRAGMENT_SHADER)
    const program = createProgram(gl, vertexShader, fragmentShader)
    const vertexPositionLoc = gl.getAttribLocation(program, 'v_position')
    glOptions.set("f_resolution", gl.getUniformLocation(program, "f_resolution"))
    glOptions.set("f_p", gl.getUniformLocation(program, "f_p"))
    glOptions.set("f_r", gl.getUniformLocation(program, "f_r"))
    glOptions.set("f_center", gl.getUniformLocation(program, "f_center"))
    glOptions.set("f_origin", gl.getUniformLocation(program, "f_origin"))
    glOptions.set("f_edges", gl.getUniformLocation(program, "f_edges"))
    glOptions.set("f_time", gl.getUniformLocation(program, "f_time"))
    glOptions.set("f_mode", gl.getUniformLocation(program, "f_mode"))
    glOptions.set("f_iter", gl.getUniformLocation(program, "f_iter"))
    gl.useProgram(program)
    gl.enableVertexAttribArray(vertexPositionLoc)
    gl.vertexAttribPointer(vertexPositionLoc, 2, gl.FLOAT, false, 0, 0)
    const texture = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.uniform1i(gl.getUniformLocation(program, "f_cam"), 0)
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    computeResolution(innerWidth, innerHeight)
    computeEdges()
    computeIterationCount(1)
    requestAnimationFrame(render)
})()
