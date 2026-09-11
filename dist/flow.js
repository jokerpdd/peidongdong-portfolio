/* One controller for click, wheel, touch, and scene navigation. */
(function (root) {
  class SceneFlow {
    constructor({transition,onScene,onBusy,onExit}) {
      this.scene=0;this.busy=false;
      Object.assign(this,{transition,onScene,onBusy,onExit});
    }
    async goTo(target) {
      target=Math.max(0,Math.min(3,target));
      if(this.busy)return false;
      if(target===this.scene)return true;
      this.busy=true;this.onBusy(true);
      try {
        const last=Math.min(2,target);
        while(this.scene!==last){
          const next=this.scene+Math.sign(last-this.scene);
          await this.transition(this.scene,next);
          this.scene=next;this.onScene(next);
        }
        if(target===3)await this.onExit();
        return true;
      } finally {this.busy=false;this.onBusy(false);}
    }
    step(direction){return this.goTo(this.scene+Math.sign(direction));}
  }
  root.SceneFlow=SceneFlow;
})(typeof window==='undefined'?globalThis:window);
