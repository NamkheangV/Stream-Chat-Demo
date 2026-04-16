function a(e){const n=e.replace("#",""),t=parseInt(n.length===3?n.split("").map(o=>o+o).join(""):n,16),s=t>>16&255,c=t>>8&255,r=t&255;return`${s}, ${c}, ${r}`}export{a as h};
