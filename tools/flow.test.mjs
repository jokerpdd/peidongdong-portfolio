import test from 'node:test';
import assert from 'node:assert/strict';
await import('../dist/flow.js');
const {SceneFlow}=globalThis;
function create(transition=async()=>{}){const trace=[];const flow=new SceneFlow({transition:async(a,b)=>{trace.push([a,b]);await transition(a,b);},onScene:n=>trace.push(`scene:${n}`),onBusy:b=>trace.push(`busy:${b}`),onExit:async()=>trace.push('works')});return {flow,trace};}
test('three scenes precede works, then can navigate back',async()=>{const {flow,trace}=create();await flow.step(1);assert.equal(flow.scene,1);await flow.step(1);assert.equal(flow.scene,2);assert(!trace.includes('works'));await flow.step(1);assert(trace.includes('works'));await flow.step(-1);assert.equal(flow.scene,1);});
test('rapid repeated input does not overlap video transitions',async()=>{let release;const {flow,trace}=create(()=>new Promise(r=>release=r));const first=flow.step(1);assert.equal(flow.busy,true);assert.equal(await flow.step(1),false);assert.equal(await flow.goTo(2),false);release();await first;assert.equal(flow.scene,1);assert.equal(trace.filter(Array.isArray).length,1);});
test('direct scene navigation runs each provided transition in order',async()=>{const {flow,trace}=create();await flow.goTo(2);assert.deepEqual(trace.filter(Array.isArray),[[0,1],[1,2]]);assert.equal(flow.busy,false);});
test('failed transition unlocks input for a retry',async()=>{let fail=true;const {flow}=create(async()=>{if(fail)throw Error('media error');});await assert.rejects(flow.step(1));assert.equal(flow.busy,false);assert.equal(flow.scene,0);fail=false;await flow.step(1);assert.equal(flow.scene,1);});
