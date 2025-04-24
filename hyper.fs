precision highp float;

#define MAX_P 16
#define MAX_ITER 64

uniform int f_mode;
uniform int f_iter;
uniform sampler2D f_cam;
uniform float f_time;
uniform vec3 f_resolution;
uniform int f_p;
uniform float f_r;
uniform vec2 f_center;
uniform vec2 f_origin;
uniform vec3 f_edges[MAX_P];

const float pi = acos(-1.0);

vec2 circle_invert(vec2 p, vec3 c) {
    vec2 v = p-c.xy;
    return v*c.z*c.z/dot(v,v)+c.xy;
}

float circle_dist(vec2 p, vec3 c) {
    return length(p-c.xy)-c.z;
}

vec2 translate(vec2 z, vec2 a) {
    vec2 n = z+a;
    vec2 d = vec2(z.x*a.x+z.y*a.y+1.0,z.x*a.y-z.y*a.x);
    return vec2(n.x*d.x-n.y*d.y,n.x*d.y+n.y*d.x)/dot(d,d);
}

float hyp_dist(vec2 p, vec2 q) {
    float pq = length(vec2(1.0-p.x*q.x-p.y*q.y,p.y*q.x-q.y*p.x));
    float diff = length(p-q);
    return log((pq+diff)/(pq-diff));
}

float grid(vec2 p, float s) {
    return mod(floor(p.x/s)+floor(p.y/s), 2.0);
}

/*
float shape_rad(int p, int q) {
    float t1 = tan(pi/2.0 - pi/float(q));
    float t2 = tan(pi/float(p));
    return sqrt((t1-t2)/(t1+t2));
}

vec2[max_p] base_shape(int p, float r) {
    vec2 shape[max_p];
    for(int i=0;i<p;i++) {
        float a = 2.0*pi*float(i)/float(p);
        shape[i] = vec2(cos(a),sin(a))*r;
    }
    shape[p] = shape[0];
    return shape;
}

vec3 circle_from_three_points(vec2 a, vec2 b, vec2 c) {
    float ab = (dot(a,a)-dot(b,b))/2.0;
    float bc = (dot(b,b)-dot(c,c))/2.0;
    float det = (a.x-b.x)*(b.y-c.y)-(a.y-b.y)*(b.x-c.x);
    float cx = (ab*(b.y-c.y)-bc*(a.y-b.y))/det;
    float cy = (bc*(a.x-b.x)-ab*(b.x-c.x))/det;
    float r = sqrt((cx-a.x)*(cx-a.x)+(cy-a.y)*(cy-a.y));
    return vec3(cx,cy,r);
}

vec3[max_p] shape_edges(vec2[max_p] shape, int p) {
    vec3 edges[max_p];
    for(int i=0;i<p;i++) {
        vec2 a = shape[i];
        vec2 b = shape[i+1];
        vec2 c = circle_invert(a, vec2(0), 1.0);
        edges[i] = circle_from_three_points(a,b,c);
    }
    return edges;
}
*/

vec3 rainbow_color(float angle) {
    return 0.5 + 0.5*cos(angle + vec3(0,2,4));
}

vec3 center_texture(vec2 uv, int iter) {
    if(f_mode == 0 || f_mode == 6) { //outline / outline filled
        for(int i=0;i<MAX_P;i++) {
            if(i>=f_p) break;
            vec3 c = f_edges[i] -vec3(f_center, 0);
            if(abs(circle_dist(uv, c)) < 0.01) return vec3(0);
        }
        if (f_mode == 0) return vec3(1);
        return rainbow_color(float(iter));
    } else if (f_mode == 1) { //b&w
        return vec3(mod(float(iter), 2.0));
    } else if (f_mode == 2) { //rainbow
        vec3 col = rainbow_color(f_time/2.0 + float(iter));
        return col * (1.0 - length(uv)/f_r*0.8);
    } else if (f_mode == 3) { //dual outline
        for(int i=0;i<MAX_P;i++) {
            if(i>=f_p) break;
            vec2 c = f_edges[i].xy - f_center;
            if(dot(uv, c) < 0.0) continue;
            vec2 proj = uv-c*dot(uv,c)/dot(c,c);
            if(length(proj) < 0.01) return vec3(0);
        }
        return vec3(1);
    } else if (f_mode == 4) { //dual color
        vec2 n = normalize(uv);
        float c_d = -1.0;
        int c_idx = 0;
        for(int i=0;i<MAX_P;i++) {
            if(i>=f_p) break;
            vec2 c = f_edges[i].xy - f_center;
            if(c.y*n.x-c.x*n.y < 0.0) continue;
            float d = dot(n,c)/length(c);
            if(d > c_d) {
                c_d = d;
                c_idx = i;
            }
        }
        return rainbow_color(float(c_idx)*2.0*pi/float(f_p));
    } else if (f_mode == 5) { //camera
        return texture2D(f_cam, (uv/f_r+1.0)/2.0).xyz;
    }
    return vec3(0);
}

void main()
{
    vec2 uv = (2.0*gl_FragCoord.xy-f_resolution.xy)/min(f_resolution.x, f_resolution.y);
    if(length(uv)>=1.0) {
        gl_FragColor = vec4(vec3(0.5),1.0);
        return;
    } 
    uv = translate(uv,f_origin);
    vec2 uvp = uv;
    float min_dist = hyp_dist(uvp,f_center);
    for(int iter=0;iter<MAX_ITER;iter++) {
        if(iter==f_iter) break;
        if(length(uv-f_center)<f_r) {
            bool in_middle = true;
            for(int i=0;i<MAX_P;i++) {
                if(i>=f_p) break;
                vec3 c = f_edges[i];
                if(circle_dist(uv,c)*circle_dist(f_center,c) < 0.0) {
                    in_middle = false;
                    break;
                }
            }
            if(in_middle) {
                vec3 col = center_texture(uv-f_center,iter);
                gl_FragColor = vec4(col,1.0);
                return;
            }
        }
        for(int i=0;i<MAX_P;i++) {
            if(i>=f_p) break;
            vec3 c = f_edges[i];
            vec2 p = circle_invert(uv,c);
            float dist = hyp_dist(p,f_center);
            if(dist<min_dist) {
                min_dist = dist;
                uvp = p;
            }
        }
        uv = uvp;
    }

    // Output to screen
    gl_FragColor = vec4(vec3(0),1.0);
}