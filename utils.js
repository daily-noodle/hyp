import {Ceres} from 'https://cdn.jsdelivr.net/gh/Pterodactylus/Ceres.js@latest/dist/ceres.min.js'

function circleFromThreePoints(ax, ay, bx, by, cx, cy) {
    const ab = ((ax*ax+ay*ay)-(bx*bx+by*by))/2
    const bc = ((bx*bx+by*by)-(cx*cx+cy*cy))/2
    const det = (ax-bx)*(by-cy)-(ay-by)*(bx-cx)
    const dx = (ab*(by-cy)-bc*(ay-by))/det
    const dy = (bc*(ax-bx)-ab*(bx-cx))/det
    const r = Math.sqrt((dx-ax)*(dx-ax)+(dy-ay)*(dy-ay))
    return [dx, dy, r]
}

function circleInvert(px, py, cx, cy, r) {
    if(r < 0) return p
    const vx = px - cx
    const vy = py - cy
    const scale = r*r/(vx*vx+vy*vy)
    return [vx*scale+cx,vy*scale+cy]
}

function shapeRad(p, q) {
    const t1 = Math.tan(Math.PI/2-Math.PI/q)
    const t2 = Math.tan(Math.PI/p)
    return Math.sqrt((t1-t2)/(t1+t2))
}

function baseShape(p, r) {
    const shape = []
    for (let i = 0; i < p; i++) {
        const a = 2*Math.PI*i/p
        shape.push(r*Math.cos(a))
        shape.push(r*Math.sin(a))
    }
    shape.push(shape[0])
    shape.push(shape[1])
    return shape
}

function shapeEdges(shape, p) {
    const edges = []
    for (let i = 0; i < p; i++) {
        const ax = shape[2*i]
        const ay = shape[2*i+1]
        const bx = shape[2*i+2]
        const by = shape[2*i+3]
        const c = circleInvert(ax, ay, 0, 0, 1)
        const circ = circleFromThreePoints(ax, ay, bx, by, c[0], c[1])
        edges.push(circ[0])
        edges.push(circ[1])
        edges.push(circ[2])
    }
    return edges
}

function sideFunction(i, angles) {
    const cIdx = (i + angles.length - 1) % angles.length
    const bIdx = i % angles.length
    const aIdx = (i + 1) % angles.length
    const A = angles[aIdx] //angle ccw of angle i
    const B = angles[bIdx] //angle i
    const cosI = Math.cos(2*Math.PI/angles.length)
    return (xs) => {
        const xA = xs[aIdx]
        const xB = xs[bIdx]
        const xC = xs[cIdx]
        return Math.cos(A-xA)*Math.sin(B-xB) - Math.cos(xC)*Math.sin(xB) - Math.sin(2*xB-B)*cosI
    }
}

async function solveAngleDiffs(angles) {
    const solver = new Ceres()
    let angleSum = 0
    for (let i = 0; i < angles.length; i++) {
        solver.addFunction(sideFunction(i, angles))
        angleSum += angles[i]
    }
    if (angleSum >= Math.PI * (angles.length - 2)) {
        throw new Error("angle sum too large")
    }
    const xInit = angles.map((a) => a/2)
    const res = await solver.solve(xInit)
    window.solverReport = res.report
    return res.x
}

function vertexPoincareDistanceFromAngles(A, B, C) {
    const x = (Math.cos(C) + Math.cos(A)*Math.cos(B))/(Math.sin(A)*Math.sin(B))
    const d = x + Math.sqrt(x*x - 1)
    return (d - 1)/(d + 1)
}

async function shapeFromAngles(angles) {
    const diffs = await solveAngleDiffs(angles)
    const I = 2*Math.PI/angles.length
    const shape = []
    for (let i = 0; i < angles.length; i++) {
        const A = diffs[i]
        const cIdx = (i+1)%angles.length
        const C = angles[cIdx] - diffs[cIdx]
        const r = vertexPoincareDistanceFromAngles(A, I, C)
        const a = 2*Math.PI*i/angles.length
        shape.push(r*Math.cos(a))
        shape.push(r*Math.sin(a))
    }
    for(let i = 0; i < 4; i++) {
        shape.push(shape[i])
    }
    return shape
}

async function shapeFromReflectionGroup(group) {
    const angles = group.map((n) => 2*Math.PI/n)
    return await shapeFromAngles(angles)
}

function parseListOfInts(str) {
    const nums = str.split(',').map((s) => parseInt(s))
    if(nums.some(isNaN)) return null
    return nums
}

function dist2d(x1, y1, x2, y2) {
    const dx = x1 - x2
    const dy = y1 - y2
    return Math.sqrt(dx*dx + dy*dy)
}

function triangleIncenter(x1, y1, x2, y2, x3, y3) {
    const a = dist2d(x1, y1, x2, y2)
    const b = dist2d(x1, y1, x3, y3)
    const c = dist2d(x2, y2, x3, y3)
    return [
        (a*x3 + b*x2 + c*x1) / (a + b + c),
        (a*y3 + b*y2 + c*y1) / (a + b + c)
    ]
}

function centerOfMass(shape, p) {
    let sumX = 0
    let sumY = 0
    for(let i = 0; i < p; i++) {
        const c = triangleIncenter(shape[2*i], shape[2*i+1], shape[2*i+2], shape[2*i+3], shape[2*i+4], shape[2*i+5])
        sumX += c[0]
        sumY += c[1]
    }
    return [sumX/p, sumY/p]
}

function maxRadius(shape, center, p) {
    let r2 = 0
    for(let i = 0; i < p; i++) {
        const dx = shape[2*i] - center[0]
        const dy = shape[2*i+1] - center[1]
        const dr = dx*dx + dy*dy
        if(dr > r2) r2 = dr
    }
    return Math.sqrt(r2)
}

export {
    circleFromThreePoints, 
    circleInvert, 
    shapeRad,
    baseShape,
    shapeEdges,
    shapeFromAngles,
    shapeFromReflectionGroup,
    parseListOfInts,
    centerOfMass,
    maxRadius
}

/* old compute edges for regular shapes
function computeEdges() {
    const p = glOptions.get('p')
    const q = glOptions.get('q')
    gl.uniform1i(glOptions.get("f_p"), p)
    const r = shapeRad(p, q)
    gl.uniform1f(glOptions.get("f_r"), r)
    gl.uniform2f(glOptions.get("f_origin"), r, 0)
    const edges = shapeEdges(baseShape(p, r), p)
    gl.uniform3fv(glOptions.get("f_edges"), new Float32Array(edges))
}
*/