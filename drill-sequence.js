(function(root){function create(){let hold=0,attack=-1,explosion=-1,locked=false;
return {tick(dt,eligible,holding){dt=Math.max(0,dt);if(explosion>=0){explosion+=dt;if(explosion>1.3)explosion=-1;}
if(!holding)locked=false;
if(attack>=0){if(!eligible){attack=-1;hold=0;return null;}attack+=dt;if(attack>=2.5){attack=-1;locked=true;return 'burst';}return null;}
if(!eligible||!holding||locked){hold=0;return null;}hold+=dt;if(hold>=1.5){hold=0;attack=0;return 'start';}return null;},
reset(){hold=0;attack=-1;explosion=-1;locked=false;},cancel(){hold=0;attack=-1;locked=true;},burst(){explosion=0;},get active(){return attack>=0;},get attack(){return attack;},get hold(){return hold;},get explosion(){return explosion;}};}
const api={create};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.DrillSequence=api;
})(typeof window!=='undefined'?window:globalThis);
