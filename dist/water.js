/* A small height-field simulation refracts the hero media. Text stays crisp above it. */
(() => {
  'use strict';
  const vertex = `attribute vec2 aPosition; varying vec2 vUv;
    void main(){vUv=aPosition*.5+.5;gl_Position=vec4(aPosition,0.,1.);}`;
  const simulation = `precision mediump float; varying vec2 vUv;
    uniform sampler2D uState; uniform vec2 uPixel; uniform vec2 uPointer;
    uniform float uAspect; uniform float uImpulse;
    float heightAt(vec2 uv){return texture2D(uState,uv).r*2.-1.;}
    void main(){vec2 old=texture2D(uState,vUv).rg*2.-1.;
      float neighbors=heightAt(vUv+vec2(uPixel.x,0.))+heightAt(vUv-vec2(uPixel.x,0.))
        +heightAt(vUv+vec2(0.,uPixel.y))+heightAt(vUv-vec2(0.,uPixel.y));
      float h=(neighbors*.5-old.y)*.981;
      vec2 d=vUv-uPointer;d.x*=uAspect;
      h+=exp(-dot(d,d)/.00024)*uImpulse;
      gl_FragColor=vec4(clamp(h,-.95,.95)*.5+.5,old.x*.5+.5,0.,1.);
    }`;
  const display = `precision mediump float; varying vec2 vUv;
    uniform sampler2D uMedia; uniform sampler2D uPrevious; uniform sampler2D uState;
    uniform vec2 uScale; uniform vec2 uPreviousScale; uniform vec2 uPixel; uniform float uMix;
    void main(){float l=texture2D(uState,vUv-vec2(uPixel.x,0.)).r;
      float r=texture2D(uState,vUv+vec2(uPixel.x,0.)).r;
      float b=texture2D(uState,vUv-vec2(0.,uPixel.y)).r;
      float t=texture2D(uState,vUv+vec2(0.,uPixel.y)).r;
      vec2 normal=vec2(l-r,b-t);vec2 uv=vUv+normal*.07;
      vec4 current=texture2D(uMedia,(uv-.5)*uScale+.5);
      vec4 previous=texture2D(uPrevious,(uv-.5)*uPreviousScale+.5);
      vec3 c=mix(previous.rgb,current.rgb,uMix);
      c+=clamp((normal.x+normal.y)*.38,-.032,.032)*vec3(.45,.72,1.);
      gl_FragColor=vec4(c,1.);
    }`;

  class WaterScene {
    constructor(canvas) {
      this.canvas=canvas; this.available=false; this.visible=true; this.raf=0;
      this.impulse=0; this.pointer=[-2,-2]; this.lastPointer=null; this.media=null;
      this.reduced=matchMedia('(prefers-reduced-motion: reduce)');
      if(this.reduced.matches || matchMedia('(pointer: coarse)').matches) return;
      try {
        this.gl=canvas.getContext('webgl',{alpha:false,antialias:false,powerPreference:'low-power',preserveDrawingBuffer:false});
        if(!this.gl) return;
        const gl=this.gl;
        this.sim=this.program(vertex,simulation);this.render=this.program(vertex,display);
        this.buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);
        gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
        this.currentTexture=this.texture();this.previousTexture=this.texture();
        this.previousSize=[1920,1080];this.mediaSize=[1920,1080];this.lastVideoTime=-1;
        this.available=true;this.resize();
        addEventListener('resize',()=>this.resize());
        document.addEventListener('visibilitychange',()=>document.hidden?this.stop():this.start());
        this.reduced.addEventListener('change',()=>{if(this.reduced.matches){this.stop();canvas.classList.remove('ready');}else this.start();});
        canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();this.available=false;this.stop();canvas.classList.remove('ready');});
        this.tick=this.tick.bind(this);
      } catch(error) {this.available=false;canvas.classList.remove('ready');}
    }
    program(v,f) {
      const gl=this.gl;const p=gl.createProgram();
      for(const [kind,source] of [[gl.VERTEX_SHADER,v],[gl.FRAGMENT_SHADER,f]]){
        const s=gl.createShader(kind);gl.shaderSource(s,source);gl.compileShader(s);
        if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error('Shader unavailable');
        gl.attachShader(p,s);gl.deleteShader(s);
      }
      gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error('Shader link unavailable');
      const uniforms={};const count=gl.getProgramParameter(p,gl.ACTIVE_UNIFORMS);
      for(let i=0;i<count;i++){const name=gl.getActiveUniform(p,i).name;uniforms[name]=gl.getUniformLocation(p,name);}
      return {p,uniforms,attribute:gl.getAttribLocation(p,'aPosition')};
    }
    texture() {
      const gl=this.gl;const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([7,17,38,255]));return t;
    }
    target(w,h) {
      const gl=this.gl,t=this.texture(),f=gl.createFramebuffer();
      gl.bindTexture(gl.TEXTURE_2D,t);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
      gl.bindFramebuffer(gl.FRAMEBUFFER,f);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,t,0);
      if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw new Error('Framebuffer unavailable');
      gl.clearColor(.5,.5,0,1);gl.clear(gl.COLOR_BUFFER_BIT);return {t,f};
    }
    resize() {
      if(!this.available)return;const gl=this.gl;
      const rect=this.canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,1.5);
      this.width=Math.max(1,rect.width);this.height=Math.max(1,rect.height);
      this.canvas.width=Math.round(this.width*dpr);this.canvas.height=Math.round(this.height*dpr);
      this.sw=320;this.sh=Math.max(100,Math.round(320*this.height/this.width));
      for(const t of [this.front,this.back])if(t){gl.deleteTexture(t.t);gl.deleteFramebuffer(t.f);}
      this.front=this.target(this.sw,this.sh);this.back=this.target(this.sw,this.sh);
      gl.bindFramebuffer(gl.FRAMEBUFFER,null);
    }
    setMedia(media) {
      if(!this.available||!media)return;
      if(this.media===media){this.dirty=true;this.start();return;}
      this.previousSize=this.mediaSize;this.mediaSize=[media.videoWidth||media.naturalWidth||1920,media.videoHeight||media.naturalHeight||1080];
      [this.currentTexture,this.previousTexture]=[this.previousTexture,this.currentTexture];
      this.media=media;this.dirty=true;this.lastVideoTime=-1;this.blendStart=performance.now();this.start();
    }
    pointerMove(event) {
      if(!this.available||event.pointerType==='touch')return;
      const r=this.canvas.getBoundingClientRect();
      const x=(event.clientX-r.left)/r.width,y=1-(event.clientY-r.top)/r.height;
      if(this.lastPointer){const speed=Math.hypot(x-this.lastPointer[0],y-this.lastPointer[1]);this.impulse=Math.min(.24,.055+speed*2.4);}
      this.pointer=[x,y];this.lastPointer=[x,y];
    }
    setVisible(visible){this.visible=visible;visible?this.start():this.stop();}
    start(){if(!this.available||!this.media||this.raf||!this.visible||document.hidden||this.reduced.matches)return;this.raf=requestAnimationFrame(this.tick);}
    stop(){cancelAnimationFrame(this.raf);this.raf=0;}
    use(program){const gl=this.gl;gl.useProgram(program.p);gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);gl.enableVertexAttribArray(program.attribute);gl.vertexAttribPointer(program.attribute,2,gl.FLOAT,false,0,0);}
    bind(texture,unit,uniform){const gl=this.gl;gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,texture);gl.uniform1i(uniform,unit);}
    scale([w,h]){const viewport=this.width/this.height,aspect=w/h;return viewport>aspect?[1,aspect/viewport]:[viewport/aspect,1];}
    tick(now){
      this.raf=0;if(!this.available||!this.visible||document.hidden)return;
      const gl=this.gl,isVideo=this.media instanceof HTMLVideoElement;
      if((this.dirty||isVideo&&this.media.currentTime!==this.lastVideoTime)&&(!isVideo||this.media.readyState>=2)){
        try{gl.bindTexture(gl.TEXTURE_2D,this.currentTexture);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,this.media);this.dirty=false;this.lastVideoTime=this.media.currentTime;this.canvas.classList.add('ready');}
        catch(e){this.available=false;this.canvas.classList.remove('ready');return;}
      }
      this.use(this.sim);gl.bindFramebuffer(gl.FRAMEBUFFER,this.back.f);gl.viewport(0,0,this.sw,this.sh);
      const s=this.sim.uniforms;this.bind(this.front.t,0,s.uState);gl.uniform2f(s.uPixel,1/this.sw,1/this.sh);gl.uniform2f(s.uPointer,...this.pointer);gl.uniform1f(s.uAspect,this.width/this.height);gl.uniform1f(s.uImpulse,this.impulse);this.impulse=0;
      gl.drawArrays(gl.TRIANGLE_STRIP,0,4);[this.front,this.back]=[this.back,this.front];
      this.use(this.render);gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,this.canvas.width,this.canvas.height);
      const u=this.render.uniforms;this.bind(this.currentTexture,0,u.uMedia);this.bind(this.previousTexture,1,u.uPrevious);this.bind(this.front.t,2,u.uState);
      gl.uniform2f(u.uPixel,1/this.sw,1/this.sh);gl.uniform2f(u.uScale,...this.scale(this.mediaSize));gl.uniform2f(u.uPreviousScale,...this.scale(this.previousSize));gl.uniform1f(u.uMix,Math.min(1,(now-this.blendStart)/220));
      gl.drawArrays(gl.TRIANGLE_STRIP,0,4);this.start();
    }
  }
  window.WaterScene=WaterScene;
})();
